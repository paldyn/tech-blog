---
title: "소인수분해: √n 시도 분할에서 폴라드 로까지"
description: "O(√n) 시도 분할, SPF 테이블로 O(log n) 다중 쿼리 분해, 밀러-라빈 소수 판정과 폴라드 로 알고리즘으로 64비트 수를 분해하는 방법까지 단계별로 구현합니다. 약수 개수·합 공식 응용도 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["소인수분해", "폴라드로", "밀러라빈", "SPF", "정수론"]
featured: false
draft: false
---

[지난 글](/posts/dsa-sieve-of-eratosthenes/)에서 체로 소수 목록과 최소 소인수(SPF) 테이블을 만들었습니다. 이번에는 그 도구들로 **소인수분해(Prime Factorization)** 문제를 풉니다. 산술의 기본 정리에 따라 모든 자연수는 소수의 곱으로 유일하게 표현되며, 약수 개수·약수 합·오일러 피 함수 등 수많은 정수론 값이 소인수분해에서 곧바로 나옵니다. 작은 수는 √n 시도 분할로, 다중 쿼리는 SPF로, 64비트 거대 수는 폴라드 로로 — 규모별 표준 무기를 모두 갖춰 봅니다.

## 방법 1: 시도 분할 — O(√n)

2부터 차례로 나눠 보며, 나누어떨어지는 동안 계속 나눕니다.

![시도 분할](/assets/posts/dsa-prime-factorization-trial.svg)

```python
def factorize(n: int) -> dict:
    factors = {}
    d = 2
    while d * d <= n:
        while n % d == 0:
            factors[d] = factors.get(d, 0) + 1
            n //= d
        d += 1
    if n > 1:
        factors[n] = factors.get(n, 0) + 1  # 남은 수는 소수
    return factors

print(factorize(360))  # {2: 3, 3: 2, 5: 1}
```

핵심 포인트 두 가지:

- **d² ≤ n까지만** 시도합니다. n이 √n보다 큰 소인수를 두 개 가질 수는 없으므로, 루프가 끝나고 남은 n > 1은 그 자체로 소수입니다
- 2를 처리한 뒤 홀수만 시도하면 상수가 절반으로 줄어듭니다

n ≤ 10¹² 정도까지는 이 방법으로 충분합니다 (√n = 10⁶회 나눗셈).

## 방법 2: SPF 테이블 — 쿼리당 O(log n)

"수십만 개의 수를 각각 분해하라"는 다중 쿼리에서는 시도 분할이 너무 느립니다. 지난 글의 선형 체로 만든 **최소 소인수 테이블**이 있으면, 최소 소인수로 계속 나누기만 하면 됩니다.

```python
def linear_sieve_spf(n: int) -> list:
    spf = [0] * (n + 1)
    primes = []
    for i in range(2, n + 1):
        if spf[i] == 0:
            spf[i] = i
            primes.append(i)
        for p in primes:
            if p > spf[i] or i * p > n:
                break
            spf[i * p] = p
    return spf

spf = linear_sieve_spf(1_000_000)

def factorize_fast(n: int) -> dict:
    factors = {}
    while n > 1:
        p = spf[n]
        while n % p == 0:
            factors[p] = factors.get(p, 0) + 1
            n //= p
    return factors
```

매번 최소 2로 나뉘므로 단계 수는 O(log n)입니다. 전처리 O(MAX) 후 쿼리당 O(log n) — 다중 쿼리의 정석입니다.

## 응용: 약수 개수와 약수 합

n = p₁^a₁ × p₂^a₂ × … 일 때:

```text
약수 개수 d(n) = (a₁+1)(a₂+1)...
약수 합   σ(n) = Π (pᵢ^(aᵢ+1) − 1) / (pᵢ − 1)
```

```python
def divisor_count(n: int) -> int:
    result = 1
    for exp in factorize(n).values():
        result *= exp + 1
    return result

print(divisor_count(360))  # 24
```

