---
title: "최장 공통 부분 수열 (LCS): 역추적과 응용 문제"
description: "LCS(Longest Common Subsequence)의 2D DP 점화식, 역추적으로 실제 수열 복원, 공간 최적화, 편집 거리·SCS·diff와의 관계까지 종합 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "LCS", "최장공통부분수열", "편집거리", "역추적"]
featured: false
draft: false
---

[지난 글](/posts/dsa-longest-increasing-subsequence/)에서 LIS를 O(n log n)으로 해결하는 이분 탐색 기법을 다뤘습니다. 이번 글에서는 두 문자열(또는 수열) 사이의 공통 구조를 찾는 **최장 공통 부분 수열(LCS, Longest Common Subsequence)**을 다룹니다. LCS는 편집 거리, diff 도구, DNA 분석 등 수많은 분야의 핵심 알고리즘입니다.

## 문제 정의

두 문자열 X와 Y에서, 두 문자열 모두의 부분 수열(연속하지 않아도 됨)이면서 가장 긴 문자열을 구합니다.

예시: X = "ABCBDAB", Y = "BDCAB"
- LCS: "BCAB" 또는 "BDAB" → 길이 **4**

부분 **문자열(Substring)**과 달리 부분 **수열(Subsequence)**은 원래 순서만 유지하면 되고, 연속일 필요가 없습니다.

## DP 점화식

`dp[i][j]` = X의 첫 i글자와 Y의 첫 j글자의 LCS 길이.

```text
dp[i][j] = dp[i-1][j-1] + 1            if X[i] == Y[j]
dp[i][j] = max(dp[i-1][j], dp[i][j-1]) if X[i] != Y[j]
기저: dp[0][j] = dp[i][0] = 0
```

```python
def lcs_length(X: str, Y: str) -> int:
    m, n = len(X), len(Y)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if X[i - 1] == Y[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    return dp[m][n]

print(lcs_length("ABCBDAB", "BDCAB"))  # 4
```

시간 O(mn), 공간 O(mn).

![LCS DP 테이블](/assets/posts/dsa-longest-common-subsequence-table.svg)

## 역추적: 실제 LCS 문자열 복원

`dp[m][n]`에서 출발해 역방향으로 추적합니다.

```python
def lcs_string(X: str, Y: str) -> str:
    m, n = len(X), len(Y)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if X[i - 1] == Y[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    # 역추적
    result = []
    i, j = m, n
    while i > 0 and j > 0:
        if X[i - 1] == Y[j - 1]:     # 문자가 일치 → LCS의 일부
            result.append(X[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] > dp[i][j - 1]:
            i -= 1                    # 위쪽 방향
        else:
            j -= 1                    # 왼쪽 방향

    return ''.join(reversed(result))

print(lcs_string("ABCBDAB", "BDCAB"))  # "BCAB" 또는 "BDAB"
```

역추적 도중 `dp[i-1][j] == dp[i][j-1]`인 경우 어느 방향이든 이동 가능하므로, LCS가 유일하지 않을 수 있습니다.

## 공간 최적화: O(min(m, n))

현재 행을 계산할 때 이전 행만 필요합니다. 1D 배열 하나와 `prev` 변수로 O(n) 공간을 달성합니다.

```python
def lcs_space_optimized(X: str, Y: str) -> int:
    # Y가 짧은 쪽이 되도록 조정
    if len(X) < len(Y):
        X, Y = Y, X
    m, n = len(X), len(Y)
    dp = [0] * (n + 1)

    for i in range(1, m + 1):
        prev = 0          # dp[i-1][j-1]을 추적
        for j in range(1, n + 1):
            curr = dp[j]  # 업데이트 전 dp[i-1][j] 저장
            if X[i - 1] == Y[j - 1]:
                dp[j] = prev + 1
            else:
                dp[j] = max(dp[j], dp[j - 1])
            prev = curr

    return dp[n]
```

단, 공간 최적화 후에는 역추적이 불가능합니다. 실제 LCS 문자열이 필요하면 전체 dp 테이블을 보존해야 합니다.

![LCS 역추적 및 응용 관계](/assets/posts/dsa-longest-common-subsequence-traceback.svg)

## LCS 기반 응용 문제들

**편집 거리(Edit Distance)**: X를 Y로 바꾸는 최소 삽입/삭제 횟수는 `m + n - 2 * LCS(X, Y)`.

```python
def min_edit_distance(X: str, Y: str) -> int:
    # 삽입/삭제만 허용 (교체 없음)
    return len(X) + len(Y) - 2 * lcs_length(X, Y)
```

**최단 공통 상위 수열(SCS, Shortest Common Supersequence)**: X와 Y를 모두 부분 수열로 포함하는 가장 짧은 수열의 길이는 `m + n - LCS`.

```python
def scs_length(X: str, Y: str) -> int:
    return len(X) + len(Y) - lcs_length(X, Y)
```

**최장 팰린드롬 부분 수열**: `LCS(s, reversed(s))`.

```python
def longest_palindrome_subsequence(s: str) -> int:
    return lcs_length(s, s[::-1])

print(longest_palindrome_subsequence("bbbab"))  # 4 ("bbbb")
```

**두 배열의 최소 삭제로 동일하게 만들기**: `m + n - 2 * LCS`.

## LCS vs LIS 비교

| | LCS | LIS |
|---|---|---|
| 입력 | 두 문자열/수열 | 하나의 수열 |
| 의미 | 공통 부분 수열 | 증가 부분 수열 |
| 기본 알고리즘 | O(mn) DP | O(n²) DP |
| 최적 알고리즘 | O(mn) — 이론 하한 | O(n log n) 이분 탐색 |
| 공간 최적화 | O(min(m,n)) | O(n) |

LCS는 두 시퀀스 비교가 본질이므로 O(mn) 이하로 내리기 어렵습니다. 단, 알파벳 크기가 작거나 특수한 구조가 있으면 더 빠른 알고리즘이 존재합니다.

---

**지난 글:** [최장 증가 부분 수열 (LIS)](/posts/dsa-longest-increasing-subsequence/)

**다음 글:** [편집 거리 (Edit Distance): 레벤슈타인 알고리즘 완전 분석](/posts/dsa-edit-distance/)

<br>
읽어주셔서 감사합니다. 😊
