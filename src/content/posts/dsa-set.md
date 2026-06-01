---
title: "집합 자료구조 (Set)"
description: "중복 없는 원소 관리에 최적화된 집합 자료구조 — HashSet과 TreeSet의 구현 원리, 집합 연산, Python set의 내부 동작을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["집합", "set", "HashSet", "TreeSet", "집합 연산"]
featured: false
draft: false
---

[지난 글](/posts/dsa-bloom-filter/)에서 확률적으로 멤버십을 확인하는 블룸 필터를 다뤘습니다. 이번 글은 **정확한 멤버십 확인**에 특화된 집합(Set) 자료구조를 살펴봅니다. "이 값이 이미 있는가?"라는 질문이 핵심인 수많은 알고리즘에서 집합이 핵심 역할을 합니다.

## 집합의 핵심 특성

집합은 세 가지 불변 조건을 갖습니다.

1. **유일성(Uniqueness)**: 동일한 원소가 두 번 저장되지 않음
2. **비순서성(Unordered, HashSet 기준)**: 삽입 순서가 유지되지 않음
3. **O(1) 멤버십 확인(HashSet 기준)**: `x in s`가 상수 시간

## 구현 방식

![HashSet vs TreeSet](/assets/posts/dsa-set-implementations.svg)

### HashSet (Python `set`)

내부적으로 해시 테이블입니다. 개방 주소법(Python의 경우)이나 체이닝을 사용해 충돌을 처리합니다.

```python
s = set()
s.add(42)          # O(1)
s.discard(42)      # O(1), 없어도 오류 없음
42 in s            # O(1)
len(s)             # O(1)
```

### TreeSet (Java `TreeSet`, Python `sortedcontainers.SortedList`)

Red-Black Tree 기반으로 원소를 정렬 상태로 유지합니다.

```python
from sortedcontainers import SortedList

ts = SortedList()
ts.add(5)
ts.add(2)
ts.add(8)
print(ts)            # SortedList([2, 5, 8])
print(ts[0])         # 2 — 최솟값 O(log n)
print(ts[-1])        # 8 — 최댓값 O(log n)

# 범위 쿼리: 3 이상 7 이하
sub = ts.irange(3, 7)
print(list(sub))     # [5]
```

## 집합 연산

![집합 연산](/assets/posts/dsa-set-operations.svg)

Python `set`은 수학적 집합 연산을 연산자로 제공합니다.

```python
A = {1, 2, 3, 4, 5}
B = {3, 4, 5, 6, 7}

# 합집합 — A ∪ B
print(A | B)         # {1, 2, 3, 4, 5, 6, 7}

# 교집합 — A ∩ B
print(A & B)         # {3, 4, 5}

# 차집합 — A \ B
print(A - B)         # {1, 2}

# 대칭차 — A △ B (합집합 - 교집합)
print(A ^ B)         # {1, 2, 6, 7}

# 부분집합 확인
print({3, 4} <= A)   # True
print(A >= {3, 4})   # True (A가 {3,4}를 포함)
```

## frozenset — 불변 집합

`frozenset`은 `set`과 동일하지만 불변(immutable)이라 해시 가능합니다. 딕셔너리의 키나 집합의 원소로 사용할 수 있습니다.

```python
fs = frozenset([1, 2, 3])
# fs.add(4)          # AttributeError

d = {fs: "immutable set as key"}  # 가능
s = {fs, frozenset([4, 5])}       # frozenset의 집합 가능
```

## Python set의 내부 구현

Python `set`은 `dict`와 동일한 해시 테이블 구조를 사용하되, 값(value) 슬롯이 없는 버전입니다. 부하율 2/3 초과 시 2배로 리사이징하며, 해시 충돌은 이중 해싱 기반 개방 주소법으로 처리합니다.

```python
import sys
s = set(range(10))
print(sys.getsizeof(s))   # ~736 bytes (CPython 3.12)

# 내부 capacity는 항상 2의 거듭제곱
# 10개 원소 → 내부 테이블 크기 16 (10 / 16 = 0.625 < 0.667)
```

## 알고리즘에서의 활용 패턴

**중복 제거**: `list(set(data))`

**방문 추적 (BFS/DFS)**: `visited = set()`으로 O(1) 중복 방문 체크

**교집합으로 공통 원소 찾기**:
```python
def has_common(a: list, b: list) -> bool:
    return bool(set(a) & set(b))   # O(min(|a|, |b|))
```

**두 배열의 차이 찾기**:
```python
def diff(before: list, after: list):
    b, a = set(before), set(after)
    added = a - b
    removed = b - a
    return added, removed
```

---

**지난 글:** [블룸 필터 (Bloom Filter)](/posts/dsa-bloom-filter/)

**다음 글:** [LRU 캐시 (LRU Cache)](/posts/dsa-lru-cache/)

<br>
읽어주셔서 감사합니다. 😊
