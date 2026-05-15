---
title: "__repr__ vs __str__: 객체를 문자열로"
description: "Python __repr__과 __str__의 차이, 각각의 사용처, f-string 포맷 지정자, __format__ 구현법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["python", "__repr__", "__str__", "매직 메서드", "문자열 표현"]
featured: false
draft: false
---

[지난 글](/posts/python-magic-methods-overview/)에서 Python 매직 메서드의 전체 카테고리를 살펴보았습니다. 그 중 `__repr__`과 `__str__`은 가장 자주 구현하는 메서드입니다. 이 두 메서드를 혼동하거나 둘 중 하나만 구현하면 디버깅이 어려워지거나 출력이 이상해집니다.

## 기본 원칙

- `__repr__`: 개발자용. 객체를 **재현(reproduce)** 할 수 있는 문자열. REPL, 로깅, 디버깅에 사용
- `__str__`: 사용자용. **읽기 좋은** 형태의 문자열. `print()`, f-string 기본값에 사용

중요한 규칙 두 가지:

1. `__repr__`만 구현하면 `str()`도 `__repr__`을 사용한다 → **최소한 `__repr__`은 항상 구현하라**
2. `__str__`만 구현하면 `repr()`은 `object.__repr__`의 기본값(`<Money object at 0x...>`)을 사용한다

## 호출 경로

![repr() vs str() 호출 흐름](/assets/posts/python-repr-vs-str-flow.svg)

## 기본 구현

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __repr__(self):
        # eval(repr(p)) == p 가 이상적
        return f"Point({self.x!r}, {self.y!r})"

    def __str__(self):
        return f"({self.x}, {self.y})"

p = Point(3, 4)
print(repr(p))   # Point(3, 4)
print(str(p))    # (3, 4)
print(p)         # (3, 4) — print는 str() 사용

# REPL에서 식 평가
p  # Point(3, 4) 출력 — repr 사용
```

`!r` 변환 플래그는 f-string 안에서 `repr()`을 호출합니다. 문자열 속성이 있으면 따옴표가 함께 출력되어 재현 가능성이 높아집니다.

## __repr__ 재현 가능성 원칙

이상적인 `__repr__`은 `eval(repr(obj))`으로 동일한 객체를 재생성할 수 있어야 합니다.

```python
from datetime import date
d = date(2026, 5, 16)
print(repr(d))         # datetime.date(2026, 5, 16)
eval("__import__('datetime').date(2026, 5, 16)")  # date(2026, 5, 16)
```

항상 가능하지 않더라도, 적어도 타입과 핵심 상태를 보여주는 형태가 좋습니다.

```python
class Connection:
    def __init__(self, host, port):
        self.host, self.port = host, port

    def __repr__(self):
        return f"Connection(host={self.host!r}, port={self.port!r})"
```

![__repr__과 __str__ 구현 패턴](/assets/posts/python-repr-vs-str-code.svg)

## __format__: f-string 포맷 명세어 지원

`f"{obj:.2f}"` 형태로 포맷 명세어를 전달하면 `obj.__format__(".2f")`가 호출됩니다.

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def __repr__(self):
        return f"Temperature({self.celsius!r})"

    def __format__(self, spec):
        if spec == "F":
            return f"{self.celsius * 9/5 + 32:.1f}°F"
        if spec == "K":
            return f"{self.celsius + 273.15:.2f}K"
        return f"{self.celsius:.1f}°C"

t = Temperature(100)
print(f"{t}")    # 100.0°C
print(f"{t:F}")  # 212.0°F
print(f"{t:K}")  # 373.15K
```

## dataclass의 __repr__

`@dataclass`는 `__repr__`을 자동 생성합니다. 수동으로 구현할 필요가 없어 보일 때 유용합니다.

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
print(repr(p))  # Point(x=1.0, y=2.0)
```

`repr=False`를 전달하면 자동 생성을 끌 수 있습니다.

## 컨테이너 내부 객체 표현

리스트나 딕셔너리에 담긴 객체는 `__repr__`을 사용합니다.

```python
class Dog:
    def __init__(self, name):
        self.name = name
    def __repr__(self):
        return f"Dog({self.name!r})"
    def __str__(self):
        return self.name

dogs = [Dog("Rex"), Dog("Max")]
print(dogs)        # [Dog('Rex'), Dog('Max')] — __repr__ 사용
print(dogs[0])     # Rex — __str__ 사용
```

---

**지난 글:** [매직 메서드(Special Methods) 개요](/posts/python-magic-methods-overview/)

**다음 글:** [__eq__와 __hash__](/posts/python-eq-hash/)

<br>
읽어주셔서 감사합니다. 😊
