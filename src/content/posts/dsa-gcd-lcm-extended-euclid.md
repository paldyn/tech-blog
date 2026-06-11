---
title: "최대공약수와 확장 유클리드 알고리즘"
description: "유클리드 호제법으로 GCD를 O(log n)에 구하는 원리와 증명, LCM과의 관계, 베주 항등식과 확장 유클리드 알고리즘 구현, 선형 디오판토스 방정식의 해 구하기까지 정수론 알고리즘의 출발점을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["최대공약수", "유클리드호제법", "확장유클리드", "베주항등식", "정수론"]
featured: false
draft: false
---

[지난 글](/posts/dsa-trie-applications/)까지 문자열 알고리즘을 다뤘고, 이번 글부터는 **정수론 알고리즘** 파트로 넘어갑니다. 그 출발점은 기원전 300년경 유클리드의 『원론』에 실린, 현존하는 가장 오래된 알고리즘인 **유클리드 호제법**입니다. 단 두 줄짜리 코드지만 모듈러 역원, 암호학(RSA), 분수 연산, 디오판토스 방정식까지 이어지는 정수론 전체의 토대가 됩니다.

## 유클리드 호제법

핵심 성질은 하나입니다.

> gcd(a, b) = gcd(b, a mod b)

a = qb + r이라 하면, a와 b의 공약수는 r = a − qb도 나누고, 반대로 b와 r의 공약수는 a = qb + r도 나눕니다. 즉 (a, b)의 공약수 집합과 (b, r)의 공약수 집합이 완전히 같으므로 최대공약수도 같습니다.

![유클리드 호제법 과정](/assets/posts/dsa-gcd-lcm-extended-euclid-steps.svg)

```python
def gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a

print(gcd(48, 18))  # 6
```

재귀로 쓰면 더 짧습니다.

```python
def gcd(a: int, b: int) -> int:
    return a if b == 0 else gcd(b, a % b)
```

## 왜 O(log min(a, b))인가

`a mod b`는 두 단계마다 값을 절반 이하로 줄입니다. a ≥ b일 때 `a mod b < a/2`임을 보이면 됩니다.

- b ≤ a/2이면: 나머지는 항상 b보다 작으므로 `a mod b < b ≤ a/2`
- b > a/2이면: 몫이 1이므로 `a mod b = a − b < a/2`

따라서 단계 수는 O(log min(a, b))입니다. 정확한 최악 케이스는 **인접한 피보나치 수 쌍**으로, 이를 밝힌 것이 라메(Lamé)의 정리입니다. gcd(F(n+1), F(n))은 매 단계 몫이 1이라 가장 느리게 줄어듭니다.

## 최소공배수 (LCM)

GCD만 있으면 LCM은 공식 하나로 끝납니다.

> gcd(a, b) × lcm(a, b) = a × b

```python
def lcm(a: int, b: int) -> int:
    return a // gcd(a, b) * b   # 오버플로 방지: 나눗셈 먼저

print(lcm(48, 18))  # 144
```

고정 폭 정수 언어(C++, Java)에서는 `a * b`를 먼저 계산하면 오버플로가 나기 쉬우므로 **나눗셈을 먼저** 하는 습관이 중요합니다. 여러 수의 LCM은 `reduce(lcm, nums)`처럼 누적하면 됩니다.

## 베주 항등식 (Bézout's Identity)

정수론에서 가장 많이 쓰이는 정리 중 하나입니다.

> 임의의 정수 a, b에 대해 **ax + by = gcd(a, b)**를 만족하는 정수 x, y가 항상 존재한다.

예를 들어 gcd(48, 18) = 6이고, 48·(−1) + 18·3 = 6입니다. 이 (x, y)를 **베주 계수**라 하며, 이를 실제로 계산해 주는 것이 확장 유클리드 알고리즘입니다.

## 확장 유클리드 알고리즘

호제법의 각 단계에서 나머지 r을 항상 `48·x + 18·y` 형태로 표현하며 따라갑니다. 나머지 갱신식 `r = r_prev − q·r_cur`을 계수 (x, y)에도 똑같이 적용하면 됩니다.

![확장 유클리드 역추적 테이블](/assets/posts/dsa-gcd-lcm-extended-euclid-extended.svg)

```python
def extended_gcd(a: int, b: int):
    """ax + by = gcd(a, b)인 (gcd, x, y) 반환"""
    old_r, r = a, b
    old_x, x = 1, 0
    old_y, y = 0, 1

    while r:
        q = old_r // r
        old_r, r = r, old_r - q * r
        old_x, x = x, old_x - q * x
        old_y, y = y, old_y - q * y

    return old_r, old_x, old_y

g, x, y = extended_gcd(48, 18)
print(g, x, y)            # 6 -1 3
print(48 * x + 18 * y)    # 6
```

재귀 버전은 `gcd(b, a mod b)`의 해 (x', y')로부터 `x = y'`, `y = x' − (a//b)·y'`로 거슬러 올라갑니다.

```python
def extended_gcd_rec(a: int, b: int):
    if b == 0:
        return a, 1, 0
    g, x, y = extended_gcd_rec(b, a % b)
    return g, y, x - (a // b) * y
```

## 응용: 선형 디오판토스 방정식

**ax + by = c**의 정수해를 구하는 문제입니다.

1. g = gcd(a, b)가 c를 나누지 않으면 **해가 없습니다** (좌변은 항상 g의 배수)
2. 나누면, 확장 유클리드로 ax₀ + by₀ = g를 구한 뒤 양변에 c/g를 곱해 특수해를 얻습니다
3. 일반해는 t를 정수 매개변수로 다음과 같습니다

```text
x = x₀·(c/g) + (b/g)·t
y = y₀·(c/g) − (a/g)·t
```

```python
def solve_diophantine(a: int, b: int, c: int):
    g, x0, y0 = extended_gcd(a, b)
    if c % g != 0:
        return None                 # 해 없음
    k = c // g
    return x0 * k, y0 * k           # 특수해 하나

print(solve_diophantine(48, 18, 30))  # (-5, 15) → 48·(-5)+18·15 = 30
```

"물통 두 개로 정확히 c리터 만들기" 같은 퍼즐이 전부 이 방정식입니다.

## 응용 미리보기: 모듈러 역원

베주 항등식에서 b를 모듈러 m으로 두면:

```text
ax + my = gcd(a, m) = 1   (a와 m이 서로소일 때)
→ ax ≡ 1 (mod m)
→ x가 바로 a의 모듈러 역원
```

이 내용은 시리즈에서 모듈러 역원을 다룰 때 본격적으로 사용합니다.

## 복잡도와 정리

| 연산 | 시간 |
|------|------|
| gcd / lcm | O(log min(a, b)) |
| 확장 유클리드 | O(log min(a, b)) |
| 디오판토스 특수해 | O(log min(a, b)) |

| 개념 | 핵심 한 줄 |
|------|-----------|
| 호제법 | gcd(a, b) = gcd(b, a mod b) |
| LCM | a·b = gcd·lcm |
| 베주 항등식 | ax + by = gcd(a, b)인 정수해 존재 |
| 확장 유클리드 | 그 (x, y)를 O(log n)에 계산 |

---

**지난 글:** [트라이 응용: 자동완성, 접두사 검색, XOR 트라이](/posts/dsa-trie-applications/)

**다음 글:** [모듈러 연산: 나머지 세계의 산술](/posts/dsa-modular-arithmetic/)

<br>
읽어주셔서 감사합니다. 😊
