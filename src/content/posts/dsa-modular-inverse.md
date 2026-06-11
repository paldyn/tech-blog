---
title: "모듈러 역원: 나머지 세계의 나눗셈"
description: "모듈러 역원의 존재 조건(gcd(a,m)=1)과 의미를 정리하고, 페르마 소정리·확장 유클리드·선형 점화식 세 가지 계산 방법을 구현합니다. 팩토리얼 역원 테이블과 nCr 계산, 합동식 나눗셈까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["모듈러역원", "페르마소정리", "확장유클리드", "유한체", "정수론"]
featured: false
draft: false
---

[지난 글](/posts/dsa-modular-exponentiation/)에서 O(log n) 거듭제곱과 페르마 소정리를 다뤘습니다. 이번에는 모듈러 세계에서 유일하게 분배 법칙이 통하지 않던 연산, **나눗셈**을 해결합니다. 핵심은 "나누기"를 포기하고 **역원(Inverse)을 곱하는 것**으로 바꾸는 발상입니다. 조합론에서 nCr을 모듈러로 구할 때 반드시 필요한 도구입니다.

## 역원이란

mod m 세계에서 a의 역원 a⁻¹은 **곱해서 1이 되는 수**입니다.

> a · a⁻¹ ≡ 1 (mod m)

예를 들어 mod 7에서 3 × 5 = 15 ≡ 1이므로 3⁻¹ ≡ 5입니다. 이제 "6을 3으로 나누기"는 "6에 5를 곱하기"가 됩니다: 6 · 5 = 30 ≡ 2 (mod 7). 실제로 6 ÷ 3 = 2와 일치합니다.

![모듈러 역원 개념](/assets/posts/dsa-modular-inverse-concept.svg)

## 존재 조건: gcd(a, m) = 1

역원이 항상 존재하는 것은 아닙니다. **a와 m이 서로소일 때만** 존재합니다.

- `2⁻¹ (mod 4)`는 없습니다 — 2x는 항상 짝수라 4로 나눈 나머지가 1이 될 수 없습니다
- m이 **소수 p**이면 1 ~ p−1 모든 수가 p와 서로소이므로 **전부 역원을 가집니다**

이것이 알고리즘 문제가 1e9+7 같은 소수 모듈러를 쓰는 결정적 이유입니다. 소수 모듈러의 세계(유한체 GF(p))에서는 0을 제외한 나눗셈이 항상 가능합니다.

## 방법 1: 페르마 소정리 — 코드 한 줄

p가 소수이고 a가 p의 배수가 아니면 `a^(p−1) ≡ 1 (mod p)`이므로, 양변을 a로 한 번 나누면:

> a⁻¹ ≡ a^(p−2) (mod p)

```python
MOD = 1_000_000_007

def inverse(a: int) -> int:
    return pow(a, MOD - 2, MOD)

# 검증
a = 3
inv_a = inverse(a)
print(a * inv_a % MOD)  # 1
```

지난 글의 빠른 거듭제곱 덕분에 O(log p)입니다. **모듈러가 소수라는 조건이 필수**입니다.

## 방법 2: 확장 유클리드 — 소수가 아니어도 OK

gcd(a, m) = 1이면 베주 항등식에 의해 `ax + my = 1`인 정수 (x, y)가 존재합니다. 양변을 mod m으로 보면 `ax ≡ 1 (mod m)`, 즉 **x가 바로 역원**입니다.

```python
def extended_gcd(a: int, b: int):
    old_r, r = a, b
    old_x, x = 1, 0
    while r:
        q = old_r // r
        old_r, r = r, old_r - q * r
        old_x, x = x, old_x - q * x
    return old_r, old_x

def inverse_ext(a: int, m: int) -> int:
    g, x = extended_gcd(a, m)
    if g != 1:
        raise ValueError("역원이 존재하지 않음")
    return x % m

print(inverse_ext(3, 7))    # 5
print(inverse_ext(7, 20))   # 3 (20은 소수가 아니지만 OK)
```

