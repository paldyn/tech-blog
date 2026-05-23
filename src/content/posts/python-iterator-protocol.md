---
title: "Python 이터레이터 프로토콜: __iter__와 __next__ 완전 이해"
description: "이터러블과 이터레이터의 차이, __iter__/__next__ 메서드, for 루프 동작 원리, 사용자 정의 이터레이터 구현을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "이터레이터", "이터러블", "프로토콜", "__iter__", "__next__"]
featured: false
draft: false
---

[지난 글](/posts/python-exception-best-practices/)에서 예외 처리의 모범 사례를 살펴봤다. 이번 글부터는 Python에서 데이터를 '순서대로 꺼내는' 메커니즘인 이터레이터 프로토콜을 깊이 탐구한다. for 루프 뒤에 숨어 있는 원리를 이해하면 제너레이터, 비동기 이터레이터까지 막힘 없이 읽을 수 있다.

## 이터러블과 이터레이터의 차이

Python에서 흔히 "for 루프에 넣을 수 있는 것"을 이터러블(iterable)이라고 부른다. 리스트, 튜플, 문자열, 딕셔너리, 파일 객체 등이 모두 이터러블이다. 그런데 이터러블과 이터레이터는 다른 개념이다.

**이터러블(Iterable)**
- `__iter__()` 메서드를 구현한 객체
- `iter()` 내장 함수에 전달하면 이터레이터를 돌려준다
- 여러 번 순회할 수 있다 (리스트를 두 번 for에 넣어도 된다)

**이터레이터(Iterator)**
- `__iter__()`와 `__next__()` 두 메서드를 모두 구현한 객체
- 내부적으로 "다음에 줄 값"을 기억하는 상태를 갖는다
- `next()`를 호출하면 다음 값을 반환하고, 소진되면 `StopIteration`을 발생시킨다
- 이터레이터는 그 자체도 이터러블이다 (`__iter__()`가 `self`를 반환)

한 문장으로: **이터러블은 이터레이터를 만드는 공장, 이터레이터는 실제로 값을 꺼내는 개체**다.

![이터레이터 프로토콜 흐름](/assets/posts/python-iterator-protocol-flow.svg)

## 프로토콜의 정의

Python에서 프로토콜은 특정 메서드 집합을 구현하면 자동으로 특정 동작이 가능해지는 약속이다. 이터레이터 프로토콜은 다음 두 메서드로 구성된다.

```python
class MyIterator:
    def __iter__(self):
        # 이터레이터 자신을 반환 (이미 이터레이터이므로)
        return self

    def __next__(self):
        # 다음 값을 반환하거나, 없으면 StopIteration 발생
        ...
```

`__iter__()`가 `self`를 반환하는 이유는 이터레이터를 for 루프에 직접 넣거나 `iter()`에 전달해도 잘 동작하게 하기 위해서다. 이터러블인 리스트는 `__iter__()`가 새 이터레이터 객체를 만들어 반환하지만, 이터레이터는 자기 자신을 반환한다.

## for 루프의 내부 동작

Python의 for 루프는 다음 의사 코드와 정확히 동일하게 동작한다.

```python
# for item in iterable:
#     body

_it = iter(iterable)       # __iter__() 호출
while True:
    try:
        item = next(_it)   # __next__() 호출
    except StopIteration:
        break
    # body
```

리스트 `[1, 2, 3]`을 for 루프에 넣으면 먼저 `iter([1, 2, 3])`으로 `list_iterator` 객체가 생성되고, 그 이터레이터에서 `next()`를 반복 호출한다. 이터레이터가 소진되면 `StopIteration`이 발생하고 루프가 종료된다.

```python
nums = [10, 20, 30]
it = iter(nums)

print(next(it))  # 10
print(next(it))  # 20
print(next(it))  # 30
# print(next(it))  # StopIteration 발생
```

## 이터러블은 이터레이터가 아니다

리스트는 이터러블이지만 이터레이터가 아니다. `__next__()`가 없기 때문이다.

