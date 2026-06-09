---
title: "동전 교환 문제 (Coin Change): 최솟값과 경우의 수"
description: "동전 교환 문제의 두 변형 — 최소 동전 수(Coin Change I)와 경우의 수(Coin Change II) — 를 DP 점화식과 순회 방향 차이로 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "동전교환", "Coin Change", "DP", "무한배낭"]
featured: false
draft: false
---

[지난 글](/posts/dsa-knapsack-variants/)에서 배낭 문제의 여러 변형을 살펴봤습니다. 동전 교환 문제는 무한 배낭 문제의 특수 케이스로, DP 테이블 채우는 방식이 본질적으로 동일합니다. 이번 글에서는 **최소 동전 수(Coin Change I)**와 **경우의 수(Coin Change II)** 두 변형을 함께 다룹니다. 두 문제는 점화식이 비슷해 보이지만, 루프 순서 하나로 완전히 다른 답을 내놓습니다.

## 문제 정의

동전 종류 배열 `coins`와 목표 금액 `amount`가 주어질 때:

- **Coin Change I**: 목표 금액을 만드는 **최소 동전 수** (불가능하면 -1)
- **Coin Change II**: 목표 금액을 만드는 **방법의 수** (순서 무관 조합)

예시: `coins = [1, 2, 5]`, `amount = 11`
- I: 최솟값 → 5+5+1 = **3개**
- II 예시 `amount=5`: {5}, {2+2+1}, {2+1+1+1}, {1+1+1+1+1} = **4가지**

## Coin Change I: 최소 동전 수

`dp[i]` = 금액 `i`를 만드는 최소 동전 수. 기저: `dp[0] = 0`, 나머지 `+∞`.

점화식: `dp[i] = min(dp[i - c] + 1)` for all `c` in `coins` where `c ≤ i`

무한 배낭(각 동전 무한 사용)이므로 정순 순회를 사용합니다.

```python
def coin_change(coins: list, amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0

    for i in range(1, amount + 1):
        for c in coins:
            if c <= i:
                dp[i] = min(dp[i], dp[i - c] + 1)

    return dp[amount] if dp[amount] != float('inf') else -1

print(coin_change([1, 2, 5], 11))  # 3  (5+5+1)
print(coin_change([2], 3))         # -1 (불가능)
```

![동전 교환 DP 테이블](/assets/posts/dsa-coin-change-table.svg)

## Coin Change II: 경우의 수

`dp[i]` = 금액 `i`를 만드는 **조합 수**. 기저: `dp[0] = 1` (빈 조합 1가지).

점화식: `dp[i] += dp[i - c]` for all `c` in `coins`

**루프 순서가 핵심**: 동전을 외부 반복, 금액을 내부 반복하면 조합(순서 무관), 금액을 외부 반복, 동전을 내부 반복하면 순열(순서 유관)이 됩니다.

```python
def change(amount: int, coins: list) -> int:
    dp = [0] * (amount + 1)
    dp[0] = 1  # 빈 조합 하나

    for c in coins:           # 동전이 외부 루프 → 조합 수
        for i in range(c, amount + 1):
            dp[i] += dp[i - c]

    return dp[amount]

print(change(5, [1, 2, 5]))   # 4

# 비교: 순열 수 (순서가 다르면 다른 방법으로 셈)
def count_ways_ordered(amount: int, coins: list) -> int:
    dp = [0] * (amount + 1)
    dp[0] = 1

    for i in range(1, amount + 1):   # 금액이 외부 루프 → 순열 수
        for c in coins:
            if c <= i:
                dp[i] += dp[i - c]

    return dp[i]
```

왜 루프 순서가 중요할까요? 동전을 외부 루프로 처리하면, 동전 1을 처리하고 나서 동전 2를 처리합니다. `dp[4]`를 계산할 때 `{1+1+2}`와 `{2+1+1}`을 같은 조합으로 취급합니다. 반면 금액이 외부 루프면 `dp[4]`에 도달하는 모든 **순서가 다른** 경로를 각각 세게 됩니다.

![경우의 수 vs 순열](/assets/posts/dsa-coin-change-ways.svg)

## 왜 그리디는 안 될까?

동전 `[1, 3, 4]`로 금액 6을 만드는 문제를 탐욕적으로 풀면 4+1+1 = 3개지만, 최적은 3+3 = 2개입니다. 탐욕적 선택(가장 큰 동전부터)이 전역 최적을 보장하지 않는 이유는 나중에 더 좋은 조합이 있을 수 있기 때문입니다. DP는 모든 부분 문제를 고려해 최적해를 구합니다.

```python
# 탐욕: 틀린 답
coins = [1, 3, 4]
amount = 6
result_greedy = 0
for c in sorted(coins, reverse=True):
    while amount >= c:
        amount -= c
        result_greedy += 1
# result_greedy = 3 (4+1+1), 정답은 2 (3+3)

# DP: 올바른 답
print(coin_change([1, 3, 4], 6))  # 2
```

## 복잡도

| | 시간 | 공간 |
|---|---|---|
| Coin Change I | O(n · amount) | O(amount) |
| Coin Change II | O(n · amount) | O(amount) |

두 문제 모두 무한 배낭과 동일한 구조로 O(n·amount) 시간에 풀립니다. `amount`가 매우 크면 BFS를 활용한 O(amount · n) 방법도 있지만, 1D DP가 캐시 효율면에서 더 유리합니다.

---

**지난 글:** [배낭 문제 변형들](/posts/dsa-knapsack-variants/)

**다음 글:** [행렬 연쇄 곱셈 (Matrix Chain Multiplication)](/posts/dsa-matrix-chain-multiplication/)

<br>
읽어주셔서 감사합니다. 😊
