---
title: "누적 합 (Prefix Sum)"
description: "O(N) 전처리로 구간 합 쿼리를 O(1)에 처리하는 누적 합의 1차원·2차원 구현, 응용 패턴, 세그먼트 트리와의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["누적합", "PrefixSum", "구간합", "2D누적합", "전처리"]
featured: false
draft: false
---

[지난 글](/posts/dsa-sliding-window/)에서 슬라이딩 윈도우로 연속 구간을 O(N)에 처리하는 방법을 다뤘습니다. 이번에는 구간 합 쿼리를 O(1)에 답하는 **누적 합(Prefix Sum)**입니다.

## 핵심 아이디어

배열 A에 대해 `P[i] = A[0] + A[1] + ... + A[i-1]` (P[0] = 0)를 미리 계산합니다.

그러면 `A[l..r]`의 합은 `P[r+1] - P[l]`로 O(1)에 답합니다.

- 전처리: O(N)
- 쿼리 1회: O(1)
- Q개 쿼리: O(N + Q) (vs 순수 반복 O(NQ))

![누적 합 전처리와 구간 합 쿼리](/assets/posts/dsa-prefix-sum-concept.svg)

## 1차원 구현

```python
def build_prefix(arr):
    n = len(arr)
    P = [0] * (n + 1)
    for i in range(n):
        P[i + 1] = P[i] + arr[i]
    return P

def range_sum(P, l, r):
    """A[l..r] 합 (0-indexed, inclusive)"""
    return P[r + 1] - P[l]
```

P는 길이 n+1로 만들어 인덱스 처리를 단순화합니다. `P[0] = 0`이 경계 조건을 자연스럽게 처리합니다.

## 2차원 누적 합

행렬에서 직사각형 구간의 합을 O(1)에 구합니다.

![2차원 누적 합 포함·배제 원리](/assets/posts/dsa-prefix-sum-2d.svg)

```python
def build_2d_prefix(A):
    R, C = len(A), len(A[0])
    P = [[0] * (C + 1) for _ in range(R + 1)]
    for r in range(1, R + 1):
        for c in range(1, C + 1):
            P[r][c] = (A[r-1][c-1]
                       + P[r-1][c] + P[r][c-1]
                       - P[r-1][c-1])   # 포함·배제 원리
    return P

def rect_sum(P, r1, c1, r2, c2):
    """A[r1..r2][c1..c2] 합 (0-indexed)"""
    return (P[r2+1][c2+1] - P[r1][c2+1]
            - P[r2+1][c1] + P[r1][c1])
```

포함·배제 원리: 큰 직사각형에서 위쪽, 왼쪽을 빼고 두 번 뺀 겹침을 더합니다.

## 응용: 부분 배열 합이 k인 개수

```python
from collections import defaultdict

def count_subarrays_sum_k(nums, k):
    cnt = defaultdict(int)
    cnt[0] = 1  # P[0] = 0
    prefix = 0
    result = 0
    for x in nums:
        prefix += x
        result += cnt[prefix - k]  # P[j] = prefix - k 인 j 개수
        cnt[prefix] += 1
    return result
```

`prefix - k = P[j]`이면 `A[j..i]`의 합이 k. 해시맵으로 O(N)에 처리합니다.

## 응용: XOR 누적 합

XOR도 누적 합 방식이 그대로 적용됩니다. `XOR[l..r] = P[r+1] ^ P[l]` (XOR의 역원이 자기 자신이므로).

```python
def build_xor_prefix(arr):
    P = [0] * (len(arr) + 1)
    for i, x in enumerate(arr):
        P[i + 1] = P[i] ^ x
    return P

def range_xor(P, l, r):
    return P[r + 1] ^ P[l]
```

## 누적 합의 한계

누적 합은 **정적 배열**에만 O(1) 쿼리를 보장합니다. 배열이 업데이트되면 P 전체를 재계산해야 합니다.

| 문제 유형 | 최적 자료구조 |
|-----------|---------------|
| 업데이트 없음, 구간 합 | 누적 합 O(N+Q) |
| 업데이트 있음, 구간 합 | 펜윅 트리 O((N+Q) log N) |
| 업데이트 있음, 구간 합/최솟값/최댓값 | 세그먼트 트리 O((N+Q) log N) |

---

**지난 글:** [슬라이딩 윈도우(Sliding Window)](/posts/dsa-sliding-window/)

**다음 글:** [차이 배열(Difference Array)](/posts/dsa-difference-array/)

<br>
읽어주셔서 감사합니다. 😊
