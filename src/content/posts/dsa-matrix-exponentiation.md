---
title: "행렬 거듭제곱: 점화식을 O(log n)에 푸는 법"
description: "선형 점화식을 전이 행렬로 표현하고 행렬 빠른 거듭제곱으로 n번째 항을 O(k³ log n)에 구하는 기법을 분석합니다. 피보나치 행렬 항등식, 일반 점화식의 행렬화, 그래프 경로 개수 세기 응용까지 구현합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["행렬거듭제곱", "전이행렬", "피보나치", "선형점화식", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-combinatorics-binomial/)에서 nCr을 O(1) 쿼리로 만드는 전처리를 다뤘습니다. 이번 글은 정수론 파트의 마무리이자 하이라이트인 **행렬 거듭제곱(Matrix Exponentiation)**입니다. "피보나치 10¹⁸번째 항을 1e9+7로 나눈 나머지"처럼 **DP 배열을 채울 수조차 없는 거대한 n**도, 점화식을 행렬로 바꾸면 O(log n)에 풀립니다. 모듈러 거듭제곱 글에서 익힌 반복 제곱법이 숫자에서 행렬로 확장되는 순간입니다.

## 출발점: 피보나치 행렬 항등식

피보나치 점화식 F(n+1) = F(n) + F(n−1)을 벡터와 행렬로 다시 쓰면:

```text
[F(n+1)]   [1 1] [F(n)  ]
[F(n)  ] = [1 0] [F(n-1)]
```

행렬 M = [[1,1],[1,0]]을 **한 번 곱할 때마다 수열이 한 칸 전진**합니다. n칸 전진은 Mⁿ이므로 다음 항등식이 성립합니다.

![피보나치 행렬 항등식](/assets/posts/dsa-matrix-exponentiation-fibonacci.svg)

```text
[1 1]ⁿ   [F(n+1)  F(n)  ]
[1 0]  = [F(n)    F(n-1)]
```

이제 문제는 "Mⁿ을 빨리 구하기"로 바뀌었고, 행렬 곱은 **결합법칙이 성립**하므로 숫자와 똑같이 반복 제곱법을 쓸 수 있습니다.

## 행렬 빠른 거듭제곱 구현

![행렬 빠른 거듭제곱](/assets/posts/dsa-matrix-exponentiation-fast.svg)

```python
MOD = 1_000_000_007

def mat_mul(A: list, B: list) -> list:
    n, m, k = len(A), len(B[0]), len(B)
    C = [[0] * m for _ in range(n)]
    for i in range(n):
        for j in range(m):
            s = 0
            for t in range(k):
                s += A[i][t] * B[t][j]
            C[i][j] = s % MOD
    return C

def mat_pow(M: list, n: int) -> list:
    size = len(M)
    result = [[int(i == j) for j in range(size)]  # 단위 행렬
              for i in range(size)]
    while n > 0:
        if n & 1:
            result = mat_mul(result, M)
        M = mat_mul(M, M)
        n >>= 1
    return result

def fibonacci(n: int) -> int:
    if n == 0:
        return 0
    return mat_pow([[1, 1], [1, 0]], n)[0][1]

print(fibonacci(10))                # 55
print(fibonacci(10 ** 18))          # O(log n)으로 즉시 계산
```

구조가 모듈러 거듭제곱의 `pow_mod`와 완전히 동일합니다. 숫자 1이 단위 행렬로, 숫자 곱이 행렬 곱으로 바뀌었을 뿐입니다.

## 복잡도

k×k 행렬 곱 한 번이 O(k³)이고 log n번 수행하므로 전체 **O(k³ log n)**입니다.

| 방법 | 피보나치 F(10¹⁸) |
|------|------------------|
| 단순 DP O(n) | 불가능 (10¹⁸ 스텝) |
| 행렬 거듭제곱 O(k³ log n) | 2³ × 60 ≈ 480회 곱셈 |

## 일반 선형 점화식의 행렬화

