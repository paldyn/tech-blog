---
title: "비교 메서드: __lt__, __le__, __gt__, __ge__"
description: "Python 순서 비교 매직 메서드 구현, 반사 호출 원리, functools.total_ordering 활용법, sorted/min/max와의 연동을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["python", "비교 메서드", "__lt__", "total_ordering", "정렬"]
featured: false
draft: false
---

[지난 글](/posts/python-eq-hash/)에서 `__eq__`와 `__hash__`의 계약을 다루었습니다. 이번에는 순서 비교를 담당하는 네 가지 메서드 `__lt__`, `__le__`, `__gt__`, `__ge__`를 살펴봅니다. 이 메서드를 구현하면 객체를 정렬하거나 `min()`, `max()`에 직접 사용할 수 있게 됩니다.

## 비교 연산자와 메서드 매핑

`a < b`를 평가할 때 Python은 먼저 `a.__lt__(b)`를 호출합니다. `NotImplemented`를 반환하면 `b.__gt__(a)`를 시도합니다. 이것이 **반사(reflected) 호출** 메커니즘입니다.

```python
class Temperature:
    def __init__(self, celsius):
        self.c = celsius

    def __lt__(self, other):
        if not isinstance(other, Temperature):
            return NotImplemented
        return self.c < other.c

t1 = Temperature(20)
t2 = Temperature(30)
print(t1 < t2)    # True  — t1.__lt__(t2)
print(t2 > t1)    # True  — t2.__gt__(t1) 없으니 t1.__lt__(t2) 반사 호출
```

`__lt__` 하나만 구현해도 `>` 연산이 동작하는 이유가 바로 이 반사 호출 때문입니다.

![비교 메서드와 반사 호출](/assets/posts/python-comparison-methods-table.svg)

## functools.total_ordering

6개의 비교 메서드를 모두 구현하는 것은 번거롭습니다. `@total_ordering` 데코레이터를 사용하면 `__eq__`와 나머지 중 하나만 구현해도 나머지 메서드가 자동으로 생성됩니다.

```python
from functools import total_ordering

@total_ordering
class Weight:
    def __init__(self, kg):
        self.kg = kg

    def __eq__(self, other):
        if not isinstance(other, Weight):
            return NotImplemented
        return self.kg == other.kg

    def __lt__(self, other):
        if not isinstance(other, Weight):
            return NotImplemented
        return self.kg < other.kg

    # __le__, __gt__, __ge__ 자동 생성

w1 = Weight(50)
w2 = Weight(70)
print(w1 <= w2)  # True
print(w2 >= w1)  # True
```

`total_ordering`은 내부적으로 `__lt__`를 기반으로 나머지 메서드를 파생시킵니다. 성능이 중요한 코드에서는 직접 구현이 더 빠릅니다.

![Version 클래스 구현](/assets/posts/python-comparison-methods-code.svg)

## sorted, min, max와 연동

비교 메서드가 구현된 클래스는 `sorted()`, `min()`, `max()`, `heapq` 등에서 `key=` 인수 없이 직접 사용할 수 있습니다.

```python
from functools import total_ordering

@total_ordering
class Student:
    def __init__(self, name, grade):
        self.name  = name
        self.grade = grade

    def __repr__(self):
        return f"Student({self.name!r}, {self.grade})"

    def __eq__(self, other):
        if not isinstance(other, Student):
            return NotImplemented
        return self.grade == other.grade

    def __lt__(self, other):
        if not isinstance(other, Student):
            return NotImplemented
        return self.grade < other.grade

students = [Student("Alice", 85), Student("Bob", 92), Student("Carol", 78)]
print(sorted(students))    # 성적 오름차순
print(max(students))       # 최고 성적
print(min(students))       # 최저 성적
```

## 타입 간 비교

서로 다른 타입 간 비교를 지원하려면 `isinstance` 확인 범위를 넓히거나, `NotImplemented`를 반환해 Python이 역방향 비교를 시도하도록 해야 합니다.

```python
class Celsius:
    def __init__(self, c): self.c = c
    def __lt__(self, other):
        if isinstance(other, Fahrenheit):
            return self.c < (other.f - 32) * 5 / 9
        return NotImplemented

class Fahrenheit:
    def __init__(self, f): self.f = f
    def __gt__(self, other):
        if isinstance(other, Celsius):
            return self.f > other.c * 9 / 5 + 32
        return NotImplemented

print(Celsius(20) < Fahrenheit(80))   # True (80°F = 26.7°C)
```

## 주의사항

`__eq__`를 사용하지 않고 `__lt__`만 사용하는 경우 `==`는 동일성 비교를 유지합니다. 정렬에만 필요하다면 `__lt__` 하나로 충분하며 `__eq__`와 `__hash__`를 건드리지 않아도 됩니다.

`sorted(items, key=lambda x: x.value)` 형태도 자주 사용됩니다. 간단한 경우에는 `key=` 인수가 비교 메서드 구현보다 쉬울 수 있습니다.

---

**지난 글:** [__eq__와 __hash__: 동등성과 해시 계약](/posts/python-eq-hash/)

**다음 글:** [산술 연산 메서드: __add__, __mul__ 외](/posts/python-arithmetic-methods/)

<br>
읽어주셔서 감사합니다. 😊
