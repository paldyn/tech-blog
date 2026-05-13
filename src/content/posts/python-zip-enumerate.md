---
title: "파이썬 zip과 enumerate 완전 활용"
description: "파이썬 zip·enumerate의 동작 원리, 지연 평가 특성, zip_longest·언패킹(unzip)·다중 이터러블 조합 패턴, enumerate의 start 파라미터까지 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "zip", "enumerate", "이터러블", "병렬순회"]
featured: false
draft: false
---

[지난 글](/posts/python-generator-expression/)에서 제너레이터 표현식을 살펴봤습니다. 이번에는 파이썬 코드를 더 읽기 쉽고 인덱스 오류에서 자유롭게 해주는 `zip` 과 `enumerate` 내장 함수를 깊이 다룹니다.

## enumerate — 인덱스와 값을 함께

`enumerate` 는 이터러블의 각 원소에 순서 번호를 붙여 `(인덱스, 값)` 튜플로 반환합니다.

```python
# ✗ C 스타일 — range(len(...)) 사용
fruits = ["apple", "banana", "cherry"]
for i in range(len(fruits)):
    print(i, fruits[i])

# ✓ 파이썬스럽게 — enumerate
for i, fruit in enumerate(fruits):
    print(i, fruit)

# 시작 인덱스 변경 (1번부터)
for i, fruit in enumerate(fruits, start=1):
    print(f"{i}. {fruit}")
# 1. apple / 2. banana / 3. cherry
```

`range(len(...))` 패턴은 파이썬에서 안티패턴으로 간주됩니다. `enumerate` 를 쓰면 코드가 더 명확하고 인덱스 계산 실수가 없습니다.

![zip과 enumerate 기초](/assets/posts/python-zip-enumerate-basics.svg)

## zip — 여러 이터러블 병렬 순회

`zip` 은 여러 이터러블을 묶어 `(a0, b0)`, `(a1, b1)`, ... 형태의 튜플을 만듭니다.

```python
names = ["Alice", "Bob", "Charlie"]
scores = [85, 92, 78]
grades = ["B", "A", "C"]

# 세 리스트를 동시에 순회
for name, score, grade in zip(names, scores, grades):
    print(f"{name}: {score}점 ({grade})")
# Alice: 85점 (B) / Bob: 92점 (A) / Charlie: 78점 (C)
```

`zip` 은 **가장 짧은 이터러블** 에서 중단됩니다.

```python
a = [1, 2, 3, 4, 5]
b = ["a", "b", "c"]

list(zip(a, b))
# [(1, 'a'), (2, 'b'), (3, 'c')]  — 4, 5는 사라짐
```

## zip_longest — 긴 쪽에 맞추기

길이가 다를 때 긴 쪽에 맞추고 짧은 쪽을 채우려면 `itertools.zip_longest` 를 씁니다.

```python
from itertools import zip_longest

a = [1, 2, 3]
b = ["a", "b"]

list(zip_longest(a, b, fillvalue=None))
# [(1, 'a'), (2, 'b'), (3, None)]

list(zip_longest(a, b, fillvalue=0))
# [(1, 'a'), (2, 'b'), (3, 0)]
```

## zip으로 딕셔너리 생성

```python
keys = ["name", "age", "city"]
values = ["Kim", 30, "Seoul"]

profile = dict(zip(keys, values))
# {'name': 'Kim', 'age': 30, 'city': 'Seoul'}

# 컴프리헨션 버전
profile = {k: v for k, v in zip(keys, values)}
```

## zip(*pairs) — 언패킹(unzip)과 전치

`zip(*iterable)` 은 zip의 역방향 — 짝지어진 시퀀스를 분리합니다.

```python
pairs = [("a", 1), ("b", 2), ("c", 3)]

keys, values = zip(*pairs)
print(keys)    # ('a', 'b', 'c')
print(values)  # (1, 2, 3)

# 행렬 전치 (transpose)
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
transposed = list(zip(*matrix))
# [(1, 4, 7), (2, 5, 8), (3, 6, 9)]
```

![zip·enumerate 고급 활용](/assets/posts/python-zip-enumerate-advanced.svg)

## enumerate로 리스트 수정

인덱스 기반으로 리스트 원소를 수정할 때 `enumerate` 가 유용합니다.

```python
data = [1, -2, 3, -4, 5]

# 음수를 0으로 교체
for i, v in enumerate(data):
    if v < 0:
        data[i] = 0

print(data)  # [1, 0, 3, 0, 5]
```

## zip + enumerate 조합

```python
heights = [178, 165, 182]
weights = [70, 55, 80]

for i, (h, w) in enumerate(zip(heights, weights), start=1):
    bmi = w / (h / 100) ** 2
    print(f"#{i}: BMI={bmi:.1f}")

# #1: BMI=22.1
# #2: BMI=20.2
# #3: BMI=24.2
```

`enumerate(zip(...))` 에서 내부 튜플을 `(h, w)` 로 즉시 언패킹하는 점에 주의합니다.

## 슬라이딩 윈도우 — zip(lst, lst[1:])

```python
data = [1, 3, 6, 10, 15]

# 인접 원소 쌍 — (이전, 현재)
diffs = [b - a for a, b in zip(data, data[1:])]
# [2, 3, 4, 5]

# N-gram 스타일
def ngrams(seq, n):
    return list(zip(*[seq[i:] for i in range(n)]))

ngrams([1, 2, 3, 4, 5], 2)
# [(1,2),(2,3),(3,4),(4,5)]

ngrams([1, 2, 3, 4, 5], 3)
# [(1,2,3),(2,3,4),(3,4,5)]
```

## 두 리스트 비교

```python
actual = [1, 2, 3, 4, 5]
expected = [1, 2, 0, 4, 5]

mismatches = [(i, a, e)
              for i, (a, e) in enumerate(zip(actual, expected))
              if a != e]
# [(2, 3, 0)]  — 인덱스 2에서 3이어야 하는데 0
```

## 성능 특성

`zip` 과 `enumerate` 모두 **지연 평가 이터레이터**를 반환합니다. `list()` 로 감싸지 않으면 즉시 값이 생성되지 않습니다.

```python
z = zip(range(1_000_000), range(1_000_000))
import sys
sys.getsizeof(z)  # 매우 작음 — 이터레이터 껍데기만
```

## 핵심 정리

- `enumerate(iterable, start=0)` — `(인덱스, 값)` 쌍 반환, `range(len(...))` 대체
- `zip(a, b, ...)` — 여러 이터러블 병렬 순회, 짧은 쪽에서 중단
- `zip_longest` — 긴 쪽 기준, `fillvalue` 로 빈 자리 채움
- `zip(*pairs)` — 언패킹(unzip), 행렬 전치에 활용
- `zip(lst, lst[1:])` — 슬라이딩 윈도우 패턴
- 둘 다 지연 평가 이터레이터 — 메모리 효율적

---

**지난 글:** [파이썬 제너레이터 표현식과 지연 평가](/posts/python-generator-expression/)

<br>
읽어주셔서 감사합니다. 😊
