---
title: "문자열 기초: 생성, 인덱싱, 슬라이싱"
description: "Python 문자열의 기본 개념인 리터럴 생성, 인덱싱, 슬라이싱, 연산자 사용법을 설명합니다. 불변성, raw string, 접두사 문자열도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "문자열", "str", "슬라이싱", "인덱싱", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-bool-truthiness/)에서 bool 타입과 Truthiness를 살펴봤다. 이번에는 Python에서 가장 자주 다루는 타입 중 하나인 **문자열(str)**의 기초를 정리한다. 생성 방법부터 인덱싱, 슬라이싱, 연산자까지 차례대로 살펴본다.

## 문자열 생성

Python 문자열은 작은따옴표(`'`)와 큰따옴표(`"`) 어느 쪽이든 동일하게 쓸 수 있다.

```python
s1 = 'Hello'
s2 = "World"
print(s1 == s2)   # False (값이 다름)
```

문자열 안에 따옴표를 포함시킬 때는 다른 종류의 따옴표로 감싸거나 이스케이프(`\`)를 사용한다.

```python
a = "It's Python"      # 큰따옴표 안에 작은따옴표
b = 'He said "Hi"'     # 작은따옴표 안에 큰따옴표
c = 'It\'s OK'         # 이스케이프
```

### 삼중 따옴표 — 여러 줄 문자열

`"""` 또는 `'''`으로 여러 줄에 걸친 문자열을 만든다. 줄바꿈이 그대로 포함된다.

```python
text = """첫 번째 줄
두 번째 줄
세 번째 줄"""
print(text)
```

독스트링(docstring)에도 삼중 따옴표를 사용한다.

### 이스케이프 시퀀스

| 이스케이프 | 의미 |
|-----------|------|
| `\n` | 줄바꿈 |
| `\t` | 탭 |
| `\\` | 역슬래시 |
| `\'` | 작은따옴표 |
| `\"` | 큰따옴표 |
| `\r` | 캐리지 리턴 |

## 인덱싱 — 문자 하나 접근

문자열의 개별 문자에는 `[]`로 접근한다. 인덱스는 0부터 시작한다.

```python
s = "Python"
print(s[0])    # P
print(s[1])    # y
print(s[-1])   # n  (마지막 문자)
print(s[-2])   # o  (뒤에서 두 번째)
```

음수 인덱스는 뒤에서부터 센다. `s[-1]`은 `s[len(s)-1]`과 같다.

범위를 벗어나면 `IndexError`가 발생한다.

```python
s[10]   # IndexError: string index out of range
```

![문자열 생성과 인덱싱](/assets/posts/python-string-essentials-basics.svg)

## 슬라이싱 — 부분 문자열

슬라이싱은 `s[start:stop:step]` 형식으로 부분 문자열을 추출한다. `stop`은 포함하지 않는다.

```python
s = "Python"
s[0:3]    # 'Pyt'  — 인덱스 0, 1, 2
s[1:4]    # 'yth'
s[:3]     # 'Pyt'  — start 생략 → 0
s[3:]     # 'hon'  — stop 생략 → 끝
s[:]      # 'Python' — 전체 복사
s[::-1]   # 'nohtyP' — 뒤집기
s[::2]    # 'Pto'  — 2칸씩
```

슬라이싱은 범위를 벗어나도 오류가 나지 않는다.

```python
s[0:100]  # 'Python' — 범위 초과 시 가능한 범위까지
```

## 문자열 불변성

Python 문자열은 **불변(immutable)**이다. 한 번 생성된 문자열은 수정할 수 없다.

```python
s = "hello"
s[0] = "H"   # TypeError: 'str' object does not support item assignment
```

수정하려면 새 문자열을 만들어야 한다.

```python
s = "H" + s[1:]   # "Hello" — 새 문자열
```

## 문자열 연산자

```python
# 이어붙이기
"Hello" + " " + "World"   # 'Hello World'

# 반복
"ha" * 3                  # 'hahaha'
"-" * 40                  # 구분선

# 멤버십 검사
"Py" in "Python"           # True
"py" in "Python"           # False (대소문자 구분)
"java" not in "Python"     # True
```

**주의**: 문자열과 숫자는 `+`로 이어붙일 수 없다.

```python
"나이: " + 25        # TypeError
"나이: " + str(25)   # "나이: 25"  — 명시적 변환 필요
```

## 접두사 문자열

접두사를 붙여 특별한 문자열을 만들 수 있다.

```python
# r"" — raw string: 이스케이프 처리하지 않음
path = r"C:\Users\name\Documents"
# 정규표현식 패턴에 특히 유용
import re
pattern = re.compile(r"\d+\.\d+")

# b"" — bytes 리터럴
data = b"Hello"
print(type(data))   # <class 'bytes'>

# f"" — f-string: 다음 글에서 상세히
name = "파이썬"
print(f"안녕, {name}!")
```

![문자열 연산과 유용한 패턴](/assets/posts/python-string-essentials-operations.svg)

## 유용한 내장 함수와 연산

```python
s = "  Hello, Python!  "

len(s)          # 18 (공백 포함)
s.strip()       # "Hello, Python!"   — 양쪽 공백 제거
s.lower()       # "  hello, python!  "
s.upper()       # "  HELLO, PYTHON!  "
s.count("l")    # 2
s.find("Py")    # 8  (인덱스 반환, 없으면 -1)
```

문자열 메서드는 모두 **새 문자열을 반환**하며 원본을 수정하지 않는다. 다음 글에서 문자열 메서드를 더 자세히 다룬다.

## 반복문과 함께

문자열은 이터러블이므로 `for` 루프로 문자 하나씩 순회할 수 있다.

```python
for ch in "Hello":
    print(ch, end=" ")
# H e l l o
```

---

**지난 글:** [bool과 Truthiness: 참과 거짓을 판별하는 방법](/posts/python-bool-truthiness/)

**다음 글:** [f-string: 파이썬 문자열 포매팅의 정석](/posts/python-fstring/)

<br>
읽어주셔서 감사합니다. 😊
