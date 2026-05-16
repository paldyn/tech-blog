---
title: "@property 데코레이터: 캡슐화된 속성 접근"
description: "Python @property 데코레이터로 getter·setter·deleter를 구현하는 방법, 읽기 전용 속성 패턴, 유효성 검사와 지연 계산(lazy property) 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["python", "property", "getter", "setter", "캡슐화", "데코레이터"]
featured: false
draft: false
---

[지난 글](/posts/python-context-manager-protocol/)에서 `__enter__`·`__exit__`로 컨텍스트 매니저 프로토콜을 구현하는 방법을 살펴보았습니다. 이번에는 클래스 내부 상태를 안전하게 감싸는 또 다른 핵심 도구인 `@property` 데코레이터를 다룹니다. `@property`를 쓰면 인스턴스 속성처럼 읽히지만, 뒤에서는 메서드가 실행되는 접근 인터페이스를 만들 수 있습니다.

## @property 기본

속성 접근을 메서드로 가로채려면 `@property` 데코레이터를 붙입니다.

```python
class Circle:
    def __init__(self, radius: float) -> None:
        self._radius = radius

    @property
    def radius(self) -> float:
        return self._radius

c = Circle(5.0)
print(c.radius)   # 5.0 — 마치 일반 속성처럼
```

`c.radius`는 메서드 호출처럼 보이지 않지만 내부적으로 `Circle.radius.fget(c)`를 실행합니다.

## 동작 흐름

속성에 접근하는 방식에 따라 Python이 호출하는 메서드가 달라집니다.

![property 접근 흐름](/assets/posts/python-property-decorator-flow.svg)

세 가지 접근자를 모두 조합한 예입니다.

```python
class Temperature:
    def __init__(self, celsius: float = 0.0) -> None:
        self._celsius = celsius

    @property
    def celsius(self) -> float:
        return self._celsius

    @celsius.setter
    def celsius(self, value: float) -> None:
        if value < -273.15:
            raise ValueError("절대영도 미만")
        self._celsius = value

    @celsius.deleter
    def celsius(self) -> None:
        self._celsius = 0.0
```

setter에 유효성 검사 로직을 담으면 외부에서 잘못된 값을 넣는 순간 즉시 오류가 발생하고, 내부 `_celsius`는 항상 유효한 상태를 유지합니다.

## 읽기 전용 속성

setter를 정의하지 않으면 쓰기 시도 시 `AttributeError`가 발생합니다. 이것이 읽기 전용 속성을 구현하는 가장 간단한 방법입니다.

```python
class Rectangle:
    def __init__(self, w: float, h: float) -> None:
        self._w, self._h = w, h

    @property
    def area(self) -> float:
        return self._w * self._h
```

`area`는 `w`와 `h`로부터 계산되는 파생 속성입니다. 직접 저장하지 않고 필요할 때 계산하므로 항상 최신 값을 반환합니다.

## 코드 예제

getter·setter·읽기 전용 속성의 조합과 사용 방법입니다.

![property 코드 예제](/assets/posts/python-property-decorator-code.svg)

## 지연 계산(Lazy Property)

값이 비싼 경우, 처음 접근할 때만 계산하고 결과를 캐시합니다.

```python
class DataSet:
    def __init__(self, data: list[float]) -> None:
        self._data = data
        self._mean: float | None = None

    @property
    def mean(self) -> float:
        if self._mean is None:
            self._mean = sum(self._data) / len(self._data)
        return self._mean
```

Python 3.8+에서는 `functools.cached_property`가 이 패턴을 단 한 줄로 대체합니다.

```python
from functools import cached_property

class DataSet:
    def __init__(self, data: list[float]) -> None:
        self._data = data

    @cached_property
    def mean(self) -> float:
        return sum(self._data) / len(self._data)
```

`cached_property`는 첫 호출 후 결과를 인스턴스 `__dict__`에 직접 저장합니다. 이후 접근은 디스크립터를 건너뛰고 `__dict__`에서 바로 읽히므로 일반 속성과 같은 속도입니다.

## property() 함수 형식

데코레이터 문법 없이 `property()` 내장 함수를 직접 쓸 수도 있습니다.

```python
class Angle:
    def _get_deg(self): return self._deg
    def _set_deg(self, v): self._deg = v % 360

    degrees = property(_get_deg, _set_deg)
```

데코레이터 방식이 더 읽기 쉽지만, 속성 이름과 접근자 이름을 분리해야 하는 드문 경우에 유용합니다.

## 흔한 실수: property와 __init__ 순서

setter를 정의했다면 `__init__`에서도 public 이름으로 할당해야 유효성 검사가 적용됩니다.

```python
# 잘못된 예
class Bad:
    def __init__(self, v):
        self._v = v  # setter 건너뜀

# 올바른 예
class Good:
    def __init__(self, v):
        self.v = v  # setter를 통과

    @property
    def v(self): return self._v

    @v.setter
    def v(self, val):
        if val < 0: raise ValueError
        self._v = val
```

`__init__`에서 `self._v = v`로 직접 쓰면 setter 로직을 우회하므로 생성자에서도 반드시 public 이름으로 할당해야 합니다.

---

**지난 글:** [컨텍스트 매니저 프로토콜: __enter__와 __exit__](/posts/python-context-manager-protocol/)

**다음 글:** [@classmethod와 @staticmethod: 세 가지 메서드 종류](/posts/python-classmethod-staticmethod/)

<br>
읽어주셔서 감사합니다. 😊
