---
title: "파일 인코딩: UTF-8부터 EUC-KR까지"
description: "Python 파일 입출력에서 발생하는 인코딩 문제를 완전히 정리합니다. UTF-8·EUC-KR·CP949·UTF-8-SIG의 차이, UnicodeDecodeError 원인과 해결, chardet 감지, 인코딩 변환 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "인코딩", "UTF-8", "EUC-KR", "UnicodeDecodeError", "파일입출력", "chardet"]
featured: false
draft: false
---

[지난 글](/posts/python-text-vs-binary-mode/)에서 텍스트 모드와 이진 모드의 차이를 살펴봤다. 텍스트 모드에서 가장 자주 발생하는 문제가 인코딩이다. Python으로 한국어 파일을 다루다 보면 `UnicodeDecodeError`를 피할 수 없다. 이 오류의 원인을 정확히 알아야 빠르게 고칠 수 있다.

## 인코딩이란

인코딩은 문자를 바이트로 표현하는 규칙이다. '가'라는 글자를 디스크에 저장하려면 어떤 바이트로 표현할지 정해야 한다.

```python
# '가'의 인코딩별 바이트 표현
char = "가"

print(char.encode("utf-8"))   # b'\xea\xb0\x80'  — 3바이트
print(char.encode("euc-kr"))  # b'\xb0\xa1'       — 2바이트
print(char.encode("cp949"))   # b'\xb0\xa1'       — 2바이트 (EUC-KR 상위 호환)
```

같은 글자라도 인코딩에 따라 다른 바이트가 된다. 파일을 쓴 인코딩과 읽는 인코딩이 다르면 깨진다.

## Python 환경의 기본 인코딩

```python
import locale
import sys

# 파일 시스템 기본 인코딩
print(sys.getfilesystemencoding())          # utf-8 (대부분 Linux/Mac)
                                            # mbcs (Windows)

# open() 기본 인코딩
print(locale.getpreferredencoding(False))   # UTF-8 (Linux/Mac)
                                            # cp949 (한국어 Windows)

# 표준 입출력 인코딩
print(sys.stdin.encoding)                   # utf-8
print(sys.stdout.encoding)                  # utf-8
```

Windows 한국어 환경에서는 `open()`의 기본 인코딩이 `cp949`다. 이 때문에 Windows에서 `encoding` 없이 작성한 코드가 Linux/Mac에서 깨지는 경우가 많다.

## 주요 인코딩 비교

![Python 파일 인코딩 완전 정리](/assets/posts/python-file-encoding-overview.svg)

### UTF-8

현재 인터넷과 대부분 운영체제의 표준이다. 유니코드 전체를 지원하고, ASCII 문자(영문·숫자·기호)는 1바이트로 표현해 영문 전용 텍스트와 호환된다.

```python
text = "Hello 안녕 🎉"
b = text.encode("utf-8")
print(b)
# b'Hello \xec\x95\x88\xeb\x85\x95 \xf0\x9f\x8e\x89'
print(len(b))   # 19 (영문 5 + 공백 + 한글 6 + 공백 + 이모지 4)
```

### EUC-KR / CP949

한국어 전용 인코딩이다. 1970~2000년대에 만들어진 한국어 문서나 정부·공공기관 데이터는 EUC-KR이나 CP949로 인코딩된 경우가 많다. CP949는 EUC-KR의 상위 호환으로, 현대 한국어 Windows의 코드 페이지다.

```python
# CP949(EUC-KR 상위 호환) 파일 읽기
with open("legacy.txt", "r", encoding="cp949") as f:
    content = f.read()

# EUC-KR로 인코딩된 바이트 → str
b = b'\xb0\xa1\xb3\xaa\xb4\xd9'  # "가나다" in EUC-KR
print(b.decode("euc-kr"))   # → 가나다
```

### UTF-8-SIG (BOM 포함 UTF-8)

