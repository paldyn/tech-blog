---
title: "@dataclass: 보일러플레이트 없는 데이터 클래스"
description: "Python @dataclass 데코레이터로 __init__·__repr__·__eq__ 자동 생성, field()로 기본값 팩토리 설정, __post_init__으로 초기화 후 처리하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["python", "dataclass", "field", "__post_init__", "타입힌트", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/python-protocol-typing/)에서 구조적 서브타이핑을 구현하는 Protocol을 살펴보았습니다. 이번에는 Python 3.7에 추가된 `@dataclass`를 다룹니다. 데이터를 담는 클래스를 만들 때마다 작성하는 `__init__`, `__repr__`, `__eq__` 보일러플레이트를 선언 한 줄로 대체합니다.

## 기본 사용법

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float
    z: float = 0.0
```

이것만으로 `__init__(x, y, z=0.0)`, `__repr__`, `__eq__`가 자동 생성됩니다.

```python
p1 = Point(1.0, 2.0)
p2 = Point(1.0, 2.0)
p1 == p2     # True  (값 비교)
repr(p1)     # "Point(x=1.0, y=2.0, z=0.0)"
```

## 자동 생성 메서드 목록

![@dataclass 자동 생성 메서드](/assets/posts/python-dataclass-autogen.svg)

## field()로 세밀한 제어

단순 기본값 이상이 필요할 때 `field()`를 씁니다.

![field()와 __post_init__ 활용](/assets/posts/python-dataclass-field.svg)

`list`·`dict` 같은 가변 기본값은 반드시 `field(default_factory=...)`를 써야 합니다. 직접 `items: list = []`로 쓰면 `ValueError`가 발생합니다. 이는 모든 인스턴스가 같은 리스트 객체를 공유하는 고전적 버그를 방지합니다.

## order=True: 비교 연산자 자동 생성

```python
@dataclass(order=True)
class Version:
    major: int
    minor: int
    patch: int

v1 = Version(1, 2, 3)
v2 = Version(2, 0, 0)
v1 < v2   # True  — (1,2,3) < (2,0,0) 튜플 비교
sorted([v2, v1])  # [Version(1,2,3), Version(2,0,0)]
```

필드 선언 순서로 비교합니다. 특정 필드를 비교에서 제외하려면 `field(compare=False)`를 쓰세요.

## __post_init__으로 초기화 후 처리

`__post_init__`은 `__init__` 완료 직후 자동으로 호출됩니다. 유효성 검사나 파생값 계산에 활용합니다.

```python
@dataclass
class Circle:
    radius: float
    area: float = field(init=False)

    def __post_init__(self):
        if self.radius <= 0:
            raise ValueError("radius must be positive")
        self.area = 3.14159 * self.radius ** 2
```

`init=False`로 선언된 필드는 생성자 인자에 포함되지 않고, `__post_init__`에서 직접 설정합니다.

## dataclasses 유틸리티 함수

```python
from dataclasses import fields, asdict, astuple, replace

p = Point(1.0, 2.0)
fields(p)        # 필드 정보 튜플
asdict(p)        # {'x': 1.0, 'y': 2.0, 'z': 0.0}
astuple(p)       # (1.0, 2.0, 0.0)
replace(p, x=9)  # Point(x=9.0, y=2.0, z=0.0)
```

`replace()`는 특정 필드만 바꾼 새 인스턴스를 만듭니다. 불변 데이터 패턴에 유용합니다.

## ClassVar: 클래스 변수 선언

필드가 아닌 클래스 변수는 `ClassVar`로 표시해야 `__init__` 인자에서 제외됩니다.

```python
from typing import ClassVar
from dataclasses import dataclass

@dataclass
class Config:
    VERSION: ClassVar[str] = "1.0"
    name: str
```

## @dataclass vs NamedTuple

| 항목 | @dataclass | NamedTuple |
|------|-----------|------------|
| 가변성 | 기본 가변 | 불변 |
| 상속 | 일반 클래스 | 튜플 |
| 성능 | 일반 | 약간 빠름 |
| 확장 | 풍부 | 제한적 |

단순 불변 레코드라면 `NamedTuple`을, 로직·상속이 필요하면 `@dataclass`를 선택합니다.

---

**지난 글:** [Protocol: 구조적 서브타이핑](/posts/python-protocol-typing/)

**다음 글:** [frozen dataclass: 불변 데이터 클래스](/posts/python-frozen-dataclass/)

<br>
읽어주셔서 감사합니다. 😊
