---
title: "해시와 동등성: __hash__와 __eq__의 관계"
description: "Python 해시 계약(a==b → hash(a)==hash(b))을 이해하고, __hash__/__eq__ 올바른 구현 방법, dataclass frozen 옵션, 해시 불변성 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "hash", "__eq__", "__hash__", "dict", "set", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-equality-vs-identity/)에서 `==`와 `is`의 차이를 살펴봤다. 이번에는 더 깊이 들어가 **해시(hash)**와 동등성이 어떻게 연결되는지, `dict`와 `set`이 내부적으로 어떻게 동작하는지 이해한다.

## 해시란

해시는 임의 크기의 데이터를 고정 크기 정수로 변환하는 함수다. Python에서 `hash(x)`는 `x.__hash__()`를 호출한다.

```python
hash("hello")      # 예: -4177612485710190685 (실행마다 다를 수 있음)
hash(42)           # 42
hash((1, 2, 3))    # 2528502973977326415
hash([1, 2, 3])    # TypeError: unhashable type: 'list'
```

## 해시 계약 (Hash Contract)

Python에는 반드시 지켜야 할 규칙이 있다.

> `a == b` 이면 반드시 `hash(a) == hash(b)` 여야 한다.

역은 성립하지 않는다. `hash(a) == hash(b)` 여도 `a != b`일 수 있다(해시 충돌). `dict`와 `set`은 이 계약을 전제로 동작한다.

```python
# 계약 확인
hash(1) == hash(1.0)    # True (1 == 1.0 이므로)
hash(True) == hash(1)   # True (True == 1 이므로)
```

![해시와 동등성 개요](/assets/posts/python-hash-and-equality-overview.svg)

## __eq__만 재정의하면?

Python은 `__eq__`를 재정의하면 `__hash__`를 `None`으로 설정한다. 해시 계약을 자동으로 깨지 않기 위해서다.

```python
class Bad:
    def __eq__(self, other):
        return True

hash(Bad())   # TypeError: unhashable type: 'Bad'
```

`dict` 키나 `set` 원소로 쓰려면 `__hash__`도 함께 구현해야 한다.

## 올바른 __hash__ / __eq__ 구현

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)

    def __hash__(self):
        return hash((self.x, self.y))  # __eq__에 쓰인 필드로만

p1 = Point(1, 2)
p2 = Point(1, 2)

p1 == p2          # True
{p1, p2}          # {Point(1,2)} — 집합 크기 1
d = {p1: "val"}
d[p2]             # "val" — p1 == p2 이고 hash 같으므로
```

## 해시 불변성 — 절대 지켜야 할 규칙

객체가 `dict` 키나 `set` 원소로 들어간 후 해시 값이 바뀌면 찾을 수 없다.

```python
class MutablePoint:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __hash__(self):
        return hash((self.x, self.y))

    def __eq__(self, other):
        return (self.x, self.y) == (other.x, other.y)

p = MutablePoint(1, 2)
d = {p: "ok"}

p.x = 99        # 해시값이 바뀜!
d[p]            # KeyError — 버킷이 달라져 못 찾음
```

**해시 가능 객체는 라이프사이클 동안 해시값이 불변이어야 한다.** 이 때문에 가변 객체는 기본적으로 해시 불가다.

## dataclass와 frozen

`dataclass`를 사용하면 `__hash__`를 쉽게 관리할 수 있다.

```python
from dataclasses import dataclass

# eq=True (기본): __eq__ 생성, __hash__=None
@dataclass
class Mutable:
    x: int

# frozen=True: 불변 + __hash__ 자동 생성
@dataclass(frozen=True)
class Immutable:
    x: int
    y: int

p = Immutable(1, 2)
hash(p)       # OK
p.x = 10     # FrozenInstanceError
d = {p: "key"}  # dict 키 사용 가능
```

![dataclass frozen](/assets/posts/python-hash-and-equality-dataclass.svg)

## 내장 타입 해시 가능 여부

| 타입 | 해시 가능 | 이유 |
|------|----------|------|
| `int`, `float`, `bool` | ✓ | 불변 |
| `str`, `bytes` | ✓ | 불변 |
| `tuple` | 조건부 | 원소가 모두 해시 가능하면 |
| `list`, `dict`, `set` | ✗ | 가변 |
| `frozenset` | ✓ | 불변 집합 |
| 사용자 클래스 | 기본 ✓ | id 기반 `__hash__` 상속 |

---

**지난 글:** [동등성 vs 동일성: == 와 is 의 차이](/posts/python-equality-vs-identity/)

<br>
읽어주셔서 감사합니다. 😊
