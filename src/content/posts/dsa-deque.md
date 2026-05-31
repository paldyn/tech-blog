---
title: "덱 (Deque)"
description: "양쪽 끝 삽입·삭제가 O(1)인 덱의 구조, Python collections.deque 활용, 슬라이딩 윈도우 최솟값까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["덱", "deque", "자료구조", "슬라이딩윈도우", "단조덱"]
featured: false
draft: false
---

[지난 글](/posts/dsa-circular-queue/)에서 원형 큐로 배열 공간 낭비를 해결하는 방법을 살펴봤습니다. 이번에는 큐와 스택을 모두 대체할 수 있는 강력한 자료구조인 **덱(Deque, Double-Ended Queue)**을 다룹니다. 덱은 양쪽 끝에서 O(1)로 삽입·삭제가 가능해서 슬라이딩 윈도우, 팰린드롬 검사, 0-1 BFS 등 다양한 알고리즘의 핵심 부품으로 활용됩니다.

## 덱이란

덱은 **앞(front)과 뒤(rear) 양쪽에서 삽입과 삭제가 모두 가능한** 자료구조입니다.

| 연산 | 동작 | 복잡도 |
|------|------|--------|
| `appendleft(x)` | 앞에 삽입 | O(1) |
| `popleft()` | 앞에서 제거 | O(1) |
| `append(x)` | 뒤에 삽입 | O(1) |
| `pop()` | 뒤에서 제거 | O(1) |

**주의**: 임의 인덱스 접근(`deque[i]`)은 O(n)입니다. 인덱스 접근이 잦다면 `list`를 사용하세요.

![덱 구조와 연산](/assets/posts/dsa-deque-structure.svg)

## Python collections.deque

Python의 `collections.deque`는 이중 연결 리스트 기반으로 양끝 O(1) 연산을 보장합니다.

```python
from collections import deque

d = deque()

# 큐처럼 사용
d.append(1)       # 뒤에 삽입 → [1]
d.append(2)       # [1, 2]
d.popleft()       # 앞에서 제거 → 1 반환, [2]

# 스택처럼 사용
d.append(3)       # [2, 3]
d.pop()           # 뒤에서 제거 → 3 반환, [2]

# 덱 고유 기능
d.appendleft(0)   # 앞에 삽입 → [0, 2]
d.popleft()       # 0 반환

# 최대 크기 제한 (오래된 항목 자동 제거)
d_fixed = deque(maxlen=3)
for i in range(5):
    d_fixed.append(i)
print(list(d_fixed))  # [2, 3, 4]
```

## 이중 연결 리스트 직접 구현

```python
class Node:
    def __init__(self, val):
        self.val = val
        self.prev = None
        self.next = None

class Deque:
    def __init__(self):
        # sentinel nodes
        self._head = Node(None)
        self._tail = Node(None)
        self._head.next = self._tail
        self._tail.prev = self._head
        self._size = 0

    def _insert_after(self, node, val):
        new = Node(val)
        new.next = node.next
        new.prev = node
        node.next.prev = new
        node.next = new
        self._size += 1

    def _remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev
        self._size -= 1
        return node.val

    def appendleft(self, val):
        self._insert_after(self._head, val)

    def append(self, val):
        self._insert_after(self._tail.prev, val)

    def popleft(self):
        if self._size == 0:
            raise IndexError("덱이 비어 있습니다")
        return self._remove(self._head.next)

    def pop(self):
        if self._size == 0:
            raise IndexError("덱이 비어 있습니다")
        return self._remove(self._tail.prev)
```

## 응용 — 슬라이딩 윈도우 최솟값

크기 k의 창(window)이 배열을 이동하면서 각 창의 최솟값을 구하는 문제입니다. 나이브하게 구현하면 O(nk)지만, **단조 덱(Monotonic Deque)**을 사용하면 O(n)에 해결됩니다.

![슬라이딩 윈도우 최솟값 — 단조 덱](/assets/posts/dsa-deque-sliding-window.svg)

아이디어: 덱에 인덱스를 저장하되, 덱의 앞에서 뒤로 갈수록 값이 단조 증가하도록 유지합니다.

```python
from collections import deque

def sliding_window_min(arr: list, k: int) -> list:
    """각 창의 최솟값 반환 — O(n)"""
    dq = deque()   # 인덱스 저장, 앞 = 현재 창 최솟값 인덱스
    result = []

    for i, val in enumerate(arr):
        # 창 밖으로 벗어난 인덱스 제거
        while dq and dq[0] < i - k + 1:
            dq.popleft()

        # 새 원소보다 크거나 같은 기존 원소 제거 (더 이상 최솟값 후보 아님)
        while dq and arr[dq[-1]] >= val:
            dq.pop()

        dq.append(i)

        if i >= k - 1:
            result.append(arr[dq[0]])  # 현재 창 최솟값

    return result

print(sliding_window_min([3, 1, 2, 4, 3], k=3))  # [1, 1, 2]
```

## 응용 — 팰린드롬 검사

```python
def is_palindrome(s: str) -> bool:
    d = deque(s)
    while len(d) > 1:
        if d.popleft() != d.pop():
            return False
    return True

print(is_palindrome("racecar"))  # True
print(is_palindrome("hello"))    # False
```

## 응용 — 덱으로 스택/큐 동시 구현

```python
# 큐로 사용
queue = deque()
queue.append('A')
queue.append('B')
print(queue.popleft())  # A (FIFO)

# 스택으로 사용
stack = deque()
stack.append('X')
stack.append('Y')
print(stack.pop())      # Y (LIFO)
```

## 정리

- 덱은 양끝 O(1) 연산을 제공하는 범용 선형 자료구조입니다.
- Python `collections.deque`는 `list.pop(0)` (O(n))의 올바른 대체제입니다.
- 단조 덱 기법으로 슬라이딩 윈도우 최솟값/최댓값을 O(n)에 해결할 수 있습니다.

---

**지난 글:** [원형 큐](/posts/dsa-circular-queue/)

**다음 글:** [단조 스택](/posts/dsa-monotonic-stack/)

<br>
읽어주셔서 감사합니다. 😊
