---
title: "itertools 기초: 조합형 이터레이터 완벽 활용"
description: "Python itertools 모듈의 핵심 함수를 정리합니다. count, cycle, repeat, chain, islice, takewhile, dropwhile, groupby, combinations, permutations, product, accumulate, starmap 등 이터레이터 조합 도구의 원리와 실전 활용 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "itertools", "이터레이터", "조합", "순열", "chain", "groupby", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-time-vs-datetime/)에서 `time` 모듈과 `datetime` 모듈의 차이를 살펴봤습니다. 이번 글에서는 이터레이터를 조합하고 변환하는 강력한 표준 라이브러리 `itertools`를 체계적으로 정리합니다. `itertools`는 메모리를 아끼면서 대용량 데이터를 처리하거나, 조합론 문제를 단 한 줄로 해결할 때 핵심 도구가 됩니다.

## itertools란?

`itertools`는 이터레이터를 조합·변환·생성하는 함수들의 모음입니다. 모든 함수는 **지연 평가(lazy evaluation)** 방식으로 동작하여, 필요할 때만 값을 생성합니다. 이 덕분에 수십억 개의 조합을 생성해도 메모리를 거의 사용하지 않습니다.

```python
import itertools
# 또는 자주 쓰는 것만 임포트
from itertools import chain, islice, combinations, groupby
```

![itertools 모듈 개요](/assets/posts/python-itertools-basics-overview.svg)

## 무한 이터레이터

무한 이터레이터는 끝없이 값을 생성합니다. `islice()`로 잘라 쓰는 것이 기본 패턴입니다.

```python
from itertools import count, cycle, repeat, islice

# count(start, step) — 등차수열
list(islice(count(0, 2), 5))   # [0, 2, 4, 6, 8]

# cycle(iterable) — 순환 반복
colors = cycle(['빨', '초', '파'])
list(islice(colors, 7))        # ['빨', '초', '파', '빨', '초', '파', '빨']

# repeat(elem, n) — 같은 값 반복
list(repeat('X', 4))           # ['X', 'X', 'X', 'X']
```

`count()`는 `zip()`과 조합하면 `enumerate()` 대체제로도 씁니다.

```python
words = ['apple', 'banana', 'cherry']
list(zip(count(10), words))
# [(10, 'apple'), (11, 'banana'), (12, 'cherry')]
```

## 유한 이터레이터

### chain — 여러 이터러블 연결

```python
from itertools import chain

result = list(chain([1, 2], [3, 4], [5]))
# [1, 2, 3, 4, 5]

# 리스트의 리스트를 평탄화할 때
nested = [[1, 2], [3, 4], [5, 6]]
flat = list(chain.from_iterable(nested))
# [1, 2, 3, 4, 5, 6]
```

`chain.from_iterable()`은 중첩 리스트를 1단계 평탄화하는 빠른 방법입니다.

### islice — 슬라이싱

```python
from itertools import islice

# islice(iterable, stop)
# islice(iterable, start, stop[, step])
data = range(100)
list(islice(data, 5, 15, 2))   # [5, 7, 9, 11, 13]
```

일반 슬라이싱은 시퀀스에만 쓸 수 있지만, `islice()`는 제너레이터처럼 슬라이싱을 지원하지 않는 이터레이터에도 쓸 수 있습니다.

### takewhile / dropwhile

```python
from itertools import takewhile, dropwhile

data = [1, 3, 5, 2, 8, 4]

# 조건이 True인 동안만 가져오기
list(takewhile(lambda x: x < 4, data))   # [1, 3]

# 조건이 True인 동안 건너뛰기
list(dropwhile(lambda x: x < 4, data))  # [5, 2, 8, 4]
```

중요한 점: 조건이 처음 `False`가 되는 순간 동작이 결정됩니다. 뒤에 조건을 다시 만족하는 요소가 있어도 영향을 주지 않습니다.

### filterfalse / compress

```python
from itertools import filterfalse, compress

# filterfalse — filter의 반대
list(filterfalse(lambda x: x % 2, range(10)))
# [0, 2, 4, 6, 8]

# compress — 마스크 배열로 필터링
list(compress('ABCDE', [1, 0, 1, 0, 1]))
# ['A', 'C', 'E']
```

### groupby — 그룹화

