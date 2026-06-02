---
title: "우선순위 큐 (Priority Queue)"
description: "이진 힙으로 구현하는 우선순위 큐의 개념, Python heapq 활용법, 커스텀 비교, 그리고 다익스트라·Top-K·스케줄링 실전 적용을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["우선순위 큐", "Priority Queue", "heapq", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-heap/)에서 힙의 구조와 Sift-Up/Sift-Down 연산을 살펴봤습니다. 우선순위 큐는 힙을 **추상화한 ADT(Abstract Data Type)**입니다. "가장 높은(또는 낮은) 우선순위의 원소를 먼저 꺼낼 수 있는 자료구조"라고 정의하며, 내부 구현은 이진 힙, 피보나치 힙, 레드-블랙 트리 등 다양합니다.

## 개념과 구현 비교

![우선순위 큐 동작 원리](/assets/posts/dsa-priority-queue-concept.svg)

## Python heapq 기초

Python의 `heapq`는 **최소 힙**입니다. 최대 힙이 필요하면 값에 `-1`을 곱합니다.

```python
import heapq

# 기본 사용
pq = []
heapq.heappush(pq, 5)
heapq.heappush(pq, 1)
heapq.heappush(pq, 3)
print(heapq.heappop(pq))   # 1 (최솟값)
print(pq[0])                # peek: 현재 최솟값

# 리스트로 초기화
nums = [3, 1, 4, 1, 5, 9]
heapq.heapify(nums)         # in-place O(n)
print(heapq.heappop(nums))  # 1
```

## 튜플을 이용한 우선순위 지정

```python
import heapq

# (우선순위, 데이터) 튜플 — 우선순위 오름차순
tasks = []
heapq.heappush(tasks, (3, '일반 작업'))
heapq.heappush(tasks, (1, '긴급 작업'))
heapq.heappush(tasks, (2, '중요 작업'))

while tasks:
    priority, task = heapq.heappop(tasks)
    print(f'{priority}: {task}')
# 1: 긴급 작업
# 2: 중요 작업
# 3: 일반 작업
```

## 커스텀 객체 비교

`__lt__`를 정의하거나 래퍼 클래스를 사용합니다.

```python
from dataclasses import dataclass, field

@dataclass(order=True)
class Task:
    priority: int
    name: str = field(compare=False)  # 이름은 비교 제외

pq = []
heapq.heappush(pq, Task(1, '긴급'))
heapq.heappush(pq, Task(3, '일반'))
heapq.heappush(pq, Task(2, '중요'))
print(heapq.heappop(pq).name)  # '긴급'
```

## 활용 사례

![우선순위 큐 활용](/assets/posts/dsa-priority-queue-apps.svg)

### Top-K 문제

```python
import heapq

def top_k_largest(nums, k):
    # 크기 k인 최소 힙 유지 → O(n log k)
    heap = nums[:k]
    heapq.heapify(heap)
    for n in nums[k:]:
        if n > heap[0]:
            heapq.heapreplace(heap, n)  # pop+push 최적화
    return sorted(heap, reverse=True)

print(top_k_largest([3, 1, 4, 1, 5, 9, 2, 6], 3))  # [9, 6, 5]
```

### 다익스트라 최단경로

```python
import heapq

def dijkstra(graph, start):
    dist = {node: float('inf') for node in graph}
    dist[start] = 0
    pq = [(0, start)]  # (거리, 노드)

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:    # 이미 처리된 노드
            continue
        for v, weight in graph[u]:
            nd = d + weight
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist

# 사용 예
graph = {
    'A': [('B', 1), ('C', 4)],
    'B': [('C', 2), ('D', 5)],
    'C': [('D', 1)],
    'D': []
}
print(dijkstra(graph, 'A'))
# {'A': 0, 'B': 1, 'C': 3, 'D': 4}
```

### K 정렬된 배열 병합

```python
def merge_k_sorted(arrays):
    # (값, 배열인덱스, 원소인덱스) 힙
    heap = [(arr[0], i, 0) for i, arr in enumerate(arrays) if arr]
    heapq.heapify(heap)
    result = []
    while heap:
        val, arr_i, elem_i = heapq.heappop(heap)
        result.append(val)
        if elem_i + 1 < len(arrays[arr_i]):
            heapq.heappush(heap, (arrays[arr_i][elem_i + 1], arr_i, elem_i + 1))
    return result

print(merge_k_sorted([[1, 4, 7], [2, 5, 8], [3, 6, 9]]))
# [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## 주요 연산 복잡도

| 연산 | 이진 힙 | 피보나치 힙 |
|---|---|---|
| insert | O(log n) | O(1) 분할상환 |
| peek | O(1) | O(1) |
| pop | O(log n) | O(log n) 분할상환 |
| decrease-key | O(log n) | O(1) 분할상환 |

피보나치 힙은 이론적으로 우수하지만 상수가 크고 구현이 복잡합니다. 실무에서는 거의 항상 이진 힙을 사용합니다.

---

**지난 글:** [힙 (Heap)](/posts/dsa-heap/)

**다음 글:** [트라이 (Trie)](/posts/dsa-trie/)

<br>
읽어주셔서 감사합니다. 😊
