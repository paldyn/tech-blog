---
title: "힙 (Heap)"
description: "완전 이진 트리를 배열로 표현하는 힙의 최대/최소 힙 속성, O(log n) 삽입·삭제, O(n) 힙 구성, 그리고 힙 정렬과 실전 활용을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["힙", "Heap", "최대힙", "최소힙", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-b-plus-tree/)에서 B+ 트리의 범위 검색 최적화를 살펴봤습니다. 이번 글은 완전히 다른 용도의 트리 자료구조인 **힙(Heap)**을 다룹니다. 힙은 "최솟값 또는 최댓값을 O(1)로 꺼내면서, 삽입과 삭제를 O(log n)로 처리"하는 데 특화된 자료구조입니다. 우선순위 큐, 힙 정렬, 다익스트라 알고리즘의 핵심입니다.

## 힙의 두 가지 속성

**힙 형태 속성**: 완전 이진 트리 (마지막 레벨을 제외한 모든 레벨이 꽉 차고, 마지막 레벨은 왼쪽부터 채움)

**힙 순서 속성**:
- **최대 힙**: 부모 ≥ 자식 (루트가 최댓값)
- **최소 힙**: 부모 ≤ 자식 (루트가 최솟값)

Python의 `heapq`는 최소 힙만 지원합니다. 최대 힙은 값에 음수를 붙여 사용합니다.

## 배열 표현

![힙 구조와 배열 표현](/assets/posts/dsa-heap-structure.svg)

완전 이진 트리는 **배열로 낭비 없이 표현**할 수 있습니다. 포인터가 필요 없어 메모리 효율이 좋고 캐시 친화적입니다.

```python
class MaxHeap:
    def __init__(self):
        self.heap = []

    def parent(self, i): return (i - 1) // 2
    def left(self, i):   return 2 * i + 1
    def right(self, i):  return 2 * i + 2

    def peek(self):      # O(1)
        return self.heap[0] if self.heap else None
```

## 삽입 — Sift-Up

![힙 연산](/assets/posts/dsa-heap-operations.svg)

새 원소를 마지막에 추가한 뒤 부모와 비교하며 위로 올립니다.

```python
def push(self, val):    # O(log n)
    self.heap.append(val)
    self._sift_up(len(self.heap) - 1)

def _sift_up(self, i):
    parent = self.parent(i)
    while i > 0 and self.heap[i] > self.heap[parent]:
        self.heap[i], self.heap[parent] = self.heap[parent], self.heap[i]
        i = parent
        parent = self.parent(i)
```

## 최대값 추출 — Sift-Down

루트를 꺼내고 마지막 원소를 루트로 옮긴 뒤 자식 중 큰 쪽과 교환하며 아래로 내립니다.

```python
def pop(self):           # O(log n)
    if not self.heap:
        return None
    top = self.heap[0]
    self.heap[0] = self.heap.pop()   # 마지막 원소 → 루트
    self._sift_down(0)
    return top

def _sift_down(self, i):
    n = len(self.heap)
    largest = i
    l, r = self.left(i), self.right(i)
    if l < n and self.heap[l] > self.heap[largest]:
        largest = l
    if r < n and self.heap[r] > self.heap[largest]:
        largest = r
    if largest != i:
        self.heap[i], self.heap[largest] = self.heap[largest], self.heap[i]
        self._sift_down(largest)
```

## O(n) 힙 구성 — Heapify

무작위 배열을 힙으로 만들 때, 하나씩 삽입하면 O(n log n)이지만 **Heapify는 O(n)**입니다.

```python
def heapify(self, arr):    # O(n)
    self.heap = arr[:]
    # 마지막 내부 노드부터 루트까지 Sift-Down
    for i in range((len(self.heap) - 2) // 2, -1, -1):
        self._sift_down(i)

# 예시
h = MaxHeap()
h.heapify([3, 1, 4, 1, 5, 9, 2, 6])
print(h.heap)  # [9, 6, 4, 1, 5, 3, 2, 1]
```

증명 핵심: 리프 노드가 n/2개이고 비용이 0이라서 전체 합이 O(n)으로 수렴합니다.

## 힙 정렬 (Heap Sort)

```python
def heap_sort(arr):    # O(n log n), in-place, 불안정
    n = len(arr)
    # 1. 최대 힙 구성 O(n)
    for i in range((n - 2) // 2, -1, -1):
        _sift_down(arr, i, n)
    # 2. 최대값을 끝으로 보내며 n번 반복 O(n log n)
    for end in range(n - 1, 0, -1):
        arr[0], arr[end] = arr[end], arr[0]
        _sift_down(arr, 0, end)

def _sift_down(arr, i, n):
    largest = i
    l, r = 2 * i + 1, 2 * i + 2
    if l < n and arr[l] > arr[largest]: largest = l
    if r < n and arr[r] > arr[largest]: largest = r
    if largest != i:
        arr[i], arr[largest] = arr[largest], arr[i]
        _sift_down(arr, largest, n)
```

## Python heapq 활용

```python
import heapq

# 최소 힙 (기본)
h = [5, 3, 8, 1]
heapq.heapify(h)         # O(n)
heapq.heappush(h, 2)     # O(log n)
print(heapq.heappop(h))  # 1  O(log n)

# 최대 힙: 값에 음수
max_heap = [-x for x in [5, 3, 8, 1]]
heapq.heapify(max_heap)
print(-heapq.heappop(max_heap))  # 8

# Top-K: O(n log k)
nums = [3, 1, 4, 1, 5, 9, 2, 6]
print(heapq.nlargest(3, nums))   # [9, 6, 5]
```

## 성능 요약

| 연산 | 시간 |
|---|---|
| peek (최솟값/최댓값 조회) | O(1) |
| push | O(log n) |
| pop | O(log n) |
| heapify | O(n) |
| 힙 정렬 | O(n log n) |

---

**지난 글:** [B+ 트리 (B+ Tree)](/posts/dsa-b-plus-tree/)

**다음 글:** [우선순위 큐 (Priority Queue)](/posts/dsa-priority-queue/)

<br>
읽어주셔서 감사합니다. 😊
