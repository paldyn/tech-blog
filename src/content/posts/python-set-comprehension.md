---
title: "파이썬 집합 컴프리헨션과 frozenset"
description: "파이썬 집합 컴프리헨션의 문법, 중복 제거 동작, 집합 연산(교집합·합집합·차집합), frozenset의 불변성과 해시 가능성을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "집합컴프리헨션", "set", "frozenset", "중복제거"]
featured: false
draft: false
---

[지난 글](/posts/python-dict-comprehension/)에서 딕셔너리 컴프리헨션을 살펴봤습니다. 이번에는 컴프리헨션 삼총사의 마지막인 **집합 컴프리헨션(set comprehension)** 과 불변 집합 `frozenset` 을 다룹니다.

## 집합 컴프리헨션 문법

```
{표현식 for 변수 in 이터러블 if 조건}
```

딕셔너리 컴프리헨션과 동일하게 `{}` 를 쓰지만, `키: 값` 구분자가 없습니다. 결과는 `set` 타입으로 **중복이 자동으로 제거**되고, **순서가 보장되지 않습니다.**

```python
data = [1, 2, 2, 3, 3, 3, 4]
unique_squares = {x**2 for x in data}
# {1, 4, 9, 16}  — 중복 제거, 순서 없음
```

![집합 컴프리헨션 문법](/assets/posts/python-set-comprehension-syntax.svg)

## 빈 집합 주의

```python
empty_set = set()      # ✓ 빈 집합
empty_dict = {}        # ← 빈 딕셔너리! 집합이 아님

type(set())  # <class 'set'>
type({})     # <class 'dict'>
```

집합 컴프리헨션은 `{x for x in []}` 으로 빈 집합을 만들 수 있지만, 리터럴로는 `set()` 을 써야 합니다.

## 중복 제거 패턴

리스트에서 고유 값만 추출할 때 집합 컴프리헨션이나 `set()` 변환을 씁니다.

```python
# 방법 1 — 집합 컴프리헨션 (변환 로직 추가 가능)
words = ["Hello", "world", "hello", "WORLD"]
unique_lower = {w.lower() for w in words}
# {'hello', 'world'}

# 방법 2 — set() 직접 변환 (변환 없이 단순 중복 제거)
nums = [1, 2, 2, 3, 3, 3]
unique = set(nums)
# {1, 2, 3}

# 순서를 유지하면서 중복 제거 (Python 3.7+, dict는 삽입 순서 보장)
nums = [3, 1, 2, 1, 3, 2]
unique_ordered = list(dict.fromkeys(nums))
# [3, 1, 2]
```

## 실전: 고유 도메인 추출

```python
emails = [
    "alice@example.com",
    "bob@gmail.com",
    "charlie@example.com",
    "diana@yahoo.com",
    "eve@gmail.com",
]

domains = {email.split("@")[1] for email in emails}
# {'example.com', 'gmail.com', 'yahoo.com'}

# 특정 도메인 필터
internal = {e.split("@")[1] for e in emails if e.endswith("@example.com")}
# {'example.com'}
```

## 집합 연산과 컴프리헨션 조합

![집합 연산과 frozenset](/assets/posts/python-set-comprehension-ops.svg)

```python
# 두 문서에서 공통 단어 찾기
doc1 = "the quick brown fox"
doc2 = "the slow brown dog"

words1 = {w.lower() for w in doc1.split()}
words2 = {w.lower() for w in doc2.split()}

common = words1 & words2          # {'the', 'brown'}
only_in_doc1 = words1 - words2    # {'quick', 'fox'}
all_words = words1 | words2       # {'the', 'quick', 'brown', 'fox', 'slow', 'dog'}
exclusive = words1 ^ words2       # {'quick', 'fox', 'slow', 'dog'}
```

집합 연산은 리스트 검색(`in`) 대비 훨씬 빠른 O(1) 멤버십 체크를 제공합니다.

## 멤버십 체크 성능

```python
import timeit

large_list = list(range(100_000))
large_set = set(large_list)

# 리스트: O(n)
timeit.timeit(lambda: 99_999 in large_list, number=1000)

# 집합: O(1)
timeit.timeit(lambda: 99_999 in large_set, number=1000)
# 집합이 수십~수백 배 빠름
```

자주 멤버십 체크를 해야 하는 데이터는 집합으로 변환하는 것이 성능상 유리합니다.

## frozenset — 불변 집합

`frozenset` 은 `set` 과 동일하지만 변경이 불가능합니다. 해시 가능(hashable)하므로 딕셔너리 키나 다른 집합의 원소로 사용할 수 있습니다.

```python
# frozenset 생성
fs = frozenset([1, 2, 3])
fs2 = frozenset({4, 5, 6})

# 집합 연산 지원
fs | fs2    # frozenset({1, 2, 3, 4, 5, 6})
fs & fs2    # frozenset()

# 딕셔너리 키로 사용
cache = {}
key = frozenset({"a", "b", "c"})
cache[key] = "group-abc"

# set은 unhashable이라 키로 사용 불가
# {{"a", "b"}: "value"}  → TypeError
```

### frozenset 활용 — 그룹 캐싱

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def process_group(items: frozenset) -> int:
    return sum(items)

# frozenset을 인자로 넘겨야 캐시 키로 사용 가능
process_group(frozenset([1, 2, 3]))  # 6
process_group(frozenset([1, 2, 3]))  # 캐시 히트
```

## 집합 컴프리헨션 vs set(리스트 컴프리헨션)

```python
nums = range(10)

# 동등하지만 집합 컴프리헨션이 더 효율적
{x**2 for x in nums}           # ✓ 집합 컴프리헨션
set([x**2 for x in nums])      # 리스트 먼저 만들고 집합으로 변환 — 메모리 낭비
set(x**2 for x in nums)        # 제너레이터 표현식 + set() — 메모리 효율적, 동등
```

## 핵심 정리

- `{표현식 for ... in ... if ...}` — set 반환, 중복 자동 제거, 순서 없음
- 빈 집합은 `set()` — `{}` 는 빈 딕셔너리
- 고유 값 추출·중복 제거·집합 연산에 최적
- 멤버십 체크는 집합이 O(1) — 리스트는 O(n)
- `frozenset` 은 불변·해시 가능 — 딕셔너리 키, `lru_cache` 인자로 활용

---

**지난 글:** [파이썬 딕셔너리 컴프리헨션](/posts/python-dict-comprehension/)

**다음 글:** [파이썬 제너레이터 표현식과 지연 평가](/posts/python-generator-expression/)

<br>
읽어주셔서 감사합니다. 😊