차수 k인 선형 점화식은 모두 같은 방법으로 변환됩니다.

> a(n) = c₁a(n−1) + c₂a(n−2) + … + cₖa(n−k)

```text
[a(n)  ]   [c₁ c₂ ... cₖ₋₁ cₖ] [a(n-1)]
[a(n-1)]   [1  0  ...  0   0 ] [a(n-2)]
[a(n-2)] = [0  1  ...  0   0 ] [a(n-3)]
[  ...  ]   [...              ] [  ... ]
[a(n-k+1)] [0  0  ...  1   0 ] [a(n-k)]
```

첫 행이 점화식 계수, 나머지 행은 "이전 값들을 한 칸씩 미는" 시프트입니다. 예를 들어 트리보나치 T(n) = T(n−1) + T(n−2) + T(n−3):

```python
def tribonacci(n: int) -> int:
    if n < 3:
        return [0, 1, 1][n]
    M = [[1, 1, 1],
         [1, 0, 0],
         [0, 1, 0]]
    P = mat_pow(M, n - 2)
    # [T(n)] = P · [T(2), T(1), T(0)]
    return (P[0][0] * 1 + P[0][1] * 1 + P[0][2] * 0) % MOD
```

**상수항이 있는 점화식**(예: a(n) = 2a(n−1) + 3)은 상태 벡터에 상수 1을 한 칸 추가해 (k+1)×(k+1) 행렬로 처리합니다.

```text
[a(n)]   [2 3] [a(n-1)]
[ 1  ] = [0 1] [  1   ]
```

누적 합 S(n) = S(n−1) + a(n)이 필요한 경우도 같은 요령으로 상태에 S를 추가하면 됩니다.

## 응용: 그래프에서 길이 n인 경로 개수

행렬 거듭제곱의 또 다른 얼굴입니다. 인접 행렬 A에 대해 **Aⁿ[i][j] = i에서 j로 가는 길이 n짜리 경로의 개수**입니다.

행렬 곱의 정의 자체가 "중간 정점 t를 거치는 경로 합산"이기 때문입니다.

```python
def count_paths(adj: list, n: int, src: int, dst: int) -> int:
    """길이 정확히 n인 src → dst 경로 수 (mod 1e9+7)"""
    return mat_pow(adj, n)[src][dst]

# 삼각형 그래프 0-1-2-0 에서 길이 3인 0→0 경로
adj = [[0, 1, 1],
       [1, 0, 1],
       [1, 1, 0]]
print(count_paths(adj, 3, 0, 0))  # 2 (0→1→2→0, 0→2→1→0)
```

"n번 이동 후 특정 상태에 있을 경우의 수" 류의 문제(체스 나이트 이동, 문자열 오토마톤 상태 전이 등)가 전부 이 패턴입니다. n이 10⁹ 이상으로 거대한데 상태 수가 작다면 행렬 거듭제곱을 의심하면 됩니다.

## 어떤 문제가 행렬 거듭제곱 감일까

세 가지 신호를 확인하세요.

1. **점화식이 선형이다** — 이전 항들의 상수배 합 (max, 곱셈, 조건문이 끼면 불가)
2. **n이 거대하다** — 10⁹ 이상이라 O(n) DP가 불가능
3. **상태 수 k가 작다** — k³ log n이 감당 가능 (k ≤ 100 수준)

| 문제 유형 | 전이 행렬 크기 |
|----------|---------------|
| 피보나치/트리보나치 | 2×2 / 3×3 |
| 상수항 포함 점화식 | (k+1)×(k+1) |
| 누적 합 동시 계산 | (k+1)×(k+1) |
| 그래프 경로 카운팅 | V×V |

다음 글에서는 피보나치 수를 둘러싼 다양한 계산 기법(빠른 배가 공식, 피사노 주기 등)을 한 번에 정리합니다.

---

**지난 글:** [조합론과 이항계수: nCr을 빠르게 계산하기](/posts/dsa-combinatorics-binomial/)

<br>
읽어주셔서 감사합니다. 😊
