---
title: "슬라이딩 윈도우 (Sliding Window)"
description: "연속 부분 배열/문자열 최적화 문제를 O(N)에 해결하는 슬라이딩 윈도우의 고정·가변 크기 패턴, 대표 구현, 투 포인터와의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["슬라이딩윈도우", "SlidingWindow", "부분배열", "문자열최적화", "O(N)"]
featured: false
draft: false
---

[지난 글](/posts/dsa-two-pointers/)에서 투 포인터로 O(N²)을 O(N)으로 줄이는 방법을 다뤘습니다. 이번에는 **연속 부분 배열·문자열** 최적화에 특화된 **슬라이딩 윈도우(Sliding Window)**입니다.

## 핵심 아이디어

`[left, right]` 구간(윈도우)을 배열 위에서 슬라이드합니다. 새 원소를 오른쪽에 추가하고 왼쪽에서 제거할 때, 이전 윈도우 결과를 **재활용**해 재계산 비용을 O(1)로 낮춥니다.

- **고정 크기(k)**: `right - left + 1 == k`를 유지하며 슬라이드
- **가변 크기**: 조건이 만족되면 `right++`로 확장, 위반되면 `left++`로 축소

![슬라이딩 윈도우 고정·가변 크기 개념](/assets/posts/dsa-sliding-window-concept.svg)

## 고정 크기 윈도우: 최대 부분합

크기 k인 모든 연속 부분 배열의 합 중 최댓값을 구합니다.

```python
def max_sum_fixed(arr, k):
    n = len(arr)
    if n < k:
        return None
    # 첫 윈도우
    window_sum = sum(arr[:k])
    best = window_sum
    # 슬라이드: 왼쪽 원소 제거, 오른쪽 원소 추가
    for i in range(k, n):
        window_sum += arr[i] - arr[i - k]
        best = max(best, window_sum)
    return best
```

각 슬라이드가 O(1)이므로 전체 O(N). 배열 전체 합을 매번 재계산하는 O(N·k) 대비 k배 빠릅니다.

## 가변 크기 윈도우: 중복 없는 최장 부분 문자열

![중복 없는 최장 부분 문자열 구현](/assets/posts/dsa-sliding-window-impl.svg)

```python
def longest_no_repeat(s):
    last_seen = {}
    left = best = 0
    for right, ch in enumerate(s):
        if ch in last_seen and last_seen[ch] >= left:
            left = last_seen[ch] + 1  # left 점프
        last_seen[ch] = right
        best = max(best, right - left + 1)
    return best
```

`last_seen[ch] >= left` 조건이 중요합니다. 현재 윈도우 안에서 중복인 경우에만 left를 이동합니다. 윈도우 바깥의 오래된 등장은 무시합니다.

## 가변 크기 윈도우: 합이 target 이상인 최소 길이

```python
def min_length_sum(nums, target):
    left = 0
    window_sum = 0
    best = float('inf')
    for right in range(len(nums)):
        window_sum += nums[right]
        while window_sum >= target:
            best = min(best, right - left + 1)
            window_sum -= nums[left]
            left += 1
    return best if best != float('inf') else 0
```

`right`는 단조 증가, `while`로 `left`를 조건 위반 시 축소합니다. `right`와 `left` 모두 최대 N번 이동 → O(N).

## 가변 크기 윈도우: k종류 이하 문자 최장 부분 문자열

```python
from collections import defaultdict

def longest_k_distinct(s, k):
    freq = defaultdict(int)
    left = best = 0
    for right, ch in enumerate(s):
        freq[ch] += 1
        while len(freq) > k:      # 조건 위반: 종류 수 초과
            freq[s[left]] -= 1
            if freq[s[left]] == 0:
                del freq[s[left]]
            left += 1
        best = max(best, right - left + 1)
    return best
```

## 슬라이딩 윈도우 vs 투 포인터

두 기법은 비슷하지만 초점이 다릅니다.

| 항목 | 슬라이딩 윈도우 | 투 포인터 |
|------|-----------------|-----------|
| 초점 | 연속 구간 자체 | 두 원소의 관계 |
| right 이동 | 항상 전진 | 조건에 따라 결정 |
| 대표 문제 | 부분 배열 최적화, 문자열 | Two Sum, 병합 |

슬라이딩 윈도우는 투 포인터의 특수한 형태입니다. `right`가 항상 전진하면서 구간 내부 상태(합, 빈도, 집합)를 유지하는 것이 특징입니다.

## 덱(Deque)을 활용한 슬라이딩 윈도우 최댓값

```python
from collections import deque

def sliding_window_max(nums, k):
    dq = deque()  # 단조 감소 덱 (인덱스 저장)
    result = []
    for i, x in enumerate(nums):
        # 만료된 인덱스 제거
        while dq and dq[0] < i - k + 1:
            dq.popleft()
        # 오른쪽에서 자신보다 작은 인덱스 제거 (단조 유지)
        while dq and nums[dq[-1]] < x:
            dq.pop()
        dq.append(i)
        if i >= k - 1:
            result.append(nums[dq[0]])
    return result
```

O(N)에 크기 k 모든 윈도우의 최댓값을 구합니다.

---

**지난 글:** [투 포인터(Two Pointers)](/posts/dsa-two-pointers/)

**다음 글:** [누적 합(Prefix Sum)](/posts/dsa-prefix-sum/)

<br>
읽어주셔서 감사합니다. 😊
