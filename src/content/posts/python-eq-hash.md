---
title: "__eq__와 __hash__: 동등성과 해시 계약"
description: "Python __eq__와 __hash__의 관계, 동등성 계약, dict 키와 set 원소로 사용하기 위한 올바른 구현 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["python", "__eq__", "__hash__", "동등성", "해시"]
featured: false
draft: false
---

[지난 글](/posts/python-repr-vs-str/)에서 `__repr__`과 `__str__`을 구현하는 법을 살펴보았습니다. 이번에는 객체의 **동등성(equality)** 을 정의하는 `__eq__`와 **해시(hash)** 를 정의하는 `__hash__`를 다룹니다. 이 두 메서드는 서로 강하게 연결된 계약을 형성합니다.

## 동일성 vs 동등성

Python에는 두 가지 비교 개념이 있습니다.

```python
a = [1, 2, 3]
b = [1, 2, 3]
c = a

print(a is c)    # True  — 동일성: 같은 객체 (identity)
print(a is b)    # False — 다른 객체
print(a == b)    # True  — 동등성: 값이 같음 (equality)
```

`is`는 메모리 주소(id)를 비교합니다. `==`는 `__eq__` 메서드를 호출합니다. 기본적으로 사용자 정의 클래스는 `__eq__`를 구현하지 않으면 `is`와 동일하게 동작합니다.

## __eq__ 구현

두 객체가 "같다"는 의미를 정의합니다.

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)

p1 = Point(1, 2)
p2 = Point(1, 2)
p3 = Point(3, 4)

print(p1 == p2)   # True
print(p1 == p3)   # False
print(p1 == "xy") # False (NotImplemented → Python이 역방향 시도 후 False)
```

`isinstance` 확인이 필요한 이유는 다른 타입과의 비교 시 `NotImplemented`를 반환해야 Python이 역방향 비교(`other.__eq__(self)`)를 시도할 수 있기 때문입니다. `False`를 바로 반환하면 이 기회를 차단합니다.

## __eq__와 __hash__ 계약

```
a == b  →  반드시  hash(a) == hash(b)
```

Python은 `__eq__`를 정의하면 자동으로 `__hash__`를 `None`으로 설정합니다. 이는 위 계약을 보장하기 위해서입니다. `__eq__`를 정의한 클래스를 dict 키나 set 원소로 쓰려면 `__hash__`도 함께 구현해야 합니다.

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)

    def __hash__(self):
        return hash((self.x, self.y))  # 동등한 객체는 같은 해시
```

`hash(tuple)`을 활용하면 쉽게 올바른 해시를 만들 수 있습니다. `__eq__`에서 비교하는 필드를 그대로 튜플로 묶어 해시하면 계약이 자동으로 성립합니다.

![__eq__와 __hash__ 계약](/assets/posts/python-eq-hash-contract.svg)

![Point 클래스 구현](/assets/posts/python-eq-hash-code.svg)

## @dataclass가 처리하는 방식

`@dataclass`는 기본적으로 `__eq__`를 생성하지만 `__hash__`는 생성하지 않습니다. `frozen=True`로 불변 dataclass를 만들면 `__hash__`도 함께 생성됩니다.

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Point:
    x: float
    y: float
    # __eq__와 __hash__ 자동 생성

p1 = Point(1.0, 2.0)
p2 = Point(1.0, 2.0)
print(p1 == p2)           # True
print({p1, p2})           # {Point(x=1.0, y=2.0)} — 중복 제거
print({p1: "origin"})     # {Point(x=1.0, y=2.0): 'origin'}
```

가변 dataclass에서 해시가 필요하면 `unsafe_hash=True`를 사용할 수 있지만, 가변 객체를 dict 키로 사용하는 것은 위험합니다.

## hash(None)과 불변성

해시 가능한 객체는 일반적으로 **불변(immutable)** 이어야 합니다. 가변 객체가 해시 가능하면 상태 변경 후 해시값이 달라져 dict에서 찾을 수 없게 됩니다.

```python
class BadPoint:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __eq__(self, other):
        return (self.x, self.y) == (other.x, other.y)

    def __hash__(self):
        return hash((self.x, self.y))

p = BadPoint(1, 2)
d = {p: "value"}
p.x = 99   # 상태 변경!
print(d[p])  # KeyError — 해시가 달라졌기 때문
```

## `__ne__` 자동 정의

Python 3에서 `__eq__`를 정의하면 `__ne__`는 자동으로 `not __eq__(...)`로 구현됩니다. 직접 정의할 필요가 없습니다.

---

**지난 글:** [__repr__ vs __str__: 객체를 문자열로](/posts/python-repr-vs-str/)

**다음 글:** [비교 메서드: __lt__, __le__, __gt__, __ge__](/posts/python-comparison-methods/)

<br>
읽어주셔서 감사합니다. 😊
