---
title: "트리 기초 (Tree Basics)"
description: "루트·부모·자식·리프·깊이·높이 등 트리의 핵심 용어와 성질, 다양한 트리 종류와 그 용도를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["트리", "tree", "이진 트리", "트리 용어", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-lru-cache/)에서 해시 테이블과 연결 리스트를 조합한 LRU 캐시를 구현했습니다. 이제 선형 자료구조를 넘어 **계층적(hierarchical) 자료구조**인 트리를 시작합니다. 트리는 운영체제의 파일 시스템, 데이터베이스 인덱스, 컴파일러의 AST, 네트워크 라우팅 테이블 등 소프트웨어 전반에 걸쳐 핵심적으로 쓰입니다.

## 트리의 정의

**트리(Tree)**는 사이클이 없는 연결 비방향 그래프(Connected Acyclic Undirected Graph)입니다. n개의 노드가 있으면 정확히 n-1개의 간선(edge)을 가집니다.

계층적으로 표현하면 하나의 **루트(root)** 노드를 최상위에 두고, 부모-자식 관계로 노드를 연결한 구조입니다.

## 핵심 용어

![트리 용어](/assets/posts/dsa-tree-basics-terminology.svg)

| 용어 | 정의 |
|---|---|
| **루트(Root)** | 부모가 없는 유일한 최상위 노드 |
| **내부 노드(Internal)** | 자식이 하나 이상 있는 노드 |
| **리프(Leaf)** | 자식이 없는 말단 노드 |
| **깊이(Depth)** | 루트에서 해당 노드까지의 간선 수 |
| **높이(Height)** | 해당 노드에서 가장 깊은 리프까지의 간선 수 |
| **트리 높이** | 루트의 높이 (= 최대 깊이) |
| **레벨(Level)** | 깊이 + 1 (루트는 레벨 1) |
| **차수(Degree)** | 노드의 자식 수 |
| **서브트리(Subtree)** | 한 노드를 루트로 하는 부분 트리 |

## 트리의 재귀적 정의

트리는 자기 참조적 구조입니다. **루트 + 루트의 각 자식을 루트로 하는 서브트리들의 집합**으로 정의됩니다. 이 재귀적 특성이 트리 알고리즘에서 재귀/DFS가 자연스럽게 맞아떨어지는 이유입니다.

```python
class TreeNode:
    def __init__(self, val=0):
        self.val = val
        self.children = []   # n-ary 트리

# 이진 트리 노드
class BinaryTreeNode:
    def __init__(self, val=0):
        self.val = val
        self.left = None
        self.right = None

# 재귀적으로 노드 수 계산
def count_nodes(root):
    if root is None:
        return 0
    return 1 + count_nodes(root.left) + count_nodes(root.right)
```

## 트리의 수학적 성질

n개의 노드를 가진 트리에서:
- 간선 수 = n - 1
- 내부 노드 수 + 리프 수 = n
- **이진 트리**: 리프 수 = 완전 이진 트리에서 (내부 노드 수 + 1)

레벨 k에서의 최대 노드 수는 **이진 트리 기준** 2^k개입니다 (루트가 레벨 0).

높이 h인 완전 이진 트리의 노드 수: 2^(h+1) - 1

## 트리 종류와 용도

![트리 종류 개요](/assets/posts/dsa-tree-basics-types.svg)

각 트리 종류는 특정 성질을 추가하거나 구조를 제약함으로써 특정 연산을 최적화합니다. BST는 검색을, 힙은 최솟값/최댓값 접근을, B+Tree는 디스크 블록 단위 I/O를 최적화합니다.

## 트리와 그래프의 차이

모든 트리는 그래프이지만, 모든 그래프가 트리는 아닙니다.

```
트리의 조건:
1. 연결됨 (Connected): 임의의 두 노드 사이에 경로 존재
2. 비순환 (Acyclic): 사이클 없음

== 조건 1만 제거 → 포레스트(Forest)
== 조건 2만 제거 → 일반 연결 그래프
```

## Python에서의 트리 표현

```python
# 방법 1: 클래스 기반 (포인터)
class Node:
    def __init__(self, val):
        self.val = val
        self.left = self.right = None

# 방법 2: 딕셔너리 (인접 리스트)
tree = {1: [2, 3], 2: [4, 5], 3: [], 4: [], 5: []}

# 방법 3: 배열 (완전 이진 트리)
# 인덱스 i의 자식: 2i+1 (왼쪽), 2i+2 (오른쪽)
# 인덱스 i의 부모: (i-1) // 2
arr = [1, 2, 3, 4, 5, 6, 7]
```

다음 글부터 이진 트리 → BST → AVL → 힙 순서로 각 구조를 깊이 파고들겠습니다.

---

**지난 글:** [LRU 캐시 (LRU Cache)](/posts/dsa-lru-cache/)

**다음 글:** [이진 트리 (Binary Tree)](/posts/dsa-binary-tree/)

<br>
읽어주셔서 감사합니다. 😊
