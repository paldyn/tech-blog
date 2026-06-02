---
title: "레드-블랙 트리 (Red-Black Tree)"
description: "5가지 속성과 리컬러링·회전으로 O(log n)을 보장하는 레드-블랙 트리의 원리, 삽입 수정 알고리즘, 그리고 AVL 트리와의 실전 비교를 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["레드-블랙 트리", "균형 이진 탐색 트리", "자료구조", "회전"]
featured: false
draft: false
---

[지난 글](/posts/dsa-avl-tree/)에서 AVL 트리는 |BF| ≤ 1이라는 엄격한 조건으로 높이를 통제했습니다. 레드-블랙 트리는 조금 더 **느슨한 균형 조건**을 채택하는 대신, 삽입·삭제 시 회전 횟수를 줄여 수정 비용을 낮춘 자가 균형 BST입니다. C++ `std::map`, Java `TreeMap`, Linux 커널 스케줄러 등 대부분의 표준 라이브러리가 레드-블랙 트리를 사용합니다.

## 5가지 속성

![레드-블랙 트리 구조](/assets/posts/dsa-red-black-tree-structure.svg)

레드-블랙 트리는 모든 노드에 색(Red/Black)을 부여하고, 5가지 속성을 항상 유지합니다.

1. 모든 노드는 빨강 또는 검정
2. 루트는 검정
3. 모든 리프(NIL 센티넬)는 검정
4. **빨강 노드의 두 자식은 검정** (연속 빨강 금지)
5. **루트에서 임의의 NIL까지 경로의 블랙 노드 수는 동일** (블랙 높이)

속성 4, 5의 조합으로 최장 경로는 최단 경로의 최대 **2배**를 넘지 않습니다. 이것이 O(log n) 높이를 보장하는 핵심입니다.

```python
class RBNode:
    RED = 'RED'
    BLACK = 'BLACK'
    def __init__(self, key):
        self.key = key
        self.color = RBNode.RED  # 새 노드는 항상 빨강으로 삽입
        self.left = self.right = self.parent = None
```

## 삽입 후 수정 (Fix-up)

새 노드를 빨강으로 삽입하면 속성 4(연속 빨강)가 깨질 수 있습니다. 3가지 케이스로 분류해 처리합니다.

![삽입 수정 케이스](/assets/posts/dsa-red-black-tree-insert.svg)

```python
def insert(tree, key):
    z = RBNode(key)
    bst_insert(tree, z)  # 일반 BST 삽입
    fix_insert(tree, z)  # 속성 복구

def fix_insert(tree, z):
    while z.parent and z.parent.color == 'RED':
        gp = z.parent.parent
        if z.parent == gp.left:
            uncle = gp.right
            if uncle and uncle.color == 'RED':
                # Case 1: 삼촌이 빨강 → 리컬러링
                z.parent.color = uncle.color = 'BLACK'
                gp.color = 'RED'
                z = gp  # 할아버지로 올라가서 재검사
            else:
                if z == z.parent.right:
                    # Case 2: LR → 부모 좌회전 후 Case 3
                    z = z.parent
                    rotate_left(tree, z)
                # Case 3: LL → 색 교환 + 우회전
                z.parent.color = 'BLACK'
                gp.color = 'RED'
                rotate_right(tree, gp)
        else:
            # 대칭 (right 케이스)
            fix_insert_right(tree, z, gp)
    tree.root.color = 'BLACK'  # 속성 2 보장
```

## 회전 구현

```python
def rotate_left(tree, x):
    y = x.right
    x.right = y.left
    if y.left:
        y.left.parent = x
    y.parent = x.parent
    if not x.parent:
        tree.root = y
    elif x == x.parent.left:
        x.parent.left = y
    else:
        x.parent.right = y
    y.left = x
    x.parent = y

def rotate_right(tree, y):
    x = y.left
    y.left = x.right
    if x.right:
        x.right.parent = y
    x.parent = y.parent
    if not y.parent:
        tree.root = x
    elif y == y.parent.left:
        y.parent.left = x
    else:
        y.parent.right = x
    x.right = y
    y.parent = x
```

## 삭제

삭제는 삽입보다 훨씬 복잡합니다. 검정 노드를 제거하면 블랙 높이(속성 5)가 깨질 수 있어 **이중 흑(Double Black)** 개념을 도입해 처리합니다.

```python
# 삭제 수정 핵심 — 이중 흑 해소
def fix_delete(tree, x):
    while x != tree.root and x.color == 'BLACK':
        if x == x.parent.left:
            w = x.parent.right  # 형제
            if w.color == 'RED':
                # Case 1: 형제가 빨강 → 회전 후 Case 2~4
                w.color = 'BLACK'
                x.parent.color = 'RED'
                rotate_left(tree, x.parent)
                w = x.parent.right
            # Case 2~4: 형제가 검정
            handle_black_sibling(tree, x, w)
        else:
            handle_black_sibling_right(tree, x, w)
    x.color = 'BLACK'
```

## AVL vs 레드-블랙 트리

| 구분 | AVL 트리 | 레드-블랙 트리 |
|---|---|---|
| 균형 조건 | \|BF\| ≤ 1 (엄격) | 블랙 높이 동일 (느슨) |
| 검색 속도 | 약간 빠름 (높이 낮음) | 약간 느림 |
| 삽입·삭제 | 회전 더 자주 | 회전 적음 (최대 3번) |
| 적합한 상황 | 읽기 위주 | 삽입·삭제 많음 |
| 사용 사례 | DB 인덱스 일부 | 표준 라이브러리 맵/셋 |

## 성능 분석

- 높이: 최대 **2 × log₂(n+1)**
- 검색·삽입·삭제: 모두 O(log n) 최악 보장
- 삽입 회전: **최대 2번**, 삭제 회전: **최대 3번** (AVL보다 적음)

---

**지난 글:** [AVL 트리](/posts/dsa-avl-tree/)

**다음 글:** [균형 트리 비교 (Balanced Tree Comparison)](/posts/dsa-balanced-tree-comparison/)

<br>
읽어주셔서 감사합니다. 😊
