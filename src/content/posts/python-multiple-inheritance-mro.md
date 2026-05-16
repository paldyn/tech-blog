---
title: "다중 상속과 MRO: 다이아몬드 문제 해결"
description: "Python 다중 상속 문법, C3 선형화 알고리즘, MRO(Method Resolution Order), 다이아몬드 문제 해결 방식을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["python", "다중상속", "MRO", "C3", "다이아몬드 문제", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-inheritance-single/)에서 단일 상속으로 코드를 재사용하는 방법을 살펴보았습니다. Python은 한 클래스가 여러 부모를 동시에 상속하는 다중 상속도 지원합니다. 강력한 기능이지만 "다이아몬드 문제"라는 잠재적 모호성이 있고, Python은 C3 선형화 알고리즘으로 이를 해결합니다.

## 다중 상속 기본 문법

```python
class Flyable:
    def fly(self) -> str:
        return "나는 중"

class Swimmable:
    def swim(self) -> str:
        return "헤엄 중"

class Duck(Flyable, Swimmable):
    pass

d = Duck()
d.fly()   # "나는 중"
d.swim()  # "헤엄 중"
```

`Duck`은 두 부모의 메서드를 모두 물려받습니다.

## 다이아몬드 문제

```
     A
    / \
   B   C
    \ /
     D
```

`D`가 `B`와 `C`를 동시에 상속하고 둘 다 `A`를 상속하면, `D.method()`를 호출할 때 `B.method()`, `C.method()`, `A.method()` 중 어느 것을 써야 하는지 모호해집니다.

![다이아몬드 문제와 MRO](/assets/posts/python-multiple-inheritance-mro-diamond.svg)

## MRO: 메서드 검색 순서

Python은 **C3 선형화** 알고리즘으로 클래스 계층을 일렬로 정렬해 검색 순서를 결정합니다. `__mro__` 속성이나 `mro()` 메서드로 확인할 수 있습니다.

```python
class A: pass
class B(A): pass
class C(A): pass
class D(B, C): pass

print(D.__mro__)
# (<class 'D'>, <class 'B'>, <class 'C'>,
#  <class 'A'>, <class 'object'>)
```

C3 규칙:
1. 자식 클래스가 부모보다 먼저 온다
2. `class D(B, C)`에서 왼쪽(`B`)이 오른쪽(`C`)보다 먼저 온다
3. 이 두 규칙이 일관되게 유지된다 — 불일치 시 `TypeError`

## 협력적 super() 호출

`super()`는 MRO 순서에서 현재 클래스 다음 클래스로 위임합니다.

![다중 상속 MRO 코드 예제](/assets/posts/python-multiple-inheritance-mro-code.svg)

각 클래스의 `who()`가 `super().who()`를 호출하면 `D→B→C→A` 순서로 체인이 이어집니다. `A.who()`는 MRO 맨 끝에 있어 단 한 번만 호출됩니다.

## 일관되지 않은 MRO는 TypeError

```python
class X: pass
class Y(X): pass
# 아래는 불가: X가 Y보다 앞에 와야 하는데 순서가 뒤집힘
class Z(X, Y): pass  # TypeError: Cannot create a consistent MRO
```

`X`는 `Y`의 부모이므로 MRO에서 `Y` 다음에 와야 합니다. `Z(X, Y)`는 `X`를 `Y`보다 앞에 두라고 요구하므로 모순이 발생합니다.

## 실용적 활용: 믹스인 패턴

다중 상속의 가장 깔끔한 활용은 **믹스인(Mixin)** 패턴입니다. 믹스인은 단독으로 사용하지 않고 기능만 제공하는 작은 클래스입니다.

```python
class JsonMixin:
    def to_json(self) -> str:
        import json
        return json.dumps(self.__dict__)

class LogMixin:
    def log(self, msg: str) -> None:
        print(f"[{type(self).__name__}] {msg}")

class User(JsonMixin, LogMixin):
    def __init__(self, name: str) -> None:
        self.name = name

u = User("Alice")
u.to_json()       # '{"name": "Alice"}'
u.log("created")  # [User] created
```

믹스인은 상태보다 행동을 제공하고, 이름에 `Mixin`을 붙여 의도를 명확히 합니다.

## MRO 충돌 진단

복잡한 계층에서 MRO를 직접 계산하기 어려울 때는 `mro()` 메서드와 `inspect.getmro()`를 활용합니다.

```python
import inspect

for cls in inspect.getmro(D):
    print(cls.__name__)
# D, B, C, A, object
```

---

**지난 글:** [단일 상속: 코드 재사용의 기본](/posts/python-inheritance-single/)

**다음 글:** [super(): 협력적 다중 상속의 핵심](/posts/python-super/)

<br>
읽어주셔서 감사합니다. 😊
