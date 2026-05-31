---
title: "시간·공간 복잡도"
description: "시간 복잡도와 공간 복잡도의 의미와 계산 방법, 그리고 두 지표 간의 트레이드오프를 예제로 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["시간복잡도", "공간복잡도", "알고리즘", "트레이드오프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-algorithm-analysis-intro/)에서 알고리즘 분석의 개념을 살펴봤습니다. 이번에는 알고리즘 성능을 측정하는 두 축인 **시간 복잡도**와 **공간 복잡도**를 더 깊이 파고들겠습니다.

## 시간 복잡도 (Time Complexity)

시간 복잡도는 입력 크기 n이 증가함에 따라 알고리즘이 수행하는 **기본 연산의 횟수**가 어떻게 증가하는지를 나타냅니다. 실제 실행 시간(초)이 아니라 연산 횟수의 **증가율**에 집중합니다.

```python
# O(1): 배열 인덱스 접근 — 항상 1번
def get_first(arr):
    return arr[0]

# O(n): 배열 전체 순회 — n번
def find_max(arr):
    m = arr[0]
    for x in arr:   # n번 반복
        if x > m:
            m = x
    return m

# O(n²): 중첩 루프 — n × n번
def has_duplicate(arr):
    for i in range(len(arr)):
        for j in range(i+1, len(arr)):
            if arr[i] == arr[j]:
                return True
    return False
```

![시간 복잡도 분석](/assets/posts/dsa-time-space-complexity-time.svg)

## 공간 복잡도 (Space Complexity)

공간 복잡도는 알고리즘이 실행되는 동안 사용하는 **추가 메모리(보조 공간)**의 양입니다. 입력 데이터가 차지하는 공간은 제외하고, 알고리즘이 자체적으로 필요로 하는 메모리만 계산합니다.

```python
def reverse_in_place(arr):
    left, right = 0, len(arr) - 1  # 변수 2개만 사용
    while left < right:
        arr[left], arr[right] = arr[right], arr[left]
        left += 1
        right -= 1
    # 공간 복잡도: O(1) — 추가 배열 없음

def reverse_copy(arr):
    return arr[::-1]  # 길이 n의 새 배열 생성
    # 공간 복잡도: O(n)
```

재귀 함수는 스택 프레임을 사용하므로 공간 복잡도에 주의해야 합니다.

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
# 공간 복잡도: O(n) — 깊이 n의 재귀 스택
```

## 시간-공간 트레이드오프

시간과 공간은 종종 **트레이드오프(trade-off)** 관계에 있습니다. 메모리를 더 사용해서 계산 시간을 줄이거나, 반대로 메모리를 아끼고 더 많은 계산을 하는 식입니다.

![시간-공간 트레이드오프](/assets/posts/dsa-time-space-complexity-tradeoff.svg)

피보나치 수열이 대표적인 예입니다. 순수 재귀는 O(2ⁿ) 시간이지만 O(n) 메모리, 메모이제이션은 O(n) 시간과 O(n) 메모리, 반복문 방식은 O(n) 시간과 O(1) 메모리로 구현할 수 있습니다.

```python
# 반복문 방식: O(n) 시간, O(1) 공간
def fib_iterative(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

## 복잡도 계산 규칙

복잡도를 구할 때 적용하는 핵심 규칙들입니다.

**덧셈 규칙**: 순차 실행은 각 부분의 최대값

```python
def two_loops(arr):
    for x in arr:  # O(n)
        print(x)
    for x in arr:  # O(n)
        print(x * 2)
# 총 O(n) + O(n) = O(2n) → O(n)
```

**곱셈 규칙**: 중첩 실행은 곱

```python
def nested(arr1, arr2):
    for x in arr1:     # O(n)
        for y in arr2: # O(m)
            print(x, y)
# 총 O(n × m) = O(nm)
```

**지배 항 선택**: 가장 빠르게 증가하는 항만 남김

```
T(n) = 5n³ + 100n² + 1000n + 9999 → O(n³)
```

## 공간 복잡도 주의사항: 입력 공간

보조 공간(auxiliary space)만 따집니다. 입력 배열 자체의 n개 원소는 포함하지 않습니다.

```python
def sum_array(arr):    # 입력: n개 원소
    total = 0          # 보조: 변수 1개
    for x in arr:
        total += x
    return total
# 공간 복잡도: O(1) — 보조 공간만 계산
```

## 정리

| 복잡도 | 시간 | 공간 |
|---|---|---|
| O(1) | 상수 연산 | 고정 변수만 |
| O(log n) | 반씩 줄임 | 재귀 스택 log n |
| O(n) | 1회 순회 | 크기 n 배열 |
| O(n log n) | 분할 정복 | 보조 배열 |
| O(n²) | 중첩 루프 | 2D 배열 |

- 시간·공간은 트레이드오프 관계 — 상황에 맞게 선택
- 복잡도는 지배 항만 남긴다: `O(n² + n)` → `O(n²)`
- 재귀는 스택 공간이 있음을 잊지 말 것

---

**지난 글:** [알고리즘 분석 입문](/posts/dsa-algorithm-analysis-intro/)

**다음 글:** [빅오 표기법](/posts/dsa-big-o-notation/)

<br>
읽어주셔서 감사합니다. 😊
