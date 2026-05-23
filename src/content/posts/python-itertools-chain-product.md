---
title: "itertools 핵심: chain, product, combinations"
description: "Python itertools 모듈의 핵심 함수들 chain, product, permutations, combinations, groupby, takewhile을 실용 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "itertools", "chain", "product", "combinations", "permutations"]
featured: false
draft: false
---

[지난 글](/posts/python-async-generator/)에서 비동기 제너레이터를 살펴봤다. 이번 글에서는 Python 표준 라이브러리의 `itertools` 모듈을 탐구한다. 이터레이터를 다루는 강력한 함수들이 모여 있어, 중첩 for 루프를 간결하게 대체하고 데이터 파이프라인을 효율적으로 구성할 수 있다.

## itertools란

`itertools` 모듈은 이터레이터를 생성하고 조합하는 함수들의 집합이다. 모든 함수가 이터레이터를 반환하므로 지연 평가가 기본이다. APL, Haskell, SML 등 함수형 언어의 영향을 받아 설계됐다.

```python
import itertools
# 또는 특정 함수만
from itertools import chain, product, combinations, permutations
```

![itertools 핵심 함수 분류](/assets/posts/python-itertools-chain-product-overview.svg)

## chain() — 이터러블 연결

여러 이터러블을 순서대로 연결한다. 리스트 `+` 연산자와 달리 메모리를 미리 할당하지 않는다.

```python
from itertools import chain

a = [1, 2, 3]
b = (4, 5)
c = range(6, 8)

result = list(chain(a, b, c))   # [1, 2, 3, 4, 5, 6, 7]
```

`chain.from_iterable()`은 중첩 이터러블을 한 단계 펼친다.

```python
nested = [[1, 2], [3, 4], [5]]
flat = list(chain.from_iterable(nested))   # [1, 2, 3, 4, 5]

# 문자열 리스트에서 문자 하나씩 꺼내기
words = ["ab", "cd", "e"]
chars = list(chain.from_iterable(words))   # ['a', 'b', 'c', 'd', 'e']
```

![chain()과 product() 사용 예제](/assets/posts/python-itertools-chain-product-code.svg)

## product() — 데카르트 곱

여러 이터러블의 데카르트 곱을 생성한다. 중첩 for 루프를 간결하게 대체한다.

```python
from itertools import product

# 2중 for 루프 대체
for i, j in product(range(3), range(2)):
    print(i, j)
# 0 0 / 0 1 / 1 0 / 1 1 / 2 0 / 2 1

# repeat 인자로 자기 자신과의 곱
bits = list(product([0, 1], repeat=3))
# [(0,0,0),(0,0,1),(0,1,0),(0,1,1),(1,0,0),(1,0,1),(1,1,0),(1,1,1)]
```

실용 예: 파라미터 그리드 탐색 (하이퍼파라미터 튜닝)

```python
learning_rates = [0.001, 0.01, 0.1]
batch_sizes = [16, 32, 64]

for lr, bs in product(learning_rates, batch_sizes):
    train_model(lr=lr, batch_size=bs)
```

## permutations() — 순열

`r`개를 선택해 순서 있는 배열을 생성한다.

```python
from itertools import permutations

letters = ['A', 'B', 'C']

# 2개 선택 순열
for p in permutations(letters, 2):
    print(p)
# ('A','B') ('A','C') ('B','A') ('B','C') ('C','A') ('C','B')

# 전체 순열 (r 생략 시)
print(len(list(permutations(range(5)))))  # 5! = 120
```

## combinations() — 조합

`r`개를 선택하되 순서를 고려하지 않는다. 요소 중복 없음.

```python
from itertools import combinations

# 로또 번호처럼 5개 중 3개 선택
for c in combinations([1, 2, 3, 4, 5], 3):
    print(c)
# (1,2,3) (1,2,4) (1,2,5) (1,3,4) (1,3,5) (1,4,5)
# (2,3,4) (2,3,5) (2,4,5) (3,4,5)

# 개수: C(5,3) = 10
```

중복 조합은 `combinations_with_replacement()`를 쓴다.

```python
from itertools import combinations_with_replacement

list(combinations_with_replacement([1, 2], 2))
# [(1,1), (1,2), (2,2)]
```

## groupby() — 연속 그룹화

