---
title: "AVL 트리"
description: "균형 인수(BF)와 4가지 회전 연산으로 O(log n)을 보장하는 AVL 트리의 원리, 삽입·삭제 구현, 그리고 실전 적용 가이드를 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["AVL 트리", "균형 이진 탐색 트리", "회전", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-binary-search-tree/)에서 BST의 삽입·삭제를 살펴봤지만, 편향 트리가 되면 O(n) 성능으로 추락하는 문제를 남겨뒀습니다. AVL 트리는 1962년 Adelson-Velsky와 Landis가 발표한 최초의 **자가 균형 이진 탐색 트리**로, 모든 노드에서 왼쪽·오른쪽 서브트리 높이 차가 최대 1이 되도록 **회전(rotation)** 연산으로 균형을 유지합니다. 검색·삽입·삭제 모두 최악의 경우에도 O(log n)을 보장합니다.

## 균형 인수(Balance Factor)

```python
class AVLNode:
    def __init__(self, key):
        self.key = key
        self.left = self.right = None
        self.height = 0  # 리프 노드 높이 = 0

def height(node):
    return -1 if node is None else node.height

def balance_factor(node):
    return height(node.left) - height(node.right)

def update_height(node):
    node.height = 1 + max(height(node.left), height(node.right))
```

AVL 조건: **모든 노드에서 |BF| ≤ 1**. 삽입·삭제 후 경로를 거슬러 올라가며 BF가 ±2인 노드를 찾아 회전합니다.

## 4가지 회전 케이스

![AVL 트리 회전 원리](/assets/posts/dsa-avl-tree-rotation.svg)

| 불균형 형태 | 조건 | 해결 |
|---|---|---|
| LL | `BF == 2`, `BF(left) >= 0` | 우회전 1번 |
| RR | `BF == -2`, `BF(right) <= 0` | 좌회전 1번 |
| LR | `BF == 2`, `BF(left) < 0` | left 좌회전 → 우회전 |
| RL | `BF == -2`, `BF(right) > 0` | right 우회전 → 좌회전 |

```python
def rotate_right(y):
    x = y.left
    t2 = x.right
    x.right = y
    y.left = t2
    update_height(y)
    update_height(x)
    return x  # 새 루트

def rotate_left(x):
    y = x.right
    t2 = y.left
    y.left = x
    x.right = t2
    update_height(x)
    update_height(y)
    return y

def rebalance(node):
    update_height(node)
    bf = balance_factor(node)
    if bf == 2:
        if balance_factor(node.left) < 0:
            node.left = rotate_left(node.left)  # LR
        return rotate_right(node)
    if bf == -2:
        if balance_factor(node.right) > 0:
            node.right = rotate_right(node.right)  # RL
        return rotate_left(node)
    return node
```

## 삽입 구현

![AVL 트리 삽입 흐름](/assets/posts/dsa-avl-tree-insert.svg)

```python
def insert(node, key):
    if node is None:
        return AVLNode(key)
    if key < node.key:
        node.left = insert(node.left, key)
    elif key > node.key:
        node.right = insert(node.right, key)
    else:
        return node  # 중복 무시
    return rebalance(node)
```

재귀 호출이 복귀하면서 경로 위의 모든 노드를 `rebalance`로 점검합니다. 회전은 최대 1~2번만 일어납니다.

## 삭제 구현

```python
def delete(node, key):
    if node is None:
        return None
    if key < node.key:
        node.left = delete(node.left, key)
    elif key > node.key:
        node.right = delete(node.right, key)
    else:
        if node.left is None:
            return node.right
        if node.right is None:
            return node.left
        # 중위 후계자(오른쪽 서브트리 최솟값)로 교체
        successor = _min_node(node.right)
        node.key = successor.key
        node.right = delete(node.right, successor.key)
    return rebalance(node)

def _min_node(node):
    while node.left:
        node = node.left
    return node
```

삭제 후에는 경로 전체를 재균형해야 하므로 삽입보다 회전이 더 자주 발생할 수 있습니다.

## 성능 분석

| 연산 | 평균 | 최악 |
|---|---|---|
| 검색 | O(log n) | O(log n) |
| 삽입 | O(log n) | O(log n) |
| 삭제 | O(log n) | O(log n) |

높이 상한은 **1.44 × log₂(n+2)** 로 수학적으로 증명되어 있습니다. BST 최악(O(n))과 달리 항상 보장됩니다.

## 언제 AVL 트리를 쓰는가

- **읽기 위주** 워크로드: 검색 비율이 높을 때 레드-블랙 트리보다 더 엄격하게 균형을 맞춰 검색이 빠름
- 높이 차 ≤1 보장이 명확히 필요한 경우
- 반면 삽입·삭제가 잦다면 회전 횟수가 많아지므로 레드-블랙 트리가 더 적합

---

**지난 글:** [이진 탐색 트리 (Binary Search Tree)](/posts/dsa-binary-search-tree/)

**다음 글:** [레드-블랙 트리 (Red-Black Tree)](/posts/dsa-red-black-tree/)

<br>
읽어주셔서 감사합니다. 😊
