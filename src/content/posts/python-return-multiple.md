---
title: "여러 값 반환하기: 튜플 언패킹과 Python다운 반환"
description: "Python에서 여러 값을 반환하는 원리(튜플), 언패킹 패턴, 스타 언패킹, _ 관례, NamedTuple을 이용한 이름 있는 반환값을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "return", "튜플 언패킹", "다중 반환", "NamedTuple"]
featured: false
draft: false
---

[지난 글](/posts/python-positional-only-args/)에서 `/` 구분자로 위치 전용 인수를 선언하는 방법을 다뤘다. 이번에는 함수에서 여러 값을 반환하는 Python만의 자연스러운 방식을 살펴본다.

## 여러 값 반환 — 사실은 튜플

Python의 `return a, b`는 사실 `return (a, b)`와 동일하다. 함수는 단일 값인 **튜플**을 반환한다.

```python
def minmax(nums):
    return min(nums), max(nums)

result = minmax([3, 1, 4, 1, 5])
print(result)        # (1, 5)
print(type(result))  # <class 'tuple'>
```

## 튜플 언패킹

반환된 튜플을 여러 변수에 바로 풀어 받을 수 있다.

```python
lo, hi = minmax([3, 1, 4, 1, 5])
print(lo, hi)   # 1 5
```

반환값 개수와 변수 개수가 일치하지 않으면 `ValueError`가 발생한다.

```python
a, b, c = minmax([3, 1, 4, 1, 5])   # ValueError: too many values to unpack
```

![여러 값 반환 — 튜플 언패킹](/assets/posts/python-return-multiple-tuple.svg)

## _ 관례 — 불필요한 값 버리기

반환된 값 중 일부만 필요할 때는 `_`를 관례적으로 사용한다.

```python
_, hi = minmax([3, 1, 4, 1, 5])
print(hi)   # 5
```

`_`는 문법이 아니라 관례다. 파이썬 인터프리터는 `_` 변수를 다른 변수와 동일하게 처리한다.

## 스타 언패킹

`*`를 사용하면 나머지 요소들을 **리스트**로 수집할 수 있다.

```python
first, *rest = [1, 2, 3, 4, 5]
print(first, rest)   # 1 [2, 3, 4, 5]

*mid, last = [1, 2, 3, 4, 5]
print(mid, last)     # [1, 2, 3, 4] 5

head, *mid, tail = [1, 2, 3, 4, 5]
print(head, mid, tail)   # 1 [2, 3, 4] 5
```

![여러 값 반환 실용 패턴](/assets/posts/python-return-multiple-code.svg)

## 결과 + 상태 패턴

에러 처리에 활용할 수 있다.

```python
def safe_divide(a, b):
    if b == 0:
        return None, "division by zero"
    return a / b, None

value, error = safe_divide(10, 2)
if error:
    print(f"오류: {error}")
else:
    print(f"결과: {value}")   # 결과: 5.0
```

## NamedTuple — 이름 있는 반환값

반환값에 이름을 붙이면 코드가 더 명확해진다.

```python
from typing import NamedTuple

class MinMax(NamedTuple):
    minimum: float
    maximum: float

def minmax_named(nums):
    return MinMax(min(nums), max(nums))

result = minmax_named([3, 1, 4, 1, 5])
print(result.minimum)   # 1
print(result.maximum)   # 5

# 언패킹도 가능
lo, hi = minmax_named([3, 1, 4, 1, 5])
```

여러 값을 반환하는 함수에서 값이 3개를 초과하거나 의미가 불분명하면 `NamedTuple` 또는 `dataclass`를 고려한다.

## 정리

| 패턴 | 코드 | 용도 |
|------|------|------|
| 기본 언패킹 | `a, b = func()` | 가장 일반적 |
| 일부 무시 | `_, b = func()` | 불필요한 값 버리기 |
| 스타 언패킹 | `first, *rest = func()` | 나머지를 리스트로 |
| NamedTuple | `result.name` | 의미 있는 이름이 필요할 때 |

---

**지난 글:** [위치 전용 인수: / 슬래시로 인터페이스 강화하기](/posts/python-positional-only-args/)

**다음 글:** [람다 함수: 익명 함수의 용법과 한계](/posts/python-lambda/)

<br>
읽어주셔서 감사합니다. 😊
