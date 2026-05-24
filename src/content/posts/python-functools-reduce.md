---
title: "functools.reduce: 시퀀스를 단일 값으로 접기"
description: "functools.reduce의 동작 원리, 초기값 사용법, 딕셔너리 병합과 함수 합성 활용 패턴, 그리고 내장 함수와의 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "functools", "reduce", "함수형프로그래밍", "고차함수"]
featured: false
draft: false
---

[지난 글](/posts/python-pure-functions/)에서 순수 함수의 장점을 살펴봤다. 이번 글에서는 함수형 프로그래밍의 핵심 연산 중 하나인 **`reduce`**를 다룬다. `reduce`는 시퀀스의 원소들을 이진 함수로 반복 적용해 단일 값으로 "접는(fold)" 연산이다.

## reduce의 동작 원리

`reduce(f, [a, b, c, d])`는 다음 순서로 실행된다.

1. `f(a, b)` → 중간 결과 `r1`
2. `f(r1, c)` → 중간 결과 `r2`
3. `f(r2, d)` → 최종 결과

![reduce 동작 원리](/assets/posts/python-functools-reduce-flow.svg)

```python
from functools import reduce

# 덧셈으로 합계
total = reduce(lambda a, b: a + b, [1, 2, 3, 4])
print(total)   # 10

# 곱셈으로 계승(factorial)
product = reduce(lambda a, b: a * b, [1, 2, 3, 4, 5])
print(product)  # 120

# 최댓값
maximum = reduce(lambda a, b: a if a > b else b, [3, 1, 4, 1, 5, 9, 2])
print(maximum)  # 9
```

## 초기값(initializer) 매개변수

`reduce`의 세 번째 인자로 초기값을 지정할 수 있다. 초기값이 있으면 빈 시퀀스도 안전하게 처리할 수 있다.

```python
from functools import reduce

# 초기값 없이 빈 리스트 → TypeError
# reduce(lambda a, b: a + b, [])  # TypeError: reduce() of empty iterable

# 초기값 지정 → 안전
total = reduce(lambda a, b: a + b, [], 0)
print(total)   # 0

# 초기값을 활용한 딕셔너리 누적
data = [("a", 1), ("b", 2), ("c", 3)]
result = reduce(lambda acc, pair: {**acc, pair[0]: pair[1]}, data, {})
print(result)  # {"a": 1, "b": 2, "c": 3}
```

초기값은 누산기(accumulator)의 초기 상태다. 리스트를 딕셔너리로 변환하거나, 문자열로 조인하거나, 커스텀 자료구조를 빌드할 때 자주 사용된다.

## 실전 활용 패턴

![reduce 실전 패턴](/assets/posts/python-functools-reduce-usecases.svg)

**패턴 1: 딕셔너리 병합**

여러 딕셔너리를 하나로 합칠 때 유용하다. Python 3.9+ 에서는 `|` 연산자를 사용할 수 있지만, 동적인 수의 딕셔너리를 합칠 때는 `reduce`가 편하다.

```python
from functools import reduce

configs = [
    {"debug": False, "timeout": 30},
    {"host": "localhost", "port": 8080},
    {"workers": 4},
]

merged = reduce(lambda a, b: {**a, **b}, configs)
print(merged)
# {"debug": False, "timeout": 30, "host": "localhost", "port": 8080, "workers": 4}
```

**패턴 2: 함수 합성(Compose)**

여러 함수를 순서대로 적용하는 파이프라인을 만들 수 있다.

```python
from functools import reduce

def compose(*functions):
    """f, g, h → lambda x: h(g(f(x)))"""
    return reduce(lambda f, g: lambda x: g(f(x)), functions)

double = lambda x: x * 2
add_one = lambda x: x + 1
square = lambda x: x ** 2

pipeline = compose(double, add_one, square)
print(pipeline(3))   # square(add_one(double(3))) = square(7) = 49
```

**패턴 3: 중첩 구조 평탄화**

```python
from functools import reduce
import operator

nested = [[1, 2], [3, 4], [5, 6]]
flat = reduce(operator.add, nested)
print(flat)   # [1, 2, 3, 4, 5, 6]

# itertools.chain.from_iterable이 더 효율적이지만
# reduce가 의도를 더 명시적으로 표현하기도 한다
```

## reduce를 쓰지 말아야 할 때

Python에서 `reduce`는 강력하지만 항상 최선의 선택이 아니다. 내장 함수가 있다면 그것이 더 Pythonic하고 빠르다.

```python
from functools import reduce

nums = [1, 2, 3, 4, 5]

# ✗ reduce로 합계
total = reduce(lambda a, b: a + b, nums)

# ✓ 내장 sum 사용
total = sum(nums)

# ✗ reduce로 최댓값
maximum = reduce(lambda a, b: a if a > b else b, nums)

# ✓ 내장 max 사용
maximum = max(nums)

# ✗ reduce로 문자열 결합
sentence = reduce(lambda a, b: a + " " + b, ["Hello", "World"])

# ✓ str.join 사용
sentence = " ".join(["Hello", "World"])
```

`reduce`는 커스텀 누적 로직이 필요하거나, 함수 자체를 인자로 받아야 하거나, 함수 합성 파이프라인을 만들 때 진가를 발휘한다. 단순 합계/최댓값/결합에는 내장 함수를 쓰는 것이 더 읽기 쉽고 성능도 좋다.

## Python 2에서 Python 3로 이전할 때

Python 2에서는 `reduce`가 내장 함수였다. Python 3에서는 `functools` 모듈로 이동했다. Guido van Rossum은 `reduce`가 코드를 읽기 어렵게 만드는 경향이 있다는 이유로 내장에서 제거했다고 밝혔다.

```python
# Python 2: reduce(f, iterable)
# Python 3
from functools import reduce
reduce(f, iterable)
```

다음 글에서는 `reduce`와 함께 함수형 프로그래밍의 핵심 도구인 **커링(Currying)**과 **부분 적용(Partial Application)**을 살펴본다.

---

**지난 글:** [순수 함수(Pure Functions): 부작용 없는 함수 설계](/posts/python-pure-functions/)

**다음 글:** [커링과 부분 적용: functools.partial 완전 정복](/posts/python-currying-partial/)

<br>
읽어주셔서 감사합니다. 😊
