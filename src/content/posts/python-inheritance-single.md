---
title: "단일 상속: 코드 재사용의 기본"
description: "Python 단일 상속 문법, 메서드 오버라이드와 super() 기초, isinstance·issubclass 활용법, 상속 설계 지침을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["python", "상속", "inheritance", "override", "super", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-classmethod-staticmethod/)에서 클래스 메서드와 정적 메서드를 살펴보았습니다. 이번에는 객체지향 프로그래밍의 핵심 메커니즘인 상속을 다룹니다. 상속을 쓰면 기존 클래스의 속성과 메서드를 재사용하면서 자식 클래스에서 행동을 특화할 수 있습니다.

## 상속 기본 문법

클래스 이름 뒤 괄호에 부모 클래스를 지정합니다.

```python
class Animal:
    def __init__(self, name: str) -> None:
        self.name = name

    def speak(self) -> str:
        return "..."

class Dog(Animal):
    def speak(self) -> str:
        return "Woof!"
```

`Dog`은 `Animal`을 상속하므로 `name` 속성과 `Animal`의 모든 메서드를 자동으로 가집니다. `speak`는 오버라이드해서 다른 동작을 구현했습니다.

## 상속 계층 구조

부모·자식 관계와 메서드 오버라이드·추가의 관계를 시각화하면 다음과 같습니다.

![단일 상속 계층 구조](/assets/posts/python-inheritance-single-diagram.svg)

## 메서드 오버라이드와 super()

자식 클래스에서 같은 이름의 메서드를 정의하면 부모 구현을 가립니다.

```python
class Cat(Animal):
    def speak(self) -> str:
        parent_sound = super().speak()  # "..."
        return f"Meow (parent said: {parent_sound})"
```

`super()`는 현재 클래스의 부모 클래스를 가리키는 프록시를 반환합니다. `__init__`을 확장할 때 반드시 사용합니다.

![메서드 오버라이드 예제](/assets/posts/python-inheritance-single-code.svg)

## 부모 __init__ 호출

자식 클래스에서 `__init__`을 정의하면 **부모 `__init__`이 자동으로 호출되지 않습니다**. `super().__init__()`을 명시적으로 불러야 합니다.

```python
class Vehicle:
    def __init__(self, make: str, speed: int) -> None:
        self.make = make
        self.speed = speed

class ElectricCar(Vehicle):
    def __init__(self, make: str, speed: int, range_km: int) -> None:
        super().__init__(make, speed)   # 부모 초기화
        self.range_km = range_km
```

## isinstance와 issubclass

상속 관계를 런타임에 확인하는 두 내장 함수입니다.

```python
d = Dog("Rex")
isinstance(d, Dog)     # True  — d는 Dog 인스턴스
isinstance(d, Animal)  # True  — Dog은 Animal을 상속
isinstance(d, Cat)     # False

issubclass(Dog, Animal) # True
issubclass(Animal, Dog) # False
```

`isinstance`는 타입 체크에, `issubclass`는 클래스 관계 확인에 쓰입니다. 하지만 Python에서는 타입보다 동작에 의존하는 덕 타이핑을 선호하므로 꼭 필요한 경우에만 사용합니다.

## 상속 vs 합성

상속은 강력하지만 남용하면 부모·자식 결합이 강해져 코드가 경직됩니다. 다음 기준으로 선택합니다.

- **상속 (is-a 관계)**: `Dog`는 `Animal`이다 → `Dog(Animal)` 적합
- **합성 (has-a 관계)**: `Car`는 `Engine`을 가진다 → `self.engine = Engine()` 적합

```python
# 합성 예
class Engine:
    def start(self) -> None: ...

class Car:
    def __init__(self) -> None:
        self.engine = Engine()   # 상속이 아니라 포함
```

## object가 기본 부모

Python 3에서 모든 클래스는 명시하지 않아도 `object`를 암묵적으로 상속합니다.

```python
class Empty: pass

issubclass(Empty, object)  # True
Empty.__mro__               # (<class 'Empty'>, <class 'object'>)
```

`object`로부터 `__repr__`, `__eq__`, `__hash__` 등 기본 메서드를 물려받습니다.

---

**지난 글:** [@classmethod와 @staticmethod: 세 가지 메서드 종류](/posts/python-classmethod-staticmethod/)

**다음 글:** [다중 상속과 MRO: 다이아몬드 문제 해결](/posts/python-multiple-inheritance-mro/)

<br>
읽어주셔서 감사합니다. 😊
