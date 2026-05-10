---
title: "집합과 frozenset: 중복 없는 컬렉션"
description: "Python set의 생성·집합 연산(합·교·차·대칭차)·활용 패턴과, 불변 집합 frozenset을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "set", "frozenset", "집합연산", "중복제거", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-dict-basics/)에서 딕셔너리를 살펴봤다. 이번에는 **집합(set)**을 다룬다. 딕셔너리와 같은 해시 테이블 구조지만 키만 있고 값은 없는 컬렉션이다.

## set이란

set은 **순서 없음·중복 없음·해시 가능 원소만 허용**하는 가변 컬렉션이다. 원소 존재 여부를 O(1)에 확인할 수 있다.

```python
s = {1, 2, 3}
s2 = set([1, 2, 2, 3, 3])  # {1, 2, 3} — 중복 제거
empty = set()               # {} 는 빈 dict!
```

## 원소 추가·삭제

```python
s = {1, 2, 3}
s.add(4)           # {1, 2, 3, 4}
s.discard(99)      # 없어도 오류 없음
s.remove(1)        # 없으면 KeyError
s.pop()            # 임의 원소 제거 (순서 없음)
s.clear()          # 모두 제거
2 in s             # O(1) 멤버십 테스트
```

## 집합 연산

```python
A = {1, 2, 3}
B = {3, 4, 5}

A | B           # {1, 2, 3, 4, 5}  합집합
A & B           # {3}              교집합
A - B           # {1, 2}           차집합 (A에만 있는 것)
B - A           # {4, 5}
A ^ B           # {1, 2, 4, 5}    대칭차 (합집합 - 교집합)

# 메서드 방식도 가능
A.union(B)
A.intersection(B)
A.difference(B)
A.symmetric_difference(B)

# in-place 버전
A |= B   # A.update(B)
A &= B   # A.intersection_update(B)
A -= B   # A.difference_update(B)
```

## 부분집합·상위집합

```python
{1, 2} <= {1, 2, 3}   # True — 부분집합
{1, 2} < {1, 2, 3}    # True — 진부분집합
{1, 2, 3} >= {1, 2}   # True — 상위집합

A.issubset(B)
A.issuperset(B)
A.isdisjoint(B)   # 교집합 없으면 True
```

![set 개요](/assets/posts/python-set-frozenset-overview.svg)

## frozenset — 불변 집합

`frozenset`은 수정 불가능한 집합이다. 해시 가능하므로 `dict` 키나 다른 `set`의 원소로 쓸 수 있다.

```python
fs = frozenset({1, 2, 3})
fs.add(4)            # AttributeError — 수정 불가

d = {fs: "label"}    # dict 키 가능
s = {frozenset({1, 2}), frozenset({3, 4})}  # set의 원소 가능

# 집합 연산 결과는 frozenset 유지
fs | frozenset({4})  # frozenset({1, 2, 3, 4})
```

## 실전 패턴

```python
# 리스트 중복 제거
unique = list(set([1, 2, 2, 3, 1]))  # 순서 비보장

# 두 리스트의 공통 원소
common = set(a) & set(b)

# 차이 원소
only_in_a = set(a) - set(b)

# 대용량 멤버십 테스트
allowed = {"admin", "user", "guest"}  # 리터럴이 set
if role in allowed:   # O(1), 리스트면 O(n)
    ...
```

![set 활용 패턴](/assets/posts/python-set-frozenset-patterns.svg)

## set 컴프리헨션

```python
squares = {x**2 for x in range(10)}
# {0, 1, 4, 9, 16, 25, 36, 49, 64, 81}

even = {x for x in range(20) if x % 2 == 0}
```

## 주의사항

set은 해시 테이블 기반이라 **순서가 없다**. 같은 원소를 담아도 출력 순서가 다를 수 있다. 순서가 필요하면 `sorted(s)`로 정렬해야 한다.

```python
s = {3, 1, 2}
list(s)          # [1, 2, 3] 이 될 수도, 아닐 수도 (구현 의존)
sorted(s)        # [1, 2, 3] (항상 정렬)
```

---

**지난 글:** [딕셔너리 기초: 키-값 매핑의 모든 것](/posts/python-dict-basics/)

**다음 글:** [타입 변환: int, str, list, float 상호 변환](/posts/python-type-conversion/)

<br>
읽어주셔서 감사합니다. 😊
