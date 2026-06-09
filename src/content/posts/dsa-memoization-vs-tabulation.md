---
title: "메모이제이션 vs 타뷸레이션: DP 구현 전략 완전 비교"
description: "동적 프로그래밍의 두 구현 전략인 메모이제이션(Top-Down)과 타뷸레이션(Bottom-Up)을 원리부터 공간 최적화까지 실전 코드와 함께 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "메모이제이션", "타뷸레이션", "Top-Down", "Bottom-Up", "공간최적화"]
featured: false
draft: false
---

[지난 글](/posts/dsa-dynamic-programming-intro/)에서 동적 프로그래밍의 핵심 조건인 최적 부분 구조와 겹치는 부분 문제를 살펴봤습니다. 이번에는 DP를 실제로 코드로 구현할 때 선택하는 두 가지 전략, **메모이제이션(Memoization)**과 **타뷸레이션(Tabulation)**을 비교합니다. 둘 다 중복 계산을 없애는 목표는 같지만, 접근 방향과 실용적인 트레이드오프가 다릅니다.

## 메모이제이션: Top-Down 접근

메모이제이션은 재귀 함수에 캐시를 붙이는 방식입니다. 문제를 큰 것에서 작은 것으로 쪼개며(Top-Down), 한 번 계산한 결과를 딕셔너리나 배열에 저장해 두고 같은 인자로 다시 호출될 때 즉시 반환합니다.

```python
import functools

@functools.lru_cache(maxsize=None)
def fib(n: int) -> int:
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

# Python 데코레이터 없이 직접 구현
memo: dict[int, int] = {}

def fib_memo(n: int) -> int:
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1) + fib_memo(n - 2)
    return memo[n]
```

`fib(40)`을 순수 재귀로 부르면 약 3억 번 호출되지만, 메모이제이션을 붙이면 41번만 호출됩니다. 각 `n`에 대해 처음 한 번만 계산하고 이후엔 O(1)에 조회하기 때문입니다.

![메모이제이션 vs 타뷸레이션 비교](/assets/posts/dsa-memoization-vs-tabulation-compare.svg)

**장점:** 점화식을 거의 그대로 코드로 옮길 수 있어 구현이 직관적입니다. 불필요한 하위 문제를 건너뛸 수 있어 희소(Sparse) DP에 유리합니다. **단점:** 재귀 호출 스택이 쌓이므로, 파이썬 기본 재귀 한도(1000)를 초과하는 `n`에서는 `sys.setrecursionlimit`을 늘리거나 다른 전략이 필요합니다.

## 타뷸레이션: Bottom-Up 접근

타뷸레이션은 작은 하위 문제부터 순서대로 풀어 테이블을 채워 올라가는 방식입니다(Bottom-Up). 재귀 대신 반복문을 사용하므로 호출 스택 문제가 없습니다.

```python
def fib_tab(n: int) -> int:
    if n <= 1:
        return n
    dp = [0] * (n + 1)
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
```

반복 순서가 중요합니다. `dp[i]`를 채울 때 `dp[i-1]`과 `dp[i-2]`가 이미 완성되어 있어야 하므로 작은 인덱스부터 큰 인덱스 방향으로 순회합니다.

## 공간 최적화: 슬라이딩 윈도우

타뷸레이션에서 전체 배열이 필요하지 않고 직전 몇 개 값만 필요한 경우, 배열 대신 변수만으로 공간을 줄일 수 있습니다.

```python
def fib_opt(n: int) -> int:
    if n <= 1:
        return n
    prev, curr = 0, 1
    for _ in range(2, n + 1):
        prev, curr = curr, prev + curr
    return curr

# 시간: O(n), 공간: O(1)
```

피보나치의 경우 O(n)이었던 공간이 O(1)로 줄어듭니다. 2D DP에서도 현재 행을 계산할 때 이전 행만 필요하다면 1D 배열로 줄일 수 있습니다.

![공간 최적화 슬라이딩 윈도우](/assets/posts/dsa-memoization-vs-tabulation-space.svg)

## 실전 예제: 계단 오르기 (LeetCode 70)

한 번에 1칸 또는 2칸 오를 수 있을 때 n칸 계단을 오르는 경우의 수를 구하는 문제입니다. 점화식은 피보나치와 동일합니다: `dp[i] = dp[i-1] + dp[i-2]`.

```python
def climb_stairs(n: int) -> int:
    if n <= 2:
        return n
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b

# climb_stairs(5) => 8
# 1+1+1+1+1, 2+1+1+1, 1+2+1+1, 1+1+2+1,
# 1+1+1+2, 2+2+1, 2+1+2, 1+2+2
```

## 선택 기준

| 상황 | 추천 전략 |
|---|---|
| 점화식이 복잡하거나 희소 DP | 메모이제이션 |
| 호출 스택 한계가 걱정되는 큰 n | 타뷸레이션 |
| 공간을 최대한 아껴야 할 때 | 타뷸레이션 + 슬라이딩 윈도우 |
| 빠른 프로토타이핑 | `@functools.lru_cache` |

메모이제이션은 문제 구조를 이해하기 더 쉽게 만들고, 타뷸레이션은 성능과 메모리 효율을 더 잘 제어할 수 있습니다. 복잡한 DP 문제에서는 먼저 메모이제이션으로 정확도를 검증한 뒤, 타뷸레이션으로 최적화하는 두 단계 접근이 효과적입니다.

---

**다음 글:** [배낭 문제 (Knapsack Problem)](/posts/dsa-knapsack/)

<br>
읽어주셔서 감사합니다. 😊
