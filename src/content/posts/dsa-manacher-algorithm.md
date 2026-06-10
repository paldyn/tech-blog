---
title: "마나커 알고리즘: 팰린드롬 부분 문자열 선형 탐색"
description: "마나커(Manacher) 알고리즘의 핵심 아이디어인 문자열 변환(#삽입), P 배열, 오른쪽 경계 C·R을 이용한 O(n) 구현, 최장 팰린드롬 부분 문자열 탐색, 모든 팰린드롬 열거 응용까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["마나커", "팰린드롬", "문자열", "선형시간", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-z-algorithm/)에서 Z 배열로 문자열 접두사 매칭을 O(n)에 처리했다면, 마나커 알고리즘은 모든 위치에서의 **팰린드롬 반지름**을 O(n)에 계산합니다. 브루트 포스 O(n²) 대비 획기적인 개선이며, LeetCode "Longest Palindromic Substring" 문제의 최적해입니다.

## 문제와 어려움

길이 n인 문자열에서 가장 긴 팰린드롬 부분 문자열을 찾는 것. 브루트 포스는 각 중심에서 양방향 확장을 해야 해서 O(n²)입니다.

```python
# O(n^2) 브루트 포스
def longest_palindrome_naive(s):
    n = len(s)
    best = ""
    for center in range(n):
        # 홀수 길이
        l, r = center, center
        while l >= 0 and r < n and s[l] == s[r]:
            if r - l + 1 > len(best):
                best = s[l:r+1]
            l -= 1; r += 1
        # 짝수 길이
        l, r = center, center + 1
        while l >= 0 and r < n and s[l] == s[r]:
            if r - l + 1 > len(best):
                best = s[l:r+1]
            l -= 1; r += 1
    return best
```

홀수/짝수 팰린드롬을 따로 처리해야 하는 것도 불편합니다.

## 핵심 아이디어 1: 문자열 변환

`#` 구분자를 삽입해 짝수 길이 팰린드롬을 홀수 길이로 통합합니다.

```python
def transform(s: str) -> str:
    return '#' + '#'.join(s) + '#'

# "abba" → "#a#b#b#a#"
# "aba"  → "#a#b#a#"
```

이제 모든 팰린드롬은 변환된 문자열 T에서 **홀수 길이**가 됩니다.

![마나커 변환](/assets/posts/dsa-manacher-transform.svg)

## 핵심 아이디어 2: P 배열과 오른쪽 경계

`P[i]`: T에서 i를 중심으로 하는 팰린드롬의 **반지름** (중심 제외)

Z 알고리즘의 Z-box처럼, 마나커는 **오른쪽 경계 R**과 그 팰린드롬의 **중심 C**를 유지합니다.

새 위치 i를 처리할 때:
1. `i < R`이면: C에 대한 i의 대칭점 mirror = `2*C - i`의 P값을 재사용
2. `i >= R`이면: P[i] = 0에서 새로 시작

![마나커 알고리즘](/assets/posts/dsa-manacher-algorithm-viz.svg)

## 완전한 구현

```python
def manacher(s: str) -> list:
    T = '#' + '#'.join(s) + '#'
    n = len(T)
    P = [0] * n
    C = R = 0  # 현재 최대 오른쪽 팰린드롬의 중심, 오른쪽 경계

    for i in range(n):
        mirror = 2 * C - i

        if i < R:
            P[i] = min(R - i, P[mirror])

        # 직접 확장
        a, b = i - P[i] - 1, i + P[i] + 1
        while a >= 0 and b < n and T[a] == T[b]:
            P[i] += 1
            a -= 1
            b += 1

        # C, R 갱신
        if i + P[i] > R:
            C, R = i, i + P[i]

    return P


def longest_palindrome(s: str) -> str:
    if not s:
        return ""
    P = manacher(s)
    # P[i]가 최대인 인덱스 찾기
    center = max(range(len(P)), key=lambda i: P[i])
    max_r = P[center]
    # 변환된 문자열에서 원본 인덱스로 환원
    # 원본 시작 = (center - max_r) // 2
    start = (center - max_r) // 2
    return s[start : start + max_r]

print(longest_palindrome("babad"))    # "bab" 또는 "aba"
print(longest_palindrome("cbbd"))     # "bb"
print(longest_palindrome("racecar"))  # "racecar"
```

## O(n) 증명

R은 단조 증가합니다. `while` 루프에서 R이 증가하는 총 횟수는 n을 초과할 수 없으므로, 전체 루프는 O(n)입니다. Z-알고리즘과 동일한 논리입니다.

## 응용: 모든 팰린드롬 부분 문자열 개수

```python
def count_palindromes(s: str) -> int:
    P = manacher(s)
    # P[i]가 r이면, 해당 위치에 (r+1)//2 또는 r//2+1개의 팰린드롬이 있음
    # 각 P[i]에서 기여하는 팰린드롬 수
    count = 0
    for r in P:
        count += (r + 1) // 2
    return count

print(count_palindromes("aaa"))   # 6: a,a,a,aa,aa,aaa
```

## 응용: 팰린드롬 분할 (Palindrome Partitioning)

```python
def min_cuts(s: str) -> int:
    n = len(s)
    P = manacher(s)
    T = '#' + '#'.join(s) + '#'

    # is_palindrome[l][r]: s[l..r]이 팰린드롬인지 O(1) 쿼리
    def is_pal(l, r):
        # T에서 중심 인덱스 = l + r + 1, P[center] >= r - l
        center = l + r + 1
        return P[center] >= r - l

    # DP
    dp = list(range(n))  # dp[i] = s[0..i]의 최소 분할
    for i in range(1, n):
        if is_pal(0, i):
            dp[i] = 0
            continue
        for j in range(1, i + 1):
            if is_pal(j, i):
                dp[i] = min(dp[i], dp[j-1] + 1)
    return dp[n-1]

print(min_cuts("aab"))   # 1 → ["aa","b"]
print(min_cuts("madam")) # 0 → 전체가 팰린드롬
```

## 복잡도 요약

| 연산 | 시간 | 공간 |
|------|------|------|
| P 배열 구축 | O(n) | O(n) |
| 최장 팰린드롬 쿼리 | O(1) | - |
| 임의 구간 팰린드롬 여부 | O(1) | - |
| 팰린드롬 개수 | O(n) | - |

마나커는 LCS, KMP, Z-function과 더불어 문자열 알고리즘의 필수 4대 기법 중 하나입니다.

---

**지난 글:** [Z-알고리즘: 선형 시간 문자열 분석](/posts/dsa-z-algorithm/)

**다음 글:** [보이어-무어 알고리즘: 실용적인 고속 문자열 검색](/posts/dsa-boyer-moore/)

<br>
읽어주셔서 감사합니다. 😊
