---
title: "동적 프로그래밍 입문 (Dynamic Programming)"
description: "동적 프로그래밍의 두 조건(최적 부분 구조·겹치는 부분 문제), 메모이제이션과 타뷸레이션, 피보나치로 시작하는 DP 사고법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "DP", "메모이제이션", "타뷸레이션", "최적부분구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-huffman-coding/)에서 탐욕 알고리즘으로 최적 압축 코드를 생성하는 허프만 코딩을 살펴봤습니다. 이번에는 알고리즘 설계 기법 중 가장 강력하고 폭넓게 쓰이는 **동적 프로그래밍(Dynamic Programming, DP)**을 소개합니다. "동적"이라는 이름은 1950년대 리처드 벨만이 군사 예산 문제를 설명하기 위해 붙인 표현으로, 실제로는 **하위 문제의 결과를 저장해 중복 계산을 제거**하는 기법입니다. 탐욕이 단방향으로 나아가는 것과 달리, DP는 모든 가능한 하위 문제를 체계적으로 해결합니다.

## DP의 두 가지 핵심 조건

동적 프로그래밍이 적용되려면 두 가지 조건이 반드시 성립해야 합니다.

1. **최적 부분 구조(Optimal Substructure)**: 문제의 최적해가 하위 문제의 최적해로 구성됩니다. `fib(n) = fib(n-1) + fib(n-2)`처럼 상위 문제가 하위 문제의 결합으로 표현됩니다.

2. **겹치는 부분 문제(Overlapping Subproblems)**: 동일한 하위 문제가 여러 번 반복적으로 계산됩니다. 단순 분할 정복과 DP의 결정적 차이입니다. 분할 정복(예: 병합 정렬)은 하위 문제가 겹치지 않아 저장이 불필요하지만, DP는 겹치기 때문에 저장이 핵심입니다.

![겹치는 부분 문제](/assets/posts/dsa-dynamic-programming-intro-overlap.svg)

fib(5)의 재귀 트리를 보면 fib(3)이 2번, fib(2)가 3번 계산됩니다. n이 커질수록 이 중복이 지수적으로 늘어나 O(2ⁿ) 복잡도가 됩니다.

## 두 가지 구현 방식

### 메모이제이션 (탑다운 / Top-Down)

재귀 구조를 유지하면서 딕셔너리나 배열에 결과를 캐싱합니다.

```python
def fib_memo(n, memo={}):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n-1) + fib_memo(n-2)
    return memo[n]

# 각 fib(i)는 정확히 1번만 계산
# 시간: O(N), 공간: O(N)
```

메모이제이션은 **필요한 부분 문제만 계산**하기 때문에 모든 하위 문제가 필요하지 않은 경우에도 효율적입니다.

### 타뷸레이션 (바텀업 / Bottom-Up)

작은 문제부터 순서대로 반복문으로 채워 올라갑니다.

```python
def fib_dp(n):
    if n <= 1: return n
    dp = [0] * (n + 1)
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i-1] + dp[i-2]
    return dp[n]

# dp table for n=7:
# i:  0  1  2  3  4  5  6  7
# dp: 0  1  1  2  3  5  8 13
```

![DP 타뷸레이션](/assets/posts/dsa-dynamic-programming-intro-table.svg)

타뷸레이션은 **스택 오버플로 위험이 없고**, 반복문으로 구현되어 캐시 친화적입니다. 대부분의 실무 코드에서 선호합니다.

## 메모이제이션 vs 타뷸레이션 비교

| 구분 | 메모이제이션 | 타뷸레이션 |
|------|------------|----------|
| 방향 | 탑다운 (재귀) | 바텀업 (반복) |
| 구현 | 직관적 | 약간 더 복잡 |
| 스택 | 깊은 재귀 위험 | 안전 |
| 불필요 계산 | 건너뜀 | 모두 계산 |
| 캐시 효율 | 낮음 | 높음 |

## 공간 최적화

피보나치처럼 현재 값이 바로 이전 두 값에만 의존하는 경우, O(N) 배열 대신 O(1) 변수 두 개로 해결 가능합니다.

```python
def fib_opt(n):
    if n <= 1: return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

# 시간: O(N), 공간: O(1)
```

## DP 사고법 — 점화식 설계

DP 문제를 풀 때는 다음 순서로 접근합니다.

1. **상태 정의**: dp[i]가 무엇을 의미하는지 명확히 정의
2. **점화식 도출**: dp[i]를 더 작은 상태의 함수로 표현
3. **기저 조건 설정**: dp[0], dp[1] 등 초기값
4. **계산 순서 결정**: 어떤 순서로 채울지

```python
# 예: 계단 오르기 (1칸 또는 2칸)
# dp[i] = i번째 계단에 오르는 방법의 수
# dp[i] = dp[i-1] + dp[i-2]  (피보나치와 동일!)
# dp[1] = 1, dp[2] = 2

def climb_stairs(n):
    if n <= 2: return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i-1] + dp[i-2]
    return dp[n]
```

## 탐욕 vs DP 최종 비교

탐욕 알고리즘과 DP 모두 최적 부분 구조를 이용하지만, 선택 방식이 다릅니다.

- **탐욕**: 매 단계 현재 최선 선택, O(N log N), 검증 필요
- **DP**: 모든 하위 문제 저장 후 비교, O(N²)~, 더 일반적

대표 DP 문제로는 배낭 문제(Knapsack), 최장 공통 부분 수열(LCS), 편집 거리(Edit Distance), 행렬 체인 곱셈 등이 있습니다. 이어지는 글에서 각각을 자세히 다룰 예정입니다.

---

**지난 글:** [허프만 코딩 (Huffman Coding)](/posts/dsa-huffman-coding/)

**다음 글:** [메모이제이션 vs 타뷸레이션: DP 구현 전략 완전 비교](/posts/dsa-memoization-vs-tabulation/)

<br>
읽어주셔서 감사합니다. 😊
