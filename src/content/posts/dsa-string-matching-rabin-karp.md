---
title: "라빈-카프 알고리즘: 해시 기반 문자열 검색"
description: "라빈-카프(Rabin-Karp) 알고리즘의 롤링 해시 원리, O(1) 해시 갱신, 허위 양성 처리, 다중 패턴 동시 검색, 이중 해싱으로 충돌 최소화까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["라빈-카프", "롤링해시", "문자열검색", "해시", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-string-matching-kmp/)에서 실패 함수로 패턴을 재사용하는 KMP를 배웠다면, 라빈-카프는 전혀 다른 접근법을 취합니다. **해시(hash)**를 활용해 슬라이딩 윈도우 내 문자열의 해시값을 O(1)에 갱신하면서 패턴과 비교하는 기법입니다.

## 핵심 아이디어: 롤링 해시

브루트 포스는 텍스트의 모든 위치에서 패턴과 문자 단위 비교를 합니다. 라빈-카프는 먼저 **해시값**만 비교하고, 해시가 일치할 때만 실제 문자를 확인합니다.

해시값 비교: O(1) ← 빠름  
해시 일치 시 문자 비교: O(m) ← 드물게 발생

핵심은 윈도우를 한 칸 이동할 때 해시값을 **O(1)에 갱신**하는 것입니다.

## 다항식 해시 (Polynomial Hash)

길이 m의 문자열 s의 해시:

```python
# h = s[0]*B^(m-1) + s[1]*B^(m-2) + ... + s[m-1]*B^0 (mod MOD)
def poly_hash(s, base, mod):
    h = 0
    for c in s:
        h = (h * base + ord(c)) % mod
    return h
```

`B = 31` (또는 소수), `MOD = 10^9 + 7` (큰 소수) 주로 사용.

## 롤링 해시 갱신

윈도우 `[i, i+m-1]`에서 `[i+1, i+m]`으로 이동:

```text
h_new = (h_old - s[i] * B^(m-1)) * B + s[i+m]  (mod MOD)
```

새 문자를 더하고 빠져나가는 문자를 제거하는 것이 전부입니다.

![라빈-카프 슬라이딩 해시](/assets/posts/dsa-string-matching-rabin-karp-hash.svg)

## 완전한 구현

```python
def rabin_karp(text: str, pattern: str) -> list:
    n, m = len(text), len(pattern)
    if m > n:
        return []

    BASE = 31
    MOD = (1 << 61) - 1   # 메르센 소수로 충돌 최소화

    def mod_hash(s):
        h = 0
        for c in s:
            h = (h * BASE + ord(c)) % MOD
        return h

    # 패턴 해시 및 첫 윈도우 해시
    pat_hash = mod_hash(pattern)
    win_hash = mod_hash(text[:m])

    # B^(m-1) % MOD 미리 계산
    power = 1
    for _ in range(m - 1):
        power = (power * BASE) % MOD

    matches = []

    for i in range(n - m + 1):
        if win_hash == pat_hash:
            # 허위 양성 가능 → 실제 비교 검증
            if text[i:i+m] == pattern:
                matches.append(i)

        if i < n - m:
            # 롤링 해시 갱신
            win_hash = (win_hash - ord(text[i]) * power) % MOD
            win_hash = (win_hash * BASE + ord(text[i + m])) % MOD
            win_hash = (win_hash + MOD) % MOD  # 음수 방지

    return matches

text = "abcdeabcabc"
print(rabin_karp(text, "abc"))  # [0, 5, 8]
```

## 허위 양성 (Spurious Hit)

해시값이 같아도 실제 문자열이 다른 경우입니다. MOD가 클수록 충돌 확률이 낮아집니다.

```python
# 이중 해싱으로 충돌 확률 극적 감소
def double_hash(s):
    BASE1, MOD1 = 31, (1 << 61) - 1
    BASE2, MOD2 = 37, 10**9 + 9
    h1, h2 = 0, 0
    for c in s:
        h1 = (h1 * BASE1 + ord(c)) % MOD1
        h2 = (h2 * BASE2 + ord(c)) % MOD2
    return (h1, h2)
```

