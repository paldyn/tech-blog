---
title: "이진 탐색 트리 (Binary Search Tree)"
description: "이진 탐색을 트리에 적용한 BST의 불변 조건, 검색·삽입·삭제 연산, 그리고 편향 문제와 균형 트리의 필요성을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["이진 탐색 트리", "BST", "binary search tree", "삽입 삭제", "균형 트리"]
featured: false
draft: false
---

[지난 글](/posts/dsa-tree-traversal/)에서 트리 순회 방식을 정리했습니다. 이번 글은 순회, 검색, 삽입, 삭제를 모두 효율적으로 처리할 수 있는 **이진 탐색 트리(Binary Search Tree, BST)**를 다룹니다. 정렬과 검색을 동시에 지원하는 BST는 언어 표준 라이브러리의 `TreeMap`, `TreeSet` 등의 이론적 기반입니다.

## BST 불변 조건

![BST 구조와 탐색](/assets/posts/dsa-binary-search-tree-structure.svg)

BST는 이진 트리에 하나의 조건을 추가합니다.

> **모든 노드 x에 대해**: 왼쪽 서브트리의 모든 값 < x.val < 오른쪽 서브트리의 모든 값

이 조건 덕분에 **이진 탐색(Binary Search)**과 동일한 논리로 트리를 탐색할 수 있습니다. 중위 순회하면 항상 오름차순 출력이 나오는 것도 이 조건의 결과입니다.

## 검색

```python
from __future__ import annotations
from typing import Optional

class BST:
    def __init__(self, val: int):
        self.val = val
        self.left: Optional[BST] = None
        self.right: Optional[BST] = None

def search(root: Optional[BST], target: int) -> Optional[BST]:
    if root is None or root.val == target:
        return root
    if target < root.val:
        return search(root.left, target)
    return search(root.right, target)

# 반복 버전 (스택 오버플로 방지)
def search_iter(root: Optional[BST], target: int) -> Optional[BST]:
    while root:
        if target == root.val:
            return root
        root = root.left if target < root.val else root.right
    return None
```

## 삽입

항상 리프 위치에 새 노드를 추가합니다.

```python
def insert(root: Optional[BST], val: int) -> BST:
    if root is None:
        return BST(val)
    if val < root.val:
        root.left = insert(root.left, val)
    elif val > root.val:
        root.right = insert(root.right, val)
    # val == root.val: 중복 무시 (또는 count 증가)
    return root
```

## 삭제

![BST 삽입·삭제](/assets/posts/dsa-binary-search-tree-ops.svg)

삭제는 세 가지 케이스로 처리합니다.

```python
def find_min(node: BST) -> BST:
    while node.left:
        node = node.left
    return node

def delete(root: Optional[BST], val: int) -> Optional[BST]:
    if root is None:
        return None
    if val < root.val:
        root.left = delete(root.left, val)
    elif val > root.val:
        root.right = delete(root.right, val)
    else:
        # 케이스 1: 리프 노드
        if not root.left and not root.right:
            return None
        # 케이스 2: 자식 1개
        if not root.left:
            return root.right
        if not root.right:
            return root.left
        # 케이스 3: 자식 2개 → 후계자로 대체
        successor = find_min(root.right)
        root.val = successor.val
        root.right = delete(root.right, successor.val)
    return root
```

## 최솟값·최댓값·범위 쿼리

```python
def minimum(root: BST) -> int:
    while root.left:
        root = root.left
    return root.val   # O(h)

def maximum(root: BST) -> int:
    while root.right:
        root = root.right
    return root.val   # O(h)

# k번째 작은 값 (중위 순회 활용)
def kth_smallest(root: Optional[BST], k: int) -> int:
    stack, n = [], 0
    while root or stack:
        while root:
            stack.append(root)
            root = root.left
        root = stack.pop()
        n += 1
        if n == k:
            return root.val
        root = root.right
    raise ValueError("k out of range")
```

## 편향 문제와 균형 트리

정렬된 순서(1, 2, 3, 4, 5...)로 삽입하면 BST는 오른쪽 편향 트리가 됩니다. 높이가 O(n)이 되어 모든 연산이 O(n)으로 退化합니다.

| 삽입 순서 | 트리 형태 | 높이 |
|---|---|---|
| 4, 2, 6, 1, 3, 5, 7 | 균형 | O(log n) |
| 1, 2, 3, 4, 5, 6, 7 | 편향 | O(n) |

이를 방지하기 위해 **AVL Tree**, **Red-Black Tree** 같은 자가 균형 BST가 등장했습니다. 삽입·삭제 후 자동으로 균형을 맞춰 항상 O(log n)을 보장합니다.

---

**지난 글:** [트리 순회 (Tree Traversal)](/posts/dsa-tree-traversal/)

<br>
읽어주셔서 감사합니다. 😊
