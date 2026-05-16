---
title: "__slots__: 메모리 효율적인 클래스"
description: "Python __slots__ 선언 방법, __dict__ 대비 메모리 절감 원리, 속성 접근 성능 향상, 상속 시 주의사항, @dataclass(slots=True)를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["python", "__slots__", "메모리", "성능최적화", "dataclass", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-frozen-dataclass/)에서 불변 데이터 클래스를 구성하는 방법을 살펴보았습니다. 이번에는 메모리와 접근 성능을 동시에 개선하는 `__slots__`를 다룹니다. 수백만 개의 인스턴스를 생성하는 경우 `__slots__`로 메모리를 50~80%까지 줄일 수 있습니다.

## 기본 동작 원리

일반 Python 클래스의 인스턴스는 `__dict__`라는 딕셔너리를 가지며, 모든 인스턴스 속성이 이 딕셔너리에 저장됩니다. `__slots__`를 선언하면 `__dict__` 대신 고정 크기 배열에 직접 저장됩니다.

```python
class Regular:
    def __init__(self, x, y):
        self.x, self.y = x, y

class Slotted:
    __slots__ = ('x', 'y')
    def __init__(self, x, y):
        self.x, self.y = x, y

r = Regular(1, 2)
s = Slotted(1, 2)

hasattr(r, '__dict__')  # True
hasattr(s, '__dict__')  # False
```

## 메모리 구조 비교

![__slots__ 메모리 구조 비교](/assets/posts/python-slots-memory.svg)

## 코드 예제

![__slots__ 코드 예제](/assets/posts/python-slots-code.svg)

## 메모리 절감 측정

```python
import sys

class Regular:
    def __init__(self, x, y):
        self.x, self.y = x, y

class Slotted:
    __slots__ = ('x', 'y')
    def __init__(self, x, y):
        self.x, self.y = x, y

r = Regular(1, 2)
s = Slotted(1, 2)

print(sys.getsizeof(r))   # 48 (객체만, __dict__ 별도)
print(sys.getsizeof(s))   # 56 (모두 포함)
# 실제 메모리: r.__dict__ 포함 시 훨씬 큼
```

실제 절감 효과는 백만 인스턴스 기준으로 수십 MB에서 수백 MB 차이가 납니다.

## 동적 속성 제한

`__slots__`에 없는 속성을 할당하면 `AttributeError`가 발생합니다.

```python
s = Slotted(1, 2)
s.z = 3  # AttributeError: 'Slotted' object has no attribute 'z'
```

이 제한이 의도치 않은 오타로 인한 버그도 방지합니다. 동적으로 속성을 추가할 필요가 있다면 `'__dict__'`를 `__slots__`에 포함합니다.

```python
class Flexible:
    __slots__ = ('x', 'y', '__dict__')
```

## 상속과 __slots__

자식 클래스에서 `__slots__`를 선언하지 않으면 자동으로 `__dict__`가 생깁니다.

```python
class Parent:
    __slots__ = ('x',)

class Child(Parent):  # __slots__ 없음
    pass              # __dict__ 자동 생성

c = Child()
c.z = 99  # 가능 — 메모리 절감 효과 없어짐
```

전체 계층에서 `__slots__`를 유지하려면 자식 클래스에도 선언해야 합니다. 자식 클래스에는 부모에 없는 추가 슬롯만 선언합니다.

```python
class Parent:
    __slots__ = ('x',)

class Child(Parent):
    __slots__ = ('z',)  # y는 부모에서 상속
```

## @dataclass(slots=True) — Python 3.10+

Python 3.10부터 `@dataclass(slots=True)`로 자동으로 `__slots__`를 생성할 수 있습니다.

```python
from dataclasses import dataclass

@dataclass(slots=True)
class Point:
    x: float
    y: float
    z: float = 0.0

p = Point(1.0, 2.0)
hasattr(p, '__dict__')  # False
```

타입 힌트로 선언된 필드를 자동으로 `__slots__`에 포함합니다. `frozen=True`와 함께 쓰면 불변 + 메모리 효율을 동시에 달성합니다.

## 언제 __slots__를 쓸까

- 같은 클래스의 인스턴스를 **수천~수백만 개** 생성하는 경우
- 메모리가 제한된 환경 (임베디드, 대용량 데이터 처리)
- 동적 속성 추가를 막아 코드 실수를 방지하고 싶은 경우

단순 스크립트나 인스턴스 수가 적은 경우에는 일반 클래스가 더 유연합니다.

---

**지난 글:** [frozen dataclass: 불변 데이터 클래스](/posts/python-frozen-dataclass/)

**다음 글:** [모듈 검색 경로: sys.path와 import 동작](/posts/python-module-search-path/)

<br>
읽어주셔서 감사합니다. 😊
