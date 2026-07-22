---
title: "롤링 해시: 부분 문자열 비교와 해시 충돌 방지"
description: "롤링 해시(Rolling Hash)의 다항식 해시 원리, O(1) 갱신 공식, 접두사 해시 배열로 임의 부분 문자열 O(1) 쿼리, 이중 해싱으로 충돌 최소화, 최장 중복 부분 문자열·팰린드롬 판별 응용까지 완전히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["롤링해시", "해시", "문자열", "이중해싱", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-string-matching-rabin-karp/)에서 라빈-카프의 롤링 해시를 소개했다면, 이번 글에서는 롤링 해시 자체를 더 깊이 파고듭니다. 접두사 해시 배열, 이중 해싱, 그리고 팰린드롬 판별 같은 고급 응용까지 정리합니다.

## 롤링 해시란

슬라이딩 윈도우가 한 칸 이동할 때 해시값을 **O(1)**에 갱신하는 기법입니다. 재계산 없이 기존 해시에서 빠져나간 문자를 제거하고 새 문자를 추가합니다.

```text
h(s[i..i+m-1]) → h(s[i+1..i+m])

= (h_old - s[i] * B^(m-1)) * B + s[i+m]  (mod MOD)
```

![롤링 해시 갱신](/assets/posts/dsa-rolling-hash-sliding.svg)

## 구현

```python
class RollingHash:
    def __init__(self, s: str, base: int = 131, mod: int = (1 << 61) - 1):
        self.n = len(s)
        self.base = base
        self.mod = mod

        # 접두사 해시 배열
        self.prefix = [0] * (self.n + 1)
        for i, c in enumerate(s):
            self.prefix[i+1] = (self.prefix[i] * base + ord(c)) % mod

        # 거듭제곱 배열
        self.pw = [1] * (self.n + 1)
        for i in range(1, self.n + 1):
            self.pw[i] = (self.pw[i-1] * base) % mod

    def get(self, l: int, r: int) -> int:
        """s[l..r] 해시값 O(1) 반환 (0-indexed, 양 끝 포함)"""
        return (self.prefix[r+1] - self.prefix[l] * self.pw[r-l+1]) % self.mod
```

![접두사 해시 배열](/assets/posts/dsa-rolling-hash-prefix.svg)

## 부분 문자열 비교 O(1)

접두사 해시 배열이 있으면 두 부분 문자열의 동치 여부를 O(1)에 확인할 수 있습니다.

```python
def are_equal(rh: RollingHash, l1, r1, l2, r2) -> bool:
    return rh.get(l1, r1) == rh.get(l2, r2)

# 예: "abcabc"에서 s[0..2] == s[3..5] 인가?
s = "abcabc"
rh = RollingHash(s)
print(are_equal(rh, 0, 2, 3, 5))  # True
```

실제로는 해시 충돌 가능성이 있으므로 중요한 판단에서는 이중 해싱을 쓰거나 실제 문자 비교로 검증합니다.

## 이중 해싱 (Double Hashing)

충돌 확률을 극적으로 낮추는 방법:

```python
class DoubleRollingHash:
    def __init__(self, s: str):
        B1, M1 = 131, (1 << 61) - 1
        B2, M2 = 137, 10**9 + 9
        self.rh1 = RollingHash(s, B1, M1)
        self.rh2 = RollingHash(s, B2, M2)

    def get(self, l: int, r: int) -> tuple:
        return (self.rh1.get(l, r), self.rh2.get(l, r))

# 충돌 확률: ~1/(2^61 * 10^9) ≈ 0 수준
```

## 응용 1: 최장 중복 부분 문자열

이진 탐색 + 롤링 해시로 O(n log n):

```python
def longest_dup(s: str) -> str:
    n = len(s)
    rh = DoubleRollingHash(s)

    def has_dup_of_length(length: int) -> int:
        seen = {}
        for i in range(n - length + 1):
            h = rh.get(i, i + length - 1)
            if h in seen:
                # 충돌 검증
                if s[seen[h]:seen[h]+length] == s[i:i+length]:
                    return i
            seen[h] = i
        return -1

    lo, hi = 0, n - 1
    result_idx = -1
    result_len = 0
    while lo <= hi:
        mid = (lo + hi) // 2
        idx = has_dup_of_length(mid)
        if idx != -1:
            result_idx = idx
            result_len = mid
            lo = mid + 1
        else:
            hi = mid - 1

    return s[result_idx:result_idx+result_len] if result_idx != -1 else ""

print(longest_dup("banana"))  # "ana"
```

## 응용 2: 팰린드롬 판별

문자열 `s`와 역순 문자열 `t = s[::-1]`에 각각 접두사 해시를 만들면, `s[l..r]`이 팰린드롬인지 O(1)에 판별합니다.

```python
def palindrome_check(s: str, l: int, r: int) -> bool:
    t = s[::-1]
    rh_s = RollingHash(s)
    rh_t = RollingHash(t)

    n = len(s)
    # s[l..r]이 팰린드롬 ↔ s[l..r] == reverse(s[l..r])
    # reverse(s[l..r]) = t[n-1-r .. n-1-l]
    tl = n - 1 - r
    tr = n - 1 - l
    return rh_s.get(l, r) == rh_t.get(tl, tr)
```

## 응용 3: Z-function / KMP와의 관계

롤링 해시로 Z 배열을 구하는 것도 가능합니다. 이진 탐색 + 해시 비교로 Z[i](s[0..]와 s[i..]의 최장 공통 접두사 길이)를 O(log n)에 구합니다.

```python
def z_with_hash(s: str) -> list:
    n = len(s)
    rh = DoubleRollingHash(s)
    z = [0] * n
    z[0] = n

    for i in range(1, n):
        lo, hi = 0, n - i
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if rh.get(0, mid-1) == rh.get(i, i+mid-1):
                lo = mid
            else:
                hi = mid - 1
        z[i] = lo

    return z
```

O(n log n) — 표준 Z-algorithm O(n)보다 느리지만, 2D 해시 등에 응용할 수 있습니다.

## 해시 충돌 방지 팁

```python
# 1. 큰 소수 MOD 사용
MOD = (1 << 61) - 1   # 2^61 - 1: 메르센 소수

# 2. BASE를 알파벳 크기보다 크게
BASE = 131  # ASCII 범위 0~127보다 큰 소수

# 3. 랜덤 BASE (해킹 방지)
import random
BASE = random.randint(200, 300)
MOD = (1 << 61) - 1

# 4. 이중 해싱
# (h1, h2) 쌍이 같아야 일치로 간주
```

경쟁 프로그래밍에서는 고정 BASE를 해킹하는 Hack이 가능하므로, 랜덤 BASE가 안전합니다.

## 복잡도 요약

| 연산 | 시간 복잡도 |
|------|-------------|
| 접두사 해시 구축 | O(n) |
| 임의 부분 문자열 해시 | O(1) |
| 두 부분 문자열 동치 | O(1) (이중 해싱) |
| 최장 중복 부분 문자열 | O(n log n) |
| n개 부분 문자열 정렬 | O(n log² n) |

---

**지난 글:** [라빈-카프 알고리즘: 해시 기반 문자열 검색](/posts/dsa-string-matching-rabin-karp/)

**다음 글:** [Z-알고리즘: 선형 시간 문자열 분석](/posts/dsa-z-algorithm/)

<br>
읽어주셔서 감사합니다. 😊
