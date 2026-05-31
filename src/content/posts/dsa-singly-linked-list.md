---
title: "단일 연결 리스트"
description: "노드와 포인터로 구성된 단일 연결 리스트의 구조, 삽입·삭제·역전 알고리즘을 Python으로 직접 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["연결리스트", "단일연결리스트", "자료구조", "포인터"]
featured: false
draft: false
---

[지난 글](/posts/dsa-dynamic-array/)에서 동적 배열을 구현해봤습니다. 배열은 인덱스 접근이 빠르지만 중간 삽입·삭제가 느립니다. **단일 연결 리스트(Singly Linked List)**는 이 약점을 보완하는 대표적인 자료구조입니다.

## 연결 리스트란

연결 리스트는 **노드(Node)**들이 포인터로 연결된 자료구조입니다. 각 노드는 데이터와 다음 노드를 가리키는 포인터를 가집니다. 배열과 달리 메모리가 연속적이지 않아도 됩니다.

![단일 연결 리스트 구조](/assets/posts/dsa-singly-linked-list-structure.svg)

```python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None   # 다음 노드 포인터

class SinglyLinkedList:
    def __init__(self):
        self.head = None   # 첫 번째 노드
        self.tail = None   # 마지막 노드 (선택적)
        self._size = 0
```

## 기본 연산 구현

![단일 연결 리스트 주요 연산](/assets/posts/dsa-singly-linked-list-ops.svg)

### 앞에 삽입 (prepend) — O(1)

```python
def prepend(self, data):
    new_node = Node(data)
    new_node.next = self.head   # 새 노드 → 기존 head
    self.head = new_node         # head 갱신
    if self.tail is None:
        self.tail = new_node
    self._size += 1
```

### 뒤에 삽입 (append) — O(1) with tail pointer

```python
def append(self, data):
    new_node = Node(data)
    if self.tail is None:
        self.head = self.tail = new_node
    else:
        self.tail.next = new_node  # 기존 tail → 새 노드
        self.tail = new_node        # tail 갱신
    self._size += 1
```

tail 포인터를 유지하지 않으면 뒤 삽입이 O(n)이 됩니다. 반드시 tail을 관리하세요.

### 앞 삭제 (delete head) — O(1)

```python
def delete_head(self):
    if self.head is None:
        raise IndexError("빈 리스트")
    data = self.head.data
    self.head = self.head.next    # head를 한 칸 앞으로
    if self.head is None:
        self.tail = None
    self._size -= 1
    return data
```

### 뒤 삭제 — O(n): 단일 연결 리스트의 약점

```python
def delete_tail(self):
    if self.head is None:
        raise IndexError("빈 리스트")
    if self.head is self.tail:
        data = self.head.data
        self.head = self.tail = None
        self._size -= 1
        return data
    # tail 이전 노드를 찾기 위해 전체 순회 필요 — O(n)
    curr = self.head
    while curr.next is not self.tail:
        curr = curr.next
    data = self.tail.data
    curr.next = None
    self.tail = curr
    self._size -= 1
    return data
```

이것이 단일 연결 리스트의 핵심 단점입니다. 이전(prev) 포인터가 없어서 tail 삭제가 O(n)입니다.

### 리스트 역전 — O(n)

```python
def reverse(self):
    prev, curr = None, self.head
    self.tail = self.head   # 현재 head가 역전 후 tail
    while curr:
        curr.next, prev, curr = prev, curr, curr.next
    self.head = prev
```

포인터만 변경하므로 데이터 복사 없이 O(n)에 역전됩니다.

## 전체 구현

```python
class SinglyLinkedList:
    def __init__(self):
        self.head = self.tail = None
        self._size = 0

    def __len__(self):
        return self._size

    def __iter__(self):
        curr = self.head
        while curr:
            yield curr.data
            curr = curr.next

    def search(self, target):       # O(n)
        curr = self.head
        idx = 0
        while curr:
            if curr.data == target:
                return idx
            curr = curr.next
            idx += 1
        return -1

    def delete_value(self, val):    # O(n)
        if self.head is None:
            return False
        if self.head.data == val:
            self.delete_head()
            return True
        curr = self.head
        while curr.next:
            if curr.next.data == val:
                if curr.next is self.tail:
                    self.tail = curr
                curr.next = curr.next.next
                self._size -= 1
                return True
            curr = curr.next
        return False
```

## 복잡도 요약

| 연산 | 복잡도 |
|---|---|
| 앞 삽입/삭제 | **O(1)** |
| 뒤 삽입 (tail 유지) | **O(1)** |
| 뒤 삭제 | O(n) |
| 중간 삽입 (위치 알 때) | **O(1)** (포인터 연결만) |
| 탐색 | O(n) |
| 인덱스 접근 | O(n) |

## 연결 리스트가 배열보다 유리한 경우

1. **앞쪽에 빈번한 삽입/삭제**: 배열은 O(n) 이동이 필요하지만 연결 리스트는 O(1)
2. **크기를 모를 때**: 배열처럼 확장 복사 없이 노드를 그냥 추가
3. **중간 위치에서 이미 노드 포인터를 가질 때**: 연결만 바꾸면 O(1) 삽입

반면 배열이 유리한 경우: 인덱스 접근(O(1)), 캐시 효율이 중요한 순차 처리.

## 실전 응용

```python
# 연결 리스트로 스택 구현 (배열 대비 앞 push가 O(1))
class Stack:
    def __init__(self):
        self.list = SinglyLinkedList()

    def push(self, val):
        self.list.prepend(val)   # O(1)

    def pop(self):
        return self.list.delete_head()  # O(1)

    def peek(self):
        return self.list.head.data

# Python의 deque는 이중 연결 리스트로 구현
from collections import deque
dq = deque()
dq.appendleft(1)   # O(1)
dq.popleft()       # O(1)
```

## 정리

- 단일 연결 리스트 = 노드(data + next 포인터)의 체인
- head 포인터로 시작, tail 포인터 유지 시 뒤 삽입 O(1)
- 앞 삽입/삭제 O(1) vs 뒤 삭제/탐색 O(n)
- 역전은 포인터만 변경 — O(n), 공간 O(1)

---

**지난 글:** [동적 배열](/posts/dsa-dynamic-array/)

**다음 글:** [이중 연결 리스트](/posts/dsa-doubly-linked-list/)

<br>
읽어주셔서 감사합니다. 😊