360 = 2³·3²·5 → (3+1)(2+1)(1+1) = 24개입니다.

## 방법 3: 폴라드 로 — 64비트 수의 분해

n ≈ 10¹⁸이면 √n = 10⁹라 시도 분할도 무리입니다. **폴라드 로(Pollard's Rho)**는 기대 O(n^(1/4))에 약수 하나를 찾는 확률적 알고리즘입니다.

원리는 생일 역설입니다. 수열 `xᵢ₊₁ = (xᵢ² + c) mod n`을 **mod p** (p는 n의 미지의 소인수)로 보면, 유한 집합 위의 수열이므로 반드시 ρ(로) 모양으로 순환합니다. 기대 O(√p) = O(n^(1/4))번 안에 `xᵢ ≡ xⱼ (mod p)`인 충돌이 생기고, 그때 `gcd(|xᵢ − xⱼ|, n)`이 p의 배수가 되어 약수가 드러납니다.

![폴라드 로](/assets/posts/dsa-prime-factorization-pollard.svg)

순환 탐지는 플로이드의 거북-토끼 기법을 씁니다.

```python
import random
from math import gcd

def pollard_rho(n: int) -> int:
    """n의 자명하지 않은 약수 하나 반환 (n은 합성수)"""
    if n % 2 == 0:
        return 2
    while True:
        c = random.randrange(1, n)
        f = lambda x: (x * x + c) % n
        x = y = random.randrange(2, n)
        d = 1
        while d == 1:
            x = f(x)          # 거북: 1칸
            y = f(f(y))       # 토끼: 2칸
            d = gcd(abs(x - y), n)
        if d != n:            # 실패(d==n)면 c 바꿔 재시도
            return d
```

## 밀러-라빈과 결합한 완전한 분해기

폴라드 로는 "합성수에서 약수 찾기"만 합니다. 재귀 분해에는 **소수 판정**이 필요하고, 그 역할은 밀러-라빈(Miller-Rabin) 테스트가 맡습니다. 64비트 범위는 고정된 밑 집합으로 **결정적**으로 판정됩니다.

```python
def is_prime(n: int) -> bool:
    if n < 2:
        return False
    for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % p == 0:
            return n == p
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    for a in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = x * x % n
            if x == n - 1:
                break
        else:
            return False
    return True

def full_factorize(n: int) -> dict:
    factors = {}

    def rec(m):
        if m == 1:
            return
        if is_prime(m):
            factors[m] = factors.get(m, 0) + 1
            return
        d = pollard_rho(m)
        rec(d)
        rec(m // d)

    rec(n)
    return factors

print(full_factorize(9_007_199_254_740_993))  # 큰 수도 순식간
```

## 규모별 선택 가이드

| n의 크기 | 방법 | 복잡도 |
|----------|------|--------|
| n ≤ 10¹² | 시도 분할 | O(√n) |
| 다중 쿼리, n ≤ 10⁷ | SPF 테이블 | 전처리 O(MAX) + 쿼리 O(log n) |
| n ≤ 10¹⁸ | 밀러-라빈 + 폴라드 로 | 기대 O(n^(1/4)) |
| 수백 비트 (RSA급) | 현존 알고리즘으로 사실상 불가 | — |

마지막 줄이 중요합니다. **큰 수의 소인수분해가 어렵다는 사실 자체가 RSA 암호의 안전성 근거**입니다. 우리가 방금 구현한 폴라드 로조차 2048비트 수 앞에서는 무력합니다.

---

**지난 글:** [에라토스테네스의 체: 소수를 한 번에 거르기](/posts/dsa-sieve-of-eratosthenes/)

**다음 글:** [조합론과 이항계수: nCr을 빠르게 계산하기](/posts/dsa-combinatorics-binomial/)

<br>
읽어주셔서 감사합니다. 😊
