---
title: "파이썬 리스트 컴프리헨션 완전 정복"
description: "파이썬 리스트 컴프리헨션의 문법 구조, 필터·중첩·조건 표현식 패턴, 성능 비교, 바다코끼리 연산자 활용까지 실전 예제로 총정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "리스트컴프리헨션", "comprehension", "파이썬스럽게", "최적화"]
featured: false
draft: false
---

[지난 글](/posts/python-pure-vs-impure/)에서 순수 함수와 부수 효과를 다뤘습니다. 이번에는 파이썬에서 리스트를 만드는 가장 관용적인 방법인 **리스트 컴프리헨션(list comprehension)** 을 깊이 다룹니다.

## 기본 구조

```
[표현식 for 변수 in 이터러블 if 조건]
```

네 부분으로 이루어집니다.

1. **표현식** — 새 리스트에 담길 값
2. **for 변수 in** — 루프 변수와 이터러블
3. **if 조건** — (선택) 조건을 만족한 원소만 포함

```python
# 0~9 중 짝수의 제곱
result = [x**2 for x in range(10) if x % 2 == 0]
# [0, 4, 16, 36, 64]
```

![리스트 컴프리헨션 해부](/assets/posts/python-list-comprehension-anatomy.svg)

## for 루프와 비교

```python
# for 루프 방식 — 가변 상태 필요
squares = []
for x in range(10):
    if x % 2 == 0:
        squares.append(x**2)

# 컴프리헨션 — 선언적, 가변 상태 없음
squares = [x**2 for x in range(10) if x % 2 == 0]
```

컴프리헨션은 내부적으로 `BUILD_LIST` 바이트코드를 사용하므로 일반 `append` 루프보다 보통 15~20% 빠릅니다. 하지만 **가독성이 우선** 입니다. 복잡한 로직은 루프가 낫습니다.

## 조건이 없는 단순 변환

```python
# 문자열 변환
names = ["alice", "bob", "charlie"]
upper = [name.upper() for name in names]
# ['ALICE', 'BOB', 'CHARLIE']

# 타입 변환
str_nums = ["1", "2", "3"]
nums = [int(s) for s in str_nums]
# [1, 2, 3]

# 메서드 체이닝
lines = ["  hello  ", "\tworld\n"]
cleaned = [line.strip() for line in lines]
# ['hello', 'world']
```

## 표현식 부분에 조건식

`if/else` 를 **표현식 부분**에 쓰면 필터가 아닌 값 변환 분기가 됩니다.

```python
# if가 for 뒤에 있으면 필터
evens = [x for x in range(10) if x % 2 == 0]
# [0, 2, 4, 6, 8]

# if/else가 표현식 앞에 있으면 조건 변환 (모두 포함)
signs = ["pos" if x > 0 else "neg" if x < 0 else "zero"
         for x in [-2, 0, 3, -1, 5]]
# ['neg', 'zero', 'pos', 'neg', 'pos']
```

## 중첩 컴프리헨션

```python
# 행렬 평탄화
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [x for row in matrix for x in row]
# [1, 2, 3, 4, 5, 6, 7, 8, 9]

# 주의: for의 순서는 중첩 루프와 동일
# for row in matrix:
#     for x in row:
#         flat.append(x)

# 행렬 전치 (transpose)
transposed = [[row[i] for row in matrix] for i in range(3)]
# [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
```

![리스트 컴프리헨션 패턴](/assets/posts/python-list-comprehension-patterns.svg)

## 카르테시안 곱 (데카르트 곱)

```python
suits = ["♠", "♥", "♦", "♣"]
ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
deck = [(rank, suit) for suit in suits for rank in ranks]
len(deck)  # 52
```

## 바다코끼리 연산자 (`:=`) 활용

Python 3.8+ 에서 컴프리헨션 안에서 변수를 할당하면서 재사용할 수 있습니다.

```python
import re

# 매칭 결과를 변수에 담아 표현식과 조건에서 재사용
texts = ["price: 100", "size: M", "weight: 250"]
pattern = re.compile(r"\d+")

matches = [m.group() for text in texts
           if (m := pattern.search(text))]
# ['100', '250']
```

같은 연산을 표현식과 조건 두 곳에서 반복하지 않아도 됩니다.

## 성능 비교

```python
import timeit

# append 루프
def loop_version():
    result = []
    for x in range(1000):
        if x % 2 == 0:
            result.append(x**2)
    return result

# 리스트 컴프리헨션
def comp_version():
    return [x**2 for x in range(1000) if x % 2 == 0]

# map 버전
def map_version():
    return list(map(lambda x: x**2, filter(lambda x: x % 2 == 0, range(1000))))

# 컴프리헨션이 보통 가장 빠르거나 동등
```

## 언제 컴프리헨션을 쓰지 말아야 할까

```python
# ✗ 너무 긴 컴프리헨션 — 가독성 저하
result = [
    transform(item)
    for category in categories
    for subcategory in category.subcategories
    for item in subcategory.items
    if item.active and item.price < threshold
]

# ✓ 대신 함수로 추출
def active_items(categories, threshold):
    for category in categories:
        for subcategory in category.subcategories:
            for item in subcategory.items:
                if item.active and item.price < threshold:
                    yield item

result = [transform(item) for item in active_items(categories, threshold)]
```

또한 **부수 효과가 목적이라면** 컴프리헨션을 쓰지 않습니다.

```python
# ✗ 결과 리스트가 필요 없는데 컴프리헨션 사용
[print(x) for x in data]   # 안티패턴 — [None, None, ...]

# ✓ for 루프 사용
for x in data:
    print(x)
```

## 컴프리헨션의 스코프

```python
x = 10
result = [x for x in range(5)]  # 내부 x는 루프 변수
print(x)  # 10 — 외부 x에 영향 없음
```

Python 3에서 컴프리헨션은 자체 스코프를 가집니다. Python 2에서는 루프 변수가 외부 스코프를 오염시켰지만 3에서는 격리됩니다.

## 핵심 정리

- `[표현식 for 변수 in 이터러블 if 조건]` — 새 리스트를 선언적으로 생성
- `if` 가 `for` 뒤에 있으면 필터, 표현식 앞에 있으면 값 변환 분기
- 중첩 `for` 는 바깥 루프가 앞에 온다 (`for row ... for x in row`)
- 부수 효과 목적 루프엔 컴프리헨션 금지
- 3단계 이상 중첩은 가독성 저하 — 함수 분리 고려

---

**지난 글:** [순수 함수 vs 부수 효과](/posts/python-pure-vs-impure/)

**다음 글:** [파이썬 딕셔너리 컴프리헨션](/posts/python-dict-comprehension/)

<br>
읽어주셔서 감사합니다. 😊
