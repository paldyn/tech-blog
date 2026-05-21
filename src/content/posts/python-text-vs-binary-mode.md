---
title: "텍스트 vs 이진 모드: 개행 문자와 인코딩의 차이"
description: "Python 파일 입출력에서 텍스트 모드와 이진 모드의 차이를 정확히 설명합니다. 개행 문자 자동 변환, str vs bytes, newline 매개변수, 이진 파일 손상 방지까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "파일입출력", "텍스트모드", "이진모드", "개행문자", "인코딩", "bytes"]
featured: false
draft: false
---

[지난 글](/posts/python-with-context/)에서 `with` 문으로 파일을 안전하게 열고 닫는 방법을 살펴봤다. `open()`을 쓸 때 모드로 `'r'`과 `'rb'`를 구별하는 것은 단순히 `str`을 반환하느냐 `bytes`를 반환하느냐의 차이가 아니다. 내부적으로 **개행 문자 변환**과 **인코딩/디코딩** 레이어가 있느냐 없느냐의 차이이며, 이것이 잘못 선택되면 이미지나 ZIP 파일이 조용히 손상된다.

## 텍스트 모드와 이진 모드의 두 가지 차이

![텍스트 모드 vs 이진 모드](/assets/posts/python-text-vs-binary-mode-overview.svg)

### 차이 1: 개행 문자 변환 (Universal Newlines)

운영체제마다 파일에 저장하는 개행 문자가 다르다.

- **Unix/Linux/macOS**: `\n` (LF, 1바이트)
- **Windows**: `\r\n` (CRLF, 2바이트)
- **구버전 Mac**: `\r` (CR, 1바이트, 거의 사라짐)

텍스트 모드(`'r'`, `'w'`)에서 Python은 **Universal Newlines**를 적용한다.

- **읽기**: 파일의 `\r\n`, `\r`을 모두 `\n`으로 변환한 뒤 반환
- **쓰기**: `\n`을 현재 OS의 기본 개행 문자로 변환

```python
# Windows 파일 (내부 \r\n) — 텍스트 모드
with open("windows_file.txt", "r", encoding="utf-8") as f:
    content = f.read()
# content의 모든 \r\n → \n 으로 변환됨

# 이진 모드 — 변환 없음
with open("windows_file.txt", "rb") as f:
    raw = f.read()
# raw에는 \r\n 그대로 포함
```

이 변환은 **이진 파일에서는 재앙**이다. 이미지 파일에 우연히 `0x0D 0x0A` (CRLF와 동일한 바이트 쌍)가 있으면, 텍스트 모드로 읽을 때 `0x0A` (LF)로 바뀌어버린다. 파일이 손상된다.

```python
# ❌ 이미지를 텍스트 모드로 열면 손상
with open("photo.jpg", "r") as f:          # 위험!
    corrupted = f.read()

# ✅ 이진 파일은 반드시 'rb'
with open("photo.jpg", "rb") as f:
    original = f.read()                    # 원본 그대로
```

### 차이 2: 인코딩/디코딩 레이어

텍스트 모드에서 `read()`는 디스크의 바이트를 `encoding` 매개변수에 따라 디코딩해 `str`을 반환한다. `write()`는 반대로 `str`을 인코딩해 바이트를 저장한다.

이진 모드에서는 이 레이어가 없다. `read()`는 `bytes`를 반환하고, `write()`는 `bytes`만 받는다.

```python
# 텍스트 모드: str 자동 변환
with open("text.txt", "w", encoding="utf-8") as f:
    f.write("안녕하세요")          # str → bytes 자동

with open("text.txt", "r", encoding="utf-8") as f:
    s = f.read()                   # bytes → str 자동
    print(type(s))                 # <class 'str'>

# 이진 모드: bytes 직접 처리
with open("text.bin", "wb") as f:
    f.write("안녕하세요".encode("utf-8"))   # 직접 인코딩 필요
    # f.write("안녕하세요")         # → TypeError: str not bytes

with open("text.bin", "rb") as f:
    b = f.read()
    print(type(b))                 # <class 'bytes'>
    s = b.decode("utf-8")         # 직접 디코딩 필요
```