```python
from itertools import groupby

# 주의: groupby는 정렬된 데이터에서만 정확히 동작합니다
data = [
    {'dept': 'dev', 'name': '김개발'},
    {'dept': 'dev', 'name': '이코딩'},
    {'dept': 'qa', 'name': '박테스트'},
]
data.sort(key=lambda x: x['dept'])

for dept, members in groupby(data, key=lambda x: x['dept']):
    print(dept, list(members))
# dev [{'dept': 'dev', 'name': '김개발'}, ...]
# qa  [{'dept': 'qa', 'name': '박테스트'}]
```

**정렬 없이 쓰면 같은 키가 흩어져 있을 때 별도 그룹으로 처리됩니다.** 항상 `sort(key=...)`를 먼저 하세요.

## 조합형 이터레이터

### product — 데카르트 곱

```python
from itertools import product

# 중첩 for 루프 대체
for x, y in product([1, 2], ['a', 'b']):
    print(x, y)
# 1 a / 1 b / 2 a / 2 b

# repeat로 같은 이터러블 반복
list(product('AB', repeat=2))
# [('A','A'), ('A','B'), ('B','A'), ('B','B')]
```

### permutations / combinations

```python
from itertools import permutations, combinations, combinations_with_replacement

items = 'ABC'

# 순열 (순서 고려, 중복 없음)
list(permutations(items, 2))
# [('A','B'), ('A','C'), ('B','A'), ('B','C'), ('C','A'), ('C','B')]

# 조합 (순서 무관, 중복 없음)
list(combinations(items, 2))
# [('A','B'), ('A','C'), ('B','C')]

# 중복 조합
list(combinations_with_replacement('AB', 2))
# [('A','A'), ('A','B'), ('B','B')]
```

## accumulate와 starmap

```python
from itertools import accumulate, starmap
import operator

# accumulate — 누적 집계
list(accumulate([1, 2, 3, 4]))                        # 누적합 [1, 3, 6, 10]
list(accumulate([1, 2, 3, 4], operator.mul))           # 누적곱 [1, 2, 6, 24]
list(accumulate([3, 1, 4, 1, 5], max))                 # 누적 최대값 [3, 3, 4, 4, 5]

# starmap — 인자 목록을 언팩해 함수 적용
pts = [(2, 5), (3, 2), (10, 3)]
list(starmap(pow, pts))   # [32, 9, 1000]
```

`accumulate()`는 3.8부터 `initial` 파라미터가 추가되어 초깃값도 지정 가능합니다.

![itertools 코드 예제](/assets/posts/python-itertools-basics-code.svg)

## 실전 패턴: 슬라이딩 윈도우

표준 라이브러리에는 `sliding_window()`가 없지만, `itertools`로 쉽게 만들 수 있습니다.

```python
from itertools import islice

def sliding_window(iterable, n):
    it = iter(iterable)
    window = list(islice(it, n))
    if len(window) == n:
        yield tuple(window)
    for item in it:
        window.append(item)
        window.pop(0)
        yield tuple(window)

list(sliding_window([1, 2, 3, 4, 5], 3))
# [(1,2,3), (2,3,4), (3,4,5)]
```

Python 3.12부터는 `itertools.batched()`가 추가되어 고정 크기 배치로 분할할 수 있습니다.

```python
# Python 3.12+
from itertools import batched
list(batched('ABCDEFG', 3))
# [('A','B','C'), ('D','E','F'), ('G',)]
```

## 성능 특성

`itertools` 함수는 C로 구현된 내장 함수이므로 Python 루프보다 빠릅니다. 특히 대용량 이터레이터를 다룰 때 차이가 큽니다.

```python
import timeit

# 리스트 컴프리헨션 vs chain.from_iterable
nested = [[i] * 10 for i in range(1000)]

t1 = timeit.timeit(lambda: [x for sub in nested for x in sub], number=1000)
t2 = timeit.timeit(lambda: list(chain.from_iterable(nested)), number=1000)
# chain.from_iterable이 보통 20~40% 빠름
```

---

**지난 글:** [time 모듈 vs datetime: 언제 무엇을 쓸까](/posts/python-time-vs-datetime/)

**다음 글:** [functools.lru_cache: 메모이제이션 캐싱](/posts/python-functools-lru-cache/)

<br>
읽어주셔서 감사합니다. 😊
