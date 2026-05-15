---
title: "self 키워드 완전 이해"
description: "Python 메서드의 첫 번째 매개변수 self가 무엇인지, 어떻게 자동 전달되는지, 메서드 체이닝에 활용하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["python", "self", "메서드", "OOP", "인스턴스"]
featured: false
draft: false
---

[지난 글](/posts/python-instance-vs-class-attributes/)에서 인스턴스 속성과 클래스 속성의 차이를 살펴보았습니다. 메서드를 정의할 때마다 등장하는 `self`는 Python 초심자에게 낯선 개념입니다. 이번 글에서는 `self`가 무엇인지, 왜 필요한지, 어떻게 동작하는지 원리부터 알아봅니다.

## self는 무엇인가

`self`는 메서드가 호출될 때 파이썬이 자동으로 첫 번째 인수로 전달하는 **현재 인스턴스**입니다. 이름은 관례일 뿐 Python 키워드가 아니며, `this`나 다른 이름을 써도 동작합니다. 그러나 PEP 8은 `self`를 강력히 권장합니다.

```python
class Dog:
    def bark(self):
        print(f"{self.name} says Woof!")
```

`rex.bark()`를 호출하면 파이썬은 내부적으로 `Dog.bark(rex)`와 동일하게 처리합니다. `rex`가 `self` 자리에 전달됩니다.

## 자동 전달 원리

Python의 메서드는 클래스 딕셔너리에 함수로 저장됩니다. 인스턴스를 통해 접근할 때 **디스크립터 프로토콜**이 개입해 인스턴스를 첫 번째 인수로 바인딩한 **바운드 메서드(bound method)**를 만들어 반환합니다.

```python
class Dog:
    def bark(self):
        return "Woof"

rex = Dog()
print(rex.bark)       # <bound method Dog.bark of <Dog object>>
print(Dog.bark)       # <function Dog.bark at ...>

# 동일한 호출
rex.bark()            # 바운드 메서드 호출
Dog.bark(rex)         # 언바운드로 인스턴스 직접 전달
```

바운드 메서드를 변수에 저장해도 인스턴스 참조를 유지합니다.

```python
fn = rex.bark     # rex가 바인딩된 상태
print(fn())       # Woof — rex 없이 호출 가능
print(fn.__self__ is rex)  # True
```

![self가 전달되는 원리](/assets/posts/python-self-keyword-mechanism.svg)

## self를 통한 속성 접근

`self`를 통해 인스턴스 속성에 읽고 쓰거나, 같은 클래스의 다른 메서드를 호출합니다.

```python
class Rectangle:
    def __init__(self, w, h):
        self.w = w
        self.h = h

    def area(self):
        return self.w * self.h

    def perimeter(self):
        return 2 * (self.w + self.h)

    def is_square(self):
        return self.w == self.h     # self 속성 비교

    def scale(self, factor):
        self.w *= factor            # self 속성 수정
        self.h *= factor
        return self                 # self 반환 → 체이닝 가능
```

## 메서드 체이닝

메서드가 `self`를 반환하면 결과에 곧바로 다른 메서드를 연결할 수 있습니다. 이를 **Fluent Interface** 또는 메서드 체이닝이라 합니다.

```python
r = Rectangle(4, 3)
print(r.scale(2).area())   # 48 — scale 후 area 연속 호출
```

![self를 이용한 메서드 체이닝](/assets/posts/python-self-keyword-code.svg)

## 클래스 메서드와 정적 메서드에서의 차이

`@classmethod`는 첫 인수로 **클래스 자체**(`cls`)를 받습니다. `@staticmethod`는 첫 번째 특수 인수가 없습니다.

```python
class Dog:
    count = 0

    def __init__(self, name):
        self.name = name
        Dog.count += 1

    @classmethod
    def get_count(cls):
        return cls.count    # cls = Dog 클래스

    @staticmethod
    def validate_name(name):
        return isinstance(name, str) and len(name) > 0

print(Dog.get_count())            # 0
Dog("Rex")
print(Dog.get_count())            # 1
print(Dog.validate_name("Rex"))   # True
```

`self`(인스턴스), `cls`(클래스), 없음(정적) — 세 가지 종류의 메서드는 첫 번째 인수로 구분됩니다.

## self를 빠뜨리는 실수

```python
class Dog:
    def bark():           # self 없음
        return "Woof"

d = Dog()
d.bark()  # TypeError: bark() takes 0 positional arguments but 1 was given
```

`d.bark()`를 호출할 때 파이썬은 `d`를 첫 번째 인수로 전달하려 하지만, `bark`는 인수를 받지 않으므로 에러가 발생합니다. 인스턴스 메서드는 항상 `self`를 첫 번째 매개변수로 선언해야 합니다.

## self와 id 확인

`self`가 정말 같은 인스턴스를 가리키는지 확인할 수 있습니다.

```python
class Dog:
    def who_am_i(self):
        return id(self)

rex = Dog()
print(id(rex))          # 예: 140234567890
print(rex.who_am_i())   # 동일한 값 — 같은 객체
```

---

**지난 글:** [인스턴스 속성 vs 클래스 속성](/posts/python-instance-vs-class-attributes/)

**다음 글:** [__init__ vs __new__](/posts/python-init-vs-new/)

<br>
읽어주셔서 감사합니다. 😊
