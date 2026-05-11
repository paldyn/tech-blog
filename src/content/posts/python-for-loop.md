---
title: "for 루프: 반복 가능 객체 순회의 모든 것"
description: "Python for 루프의 이터러블/이터레이터 메커니즘, range·enumerate·zip 활용법, 중첩 루프와 언패킹 패턴, 루프 중 수정 금지 함정까지 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "for", "loop", "range", "enumerate", "zip", "이터러블", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-if-elif-else/)에서 조건 분기를 다뤘다. 이번에는 흐름 제어의 두 번째 축인 **반복(loop)** 으로 넘어간다. Python의 `for` 문은 C/Java와 달리 숫자 인덱스가 아닌 **이터러블(iterable) 객체**를 직접 순회한다는 점이 핵심이다.

## 기본 문법

```python
for 변수 in 이터러블:
    # 반복 실행할 코드
```

`for` 뒤의 변수에는 이터러블에서 꺼낸 값이 하나씩 바인딩된다.

```python
fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
    print(fruit)
# apple
# banana
# cherry
```

## 이터러블과 이터레이터

Python이 `for x in obj:` 를 만나면 내부적으로 두 단계를 거친다.

1. `iter(obj)` 호출 → **이터레이터** 반환 (현재 위치 기억)
2. `next(iterator)` 반복 호출 → 값 소진 시 `StopIteration` → 루프 종료

`__iter__()` 를 구현한 모든 객체가 이터러블이다: 리스트, 튜플, 문자열, `dict`, `set`, 파일 객체, 제너레이터 등.

![for 루프 실행 메커니즘](/assets/posts/python-for-loop-overview.svg)

## range() — 정수 범위 순회

인덱스 기반 반복이 필요할 때 `range()`를 쓴다.

```python
# range(stop)         → 0, 1, ..., stop-1
for i in range(5):
    print(i)          # 0 1 2 3 4

# range(start, stop)  → start ~ stop-1
for i in range(2, 6):
    print(i)          # 2 3 4 5

# range(start, stop, step)
for i in range(0, 10, 2):
    print(i)          # 0 2 4 6 8

# 역순
for i in range(5, 0, -1):
    print(i)          # 5 4 3 2 1
```

`range()`는 게으르게(lazily) 계산되므로 메모리 효율적이다. `range(10_000_000)`은 정수 하나짜리 크기만 차지한다.

## enumerate() — 인덱스와 값 동시에

```python
colors = ["red", "green", "blue"]

# 나쁜 예: range(len(...))
for i in range(len(colors)):
    print(i, colors[i])

# 좋은 예: enumerate
for i, color in enumerate(colors):
    print(i, color)
# 0 red
# 1 green
# 2 blue

# 시작 인덱스 변경
for i, color in enumerate(colors, start=1):
    print(i, color)   # 1 red, 2 green, 3 blue
```

`range(len(...))` 패턴은 Python스럽지 않다. `enumerate()`를 기본으로 사용하자.

## zip() — 두 시퀀스 병렬 순회

```python
names = ["Alice", "Bob", "Carol"]
scores = [92, 85, 78]

for name, score in zip(names, scores):
    print(f"{name}: {score}")
# Alice: 92
# Bob: 85
# Carol: 78
```

`zip()`은 **짧은 쪽 기준**으로 종료된다. 긴 쪽을 기준으로 하려면 `itertools.zip_longest()`를 쓴다.

## 딕셔너리 순회

```python
d = {"a": 1, "b": 2, "c": 3}

for key in d:              # 키만 (기본)
    print(key)

for val in d.values():     # 값만
    print(val)

for key, val in d.items(): # 키+값
    print(key, val)
```

## 중첩 루프와 언패킹

```python
# 2D 리스트 순회
matrix = [[1, 2, 3], [4, 5, 6]]
for row in matrix:
    for cell in row:
        print(cell, end=" ")
    print()

# 언패킹 — 요소가 튜플/리스트일 때
pairs = [(1, "a"), (2, "b"), (3, "c")]
for num, letter in pairs:
    print(num, letter)
```

![for 루프 실전 패턴](/assets/posts/python-for-loop-patterns.svg)

## 루프 중 리스트 수정 금지

순회 중인 리스트를 직접 수정하면 인덱스가 어긋나 예상치 못한 결과가 나온다.

```python
nums = [1, 2, 3, 4, 5]

# 위험 — 수정하면서 순회
for n in nums:
    if n % 2 == 0:
        nums.remove(n)   # 인덱스 건너뜀 버그

# 안전 — 복사본 순회
for n in nums[:]:
    if n % 2 == 0:
        nums.remove(n)

# 권장 — 리스트 컴프리헨션
nums = [n for n in nums if n % 2 != 0]
```

## 변수 누출 주의

Python `for` 루프의 변수는 블록 스코프가 없어 루프 종료 후에도 살아있다.

```python
for i in range(5):
    pass
print(i)  # 4 — 마지막 값이 남아있음
```

이 동작에 의존하는 코드는 가독성을 해친다. 루프 후 특정 값을 얻으려면 `max()`, `sum()`, 컴프리헨션 같은 명시적 방법을 쓰자.

## 정리

- `for x in iterable:` — 이터러블에서 값을 하나씩 꺼내 변수에 바인딩
- `range(stop)` / `range(start, stop, step)` — 정수 범위 게으른 생성
- `enumerate(iterable, start=0)` — (인덱스, 값) 쌍 반환
- `zip(a, b)` — 두 이터러블을 쌍으로 묶어 순회
- 루프 중 리스트 직접 수정 금지 — 복사본이나 컴프리헨션 활용

---

**지난 글:** [if / elif / else: Python 조건문 완전 정복](/posts/python-if-elif-else/)

**다음 글:** [while 루프: 조건 기반 반복과 무한 루프 제어](/posts/python-while-loop/)

<br>
읽어주셔서 감사합니다. 😊
