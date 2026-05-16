---
title: "frozen dataclass: 불변 데이터 클래스"
description: "Python @dataclass(frozen=True)의 동작 방식, 자동 __hash__ 생성, dict/set 키로의 활용, __post_init__에서의 값 설정, 상속 시 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["python", "dataclass", "frozen", "불변", "__hash__", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-dataclass/)에서 `@dataclass`로 보일러플레이트 코드를 줄이는 방법을 살펴보았습니다. `frozen=True` 옵션을 추가하면 인스턴스 생성 후 속성을 변경할 수 없는 불변(immutable) 데이터 클래스가 됩니다. 불변성은 스레드 안전성 확보, 딕셔너리 키 사용, 버그 방지 등 여러 이점을 제공합니다.

## frozen=True 기본

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
p.x = 9.0  # FrozenInstanceError: cannot assign to field 'x'
```

`frozen=True`는 `__setattr__`와 `__delattr__`를 오버라이드해서 모든 속성 변경 시도를 차단합니다.

## 가변 vs 불변 비교

![frozen=True vs frozen=False](/assets/posts/python-frozen-dataclass-compare.svg)

## 핵심 이점: __hash__ 자동 생성

기본 `@dataclass`에서 `eq=True`(기본값)이면 `__hash__`는 `None`으로 설정되어 딕셔너리 키로 쓸 수 없습니다. `frozen=True`를 추가하면 필드 값으로 `__hash__`가 자동 생성됩니다.

```python
@dataclass(frozen=True)
class RGB:
    r: int
    g: int
    b: int

color_names = {RGB(255, 0, 0): "red", RGB(0, 255, 0): "green"}
color_names[RGB(255, 0, 0)]  # "red"
```

## 활용 패턴

![frozen dataclass 활용 패턴](/assets/posts/python-frozen-dataclass-code.svg)

`replace()`로 특정 필드만 바꾼 새 인스턴스를 만들 수 있습니다. 원본은 변경되지 않습니다. 이는 함수형 프로그래밍의 불변 데이터 변환 패턴과 일치합니다.

## __post_init__에서 속성 설정

`frozen=True`에서도 `__post_init__`은 호출됩니다. 단, `__init__`이 완료된 뒤이므로 일반 속성 할당이 차단됩니다. 파생 필드를 계산해서 저장하려면 `object.__setattr__()`을 직접 사용합니다.

```python
@dataclass(frozen=True)
class Circle:
    radius: float
    area: float = 0.0  # 초기화용 더미 값

    def __post_init__(self):
        # self.area = ...  → FrozenInstanceError
        object.__setattr__(self, 'area', 3.14 * self.radius ** 2)
```

또는 `field(init=False)`와 `__post_init__`을 조합합니다.

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Circle:
    radius: float
    area: float = field(init=False)

    def __post_init__(self):
        object.__setattr__(self, 'area', 3.14 * self.radius ** 2)
```

## 상속 시 주의사항

frozen과 non-frozen dataclass를 혼합 상속하면 `TypeError`가 발생합니다.

```python
@dataclass
class Base:
    x: int

@dataclass(frozen=True)
class Child(Base):  # TypeError!
    y: int
```

frozen 계층을 일관되게 유지하거나, 모두 frozen 또는 모두 non-frozen으로 통일해야 합니다.

## frozen dataclass와 가변 필드

`frozen=True`여도 **필드 자체는 불변이지만, 필드가 참조하는 객체는 변경 가능**합니다.

```python
@dataclass(frozen=True)
class Config:
    tags: list  # 리스트 자체는 변경 가능!

c = Config(tags=["a", "b"])
c.tags.append("c")  # 가능! c.tags = [...] 는 불가
```

진정한 불변성이 필요하면 가변 필드에 `tuple`이나 `frozenset`을 씁니다.

---

**지난 글:** [@dataclass: 보일러플레이트 없는 데이터 클래스](/posts/python-dataclass/)

**다음 글:** [__slots__: 메모리 효율적인 클래스](/posts/python-slots/)

<br>
읽어주셔서 감사합니다. 😊
