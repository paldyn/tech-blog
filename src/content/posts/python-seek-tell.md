---
title: "seek·tell: 파일 포인터로 임의 위치 읽기·쓰기"
description: "Python 파일 객체의 seek()와 tell()로 파일 포인터를 제어하는 방법을 설명합니다. whence 매개변수, 텍스트·이진 모드에서의 제약, 파일 크기 확인, 이진 파일 파싱, r+ 편집 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "seek", "tell", "파일포인터", "이진파일", "파일입출력", "랜덤액세스"]
featured: false
draft: false
---

[지난 글](/posts/python-write-flush-buffer/)에서 쓰기 버퍼를 살펴봤다. 파일을 처음부터 끝까지 순서대로 읽지 않고 **원하는 위치**로 바로 이동해서 읽거나 쓸 수 있다. 이것이 `seek()`와 `tell()`의 역할이다. 이진 파일 파싱, 대용량 파일의 일부만 수정, 파일 크기 확인 등에 필수적이다.

## 파일 포인터란

파일을 열면 내부에 **파일 포인터(file pointer)** 라는 커서가 생긴다. `read()`나 `write()`를 호출할 때마다 이 커서가 읽은·쓴 바이트 수만큼 앞으로 이동한다.

```python
with open("hello.txt", "rb") as f:
    print(f.tell())       # 0  — 파일 처음
    data = f.read(5)      # 5바이트 읽기
    print(f.tell())       # 5  — 5바이트 이동
    data2 = f.read(2)     # 2바이트 더 읽기
    print(f.tell())       # 7
```

## seek() 완전 정리

![seek()와 tell() — 파일 포인터 제어](/assets/posts/python-seek-tell-overview.svg)

```python
# seek(offset, whence)
# whence=0 (SEEK_SET): 파일 시작 기준 (기본값)
# whence=1 (SEEK_CUR): 현재 위치 기준
# whence=2 (SEEK_END): 파일 끝 기준

import io

with open("data.bin", "rb") as f:
    f.seek(0)           # 처음으로
    f.seek(100)         # 시작에서 100바이트
    f.seek(10, 1)       # 현재 위치에서 10바이트 앞으로
    f.seek(-5, 1)       # 현재 위치에서 5바이트 뒤로
    f.seek(0, 2)        # 파일 끝으로
    f.seek(-100, 2)     # 끝에서 100바이트 전으로
```

**중요**: 텍스트 모드에서는 `seek(0)`(맨 처음으로)과 `seek(f.tell())`(현재 위치 재설정)만 안전하다. 멀티바이트 문자(UTF-8 한글 등)에서 임의 바이트 오프셋은 문자 경계를 어길 수 있기 때문이다. 임의 위치 접근이 필요하면 이진 모드를 써야 한다.

## 파일 크기 확인

```python
import os
from pathlib import Path

# 방법 1: os.path.getsize
size = os.path.getsize("file.bin")

# 방법 2: pathlib
size = Path("file.bin").stat().st_size

# 방법 3: seek(0, 2) + tell() — 이미 열린 파일 객체에 유용
with open("file.bin", "rb") as f:
    f.seek(0, 2)         # 끝으로 이동
    size = f.tell()      # 현재 위치 = 파일 크기
    f.seek(0)            # 처음으로 되돌리기
    print(f"파일 크기: {size:,} 바이트")
```

## 이진 파일 구조 파싱

![seek/tell 실전 활용](/assets/posts/python-seek-tell-code.svg)

```python
import struct

# PNG 파일 헤더 파싱
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'

def parse_png_header(path: str) -> dict:
    with open(path, "rb") as f:
        # 시그니처 확인 (8바이트)
        sig = f.read(8)
        if sig != PNG_SIGNATURE:
            raise ValueError("PNG 파일이 아닙니다")

        # IHDR 청크 (4+4+13+4=25바이트)
        length = int.from_bytes(f.read(4), "big")   # 13
        chunk_type = f.read(4)                       # b'IHDR'
        
        width = int.from_bytes(f.read(4), "big")
        height = int.from_bytes(f.read(4), "big")
        bit_depth = f.read(1)[0]
        color_type = f.read(1)[0]

    return {
        "width": width,
        "height": height,
        "bit_depth": bit_depth,
        "color_type": color_type,
    }

info = parse_png_header("image.png")
print(f"{info['width']}x{info['height']}, {info['bit_depth']}bit")
```

## r+ 모드로 파일 일부 수정

```python
from pathlib import Path

# 파일의 특정 위치를 수정하는 세 가지 방법

# 방법 1: r+ + seek + write + truncate (in-place 편집)
with open("config.txt", "r+", encoding="utf-8") as f:
    content = f.read()
    new_content = content.replace("version=1", "version=2")
    f.seek(0)
    f.write(new_content)
    f.truncate()          # 이전 내용 잔재 제거

# 방법 2: pathlib (더 간단, 소용량 파일)
p = Path("config.txt")
text = p.read_text(encoding="utf-8")
p.write_text(text.replace("version=1", "version=2"), encoding="utf-8")

# 방법 3: 원자적 교체 (대용량 또는 안전이 중요할 때)
import tempfile, os
with open("config.txt", encoding="utf-8") as fin:
    content = fin.read()
new = content.replace("version=1", "version=2")
with tempfile.NamedTemporaryFile("w", encoding="utf-8",
                                  dir=".", delete=False) as tmp:
    tmp.write(new)
    tmpname = tmp.name
os.replace(tmpname, "config.txt")
```

## truncate()

`truncate(size=None)`은 파일을 현재 포인터 위치(또는 지정한 크기)에서 잘라낸다. `r+`로 파일을 읽고 수정된 내용을 쓸 때 반드시 필요하다.

```python
with open("data.txt", "r+", encoding="utf-8") as f:
    f.write("짧은 내용")    # 이전 내용이 더 길었다면?
    f.truncate()             # 현재 포인터 이후 데이터 삭제
    # truncate() 없으면 파일 끝에 이전 내용 잔재가 남음
```

## 언제 seek/tell을 써야 하나

| 사용 상황 | 방법 |
|---|---|
| 파일 전체 읽기·쓰기 | `read()` / `write()` — seek 불필요 |
| 이진 파일 특정 오프셋 파싱 | `seek(offset)` + `read(n)` |
| 파일 크기 확인 | `Path.stat().st_size` 또는 `seek(0,2)+tell()` |
| 텍스트 파일 in-place 편집 | `r+` + `seek(0)` + `truncate()` |
| 파일 끝 N바이트 읽기 | `seek(-N, 2)` + `read()` (이진 모드) |

---

**지난 글:** [write·flush·버퍼: 파일 쓰기의 내부 동작](/posts/python-write-flush-buffer/)

**다음 글:** [pathlib로 파일 읽고 쓰기: 현대적인 파일 I/O](/posts/python-pathlib-read-write/)

<br>
읽어주셔서 감사합니다. 😊
