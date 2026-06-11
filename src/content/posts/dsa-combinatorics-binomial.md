---
title: "조합론과 이항계수: nCr을 빠르게 계산하기"
description: "순열·조합의 기본과 파스칼 항등식, DP 테이블·곱셈 공식·팩토리얼 역원 전처리로 nCr mod p를 구하는 세 가지 방법을 비교합니다. 뤼카 정리, 중복조합, 카탈란 수까지 실전 조합론 도구를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["조합론", "이항계수", "파스칼삼각형", "카탈란수", "뤼카정리"]
featured: false
draft: false
---

[지난 글](/posts/dsa-prime-factorization/)까지 모듈러 연산·역원·소수라는 부품을 모두 만들었습니다. 이번에는 그 부품들이 조립되는 대표 무대인 **조합론(Combinatorics)**입니다. "n개 중 r개를 뽑는 경우의 수" nCr은 경우의 수 문제, DP 최적화, 확률 계산 어디에나 등장하며, **n이 10⁶이고 답을 1e9+7로 나눠야 하는** 실전 조건에서 올바른 계산법을 고르는 것이 핵심입니다.

## 순열과 조합 복습

- **순열 P(n, r)** = n!/(n−r)! — 순서 있게 r개 나열
- **조합 C(n, r)** = n!/(r!(n−r)!) — 순서 없이 r개 선택

조합은 순열에서 r개의 내부 순서 r!을 나눈 것입니다. C(5, 2) = 10, C(n, 0) = C(n, n) = 1, 그리고 대칭성 C(n, r) = C(n, n−r)이 성립합니다.

## 파스칼 항등식: 조합론의 점화식

> C(n, r) = C(n−1, r−1) + C(n−1, r)

증명은 "n번째 원소를 뽑는가?"라는 한 가지 질문이면 충분합니다. 뽑으면 나머지에서 r−1개(좌항), 안 뽑으면 r개(우항)를 고르면 되기 때문입니다. 이 점화식을 표로 그린 것이 파스칼의 삼각형입니다.

![파스칼의 삼각형](/assets/posts/dsa-combinatorics-binomial-pascal.svg)

## 방법 1: DP 테이블 — n ≤ 수천일 때

파스칼 항등식을 그대로 2차원 DP로 채웁니다. **곱셈도 나눗셈도 없어서** 어떤 모듈러에서도 안전합니다.

```python
def binomial_table(n_max: int, mod: int) -> list:
    C = [[0] * (n_max + 1) for _ in range(n_max + 1)]
    for n in range(n_max + 1):
        C[n][0] = 1
        for r in range(1, n + 1):
            C[n][r] = (C[n - 1][r - 1] + C[n - 1][r]) % mod
    return C
```

O(n²) 시간·공간이므로 n이 수천 정도까지만 실용적입니다. 장점은 **모듈러가 소수가 아니어도 동작**한다는 것입니다.

## 방법 2: 곱셈 공식 — 쿼리 한 번만 필요할 때

```python
def comb_direct(n: int, r: int) -> int:
    r = min(r, n - r)
    result = 1
    for i in range(r):
        result = result * (n - i) // (i + 1)  # 항상 정수로 나누어떨어짐
    return result

print(comb_direct(50, 25))  # 126410606437752
```

i+1까지 곱한 시점의 분자는 연속한 i+1개의 곱이라 (i+1)!로 나누어떨어지므로, **곱하고 바로 나누면** 중간값이 정확히 유지됩니다. 파이썬 `math.comb`가 이 계열입니다. O(r)이며 모듈러 없이 정확한 값이 필요할 때 씁니다.

## 방법 3: 팩토리얼 + 역원 전처리 — 실전 표준

n ≤ 10⁶, 쿼리 10⁵개, mod 1e9+7 — 가장 흔한 실전 조건입니다. 팩토리얼과 그 역원을 미리 깔아 두면 **쿼리당 O(1)**입니다.

![팩토리얼 전처리 파이프라인](/assets/posts/dsa-combinatorics-binomial-factorial.svg)