## 실전 코드

![개행 문자와 인코딩 처리 비교](/assets/posts/python-text-vs-binary-mode-code.svg)

## CSV 파일과 `newline=''`

`csv` 모듈 공식 문서는 CSV 파일을 열 때 `newline=''`를 사용하도록 권장한다.

```python
import csv

# ✅ csv.reader/writer 사용 시 newline=''
with open("data.csv", "r", encoding="utf-8", newline="") as f:
    reader = csv.reader(f)
    for row in reader:
        print(row)

with open("out.csv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["이름", "나이"])
    writer.writerow(["Alice", 30])
```

`newline=""`을 지정하면 Python의 Universal Newlines 변환이 비활성화되고 `csv` 모듈이 직접 개행 처리를 담당한다. 이 옵션 없이 열면 Windows에서 각 행 뒤에 빈 줄이 추가되는 문제가 생긴다.

## newline 매개변수 완전 정리

```python
# newline=None (기본): Universal Newlines 활성화
# newline=''  : 변환 없이 \r\n, \r을 그대로 반환 (csv용)
# newline='\n': \r\n → \n 변환, \r은 그대로
# newline='\r\n': 쓸 때 \n → \r\n 변환

# 각 OS의 줄 끝을 명시적으로 제어하고 싶을 때
with open("crossplatform.txt", "w", newline="\r\n") as f:
    f.write("Windows 형식\n")    # → 파일에 \r\n 저장
```

## 언제 어떤 모드를 써야 하나

| 파일 종류 | 올바른 모드 | 이유 |
|---|---|---|
| `.txt`, `.md`, `.py`, `.html` | `'r'` / `'w'` | 텍스트, 인코딩 처리 필요 |
| `.csv`, `.tsv` | `'r', newline=''` | csv 모듈과 함께 사용 |
| `.jpg`, `.png`, `.gif` | `'rb'` / `'wb'` | 이진 데이터, 변환 금지 |
| `.pdf`, `.docx`, `.zip` | `'rb'` / `'wb'` | 이진 형식 |
| `.mp3`, `.mp4`, `.avi` | `'rb'` / `'wb'` | 이진 데이터 |
| 소켓에서 받은 데이터 | `'wb'` 또는 직접 처리 | 이진 스트림 |

이진 파일과 텍스트 파일을 구분하는 간단한 방법은 "파일을 메모장으로 열었을 때 사람이 읽을 수 있는가"다. 읽을 수 있으면 텍스트 모드, 깨진 글자나 이상한 기호가 가득하면 이진 모드가 맞다.

## `io` 모듈: 스트림 클래스 계층

텍스트 모드와 이진 모드의 차이는 `io` 모듈의 스트림 클래스에서 나온다.

```python
import io

# 텍스트 모드 open() → io.TextIOWrapper 반환
with open("a.txt", "r") as f:
    print(type(f))   # <class '_io.TextIOWrapper'>

# 이진 모드 open() → io.BufferedReader 반환
with open("a.jpg", "rb") as f:
    print(type(f))   # <class '_io.BufferedReader'>

# 메모리 내 텍스트 스트림 (테스트용)
buf = io.StringIO("line1\nline2\n")
for line in buf:
    print(line.strip())

# 메모리 내 이진 스트림
binbuf = io.BytesIO(b"\x89PNG\r\n")
header = binbuf.read(4)
```

`io.StringIO`와 `io.BytesIO`는 파일 없이 메모리에서 파일처럼 데이터를 처리할 때 유용하다. 단위 테스트에서 실제 파일 없이 파일 객체를 흉내 낼 때 자주 쓰인다.

---

**지난 글:** [with 문과 컨텍스트 매니저: 자원을 안전하게 관리하는 법](/posts/python-with-context/)

**다음 글:** [파일 인코딩: UTF-8부터 EUC-KR까지](/posts/python-file-encoding/)

<br>
읽어주셔서 감사합니다. 😊