Microsoft Excel은 CSV를 저장할 때 UTF-8 파일 앞에 **BOM(Byte Order Mark)** `\xef\xbb\xbf` 3바이트를 붙인다. 일반 `utf-8`로 열면 BOM이 문자열 앞에 붙어 문제가 생긴다.

```python
# Excel에서 저장한 CSV: BOM 포함
with open("excel_export.csv", "r", encoding="utf-8") as f:
    first = f.read(3)
    print(repr(first))   # '﻿이름'  — ﻿가 BOM

# utf-8-sig: BOM 자동 제거
with open("excel_export.csv", "r", encoding="utf-8-sig") as f:
    first = f.read(3)
    print(repr(first))   # '이름'  — 깔끔
```

## UnicodeDecodeError 해결

```python
# 가장 흔한 원인: 인코딩 불일치
with open("cp949_file.txt", "r", encoding="utf-8") as f:
    f.read()
# → UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb0

# 해결 1: 올바른 인코딩 지정
with open("cp949_file.txt", "r", encoding="cp949") as f:
    content = f.read()

# 해결 2: 오류 허용 (데이터 손실 가능)
with open("unknown.txt", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()   # 깨진 바이트 → '?'

# 해결 3: 이진으로 읽고 직접 디코딩
with open("unknown.txt", "rb") as f:
    raw = f.read()

for enc in ["utf-8", "cp949", "euc-kr", "latin-1"]:
    try:
        text = raw.decode(enc)
        print(f"성공: {enc}")
        break
    except UnicodeDecodeError:
        continue
```

## chardet로 인코딩 자동 감지

```python
# pip install chardet
import chardet

def detect_encoding(path: str) -> str:
    with open(path, "rb") as f:
        raw = f.read(10_000)   # 앞 10KB 샘플
    result = chardet.detect(raw)
    enc = result["encoding"]
    confidence = result["confidence"]
    print(f"추정 인코딩: {enc} (신뢰도: {confidence:.0%})")
    return enc

enc = detect_encoding("mystery.txt")
with open("mystery.txt", "r", encoding=enc, errors="replace") as f:
    content = f.read()
```

`chardet`은 통계적 분석으로 인코딩을 추정하므로 짧은 파일은 정확도가 낮을 수 있다.

## 실전 패턴

![한국어 파일 인코딩 실전 패턴](/assets/posts/python-file-encoding-code.svg)

## 인코딩 변환 전략

```python
def safe_read(path: str) -> str:
    """여러 인코딩을 순서대로 시도해 읽기"""
    encodings = ["utf-8", "utf-8-sig", "cp949", "euc-kr", "latin-1"]
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise ValueError(f"인코딩 감지 실패: {path}")

content = safe_read("unknown_encoding.txt")
```

`latin-1`(ISO-8859-1)은 모든 바이트를 유효한 문자로 해석하므로 마지막 폴백으로 유용하다. 다만 한글이 깨진 형태로 나타난다.

## 요약

| 인코딩 | 사용 상황 |
|---|---|
| `utf-8` | 새로 작성하는 모든 파일 |
| `utf-8-sig` | Excel CSV 읽기/쓰기 |
| `cp949` | 한국어 Windows 레거시 파일 |
| `euc-kr` | 오래된 리눅스 서버 한국어 파일 |
| `latin-1` | 바이너리를 텍스트로 강제 읽기 (폴백용) |

새로 만드는 파일은 항상 `utf-8`로 작성하고, 레거시 파일은 chardet으로 감지하거나 소스를 확인해 올바른 인코딩을 지정한다.

---

**지난 글:** [텍스트 vs 이진 모드: 개행 문자와 인코딩의 차이](/posts/python-text-vs-binary-mode/)

**다음 글:** [readline vs readlines: 파일 읽기 방법 비교](/posts/python-readline-vs-readlines/)

<br>
읽어주셔서 감사합니다. 😊