```python
MOD = 1_000_000_007
MAX = 1_000_000

fact = [1] * (MAX + 1)
for i in range(1, MAX + 1):
    fact[i] = fact[i - 1] * i % MOD

inv_fact = [1] * (MAX + 1)
inv_fact[MAX] = pow(fact[MAX], MOD - 2, MOD)   # 역원은 한 번만
for i in range(MAX, 0, -1):
    inv_fact[i - 1] = inv_fact[i] * i % MOD     # 역순 전파

def comb(n: int, r: int) -> int:
    if r < 0 or r > n:
        return 0
    return fact[n] * inv_fact[r] % MOD * inv_fact[n - r] % MOD

print(comb(1_000_000, 500_000))  # O(1) 쿼리
```

역원 거듭제곱을 모든 인덱스에 하면 O(n log p)지만, **마지막 하나만 거듭제곱하고 `(i−1)!⁻¹ = i!⁻¹ × i`로 역순 전파**하면 O(n + log p)로 줄어듭니다.

## 방법 4: 뤼카 정리 — n이 거대하고 p가 작을 때

n이 10¹⁸처럼 거대하면 팩토리얼 테이블 자체가 불가능합니다. 모듈러 p가 작은 소수라면 **뤼카(Lucas) 정리**가 해법입니다. n과 r을 p진법으로 전개하면:

> C(n, r) ≡ Π C(nᵢ, rᵢ) (mod p)   (nᵢ, rᵢ는 p진법 각 자리)

```python
def comb_lucas(n: int, r: int, p: int) -> int:
    result = 1
    while n or r:
        ni, ri = n % p, r % p
        if ri > ni:
            return 0
        result = result * comb_small(ni, ri, p) % p  # 자리별 nCr (< p)
        n //= p
        r //= p
    return result
```

자리별 조합은 p 미만이므로 작은 테이블로 처리합니다. 전체 O(p + log_p n)입니다.

## 자주 쓰는 조합 패턴

**중복조합** — n종류에서 중복 허용 r개 선택:

```text
H(n, r) = C(n + r − 1, r)
```

"공 r개와 칸막이 n−1개를 일렬로 배열"하는 스타즈 앤 바즈(Stars and Bars) 논법입니다. `x₁+x₂+…+xₙ = r`의 음이 아닌 정수해 개수와 같습니다.

**카탈란 수** — 올바른 괄호열, 이진 트리 모양, 격자 경로 등 셀 수 없이 많은 곳에 등장:

```text
Cat(n) = C(2n, n) / (n + 1) = C(2n, n) − C(2n, n+1)
```

```python
def catalan(n: int) -> int:
    return comb(2 * n, n) * pow(n + 1, MOD - 2, MOD) % MOD

# Cat: 1, 1, 2, 5, 14, 42, 132, ...
```

**이항 정리** — (a+b)ⁿ = Σ C(n,k) aᵏ bⁿ⁻ᵏ. 특히 `Σ C(n,k) = 2ⁿ` (부분집합 개수), `Σ (−1)ᵏ C(n,k) = 0` (포함-배제의 뼈대)이 자주 쓰입니다.

## 방법 선택 가이드

| 조건 | 방법 | 복잡도 |
|------|------|--------|
| n ≤ 수천, 임의 모듈러 | 파스칼 DP | O(n²) |
| 쿼리 1회, 정확한 값 | 곱셈 공식 / math.comb | O(r) |
| n ≤ 10⁷, 소수 모듈러 | 팩토리얼 + 역원 전처리 | 전처리 O(n), 쿼리 O(1) |
| n 거대, p 작은 소수 | 뤼카 정리 | O(p + log n) |

---

**지난 글:** [소인수분해: √n 시도 분할에서 폴라드 로까지](/posts/dsa-prime-factorization/)

**다음 글:** [행렬 거듭제곱: 점화식을 O(log n)에 푸는 법](/posts/dsa-matrix-exponentiation/)

<br>
읽어주셔서 감사합니다. 😊
