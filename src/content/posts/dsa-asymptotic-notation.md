---
title: "점근적 표기법 (O, Ω, Θ)"
description: "빅오(O), 빅오메가(Ω), 빅세타(Θ) 세 가지 점근적 표기법의 수학적 의미와 실무 활용법을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["점근적 표기법", "빅오", "빅오메가", "빅세타", "알고리즘 분석"]
featured: false
draft: false
---

[지난 글](/posts/dsa-big-o-notation/)에서 빅오 표기법의 규칙을 다뤘습니다. 사실 복잡도를 표현하는 표기법에는 빅오(O) 외에도 **빅오메가(Ω)**와 **빅세타(Θ)**가 있습니다. 이 세 가지가 어떻게 다른지, 언제 어떤 표기를 쓰는지 알아보겠습니다.

## 왜 세 가지 표기가 필요한가

알고리즘의 복잡도는 입력에 따라 달라집니다. 선형 탐색에서 찾는 값이 첫 번째 원소면 1번 비교로 끝나지만, 배열 끝에 있으면 n번 비교가 필요합니다. 이 두 극단과 그 사이를 표현하기 위해 세 가지 표기가 존재합니다.

![3가지 점근적 표기법](/assets/posts/dsa-asymptotic-notation-three.svg)

## 빅오(O) — 상한 (Upper Bound)

`f(n) = O(g(n))`은 충분히 큰 n에 대해 `f(n) ≤ c · g(n)`을 만족하는 양의 상수 c와 n₀가 존재함을 의미합니다.

**"내 알고리즘은 최악의 경우에도 g(n)보다 느리지 않다"**는 보장입니다.

```python
# O(n) 예시: 배열에서 목표 탐색
# 최악: 배열 끝에 있거나 없을 때 — n번 비교
def linear_search(arr, target):
    for i, val in enumerate(arr):
        if val == target:
            return i
    return -1
# O(n) — n번이 상한
```

## 빅오메가(Ω) — 하한 (Lower Bound)

`f(n) = Ω(g(n))`은 충분히 큰 n에 대해 `f(n) ≥ c · g(n)`을 만족함을 의미합니다.

**"내 알고리즘은 아무리 빨라도 g(n)보다 빠를 수 없다"**는 한계입니다.

```python
# Ω(1) 예시: 위 선형 탐색의 하한
# 최선: 첫 번째 원소가 목표일 때 — 1번 비교
# → 아무리 운이 좋아도 최소 1번은 비교해야 함
```

Ω 표기는 **알고리즘 클래스 전체의 하한**을 증명할 때 특히 중요합니다. 예를 들어 "비교 기반 정렬은 반드시 Ω(n log n)의 비교가 필요하다"는 정리가 있습니다. 이는 결정 트리(decision tree) 모델로 증명되며, 어떤 천재 알고리즘을 발명해도 n log n번 이하의 비교로는 정렬이 불가능함을 의미합니다.

## 빅세타(Θ) — 정확한 한계 (Tight Bound)

`f(n) = Θ(g(n))`은 `f(n) = O(g(n))`이면서 동시에 `f(n) = Ω(g(n))`임을 의미합니다.

**"알고리즘의 성장률이 정확히 g(n)이다"**라는 가장 강한 표현입니다.

```python
# Θ(n log n) 예시: 합병 정렬
# 최선도 최악도 항상 n log n번 비교
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])   # T(n/2)
    right = merge_sort(arr[mid:])  # T(n/2)
    return merge(left, right)      # O(n)
# T(n) = 2T(n/2) + n → Θ(n log n)
```

합병 정렬은 입력이 이미 정렬됐어도 나눠서 병합하므로 항상 Θ(n log n)입니다. 반면 버블 정렬은 이미 정렬된 입력에서 Ω(n)이지만 최악은 O(n²)이므로 Θ(n)이 아닙니다.

## 알고리즘별 세 표기 비교

![점근적 표기법 알고리즘별 분석](/assets/posts/dsa-asymptotic-notation-examples.svg)

퀵 정렬이 흥미롭습니다. 평균 Θ(n log n)으로 매우 빠르지만, 이미 정렬된 배열을 첫 번째 원소를 피벗으로 선택하면 O(n²)이 됩니다. 이 때문에 실제 구현에서는 랜덤 피벗 또는 중앙값-셋 피벗을 사용합니다.

```python
import random

def quicksort(arr, lo, hi):
    if lo < hi:
        # 랜덤 피벗: 최악 경우 O(n²) 가능성을 줄임
        pivot_idx = random.randint(lo, hi)
        arr[pivot_idx], arr[hi] = arr[hi], arr[pivot_idx]
        p = partition(arr, lo, hi)
        quicksort(arr, lo, p - 1)
        quicksort(arr, p + 1, hi)
```

## 실무에서의 사용 지침

- **O**: 성능 보장이 필요할 때 (SLA, 실시간 시스템) → "최악의 경우 얼마나 걸리나?"
- **Ω**: 알고리즘이 이론적으로 불가능한 성능을 주장할 때 검증 → "이것보다 더 빠른 알고리즘이 존재할 수 있는가?"
- **Θ**: 알고리즘을 정밀하게 분류할 때 → "합병 정렬과 힙 정렬은 둘 다 Θ(n log n)"

일상 대화에서 "이 알고리즘은 O(n log n)이다"라고 할 때 실제로는 Θ(n log n)을 의미하는 경우가 많습니다. 엄밀히는 O가 상한만을 의미하므로 "O(n²) 알고리즘도 O(n⁵)"이라고 말할 수 있습니다 — 틀린 말이 아니지만 정보가 없는 표현입니다.

```python
# 정렬 하한의 실용적 의미
# n=1,000,000 원소 정렬 시 최소 비교 횟수:
import math
n = 1_000_000
min_comparisons = n * math.log2(n)
print(f"최소 {min_comparisons:,.0f}번 비교 필요")
# → 최소 19,931,568번 비교 필요
# 어떤 비교 기반 정렬도 이보다 적게 비교할 수 없음
```

## 정리

| 표기 | 의미 | 활용 |
|---|---|---|
| O(g) | 상한: T(n) ≤ c·g(n) | 최악 경우 성능 보장 |
| Ω(g) | 하한: T(n) ≥ c·g(n) | 알고리즘 한계 증명 |
| Θ(g) | 정확: c₁·g(n) ≤ T(n) ≤ c₂·g(n) | 정밀한 분류 |

---

**지난 글:** [빅오(Big-O) 표기법](/posts/dsa-big-o-notation/)

**다음 글:** [분할 상환 분석](/posts/dsa-amortized-analysis/)

<br>
읽어주셔서 감사합니다. 😊
