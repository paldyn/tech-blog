---
title: "추상 기반 클래스: ABC와 abstractmethod"
description: "Python abc 모듈, ABC 클래스, @abstractmethod·@abstractproperty 사용법, 인터페이스 강제 메커니즘, collections.abc 내장 ABC를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["python", "ABC", "abstractmethod", "인터페이스", "추상클래스", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-super/)에서 `super()`로 협력적 상속 체인을 구성하는 방법을 살펴보았습니다. 이번에는 구현을 강제하는 도구인 추상 기반 클래스(Abstract Base Class, ABC)를 다룹니다. ABC는 "이 메서드들을 반드시 구현해야 한다"는 계약을 코드로 표현하며, 규약을 지키지 않으면 인스턴스 생성 시점에 즉시 오류를 냅니다.

## ABC 기본 구조

`abc.ABC`를 상속하고 `@abstractmethod`로 구현이 필요한 메서드를 표시합니다.

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

    @abstractmethod
    def perimeter(self) -> float: ...
```

`Shape`를 직접 인스턴스화하면 `TypeError`가 발생합니다. 모든 추상 메서드를 구현한 자식 클래스만 인스턴스를 만들 수 있습니다.

## ABC 계층 구조

![추상 기반 클래스(ABC) 구조](/assets/posts/python-abstract-base-class-hierarchy.svg)

## 구현 예제

![ABC 정의와 구현 예제](/assets/posts/python-abstract-base-class-code.svg)

`@abstractmethod`를 `@property`와 조합하면 추상 프로퍼티를 만들 수 있습니다. 순서는 `@property`가 `@abstractmethod`보다 위에 와야 합니다.

## 추상 클래스에도 구현을 둘 수 있다

추상 메서드에 본문을 작성해도 됩니다. 자식이 오버라이드 후 `super()`로 호출할 수 있습니다.

```python
class Validator(ABC):
    @abstractmethod
    def validate(self, value) -> bool:
        # 기본 규칙: None은 항상 실패
        return value is not None

class RangeValidator(Validator):
    def __init__(self, lo, hi):
        self.lo, self.hi = lo, hi

    def validate(self, value) -> bool:
        if not super().validate(value):
            return False
        return self.lo <= value <= self.hi
```

## ABCMeta를 직접 쓰는 방법

`ABC`는 편의 클래스일 뿐입니다. 메타클래스를 명시적으로 지정할 수도 있습니다.

```python
from abc import ABCMeta, abstractmethod

class Interface(metaclass=ABCMeta):
    @abstractmethod
    def execute(self): ...
```

`ABC`와 동일하게 동작하며, 이미 다른 메타클래스를 쓰는 경우 충돌을 조정할 때 직접 `ABCMeta`를 사용합니다.

## 미구현 메서드 확인

```python
Shape.__abstractmethods__
# frozenset({'area', 'perimeter'})
```

## collections.abc 내장 ABC

Python 표준 라이브러리에는 자주 쓰이는 인터페이스를 정의한 ABC들이 있습니다.

```python
from collections.abc import Sequence, Mapping, Iterable

isinstance([], Sequence)    # True
isinstance({}, Mapping)     # True
isinstance(range(5), Iterable) # True
```

커스텀 컨테이너를 만들 때 이 ABC들을 상속하면 `__getitem__`·`__len__` 같은 필수 메서드만 구현해도 `index`, `count`, `__contains__` 등 많은 메서드가 자동으로 제공됩니다.

```python
from collections.abc import MutableSequence

class Stack(MutableSequence):
    def __init__(self): self._data = []
    def __getitem__(self, i): return self._data[i]
    def __setitem__(self, i, v): self._data[i] = v
    def __delitem__(self, i): del self._data[i]
    def __len__(self): return len(self._data)
    def insert(self, i, v): self._data.insert(i, v)
    # index(), count(), append(), pop() 등 자동 제공!
```

## ABC vs Protocol

`ABC`는 명목적(nominal) 서브타이핑입니다 — 반드시 명시적으로 상속해야 합니다. 반면 다음 글에서 다룰 `Protocol`은 구조적(structural) 서브타이핑으로, 상속 없이 메서드 서명만 맞으면 해당 타입으로 인정됩니다.

---

**지난 글:** [super(): 협력적 다중 상속의 핵심](/posts/python-super/)

**다음 글:** [Protocol: 구조적 서브타이핑](/posts/python-protocol-typing/)

<br>
읽어주셔서 감사합니다. 😊
