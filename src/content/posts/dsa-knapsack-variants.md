---
title: "배낭 문제 변형들: 무한 배낭·유계 배낭·분할 배낭"
description: "0/1 배낭을 기반으로 무한 배낭(Unbounded), 유계 배낭(Bounded), 분할 가능 배낭(Fractional) 변형들의 점화식 차이와 구현 패턴을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "배낭문제", "Unbounded Knapsack", "Bounded Knapsack", "Fractional Knapsack"]
featured: false
draft: false
---

[지난 글](/posts/dsa-knapsack/)에서 0/1 배낭 문제의 DP 테이블과 역추적을 다뤘습니다. 배낭 문제는 선택 제약 조건을 바꾸면 전혀 다른 변형이 됩니다. 이번 글에서는 **무한 배낭(Unbounded Knapsack)**, **유계 배낭(Bounded Knapsack)**, **분할 가능 배낭(Fractional Knapsack)**의 차이와 구현 패턴을 살펴봅니다.

## 네 가지 배낭 문제 한눈에 보기

![배낭 문제 변형 비교](/assets/posts/dsa-knapsack-variants-types.svg)

| 종류 | 선택 제한 | 풀이 방법 | 시간 복잡도 |
|---|---|---|---|
| 0/1 배낭 | 각 물품 0 또는 1개 | DP (역순) | O(nW) |
| 무한 배낭 | 각 물품 무제한 | DP (정순) | O(nW) |
| 유계 배낭 | 물품 i 최대 c[i]개 | 이진 분할 + 0/1 DP | O(n log c · W) |
| 분할 가능 배낭 | 물품 일부 자를 수 있음 | 탐욕 (단위 가치 정렬) | O(n log n) |

## 무한 배낭 문제 (Unbounded Knapsack)

각 물품을 개수 제한 없이 선택할 수 있습니다. **순회 방향만 정순으로** 바꾸면 0/1 배낭 코드가 그대로 무한 배낭으로 전환됩니다.

```python
def unbounded_knapsack(W: int, weights: list, values: list) -> int:
    dp = [0] * (W + 1)
    for wi, vi in zip(weights, values):
        for w in range(wi, W + 1):   # 정순 — 현재 물품 재사용 허용
            dp[w] = max(dp[w], dp[w - wi] + vi)
    return dp[W]
```

`dp[w - wi]`가 이미 이번 물품 처리 중 업데이트된 값일 수 있으므로, 같은 물품을 여러 번 포함한 경우가 자연스럽게 반영됩니다.

![무한 배낭 vs 0/1 배낭 순회 방향](/assets/posts/dsa-knapsack-variants-unbounded.svg)

## 유계 배낭 문제 (Bounded Knapsack)

물품 i를 최대 `c[i]`번 선택할 수 있습니다. 가장 단순한 방법은 각 물품을 `c[i]`개의 독립 물품으로 펼치는 것이지만, 이는 O(Σc[i] · W)로 느릴 수 있습니다.

**이진 분할(Binary Grouping)**: c[i]를 1, 2, 4, 8, ... 배씩 묶어 O(log c[i])개의 그룹으로 만들면, 어떤 개수도 이 그룹들의 합집합으로 표현됩니다.

```python
def bounded_knapsack(W: int, weights: list, values: list, counts: list) -> int:
    # 이진 분할로 0/1 배낭 물품 목록 생성
    items = []
    for wi, vi, ci in zip(weights, values, counts):
        k = 1
        while k <= ci:
            items.append((k * wi, k * vi))
            ci -= k
            k *= 2
        if ci > 0:
            items.append((ci * wi, ci * vi))

    # 일반 0/1 배낭
    dp = [0] * (W + 1)
    for wi, vi in items:
        for w in range(W, wi - 1, -1):
            dp[w] = max(dp[w], dp[w - wi] + vi)
    return dp[W]

# 예: 물품 [w=2,v=3,c=4]  → 분할: (2,3), (4,6), (2,3) [나머지 2]
```

단조 큐(Monotonic Deque)를 활용한 O(nW) 풀이도 존재하지만, 이진 분할이 코딩 테스트 환경에서 더 실용적입니다.

## 분할 가능 배낭 문제 (Fractional Knapsack)

물품을 잘라서 일부만 넣을 수 있습니다. 이 경우 **그리디(Greedy)**가 최적해를 보장합니다. 단위 무게당 가치(`v/w`)가 높은 순서로 물품을 넣고, 배낭이 꽉 차면 나머지를 잘라 넣습니다.

```python
def fractional_knapsack(W: int, weights: list, values: list) -> float:
    # (단위 가치, 무게, 가치) 기준 내림차순 정렬
    items = sorted(zip(weights, values), key=lambda x: x[1] / x[0], reverse=True)

    total = 0.0
    for wi, vi in items:
        if W <= 0:
            break
        take = min(wi, W)
        total += take * (vi / wi)
        W -= take

    return total

# 예: W=10, items=[(5,10),(4,16),(3,12)]
# 단위가치: 2, 4, 4  → 순서: 4,3,5
# → 4(무게)*4(단위) + 3*4 + 3*2 = 16+12+6=34
print(fractional_knapsack(10, [5, 4, 3], [10, 16, 12]))  # 34.0
```

분할 가능 배낭에서 그리디가 최적인 이유: 단위 가치 순서로 넣으면 배낭의 한계 단위를 가장 높은 가치로 채울 수 있습니다. 0/1 배낭에서 그리디가 최적해를 보장하지 못하는 것과 대조적입니다.

## 다차원 배낭 문제

무게 외에 부피 등 제약 조건이 여러 개인 경우입니다. 2D 배낭의 경우 DP 배열을 `dp[w1][w2]`로 확장하면 됩니다.

```python
def knapsack_2d_constraint(W: int, V: int, ws: list, vs_weight: list, vs_vol: list, vals: list) -> int:
    # dp[w][v] = 무게 w, 부피 v 이하에서 얻을 수 있는 최대 가치
    dp = [[0] * (V + 1) for _ in range(W + 1)]
    for wi, vi, val in zip(ws, vs_weight, vs_vol):
        for w in range(W, wi - 1, -1):
            for v in range(V, vi - 1, -1):
                dp[w][v] = max(dp[w][v], dp[w - wi][v - vi] + val)
    return dp[W][V]
```

제약 조건 k개면 dp 배열 차원도 k개로 늘어납니다. 시간은 O(n · W1 · W2 · ... · Wk)입니다.

## 핵심 요약

0/1 배낭 코드를 기반으로 순회 방향 하나만 바꾸면 무한 배낭이 되고, 이진 분할로 유계 배낭을 0/1 배낭으로 환원할 수 있습니다. 분할 가능 배낭은 그리디로 O(n log n)에 해결됩니다. 이 패턴들을 이해하면 어떤 배낭 변형도 빠르게 분류하고 적용할 수 있습니다.

---

**지난 글:** [0/1 배낭 문제](/posts/dsa-knapsack/)

**다음 글:** [동전 교환 문제 (Coin Change)](/posts/dsa-coin-change/)

<br>
읽어주셔서 감사합니다. 😊
