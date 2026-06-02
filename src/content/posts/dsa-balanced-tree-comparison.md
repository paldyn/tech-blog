---
title: "균형 트리 비교 (Balanced Tree Comparison)"
description: "AVL, 레드-블랙, B, B+ 트리, 스킵 리스트를 성능·구조·사용처 기준으로 비교하고, 상황에 맞는 트리를 선택하는 기준을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["균형 트리", "AVL", "레드-블랙 트리", "B트리", "자료구조 비교"]
featured: false
draft: false
---

[지난 글](/posts/dsa-red-black-tree/)에서 레드-블랙 트리의 5가지 속성과 삽입 수정 알고리즘을 살펴봤습니다. 이제 주요 균형 트리들을 한자리에 모아 비교해봅니다. 트리를 고를 때는 "어떤 연산이 가장 잦은가", "메모리인가 디스크인가", "범위 검색이 필요한가"가 핵심 기준이 됩니다.

## 전체 비교표

![균형 트리 비교표](/assets/posts/dsa-balanced-tree-comparison-chart.svg)

## 트레이드오프 지형도

![트레이드오프](/assets/posts/dsa-balanced-tree-comparison-tradeoff.svg)

## AVL 트리

균형 조건이 가장 엄격(|BF| ≤ 1)해 높이가 1.44 log n 이하로 유지됩니다. 검색이 레드-블랙보다 약간 빠르지만, 삽입·삭제 시 회전이 더 자주 발생합니다.

```python
# AVL 높이 상한 — 피보나치 수와 관계
# N(h) = 최소 노드 수 (높이 h)
# N(0)=1, N(1)=2, N(h) = N(h-1) + N(h-2) + 1
# → h <= 1.44 * log2(n+2) - 0.328
```

**선택 기준**: 읽기(검색)가 쓰기보다 훨씬 많고, 데이터가 메모리에 있는 경우.

## 레드-블랙 트리

실용적인 균형. 높이 상한은 2 log n으로 AVL보다 느슨하지만 삽입·삭제 회전이 최대 3번으로 제한됩니다. C++ STL `std::map/set`, Java `TreeMap/TreeSet`, Linux 커널 CFS 스케줄러, Nginx 타이머가 사용합니다.

```cpp
// C++ std::map — 내부적으로 레드-블랙 트리
std::map<int, std::string> m;
m[1] = "one";
m[2] = "two";
// 검색/삽입/삭제 모두 O(log n) 최악 보장
auto it = m.lower_bound(2);  // 범위 검색도 O(log n)
```

**선택 기준**: 삽입·삭제·검색 모두 빈번하고, 균형 잡힌 성능이 필요한 경우.

## B 트리

노드 하나에 여러 키를 저장하는 **다진 트리**입니다. 최소 차수 t일 때 노드당 t-1 ~ 2t-1개의 키를 가집니다. 디스크 I/O는 노드 단위로 일어나므로, 노드를 한 블록(4KB)에 맞추면 깊이당 I/O 횟수를 크게 줄일 수 있습니다.

```python
class BTreeNode:
    def __init__(self, t, is_leaf=False):
        self.t = t           # 최소 차수
        self.keys = []       # 최대 2t-1개
        self.children = []   # 최대 2t개
        self.is_leaf = is_leaf

# t=2 (2-3-4 트리): 노드당 키 1~3개, 자식 2~4개
# t=500: 노드당 키 499~999개 — 디스크 블록에 딱 맞음
```

**선택 기준**: 파일 시스템(ext4, NTFS), 범용 데이터베이스 저장 엔진.

## B+ 트리

B 트리의 변형으로, **내부 노드는 키만 저장**하고 **모든 실제 데이터(레코드)는 리프 노드**에 있습니다. 리프 노드들은 연결 리스트로 이어져 있어 범위 검색이 O(k) (k = 결과 수)로 매우 빠릅니다.

```
내부 노드: [10 | 20 | 30]  ← 키만
              ↓     ↓     ↓
리프: [1,5,8] → [10,15,18] → [20,25,28] → [30,35,40]
                (리프끼리 연결 리스트)
```

```sql
-- MySQL InnoDB 클러스터드 인덱스 = B+ 트리
-- 범위 검색이 매우 빠름
SELECT * FROM orders WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';
-- 리프 노드를 선형 스캔 → 추가 랜덤 I/O 없음
```

**선택 기준**: 관계형 DB 인덱스(MySQL InnoDB, PostgreSQL, Oracle), 범위 검색 빈번.

## 스킵 리스트

트리 구조 없이 **여러 레이어의 연결 리스트**로 O(log n) 검색을 달성합니다. 구현이 단순하고 락-프리 동시성 구현이 쉽습니다. Redis의 sorted set이 스킵 리스트를 사용합니다.

```python
import random

class SkipNode:
    def __init__(self, key, level):
        self.key = key
        self.forward = [None] * (level + 1)

class SkipList:
    MAX_LEVEL = 16
    P = 0.5

    def _random_level(self):
        lvl = 0
        while random.random() < self.P and lvl < self.MAX_LEVEL:
            lvl += 1
        return lvl
```

**선택 기준**: 동시성 자료구조, 인메모리 정렬 집합, 간단한 구현이 필요한 경우.

## 선택 가이드 요약

| 상황 | 추천 |
|---|---|
| 인메모리, 검색 위주 | AVL 트리 |
| 인메모리, 삽입/삭제 빈번 | 레드-블랙 트리 |
| 디스크 기반, 범위 검색 | B+ 트리 |
| 디스크 기반, 범용 | B 트리 |
| 동시성 자료구조 | 스킵 리스트 |

---

**지난 글:** [레드-블랙 트리 (Red-Black Tree)](/posts/dsa-red-black-tree/)

**다음 글:** [B 트리 (B-Tree)](/posts/dsa-b-tree/)

<br>
읽어주셔서 감사합니다. 😊
