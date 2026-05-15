---
title: "파이썬 제너레이터 표현식과 지연 평가"
description: "파이썬 제너레이터 표현식의 문법, 리스트 컴프리헨션과의 메모리 차이, 파이프라인 패턴, any/all/sum과의 조합, 한 번만 순회 가능한 특성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "제너레이터", "지연평가", "generator", "메모리최적화"]
featured: false
draft: false
---

[지난 글](/posts/python-set-comprehension/)에서 집합 컴프리헨션을 살펴봤습니다. 이번에는 컴프리헨션 계열의 마지막이자 메모리 효율의 핵심인 **제너레이터 표현식(generator expression)** 을 다룹니다.

## 문법 — 괄호 하나의 차이

```python
# 리스트 컴프리헨션 — [] → list 즉시 생성
squares_list = [x**2 for x in range(10)]
type(squares_list)  # <class 'list'>

# 제너레이터 표현식 — () → generator 객체 반환 (지연)
squares_gen = (x**2 for x in range(10))
type(squares_gen)   # <class 'generator'>
```

`[]` 를 `()` 로 바꾸기만 하면 됩니다. 그러나 동작이 근본적으로 다릅니다.

![제너레이터 표현식과 지연 평가](/assets/posts/python-generator-expression-lazy.svg)

## 즉시 평가 vs 지연 평가

리스트 컴프리헨션은 **즉시(eager) 평가** — 생성 시점에 모든 값을 계산해 메모리에 적재합니다.

제너레이터 표현식은 **지연(lazy) 평가** — 생성 시점에는 껍데기만 만들고, `next()` 가 호출될 때마다 한 값씩 계산합니다.

```python
import sys

lst = [x**2 for x in range(1_000_000)]
gen = (x**2 for x in range(1_000_000))

sys.getsizeof(lst)  # ~8 MB
sys.getsizeof(gen)  # ~120 bytes — 크기와 무관하게 상수

# 제너레이터에서 값 꺼내기
next(gen)   # 0
next(gen)   # 1
next(gen)   # 4
```

## 한 번만 순회 가능

제너레이터는 소비된 값을 기억하지 않습니다. 끝까지 순회하면 다시 처음으로 돌아갈 수 없습니다.

```python
gen = (x for x in range(5))
list(gen)   # [0, 1, 2, 3, 4]
list(gen)   # []  — 이미 소진됨

# 재사용이 필요하면 list로 변환해 저장
data = list(x**2 for x in range(5))  # [0, 1, 4, 9, 16]
```

## 내장 함수와 조합

제너레이터 표현식은 `sum`, `min`, `max`, `any`, `all` 등과 조합하면 매우 강력합니다. 함수 호출의 유일한 인자라면 괄호를 추가로 쓰지 않아도 됩니다.

```python
# sum
total = sum(x**2 for x in range(100))  # 328350

# max
longest = max(len(word) for word in ["cat", "elephant", "ox"])  # 8

# any / all — 단락 평가 (short-circuit)
nums = [2, 4, 6, 7, 8]
any(x % 2 != 0 for x in nums)  # True  — 7 발견 즉시 중단
all(x > 0 for x in nums)        # True  — 모두 확인

# join
words = ["hello", "world"]
sentence = " ".join(w.capitalize() for w in words)
# 'Hello World'
```

`any` 와 `all` 은 단락 평가(short-circuit)를 적용합니다. `any` 는 `True` 를 찾으면 즉시 중단, `all` 은 `False` 를 찾으면 즉시 중단합니다. 리스트 컴프리헨션이었다면 모든 원소를 먼저 계산한 후 판단합니다.

## 제너레이터 파이프라인

여러 제너레이터 표현식을 체이닝하면 **데이터 파이프라인**을 구성할 수 있습니다. 각 단계는 지연 평가되므로 전체 데이터를 메모리에 올리지 않습니다.

![제너레이터 표현식 파이프라인](/assets/posts/python-generator-expression-pipeline.svg)

```python
# 대용량 CSV 처리 — 파일 전체를 메모리에 올리지 않음
with open("huge_data.csv") as f:
    lines   = (line.strip() for line in f)
    records = (line.split(",") for line in lines if line)
    numbers = (float(rec[2]) for rec in records if len(rec) >= 3)
    result  = sum(numbers)
```

각 단계는 다음 단계가 요청할 때만 계산합니다. `result = sum(numbers)` 가 실행되면서 거꾸로 요청이 전파됩니다.

## 조건 표현식 활용

```python
data = [10, -5, 0, 3, -2, 8]

# 양수만 제곱 — 필터
pos_squares = sum(x**2 for x in data if x > 0)
# 10²+3²+8² = 173

# 양수는 제곱, 나머지는 0 — 조건 변환
mapped = list(x**2 if x > 0 else 0 for x in data)
# [100, 0, 0, 9, 0, 64]
```

## 언제 리스트 vs 제너레이터를 쓸까

| 상황 | 추천 |
|---|---|
| 여러 번 순회 필요 | `list` |
| 인덱스 접근 필요 | `list` |
| 한 번만 순회 | generator |
| 메모리가 중요 | generator |
| `sum`, `max`, `any` 인자 | generator |
| 파이프라인 구성 | generator |

## 제너레이터 표현식 vs 제너레이터 함수

```python
# 제너레이터 표현식 — 단순 변환·필터에 적합
gen_expr = (x**2 for x in range(10))

# 제너레이터 함수 — 복잡한 로직, 상태 관리에 적합
def gen_func():
    for x in range(10):
        if x % 2 == 0:
            yield x**2
```

제너레이터 표현식이 충분하다면 간결한 표현식을 선택합니다. 복잡한 분기·루프·상태 관리가 필요하면 `yield` 를 사용하는 제너레이터 함수를 씁니다.

## 핵심 정리

- `(표현식 for ... in ... if ...)` — 지연 평가 generator 객체 반환
- 메모리는 O(1) — 시퀀스 크기와 무관하게 상수
- 한 번만 순회 가능 — 재사용이 필요하면 `list()` 변환
- `sum`, `any`, `all`, `max` 등 내장 함수와 찰떡 조합
- 제너레이터 체이닝으로 메모리 효율적인 데이터 파이프라인 구성

---

**지난 글:** [파이썬 집합 컴프리헨션과 frozenset](/posts/python-set-comprehension/)

**다음 글:** [파이썬 zip과 enumerate 완전 활용](/posts/python-zip-enumerate/)

<br>
읽어주셔서 감사합니다. 😊
