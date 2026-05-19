---
title: "tempfile: 임시 파일과 디렉토리 안전하게 다루기"
description: "Python tempfile 모듈로 임시 파일과 디렉토리를 안전하게 생성하고 자동 정리하는 방법을 설명합니다. NamedTemporaryFile, TemporaryDirectory, SpooledTemporaryFile, mkstemp 등을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "tempfile", "임시파일", "임시디렉토리", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-glob-fnmatch/)에서 파일명 패턴 매칭을 다루는 `glob`과 `fnmatch`를 살펴봤습니다. 이번에는 임시 파일과 디렉토리를 안전하게 만들고 자동으로 정리하는 `tempfile` 모듈을 정리합니다. 테스트 픽스처, 파이프라인 중간 결과물, 업로드 처리 등 "잠깐 쓰고 버리는" 파일이 필요할 때 없어서는 안 될 모듈입니다.

## tempfile 모듈이 필요한 이유

```python
# 나쁜 예: 직접 /tmp 경로를 하드코딩
path = "/tmp/my_temp_file.txt"
with open(path, "w") as f:
    f.write("data")
# 나중에 f.close() 후 지워야 하는데... 예외 발생 시 누락될 수 있음
```

직접 임시 파일 경로를 만들면 충돌, 권한 문제, 정리 누락 등 여러 문제가 생깁니다. `tempfile` 모듈은 고유한 이름 자동 생성, 적절한 권한 설정(소유자만 읽기/쓰기), 컨텍스트 매니저를 통한 자동 정리를 모두 처리합니다.

## NamedTemporaryFile — 이름 있는 임시 파일

```python
import tempfile

with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".csv",
    prefix="data_",
    encoding="utf-8"
) as f:
    f.write("id,name,score\n")
    f.write("1,Alice,95\n")
    f.flush()         # 버퍼 비우기
    print(f.name)     # /tmp/data_XXXXXXXX.csv

# with 블록 종료 시 자동 삭제
```

`delete=False`를 추가하면 `with` 블록이 끝난 후에도 파일이 유지됩니다. 다른 프로세스에 경로를 전달해야 할 때 씁니다.

```python
with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
    f.write(b'{"key": "value"}')
    temp_path = f.name

# 파일을 다른 곳에 전달 후
import os
os.unlink(temp_path)  # 직접 정리
```

![tempfile 모듈 4가지 객체](/assets/posts/python-tempfile-types.svg)

## TemporaryDirectory — 임시 디렉토리

```python
import tempfile
import os

with tempfile.TemporaryDirectory(prefix="build_") as tmpdir:
    # tmpdir: /tmp/build_XXXXXXXX
    output_path = os.path.join(tmpdir, "output.bin")

    # 빌드 작업...
    with open(output_path, "wb") as out:
        out.write(b"compiled data")

    print(os.listdir(tmpdir))

# with 종료 시 tmpdir 전체(하위 파일 포함) 자동 삭제
```

`TemporaryDirectory`는 테스트에서 격리된 파일시스템 공간을 만들 때 특히 유용합니다.

## SpooledTemporaryFile — 메모리 우선 임시 파일

```python
import tempfile

# 1MB 이하는 메모리에만, 초과 시 디스크로 자동 이동
with tempfile.SpooledTemporaryFile(max_size=1024 * 1024, mode="w") as f:
    f.write("header\n")
    for row in large_data:
        f.write(f"{row}\n")

    f.seek(0)
    content = f.read()
```

네트워크에서 받은 데이터를 처리할 때 크기를 미리 알 수 없다면 `SpooledTemporaryFile`이 적합합니다. 메모리 내에서 처리하고 크면 자동으로 디스크로 넘깁니다.

## TemporaryFile — 이름 없는 임시 파일

```python
import tempfile

with tempfile.TemporaryFile(mode="w+b") as f:
    f.write(b"binary data")
    f.seek(0)
    data = f.read()
    print(data)

# 파일시스템에 경로가 없음 → 다른 프로세스가 접근 불가
# 가장 안전한 임시 파일
```

`TemporaryFile`은 운영체제에 따라 파일시스템에 아예 이름이 나타나지 않을 수 있습니다(Linux에서는 unlink 후 fd만 유지). 다른 프로세스에서 접근할 필요가 없다면 이것이 가장 안전합니다.

![tempfile 코드 패턴](/assets/posts/python-tempfile-code.svg)

## mkstemp / mkdtemp — 저수준 API

```python
import tempfile, os

# mkstemp: fd(파일 디스크립터) + 경로 반환
fd, path = tempfile.mkstemp(suffix=".tmp", dir="/data/work")
try:
    os.write(fd, b"raw data")
finally:
    os.close(fd)
    os.unlink(path)  # 직접 정리

# mkdtemp: 디렉토리 경로 반환
tmpdir = tempfile.mkdtemp(prefix="job_")
try:
    pass  # 작업
finally:
    import shutil
    shutil.rmtree(tmpdir)  # 직접 정리
```

`mkstemp()`와 `mkdtemp()`는 컨텍스트 매니저를 제공하지 않아 직접 정리해야 합니다. 가능하면 `NamedTemporaryFile` / `TemporaryDirectory`의 `with` 문을 씁니다.

## gettempdir — 시스템 임시 디렉토리 위치

```python
import tempfile

print(tempfile.gettempdir())   # /tmp (Linux/macOS), C:\Users\...\Temp (Windows)
print(tempfile.gettempprefix()) # tmp
```

## 테스트 코드에서의 활용

```python
import unittest
import tempfile
import os

class FileProcessorTest(unittest.TestCase):
    def setUp(self):
        # 테스트마다 격리된 임시 디렉토리 생성
        self.tmpdir = tempfile.TemporaryDirectory()
        self.workdir = self.tmpdir.name

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_output_file(self):
        out_path = os.path.join(self.workdir, "output.txt")
        process_and_save(out_path)
        self.assertTrue(os.path.exists(out_path))
```

pytest에서는 `tmp_path` 픽스처가 같은 역할을 합니다.

## 정리

| 클래스/함수 | 특징 | 정리 방식 |
|-------------|------|-----------|
| `NamedTemporaryFile` | 이름 있음, 경로 공유 가능 | `with` 자동 / `delete=False` 후 수동 |
| `TemporaryFile` | 이름 없음, 가장 안전 | `with` 자동 |
| `TemporaryDirectory` | 디렉토리 트리 | `with` 자동 |
| `SpooledTemporaryFile` | 메모리 → 디스크 자동 전환 | `with` 자동 |
| `mkstemp` / `mkdtemp` | 저수준 | 수동 정리 필수 |

---

**지난 글:** [glob과 fnmatch: 파일 패턴 매칭](/posts/python-glob-fnmatch/)

**다음 글:** [datetime 기초: 날짜와 시간 다루기](/posts/python-datetime-basics/)

<br>
읽어주셔서 감사합니다. 😊
