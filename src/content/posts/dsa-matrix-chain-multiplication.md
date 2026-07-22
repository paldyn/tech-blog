---
title: "행렬 연쇄 곱셈 (Matrix Chain Multiplication)"
description: "행렬 연쇄 곱셈의 최적 괄호 순서를 구간 DP로 O(n³)에 찾는 알고리즘을 점화식 도출부터 코드 구현, 분할 위치 역추적까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "구간DP", "행렬연쇄곱셈", "Matrix Chain", "IntervalDP"]
featured: false
draft: false
---

[지난 글](/posts/dsa-coin-change/)에서 동전 교환 문제로 무한 배낭 패턴을 연습했습니다. 이번에는 **구간 DP(Interval DP)**의 대표 예제인 행렬 연쇄 곱셈을 다룹니다. "어떤 순서로 행렬을 곱하느냐"에 따라 연산 횟수가 수십 배 달라질 수 있습니다. DP로 이 최적 순서를 O(n³)에 찾는 방법을 살펴봅니다.

## 왜 순서가 중요한가?

행렬 곱셈은 결합 법칙이 성립합니다: (A·B)·C = A·(B·C). 하지만 **계산 비용은 순서에 따라 크게 달라집니다.**

예: A(10×30), B(30×5), C(5×60)
- (A·B)·C: A·B 비용 10×30×5=1500, 결과(10×5)·C 비용 10×5×60=3000 → **합계 4500**
- A·(B·C): B·C 비용 30×5×60=9000, A·결과 비용 10×30×60=18000 → **합계 27000**

두 순서의 차이가 **6배**입니다. 행렬 n개를 곱하는 모든 괄호 방법은 카탈란 수로 지수적으로 늘어나므로, 완전 탐색은 실용적이지 않습니다.

## 구간 DP 점화식

`dp[i][j]` = 행렬 i번부터 j번까지 곱하는 **최소 스칼라 곱셈 횟수** (1-indexed).
`dims[0..n]` = 크기 배열 (행렬 i의 크기는 `dims[i-1] × dims[i]`).

```text
dp[i][i] = 0                                         (단일 행렬)
dp[i][j] = min over k (i ≤ k < j):
             dp[i][k] + dp[k+1][j] + dims[i-1]*dims[k]*dims[j]
```

핵심 아이디어: `k`번째 행렬 다음에서 두 그룹으로 나눈다. 왼쪽 그룹 `i..k`와 오른쪽 그룹 `k+1..j`를 각각 최적으로 계산한 뒤, 두 결과 행렬을 곱하는 비용을 더합니다.

![행렬 연쇄 곱셈 DP 테이블](/assets/posts/dsa-matrix-chain-multiplication-dp.svg)

## 구현: Bottom-Up 구간 DP

```python
def matrix_chain(dims: list) -> int:
    n = len(dims) - 1   # 행렬 개수
    # dp[i][j]: i..j 행렬 곱 최소 비용 (0-indexed)
    dp = [[0] * n for _ in range(n)]

    # 구간 길이가 짧은 것부터 채운다
    for length in range(2, n + 1):          # 구간 길이 2, 3, ..., n
        for i in range(n - length + 1):     # 시작 인덱스
            j = i + length - 1             # 끝 인덱스
            dp[i][j] = float('inf')
            for k in range(i, j):           # 분할 위치
                cost = (dp[i][k]
                        + dp[k + 1][j]
                        + dims[i] * dims[k + 1] * dims[j + 1])
                dp[i][j] = min(dp[i][j], cost)

    return dp[0][n - 1]

# A(10x30), B(30x5), C(5x60)
print(matrix_chain([10, 30, 5, 60]))  # 4500
```

시간 복잡도 O(n³): 구간 n²개 × 각 구간에서 O(n) 분할 탐색. 공간 O(n²).

![분할 위치 k별 트리 구조](/assets/posts/dsa-matrix-chain-multiplication-split.svg)

## 역추적: 최적 괄호 순서 복원

어떤 순서로 곱해야 하는지 복원하려면 최적 분할 위치 `split[i][j]`를 함께 기록합니다.

```python
def matrix_chain_with_order(dims: list):
    n = len(dims) - 1
    dp = [[0] * n for _ in range(n)]
    split = [[0] * n for _ in range(n)]

    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            dp[i][j] = float('inf')
            for k in range(i, j):
                cost = (dp[i][k]
                        + dp[k + 1][j]
                        + dims[i] * dims[k + 1] * dims[j + 1])
                if cost < dp[i][j]:
                    dp[i][j] = cost
                    split[i][j] = k   # 최적 분할 위치 저장

    def print_order(i: int, j: int) -> str:
        if i == j:
            return f"A{i + 1}"
        k = split[i][j]
        left = print_order(i, k)
        right = print_order(k + 1, j)
        return f"({left} × {right})"

    return dp[0][n - 1], print_order(0, n - 1)

cost, order = matrix_chain_with_order([10, 30, 5, 60])
print(f"최소 비용: {cost}, 순서: {order}")
# 최소 비용: 4500, 순서: ((A1 × A2) × A3)
```

## 응용

행렬 연쇄 곱셈과 동일한 구간 DP 패턴은 다음 문제들에도 적용됩니다:

| 문제 | 상태 | 점화식 |
|---|---|---|
| 풍선 터뜨리기 (Burst Balloons) | dp[i][j] = 구간 [i..j] 최대 점수 | k가 마지막으로 터지는 풍선 |
| 최적 이진 탐색 트리 | dp[i][j] = 키 i..j 구성 최소 비용 | k가 루트 |
| 돌 합치기 | dp[i][j] = 돌 i..j 합치는 최소 비용 | 구간 분할 |

공통점은 **구간 [i..j]를 두 부분으로 나눠 최적화**한다는 것입니다. 길이가 짧은 구간부터 채우는 bottom-up 방식이 핵심입니다.

---

**지난 글:** [동전 교환 문제](/posts/dsa-coin-change/)

**다음 글:** [구간 DP (Interval DP)](/posts/dsa-interval-dp/)

<br>
읽어주셔서 감사합니다. 😊
