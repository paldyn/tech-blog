---
title: "map·filter·reduce 완전 이해"
description: "Python의 map(), filter(), reduce() 함수를 원리부터 실전 패턴까지 완전히 이해하고, 리스트 컴프리헨션과의 차이점도 짚어봅니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["python", "map", "filter", "reduce", "함수형 프로그래밍", "이터레이터"]
featured: false
draft: false
---

[지난 글](/posts/python-zip-enumerate/)에서 `zip()`과 `enumerate()`로 여러 이터러블을 동시에 순회하는 법을 살펴봤습니다. 이번에는 Python 함수형 프로그래밍의 세 가지 핵심인 `map()`, `filter()`, `reduce()`를 깊이 파헤쳐 봅니다. 세 함수 모두 "컬렉션 → 변환/필터/집계"라는 패턴을 일관되게 표현하며, 동작 방식을 이해하면 데이터 파이프라인 코드를 훨씬 간결하게 작성할 수 있습니다.

## map() — 각 요소에 함수 적용

`map(func, iterable)`은 이터러블의 **각 요소에 함수를 적용**한 결과를 이터레이터로 반환합니다.

```python
nums = [1, 2, 3, 4, 5]

# lambda로 즉석 함수 정의
squared = list(map(lambda x: x ** 2, nums))
print(squared)  # [1, 4, 9, 16, 25]

# 이미 정의된 함수도 그대로 전달
print(list(map(str, nums)))   # ['1', '2', '3', '4', '5']
print(list(map(abs, [-3, 1, -2])))  # [3, 1, 2]
```

여러 이터러블을 병렬로 처리하는 것도 가능합니다.

```python
a = [1, 2, 3]
b = [10, 20, 30]

result = list(map(lambda x, y: x + y, a, b))
print(result)  # [11, 22, 33]
```

![map·filter·reduce 처리 흐름](/assets/posts/python-map-filter-reduce-flow.svg)

## filter() — 조건을 통과한 요소만 추출

`filter(func, iterable)`은 함수가 `True`를 반환하는 요소만 남긴 이터레이터를 반환합니다.

```python
nums = [1, 2, 3, 4, 5, 6]

evens = list(filter(lambda x: x % 2 == 0, nums))
print(evens)  # [2, 4, 6]

# func 자리에 None을 넣으면 falsy 값 제거
words = ["hi", "", "bye", None, "ok", ""]
non_empty = list(filter(None, words))
print(non_empty)  # ['hi', 'bye', 'ok']
```

`filter(None, iterable)`은 빈 문자열·`None`·0 같은 **falsy 값을 한 번에 제거**하는 관용 패턴입니다.

## reduce() — 값을 누적해 단일 결과로

`reduce()`는 `functools` 모듈에 있습니다. `reduce(func, iterable[, initializer])`는 앞에서부터 두 원소씩 누산해 최종 단일 값을 만듭니다.

```python
from functools import reduce

nums = [1, 2, 3, 4, 5]

total = reduce(lambda acc, x: acc + x, nums)
print(total)  # 15

product = reduce(lambda acc, x: acc * x, nums)
print(product)  # 120

# 초깃값(initializer)을 제공하면 빈 시퀀스도 안전
total = reduce(lambda a, b: a + b, [], 0)
print(total)  # 0
```

초깃값 없이 빈 시퀀스를 넘기면 `TypeError`가 발생하므로, 입력이 비어있을 수 있다면 초깃값을 꼭 지정하세요.

![map·filter·reduce 코드 예제](/assets/posts/python-map-filter-reduce-code.svg)

## map/filter vs 리스트 컴프리헨션

Python 커뮤니티에서는 가독성이 더 나은 **리스트 컴프리헨션** 사용을 선호하는 경향이 있습니다.

```python
nums = [1, 2, 3, 4, 5]

# map + lambda → 컴프리헨션이 더 명확
squared_map  = list(map(lambda x: x ** 2, nums))
squared_comp = [x ** 2 for x in nums]

# filter + lambda → 컴프리헨션으로
evens_filter = list(filter(lambda x: x % 2 == 0, nums))
evens_comp   = [x for x in nums if x % 2 == 0]
```

- **기명 함수를 재사용**하거나 **여러 이터러블을 병렬 처리**할 때는 `map()`이 깔끔합니다.
- **lambda를 인라인으로 써야 하는 상황**이라면 컴프리헨션이 대부분 더 읽기 좋습니다.
- `reduce()`는 `sum()`, `max()`, `min()`처럼 **전용 내장 함수가 있는 연산엔 대체**하고, 복잡한 누산 로직에만 사용하세요.

## 이터레이터 반환이라는 핵심 특성

`map()`과 `filter()`는 **이터레이터**를 반환합니다. 리스트가 아닙니다.

```python
m = map(str, [1, 2, 3])
print(type(m))   # <class 'map'>
print(next(m))   # '1'
print(next(m))   # '2'

# 한 번 소진하면 재사용 불가
print(list(m))   # ['3']
print(list(m))   # []  ← 이미 소진됨
```

큰 데이터셋을 처리할 때는 이 지연 평가(lazy evaluation) 덕분에 메모리를 아낄 수 있습니다. 단, **여러 번 순회해야 한다면 `list()`로 먼저 구체화**해야 합니다.

---

**지난 글:** [zip·enumerate로 여러 이터러블 동시 순회](/posts/python-zip-enumerate/)

**다음 글:** [sorted vs sort: 정렬 함수 완벽 비교](/posts/python-sorted-vs-sort/)

<br>
읽어주셔서 감사합니다. 😊
