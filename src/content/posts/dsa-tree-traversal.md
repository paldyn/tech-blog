---
title: "트리 순회 (Tree Traversal)"
description: "전위·중위·후위 순회(DFS)와 레벨 순서 순회(BFS)의 원리, 재귀·반복 구현, 그리고 각 순회 방식의 활용 사례를 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["트리 순회", "tree traversal", "전위 순회", "중위 순회", "BFS"]
featured: false
draft: false
---

[지난 글](/posts/dsa-binary-tree/)에서 이진 트리의 구조와 종류를 살펴봤습니다. 이번 글은 트리를 어떤 순서로 방문할지를 결정하는 **트리 순회(Tree Traversal)**를 다룹니다. 순회 방식이 달라지면 같은 트리에서 전혀 다른 결과를 얻게 됩니다. 컴파일러의 표현식 평가, BST 정렬 출력, 파일 시스템 탐색 등이 모두 순회 알고리즘을 기반으로 합니다.

## DFS 순회 3종류

DFS(Depth-First Search) 순회는 스택(재귀 포함)을 사용합니다. **루트를 언제 방문하느냐**에 따라 세 가지로 나뉩니다.

![DFS 순회 비교](/assets/posts/dsa-tree-traversal-dfs.svg)

| 이름 | 순서 | 특징 |
|---|---|---|
| 전위(Pre-order) | 루트 → 왼 → 오른 | 트리 복사, 직렬화에 사용 |
| 중위(In-order) | 왼 → 루트 → 오른 | BST에서 정렬 순서 출력 |
| 후위(Post-order) | 왼 → 오른 → 루트 | 디렉토리 삭제, 표현식 평가 |

## 재귀 구현

```python
from typing import Optional

class Node:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def preorder(root: Optional[Node]) -> list:
    if root is None:
        return []
    return [root.val] + preorder(root.left) + preorder(root.right)

def inorder(root: Optional[Node]) -> list:
    if root is None:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)

def postorder(root: Optional[Node]) -> list:
    if root is None:
        return []
    return postorder(root.left) + postorder(root.right) + [root.val]

# 예: A(B(D, E), C(F))
root = Node('A', Node('B', Node('D'), Node('E')), Node('C', Node('F')))
print(preorder(root))   # ['A', 'B', 'D', 'E', 'C', 'F']
print(inorder(root))    # ['D', 'B', 'E', 'A', 'F', 'C']
print(postorder(root))  # ['D', 'E', 'B', 'F', 'C', 'A']
```

## 반복(Iterative) 구현 — 스택 사용

재귀는 깊이가 깊으면 스택 오버플로 위험이 있습니다. 반복 구현으로 이를 방지합니다.

```python
from collections import deque

def inorder_iterative(root: Optional[Node]) -> list:
    result, stack = [], []
    curr = root
    while curr or stack:
        while curr:
            stack.append(curr)
            curr = curr.left   # 왼쪽 끝까지
        curr = stack.pop()
        result.append(curr.val)
        curr = curr.right      # 오른쪽으로 이동
    return result

def preorder_iterative(root: Optional[Node]) -> list:
    if not root:
        return []
    result, stack = [], [root]
    while stack:
        node = stack.pop()
        result.append(node.val)
        if node.right:
            stack.append(node.right)   # 오른쪽 먼저 (나중에 처리)
        if node.left:
            stack.append(node.left)    # 왼쪽 나중에 (먼저 처리)
    return result
```

## 레벨 순서 순회 (BFS)

![BFS 순회](/assets/posts/dsa-tree-traversal-bfs.svg)

큐를 이용해 레벨(level)별로 왼쪽에서 오른쪽으로 방문합니다.

```python
from collections import deque

def level_order(root: Optional[Node]) -> list[list]:
    if not root:
        return []
    result = []
    q = deque([root])
    while q:
        level = []
        for _ in range(len(q)):     # 현재 레벨의 노드 수만큼
            node = q.popleft()
            level.append(node.val)
            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)
        result.append(level)
    return result

# [['A'], ['B', 'C'], ['D', 'E', 'F']]
```

## 순회 방식 선택 가이드

- **중위 순회**: BST에서 오름차순 출력, 정렬 검증
- **전위 순회**: 트리 복사, JSON/XML 직렬화
- **후위 순회**: 트리 삭제 (자식 먼저 제거), 표현식 트리 계산
- **레벨 순서**: 최단 경로 문제, 트리를 배열로 직렬화, 레벨별 처리

## Morris 순회 (O(1) 공간)

스택도 재귀도 없이 트리 포인터를 임시로 변경해 O(1) 공간으로 순회하는 알고리즘입니다. 스레드 이진 트리(Threaded Binary Tree)를 임시로 만들었다가 복원하는 방식입니다. 공간이 매우 제한된 환경에서 사용합니다.

```python
def morris_inorder(root: Optional[Node]) -> list:
    result = []
    curr = root
    while curr:
        if not curr.left:
            result.append(curr.val)
            curr = curr.right
        else:
            pre = curr.left
            while pre.right and pre.right is not curr:
                pre = pre.right
            if not pre.right:
                pre.right = curr   # 스레드 연결
                curr = curr.left
            else:
                pre.right = None   # 스레드 제거 (복원)
                result.append(curr.val)
                curr = curr.right
    return result
```

---

**지난 글:** [이진 트리 (Binary Tree)](/posts/dsa-binary-tree/)

**다음 글:** [이진 탐색 트리 (Binary Search Tree)](/posts/dsa-binary-search-tree/)

<br>
읽어주셔서 감사합니다. 😊
