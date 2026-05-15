---
title: "파이썬 딕셔너리 컴프리헨션 — 데이터 변환의 핵심 도구"
description: "파이썬 딕셔너리 컴프리헨션의 문법, 키-값 교환·필터링·zip·enumerate 패턴, 중첩 구조, 중복 키 처리까지 실전 예제로 총정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "딕셔너리컴프리헨션", "dict", "comprehension", "데이터변환"]
featured: false
draft: false
---

[지난 글](/posts/python-list-comprehension/)에서 리스트 컴프리헨션을 깊이 살펴봤습니다. 이번에는 같은 원리를 딕셔너리에 적용하는 **딕셔너리 컴프리헨션(dict comprehension)** 을 다룹니다. 데이터 변환과 집계에서 매우 자주 쓰이는 패턴입니다.

## 기본 문법

```
{키표현식: 값표현식 for 변수 in 이터러블 if 조건}
```

리스트 컴프리헨션과 동일한 구조지만, `[]` 대신 `{}` 를 쓰고 `키: 값` 쌍으로 표현합니다.

```python
# 문자열 길이를 값으로 하는 dict
words = ["cat", "elephant", "ox"]
word_len = {w: len(w) for w in words}
# {'cat': 3, 'elephant': 8, 'ox': 2}
```

![딕셔너리 컴프리헨션 문법](/assets/posts/python-dict-comprehension-syntax.svg)

## 기존 딕셔너리 변환

`dict.items()` 와 조합하면 딕셔너리를 변환하거나 필터링할 수 있습니다.

```python
inventory = {"apple": 10, "banana": 0, "cherry": 5, "date": 0}

# 재고가 있는 항목만
in_stock = {item: qty for item, qty in inventory.items() if qty > 0}
# {'apple': 10, 'cherry': 5}

# 모든 값에 세금 적용
prices = {"cola": 1000, "juice": 1500, "water": 800}
taxed = {item: int(price * 1.1) for item, price in prices.items()}
# {'cola': 1100, 'juice': 1650, 'water': 880}
```

## 키·값 교환 (Invert)

```python
mapping = {"a": 1, "b": 2, "c": 3}
inverted = {v: k for k, v in mapping.items()}
# {1: 'a', 2: 'b', 3: 'c'}
```

값에 중복이 있으면 마지막 키가 남습니다.

```python
# 값 중복 시
dup = {"a": 1, "b": 1, "c": 2}
inverted = {v: k for k, v in dup.items()}
# {1: 'b', 2: 'c'}  — 1의 키는 'a'가 아닌 'b'
```

안전하게 역방향 매핑을 만들려면 중복 여부를 먼저 확인합니다.

```python
from collections import Counter

if len(Counter(mapping.values())) == len(mapping):
    safe_inverted = {v: k for k, v in mapping.items()}
else:
    raise ValueError("값 중복 — 역방향 매핑 불가")
```

## zip으로 두 리스트 병합

```python
keys = ["name", "age", "city"]
values = ["Kim", 30, "Seoul"]

# 방법 1 — dict comprehension
profile = {k: v for k, v in zip(keys, values)}

# 방법 2 — dict(zip()) 더 간결
profile = dict(zip(keys, values))

# {'name': 'Kim', 'age': 30, 'city': 'Seoul'}
```

![딕셔너리 컴프리헨션 활용](/assets/posts/python-dict-comprehension-advanced.svg)

## enumerate로 위치 인덱스 생성

```python
categories = ["전자", "식품", "의류", "가구"]
cat_to_id = {cat: idx for idx, cat in enumerate(categories)}
# {'전자': 0, '식품': 1, '의류': 2, '가구': 3}

# 역방향 — id로 카테고리 찾기
id_to_cat = {idx: cat for idx, cat in enumerate(categories)}
```

머신러닝에서 레이블을 정수로 변환하거나 빠른 룩업 테이블을 만들 때 자주 씁니다.

## 키 정규화

외부에서 받은 딕셔너리의 키를 통일할 때 유용합니다.

```python
raw = {"Name": "Alice", "AGE": 25, "Email": "alice@example.com"}

# 키를 소문자 + 언더스코어로 정규화
normalized = {k.lower().replace(" ", "_"): v for k, v in raw.items()}
# {'name': 'Alice', 'age': 25, 'email': 'alice@example.com'}
```

## 중첩 딕셔너리 컴프리헨션

```python
# 구구단 테이블
mult_table = {
    i: {j: i * j for j in range(1, 10)}
    for i in range(2, 10)
}
mult_table[3][7]  # 21
mult_table[9][9]  # 81
```

가독성을 위해 바깥 컴프리헨션을 먼저 작성하고, 값 부분에 안쪽 컴프리헨션을 넣습니다.

## 조건 표현식으로 값 변환

```python
scores = {"Alice": 85, "Bob": 42, "Charlie": 91, "Diana": 58}

# 60 이상 pass, 미만 fail
grades = {name: "pass" if score >= 60 else "fail"
          for name, score in scores.items()}
# {'Alice': 'pass', 'Bob': 'fail', 'Charlie': 'pass', 'Diana': 'fail'}
```

## 중복 키 문제와 groupby 패턴

같은 키가 여러 번 등장하면 마지막 값만 남습니다. 그룹으로 묶어야 할 때는 `defaultdict` 를 씁니다.

```python
from collections import defaultdict

records = [("fruit", "apple"), ("veggie", "carrot"),
           ("fruit", "banana"), ("veggie", "broccoli")]

# ✗ dict comprehension — 마지막 값만 남음
d = {cat: item for cat, item in records}
# {'fruit': 'banana', 'veggie': 'broccoli'}

# ✓ defaultdict로 그루핑
grouped = defaultdict(list)
for cat, item in records:
    grouped[cat].append(item)
# {'fruit': ['apple', 'banana'], 'veggie': ['carrot', 'broccoli']}
```

## dict comprehension vs dict()

```python
# 모두 동등한 결과
keys = ["a", "b", "c"]
vals = [1, 2, 3]

{k: v for k, v in zip(keys, vals)}   # 컴프리헨션
dict(zip(keys, vals))                  # dict() 내장
dict(a=1, b=2, c=3)                   # 키워드 (이름이 고정일 때)
```

키가 변수에서 온다면 컴프리헨션이나 `dict(zip())`, 키가 문자열 리터럴이라면 `dict(k=v)` 가 더 간결합니다.

## 핵심 정리

- `{키: 값 for ... in ... if ...}` — 딕셔너리를 한 줄로 선언적 생성
- 키·값 교환에 최적 — 값 중복 주의
- `zip`으로 두 리스트를 키-값 쌍으로 묶기
- 중복 키 시 마지막 값이 덮어씀 — 그루핑 필요 시 `defaultdict`
- 중첩 컴프리헨션으로 2D 매핑 테이블 생성 가능

---

**지난 글:** [파이썬 리스트 컴프리헨션 완전 정복](/posts/python-list-comprehension/)

**다음 글:** [파이썬 집합 컴프리헨션과 frozenset](/posts/python-set-comprehension/)

<br>
읽어주셔서 감사합니다. 😊
