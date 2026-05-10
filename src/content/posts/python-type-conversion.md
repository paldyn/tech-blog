---
title: "타입 변환: int, str, float, list 상호 변환"
description: "Python의 명시적 타입 변환(int, float, str, list, set, dict, bool)과 암묵적 변환을 이해하고, ValueError/TypeError를 안전하게 처리하는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "타입변환", "int", "str", "float", "list", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-set-frozenset/)에서 집합 자료구조를 살펴봤다. 이번에는 Python의 **타입 변환(type conversion)**을 체계적으로 정리한다. Python은 동적 타입 언어이지만 암묵적 변환은 거의 허용하지 않는다. 대부분 명시적으로 변환 함수를 호출해야 한다.

## 숫자 타입 변환

```python
# str → int
int("42")          # 42
int("0b1010", 2)   # 10 (2진수)
int("0o17", 8)     # 15 (8진수)
int("0xff", 16)    # 255 (16진수)
int("ff", 16)      # 255

# float → int (소수점 아래 버림, 반올림 아님)
int(3.9)           # 3
int(-3.9)          # -3

# int → float
float(42)          # 42.0
float("3.14")      # 3.14
float("inf")       # inf
float("nan")       # nan

# str ↔ int
str(42)            # "42"
str(3.14)          # "3.14"
str(True)          # "True"
```

![타입 변환 개요](/assets/posts/python-type-conversion-overview.svg)

## bool 변환

```python
bool(0)        # False
bool(1)        # True
bool(-1)       # True (0 이외 정수는 모두 True)
bool("")       # False
bool("hello")  # True
bool([])       # False
bool([0])      # True (원소가 있으면 True)
bool(None)     # False
```

`bool(x)`는 `x.__bool__()` 또는 `x.__len__()`을 호출한다.

## 컨테이너 타입 변환

```python
# str → list (문자 단위 분리)
list("abc")          # ['a', 'b', 'c']

# 이터러블 → list/tuple/set
list(range(5))       # [0, 1, 2, 3, 4]
tuple({1, 2, 3})     # (1, 2, 3) — 순서 비보장
set([1, 2, 2, 3])   # {1, 2, 3}

# (key, value) 쌍 → dict
dict([("a", 1), ("b", 2)])  # {"a": 1, "b": 2}
dict(zip("abc", [1, 2, 3])) # {"a": 1, "b": 2, "c": 3}

# list → str (join으로)
"".join(["a", "b", "c"])    # "abc"
", ".join(["x", "y"])       # "x, y"
```

## 암묵적 변환

Python은 대부분 암묵적 변환을 하지 않는다.

```python
"age: " + 30       # TypeError! str + int 불가
"age: " + str(30)  # "age: 30" — 명시적 변환 필요

# 예외: bool은 int의 서브클래스
True + 1     # 2 (True=1)
False + 5    # 5 (False=0)
```

## 변환 오류와 안전한 처리

```python
int("3.14")    # ValueError: invalid literal for int()
int("hello")   # ValueError
int([1, 2])    # TypeError

# 안전한 패턴
def safe_int(s, default=None):
    try:
        return int(s)
    except (ValueError, TypeError):
        return default

safe_int("42")       # 42
safe_int("3.14")     # None
safe_int("hi", 0)    # 0
```

![변환 오류 처리](/assets/posts/python-type-conversion-errors.svg)

## 진수 변환

```python
# 정수 → 진수 문자열
bin(10)    # '0b1010'
oct(255)   # '0o377'
hex(255)   # '0xff'

# 0b/0o/0x 접두사 없애기
format(255, 'b')   # '11111111'
format(255, 'x')   # 'ff'
format(255, 'X')   # 'FF'
f"{255:08b}"       # '11111111' (8자리 0 패딩)
```

## chr, ord — 문자 ↔ 코드포인트

```python
ord('A')       # 65
ord('가')      # 44032
chr(65)        # 'A'
chr(44032)     # '가'
```

---

**지난 글:** [집합과 frozenset: 중복 없는 컬렉션](/posts/python-set-frozenset/)

**다음 글:** [참·거짓값(Truthy/Falsy): Python 조건식 완전 이해](/posts/python-truthy-falsy/)

<br>
읽어주셔서 감사합니다. 😊
