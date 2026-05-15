---
title: "매직 메서드(Special Methods) 개요"
description: "Python의 __dunder__ 매직 메서드 전체 카테고리, 연산자 오버로딩 원리, Vec2 예제로 보는 산술·비교·표현 메서드 구현 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["python", "매직 메서드", "dunder", "연산자 오버로딩", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-init-vs-new/)에서 `__new__`와 `__init__`이 객체 생성의 두 단계를 담당한다는 것을 보았습니다. 이처럼 이름 앞뒤로 밑줄 두 개(`__`)가 붙은 메서드를 **매직 메서드(magic method)** 또는 **특수 메서드(special method)**, **던더 메서드(dunder method)**라고 부릅니다. Python이 특정 연산을 수행할 때 자동으로 호출하는 메서드들입니다.

## 매직 메서드란

`a + b`를 평가할 때 Python은 내부적으로 `a.__add__(b)`를 호출합니다. `len(obj)`는 `obj.__len__()`을 호출합니다. 이처럼 연산자, 내장 함수, 문장이 클래스의 특정 메서드와 연결됩니다. 이 메서드를 정의하면 사용자 정의 클래스가 내장 타입처럼 동작합니다.

```python
class MyList:
    def __init__(self, data):
        self.data = data

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        return self.data[idx]

ml = MyList([10, 20, 30])
print(len(ml))   # 3
print(ml[1])     # 20
for x in ml:     # __iter__ 없어도 __getitem__으로 순회 가능
    print(x)
```

## 카테고리 개요

![매직 메서드 카테고리](/assets/posts/python-magic-methods-overview-table.svg)

## 표현 메서드: __repr__과 __str__

`__repr__`은 개발자용 문자열, `__str__`은 사용자용 문자열을 정의합니다. `__str__`이 없으면 `str()`도 `__repr__`을 사용합니다.

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __repr__(self):
        return f"Point({self.x!r}, {self.y!r})"

    def __str__(self):
        return f"({self.x}, {self.y})"

p = Point(1, 2)
print(repr(p))  # Point(1, 2)
print(str(p))   # (1, 2)
print(p)        # (1, 2) — print는 str() 사용
```

## __call__: 호출 가능 객체

`__call__`을 정의하면 인스턴스를 함수처럼 호출할 수 있습니다.

```python
class Multiplier:
    def __init__(self, factor):
        self.factor = factor

    def __call__(self, x):
        return x * self.factor

double = Multiplier(2)
print(double(5))    # 10
print(double(10))   # 20
print(callable(double))  # True
```

이 패턴은 상태를 가진 함수가 필요할 때 클로저의 대안으로 활용됩니다.

## __bool__: 불리언 변환

`if obj:` 평가 시 Python은 `obj.__bool__()`을 호출합니다. 없으면 `__len__()`이 0인지 확인합니다. 둘 다 없으면 항상 `True`입니다.

```python
class Account:
    def __init__(self, balance):
        self.balance = balance

    def __bool__(self):
        return self.balance > 0

acc = Account(100)
if acc:
    print("잔고 있음")   # 출력됨

empty = Account(0)
if not empty:
    print("잔고 없음")   # 출력됨
```

## Vec2 예제: 여러 매직 메서드 함께

![Vec2 클래스로 보는 매직 메서드](/assets/posts/python-magic-methods-overview-example.svg)

## 반사 메서드 (reflected methods)

`a + b`에서 `a.__add__(b)`가 `NotImplemented`를 반환하면, Python은 `b.__radd__(a)`를 시도합니다. 서로 다른 타입 간 연산을 지원할 때 유용합니다.

```python
class Vec2:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __mul__(self, scalar):
        if isinstance(scalar, (int, float)):
            return Vec2(self.x * scalar, self.y * scalar)
        return NotImplemented

    def __rmul__(self, scalar):   # 2 * v 지원
        return self.__mul__(scalar)

v = Vec2(1, 2)
print(v * 3)    # Vec2(3, 6) — __mul__
print(2 * v)    # Vec2(2, 4) — __rmul__
```

## 주의사항

매직 메서드는 직접 호출하지 않고 연산자나 내장 함수를 통해 사용하는 것이 원칙입니다. `a.__add__(b)` 대신 `a + b`를 씁니다. 매직 메서드 이름을 임의로 만들어서는 안 됩니다(`__mymethod__`처럼 쓰지 말 것). Python이 이미 정의하지 않은 던더 이름은 미래에 언어가 예약할 수 있습니다.

---

**지난 글:** [__init__ vs __new__: 객체 생성의 두 단계](/posts/python-init-vs-new/)

**다음 글:** [__repr__ vs __str__](/posts/python-repr-vs-str/)

<br>
읽어주셔서 감사합니다. 😊
