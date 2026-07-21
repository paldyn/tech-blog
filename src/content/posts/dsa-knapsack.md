---
title: "0/1 배낭 문제 (0/1 Knapsack Problem)"
description: "0/1 배낭 문제의 DP 점화식 도출부터 2D 테이블 채우기, 역추적으로 선택 물품 복원, 1D 배열 최적화까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "배낭문제", "Knapsack", "DP", "역추적"]
featured: false
draft: false
---

[지난 글](/posts/dsa-memoization-vs-tabulation/)에서 DP를 구현하는 두 전략인 메모이제이션과 타뷸레이션을 비교했습니다. 이번 글에서는 DP의 대표 예제이자 수많은 최적화 문제의 원형인 **0/1 배낭 문제(0/1 Knapsack Problem)**를 다룹니다. "각 물품을 한 번씩만 넣거나 빼는" 이 문제는 간단해 보이지만, 그 안에 DP의 핵심 사고 흐름이 모두 담겨 있습니다.

## 문제 정의

`n`개의 물품이 있고 각 물품은 무게 `w[i]`와 가치 `v[i]`를 가집니다. 최대 무게 `W`인 배낭에 물품을 선택하여 **가치 합계를 최대화**하되, 각 물품은 **0개 또는 1개**만 선택합니다.

- 물건마다 **넣거나(1) / 안 넣거나(0)** 두 가지 선택 → 2^n 개 경우의 수
- 완전 탐색은 O(2^n)이지만 DP로 O(n·W)에 풀 수 있습니다

## DP 점화식 도출

`dp[i][w]` = 첫 i번째 물품까지만 고려하고, 배낭 용량이 w일 때 얻을 수 있는 최대 가치

두 가지 경우로 나뉩니다:

1. **물품 i를 넣지 않는 경우**: `dp[i][w] = dp[i-1][w]`
2. **물품 i를 넣는 경우** (무게 w[i] ≤ w): `dp[i][w] = dp[i-1][w - w[i]] + v[i]`

따라서 점화식은:

```text
dp[i][w] = dp[i-1][w]                                   if w[i] > w
dp[i][w] = max(dp[i-1][w], dp[i-1][w - w[i]] + v[i])   if w[i] ≤ w
```

기저 조건: `dp[0][*] = 0` (물품 없음), `dp[*][0] = 0` (용량 0)

![0/1 배낭 DP 테이블](/assets/posts/dsa-knapsack-table.svg)

## 구현: 2D DP

```python
from typing import List

def knapsack_2d(W: int, weights: List[int], values: List[int]) -> int:
    n = len(weights)
    dp = [[0] * (W + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        wi, vi = weights[i - 1], values[i - 1]
        for w in range(W + 1):
            dp[i][w] = dp[i - 1][w]                          # 물품 i 미선택
            if wi <= w:
                dp[i][w] = max(dp[i][w], dp[i - 1][w - wi] + vi)  # 물품 i 선택

    return dp[n][W]

# 시간: O(nW), 공간: O(nW)
weights = [2, 3, 4, 5]
values  = [3, 4, 5, 7]
print(knapsack_2d(5, weights, values))  # 7
```

## 역추적: 선택된 물품 복원

최적해의 값뿐 아니라 **어떤 물품을 선택했는지** 알려면 역추적(Traceback)이 필요합니다.

```python
def knapsack_with_traceback(W: int, weights: List[int], values: List[int]):
    n = len(weights)
    dp = [[0] * (W + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        wi, vi = weights[i - 1], values[i - 1]
        for w in range(W + 1):
            dp[i][w] = dp[i - 1][w]
            if wi <= w:
                dp[i][w] = max(dp[i][w], dp[i - 1][w - wi] + vi)

    # 역추적
    selected = []
    w = W
    for i in range(n, 0, -1):
        if dp[i][w] != dp[i - 1][w]:          # 물품 i가 선택됨
            selected.append(i)
            w -= weights[i - 1]

    return dp[n][W], selected[::-1]

val, items = knapsack_with_traceback(5, weights, values)
print(f"최대 가치: {val}, 선택 물품: {items}")  # 7, [1, 2]
```

![역추적으로 선택 물품 복원](/assets/posts/dsa-knapsack-trace.svg)

## 공간 최적화: 1D DP

현재 행 `dp[i]`를 계산할 때 이전 행 `dp[i-1]`만 필요합니다. 배열 하나로 **오른쪽에서 왼쪽** 방향으로 업데이트하면 O(W) 공간으로 줄어듭니다.

```python
def knapsack_1d(W: int, weights: List[int], values: List[int]) -> int:
    dp = [0] * (W + 1)

    for wi, vi in zip(weights, values):
        # 반드시 역순으로 — 같은 물품을 두 번 선택하는 것을 막기 위해
        for w in range(W, wi - 1, -1):
            dp[w] = max(dp[w], dp[w - wi] + vi)

    return dp[W]

# 시간: O(nW), 공간: O(W)
print(knapsack_1d(5, weights, values))  # 7
```

역순 순회가 핵심입니다. 오름차순으로 업데이트하면 `dp[w - wi]`가 이미 같은 물품을 포함한 값일 수 있어 중복 선택이 발생합니다. 역순이면 `dp[w - wi]`는 항상 이전 단계(물품 i 미포함)의 값을 참조합니다.

## 복잡도 및 한계

| | 복잡도 |
|---|---|
| 시간 | O(n·W) — 의사다항 시간(pseudo-polynomial) |
| 공간 | O(n·W) 또는 O(W) |

W가 매우 크면 (예: W = 10^9) DP 테이블 자체가 메모리 한계를 초과합니다. 이런 경우에는 **분할 정복 + 이분 탐색** 또는 **FPTAS(완전 다항 근사 체계)**를 사용합니다. 0/1 배낭 문제는 NP-완전 문제이므로 W에 무관한 다항 시간 알고리즘은 존재하지 않습니다.

---

**지난 글:** [메모이제이션 vs 타뷸레이션](/posts/dsa-memoization-vs-tabulation/)

**다음 글:** [배낭 문제 변형들 (Knapsack Variants)](/posts/dsa-knapsack-variants/)

<br>
읽어주셔서 감사합니다. 😊
