---
title: "상위 K개 원소 (Top-K Elements)"
description: "크기 K 최소 힙을 이용한 O(N log K) Top-K 탐색, 빈도 기반 Top-K, 버킷 정렬 O(N) 풀이, Quickselect 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["TopK", "힙", "MinHeap", "빈도분석", "스트리밍"]
featured: false
draft: false
---

[지난 글](/posts/dsa-quickselect/)에서 k번째 원소를 평균 O(N)에 구하는 퀵셀렉트를 다뤘습니다. 이번에는 **상위 K개 원소**를 구하는 다양한 방법을 비교합니다.

## 핵심 아이디어: 크기 K 최소 힙

상위 K개 최댓값을 구할 때 크기 K인 **최소 힙(Min-Heap)**을 유지합니다.

- 힙 크기가 K 미만이면 무조건 push
- 힙 크기가 K이고 새 원소가 `heap[0]`보다 크면 `heappushpop`
- 작거나 같으면 무시

힙의 최솟값이 항상 "현재까지의 k번째로 큰 값"입니다. 모든 원소를 한 번씩 보므로 `O(N log K)`입니다.

![크기 K 최소 힙으로 Top-K 유지](/assets/posts/dsa-top-k-elements-concept.svg)

## 기본 구현

```python
import heapq

def top_k_largest(nums, k):
    """상위 k개 최댓값 반환"""
    heap = []
    for x in nums:
        if len(heap) < k:
            heapq.heappush(heap, x)
        elif x > heap[0]:
            heapq.heapreplace(heap, x)  # heappop + heappush (더 빠름)
    return sorted(heap, reverse=True)
```

`heapreplace`는 `heappushpop`과 달리 힙이 비어있으면 에러를 내므로, 크기 확인 후 사용합니다.

Python 내장으로 한 줄 처리도 가능합니다.

```python
import heapq
result = heapq.nlargest(k, nums)  # O(N log K)
```

## 빈도 기반 Top-K

가장 자주 등장하는 K개 원소를 구하는 변형 문제입니다.

![빈도 기반 Top-K 힙과 버킷 정렬](/assets/posts/dsa-top-k-elements-patterns.svg)

```python
from collections import Counter
import heapq

def top_k_frequent(nums, k):
    cnt = Counter(nums)
    # (freq, val) 쌍으로 최소 힙 유지
    heap = []
    for val, freq in cnt.items():
        heapq.heappush(heap, (freq, val))
        if len(heap) > k:
            heapq.heappop(heap)
    return [v for _, v in heap]
```

버킷 정렬을 쓰면 O(N)으로 더 빠릅니다.

```python
def top_k_frequent_bucket(nums, k):
    cnt = Counter(nums)
    buckets = [[] for _ in range(len(nums) + 1)]
    for val, freq in cnt.items():
        buckets[freq].append(val)

    res = []
    for bucket in reversed(buckets):
        res.extend(bucket)
        if len(res) >= k:
            return res[:k]
    return res
```

## 스트리밍 시나리오

온라인(streaming) 데이터에서 항상 "현재까지 상위 K개"를 유지해야 한다면 힙이 최적입니다.

```python
class TopKStream:
    def __init__(self, k):
        self.k = k
        self.heap = []

    def add(self, val):
        if len(self.heap) < self.k:
            heapq.heappush(self.heap, val)
        elif val > self.heap[0]:
            heapq.heapreplace(self.heap, val)

    def get_top_k(self):
        return sorted(self.heap, reverse=True)
```

각 `add()` 호출이 O(log K)입니다. N개의 원소 처리 시 O(N log K).

## 방법별 비교

| 방법 | 시간 | 공간 | 최적 케이스 |
|------|------|------|-------------|
| 정렬 후 슬라이싱 | O(N log N) | O(N) | 전체 순서 필요 |
| 최소 힙 크기 K | O(N log K) | O(K) | k가 N보다 훨씬 작음, 스트리밍 |
| Quickselect | O(N) 평균 | O(1) | 오프라인, 순서 불필요 |
| 버킷 정렬 | O(N) | O(N) | 빈도 기반, 정수 범위 제한 |

k가 작으면 힙, k ≈ N이면 정렬, 정확한 선형 보장이 필요하면 Quickselect + 정렬, 빈도 문제는 버킷 정렬이 답입니다.

## K번째로 큰 스트리밍 수 (Kth Largest in Stream)

```python
class KthLargest:
    """스트리밍에서 항상 k번째로 큰 값 반환"""
    def __init__(self, k, nums):
        self.k = k
        self.heap = heapq.nsmallest(k, nums)  # 초기 k개 최솟값
        heapq.heapify(self.heap)

    def add(self, val):
        heapq.heappush(self.heap, val)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]  # heap[0] = k번째로 큰 값
```

---

**지난 글:** [퀵셀렉트(Quickselect)](/posts/dsa-quickselect/)

**다음 글:** [투 포인터(Two Pointers)](/posts/dsa-two-pointers/)

<br>
읽어주셔서 감사합니다. 😊
