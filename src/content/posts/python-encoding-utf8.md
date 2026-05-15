---
title: "인코딩과 UTF-8: Python이 텍스트를 다루는 방식"
description: "Python의 문자열 인코딩 개념을 설명합니다. 유니코드, UTF-8, encode/decode 메서드, 파일 입출력 시 인코딩 지정, UnicodeDecodeError 해결법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "인코딩", "UTF-8", "유니코드", "UnicodeDecodeError", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-shebang-execution/)에서 셔뱅과 스크립트 실행 방법을 살펴봤다. 이번에는 Python이 텍스트를 다루는 방식의 핵심인 **문자 인코딩**을 정리한다. 한글 텍스트를 다루다 `UnicodeDecodeError`를 마주쳤다면, 이 글이 그 이유와 해결법을 설명한다.

## 왜 인코딩이 필요한가

컴퓨터는 숫자만 저장할 수 있다. "가"라는 글자를 저장하려면 이 글자를 어떤 숫자로 표현할지 **규칙(인코딩)**이 필요하다. 인코딩마다 같은 숫자가 다른 글자를 의미할 수 있기 때문에, 인코딩 정보 없이 바이트를 읽으면 엉뚱한 글자가 나타난다.

## 유니코드와 UTF-8

**유니코드(Unicode)**는 전 세계 모든 문자에 고유한 번호(코드포인트)를 부여한 **표준**이다. "가"의 코드포인트는 U+AC00, "A"는 U+0041이다.

**UTF-8**은 유니코드 코드포인트를 1~4바이트로 저장하는 **인코딩 방식**이다. ASCII 문자는 1바이트, 한글은 3바이트를 사용한다. 전 세계 웹 페이지의 98% 이상이 UTF-8을 사용한다.

| 문자 | 코드포인트 | UTF-8 바이트 | 바이트 수 |
|------|-----------|-------------|----------|
| A | U+0041 | 41 | 1 |
| é | U+00E9 | C3 A9 | 2 |
| 가 | U+AC00 | EA B0 80 | 3 |
| 😊 | U+1F60A | F0 9F 98 8A | 4 |

![문자 인코딩: 문자 → 바이트 변환](/assets/posts/python-encoding-utf8-concepts.svg)

## Python 3의 문자열

Python 3에서 `str` 타입은 **유니코드 문자열**이다. 내부적으로 코드포인트를 저장하며, 인코딩을 신경 쓰지 않아도 된다.

```python
s = "안녕, 파이썬! 😊"
print(len(s))         # 10 (문자 개수, 바이트 아님)
print(s[0])           # 안
print(ord("가"))      # 44032  (코드포인트)
print(chr(44032))     # 가
```

## encode()와 decode()

`str`을 바이트로 변환할 때는 `encode()`, 바이트를 `str`로 변환할 때는 `decode()`를 사용한다.

```python
s = "안녕"
b = s.encode("utf-8")        # str → bytes
print(b)                     # b'\xec\x95\x88\xeb\x85\x95'
print(type(b))               # <class 'bytes'>

original = b.decode("utf-8") # bytes → str
print(original)              # 안녕
```

인코딩과 디코딩에 **다른 코덱**을 사용하면 글자가 깨진다.

```python
b = "안녕".encode("utf-8")
b.decode("euc-kr")   # UnicodeDecodeError 또는 엉터리 문자
```

## 파일 입출력과 인코딩

`open()` 함수의 `encoding` 인수로 파일 인코딩을 명시한다. 생략하면 플랫폼 기본값(`locale.getpreferredencoding()`)이 사용된다. Windows의 기본값은 `cp949`, Linux/Mac은 보통 `utf-8`이다.

```python
# 쓰기: utf-8로 저장
with open("output.txt", "w", encoding="utf-8") as f:
    f.write("안녕하세요\n")

# 읽기: utf-8로 열기
with open("output.txt", "r", encoding="utf-8") as f:
    content = f.read()
    print(content)
```

**항상 `encoding="utf-8"`을 명시하는 것이 최선이다.** 플랫폼 기본값에 의존하면 Windows에서 파일을 열 때 오류가 발생한다.

## 소스 파일 인코딩

Python 3 소스 파일의 기본 인코딩은 UTF-8이다. 파일을 UTF-8로 저장하면 별도 선언 없이 한글을 쓸 수 있다.

```python
# 한글 변수명·문자열 자유롭게 사용 가능
이름 = "파이썬"
print(f"안녕, {이름}!")
```

레거시 코드에서는 파일 인코딩을 명시하는 매직 주석을 볼 수 있다.

```python
# -*- coding: utf-8 -*-
```

Python 3에서 UTF-8이 기본이므로 생략해도 된다. UTF-8이 아닌 인코딩을 사용하는 경우에만 필요하다.

## 인코딩 오류 처리

`encode()`/`decode()` 또는 `open()`에서 인코딩 불가/불일치 시 발생하는 오류를 `errors` 인수로 제어할 수 있다.

```python
s = "안녕 ABC"
# 인코딩 불가 문자 무시
print(s.encode("ascii", errors="ignore"))   # b' ABC'
# 인코딩 불가 문자를 XML 수치 참조로 대체
print(s.encode("ascii", errors="xmlcharrefreplace"))
# b'&#50504;&#45397; ABC'
```

파일 읽기에서 깨진 문자를 건너뛰려면 다음과 같이 한다.

```python
with open("broken.txt", encoding="utf-8", errors="replace") as f:
    text = f.read()   # 디코딩 불가 바이트 → U+FFFD (?)
```

![인코딩 오류 패턴과 해결](/assets/posts/python-encoding-utf8-errors.svg)

## 인코딩 확인

파일의 인코딩을 모를 때 `chardet` 라이브러리로 추측할 수 있다.

```python
import chardet

with open("unknown.txt", "rb") as f:
    raw = f.read()
    result = chardet.detect(raw)
    print(result)   # {'encoding': 'EUC-KR', 'confidence': 0.99}
```

## 정리

- Python 3 `str`은 유니코드 문자열이다
- UTF-8은 유니코드를 가변 길이 바이트로 인코딩하는 방식이다
- 파일 입출력 시 `encoding="utf-8"` 명시가 기본 습관이어야 한다
- `encode()`는 str → bytes, `decode()`는 bytes → str
- `UnicodeDecodeError`는 잘못된 인코딩으로 읽을 때 발생한다

---

**지난 글:** [셔뱅(Shebang)과 스크립트 실행 권한](/posts/python-shebang-execution/)

**다음 글:** [숫자 타입: int, float, complex](/posts/python-numbers-int-float-complex/)

<br>
읽어주셔서 감사합니다. 😊
