---
title: "피보나치 계산 기법: 빠른 배가 공식과 피사노 주기"
description: "피보나치 수를 빠르게 계산하는 기법을 총정리합니다. O(log n) 빠른 배가(fast doubling) 공식의 유도와 구현, 모듈러 환경에서 거대한 인덱스를 다루는 피사노 주기, 그리고 GCD·캐시 성질까지 실전 관점에서 분석합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["피보나치", "빠른배가", "피사노주기", "모듈러", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-matrix-exponentiation/)에서 선형 점화식을 전이 행렬로 바꿔 O(log n)에 푸는 법을 다뤘습니다. 행렬 거듭제곱은 피보나치를 빠르게 구하는 강력한 도구였지만, 피보나치만 놓고 보면 더 가볍고 빠른 전용 공식이 존재합니다. 이번 글은 정수론 파트의 마지막으로, 피보나치 수를 둘러싼 계산 기법을 한 번에 정리합니다. **빠른 배가(fast doubling)**, **피사노 주기(Pisano period)**, 그리고 자주 쓰이는 항등식까지 살펴봅니다.

## 왜 또 피보나치인가

피보나치는 단순 반복으로 O(n)에 구할 수 있습니다. 하지만 "F(10¹⁸)을 10⁹+7로 나눈 나머지" 같은 문제에서는 n이 너무 커서 배열을 채울 수조차 없습니다. 행렬 거듭제곱은 이를 O(log n) 행렬 곱으로 풀어주지만, 2×2 행렬 곱 한 번에 8번의 정수 곱셈이 필요합니다. 빠른 배가 공식은 같은 O(log n)에 곱셈 횟수를 절반 이하로 줄입니다.

## 빠른 배가 공식

핵심은 F(2k)와 F(2k+1)을 F(k), F(k+1)만으로 한 번에 계산하는 두 항등식입니다.

```text
F(2k)   = F(k) · ( 2·F(k+1) − F(k) )
F(2k+1) = F(k)² + F(k+1)²
```

이 공식은 행렬 항등식 Mⁿ에서 유도됩니다. M = [[1,1],[1,0]]일 때 M^(2k) = (M^k)²을 직접 전개하면 위 두 식이 그대로 나옵니다. 덕분에 n을 이진수로 보고 **최상위 비트부터** 한 칸씩 내려오며 (F(k), F(k+1)) 쌍을 배가하면 됩니다.

![빠른 배가 공식의 재귀 구조](/assets/posts/dsa-fibonacci-techniques-fast-doubling.svg)

구현은 재귀 한 줄로 깔끔하게 떨어집니다.

```python
def fib_pair(n):
    # (F(n), F(n+1))을 반환
    if n == 0:
        return (0, 1)
    a, b = fib_pair(n >> 1)        # (F(k), F(k+1)), k = n//2
    c = a * (2 * b - a)            # F(2k)
    d = a * a + b * b             # F(2k+1)
    if n & 1:
        return (d, c + d)          # n 홀수
    else:
        return (c, d)              # n 짝수

def fib(n):
    return fib_pair(n)[0]
```

재귀 깊이는 n의 비트 수, 즉 O(log n)입니다. 각 단계에서 곱셈은 3번뿐이라 행렬 곱의 8번보다 훨씬 경제적입니다.

## 모듈러 환경: 거대한 n 다루기

문제는 보통 "mod m"을 요구합니다. 모든 곱셈과 뺄셈에 `% MOD`를 붙이면 됩니다. 뺄셈 `2*b - a`가 음수가 될 수 있으니 `+ MOD` 후 `% MOD`로 보정합니다.

```python
MOD = 10**9 + 7

def fib_mod(n):
    if n == 0:
        return (0, 1)
    a, b = fib_mod(n >> 1)
    c = (a * ((2 * b - a) % MOD)) % MOD
    d = (a * a + b * b) % MOD
    return (d, (c + d) % MOD) if n & 1 else (c, d)
```

이 코드는 n = 10¹⁸ 도 약 60단계 만에 끝납니다.

## 피사노 주기

또 다른 강력한 도구는 **피사노 주기**입니다. F(n) mod m 수열은 반드시 주기적으로 반복되며, 그 주기를 π(m)이라 부릅니다. 예를 들어 mod 3에서 피보나치는 `0,1,1,2,0,2,2,1`이 끝없이 반복되어 π(3) = 8입니다.

![mod 3 피사노 주기](/assets/posts/dsa-fibonacci-techniques-pisano.svg)

주기가 존재하는 이유는 비둘기집 원리입니다. (F(n) mod m, F(n+1) mod m) 쌍은 m² 가지뿐이고, 피보나치는 직전 두 항으로 완전히 결정되므로 언젠가 같은 쌍이 반드시 다시 나타나 반복이 시작됩니다. 따라서 다음이 성립합니다.

```text
F(n) mod m = F( n mod π(m) ) mod m
```

주기를 미리 구해두면, 같은 m으로 들어오는 수많은 쿼리를 **작은 인덱스 테이블 조회**로 즉시 답할 수 있습니다. 주기 자체는 직접 돌려서 (0,1) 쌍이 다시 나오는 시점을 찾으면 됩니다.

```python
def pisano_period(m):
    prev, curr = 0, 1
    for i in range(m * m):
        prev, curr = curr, (prev + curr) % m
        if prev == 0 and curr == 1:
            return i + 1
    return 0

def fib_with_period(n, m):
    pi = pisano_period(m)
    n %= pi
    a, b = 0, 1
    for _ in range(n):
        a, b = b, (a + b) % m
    return a
```

작은 m에 대해 쿼리가 많을 때는 빠른 배가보다 피사노 주기 + 테이블이 더 빠릅니다.

## 알아두면 좋은 항등식

피보나치는 풍부한 정수론적 성질을 가집니다. 자주 등장하는 것들입니다.

```text
gcd( F(m), F(n) ) = F( gcd(m, n) )    # 정수성
F(1)+F(2)+…+F(n) = F(n+2) − 1         # 부분합
F(n−1)·F(n+1) − F(n)² = (−1)ⁿ          # 카시니 항등식
m | n  ⇒  F(m) | F(n)                  # 나눗셈 성질
```

특히 gcd 성질은 "두 피보나치 수의 최대공약수"를 묻는 문제를 단번에 처리해 줍니다.

## 기법 선택 가이드

상황에 맞는 기법을 정리하면 다음과 같습니다.

| 상황 | 권장 기법 | 복잡도 |
|---|---|---|
| 단일 거대 n, mod | 빠른 배가 | O(log n) |
| 작은 m, 쿼리 다수 | 피사노 주기 + 테이블 | 전처리 O(π) |
| 점화식 일반화 필요 | 행렬 거듭제곱 | O(k³ log n) |
| gcd·정수성 문제 | 피보나치 항등식 | O(1)~O(log) |

빠른 배가는 피보나치 전용으로 가장 빠르고, 행렬 거듭제곱은 일반 점화식까지 확장되는 범용 도구라는 점이 핵심 차이입니다.

다음 글부터는 새로운 파트인 **계산기하학(computational geometry)**을 시작합니다. 그 첫걸음으로 점과 벡터를 코드로 다루는 법을 살펴봅니다.

---

**지난 글:** [행렬 거듭제곱: 점화식을 O(log n)에 푸는 법](/posts/dsa-matrix-exponentiation/)

**다음 글:** [점과 벡터: 계산기하학의 출발점](/posts/dsa-points-and-vectors/)

<br>
읽어주셔서 감사합니다. 😊
