---
title: "최장 증가 부분 수열 (LIS): O(n²)와 O(n log n)"
description: "LIS(Longest Increasing Subsequence)를 O(n²) DP와 O(n log n) 이분 탐색 두 가지 방법으로 구현하고, 실제 수열 복원과 응용 문제까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "LIS", "최장증가부분수열", "이분탐색", "인내정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-tree-dp/)에서 트리 DP로 서브트리를 합산하는 패턴을 살펴봤습니다. 이번에는 DP의 고전 문제인 **최장 증가 부분 수열(LIS, Longest Increasing Subsequence)**을 다룹니다. 배열에서 순서를 유지하면서 값이 증가하는 가장 긴 부분 수열을 구하는 문제로, O(n²) DP와 O(n log n) 이분 탐색 두 가지 접근을 모두 이해하는 것이 중요합니다.

## 문제 정의

배열 `nums`에서 인덱스 순서를 유지하면서 원소값이 순증가하는 가장 긴 부분 수열의 길이를 구합니다.

예시: `nums = [10, 9, 2, 5, 3, 7, 101, 18]`
- LIS: `2, 5, 7, 101` 또는 `2, 3, 7, 101` 또는 `2, 3, 7, 18` → 길이 **4**

## O(n²) DP 방법

`dp[i]` = `nums[i]`를 마지막 원소로 하는 LIS의 길이.

```python
def length_of_lis_n2(nums: list) -> int:
    if not nums:
        return 0
    n = len(nums)
    dp = [1] * n   # 각 원소 하나만 있는 수열 길이 = 1

    for i in range(1, n):
        for j in range(i):
            if nums[j] < nums[i]:          # 증가 조건
                dp[i] = max(dp[i], dp[j] + 1)

    return max(dp)

print(length_of_lis_n2([10, 9, 2, 5, 3, 7, 101, 18]))  # 4
```

시간 O(n²), 공간 O(n). n이 작을 때 직관적이며 구현이 쉽습니다.

![LIS DP 테이블과 tails 배열](/assets/posts/dsa-longest-increasing-subsequence-dp.svg)

## O(n log n) 방법: 인내 정렬 (Patience Sorting)

`tails[k]` = 길이 k+1인 증가 수열들 중 끝 원소의 최솟값.

각 원소 x에 대해:
1. `tails`에서 x 이상인 첫 위치를 이분 탐색으로 찾습니다
2. 그 위치에 x를 삽입(또는 교체)합니다
3. 위치가 끝 너머면 새 길이의 수열이 생깁니다

```python
import bisect

def length_of_lis(nums: list) -> int:
    tails = []
    for x in nums:
        pos = bisect.bisect_left(tails, x)   # x가 들어갈 위치
        if pos == len(tails):
            tails.append(x)    # 새 최대 길이 확장
        else:
            tails[pos] = x     # 해당 길이 수열의 최소 끝 원소로 교체
    return len(tails)

# [10,9,2,5,3,7,101,18] 처리 과정:
# 10: tails=[10]
#  9: pos=0, tails=[9]
#  2: pos=0, tails=[2]
#  5: pos=1, tails=[2,5]
#  3: pos=1, tails=[2,3]
#  7: pos=2, tails=[2,3,7]
# 101: pos=3, tails=[2,3,7,101]
# 18: pos=3, tails=[2,3,7,18]
# len(tails) = 4
```

**왜 교체가 올바른가?** `tails[k]`를 더 작은 값으로 교체하면, 이후에 더 긴 수열을 만들 가능성이 높아집니다. 이 교체는 LIS 길이를 바꾸지 않으면서 미래에 유리한 상태를 유지합니다.

![O(n log n) LIS 이분 탐색](/assets/posts/dsa-longest-increasing-subsequence-bisect.svg)

## 실제 LIS 복원

길이만이 아니라 실제 수열을 복원하려면 각 원소의 tails 삽입 위치와 이전 원소를 추적합니다.

```python
import bisect

def lis_sequence(nums: list) -> list:
    n = len(nums)
    tails = []
    indices = []   # tails의 각 위치에 해당하는 원본 인덱스
    parent = [-1] * n  # parent[i] = i 이전 LIS 원소의 인덱스

    for i, x in enumerate(nums):
        pos = bisect.bisect_left(tails, x)
        if pos == len(tails):
            tails.append(x)
            indices.append(i)
        else:
            tails[pos] = x
            indices[pos] = i
        parent[i] = indices[pos - 1] if pos > 0 else -1

    # 역추적
    result = []
    idx = indices[-1]
    while idx != -1:
        result.append(nums[idx])
        idx = parent[idx]

    return result[::-1]

print(lis_sequence([10, 9, 2, 5, 3, 7, 101, 18]))
# [2, 3, 7, 18] 또는 [2, 3, 7, 101] (마지막 삽입에 따라)
```

## 응용: LIS 기반 문제들

**러시아 인형 봉투(Russian Doll Envelopes)**: 2D LIS 문제. 너비 오름차순 정렬 후 높이에 대해 LIS를 구합니다. 단, 너비가 같을 때 높이를 내림차순 정렬해야 같은 너비에서 여러 개가 선택되는 것을 방지합니다.

```python
def max_envelopes(envelopes: list) -> int:
    # 너비 오름차순, 너비 같으면 높이 내림차순
    envelopes.sort(key=lambda x: (x[0], -x[1]))
    heights = [h for _, h in envelopes]
    return length_of_lis(heights)   # 위 O(n log n) 함수 사용
```

**최장 비감소 부분 수열(LNDS)**: `bisect_left`를 `bisect_right`로 바꾸면 됩니다.

```python
def length_of_lnds(nums: list) -> int:
    tails = []
    for x in nums:
        pos = bisect.bisect_right(tails, x)  # ≤ x 인 위치 다음
        if pos == len(tails):
            tails.append(x)
        else:
            tails[pos] = x
    return len(tails)
```

## 복잡도 비교

| 방법 | 시간 | 공간 | 적합한 경우 |
|---|---|---|---|
| O(n²) DP | O(n²) | O(n) | n ≤ 2000 |
| O(n log n) | O(n log n) | O(n) | n ≤ 10^5 이상 |

실전에서는 n ≤ 1000이면 두 방법 모두 가능하지만, n이 수만 이상이면 반드시 O(n log n)을 사용해야 합니다.

---

**지난 글:** [트리 DP](/posts/dsa-tree-dp/)

**다음 글:** [최장 공통 부분 수열 (LCS)](/posts/dsa-longest-common-subsequence/)

<br>
읽어주셔서 감사합니다. 😊
