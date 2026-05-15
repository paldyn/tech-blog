---
title: "collections.namedtuple: 이름 있는 튜플"
description: "Python collections.namedtuple로 읽기 좋은 불변 데이터 구조를 만드는 방법과 _replace, _asdict, typing.NamedTuple까지 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["python", "collections", "namedtuple", "불변", "데이터 구조"]
featured: false
draft: false
---

[지난 글](/posts/python-collections-ordereddict/)에서 순서 보장 딕셔너리 OrderedDict를 살펴봤습니다. 이번에는 `collections.namedtuple`을 다룹니다. 일반 튜플의 `p[0]`, `p[1]` 같은 인덱스 접근은 의미를 파악하기 어렵습니다. `namedtuple`은 **이름으로 필드에 접근**할 수 있는 불변 데이터 구조로, 코드 가독성을 높이면서도 튜플의 성능과 불변성을 그대로 유지합니다.

## 기본 사용법

```python
from collections import namedtuple

# 타입 이름, 필드 이름 목록
Person = namedtuple("Person", ["name", "age", "city"])

p = Person("Alice", 30, "Seoul")

# 이름으로 접근
print(p.name)  # "Alice"
print(p.age)   # 30

# 인덱스로도 접근 가능
print(p[0])    # "Alice"

# 언패킹
name, age, city = p
print(f"{name}은 {city}에 사는 {age}세입니다.")
```

필드 이름은 공백으로 구분한 문자열로도 지정할 수 있습니다.

```python
Point = namedtuple("Point", "x y z")
```

![namedtuple — 이름 있는 튜플](/assets/posts/python-collections-namedtuple-concept.svg)

## 불변성 — 수정 불가

```python
p = Person("Alice", 30, "Seoul")
p.age = 31  # AttributeError: can't set attribute
```

값을 바꾸고 싶다면 `_replace()`로 **새 객체를 생성**합니다.

```python
p2 = p._replace(age=31)
print(p2)  # Person(name='Alice', age=31, city='Seoul')
print(p)   # Person(name='Alice', age=30, city='Seoul')  ← 원본 그대로
```

## 특수 메서드

```python
# _asdict(): 딕셔너리로 변환 (Python 3.8+ 일반 dict 반환)
d = p._asdict()
print(d)  # {'name': 'Alice', 'age': 30, 'city': 'Seoul'}

# _fields: 필드 이름 튜플
print(Person._fields)  # ('name', 'age', 'city')

# _make(): 시퀀스에서 인스턴스 생성
row = ["Bob", 25, "Busan"]
bob = Person._make(row)
print(bob)  # Person(name='Bob', age=25, city='Busan')
```

CSV 행처럼 순서 있는 데이터를 읽어 namedtuple로 변환할 때 `_make()`가 유용합니다.

![namedtuple 메서드·활용 패턴](/assets/posts/python-collections-namedtuple-methods.svg)

## 기본값(defaults)

Python 3.6.1 이상에서 `defaults` 인수로 **오른쪽부터** 기본값을 지정할 수 있습니다.

```python
Point = namedtuple("Point", ["x", "y", "z"], defaults=[0])
p = Point(1, 2)
print(p)  # Point(x=1, y=2, z=0)

# 기본값 확인
print(Point._field_defaults)  # {'z': 0}
```

## typing.NamedTuple — 타입 힌트와 함께

타입 힌트를 포함한 더 현대적인 방식입니다.

```python
from typing import NamedTuple

class Employee(NamedTuple):
    name: str
    department: str
    salary: float = 0.0  # 기본값

emp = Employee("Alice", "Engineering", 60000.0)
print(emp)
# Employee(name='Alice', department='Engineering', salary=60000.0)
```

클래스 문법을 쓰기 때문에 IDE의 타입 추론과 자동완성이 잘 동작합니다.

## namedtuple vs dataclass

```python
# namedtuple: 불변, 메서드 없음, 가볍고 빠름
Point = namedtuple("Point", ["x", "y"])

# dataclass: 가변(기본), 메서드 추가 가능, 더 많은 기능
from dataclasses import dataclass

@dataclass
class PointDC:
    x: float
    y: float

    def distance(self):
        return (self.x**2 + self.y**2) ** 0.5
```

불변 데이터를 가볍게 표현할 때는 `namedtuple`, 메서드나 가변 상태가 필요하다면 `dataclass`를 선택하세요. 시리즈 뒷부분에서 `dataclass`를 자세히 다룰 예정입니다.

---

**지난 글:** [collections.OrderedDict: 순서 보장 딕셔너리](/posts/python-collections-ordereddict/)

**다음 글:** [heapq: 파이썬 힙과 우선순위 큐](/posts/python-heapq/)

<br>
읽어주셔서 감사합니다. 😊
