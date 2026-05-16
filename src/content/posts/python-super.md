---
title: "super(): 협력적 다중 상속의 핵심"
description: "Python super() 함수의 동작 원리, MRO 기반 위임 체계, 협력적 다중 상속에서의 올바른 사용법, **kwargs 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["python", "super", "MRO", "다중상속", "협력적상속", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-multiple-inheritance-mro/)에서 다중 상속과 C3 선형화 알고리즘을 살펴보았습니다. `super()`는 그 MRO를 바탕으로 작동하는 함수로, 단순히 "부모 클래스"를 가리키는 것이 아니라 **MRO 순서에서 현재 클래스 다음 클래스**를 위임 대상으로 반환합니다. 이 미묘한 차이가 다중 상속에서 결정적인 역할을 합니다.

## super()는 부모가 아니다

```python
class A:
    def greet(self): return "A"

class B(A):
    def greet(self):
        return "B+" + super().greet()

class C(A):
    def greet(self):
        return "C+" + super().greet()

class D(B, C):
    def greet(self):
        return "D+" + super().greet()

D().greet()  # "D+B+C+A"
```

`B.greet()`에서 `super()`는 `A`가 아니라 **MRO의 다음 클래스인 `C`**를 가리킵니다. `D.__mro__ = (D, B, C, A, object)`이므로, `B` 입장에서 다음은 `C`입니다.

## super() 동작 흐름

![super() 동작 원리](/assets/posts/python-super-proxy.svg)

`super()`는 두 개의 인자 `(type, obj_or_type)`로 정의됩니다. Python 3에서는 인자를 생략하면 컴파일러가 `__class__` 셀 변수를 자동으로 삽입합니다.

```python
# 이 두 코드는 동일합니다 (Python 3)
super().method()
super(__class__, self).method()
```

## 협력적 __init__

다중 상속에서 `__init__`이 제대로 협력하려면 모든 클래스가 `super().__init__()`을 호출해야 합니다.

![협력적 __init__ 체인](/assets/posts/python-super-cooperative.svg)

`**kw` 패턴을 쓰면 각 믹스인이 자신에게 필요한 인자만 꺼내 쓰고 나머지는 다음 클래스로 전달할 수 있습니다.

```python
class TimestampMixin:
    def __init__(self, *, created_at=None, **kw):
        import datetime
        self.created_at = created_at or datetime.datetime.now()
        super().__init__(**kw)

class NamedMixin:
    def __init__(self, *, name: str, **kw):
        self.name = name
        super().__init__(**kw)

class Record(TimestampMixin, NamedMixin):
    def __init__(self, name: str) -> None:
        super().__init__(name=name)
```

## 체인이 끊기는 경우

```python
class Bad(B, C):
    def greet(self):
        return "Bad+" + B.greet(self)  # super() 대신 직접 호출
```

`B.greet(self)`를 직접 호출하면 `B`의 내부 `super()`는 여전히 MRO 기준으로 `C`를 가리키지만, `C.greet()`에서의 `super()`가 건너뛰어질 가능성이 생깁니다. 복잡한 계층에서는 항상 `super()`를 사용해야 안전합니다.

## super()와 클래스 메서드

```python
class Parent:
    @classmethod
    def create(cls) -> "Parent":
        return cls()

class Child(Parent):
    @classmethod
    def create(cls) -> "Child":
        instance = super().create()  # Parent.create() 호출
        return instance
```

`@classmethod`에서도 `super()`는 동일하게 MRO를 따릅니다. `cls`는 여전히 호출된 클래스를 가리킵니다.

## 단일 상속에서도 super()

단일 상속에서도 `super()`를 쓰는 것이 권장됩니다.

```python
class Base:
    def setup(self): pass

class Child(Base):
    def setup(self):
        super().setup()  # 나중에 믹스인 추가 시 안전
        self.extra = True
```

나중에 `Child`와 `Base` 사이에 클래스를 삽입하더라도 `super()`를 쓰면 자동으로 올바른 클래스를 호출합니다.

---

**지난 글:** [다중 상속과 MRO: 다이아몬드 문제 해결](/posts/python-multiple-inheritance-mro/)

**다음 글:** [추상 기반 클래스: ABC와 abstractmethod](/posts/python-abstract-base-class/)

<br>
읽어주셔서 감사합니다. 😊
