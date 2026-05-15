---
title: "숫자 타입: int, float, complex"
description: "Python의 세 가지 숫자 타입인 int, float, complex를 설명합니다. 산술 연산자, 부동소수점 정밀도 문제, Decimal 모듈, 진수 리터럴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "int", "float", "complex", "숫자타입", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-encoding-utf8/)에서 인코딩과 UTF-8을 살펴봤다. 이번에는 Python의 세 가지 숫자 타입 **int, float, complex**와 산술 연산자를 정리한다.

## int — 정수

Python의 `int`는 다른 언어와 달리 **크기에 제한이 없다**. 메모리가 허용하는 한 어떤 크기의 정수도 표현한다.

```python
a = 42
b = -100
big = 10 ** 100     # 구골(Googol) — 아무 문제 없음
print(type(a))      # <class 'int'>
```

### 진수 리터럴

```python
binary  = 0b1010    # 2진수 → 10
octal   = 0o77      # 8진수 → 63
hexadec = 0xFF      # 16진수 → 255
```

가독성을 위해 밑줄로 숫자를 그룹화할 수 있다.

```python
million = 1_000_000
pi_approx = 3_141_592
```

## float — 부동소수점

`float`는 **IEEE 754 배정밀도(64비트)** 형식으로 실수를 표현한다.

```python
pi  = 3.14159
sci = 1.5e10      # 1.5 × 10^10
neg = -2.7e-3     # -0.0027
inf = float('inf')
nan = float('nan')
```

### 부동소수점 정밀도 함정

`float`는 근삿값이다. 10진 소수를 2진수로 정확히 표현할 수 없는 경우 오차가 생긴다.

```python
0.1 + 0.2          # 0.30000000000000004
0.1 + 0.2 == 0.3   # False ← 위험!
```

float 두 값을 비교할 때는 `math.isclose()`를 사용한다.

```python
import math
math.isclose(0.1 + 0.2, 0.3)   # True
```

금융 계산처럼 정확한 십진수 연산이 필요하면 `decimal.Decimal`을 사용한다.

```python
from decimal import Decimal

a = Decimal("0.1")
b = Decimal("0.2")
print(a + b)           # 0.3 (정확)
print(a + b == Decimal("0.3"))  # True
```

## complex — 복소수

실수부와 허수부로 구성된 복소수 타입이다. 허수부는 `j`로 표기한다.

```python
z = 3 + 4j
print(z.real)         # 3.0
print(z.imag)         # 4.0
print(abs(z))         # 5.0  (√(3² + 4²))
print(z.conjugate())  # (3-4j)
```

`cmath` 모듈은 복소수를 위한 수학 함수를 제공한다.

```python
import cmath
print(cmath.sqrt(-1))   # 1j
print(cmath.phase(1+1j))  # 0.785... (위상각)
```

![Python 숫자 타입 3종](/assets/posts/python-numbers-int-float-complex-types.svg)

## 산술 연산자

| 연산자 | 의미 | 예시 | 결과 |
|--------|------|------|------|
| `+` | 덧셈 | `3 + 2` | `5` |
| `-` | 뺄셈 | `3 - 2` | `1` |
| `*` | 곱셈 | `3 * 2` | `6` |
| `/` | 나눗셈 (항상 float) | `7 / 2` | `3.5` |
| `//` | 정수 나눗셈 (버림) | `7 // 2` | `3` |
| `%` | 나머지 | `7 % 2` | `1` |
| `**` | 거듭제곱 | `2 ** 10` | `1024` |

`/`는 항상 `float`를 반환한다. 정수 몫이 필요하면 `//`를 사용한다.

```python
print(7 / 2)         # 3.5 (float)
print(7 // 2)        # 3   (int)
print(-7 // 2)       # -4  (음수는 더 작은 쪽으로 버림)
print(divmod(7, 2))  # (3, 1) — 몫과 나머지 동시
```

## 타입 변환

Python은 int와 float 사이에서 자동으로 타입을 올림 변환한다.

```python
result = 1 + 1.0     # int + float → float (2.0)
print(type(result))  # <class 'float'>
```

명시적 변환 함수를 사용하면 된다.

```python
int(3.9)         # 3    (버림, 반올림 아님)
int(-3.9)        # -3   (0을 향해 버림)
round(3.5)       # 4    (은행가 반올림, Python 3)
round(2.5)       # 2    (짝수 방향)
float("3.14")    # 3.14
int("FF", 16)    # 255  (16진수 문자열 → int)
```

### 내장 수학 함수

```python
abs(-5)          # 5
pow(2, 10)       # 1024
max(1, 2, 3)     # 3
min(1, 2, 3)     # 1
sum([1, 2, 3])   # 6
```

![부동소수점 정밀도와 Decimal](/assets/posts/python-numbers-int-float-complex-decimal.svg)

## 비트 연산 (int만 해당)

```python
5 & 3     # 1  (AND)
5 | 3     # 7  (OR)
5 ^ 3     # 6  (XOR)
~5        # -6 (NOT)
5 << 1    # 10 (좌 시프트)
5 >> 1    # 2  (우 시프트)
```

## 정리

| 타입 | 특징 | 언제 쓰나 |
|------|------|-----------|
| `int` | 무제한 정수 | 개수, 인덱스, 정수 계산 |
| `float` | 64비트 실수 | 과학 계산, 속도 우선 |
| `complex` | 복소수 | 신호 처리, 수학 |
| `Decimal` | 정밀 십진수 | 금융, 회계 |

`/`는 항상 float, `//`는 정수 나눗셈, `float` 비교는 `math.isclose()` — 이 세 가지만 기억해도 숫자 타입의 핵심을 파악한 것이다.

---

**지난 글:** [인코딩과 UTF-8: Python이 텍스트를 다루는 방식](/posts/python-encoding-utf8/)

**다음 글:** [bool과 Truthiness: 참과 거짓을 판별하는 방법](/posts/python-bool-truthiness/)

<br>
읽어주셔서 감사합니다. 😊
