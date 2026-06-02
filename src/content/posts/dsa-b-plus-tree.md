---
title: "B+ 트리 (B+ Tree)"
description: "리프 연결 리스트로 범위 검색을 O(k)로 처리하는 B+ 트리의 구조, 삽입·삭제, MySQL InnoDB 클러스터드 인덱스 적용 사례를 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["B+ 트리", "B+Tree", "데이터베이스 인덱스", "범위 검색", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-b-tree/)에서 B 트리의 구조와 삽입·삭제를 살펴봤습니다. B+ 트리는 B 트리의 **핵심 변형**으로, 관계형 데이터베이스의 인덱스가 거의 예외 없이 사용하는 자료구조입니다. 핵심 아이디어는 두 가지입니다: 내부 노드에는 키만 두고, **모든 실제 데이터는 리프 노드에만** 저장하며, 리프 노드들을 **연결 리스트**로 이어서 범위 검색을 극도로 효율화합니다.

## B 트리와의 차이

![B+ 트리 구조](/assets/posts/dsa-b-plus-tree-structure.svg)

| 항목 | B 트리 | B+ 트리 |
|---|---|---|
| 데이터 위치 | 모든 노드 | 리프 노드만 |
| 내부 노드 | 키 + 데이터 | 키만 |
| 범위 검색 | 트리 순회 필요 | 리프 선형 스캔 |
| 내부 노드 용량 | 적음 | 더 많은 키 → 낮은 높이 |
| 삭제 | 복잡 (내부 노드 포함) | 리프에서만 처리 |

## 구조 구현

```python
class BPlusNode:
    def __init__(self, is_leaf=False):
        self.keys = []
        self.children = []   # 내부 노드: 자식 포인터 | 리프: 데이터
        self.next = None     # 리프 노드끼리 연결
        self.is_leaf = is_leaf

class BPlusTree:
    def __init__(self, order):
        self.order = order        # 최대 자식 수
        self.root = BPlusNode(is_leaf=True)
```

## 검색

```python
def search(node, key):
    if node.is_leaf:
        # 리프에서 키 탐색
        for i, k in enumerate(node.keys):
            if k == key:
                return node.children[i]  # 데이터 반환
        return None
    # 내부 노드: 올바른 자식으로 내려감
    i = len(node.keys)
    for j, k in enumerate(node.keys):
        if key < k:
            i = j
            break
    return search(node.children[i], key)
```

## 범위 검색 — B+ 트리의 핵심 장점

![범위 검색](/assets/posts/dsa-b-plus-tree-range.svg)

```python
def range_search(tree, low, high):
    # 1. 시작 리프 찾기 O(log n)
    leaf = find_leaf(tree.root, low)
    result = []
    # 2. 리프 연결 리스트를 선형 스캔 O(k)
    while leaf is not None:
        for i, key in enumerate(leaf.keys):
            if low <= key <= high:
                result.append((key, leaf.children[i]))
            elif key > high:
                return result
        leaf = leaf.next  # 다음 리프로 이동
    return result

# SQL: SELECT * FROM t WHERE id BETWEEN 15 AND 35
# → range_search(tree, 15, 35) = O(log n + k)
```

## 삽입

```python
def insert(tree, key, value):
    leaf = find_leaf(tree.root, key)
    _leaf_insert(leaf, key, value)

    if len(leaf.keys) >= tree.order:
        # 리프 분할
        new_leaf = _split_leaf(leaf, tree.order)
        # 분할 후 부모에 새 키 올림
        _insert_into_parent(tree, leaf, new_leaf.keys[0], new_leaf)

def _split_leaf(leaf, order):
    mid = order // 2
    new_leaf = BPlusNode(is_leaf=True)
    new_leaf.keys = leaf.keys[mid:]
    new_leaf.children = leaf.children[mid:]
    leaf.keys = leaf.keys[:mid]
    leaf.children = leaf.children[:mid]
    # 리프 연결 리스트 유지
    new_leaf.next = leaf.next
    leaf.next = new_leaf
    return new_leaf
```

**B 트리와의 삽입 차이**: 리프 분할 시 분할 키를 **복사**해서 부모에 올립니다 (B 트리는 이동). 복사된 키가 리프에도 남아있어야 범위 검색 시 빠짐없이 반환됩니다.

## 삭제

```python
def delete(tree, key):
    leaf = find_leaf(tree.root, key)
    if key not in leaf.keys:
        return  # 없는 키

    i = leaf.keys.index(key)
    leaf.keys.pop(i)
    leaf.children.pop(i)

    min_keys = (tree.order - 1) // 2
    if len(leaf.keys) < min_keys:
        # 형제에서 빌리거나 병합
        _fix_leaf_underflow(tree, leaf)
    # 내부 노드 키는 삭제해도 그대로 유지 가능
    # (리프 연결 리스트가 실제 데이터 경계 역할)
```

## MySQL InnoDB 클러스터드 인덱스

MySQL InnoDB 테이블은 **기본 키(PK)로 B+ 트리 클러스터드 인덱스**를 만들고, 리프 노드에 행 전체를 저장합니다.

```sql
-- PK로 범위 검색 → B+ 트리 리프 선형 스캔
SELECT * FROM orders
WHERE order_id BETWEEN 1000 AND 2000;

-- 인덱스 구조:
-- 내부 노드: [1000 | 1500 | 2000 | ...]  ← 키만
-- 리프 노드: [(1000, row), (1001, row), ...]  ← 전체 행
--            ↔ (1500, row), ... ↔ (2000, row), ...
```

세컨더리 인덱스는 리프에 PK 값을 저장하고, PK로 다시 클러스터드 인덱스를 조회합니다 (2단계 룩업).

## 성능 비교

| 연산 | B 트리 | B+ 트리 |
|---|---|---|
| 단건 검색 | O(log n) | O(log n) |
| 범위 검색 | O(k × log n) | O(log n + k) |
| 삽입 | O(log n) | O(log n) |
| 삭제 | O(log n) | O(log n) |

범위 검색에서 B+ 트리가 압도적으로 유리합니다. k가 클수록 차이가 커집니다.

---

**지난 글:** [B 트리 (B-Tree)](/posts/dsa-b-tree/)

**다음 글:** [힙 (Heap)](/posts/dsa-heap/)

<br>
읽어주셔서 감사합니다. 😊
