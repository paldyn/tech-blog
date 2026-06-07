---
title: "투 포인터 (Two Pointers)"
description: "두 인덱스를 독립적으로 이동해 O(N²)를 O(N)으로 줄이는 투 포인터 기법의 세 가지 패턴, 적용 조건, 대표 구현을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["투포인터", "TwoPointers", "SlowFast", "TwoSum", "배열최적화"]
featured: false
draft: false
---

[지난 글](/posts/dsa-top-k-elements/)에서 힙 기반 Top-K 탐색을 다뤘습니다. 이번에는 O(N²) 중첩 루프를 O(N)으로 줄이는 **투 포인터(Two Pointers)** 기법입니다.

## 핵심 아이디어

두 개의 인덱스(포인터)를 배열 위에서 이동하며 목적 조건을 탐색합니다. 각 포인터가 최대 N번씩 이동하므로 전체 복잡도는 `O(N)`입니다. 이중 루프의 O(N²) 대비 극적인 개선입니다.

적용 조건은 단 하나입니다: **포인터 이동이 단조(monotone)** 해야 합니다. 포인터는 역방향으로 돌아가지 않아야 합니다.

![투 포인터 세 가지 패턴](/assets/posts/dsa-two-pointers-concept.svg)

## 패턴 1: 양쪽 끝에서 수렴

정렬된 배열에서 합이 target인 두 수를 찾습니다.

![투 포인터 구현 패턴](/assets/posts/dsa-two-pointers-impl.svg)

```python
def two_sum_sorted(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo < hi:
        s = arr[lo] + arr[hi]
        if s == target:
            return [lo, hi]
        elif s < target:
            lo += 1
        else:
            hi -= 1
    return None
```

`sum < target`이면 합을 키워야 하므로 작은 쪽 포인터를 오른쪽으로, `sum > target`이면 큰 쪽 포인터를 왼쪽으로 이동합니다. 정렬이 단조성을 보장합니다.

## 패턴 2: 같은 방향 (Slow/Fast)

`slow`는 조건을 만족할 때, `fast`는 매 스텝 이동합니다.

```python
def remove_duplicates(arr):
    """정렬 배열에서 중복 제거 후 고유 원소 개수 반환 (in-place)"""
    if not arr:
        return 0
    slow = 0
    for fast in range(1, len(arr)):
        if arr[fast] != arr[slow]:
            slow += 1
            arr[slow] = arr[fast]
    return slow + 1
```

`fast`가 새 값을 발견하면 `slow`가 전진하며 덮어씁니다. `arr[:slow+1]`이 고유 원소 구간입니다.

## 패턴 3: 분리 배열 병합

두 정렬 배열을 O(N + M)에 병합합니다.

```python
def merge_sorted(A, B):
    i, j = 0, 0
    result = []
    while i < len(A) and j < len(B):
        if A[i] <= B[j]:
            result.append(A[i]); i += 1
        else:
            result.append(B[j]); j += 1
    result.extend(A[i:])
    result.extend(B[j:])
    return result
```

## 응용: 3Sum

정렬 후 각 원소를 고정하고, 나머지 두 원소에 투 포인터를 적용합니다.

```python
def three_sum(nums):
    nums.sort()
    result = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:  # 중복 건너뜀
            continue
        lo, hi = i + 1, len(nums) - 1
        while lo < hi:
            s = nums[i] + nums[lo] + nums[hi]
            if s == 0:
                result.append([nums[i], nums[lo], nums[hi]])
                while lo < hi and nums[lo] == nums[lo + 1]: lo += 1
                while lo < hi and nums[hi] == nums[hi - 1]: hi -= 1
                lo += 1; hi -= 1
            elif s < 0:
                lo += 1
            else:
                hi -= 1
    return result
```

전체 복잡도: O(N²) — 정렬 O(N log N) + 각 원소마다 투 포인터 O(N).

## 응용: 컨테이너에 가장 많은 물

```python
def max_water(heights):
    lo, hi = 0, len(heights) - 1
    max_area = 0
    while lo < hi:
        area = min(heights[lo], heights[hi]) * (hi - lo)
        max_area = max(max_area, area)
        if heights[lo] < heights[hi]:
            lo += 1
        else:
            hi -= 1
    return max_area
```

키가 낮은 쪽 포인터를 이동합니다. 높은 쪽을 이동하면 폭도 줄고 높이도 안 늘어나 최적성을 잃습니다.

## 정리

| 패턴 | 이동 방향 | 종료 조건 | 대표 문제 |
|------|-----------|-----------|-----------|
| 수렴 | 서로 다가옴 | lo >= hi | Two Sum, 트랩핑 물 |
| Slow/Fast | 같은 방향 | fast 끝 | 중복 제거, 파티션 |
| 병합 | 각 배열에서 | 어느 쪽 끝 | Merge Sort 병합 |

---

**지난 글:** [상위 K개 원소(Top-K Elements)](/posts/dsa-top-k-elements/)

**다음 글:** [슬라이딩 윈도우(Sliding Window)](/posts/dsa-sliding-window/)

<br>
읽어주셔서 감사합니다. 😊
