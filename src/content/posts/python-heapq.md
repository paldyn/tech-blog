---
title: "heapq: 파이썬 힙과 우선순위 큐"
description: "Python heapq 모듈로 최소 힙을 구현하고, 우선순위 큐, nlargest/nsmallest, 최대 힙 패턴까지 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["python", "heapq", "힙", "우선순위 큐", "자료구조", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/python-collections-namedtuple/)에서 이름 있는 불변 튜플인 namedtuple을 다뤘습니다. 이번에는 `heapq` 모듈을 살펴봅니다. 힙(Heap)은 **부모 노드가 항상 자식 노드보다 작거나 같은 완전 이진 트리** 구조로, 최솟값을 O(log n)에 삽입하고 O(log n)에 꺼낼 수 있습니다. Python의 `heapq`는 **최소 힙(min-heap)**을 일반 리스트 위에 구현합니다.

## 기본 연산

```python
import heapq

heap = []
heapq.heappush(heap, 5)
heapq.heappush(heap, 1)
heapq.heappush(heap, 3)

print(heap)        # [1, 5, 3]  ← 힙 정렬된 리스트
print(heap[0])     # 1  ← 최솟값 (팝하지 않음)

smallest = heapq.heappop(heap)  # 1 반환
print(heap)        # [3, 5]
```

`heap[0]`은 항상 최솟값을 가리킵니다. 꺼내지 않고 확인만 할 때는 `heappop()` 대신 `heap[0]`을 사용하세요.

![heapq 최소 힙 구조](/assets/posts/python-heapq-structure.svg)

## heapify — 기존 리스트를 힙으로

```python
data = [3, 1, 4, 1, 5, 9, 2, 6]
heapq.heapify(data)  # O(n) — 제자리 변환
print(data)  # [1, 1, 2, 6, 5, 9, 4, 3]  ← 힙 조건 만족
```

n개 요소를 heappush로 하나씩 넣으면 O(n log n)이지만, `heapify()`는 O(n)입니다.

## nlargest와 nsmallest

상위/하위 k개를 추출할 때 `sorted()[-k:]`보다 효율적입니다.

```python
nums = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]

print(heapq.nlargest(3, nums))   # [9, 6, 5]
print(heapq.nsmallest(3, nums))  # [1, 1, 2]

# key 인수도 지원
students = [("Alice", 90), ("Bob", 75), ("Carol", 85)]
print(heapq.nlargest(2, students, key=lambda s: s[1]))
# [('Alice', 90), ('Carol', 85)]
```

k가 n에 가까우면 `sorted()`가 더 빠르고, k가 작을수록 `nlargest/nsmallest`가 유리합니다.

## 우선순위 큐

힙으로 우선순위 큐를 만들려면 `(priority, data)` 튜플을 사용합니다.

```python
import heapq

pq = []
heapq.heappush(pq, (3, "low priority task"))
heapq.heappush(pq, (1, "urgent task"))
heapq.heappush(pq, (2, "normal task"))

while pq:
    priority, task = heapq.heappop(pq)
    print(f"[P{priority}] {task}")

# [P1] urgent task
# [P2] normal task
# [P3] low priority task
```

![heapq 실전 코드 패턴](/assets/posts/python-heapq-code.svg)

## 최대 힙 — 부호 반전 트릭

Python의 `heapq`는 최소 힙만 지원합니다. 최대 힙이 필요하면 값의 부호를 반전해 사용합니다.

```python
nums = [3, 1, 4, 1, 5, 9, 2]

# 부호 반전해서 최대 힙 흉내내기
max_heap = [-n for n in nums]
heapq.heapify(max_heap)

largest = -heapq.heappop(max_heap)
print(largest)  # 9
```

## heapreplace와 heappushpop

```python
heap = [1, 3, 5]

# heapreplace: 최솟값 꺼낸 뒤 새 값 삽입 (heappop + heappush보다 빠름)
old = heapq.heapreplace(heap, 2)
print(old, heap)  # 1, [2, 3, 5]

# heappushpop: 새 값 삽입 후 최솟값 꺼내기 (최적화 버전)
result = heapq.heappushpop(heap, 0)
print(result, heap)  # 0, [2, 3, 5]
```

고정 크기 힙에서 교체 연산이 반복될 때 이 함수들이 유용합니다.

---

**지난 글:** [collections.namedtuple: 이름 있는 튜플](/posts/python-collections-namedtuple/)

**다음 글:** [bisect: 이진 탐색으로 정렬 유지](/posts/python-bisect/)

<br>
읽어주셔서 감사합니다. 😊
