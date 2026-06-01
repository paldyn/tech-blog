---
title: "LRU 캐시 (Least Recently Used Cache)"
description: "가장 최근에 사용되지 않은 항목을 교체하는 LRU 캐시 — HashMap과 이중 연결 리스트로 모든 연산을 O(1)로 구현하는 방법을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["LRU 캐시", "LRU cache", "캐시 교체 정책", "HashMap", "이중 연결 리스트"]
featured: false
draft: false
---

[지난 글](/posts/dsa-set/)에서 집합 자료구조를 살펴봤습니다. 이번 글은 시스템 설계 면접의 단골 주제이자 운영체제·CPU 캐시·웹 프레임워크에서 광범위하게 사용되는 **LRU(Least Recently Used) 캐시**를 다룹니다. 제한된 메모리에서 어떤 데이터를 유지하고 어떤 데이터를 버릴지 결정하는 알고리즘입니다.

## LRU 캐시 교체 정책

LRU는 **가장 오랫동안 사용되지 않은 항목을 제거**합니다. 직관적으로 "최근에 사용된 것은 곧 다시 사용될 가능성이 높다"는 가정에 기반합니다. CPU L1/L2 캐시, Linux 페이지 캐시, Redis(근사 LRU), Guava Cache 등에서 이 정책을 사용합니다.

## 요구사항

- `get(key)` → O(1), 없으면 -1 반환
- `put(key, value)` → O(1), 용량 초과 시 LRU 항목 자동 제거

## 핵심 자료구조: HashMap + 이중 연결 리스트

![LRU 캐시 구조](/assets/posts/dsa-lru-cache-structure.svg)

**이중 연결 리스트**는 MRU(Most Recently Used) → LRU 순서로 노드를 연결합니다. HEAD 직후가 MRU, TAIL 직전이 LRU입니다.

**HashMap**은 key → 노드 포인터를 저장해 O(1)로 노드에 직접 접근합니다.

두 자료구조의 결합으로:
- `get`: 맵에서 노드 찾기 O(1) + 리스트에서 HEAD 직후로 이동 O(1)
- `put`: 노드 생성 O(1) + HEAD 직후 삽입 O(1) + 필요 시 TAIL 직전 제거 O(1)

## 동작 시퀀스

![LRU 동작 시퀀스](/assets/posts/dsa-lru-cache-sequence.svg)

## Python 구현 — OrderedDict 활용

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)   # MRU로 승격
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)   # LRU 제거

# 테스트 (LeetCode #146)
cache = LRUCache(3)
cache.put(1, 10)
cache.put(2, 20)
cache.put(3, 30)
print(cache.get(1))    # 10 — 1이 MRU로 승격
cache.put(4, 40)       # 용량 초과 → 2 제거 (가장 오래된)
print(cache.get(2))    # -1 (제거됨)
```

## Python 구현 — 직접 이중 연결 리스트

```python
class Node:
    __slots__ = ('key', 'val', 'prev', 'next')
    def __init__(self, key=0, val=0):
        self.key = key
        self.val = val
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.map = {}
        self.head = Node()   # sentinel
        self.tail = Node()   # sentinel
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node: Node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _insert_after_head(self, node: Node):
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.map:
            return -1
        node = self.map[key]
        self._remove(node)
        self._insert_after_head(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if key in self.map:
            self._remove(self.map[key])
        node = Node(key, value)
        self.map[key] = node
        self._insert_after_head(node)
        if len(self.map) > self.cap:
            lru = self.tail.prev
            self._remove(lru)
            del self.map[lru.key]
```

## 다른 캐시 교체 정책

| 정책 | 제거 기준 | 특징 |
|---|---|---|
| **LRU** | 가장 오래된 사용 | 구현 단순, 일반적으로 효과적 |
| **LFU** | 가장 적게 사용 | 빈도 추적 필요, 콜드 스타트 문제 |
| **FIFO** | 가장 먼저 삽입 | 단순, 성능은 보통 |
| **ARC** | LRU+LFU 혼합 | ZFS 파일시스템 사용 |
| **2Q** | 2단계 큐 | DB 버퍼 풀에서 활용 |

---

**지난 글:** [집합 자료구조 (Set)](/posts/dsa-set/)

**다음 글:** [트리 기초 (Tree Basics)](/posts/dsa-tree-basics/)

<br>
읽어주셔서 감사합니다. 😊
