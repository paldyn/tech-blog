---
title: "sorted vs sort: 정렬 함수 완벽 비교"
description: "Python의 sorted()와 list.sort()를 비교하고, key 매개변수를 활용한 다양한 정렬 패턴을 배웁니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["python", "sorted", "sort", "정렬", "Timsort", "key"]
featured: false
draft: false
---

[지난 글](/posts/python-map-filter-reduce/)에서 `map()`, `filter()`, `reduce()`를 통해 컬렉션을 변환하는 방법을 익혔습니다. 이번에는 Python에서 데이터를 정렬하는 두 가지 방법인 내장 함수 `sorted()`와 리스트 메서드 `list.sort()`를 비교하고, `key` 매개변수로 복잡한 정렬 기준을 표현하는 패턴까지 살펴봅니다.

## sorted() vs list.sort() — 가장 큰 차이는 원본 보존

가장 중요한 차이는 **원본을 수정하느냐**입니다.

```python
original = [3, 1, 4, 1, 5, 9]

# sorted(): 새 리스트 반환, 원본 불변
new_list = sorted(original)
print(new_list)   # [1, 1, 3, 4, 5, 9]
print(original)   # [3, 1, 4, 1, 5, 9]  ← 그대로

# list.sort(): 원본을 제자리 정렬, None 반환
original.sort()
print(original)   # [1, 1, 3, 4, 5, 9]  ← 변경됨
```

`list.sort()`는 **`None`을 반환**합니다. `result = my_list.sort()` 형태로 결과를 담으면 `result`는 `None`이 됩니다. 이 실수가 매우 흔하니 주의하세요.

![sorted vs sort 핵심 차이](/assets/posts/python-sorted-vs-sort-compare.svg)

## sorted()는 모든 이터러블에 사용 가능

`sorted()`는 리스트가 아닌 이터러블도 받아서 항상 **리스트**로 반환합니다.

```python
# 튜플 정렬 → 리스트 반환
t = (3, 1, 2)
print(sorted(t))         # [1, 2, 3]

# 딕셔너리 키 정렬
d = {"banana": 2, "apple": 5, "kiwi": 1}
print(sorted(d))         # ['apple', 'banana', 'kiwi']
print(sorted(d.values())) # [1, 2, 5]

# 문자열의 문자 정렬
print(sorted("python"))  # ['h', 'n', 'o', 'p', 't', 'y']
```

## key 매개변수 — 정렬 기준 커스터마이징

`key`에는 각 요소를 비교 가능한 값으로 변환하는 함수를 넘깁니다. 원본 값을 바꾸지 않고 **정렬 기준만** 지정합니다.

```python
words = ["banana", "apple", "kiwi", "fig"]

# 길이 기준
print(sorted(words, key=len))
# ['fig', 'kiwi', 'apple', 'banana']

# 대소문자 무시 알파벳 정렬
names = ["Bob", "alice", "Charlie", "dave"]
print(sorted(names, key=str.lower))
# ['alice', 'Bob', 'Charlie', 'dave']

# 역순: reverse=True
print(sorted(words, key=len, reverse=True))
# ['banana', 'apple', 'kiwi', 'fig']
```

## 딕셔너리·객체 정렬 — operator 모듈

`operator.itemgetter`와 `operator.attrgetter`를 사용하면 `lambda` 없이 명확하게 키를 지정할 수 있습니다.

```python
from operator import itemgetter, attrgetter

# 딕셔너리 리스트 정렬
people = [
    {"name": "Bob",   "age": 30},
    {"name": "Alice", "age": 25},
    {"name": "Carol", "age": 30},
]

# age 오름차순
by_age = sorted(people, key=itemgetter("age"))

# age 오름차순, 동일 age이면 name 오름차순 (다중 키)
by_age_name = sorted(people, key=itemgetter("age", "name"))
```

![key 매개변수 활용 패턴](/assets/posts/python-sorted-vs-sort-key.svg)

## 안정 정렬(Stable Sort) 활용

Python의 정렬은 **안정 정렬(stable sort)**이므로, 키 값이 같은 요소들은 원래 순서가 유지됩니다. 이를 이용해 다단계 정렬을 순서대로 적용할 수 있습니다.

```python
# 먼저 name으로 정렬한 뒤 age로 정렬
# → 최종적으로 age 오름차순, 동일 age면 name 오름차순
data = [
    {"name": "Carol", "age": 30},
    {"name": "Alice", "age": 25},
    {"name": "Bob",   "age": 30},
]

step1 = sorted(data, key=itemgetter("name"))  # name 정렬 먼저
step2 = sorted(step1, key=itemgetter("age"))  # 안정 정렬로 name 유지
# → Alice(25), Bob(30), Carol(30)
```

단, 한 번에 `itemgetter("age", "name")`으로 처리하는 편이 더 효율적입니다.

## 정리

| 비교 항목 | `sorted()` | `list.sort()` |
|---|---|---|
| 반환값 | 새 리스트 | `None` |
| 원본 변경 | 없음 | 있음 |
| 적용 대상 | 모든 이터러블 | 리스트만 |
| 메모리 | 복사본 생성 | 제자리 처리 |

원본을 보존해야 하거나 표현식 안에서 쓴다면 `sorted()`, 큰 리스트를 메모리 효율적으로 정렬한다면 `.sort()`를 선택하세요. 둘 다 Timsort 알고리즘(O(n log n))을 사용합니다.

---

**지난 글:** [map·filter·reduce 완전 이해](/posts/python-map-filter-reduce/)

**다음 글:** [collections.deque: 양방향 큐의 모든 것](/posts/python-collections-deque/)

<br>
읽어주셔서 감사합니다. 😊
