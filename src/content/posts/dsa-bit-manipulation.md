---
title: "비트 조작 (Bit Manipulation): 비트 연산과 마스킹 완전 정복"
description: "AND·OR·XOR·NOT·SHIFT 기본 연산부터 최하위 비트 추출·2의 거듭제곱 검사·XOR 스왑 트릭, 비트마스크 DP(TSP·집합 커버링), popcount 최적화까지 비트 조작의 모든 것을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["비트조작", "비트마스크", "XOR", "DP", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-backtracking/)에서 상태 공간 탐색을 다뤘다면, 비트 조작은 상태를 비트로 압축해 O(1) 또는 O(2^n)으로 처리하는 강력한 도구입니다. 면접에서도 자주 등장하고, 경쟁 프로그래밍에서는 비트마스크 DP가 없으면 풀 수 없는 문제가 있을 만큼 중요합니다.

## 기본 비트 연산

정수를 이진수로 다루는 6가지 연산:

```python
a = 0b1100  # 12
b = 0b1010  # 10

print(a & b)   # AND:  0b1000 = 8
print(a | b)   # OR:   0b1110 = 14
print(a ^ b)   # XOR:  0b0110 = 6
print(~a)      # NOT:  -13 (2의 보수 표현)
print(a << 2)  # LEFT SHIFT:  48 (×4)
print(a >> 1)  # RIGHT SHIFT: 6  (÷2)
```

![비트 연산 기본](/assets/posts/dsa-bit-manipulation-ops.svg)

## 필수 비트 트릭 모음

### 특정 비트 조작

```python
n = 0b1010  # 10

# i번째 비트 확인
def check_bit(n, i):
    return (n >> i) & 1

# i번째 비트 세트 (1로 만들기)
def set_bit(n, i):
    return n | (1 << i)

# i번째 비트 클리어 (0으로 만들기)
def clear_bit(n, i):
    return n & ~(1 << i)

# i번째 비트 토글 (0↔1)
def toggle_bit(n, i):
    return n ^ (1 << i)

print(check_bit(10, 1))   # 1 (비트1 = 1)
print(set_bit(10, 2))     # 14 (0b1110)
print(clear_bit(10, 1))   # 8  (0b1000)
print(toggle_bit(10, 0))  # 11 (0b1011)
```

### 자주 쓰는 패턴

```python
# 2의 거듭제곱 여부 확인
def is_power_of_two(n):
    return n > 0 and (n & (n - 1)) == 0

# 최하위 비트(LSB) 추출
def lowest_set_bit(n):
    return n & (-n)

# 최하위 세트 비트 제거
def remove_lowest_set_bit(n):
    return n & (n - 1)

# 부호 확인 (MSB)
def is_negative(n):
    return (n >> 31) & 1  # 32비트 기준

print(is_power_of_two(16))       # True
print(lowest_set_bit(0b1100))    # 4 (0b0100)
print(remove_lowest_set_bit(12)) # 8 (0b1000)
```

### XOR 마법

XOR의 특성 `a ^ a = 0`, `a ^ 0 = a`를 이용한 트릭들:

```python
# 변수 교환 (임시 변수 없이)
def swap(a, b):
    a ^= b
    b ^= a
    a ^= b
    return a, b

# 배열에서 유일한 원소 찾기 (나머지는 쌍)
def find_single(nums):
    result = 0
    for num in nums:
        result ^= num
    return result

print(find_single([2, 3, 2, 4, 3]))  # 4
# [2^2=0, 3^3=0, 4 남음]
```

### Popcount — 세트 비트 개수

```python
# 방법 1: bin 함수 (Python)
def popcount_py(n):
    return bin(n).count('1')

# 방법 2: Kernighan 알고리즘 O(popcount)
def popcount_kernighan(n):
    count = 0
    while n:
        n &= n - 1  # 최하위 1 비트 제거
        count += 1
    return count

# 방법 3: 하드웨어 지원 (C에서 __builtin_popcount)
# Python에서는 int.bit_count() (3.10+)
print((29).bit_count())  # 4 (0b11101)
```

## 비트마스크 DP

n개 원소의 부분 집합 상태를 정수 하나로 표현하면 DP 상태가 O(2^n)이 됩니다. n이 작을 때(보통 ≤20) 극적인 효율을 냅니다.

![비트마스크 DP](/assets/posts/dsa-bit-manipulation-mask.svg)

### 부분 집합 열거

```python
n = 4

# 모든 부분 집합 순회
for mask in range(1 << n):
    subset = []
    for i in range(n):
        if mask & (1 << i):
            subset.append(i)
    # print(mask, subset)

# 특정 마스크의 부분 집합만 열거 (빠른 방법)
def enumerate_subsets(mask):
    sub = mask
    while sub > 0:
        yield sub
        sub = (sub - 1) & mask
```

### TSP (외판원 문제) — 비트마스크 DP의 대표 문제

n개 도시를 모두 방문하고 출발지로 돌아오는 최단 경로:

```python
from math import inf

def tsp(dist):
    n = len(dist)
    INF = inf
    # dp[mask][i] = mask 집합을 방문하고 i에 있을 때 최소 비용
    dp = [[INF] * n for _ in range(1 << n)]
    dp[1][0] = 0  # 도시 0 출발 (mask=0b0001)

    for mask in range(1 << n):
        for u in range(n):
            if dp[mask][u] == INF:
                continue
            if not (mask >> u & 1):
                continue
            for v in range(n):
                if mask >> v & 1:
                    continue  # 이미 방문
                new_mask = mask | (1 << v)
                cost = dp[mask][u] + dist[u][v]
                if cost < dp[new_mask][v]:
                    dp[new_mask][v] = cost

    full = (1 << n) - 1
    return min(dp[full][i] + dist[i][0] for i in range(1, n))
```

- 시간: **O(2^n · n²)**, 공간: **O(2^n · n)**
- 브루트 포스 O(n!)에 비해 n=20일 때 ~10^6배 빠름

### 집합 커버링 최소화

```python
def minimum_set_cover(universe, sets):
    n = len(universe)
    m = len(sets)
    # 각 집합을 비트마스크로 표현
    masks = []
    for s in sets:
        mask = 0
        for e in s:
            mask |= (1 << e)
        masks.append(mask)

    full = (1 << n) - 1
    dp = [float('inf')] * (full + 1)
    dp[0] = 0

    for covered in range(full + 1):
        if dp[covered] == float('inf'):
            continue
        for mask in masks:
            new_covered = covered | mask
            dp[new_covered] = min(dp[new_covered], dp[covered] + 1)

    return dp[full]
```

## 실전 응용 문제

| 문제 유형 | 핵심 트릭 |
|-----------|-----------|
| 배열에서 홀수 번 나타나는 수 | 전체 XOR |
| 해밍 거리 | `bin(a^b).count('1')` |
| 비트 역전 | 비트 분할 정복 |
| 2의 거듭제곱 여부 | `n & (n-1) == 0` |
| 최대 AND 쌍 | 그리디 + 비트 위에서부터 |
| 부분 집합 합 (small n) | 비트마스크 DP |

---

**지난 글:** [백트래킹: 상태 공간 탐색과 가지치기](/posts/dsa-backtracking/)

**다음 글:** [KMP 알고리즘: 문자열 검색의 표준](/posts/dsa-string-matching-kmp/)

<br>
읽어주셔서 감사합니다. 😊