```python
nums = [1, 2, 3]
print(hasattr(nums, '__iter__'))    # True (이터러블)
print(hasattr(nums, '__next__'))    # False (이터레이터 아님)

it = iter(nums)
print(hasattr(it, '__iter__'))      # True
print(hasattr(it, '__next__'))      # True (이터레이터)

# 리스트는 여러 번 순회 가능
for x in nums: pass
for x in nums: pass  # OK

# 이터레이터는 소진 후 재순회 불가
for x in it: pass
for x in it: pass    # 아무것도 출력 안 됨 (이미 소진)
```

## 사용자 정의 이터레이터 구현

카운트업 이터레이터를 직접 구현하며 프로토콜을 익혀보자.

![사용자 정의 이터레이터 구현](/assets/posts/python-iterator-protocol-custom.svg)

```python
class CountUp:
    """start 이상 stop 미만 정수를 순서대로 반환하는 이터레이터"""
    def __init__(self, start: int, stop: int):
        self.current = start
        self.stop = stop

    def __iter__(self):
        return self                     # 이터레이터는 자신을 반환

    def __next__(self) -> int:
        if self.current >= self.stop:
            raise StopIteration         # 소진 신호
        val = self.current
        self.current += 1
        return val
```

```python
# for 루프로 사용
for n in CountUp(1, 5):
    print(n, end=" ")   # 1 2 3 4

# next() 직접 사용
it = CountUp(100, 103)
print(next(it))  # 100
print(next(it))  # 101
print(next(it))  # 102
```

## 이터러블과 이터레이터를 분리하는 패턴

이터레이터를 클래스로 구현할 때 이터러블과 이터레이터를 분리하면 동일 객체를 여러 번 순회할 수 있다.

```python
class NumberRange:
    """이터러블: 새 이터레이터를 생성"""
    def __init__(self, start: int, stop: int):
        self.start = start
        self.stop = stop

    def __iter__(self):
        return CountUp(self.start, self.stop)  # 매번 새 이터레이터 반환

r = NumberRange(1, 4)
print(list(r))   # [1, 2, 3]
print(list(r))   # [1, 2, 3]  -- 두 번 순회 가능
```

`CountUp` 자체는 이터레이터이므로 한 번 소진되면 재사용할 수 없다. `NumberRange`는 이터러블로서 `__iter__()`를 호출할 때마다 새 `CountUp`을 만들어 돌려준다.

## `in` 연산자와 이터레이터

`in` 연산자도 이터레이터 프로토콜을 활용한다. `__contains__()`가 없는 경우 Python은 이터레이터로 선형 검색을 수행한다.

```python
class EvenNumbers:
    def __init__(self, limit):
        self.limit = limit

    def __iter__(self):
        return (n for n in range(0, self.limit, 2))  # 제너레이터 식

evens = EvenNumbers(10)
print(4 in evens)   # True  (0,2,4에서 발견)
print(7 in evens)   # False (0,2,4,6,8 순회 후)
```

## `iter()`의 두 번째 사용법: 센티넬(sentinel)

`iter()`는 두 개의 인자를 받을 수도 있다. `iter(callable, sentinel)`은 호출 가능 객체를 반복 호출하다가 `sentinel` 값이 반환되면 순회를 멈추는 이터레이터를 만든다.

```python
import random

# random.randint가 6을 반환할 때까지 계속 호출
rolls = list(iter(lambda: random.randint(1, 6), 6))
print(rolls)  # 예: [2, 4, 1, 3]  (마지막 6은 포함 안 됨)
```

파일 읽기에도 활용한다.

```python
with open("data.txt") as f:
    for line in iter(f.readline, ""):  # 빈 문자열이 나오면(EOF) 중단
        print(line, end="")
```

## 정리

| 구분 | 필요 메서드 | 특징 |
|------|-------------|------|
| 이터러블 | `__iter__()` | 이터레이터를 생성해 반환 |
| 이터레이터 | `__iter__()` + `__next__()` | 값을 순차 반환, 소진 후 재사용 불가 |
| for 루프 | — | `iter()` + `next()` + `StopIteration` 자동 처리 |

이터레이터 프로토콜은 Python 데이터 처리의 가장 기본적인 약속이다. 다음 글에서는 `iter()`와 `next()` 내장 함수를 더 깊이 살펴본다.

---

**다음 글:** [iter()와 next() 내장 함수 심층 탐구](/posts/python-iter-next/)

<br>
읽어주셔서 감사합니다. 😊
