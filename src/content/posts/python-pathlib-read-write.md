---
title: "pathlib로 파일 읽고 쓰기: 현대적인 파일 I/O"
description: "Python 3.4+의 pathlib.Path를 활용한 파일 읽기·쓰기를 설명합니다. read_text·write_text·read_bytes·write_bytes, / 연산자 경로 조합, glob·rglob, mkdir·unlink·rename, os.path 대비 장점까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "pathlib", "파일입출력", "경로조작", "read_text", "write_text", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-seek-tell/)에서 `seek()`와 `tell()`로 파일 포인터를 제어하는 방법을 살펴봤다. 지금까지 `open()`에 문자열 경로를 전달하는 방식을 써왔다면, Python 3.4부터 도입된 `pathlib.Path`를 사용하면 경로 조작과 파일 I/O를 더 직관적으로 처리할 수 있다. 오늘날 파이써닉한 코드에서 `os.path`보다 `pathlib`를 선호하는 이유를 알아보자.

## pathlib.Path 기본 개념

```python
from pathlib import Path

# 경로 생성
p = Path("data/logs/app.log")          # 상대 경로
p = Path("/home/user/data/app.log")    # 절대 경로
p = Path.home() / "Documents" / "note.txt"  # 홈 디렉터리

# / 연산자로 경로 이어붙이기
base = Path("project")
config = base / "config" / "settings.json"
print(config)   # project/config/settings.json

# 현재 디렉터리
cwd = Path.cwd()
```

## 파일 읽기: read_text · read_bytes

![pathlib vs open() — 파일 I/O 비교](/assets/posts/python-pathlib-read-write-overview.svg)

```python
from pathlib import Path

p = Path("data/report.txt")

# 텍스트 읽기 — with open() 없이 한 줄
content = p.read_text(encoding="utf-8")

# 이진 읽기
raw = p.read_bytes()   # → bytes

# 라인 단위로 처리 (대용량)
with p.open("r", encoding="utf-8") as f:
    for line in f:
        process(line)
```

`read_text()`와 `read_bytes()`는 내부적으로 `with open()` 블록을 사용하므로 자동으로 파일이 닫힌다. 단, 파일 전체를 메모리에 올리므로 대용량 파일에는 `p.open()`으로 스트리밍이 더 적합하다.

## 파일 쓰기: write_text · write_bytes

```python
from pathlib import Path

p = Path("output/result.txt")

# 부모 디렉터리가 없으면 먼저 생성
p.parent.mkdir(parents=True, exist_ok=True)

# 텍스트 쓰기 (파일 있으면 덮어씀)
bytes_written = p.write_text("결과 내용\n", encoding="utf-8")

# 이진 쓰기
p.write_bytes(b"\x89PNG\r\n\x1a\n")

# 추가 모드 — append는 open() 사용
with p.open("a", encoding="utf-8") as f:
    f.write("추가 내용\n")
```

`write_text()`는 항상 파일을 새로 써서 기존 내용을 덮어쓴다. 추가(append) 모드가 필요하면 `p.open("a")` 또는 `open(p, "a")`를 써야 한다.

## pathlib 핵심 메서드

![pathlib 파일 I/O 핵심 메서드](/assets/posts/python-pathlib-read-write-code.svg)

## 경로 속성과 메타데이터

```python
from pathlib import Path

p = Path("data/logs/app.log")

# 경로 분해
print(p.name)         # 'app.log'
print(p.stem)         # 'app'  (확장자 제외)
print(p.suffix)       # '.log'
print(p.parent)       # data/logs
print(p.parts)        # ('data', 'logs', 'app.log')

# 절대 경로
print(p.resolve())    # /home/user/project/data/logs/app.log

# 존재 여부 및 타입
print(p.exists())     # True/False
print(p.is_file())    # True
print(p.is_dir())     # False

# 파일 메타데이터
stat = p.stat()
print(stat.st_size)           # 파일 크기 (bytes)
print(stat.st_mtime)          # 마지막 수정 시간 (Unix timestamp)

import datetime
mtime = datetime.datetime.fromtimestamp(stat.st_mtime)
print(mtime.strftime("%Y-%m-%d %H:%M:%S"))
```

## 디렉터리 탐색: glob · rglob

```python
from pathlib import Path

base = Path("project")

# 현재 디렉터리에서 .py 파일
for f in base.glob("*.py"):
    print(f)

# 재귀 탐색 (모든 하위 폴더)
for f in base.rglob("*.py"):
    print(f)

# 특정 패턴
for f in base.glob("test_*.py"):
    print(f)

# 모든 파일 (디렉터리 제외)
py_files = [f for f in base.rglob("*") if f.is_file()]

# 파일 크기 합계
total = sum(f.stat().st_size for f in base.rglob("*") if f.is_file())
print(f"총 크기: {total:,} bytes")
```

## 파일 시스템 조작

```python
from pathlib import Path

# 디렉터리 생성
Path("output/reports/2024").mkdir(parents=True, exist_ok=True)

# 파일 삭제
p = Path("temp.txt")
p.unlink(missing_ok=True)      # 없어도 에러 없음 (Python 3.8+)

# 디렉터리 삭제 (비어있어야 함)
Path("empty_dir").rmdir()

# 이름 변경 / 이동
Path("old.txt").rename("new.txt")

# 복사 (shutil 사용)
import shutil
shutil.copy2("source.txt", "dest.txt")           # 메타데이터 포함
shutil.copytree("src_dir", "dst_dir")            # 디렉터리 재귀 복사
shutil.rmtree("old_dir")                          # 디렉터리 재귀 삭제
```

## pathlib vs os.path 선택 기준

| 상황 | 권장 |
|---|---|
| 새 코드 작성 | `pathlib` |
| 기존 레거시 코드 유지 | `os.path` (점진적 교체) |
| 경로를 str로 받는 API | `str(p)` 또는 `os.fspath(p)` |
| 대용량 파일 스트리밍 | `p.open()` 또는 `open(p)` |
| 전체 읽기·쓰기 | `p.read_text()` / `p.write_text()` |

```python
# pathlib Path는 str이 필요한 곳에서 자동 변환
import subprocess
p = Path("script.py")
subprocess.run(["python", p])          # Path → str 자동
subprocess.run(["python", str(p)])     # 명시적

# os.fspath()로 명시적 변환
os.fspath(p)     # → '/absolute/path/script.py'
```

---

**지난 글:** [seek·tell: 파일 포인터로 임의 위치 읽기·쓰기](/posts/python-seek-tell/)

**다음 글:** [mmap: 메모리 맵 파일로 대용량 처리](/posts/python-mmap/)

<br>
읽어주셔서 감사합니다. 😊
