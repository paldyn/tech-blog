---
title: "구간 DP (Interval DP): 팰린드롬·풍선·돌 합치기"
description: "구간 [i..j]를 분할 위치 k로 나누는 Interval DP 패턴을 대각선 채우기 방식과 함께 풍선 터뜨리기, 팰린드롬 분할, 돌 합치기 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "구간DP", "Interval DP", "풍선터뜨리기", "팰린드롬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-matrix-chain-multiplication/)에서 행렬 연쇄 곱셈을 구간 DP로 해결했습니다. 이번 글에서는 **구간 DP(Interval DP)**의 일반적인 패턴과 대표 문제들을 체계적으로 다룹니다. 구간 DP는 "연속된 구간 [i..j]에 대한 최적해를, 그 구간을 두 부분으로 나누는 분할 위치 k를 탐색해 구한다"는 구조를 가집니다.

## 구간 DP의 일반 패턴

```python
# 구간 DP 뼈대
n = len(arr)
dp = [[0] * n for _ in range(n)]

# 기저: 길이 1 구간 초기화
for i in range(n):
    dp[i][i] = base_value(i)

# 길이 2, 3, ... n 순서로 채우기 (대각선 방향)
for length in range(2, n + 1):         # 구간 길이
    for i in range(n - length + 1):    # 시작 인덱스
        j = i + length - 1             # 끝 인덱스
        dp[i][j] = float('inf')        # 또는 0, -inf
        for k in range(i, j):          # 분할 위치
            dp[i][j] = optimize(dp[i][j], merge(dp[i][k], dp[k+1][j], k))

answer = dp[0][n - 1]
```

**핵심**: 짧은 구간부터 채워야 긴 구간 계산 시 이미 완성된 부분 구간 값을 참조할 수 있습니다. 이것이 "대각선 방향 채우기"의 이유입니다.

![구간 DP 채우기 패턴](/assets/posts/dsa-interval-dp-pattern.svg)

## 팰린드롬 최소 분할 (Palindrome Partitioning)

문자열을 팰린드롬들로 분할할 때 필요한 최소 분할 횟수입니다.

```python
def min_cut(s: str) -> int:
    n = len(s)

    # is_palindrome[i][j]: s[i..j]가 팰린드롬인지
    pal = [[False] * n for _ in range(n)]
    for i in range(n):
        pal[i][i] = True
    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            if length == 2:
                pal[i][j] = (s[i] == s[j])
            else:
                pal[i][j] = (s[i] == s[j]) and pal[i + 1][j - 1]

    # dp[i] = s[0..i]의 최소 분할 횟수
    dp = list(range(n))   # 최대: i번 분할 (길이 1짜리로 나누기)
    for i in range(1, n):
        if pal[0][i]:
            dp[i] = 0     # 전체가 팰린드롬 → 분할 불필요
            continue
        for j in range(1, i + 1):
            if pal[j][i]:
                dp[i] = min(dp[i], dp[j - 1] + 1)

    return dp[n - 1]

print(min_cut("aab"))   # 1 ("aa" | "b")
print(min_cut("abcd"))  # 3
```

## 풍선 터뜨리기 (Burst Balloons)

`nums` 배열의 풍선을 하나씩 터뜨릴 때, 터뜨린 풍선과 양쪽 이웃 풍선 값의 곱이 점수입니다. 점수 합계를 최대화합니다.

핵심 발상: "k를 구간에서 **마지막으로** 터뜨린다"고 정의하면, k를 터뜨릴 시점에 양쪽 이웃이 i-1과 j+1로 고정됩니다.

```python
def max_coins(nums: list) -> int:
    arr = [1] + nums + [1]   # 경계 1 패딩
    n = len(arr)
    dp = [[0] * n for _ in range(n)]

    for length in range(1, n - 1):
        for i in range(1, n - 1 - length + 1):
            j = i + length - 1
            for k in range(i, j + 1):   # k가 마지막으로 터지는 풍선
                gain = arr[i - 1] * arr[k] * arr[j + 1]
                left = dp[i][k - 1] if k > i else 0
                right = dp[k + 1][j] if k < j else 0
                dp[i][j] = max(dp[i][j], gain + left + right)

    return dp[1][n - 2]

print(max_coins([3, 1, 5, 8]))  # 167
```

![풍선 터뜨리기 구간 DP](/assets/posts/dsa-interval-dp-balloon.svg)

## 돌 합치기 (Stone Merging)

n개의 돌을 인접한 2개씩 순서대로 합치는 비용 최소화입니다. 비용은 두 그룹의 돌 개수 합이며, 행렬 연쇄 곱셈과 동일한 구조입니다.

```python
def min_cost_merge_stones(stones: list) -> int:
    n = len(stones)
    prefix = [0] * (n + 1)
    for i in range(n):
        prefix[i + 1] = prefix[i] + stones[i]

    dp = [[0] * n for _ in range(n)]

    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            dp[i][j] = float('inf')
            # 두 그룹을 합치는 비용은 prefix[j+1] - prefix[i] (두 그룹 합)
            for k in range(i, j):
                dp[i][j] = min(dp[i][j],
                               dp[i][k] + dp[k + 1][j]
                               + prefix[j + 1] - prefix[i])

    return dp[0][n - 1]

print(min_cost_merge_stones([2, 3, 4, 2]))  # 26
```

## 구간 DP 유형 정리

| 문제 | dp 의미 | 전이 방식 |
|---|---|---|
| 행렬 연쇄 곱셈 | [i..j] 최소 곱셈 비용 | k: 두 그룹 분할 위치 |
| 풍선 터뜨리기 | [i..j] 최대 점수 | k: 마지막으로 터지는 풍선 |
| 팰린드롬 분할 | [0..i] 최소 분할 수 | j: 팰린드롬 구간 끝 |
| 돌 합치기 | [i..j] 최소 비용 | k: 두 더미 합치는 위치 |
| 최적 BST | [i..j] 최소 탐색 비용 | k: 루트 노드 |

공통점: **길이 순서로 구간을 채운다**는 방향성만 기억하면 대부분의 구간 DP 문제에 뼈대를 그대로 적용할 수 있습니다.

---

**지난 글:** [행렬 연쇄 곱셈](/posts/dsa-matrix-chain-multiplication/)

**다음 글:** [비트마스크 DP (Bitmask DP)](/posts/dsa-bitmask-dp/)

<br>
읽어주셔서 감사합니다. 😊
