---
title: "모듈러 연산: 나머지 세계의 산술"
description: "합동의 개념과 시계 산술 비유, 덧셈·뺄셈·곱셈의 모듈러 분배 법칙과 증명, 언어별 음수 나머지 함정, 오버플로 없이 큰 수를 다루는 누적 mod 패턴, 1e9+7이 표준 모듈러인 이유까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["모듈러연산", "합동", "나머지", "오버플로", "정수론"]
featured: false
draft: false
---

[지난 글](/posts/dsa-gcd-lcm-extended-euclid/)에서 유클리드 호제법과 베주 항등식을 다뤘습니다. 이번에는 정수론 알고리즘의 무대 그 자체인 **모듈러 연산(Modular Arithmetic)**을 정리합니다. "답을 1,000,000,007로 나눈 나머지를 출력하시오"라는 문구를 본 적이 있다면 이미 모듈러 세계에 발을 들인 것입니다. 이 글에서 그 세계의 규칙을 확실히 잡아두면 이후 거듭제곱, 역원, 조합론 글이 모두 수월해집니다.

## 합동: 나머지가 같으면 같은 수

정수 a, b를 m으로 나눈 나머지가 같을 때 **a와 b는 mod m에 대해 합동**이라 하고 이렇게 씁니다.

> a ≡ b (mod m)   ⟺   m | (a − b)

가장 친숙한 예가 시계입니다. 10시에서 5시간이 지나면 15시가 아니라 3시입니다. 시계의 세계에서는 15 ≡ 3 (mod 12)이기 때문입니다.

![모듈러 연산 시계 비유](/assets/posts/dsa-modular-arithmetic-clock.svg)

mod m 세계에는 수가 `0, 1, …, m−1`의 m개뿐이며, 모든 연산 결과는 이 범위 안으로 순환합니다.

## 분배 법칙: 중간에 mod를 취해도 된다

모듈러 연산의 실용적 가치는 **연산 도중 아무 때나 mod를 취해도 최종 결과가 같다**는 데 있습니다.

![모듈러 분배 법칙](/assets/posts/dsa-modular-arithmetic-rules.svg)

```text
(a + b) mod m = ((a mod m) + (b mod m)) mod m
(a − b) mod m = ((a mod m) − (b mod m) + m) mod m
(a × b) mod m = ((a mod m) × (b mod m)) mod m
```

곱셈 법칙만 간단히 증명해 보면, a = q₁m + r₁, b = q₂m + r₂일 때:

```text
ab = (q₁m + r₁)(q₂m + r₂)
   = q₁q₂m² + (q₁r₂ + q₂r₁)m + r₁r₂
```

r₁r₂를 제외한 모든 항이 m의 배수이므로 `ab mod m = r₁r₂ mod m`입니다.

**나눗셈은 예외**입니다. `(a / b) mod m ≠ (a mod m) / (b mod m)`이며, 나눗셈은 b의 **모듈러 역원**을 곱하는 것으로 대체해야 합니다. 이 내용은 두 글 뒤에서 자세히 다룹니다.

## 왜 필요한가: 오버플로 없이 큰 수 다루기

n! 처럼 천문학적으로 커지는 값을 구할 때, 분배 법칙 덕분에 **매 단계 mod를 취하면** 값이 항상 m 미만으로 유지됩니다.

```python
MOD = 1_000_000_007

def factorial_mod(n: int) -> int:
    result = 1
    for i in range(2, n + 1):
        result = result * i % MOD   # 매 곱셈마다 mod
    return result

print(factorial_mod(100_000))  # 큰 수 라이브러리 없이도 안전
```

C++로 쓸 때는 곱셈 한 번의 중간값이 (m−1)² ≈ 10¹⁸까지 커지므로 `long long`(64비트)이 필수입니다.

```cpp
const long long MOD = 1'000'000'007;

long long mul_mod(long long a, long long b) {
    return a % MOD * (b % MOD) % MOD;  // 중간값이 64비트 안에 들어옴
}
```

## 함정: 언어마다 다른 음수 나머지

`%` 연산자의 음수 처리는 언어마다 다릅니다.

| 언어 | -7 % 3 | 규칙 |
|------|--------|------|
| Python | 2 | 결과 부호 = 제수(m) 부호 |
| C++ / Java / Go | -1 | 결과 부호 = 피제수(a) 부호 |
| JavaScript | -1 | 결과 부호 = 피제수(a) 부호 |

Python은 항상 `0 ≤ r < m`을 보장하지만, C++·Java·JavaScript에서는 뺄셈 후 음수가 나올 수 있어 보정이 필요합니다.

```java
long sub_mod(long a, long b, long m) {
    return ((a - b) % m + m) % m;  // 음수 보정
}
```

모듈러 뺄셈이 들어가는 코드에서 가장 흔한 버그 포인트이므로, **습관적으로 `+ m`을 붙이는** 것이 안전합니다.

## 왜 하필 1,000,000,007인가

알고리즘 문제에서 모듈러로 압도적으로 자주 쓰이는 1e9+7에는 이유가 있습니다.

1. **소수다** — 소수 모듈러에서는 0이 아닌 모든 수가 역원을 가져 나눗셈이 가능하고, 페르마 소정리를 쓸 수 있습니다
2. **10⁹ 근처다** — 두 값의 합이 32비트를 넘지만 곱이 64비트(약 9.2×10¹⁸) 안에 들어와 `long long` 곱셈이 안전합니다
3. **외우기 쉽다** — 10⁹ + 7

같은 이유로 998244353(NTT 친화적 소수)도 자주 등장합니다.

## 실전 패턴 모음

```python
MOD = 1_000_000_007

# 1) 누적 합 (배열 원소가 매우 클 때)
total = 0
for x in arr:
    total = (total + x) % MOD

# 2) 거듭제곱의 연쇄 곱
prod = 1
for x in arr:
    prod = prod * (x % MOD) % MOD

# 3) DP 점화식의 합
dp[i] = (dp[i - 1] + dp[i - 2]) % MOD

# 4) 뺄셈이 끼는 경우 (포함-배제 등)
ans = (a - b + MOD) % MOD
```

핵심 습관은 하나입니다. **값이 커질 수 있는 모든 연산 직후에 mod를 취한다.** "마지막에 한 번만 mod"는 파이썬에서는 동작하지만 느려지고, C++/Java에서는 오버플로로 오답이 됩니다.

## 합동의 대수적 성질

합동 관계는 등식처럼 다룰 수 있습니다.

| 성질 | 내용 |
|------|------|
| 반사·대칭·추이 | 동치 관계 — mod m 세계를 m개의 잉여류로 분할 |
| 양변 덧셈/곱셈 | a ≡ b이면 a+c ≡ b+c, ac ≡ bc |
| 거듭제곱 | a ≡ b이면 aᵏ ≡ bᵏ |
| 양변 나눗셈 | gcd(c, m) = 1일 때만 ac ≡ bc → a ≡ b |

마지막 성질이 곧 모듈러 역원 이야기입니다. 이 시리즈의 다음 두 글에서 **모듈러 거듭제곱**과 **모듈러 역원**으로 이어집니다.

---

**지난 글:** [최대공약수와 확장 유클리드 알고리즘](/posts/dsa-gcd-lcm-extended-euclid/)

**다음 글:** [모듈러 거듭제곱: O(log n) 빠른 거듭제곱](/posts/dsa-modular-exponentiation/)

<br>
읽어주셔서 감사합니다. 😊
