---
title: "Z-알고리즘: 선형 시간 문자열 분석"
description: "Z-알고리즘의 Z 배열 정의, Z-box를 활용한 O(n) 구축, 패턴 검색에의 응용(pat#text), 문자열 주기성·팰린드롬 판별, KMP와의 관계까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["Z알고리즘", "Z배열", "문자열검색", "패턴매칭", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-rolling-hash/)에서 롤링 해시로 부분 문자열을 O(1)에 비교하는 법을 다뤘다면, Z-알고리즘은 각 위치에서 문자열 자신의 접두사와 얼마나 겹치는지를 O(n)에 모두 계산합니다. KMP와 동등한 성능이면서 구현이 더 직관적입니다.

## Z 배열이란

문자열 `s`의 Z 배열: `Z[i]`는 `s[i..]`와 `s[0..]`의 **최장 공통 접두사(LCP)** 길이입니다.

예) `s = "aabxaab"`:

| i | s[i..] | LCP with s | Z[i] |
|---|--------|------------|------|
| 0 | aabxaab | (자기 자신) | 7 |
| 1 | abxaab | 1 (a=a, b≠a) | 1 |
| 2 | bxaab | 0 (b≠a) | 0 |
| 3 | xaab | 0 (x≠a) | 0 |
| 4 | aab | 3 (aab=aab) | 3 |
| 5 | ab | 1 (a=a, b≠a) | 1 |
| 6 | b | 0 (b≠a) | 0 |

![Z 배열](/assets/posts/dsa-z-algorithm-array.svg)

## Z-box로 O(n) 구현

Z 배열을 naive하게 구하면 O(n²)이지만, **Z-box [l, r)**를 유지해 이미 계산된 정보를 재사용하면 O(n)입니다.

Z-box는 현재까지 알려진 "가장 오른쪽으로 확장된 일치 구간"입니다. `s[l..r) == s[0..r-l)` 을 만족합니다.

```python
def z_function(s: str) -> list:
    n = len(s)
    z = [0] * n
    z[0] = n
    l, r = 0, 0  # Z-box [l, r)

    for i in range(1, n):
        # i가 Z-box 안에 있으면 z[i-l] 값 재사용
        if i < r:
            z[i] = min(r - i, z[i - l])

        # 확장 시도
        while i + z[i] < n and s[z[i]] == s[i + z[i]]:
            z[i] += 1

        # Z-box 갱신
        if i + z[i] > r:
            l, r = i, i + z[i]

    return z

print(z_function("aabxaab"))  # [7,1,0,0,3,1,0]
print(z_function("aaaaa"))    # [5,4,3,2,1]
```

**O(n) 증명**: `r`은 단조 증가합니다. `while` 루프에서 r이 증가하는 총 횟수는 n을 넘을 수 없으므로, 전체 루프 실행은 O(n)입니다.

## 패턴 검색: pat + "#" + text

`pat#text`를 연결해 Z 배열을 구하면, `Z[i] == len(pat)`인 위치 `i`에서 패턴이 텍스트에 나타납니다. `#`은 패턴과 텍스트 사이의 경계 역할을 해서 Z 값이 패턴 길이를 초과하지 않도록 막습니다.

![Z-알고리즘 패턴 검색](/assets/posts/dsa-z-algorithm-search.svg)

```python
def z_search(text: str, pattern: str) -> list:
    m = len(pattern)
    s = pattern + "#" + text
    z = z_function(s)

    # Z[i] == m인 위치 → 텍스트에서의 실제 위치는 i - m - 1
    return [i - m - 1 for i, v in enumerate(z) if v == m and i > m]

print(z_search("xxabcxx", "abc"))  # [2]
print(z_search("abababab", "ab"))  # [0, 2, 4, 6]
```

## 응용: 문자열 주기성

Z 배열로 문자열의 최소 주기를 O(n)에 찾을 수 있습니다.

```python
def min_period(s: str) -> int:
    n = len(s)
    z = z_function(s)
    for period in range(1, n + 1):
        if n % period != 0:
            continue
        # period가 최소 주기인지: Z[period] >= n - period
        if z[period] >= n - period:
            return period
    return n

print(min_period("abababab"))  # 2
print(min_period("abcabcabc")) # 3
print(min_period("abcde"))     # 5
```

## 응용: 문자열 보더 (Border)

문자열의 **보더(Border)**는 진정한 접두사이면서 동시에 진정한 접미사인 부분 문자열입니다.

```python
def all_borders(s: str) -> list:
    n = len(s)
    z = z_function(s)
    borders = []
    for i in range(1, n):
        # s[i..i+z[i]-1] == s[0..z[i]-1]
        # s[n-z[i]..n-1] == s[i..]이면 suffix이자 prefix
        if i + z[i] == n:
            borders.append(s[:z[i]])
    return borders

print(all_borders("abacaba"))  # ['a', 'aba', 'abacaba']
print(all_borders("aabaabaab")) # [...]
```

## Z 함수 ↔ KMP 실패 함수 변환

두 알고리즘은 같은 정보를 다른 방식으로 표현합니다. 서로 변환이 가능합니다.

```python
def z_to_kmp(z: list) -> list:
    n = len(z)
    fail = [0] * n
    for i in range(1, n):
        # z[i]개 위치에 fail 값 반영
        if z[i] > 0:
            fail[i + z[i] - 1] = max(fail[i + z[i] - 1], z[i])
    # fail 배열 전파
    for i in range(1, n):
        fail[i] = max(fail[i], fail[i-1] - 1 if fail[i-1] > 0 else 0)
    return fail
```

실용적으로는 각자를 직접 구현하는 것이 더 간단합니다.

## KMP vs Z-알고리즘 선택 가이드

| 상황 | 권장 |
|------|------|
| 단순 패턴 검색 | 둘 다 동등, 취향 따름 |
| 문자열 주기성·보더 탐지 | Z가 직관적 |
| 실패 함수 기반 응용 | KMP |
| 다중 패턴 (Aho-Corasick 기반) | KMP 실패 함수 개념 우선 |

---

**지난 글:** [롤링 해시: 부분 문자열 비교와 해시 충돌 방지](/posts/dsa-rolling-hash/)

**다음 글:** [마나커 알고리즘: 팰린드롬 부분 문자열 선형 탐색](/posts/dsa-manacher-algorithm/)

<br>
읽어주셔서 감사합니다. 😊
