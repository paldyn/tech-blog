---
title: "모듈러 거듭제곱: O(log n) 빠른 거듭제곱"
description: "aⁿ mod m을 O(log n)에 계산하는 반복 제곱법(Binary Exponentiation)의 원리를 분석합니다. 재귀·반복 구현, 지수의 이진 분해, 페르마 소정리를 이용한 빠른 판정, RSA·디피-헬만 등 암호학 응용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["모듈러거듭제곱", "반복제곱법", "이진거듭제곱", "페르마소정리", "정수론"]
featured: false
draft: false
---

[지난 글](/posts/dsa-modular-arithmetic/)에서 모듈러 세계의 사칙연산 규칙을 정리했습니다. 이번에는 그 위에서 가장 많이 쓰이는 연산인 **모듈러 거듭제곱(aⁿ mod m)**을 다룹니다. n이 10¹⁸이어도 단 60번 남짓의 곱셈으로 답을 구하는 **반복 제곱법(Binary Exponentiation)**은 조합론, 역원 계산, 행렬 거듭제곱, RSA 암호까지 어디에나 등장하는 필수 도구입니다.

## 순진한 방법의 한계

```python
def slow_pow(a, n, m):
    result = 1
    for _ in range(n):
        result = result * a % m
    return result
```

곱셈 n번, O(n)입니다. n이 10⁹만 되어도 시간 초과이고, 암호학에서 쓰는 n ≈ 2²⁰⁴⁸은 우주의 나이로도 부족합니다.

## 핵심 아이디어: 지수의 이진 분해

지수를 이진법으로 쪼개면 거듭제곱은 **제곱의 연쇄**로 바뀝니다.

```text
13 = 1101₂ = 8 + 4 + 1
3¹³ = 3⁸ × 3⁴ × 3¹
```

3¹, 3², 3⁴, 3⁸은 **직전 값을 제곱**하면 차례로 얻어지므로, 13번 곱하는 대신 제곱 3번 + 선택된 항 곱하기 2번이면 충분합니다.

![반복 제곱법](/assets/posts/dsa-modular-exponentiation-squaring.svg)

지수의 비트 수는 log₂n + 1이므로 전체 곱셈 횟수는 **O(log n)**입니다.

## 반복 구현 (실전 표준)

지수의 최하위 비트부터 검사하면서, 비트가 1이면 현재 base를 결과에 곱하고, base는 매 단계 제곱합니다.

```python
def pow_mod(a: int, n: int, m: int) -> int:
    result = 1
    a %= m
    while n > 0:
        if n & 1:              # 최하위 비트가 1이면
            result = result * a % m
        a = a * a % m          # base 제곱
        n >>= 1                # 지수 절반으로
    return result

print(pow_mod(3, 13, 7))   # 3
```

pow_mod(3, 13, 7)의 실행 과정을 따라가 보면 다음과 같습니다.

![반복문 trace](/assets/posts/dsa-modular-exponentiation-binary.svg)

파이썬 내장 `pow(a, n, m)`이 정확히 이 알고리즘(에 최적화를 더한 것)이므로 실전에서는 내장 함수를 쓰면 됩니다.

## 재귀 구현

분할 정복 관점으로 쓰면 구조가 더 또렷합니다.

```python
def pow_mod_rec(a: int, n: int, m: int) -> int:
    if n == 0:
        return 1
    half = pow_mod_rec(a, n // 2, m)
    half = half * half % m
    if n % 2 == 1:
        half = half * a % m
    return half
```

```text
aⁿ = (a^(n/2))²          (n이 짝수)
aⁿ = (a^(n/2))² × a      (n이 홀수)
```

주의할 점: `pow(a, n/2) * pow(a, n/2)`처럼 **재귀를 두 번 호출하면 O(n)으로 퇴화**합니다. 반드시 한 번 호출한 결과를 재사용해야 O(log n)입니다.

## C++ 구현과 오버플로

```cpp
long long pow_mod(long long a, long long n, long long m) {
    long long result = 1;
    a %= m;
    while (n > 0) {
        if (n & 1) result = result * a % m;
        a = a * a % m;   // a < m ≈ 1e9 → a*a < 1e18, long long 안전
        n >>= 1;
    }
    return result;
}
```

m이 10⁹ 수준이면 `a * a`가 최대 약 10¹⁸로 `long long` 범위(약 9.2×10¹⁸) 안에 들어옵니다. m이 더 크면 `__int128`이나 곱셈 분할이 필요합니다.

## 페르마 소정리와의 만남

p가 소수이고 a가 p의 배수가 아니면:

> a^(p−1) ≡ 1 (mod p)

이 정리와 빠른 거듭제곱을 결합하면 두 가지 강력한 도구가 나옵니다.

**1) 모듈러 역원** — 양변을 a로 나누면 `a^(p−2) ≡ a⁻¹ (mod p)`. 즉 역원이 거듭제곱 한 번입니다.

```python
MOD = 1_000_000_007

def inverse(a: int) -> int:
    return pow(a, MOD - 2, MOD)   # 페르마 소정리
```

**2) 확률적 소수 판정** — 밀러-라빈 테스트의 핵심 연산이 바로 `a^d mod n`입니다. 빠른 거듭제곱 없이는 큰 수의 소수 판정 자체가 불가능합니다.

## 응용: RSA의 골격

RSA 암호화·복호화는 모듈러 거듭제곱 그 자체입니다.

```text
암호화: c = m^e mod n     (공개키 e, n)
복호화: m = c^d mod n     (개인키 d)
```

n이 2048비트여도 거듭제곱 한 번에 곱셈이 수천 번 수준이라 실용적입니다. 디피-헬만 키 교환의 `g^a mod p`도 마찬가지입니다. **빠른 거듭제곱은 현대 공개키 암호가 "계산 가능"한 이유** 그 자체입니다.

## 지수가 매우 클 때: 지수의 모듈러

지수 자체가 거대한 식으로 주어지면 (예: a^(b^c)), 페르마 소정리에 의해 **지수는 mod (p−1)로 줄일 수 있습니다**.

```python
# a^(b^c) mod p  (p 소수, a와 p 서로소)
exp = pow(b, c, p - 1)        # 지수는 mod p-1
ans = pow(a, exp, p)
```

지수를 mod p로 줄이는 것은 흔한 오답 패턴이니 주의해야 합니다. 일반 모듈러에서는 오일러 정리(mod φ(m))를 사용합니다.

## 복잡도 정리

| 방법 | 곱셈 횟수 | 비고 |
|------|----------|------|
| 순진한 반복 | O(n) | n ≤ 10⁷ 정도까지만 |
| 반복 제곱법 | O(log n) | 실전 표준 |
| 내장 pow(a, n, m) | O(log n) | 파이썬은 이걸 쓰면 끝 |

다음 글에서는 페르마 소정리에서 잠깐 등장한 **모듈러 역원**을 본격적으로 다룹니다.

---

**지난 글:** [모듈러 연산: 나머지 세계의 산술](/posts/dsa-modular-arithmetic/)

**다음 글:** [모듈러 역원: 나머지 세계의 나눗셈](/posts/dsa-modular-inverse/)

<br>
읽어주셔서 감사합니다. 😊