모듈러가 소수가 아닌 경우(예: mod 10⁹, mod 2³²)에 쓸 수 있는 일반적인 방법입니다. 파이썬 3.8+에서는 `pow(a, -1, m)`이 내부적으로 이 일을 해 줍니다.

## 방법 3: 1..n 역원 일괄 전처리 — O(n)

조합론 문제에서는 1부터 n까지 **모든 수의 역원**이 필요할 때가 있습니다. 하나씩 구하면 O(n log p)지만, 다음 점화식으로 O(n)에 끝납니다.

m = (m // i) · i + (m % i) 에서 양변에 i⁻¹ · (m % i)⁻¹ 을 곱해 정리하면:

> inv[i] = −(m // i) · inv[m % i] (mod m)

```python
def inverse_table(n: int, m: int) -> list:
    inv = [0] * (n + 1)
    inv[1] = 1
    for i in range(2, n + 1):
        inv[i] = (m - m // i) * inv[m % i] % m
    return inv

inv = inverse_table(10, 7)
print(inv[3])  # 5
```

`m % i < i`이므로 inv[m % i]는 항상 먼저 계산되어 있습니다.

![역원 계산 세 가지 방법](/assets/posts/dsa-modular-inverse-methods.svg)

## 핵심 응용: 팩토리얼 역원과 nCr

모듈러 역원의 최대 수요처는 이항계수입니다. nCr = n! / (r!(n−r)!)의 나눗셈을 역원 곱으로 바꿉니다.

```python
MOD = 1_000_000_007
MAX = 1_000_000

fact = [1] * (MAX + 1)
for i in range(1, MAX + 1):
    fact[i] = fact[i - 1] * i % MOD

# 마지막 팩토리얼의 역원 하나만 거듭제곱으로 구하고
inv_fact = [1] * (MAX + 1)
inv_fact[MAX] = pow(fact[MAX], MOD - 2, MOD)
# 거꾸로 내려오며 전부 채운다: (i-1)!⁻¹ = i!⁻¹ · i
for i in range(MAX, 0, -1):
    inv_fact[i - 1] = inv_fact[i] * i % MOD

def comb(n: int, r: int) -> int:
    if r < 0 or r > n:
        return 0
    return fact[n] * inv_fact[r] % MOD * inv_fact[n - r] % MOD

print(comb(10, 3))  # 120
```

전처리 O(MAX) 후 **쿼리당 O(1)**로 nCr을 구합니다. 이 패턴은 세 글 뒤 조합론 편에서 본격적으로 활용합니다.

## 합동식의 나눗셈 규칙

역원 개념으로 지난 글의 마지막 표를 완성할 수 있습니다.

> ac ≡ bc (mod m)일 때, **gcd(c, m) = 1이면** a ≡ b (mod m)

c의 역원이 존재해야 양변에 곱해서 소거할 수 있기 때문입니다. gcd(c, m) = g > 1이면 약한 결론만 남습니다: a ≡ b (mod m/g).

## 방법 선택 가이드

| 상황 | 방법 | 시간 |
|------|------|------|
| 모듈러가 소수 (1e9+7 등) | 페르마: pow(a, p-2, p) | O(log p) |
| 모듈러가 합성수 | 확장 유클리드 / pow(a, -1, m) | O(log m) |
| 1..n 전체 역원 필요 | 선형 점화식 | O(n) |
| 팩토리얼 역원 테이블 | 역순 채우기 | O(n + log p) |

---

**지난 글:** [모듈러 거듭제곱: O(log n) 빠른 거듭제곱](/posts/dsa-modular-exponentiation/)

**다음 글:** [에라토스테네스의 체: 소수를 한 번에 거르기](/posts/dsa-sieve-of-eratosthenes/)

<br>
읽어주셔서 감사합니다. 😊
