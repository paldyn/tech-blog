---
title: "클래스 기초: 사용자 정의 타입 만들기"
description: "Python class 키워드로 사용자 정의 타입을 만드는 방법, 클래스 속성과 인스턴스 속성, 메서드 정의, 객체 생성 흐름을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["python", "class", "OOP", "객체지향", "인스턴스"]
featured: false
draft: false
---

[지난 글](/posts/python-array-module/)에서 `array` 모듈로 타입 고정 배열을 다루었습니다. 이번 글부터는 Python의 핵심 기능 중 하나인 **객체 지향 프로그래밍**을 다룹니다. 클래스(class)는 데이터와 동작을 하나로 묶는 설계도이며, Python의 모든 것이 객체라는 사실을 이해하는 출발점입니다.

## 클래스란 무엇인가

클래스는 새로운 타입을 만드는 방법입니다. `int`, `str`, `list`처럼 Python이 제공하는 내장 타입도 클래스로 만들어져 있습니다. `class` 키워드를 이용하면 직접 타입을 정의할 수 있습니다.

```python
class Dog:
    pass  # 비어 있는 클래스도 유효한 타입
```

`Dog()`를 호출하면 이 클래스의 인스턴스(instance)가 생성됩니다. 인스턴스는 클래스라는 설계도로 찍어낸 실제 객체입니다.

```python
d1 = Dog()
d2 = Dog()
print(type(d1))       # <class '__main__.Dog'>
print(d1 is d2)       # False — 서로 다른 객체
```

## __init__: 초기화 메서드

클래스에 데이터를 부여하려면 `__init__` 메서드를 정의합니다. 인스턴스가 생성될 때 파이썬이 자동으로 호출합니다.

```python
class Dog:
    def __init__(self, name: str, age: int):
        self.name = name   # 인스턴스 속성
        self.age  = age

rex = Dog("Rex", 3)
print(rex.name)   # Rex
print(rex.age)    # 3
```

`self`는 현재 인스턴스를 가리키는 매개변수입니다. `self.name = name`은 인스턴스 딕셔너리(`__dict__`)에 `name` 키를 추가합니다.

```python
print(rex.__dict__)  # {'name': 'Rex', 'age': 3}
```

## 클래스 속성 vs 인스턴스 속성

클래스 본문에 직접 할당한 변수는 **클래스 속성**으로 모든 인스턴스가 공유합니다. `__init__`에서 `self.`로 할당한 변수는 **인스턴스 속성**으로 객체마다 독립적입니다.

```python
class Dog:
    species = "Canis lupus"  # 클래스 속성

    def __init__(self, name):
        self.name = name     # 인스턴스 속성

d = Dog("Rex")
print(d.species)        # Canis lupus  (클래스 속성 참조)
print(Dog.species)      # Canis lupus  (클래스에서도 접근 가능)
Dog.species = "Canis"   # 클래스 단위로 변경 → 모든 인스턴스에 반영
```

인스턴스에서 클래스 속성과 같은 이름에 값을 할당하면, 인스턴스 딕셔너리에 새 항목이 생겨 클래스 속성을 가립니다. 클래스 속성 자체는 바뀌지 않습니다.

## 메서드 정의

클래스 안에 정의한 함수를 메서드라고 합니다. 첫 번째 매개변수는 관례적으로 `self`이며, 호출 시 파이썬이 자동으로 인스턴스를 전달합니다.

```python
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age  = age

    def bark(self):
        return f"{self.name} says Woof!"

    def is_adult(self):
        return self.age >= 2

rex = Dog("Rex", 3)
print(rex.bark())      # Rex says Woof!
print(rex.is_adult())  # True
```

`rex.bark()`는 파이썬 내부에서 `Dog.bark(rex)`와 동일합니다. 인스턴스가 첫 번째 인수로 자동 전달되는 것입니다.

![Python 클래스 구조](/assets/posts/python-class-basics-structure.svg)

## 객체 생성 내부 흐름

`Dog("Rex", 3)`을 호출하면 다음 순서로 동작합니다.

1. `Dog.__new__(Dog)` — 새 인스턴스 메모리 할당
2. `Dog.__init__(instance, "Rex", 3)` — 초기화
3. 완성된 인스턴스 반환

대부분의 경우 `__new__`는 직접 다루지 않고 `__init__`만 오버라이드합니다. `__new__`는 싱글턴 패턴이나 불변 타입 서브클래스 같은 특수 상황에서 사용합니다.

## 클래스 정의 시 주의사항

클래스 이름은 **PascalCase**(UpperCamelCase)가 관례입니다 (`MyClass`, `HttpClient`). 소문자로 쓰면 동작은 하지만 코드 가독성이 떨어집니다.

`pass`를 넣어 빈 클래스를 만들 수 있지만, 실용적인 용도로는 `__init__`에서 필요한 속성을 모두 초기화하는 것이 좋습니다. 속성이 메서드 안에서 동적으로 추가되면 코드를 읽는 사람이 객체의 형태를 파악하기 어렵습니다.

```python
# 피해야 할 패턴
class Dog:
    def set_name(self, name):
        self.name = name   # __init__ 밖에서 추가
```

대신 `__init__`에서 `None`으로 초기화해두고, 나중에 값을 채우는 방식이 명확합니다.

```python
class Dog:
    def __init__(self, name=None):
        self.name = name   # 초기값 명시
```

![클래스 정의와 사용 예제](/assets/posts/python-class-basics-code.svg)

## isinstance와 issubclass

`isinstance(obj, cls)`는 객체가 클래스의 인스턴스인지 확인합니다. 상속 관계도 고려하므로, 서브클래스 인스턴스에도 `True`를 반환합니다.

```python
class Animal:
    pass

class Dog(Animal):
    pass

d = Dog()
print(isinstance(d, Dog))     # True
print(isinstance(d, Animal))  # True — 상속 관계 포함
print(issubclass(Dog, Animal))  # True
```

`type(d) is Dog`는 정확히 `Dog` 클래스인지 확인해 상속을 무시합니다. 대부분의 경우 `isinstance`가 더 적합합니다.

---

**지난 글:** [array 모듈: 타입 고정 배열](/posts/python-array-module/)

**다음 글:** [인스턴스 속성 vs 클래스 속성](/posts/python-instance-vs-class-attributes/)

<br>
읽어주셔서 감사합니다. 😊
