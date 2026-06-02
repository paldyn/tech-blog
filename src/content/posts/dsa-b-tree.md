---
title: "B 트리 (B-Tree)"
description: "다진 트리로 디스크 I/O를 최소화하는 B 트리의 속성, 삽입 시 노드 분할, 삭제 시 병합·재분배, 그리고 파일 시스템과 DB 엔진 적용 사례를 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["B트리", "B-Tree", "자료구조", "데이터베이스", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/dsa-balanced-tree-comparison/)에서 균형 트리들의 트레이드오프를 비교했습니다. 이번 글은 그 중 디스크 기반 시스템에서 가장 널리 쓰이는 **B 트리**를 자세히 다룹니다. B 트리는 노드 하나에 여러 키를 담아 트리 높이를 낮추고, 디스크 I/O 횟수를 최소화하는 **다진 자가 균형 트리**입니다.

## B 트리의 동기

하드 디스크(HDD)나 SSD에서 데이터를 읽는 비용은 메모리 접근보다 수천 배 느립니다. 이진 트리는 높이가 log₂ n이므로, 백만 개 키를 저장할 때 약 20번의 디스크 I/O가 필요합니다. B 트리는 노드당 수백 개의 키를 저장해 높이를 log_t n (t=차수)으로 낮춥니다. t=500이면 같은 백만 키를 단 4번의 I/O로 접근합니다.

## 구조와 속성

![B 트리 구조](/assets/posts/dsa-b-tree-structure.svg)

```python
class BTreeNode:
    def __init__(self, t, is_leaf=False):
        self.t = t            # 최소 차수
        self.keys = []        # 정렬된 키 목록 (최대 2t-1개)
        self.children = []    # 자식 포인터 (최대 2t개)
        self.is_leaf = is_leaf

class BTree:
    def __init__(self, t):
        self.t = t
        self.root = BTreeNode(t, is_leaf=True)
```

**속성 요약** (최소 차수 t ≥ 2):
- 루트 제외 모든 노드: 키 t-1개 이상, 2t-1개 이하
- 내부 노드: 자식 수 = 키 수 + 1
- 모든 리프: 동일 깊이 → 완전 균형
- 높이: O(log_t n)

## 검색

```python
def search(node, key):
    i = 0
    while i < len(node.keys) and key > node.keys[i]:
        i += 1
    if i < len(node.keys) and key == node.keys[i]:
        return (node, i)   # 발견
    if node.is_leaf:
        return None        # 없음
    return search(node.children[i], key)  # 자식으로 내려감
```

각 노드에서 이진 탐색(또는 선형 탐색)으로 위치를 찾고 자식으로 내려갑니다. 시간 복잡도: O(log n).

## 삽입 — 노드 분할

![노드 분할](/assets/posts/dsa-b-tree-split.svg)

삽입 전 경로의 **가득 찬(full) 노드를 미리 분할**합니다 (하향식 분할). 이렇게 하면 삽입 실패 없이 단일 패스로 처리됩니다.

```python
def split_child(parent, i, child, t):
    new_node = BTreeNode(t, child.is_leaf)
    mid_key = child.keys[t - 1]
    # 오른쪽 절반 분리
    new_node.keys = child.keys[t:]
    child.keys = child.keys[:t - 1]
    if not child.is_leaf:
        new_node.children = child.children[t:]
        child.children = child.children[:t]
    # 중앙 키를 부모에 삽입
    parent.keys.insert(i, mid_key)
    parent.children.insert(i + 1, new_node)

def insert(tree, key):
    root = tree.root
    if len(root.keys) == 2 * tree.t - 1:  # 루트가 가득 참
        new_root = BTreeNode(tree.t)
        new_root.children = [root]
        split_child(new_root, 0, root, tree.t)
        tree.root = new_root
    _insert_non_full(tree.root, key, tree.t)

def _insert_non_full(node, key, t):
    i = len(node.keys) - 1
    if node.is_leaf:
        node.keys.append(None)
        while i >= 0 and key < node.keys[i]:
            node.keys[i + 1] = node.keys[i]
            i -= 1
        node.keys[i + 1] = key
    else:
        while i >= 0 and key < node.keys[i]:
            i -= 1
        i += 1
        if len(node.children[i].keys) == 2 * t - 1:
            split_child(node, i, node.children[i], t)
            if key > node.keys[i]:
                i += 1
        _insert_non_full(node.children[i], key, t)
```

## 삭제 — 병합과 재분배

삭제는 삽입보다 복잡합니다. 삭제 후 노드가 t-1개 미만이 되면 **형제에서 빌리거나(재분배)** **형제와 병합**합니다.

```python
def delete(node, key, t):
    i = find_key_index(node, key)
    if i < len(node.keys) and node.keys[i] == key:
        if node.is_leaf:
            node.keys.pop(i)      # 리프에서 직접 제거
        else:
            _delete_internal(node, i, t)  # 내부 노드
    else:
        if node.is_leaf:
            return  # 키 없음
        # 자식 노드의 키가 t-1이면 먼저 보충
        if len(node.children[i].keys) < t:
            fill_child(node, i, t)
        # fill 후 i 재계산 필요할 수 있음
        delete(node.children[i], key, t)
```

## 성능 분석

| 연산 | 시간 복잡도 |
|---|---|
| 검색 | O(log n) |
| 삽입 | O(log n) |
| 삭제 | O(log n) |
| 디스크 I/O | O(log_t n) 페이지 |

t=1000 이면 백만 개 키를 2레벨 트리로 표현 가능 → **2번의 디스크 I/O**로 검색 완료.

## 실전 사례

- **ext4 / NTFS**: 파일 시스템 디렉토리 인덱스에 B 트리 또는 변형 사용
- **Linux VFS**: 디렉토리 항목 캐시
- **MongoDB**: WiredTiger 스토리지 엔진 (B 트리 기반 변형)
- **SQLite**: 테이블과 인덱스를 B 트리로 저장

---

**지난 글:** [균형 트리 비교 (Balanced Tree Comparison)](/posts/dsa-balanced-tree-comparison/)

**다음 글:** [B+ 트리 (B+ Tree)](/posts/dsa-b-plus-tree/)

<br>
읽어주셔서 감사합니다. 😊
