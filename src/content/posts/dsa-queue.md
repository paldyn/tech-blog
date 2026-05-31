---
title: "큐 (Queue)"
description: "FIFO 원칙으로 동작하는 큐의 개념, 배열·연결 리스트 구현, 선형 배열 큐의 함정과 BFS 응용까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["큐", "queue", "FIFO", "자료구조", "BFS"]
featured: false
draft: false
---

[지난 글](/posts/dsa-stack/)에서 LIFO 원칙의 스택을 다뤘습니다. 이번에는 반대 원칙인 **FIFO(First In, First Out)**로 동작하는 **큐(Queue)**를 살펴봅니다. 큐는 줄 서기와 같은 원리로, BFS 탐색이나 운영체제의 프로세스 스케줄링처럼 순서를 보장해야 할 때 핵심적으로 사용됩니다.

## 큐란

큐는 먼저 들어온 원소가 먼저 나가는 선형 자료구조입니다. 삽입은 **rear(뒤)**에서, 제거는 **front(앞)**에서 이루어집니다.

| 연산 | 설명 | 복잡도 |
|------|------|--------|
| `enqueue(x)` | rear에 x 삽입 | O(1) |
| `dequeue()` | front 원소 제거 후 반환 | O(1) |
| `peek()` | front 원소 조회 (제거 없음) | O(1) |
| `is_empty()` | 비어있는지 확인 | O(1) |

![큐 구조와 연산](/assets/posts/dsa-queue-structure.svg)

## 선형 배열 큐의 함정

단순 배열로 큐를 구현하면 `dequeue()` 시 나머지 원소들을 앞으로 당겨야 하므로 **O(n)** 이 됩니다.

```python
# 나쁜 방법 — O(n) dequeue
class BadQueue:
    def __init__(self):
        self._data = []

    def enqueue(self, x):
        self._data.append(x)    # O(1)

    def dequeue(self):
        return self._data.pop(0)  # O(n) — 비효율!
```

해결책은 `front` 인덱스를 증가시켜 "논리적으로" 제거하거나, 원형 큐(Circular Queue), 또는 `collections.deque`를 활용하는 것입니다.

## 올바른 구현 — collections.deque 활용

Python에서 권장되는 방식입니다. `deque`는 양끝 O(1) 연산을 지원하는 이중 연결 리스트 기반 자료구조입니다.

```python
from collections import deque

class Queue:
    def __init__(self):
        self._q = deque()

    def enqueue(self, x):
        self._q.append(x)         # rear에 삽입

    def dequeue(self):
        if not self._q:
            raise IndexError("큐가 비어 있습니다")
        return self._q.popleft()  # front에서 제거 — O(1)

    def peek(self):
        if not self._q:
            raise IndexError("큐가 비어 있습니다")
        return self._q[0]

    def is_empty(self):
        return len(self._q) == 0

    def size(self):
        return len(self._q)
```

## 연결 리스트로 구현하기

직접 구현할 경우 tail 포인터를 유지하면 enqueue가 O(1)이 됩니다.

```python
class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

class LinkedQueue:
    def __init__(self):
        self._head = None   # front
        self._tail = None   # rear

    def enqueue(self, val):
        node = Node(val)
        if self._tail:
            self._tail.next = node
        self._tail = node
        if not self._head:
            self._head = node

    def dequeue(self):
        if not self._head:
            raise IndexError("큐가 비어 있습니다")
        val = self._head.val
        self._head = self._head.next
        if not self._head:
            self._tail = None     # 마지막 원소 제거 시 tail도 None
        return val
```

## 응용 — BFS (너비 우선 탐색)

큐의 가장 중요한 응용은 BFS입니다. 시작 노드에서 가장 가까운(거리 순) 노드부터 탐색합니다.

![BFS 탐색과 큐](/assets/posts/dsa-queue-bfs.svg)

```python
from collections import deque

def bfs(graph, start):
    visited = set()
    queue = deque([start])
    visited.add(start)
    result = []

    while queue:
        node = queue.popleft()    # FIFO: front에서 꺼냄
        result.append(node)

        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)  # rear에 넣음

    return result

graph = {1: [2, 3], 2: [4, 5], 3: [6], 4: [], 5: [], 6: []}
print(bfs(graph, 1))  # [1, 2, 3, 4, 5, 6]
```

BFS를 DFS와 비교하면:

| 특성 | BFS (큐) | DFS (스택) |
|------|---------|-----------|
| 탐색 순서 | 거리 순(레벨별) | 깊이 우선 |
| 최단 경로 | 보장 (가중치 없는 그래프) | 미보장 |
| 메모리 | 큐 최대 크기 = 너비 | 스택 깊이 = 트리 깊이 |

## 운영체제에서의 큐

- **프로세스 스케줄링**: 준비 큐(Ready Queue)에 대기 중인 프로세스를 순서대로 CPU에 할당
- **I/O 요청 큐**: 디스크 읽기/쓰기 요청을 FIFO로 처리
- **네트워크 패킷 버퍼**: 패킷 도착 순서대로 처리

## 정리

- 큐는 FIFO 구조로 enqueue/dequeue/peek이 모두 **O(1)** 입니다.
- Python에서는 `list.pop(0)` 대신 `collections.deque`를 사용하세요.
- BFS의 핵심 도구이며, 프로세스 스케줄링·이벤트 처리 등에 폭넓게 활용됩니다.

---

**지난 글:** [스택](/posts/dsa-stack/)

**다음 글:** [원형 큐](/posts/dsa-circular-queue/)

<br>
읽어주셔서 감사합니다. 😊
