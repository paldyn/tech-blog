---
title: "이진 트리 (Binary Tree)"
description: "자식이 최대 2개인 이진 트리의 완전·포화·완벽·편향 유형, 배열 표현, 그리고 이진 트리의 주요 성질과 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["이진 트리", "binary tree", "완전 이진 트리", "포화 이진 트리", "트리"]
featured: false
draft: false
---

[지난 글](/posts/dsa-tree-basics/)에서 트리의 기본 용어와 성질을 살펴봤습니다. 이번 글은 트리 계열 자료구조의 핵심인 **이진 트리(Binary Tree)**를 깊이 다룹니다. 이진 트리는 힙, BST, AVL, Red-Black Tree, 세그먼트 트리 등 대부분의 고급 트리 자료구조의 기반입니다.

## 이진 트리란

각 노드가 **최대 2개의 자식**을 갖는 트리입니다. 자식을 각각 **왼쪽 자식(left child)**과 **오른쪽 자식(right child)**으로 구분합니다. 이 구분이 단순 트리와 가장 큰 차이입니다. `left(A) = B`이고 `left(A) = C`인 트리는 B ≠ C여도 서로 다른 이진 트리로 취급합니다.

## 이진 트리 종류

![이진 트리 종류](/assets/posts/dsa-binary-tree-types.svg)

**완전 이진 트리(Complete)**: 마지막 레벨을 제외한 모든 레벨이 꽉 차 있고, 마지막 레벨의 노드는 왼쪽부터 채워져 있습니다. 힙(Heap)이 이 구조를 사용합니다.

**포화 이진 트리(Full)**: 모든 내부 노드가 정확히 2개의 자식을 갖습니다. 리프 노드는 0개, 내부 노드는 2개의 자식입니다. Huffman 코딩 트리가 이 구조입니다.

**완벽 이진 트리(Perfect)**: 완전이면서 모든 리프가 같은 깊이에 있습니다. n = 2^(h+1) - 1개의 노드를 가집니다.

**편향 이진 트리(Skewed)**: 모든 노드가 왼쪽 또는 오른쪽 자식만 갖습니다. 연결 리스트와 동일하며 높이 O(n), 검색 O(n)의 최악 케이스입니다.

## Python 구현

```python
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

@dataclass
class BinaryTree:
    val: int
    left: Optional['BinaryTree'] = None
    right: Optional['BinaryTree'] = None

def height(root: Optional[BinaryTree]) -> int:
    if root is None:
        return -1   # 빈 트리의 높이 = -1 (또는 0 정의에 따라 다름)
    return 1 + max(height(root.left), height(root.right))

def count_nodes(root: Optional[BinaryTree]) -> int:
    if root is None:
        return 0
    return 1 + count_nodes(root.left) + count_nodes(root.right)

def is_complete(root: Optional[BinaryTree]) -> bool:
    if root is None:
        return True
    from collections import deque
    q = deque([root])
    found_null = False
    while q:
        node = q.popleft()
        if node is None:
            found_null = True
        else:
            if found_null:
                return False   # null 이후에 노드가 있으면 불완전
            q.append(node.left)
            q.append(node.right)
    return True
```

## 배열로 표현하기

![이진 트리 배열 표현](/assets/posts/dsa-binary-tree-array.svg)

완전 이진 트리는 배열로 효율적으로 표현할 수 있습니다. 인덱스 i의 노드에서:
- 왼쪽 자식: `2i + 1`
- 오른쪽 자식: `2i + 2`
- 부모: `(i - 1) // 2`

```python
class ArrayBinaryTree:
    def __init__(self):
        self.data = []

    def left(self, i):
        return 2 * i + 1

    def right(self, i):
        return 2 * i + 2

    def parent(self, i):
        return (i - 1) // 2

    def insert(self, val):
        self.data.append(val)

    def __len__(self):
        return len(self.data)
```

포인터 없이 배열 인덱스로만 트리를 탐색할 수 있어 캐시 효율이 뛰어납니다. 힙(Heap)과 세그먼트 트리가 이 방식을 사용합니다.

## 이진 트리의 주요 성질

높이 h인 이진 트리에서:
- 최대 노드 수: 2^(h+1) - 1 (완벽 이진 트리)
- 최소 노드 수: h + 1 (편향 트리)
- 리프 수 ≤ 2^h

n개 노드의 이진 트리 높이:
- 최소: ⌊log₂ n⌋ (완전 이진 트리에 가까울수록)
- 최대: n - 1 (편향 트리)

이 높이 차이가 BST, AVL, Red-Black Tree 등 균형 트리가 중요한 이유입니다. 검색은 높이에 비례하므로 O(log n)을 보장하려면 높이를 O(log n)으로 유지해야 합니다.

---

**지난 글:** [트리 기초 (Tree Basics)](/posts/dsa-tree-basics/)

**다음 글:** [트리 순회 (Tree Traversal)](/posts/dsa-tree-traversal/)

<br>
읽어주셔서 감사합니다. 😊
