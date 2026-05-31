---
title: "이중 연결 리스트"
description: "prev·next 포인터로 양방향 탐색이 가능한 이중 연결 리스트의 구조와 구현, Python deque의 내부 동작을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["이중연결리스트", "자료구조", "deque", "양방향탐색"]
featured: false
draft: false
---

[지난 글](/posts/dsa-singly-linked-list/)에서 단일 연결 리스트를 구현했습니다. 단일 연결 리스트의 가장 큰 약점은 **뒤 방향으로 이동할 수 없다**는 점입니다. **이중 연결 리스트(Doubly Linked List)**는 각 노드에 `prev`와 `next` 두 개의 포인터를 두어 이 문제를 해결합니다.

## 이중 연결 리스트의 구조

![이중 연결 리스트 구조](/assets/posts/dsa-doubly-linked-list-structure.svg)

```python
class DNode:
    def __init__(self, data):
        self.data = data
        self.prev = None   # 이전 노드 포인터
        self.next = None   # 다음 노드 포인터

class DoublyLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self._size = 0
```

포인터가 2개이므로 단일 대비 **노드당 메모리가 더 필요**하지만, 양방향 탐색과 O(1) 뒤 삭제가 가능해집니다.

## 핵심 연산 구현

### 앞/뒤 삽입 — 모두 O(1)

```python
def prepend(self, data):
    node = DNode(data)
    if self.head is None:
        self.head = self.tail = node
    else:
        node.next = self.head
        self.head.prev = node
        self.head = node
    self._size += 1

def append(self, data):
    node = DNode(data)
    if self.tail is None:
        self.head = self.tail = node
    else:
        node.prev = self.tail
        self.tail.next = node
        self.tail = node
    self._size += 1
```

### 앞/뒤 삭제 — 모두 O(1)

```python
def delete_head(self):
    if self.head is None:
        raise IndexError("빈 리스트")
    data = self.head.data
    self.head = self.head.next
    if self.head:
        self.head.prev = None
    else:
        self.tail = None
    self._size -= 1
    return data

def delete_tail(self):           # 단일 리스트와 달리 O(1)!
    if self.tail is None:
        raise IndexError("빈 리스트")
    data = self.tail.data
    self.tail = self.tail.prev   # prev 포인터 덕분에 O(1)
    if self.tail:
        self.tail.next = None
    else:
        self.head = None
    self._size -= 1
    return data
```

### 임의 노드 삭제 — O(1) (포인터가 있을 때)

![이중 연결 리스트 중간 삭제 O(1)](/assets/posts/dsa-doubly-linked-list-delete.svg)

```python
def delete_node(self, node):
    if node.prev:
        node.prev.next = node.next
    else:
        self.head = node.next    # node가 head

    if node.next:
        node.next.prev = node.prev
    else:
        self.tail = node.prev    # node가 tail

    self._size -= 1
```

단일 연결 리스트에서는 node를 삭제하려면 이전 노드를 찾기 위해 O(n) 순회가 필요했습니다. 이중에서는 `node.prev`로 바로 접근 — O(1).

## 전체 구현

```python
class DoublyLinkedList:
    def __init__(self):
        self.head = self.tail = None
        self._size = 0

    def __len__(self): return self._size

    def __iter__(self):
        curr = self.head
        while curr:
            yield curr.data
            curr = curr.next

    def __reversed__(self):        # 역방향 순회도 O(n)
        curr = self.tail
        while curr:
            yield curr.data
            curr = curr.prev

    def insert_before(self, node, data):   # O(1)
        new = DNode(data)
        new.next = node
        new.prev = node.prev
        if node.prev:
            node.prev.next = new
        else:
            self.head = new
        node.prev = new
        self._size += 1

    def insert_after(self, node, data):    # O(1)
        new = DNode(data)
        new.prev = node
        new.next = node.next
        if node.next:
            node.next.prev = new
        else:
            self.tail = new
        node.next = new
        self._size += 1
```

## 복잡도 비교

| 연산 | 단일 연결 | 이중 연결 |
|---|---|---|
| 앞 삽입/삭제 | O(1) | O(1) |
| 뒤 삽입 | O(1) | O(1) |
| 뒤 삭제 | **O(n)** | **O(1)** |
| 임의 노드 삭제 (포인터 있을 때) | O(n) | **O(1)** |
| 역방향 순회 | O(n) 역전 필요 | **O(n)** 직접 |
| 메모리 | n × (data+1 ptr) | n × (data+2 ptr) |

## Python deque는 이중 연결 리스트

`collections.deque`가 이중 연결 리스트로 구현된 이유가 바로 이것입니다.

```python
from collections import deque

dq = deque()
dq.appendleft(1)    # 앞 삽입 O(1)
dq.append(2)        # 뒤 삽입 O(1)
dq.popleft()        # 앞 삭제 O(1)
dq.pop()            # 뒤 삭제 O(1)

# LRU 캐시의 핵심 자료구조도 이중 연결 리스트
# — 최근 사용 노드를 O(1)에 head로 이동
from functools import lru_cache

@lru_cache(maxsize=128)
def fib(n):
    return n if n <= 1 else fib(n-1) + fib(n-2)
```

## LRU 캐시 구현 예시

이중 연결 리스트의 대표적인 실전 응용입니다.

```python
class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.cache = {}       # key → node
        self.dll = DoublyLinkedList()

    def get(self, key):
        if key not in self.cache:
            return -1
        node = self.cache[key]
        # 최근 사용 → head로 이동 (O(1))
        self.dll.delete_node(node)
        self.dll.prepend(node.data)
        self.cache[key] = self.dll.head
        return node.data[1]

    def put(self, key, val):
        if key in self.cache:
            self.dll.delete_node(self.cache[key])
        self.dll.prepend((key, val))
        self.cache[key] = self.dll.head
        if len(self.dll) > self.cap:
            # 가장 오래된 것(tail) 제거 — O(1)
            evicted = self.dll.delete_tail()
            del self.cache[evicted[0]]
```

## 정리

- 이중 연결 리스트 = 단일 리스트 + prev 포인터
- 뒤 삭제와 임의 노드 삭제가 O(1) — 단일의 가장 큰 단점 해결
- 메모리 비용 증가 (포인터 1개 추가)
- Python deque, LRU 캐시, 텍스트 편집기 undo/redo에서 활용

---

**지난 글:** [단일 연결 리스트](/posts/dsa-singly-linked-list/)

<br>
읽어주셔서 감사합니다. 😊
