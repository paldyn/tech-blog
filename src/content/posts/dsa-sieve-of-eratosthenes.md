---
title: "에라토스테네스의 체: 소수를 한 번에 거르기"
description: "에라토스테네스의 체로 1~n의 모든 소수를 O(n log log n)에 구하는 원리와 p²부터 지우기·√n 한계 최적화를 분석합니다. 비트 체·구간 체(Segmented Sieve)·선형 체와 최소 소인수 테이블까지 실전 변형을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["에라토스테네스", "소수", "체", "선형체", "정수론"]
featured: false
draft: false
---

[지난 글](/posts/dsa-modular-inverse/)에서 페르마 소정리를 쓰려면 "모듈러가 소수"라는 조건이 필요했습니다. 그렇다면 소수는 어떻게 빨리 찾을까요? 수 하나의 소수 판정은 √n 나눗셈이면 되지만, **1부터 n까지 모든 소수**가 필요하면 이야기가 다릅니다. 기원전 3세기 그리스의 에라토스테네스가 고안한 **체(Sieve)**는 지금도 이 문제의 표준 해법입니다.

## 아이디어: 지우고 남는 것이 소수

1. 2부터 n까지 모든 수를 후보로 적는다
2. 가장 작은 살아있는 수(=소수)를 찾고, **그 배수를 전부 지운다**
3. 반복하면 끝까지 살아남은 수가 전부 소수

![에라토스테네스의 체](/assets/posts/dsa-sieve-of-eratosthenes-grid.svg)

```python
def sieve(n: int) -> list:
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False

    for p in range(2, int(n ** 0.5) + 1):
        if is_prime[p]:
            for multiple in range(p * p, n + 1, p):
                is_prime[multiple] = False

    return [i for i in range(n + 1) if is_prime[i]]

print(sieve(30))  # [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
```

## 두 가지 핵심 최적화

위 코드에는 이미 두 개의 고전 최적화가 들어 있습니다.

**1) p²부터 지운다** — p의 배수 중 2p, 3p, …, (p−1)p는 더 작은 소인수(2, 3, …)에 의해 이미 지워졌습니다. 처음 만나는 "새로운" 배수는 p²입니다.

**2) √n까지만 바깥 루프를 돈다** — n 이하의 합성수는 반드시 √n 이하의 소인수를 가집니다. 따라서 √n 이하 소수의 배수만 지우면 충분합니다. n = 30이면 2, 3, 5의 배수만 지우고 끝입니다.

## 복잡도: O(n log log n)

각 소수 p마다 약 n/p개의 배수를 지우므로 전체 작업량은:

```text
n/2 + n/3 + n/5 + n/7 + ... = n × Σ(1/p)
```

소수의 역수 합은 log log n으로 발산한다는 메르텐스의 정리에 의해 전체는 **O(n log log n)** — 사실상 선형에 가깝습니다. n = 10⁸도 수 초 안에 처리됩니다.

## 메모리 절약: 비트 체와 홀수만 저장

n이 크면 bool 배열(1바이트/원소)이 부담스럽습니다. 두 가지 표준 기법이 있습니다.

```python
# 홀수만 저장: 메모리 절반, 인덱스 i ↔ 수 2i+1
def sieve_odd(n: int) -> list:
    if n < 2:
        return []
    size = (n + 1) // 2
    is_prime = bytearray([1]) * size   # 인덱스 i는 수 2i+1
    is_prime[0] = 0                    # 1은 소수 아님

    i = 1
    while (2 * i + 1) ** 2 <= n:
        if is_prime[i]:
            p = 2 * i + 1
            for j in range((p * p) // 2, size, p):
                is_prime[j] = 0
        i += 1

    return [2] + [2 * i + 1 for i in range(size) if is_prime[i]]
```

C++에서는 `vector<bool>`이나 `bitset`이 자동으로 비트 패킹을 해 줘서 10⁸ 범위도 약 12MB로 처리됩니다.

## 구간 체 (Segmented Sieve)

"10¹² ~ 10¹² + 10⁶ 사이의 소수"처럼 **시작점이 거대한 구간**은 전체 배열을 만들 수 없습니다. 이때는 √R 이하의 소수만 일반 체로 구한 뒤, 대상 구간만 따로 지웁니다.

```python
def segmented_sieve(lo: int, hi: int) -> list:
    base_primes = sieve(int(hi ** 0.5) + 1)
    is_prime = [True] * (hi - lo + 1)

    for p in base_primes:
        start = max(p * p, (lo + p - 1) // p * p)  # 구간 내 첫 배수
        for m in range(start, hi + 1, p):
            is_prime[m - lo] = False

    if lo == 1:
        is_prime[0] = False
    return [lo + i for i, ok in enumerate(is_prime) if ok]
```

메모리는 O(구간 길이 + √R)뿐입니다. 캐시 지역성이 좋아 같은 범위라도 통짜 체보다 빠른 경우가 많아, 대규모 체는 내부적으로 블록 단위 구간 체로 구현하는 것이 정석입니다.

## 선형 체와 최소 소인수(SPF) 테이블

에라토스테네스 체는 12를 2의 배수로 한 번, 3의 배수로 또 한 번 지웁니다. 이 중복을 없앤 것이 **선형 체(Linear Sieve)**입니다. 규칙은 하나: **모든 합성수를 "최소 소인수 × 나머지" 조합으로 정확히 한 번만 지운다.**

![선형 체와 SPF 테이블](/assets/posts/dsa-sieve-of-eratosthenes-linear.svg)

```python
def linear_sieve(n: int):
    spf = [0] * (n + 1)      # smallest prime factor
    primes = []

    for i in range(2, n + 1):
        if spf[i] == 0:       # i는 소수
            spf[i] = i
            primes.append(i)
        for p in primes:
            if p > spf[i] or i * p > n:
                break
            spf[i * p] = p    # i*p의 최소 소인수는 p

    return primes, spf
```

`p > spf[i]`에서 끊는 것이 핵심입니다. 12 = 2×6으로만 지워지고 3×4로는 지워지지 않으므로 전체가 정확히 **O(n)**입니다. 덤으로 얻는 `spf` 테이블은 다음 글의 주인공인 **소인수분해를 O(log n)**으로 만들어 줍니다.

## 어떤 체를 쓸까

| 상황 | 선택 | 복잡도 |
|------|------|--------|
| n ≤ 10⁷, 소수 목록만 필요 | 기본 체 | O(n log log n) |
| n ≤ 10⁸, 메모리 부담 | 비트 체 + 홀수만 | O(n log log n), n/16 바이트 |
| 시작점이 거대한 구간 | 구간 체 | O(구간 + √R) |
| 소인수분해도 필요 | 선형 체 + SPF | O(n) |

실전 팁: 대부분의 문제는 기본 체로 충분합니다. 선형 체는 SPF 테이블이나 곱셈적 함수(오일러 피 등) 전처리가 필요할 때 진가를 발휘합니다.

---

**지난 글:** [모듈러 역원: 나머지 세계의 나눗셈](/posts/dsa-modular-inverse/)

**다음 글:** [소인수분해: √n 시도 분할에서 폴라드 로까지](/posts/dsa-prime-factorization/)

<br>
읽어주셔서 감사합니다. 😊