이중 해시 충돌 확률: `1/(MOD1 × MOD2) ≈ 1/(2^92)` — 실용적으로 0에 가깝습니다.

## 다중 패턴 동시 검색

라빈-카프의 진가는 **여러 패턴을 동시에 검색**할 때 빛납니다. k개의 패턴 해시를 미리 해시 집합에 넣어두고, 각 윈도우의 해시값이 집합에 있는지만 O(1)로 확인합니다.

![다중 패턴 검색](/assets/posts/dsa-string-matching-rabin-karp-multi.svg)

```python
def rabin_karp_multi(text: str, patterns: list) -> dict:
    if not patterns:
        return {}
    m = len(patterns[0])  # 모든 패턴 같은 길이 가정
    BASE, MOD = 31, (1 << 61) - 1

    def rk_hash(s):
        h = 0
        for c in s:
            h = (h * BASE + ord(c)) % MOD
        return h

    # 패턴 해시 집합 구축
    pat_hash_map = {}
    for p in patterns:
        h = rk_hash(p)
        pat_hash_map.setdefault(h, set()).add(p)

    power = pow(BASE, m - 1, MOD)
    results = {p: [] for p in patterns}
    n = len(text)
    win_hash = rk_hash(text[:m])

    for i in range(n - m + 1):
        if win_hash in pat_hash_map:
            window = text[i:i+m]
            if window in pat_hash_map[win_hash]:
                results[window].append(i)
        if i < n - m:
            win_hash = (win_hash - ord(text[i]) * power) % MOD
            win_hash = (win_hash * BASE + ord(text[i+m])) % MOD
            win_hash = (win_hash + MOD) % MOD

    return results
```

KMP k회 실행 O(k·n) 대비, 라빈-카프 멀티는 O(n + k·m). 패턴이 많고 텍스트가 긴 환경에서 확연히 유리합니다.

## 응용: 최장 중복 부분 문자열

라빈-카프 + 이진 탐색으로 O(n log n)에 해결:

```python
def longest_duplicate_substring(s: str) -> str:
    BASE, MOD = 31, (1 << 61) - 1
    n = len(s)

    def check(length):
        if length == 0:
            return ""
        power = pow(BASE, length - 1, MOD)
        h = 0
        for c in s[:length]:
            h = (h * BASE + ord(c)) % MOD
        seen = {h: [0]}
        for i in range(1, n - length + 1):
            h = (h - ord(s[i-1]) * power) % MOD
            h = (h * BASE + ord(s[i+length-1])) % MOD
            h = (h + MOD) % MOD
            if h in seen:
                # 충돌 방지: 실제 비교
                window = s[i:i+length]
                for j in seen[h]:
                    if s[j:j+length] == window:
                        return window
                seen[h].append(i)
            else:
                seen[h] = [i]
        return ""

    lo, hi, ans = 0, n - 1, ""
    while lo <= hi:
        mid = (lo + hi) // 2
        res = check(mid)
        if res:
            ans = res
            lo = mid + 1
        else:
            hi = mid - 1
    return ans
```

## 복잡도 요약

| 케이스 | 시간 복잡도 |
|--------|-------------|
| 평균 | O(n + m) |
| 최악 (모두 허위 양성) | O(n · m) |
| k개 패턴 동시 검색 | O(n + k · m) |
| 이중 해싱 후 최악 확률 | ~2^(-92) 수준 |

---

**지난 글:** [KMP 알고리즘: 문자열 검색의 표준](/posts/dsa-string-matching-kmp/)

**다음 글:** [롤링 해시: 부분 문자열 비교와 해시 충돌 방지](/posts/dsa-rolling-hash/)

<br>
읽어주셔서 감사합니다. 😊