연속된 동일 키를 가진 요소를 그룹화한다. **정렬된 데이터**에서 특히 유용하다.

```python
from itertools import groupby

data = [("A", 1), ("A", 2), ("B", 3), ("B", 4), ("A", 5)]

for key, group in groupby(data, key=lambda x: x[0]):
    items = list(group)
    print(key, items)
# A [('A', 1), ('A', 2)]
# B [('B', 3), ('B', 4)]
# A [('A', 5)]   ← A가 다시 나타남 (중간에 B가 있었으므로)
```

`groupby`는 SQL `GROUP BY`와 다르다. **연속된** 값만 같은 그룹으로 묶는다. 비연속 그룹을 원하면 먼저 정렬해야 한다.

```python
# 알파벳으로 정렬 후 그룹화
words = ["banana", "apple", "avocado", "blueberry", "cherry"]
words.sort()   # 반드시 정렬 먼저

for letter, group in groupby(words, key=lambda w: w[0]):
    print(letter, list(group))
# a ['apple', 'avocado']
# b ['banana', 'blueberry']
# c ['cherry']
```

## takewhile()과 dropwhile()

```python
from itertools import takewhile, dropwhile

nums = [1, 3, 5, 4, 6, 2, 8]

# 조건이 True인 동안만 yield
small = list(takewhile(lambda x: x < 5, nums))   # [1, 3]

# 조건이 처음으로 False가 된 후부터 yield
rest = list(dropwhile(lambda x: x < 5, nums))    # [5, 4, 6, 2, 8]
                                                   # ← 5부터 시작 (5>=5이므로)
```

## islice() — 이터레이터 슬라이싱

인덱스 접근이 없는 이터레이터를 슬라이싱할 수 있다.

```python
from itertools import islice

def infinite_counter():
    n = 0
    while True:
        yield n
        n += 1

first_ten = list(islice(infinite_counter(), 10))   # [0, 1, ..., 9]

# 5번째부터 10번째까지
partial = list(islice(infinite_counter(), 5, 10))  # [5, 6, 7, 8, 9]
```

무한 이터레이터를 제한할 때 특히 유용하다 (다음 글 참조).

## starmap() — 언패킹 map

`map(func, iterable)`과 유사하지만, 이터러블의 각 요소가 튜플이면 자동으로 언패킹해 함수에 전달한다.

```python
from itertools import starmap

points = [(1, 2), (3, 4), (5, 6)]

# starmap: 각 튜플을 언패킹해서 pow에 전달
results = list(starmap(pow, points))   # [1**2, 3**4, 5**6] = [1, 81, 15625]

# map으로 같은 결과
results = list(map(lambda p: pow(*p), points))
```

## 파이프라인 예제

itertools를 조합하면 복잡한 데이터 변환을 선언적으로 표현할 수 있다.

```python
from itertools import chain, islice, groupby

logs = [
    ("ERROR", "db connect failed"),
    ("INFO",  "request received"),
    ("ERROR", "timeout"),
    ("DEBUG", "cache hit"),
]

# 처음 10개 로그에서 ERROR만 추출
errors = islice(
    (msg for level, msg in logs if level == "ERROR"),
    10
)

for msg in errors:
    print(msg)
# db connect failed
# timeout
```

## 정리

| 함수 | 주요 용도 |
|------|-----------|
| `chain(*its)` | 여러 이터러블 순차 연결 |
| `chain.from_iterable(it)` | 중첩 이터러블 한 단계 펼치기 |
| `product(*its, repeat=1)` | 데카르트 곱 (중첩 for 대체) |
| `permutations(it, r)` | 순열 |
| `combinations(it, r)` | 조합 (중복 불가) |
| `groupby(it, key)` | 연속 그룹화 |
| `takewhile(pred, it)` | 조건 True 동안 yield |
| `islice(it, stop)` | 이터레이터 슬라이싱 |

다음 글에서는 `itertools`의 무한 이터레이터인 `count`, `cycle`, `repeat`와 이를 제어하는 `islice`를 더 깊이 탐구한다.

---

**지난 글:** [비동기 제너레이터: async def + yield의 결합](/posts/python-async-generator/)

**다음 글:** [무한 이터레이터: count, cycle, repeat와 islice 활용](/posts/python-infinite-iterator/)

<br>
읽어주셔서 감사합니다. 😊
