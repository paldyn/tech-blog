---
title: "@classmethod와 @staticmethod: 세 가지 메서드 종류"
description: "Python 인스턴스 메서드·클래스 메서드·정적 메서드의 차이점, @classmethod로 팩토리 패턴 구현하기, @staticmethod의 올바른 사용 시점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["python", "classmethod", "staticmethod", "메서드", "팩토리패턴"]
featured: false
draft: false
---

[지난 글](/posts/python-property-decorator/)에서 `@property`로 속성 접근을 제어하는 방법을 살펴보았습니다. 이번에는 클래스 안에서 정의되는 세 가지 메서드 종류인 인스턴스 메서드, `@classmethod`, `@staticmethod`를 비교합니다. 셋의 차이를 이해하면 목적에 맞는 메서드를 선택할 수 있고, 특히 `@classmethod`를 활용한 팩토리 패턴은 API 설계에서 자주 등장합니다.

## 인스턴스 메서드

가장 일반적인 형태로, 첫 번째 인자로 인스턴스 자신(`self`)을 받습니다.

```python
class Counter:
    def __init__(self) -> None:
        self._count = 0

    def increment(self) -> None:
        self._count += 1

    def value(self) -> int:
        return self._count
```

`self`를 통해 인스턴스 속성과 다른 메서드에 모두 접근할 수 있습니다.

## @classmethod

첫 번째 인자로 인스턴스가 아닌 **클래스 자체**(`cls`)를 받습니다.

```python
class Date:
    def __init__(self, year, month, day):
        self.year, self.month, self.day = year, month, day

    @classmethod
    def from_iso(cls, s: str) -> "Date":
        y, m, d = map(int, s.split('-'))
        return cls(y, m, d)

d = Date.from_iso("2026-05-17")
```

`cls`는 메서드를 호출한 클래스를 가리킵니다. `Date.from_iso()`를 호출하면 `cls=Date`이지만, `Date`를 상속한 `ExtendedDate.from_iso()`를 호출하면 `cls=ExtendedDate`가 됩니다. 이 덕분에 부모 클래스에 팩토리 메서드를 한 번만 정의해도 자식 클래스에 자동으로 적응합니다.

## @staticmethod

`self`도 `cls`도 받지 않는 독립 함수로, 클래스 네임스페이스에 속할 뿐입니다.

```python
class Date:
    @staticmethod
    def is_leap(year: int) -> bool:
        return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
```

`Date.is_leap(2024)`처럼 클래스 이름으로 호출하거나 인스턴스로도 호출할 수 있습니다. 클래스 상태에 전혀 의존하지 않는 유틸리티 함수를 논리적으로 클래스와 묶을 때 사용합니다.

## 세 가지 비교

![세 가지 메서드 종류 비교](/assets/posts/python-classmethod-staticmethod-compare.svg)

## 팩토리 패턴 코드

`@classmethod`로 여러 입력 형식을 지원하는 대체 생성자를 구현합니다.

![classmethod 팩토리 패턴](/assets/posts/python-classmethod-staticmethod-code.svg)

## 언제 무엇을 쓸까

**인스턴스 메서드**: 인스턴스 상태를 읽거나 변경할 때. 대부분의 메서드가 여기에 해당합니다.

**@classmethod**: 클래스 속성에 접근하거나 인스턴스를 생성하는 팩토리가 필요할 때. 대표적인 예가 `dict.fromkeys()`, `datetime.date.fromisoformat()`입니다.

**@staticmethod**: 클래스나 인스턴스 상태에 전혀 의존하지 않는 순수 함수를 클래스 네임스페이스에 두고 싶을 때.

```python
class MathHelper:
    @staticmethod
    def clamp(value, lo, hi):
        return max(lo, min(hi, value))

MathHelper.clamp(5, 1, 10)  # 5
MathHelper.clamp(15, 1, 10) # 10
```

`@staticmethod`는 모듈 수준 함수로 대체할 수 있는 경우가 많습니다. 클래스와 개념적으로 결합되어 있고 네임스페이스 정리가 목적이라면 정적 메서드를, 그렇지 않다면 모듈 수준 함수가 더 간단합니다.

## 상속 시 주의

```python
class Animal:
    sound = "..."

    @classmethod
    def speak(cls) -> str:
        return cls.sound  # 호출된 클래스의 sound 사용

class Dog(Animal):
    sound = "Woof"

Dog.speak()    # "Woof"
Animal.speak() # "..."
```

`@classmethod`에서 `cls.sound`를 쓰면 항상 **호출된 클래스**의 클래스 변수를 참조합니다. 만약 `Animal.sound`로 하드코딩하면 상속의 이점이 사라집니다.

---

**지난 글:** [@property 데코레이터: 캡슐화된 속성 접근](/posts/python-property-decorator/)

**다음 글:** [단일 상속: 코드 재사용의 기본](/posts/python-inheritance-single/)

<br>
읽어주셔서 감사합니다. 😊
