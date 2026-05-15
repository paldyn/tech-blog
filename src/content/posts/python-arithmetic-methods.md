---
title: "산술 연산 메서드: __add__, __mul__ 외"
description: "Python 산술 연산 매직 메서드 종류, 반사 메서드(radd/rmul), 복합 대입 메서드(iadd), sum() 지원을 위한 __radd__ 구현법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["python", "__add__", "__mul__", "산술 연산", "매직 메서드"]
featured: false
draft: false
---

[지난 글](/posts/python-comparison-methods/)에서 순서 비교 메서드를 구현하는 방법을 살펴보았습니다. 이번에는 `+`, `-`, `*`, `/` 같은 산술 연산자를 클래스에 적용하는 방법을 다룹니다. 산술 연산 메서드는 일반, 반사(reflected), 복합 대입(augmented assignment) 세 가지 버전이 있습니다.

## 기본 이진 연산 메서드

`a + b`를 평가할 때 Python은 `a.__add__(b)`를 호출합니다. 이를 일반(forward) 메서드라고 합니다.

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return Vector(self.x - other.x, self.y - other.y)

v1 = Vector(1, 2)
v2 = Vector(3, 4)
print(v1 + v2)   # Vector(4, 6)
print(v2 - v1)   # Vector(2, 2)
```

![산술 연산 메서드 전체 목록](/assets/posts/python-arithmetic-methods-table.svg)

## 반사 메서드: __radd__, __rmul__

`a + b`에서 `a.__add__(b)`가 `NotImplemented`를 반환하면 Python은 `b.__radd__(a)`를 시도합니다. 이를 통해 다른 타입과의 연산을 지원할 수 있습니다.

스칼라 곱셈(`3 * v`)을 지원하는 전형적인 예입니다.

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __mul__(self, scalar):
        if isinstance(scalar, (int, float)):
            return Vector(self.x * scalar, self.y * scalar)
        return NotImplemented

    def __rmul__(self, scalar):  # 3 * v 지원
        return self.__mul__(scalar)

v = Vector(1, 2)
print(v * 3)     # Vector(3, 6) — __mul__
print(3 * v)     # Vector(3, 6) — __rmul__
```

`int.__mul__(3, v)`는 `Vector`를 알지 못하므로 `NotImplemented`를 반환합니다. 그러면 Python이 `v.__rmul__(3)`을 호출합니다.

## sum()을 지원하는 __radd__

`sum([a, b, c])`는 내부적으로 `0 + a + b + c`로 계산됩니다. 첫 번째 연산 `0 + a`에서 `0.__add__(a)`가 `NotImplemented`를 반환하고, Python이 `a.__radd__(0)`을 호출합니다.

```python
class Money:
    def __init__(self, amount, currency="KRW"):
        self.amount   = amount
        self.currency = currency

    def __repr__(self):
        return f"Money({self.amount}, {self.currency!r})"

    def __add__(self, other):
        if not isinstance(other, Money):
            return NotImplemented
        if self.currency != other.currency:
            raise ValueError("currency mismatch")
        return Money(self.amount + other.amount, self.currency)

    def __radd__(self, other):
        if other == 0:      # sum()의 초기값 0 처리
            return self
        return self.__add__(other)

bills = [Money(100), Money(200), Money(300)]
print(sum(bills))   # Money(600, 'KRW')
```

![Money 클래스 산술 연산](/assets/posts/python-arithmetic-methods-vector.svg)

## 복합 대입 메서드: __iadd__, __imul__

`a += b`는 기본적으로 `a = a + b`와 동일하지만, `__iadd__`를 정의하면 새 객체를 만들지 않고 `a`를 in-place로 수정할 수 있습니다.

```python
class MutableVector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __repr__(self):
        return f"MutableVector({self.x}, {self.y})"

    def __iadd__(self, other):
        self.x += other.x
        self.y += other.y
        return self   # 반드시 self 반환

v = MutableVector(1, 2)
original_id = id(v)
v += MutableVector(3, 4)
print(v)            # MutableVector(4, 6)
print(id(v) == original_id)  # True — 같은 객체
```

`__iadd__`가 없으면 `a += b`는 `a = a.__add__(b)`로 처리되어 새 객체가 생성됩니다.

불변 타입에서는 `__iadd__`를 구현하지 않거나, `return self + other`처럼 새 객체를 반환합니다.

## 단항 연산자

`-obj`는 `obj.__neg__()`, `+obj`는 `obj.__pos__()`, `abs(obj)`는 `obj.__abs__()`를 호출합니다.

```python
class Temperature:
    def __init__(self, celsius):
        self.c = celsius

    def __repr__(self):
        return f"Temperature({self.c}°C)"

    def __neg__(self):
        return Temperature(-self.c)

    def __abs__(self):
        return Temperature(abs(self.c))

t = Temperature(-20)
print(-t)    # Temperature(20°C)
print(abs(t))  # Temperature(20°C)
```

## NotImplemented vs NotImplementedError

반사 메서드에서 처리할 수 없는 타입을 만나면 `return NotImplemented`(값)를 사용합니다. `raise NotImplementedError()`와 다릅니다.

- `NotImplemented`: Python에게 "다른 방법을 시도하라"고 신호를 보내는 단일 객체
- `NotImplementedError`: 추상 메서드가 구현되지 않았음을 나타내는 예외

---

**지난 글:** [비교 메서드: __lt__, __le__, __gt__, __ge__](/posts/python-comparison-methods/)

**다음 글:** [컨텍스트 매니저 프로토콜: __enter__와 __exit__](/posts/python-context-manager-protocol/)

<br>
읽어주셔서 감사합니다. 😊
