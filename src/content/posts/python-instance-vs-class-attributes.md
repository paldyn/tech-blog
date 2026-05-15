---
title: "인스턴스 속성 vs 클래스 속성"
description: "Python에서 인스턴스 속성과 클래스 속성의 차이, 속성 조회 순서, 가변 클래스 속성 함정, 클래스 속성의 올바른 활용 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["python", "class", "인스턴스 속성", "클래스 속성", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-class-basics/)에서 클래스의 기본 구조를 살펴보았습니다. 클래스 안에서 속성을 정의하는 위치에 따라 **인스턴스 속성**과 **클래스 속성**으로 나뉩니다. 이 두 가지를 혼동하면 예상치 못한 버그가 생기므로, 차이를 명확히 이해하는 것이 중요합니다.

## 인스턴스 속성

`__init__` 안에서 `self.변수명 = 값` 형태로 선언한 속성입니다. 각 인스턴스의 `__dict__`에 저장되며, 인스턴스마다 독립된 값을 가집니다.

```python
class Dog:
    def __init__(self, name, age):
        self.name = name   # 인스턴스 속성
        self.age  = age

d1 = Dog("Rex", 3)
d2 = Dog("Max", 5)
print(d1.name)  # Rex
print(d2.name)  # Max
print(d1.__dict__)  # {'name': 'Rex', 'age': 3}
```

`d1`과 `d2`는 서로 다른 딕셔너리를 가지므로 값이 완전히 독립됩니다.

## 클래스 속성

클래스 본문에서, `__init__` 바깥에 직접 선언한 속성입니다. 클래스의 `__dict__`에 한 번만 저장되며 모든 인스턴스가 공유합니다.

```python
class Dog:
    species = "Canis lupus"  # 클래스 속성
    count   = 0

    def __init__(self, name):
        self.name = name
        Dog.count += 1       # 클래스 속성 직접 접근

d1 = Dog("Rex")
d2 = Dog("Max")
print(Dog.species)  # Canis lupus
print(Dog.count)    # 2
print(d1.species)   # Canis lupus (클래스 속성 조회)
```

클래스 속성은 상수, 공유 카운터, 기본값 등에 유용합니다.

## 속성 조회 순서

`obj.attr`을 평가할 때 Python은 다음 순서로 탐색합니다.

1. `obj.__dict__` (인스턴스 딕셔너리)
2. `type(obj).__dict__` (클래스 딕셔너리)
3. 상위 클래스 MRO 순서대로 탐색
4. 없으면 `AttributeError`

```python
class Dog:
    species = "Canis lupus"
    def __init__(self, name):
        self.name = name

d = Dog("Rex")
print(d.species)   # Canis lupus ← 클래스 속성에서 찾음
d.species = "wolf" # 인스턴스 딕셔너리에 추가 (클래스 속성 가림)
print(d.species)   # wolf
print(Dog.species) # Canis lupus ← 클래스 속성은 변경 안 됨
```

인스턴스에서 클래스 속성과 같은 이름에 값을 대입하면, 클래스 속성을 수정하는 것이 아니라 인스턴스 딕셔너리에 새 항목이 생겨 클래스 속성을 **가립니다(shadow)**.

![속성 조회 순서](/assets/posts/python-instance-vs-class-attributes-lookup.svg)

## 가변 클래스 속성 함정

클래스 속성에 리스트나 딕셔너리 같은 **가변(mutable) 객체**를 두면 예상치 못한 공유가 발생합니다.

```python
class Kennel:
    dogs = []           # 위험: 클래스 속성

    def add(self, dog):
        self.dogs.append(dog)  # 클래스 속성 직접 변경

k1 = Kennel()
k2 = Kennel()
k1.add("Rex")
print(k2.dogs)   # ['Rex'] — k2에 추가하지 않았는데!
```

`self.dogs.append`는 재할당이 아닌 in-place 변경이라, 인스턴스 딕셔너리에 새 항목을 만들지 않습니다. 그 결과 `k1.dogs`와 `k2.dogs`가 같은 리스트 객체를 가리키게 됩니다. 해결책은 `__init__`에서 인스턴스 속성으로 초기화하는 것입니다.

```python
class Kennel:
    def __init__(self):
        self.dogs = []   # 인스턴스마다 독립된 리스트

    def add(self, dog):
        self.dogs.append(dog)

k1 = Kennel()
k2 = Kennel()
k1.add("Rex")
print(k2.dogs)   # [] — 정상
```

![가변 클래스 속성 함정](/assets/posts/python-instance-vs-class-attributes-pitfall.svg)

## 클래스 속성의 올바른 활용

클래스 속성은 다음과 같은 목적에 적합합니다.

```python
class Config:
    DEBUG   = False     # 전체 공유 상수
    VERSION = "1.0.0"

class Counter:
    total = 0
    def __init__(self):
        Counter.total += 1   # 인스턴스 생성 횟수 추적

class Animal:
    sound = ""          # 서브클래스에서 오버라이드할 기본값

    def speak(self):
        return self.sound   # 인스턴스에 없으면 클래스 속성 반환
```

서브클래스에서 클래스 속성을 오버라이드하면 해당 클래스와 그 인스턴스만 새 값을 가집니다.

```python
class Dog(Animal):
    sound = "Woof"

class Cat(Animal):
    sound = "Meow"

print(Dog().speak())  # Woof
print(Cat().speak())  # Meow
```

## 속성 존재 여부 확인

```python
d = Dog("Rex")
print(hasattr(d, "name"))     # True
print(hasattr(d, "unknown"))  # False

# 기본값 지정 접근
age = getattr(d, "age", 0)    # 없으면 0 반환

# 속성 동적 설정·삭제
setattr(d, "color", "brown")
delattr(d, "color")
```

`vars(obj)`는 `obj.__dict__`와 동일하게 인스턴스 속성 딕셔너리를 반환합니다.

---

**지난 글:** [클래스 기초: 사용자 정의 타입 만들기](/posts/python-class-basics/)

**다음 글:** [self 키워드 완전 이해](/posts/python-self-keyword/)

<br>
읽어주셔서 감사합니다. 😊
