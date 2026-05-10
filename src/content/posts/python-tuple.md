---
title: "튜플: 불변 시퀀스의 힘과 언패킹 패턴"
description: "Python tuple의 생성·불변성·해시 가능성을 이해하고, 언패킹·스왑·namedtuple 활용까지 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "tuple", "튜플", "언패킹", "namedtuple", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-list-basics/)에서 가변 시퀀스인 리스트를 살펴봤다. 이번에는 불변 시퀀스인 **튜플(tuple)**을 다룬다. 리스트와 비슷해 보이지만 불변성이 가져다주는 장점이 크다.

## 튜플 생성

```python
t = (1, 2, 3)      # 괄호 사용
t2 = 1, 2, 3       # 괄호 생략 가능
single = (1,)      # 원소 1개: 쉼표 필수!
wrong = (1)        # 이건 int 1 (튜플 아님)
empty = ()
```

원소가 하나인 튜플을 만들 때 쉼표를 빠뜨리는 실수가 흔하다. `type((1))` 은 `<class 'int'>`다.

## 불변성과 해시

튜플은 수정 불가다. 이 덕분에 해시 가능하며, `dict` 키나 `set` 원소로 쓸 수 있다.

```python
t = (1, 2, 3)
t[0] = 99     # TypeError: 'tuple' object does not support item assignment

# dict 키로 활용 (좌표, 복합 키 등)
grid = {(0, 0): "start", (3, 4): "end"}
visited = {(1, 2), (3, 4)}
```

단, 튜플이 가변 객체를 담고 있으면 해시 불가다.

```python
hash((1, 2))        # 정상
hash(([1, 2],))     # TypeError: unhashable type: 'list'
```

![튜플 개요](/assets/posts/python-tuple-overview.svg)

## 언패킹

튜플의 가장 강력한 기능이다. 리스트나 모든 이터러블에도 동일하게 적용된다.

```python
x, y, z = (10, 20, 30)

# 변수 스왑 (임시 변수 불필요)
a, b = 1, 2
a, b = b, a   # a=2, b=1

# 별표(*) 언패킹
first, *rest = (1, 2, 3, 4, 5)
# first=1, rest=[2, 3, 4, 5]

head, *middle, tail = (1, 2, 3, 4, 5)
# head=1, middle=[2,3,4], tail=5

# 중첩 언패킹
(a, b), c = (1, 2), 3
```

## for 루프에서의 언패킹

```python
pairs = [(1, "one"), (2, "two"), (3, "three")]
for num, name in pairs:
    print(f"{num}: {name}")

# enumerate, zip 결과도 동일
for i, val in enumerate(["a", "b", "c"]):
    print(i, val)
```

## 함수의 다중 반환값

Python 함수는 튜플로 여러 값을 반환한다.

```python
def min_max(lst):
    return min(lst), max(lst)   # tuple 반환

lo, hi = min_max([3, 1, 4, 1, 5])
result = min_max([3, 1, 4, 1, 5])  # tuple로 받기도 가능
```

## namedtuple

필드에 이름을 붙이고 싶을 때 쓴다. 튜플의 모든 성질을 그대로 유지한다.

```python
from collections import namedtuple

Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
p.x, p.y      # 3, 4 (이름으로 접근)
p[0], p[1]    # 3, 4 (인덱스로도 접근)
x, y = p      # 언패킹

# 특정 필드만 바꾼 새 인스턴스
p2 = p._replace(x=10)  # Point(x=10, y=4)
```

Python 3.6+에서는 타입 힌트와 함께 사용하기 좋은 `NamedTuple` 클래스 방식도 있다.

```python
from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
    z: float = 0.0  # 기본값 가능

p = Point(1.0, 2.0)
```

![namedtuple 활용](/assets/posts/python-tuple-namedtuple.svg)

## 리스트 vs 튜플 선택 기준

| 상황 | 선택 |
|------|------|
| 내용이 바뀌지 않는 레코드 | `tuple` |
| dict 키, set 원소 | `tuple` |
| 함수에서 여러 값 반환 | `tuple` |
| 동적으로 추가/삭제 필요 | `list` |
| 동질한 타입의 시퀀스 | `list` |

---

**지난 글:** [리스트 기초: Python의 만능 순서형 자료구조](/posts/python-list-basics/)

**다음 글:** [딕셔너리 기초: 키-값 매핑의 모든 것](/posts/python-dict-basics/)

<br>
읽어주셔서 감사합니다. 😊
