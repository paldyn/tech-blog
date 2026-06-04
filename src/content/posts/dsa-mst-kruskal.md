---
title: "크루스칼(Kruskal) 알고리즘 — 최소 신장 트리 구성"
description: "간선을 가중치 오름차순으로 정렬해 사이클 없이 선택하는 크루스칼 알고리즘과 유니온 파인드의 조합으로 O(E log E)에 MST를 구성합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["크루스칼", "Kruskal", "MST", "최소신장트리", "유니온파인드"]
featured: false
draft: false
---

[지난 글](/posts/dsa-floyd-warshall/)에서 모든 쌍의 최단 경로를 구하는 플로이드-워셜을 살펴봤습니다. 이번에는 **최소 비용으로 모든 노드를 연결**하는 **최소 신장 트리(MST, Minimum Spanning Tree)** 를 구하는 **크루스칼(Kruskal)** 알고리즘을 다룹니다. 네트워크 회선 구축, 클러스터링, 이미지 세그멘테이션 등에 폭넓게 활용됩니다.

## 최소 신장 트리란?

- **신장 트리(Spanning Tree)**: V개의 노드를 V-1개의 간선으로 연결한 사이클 없는 그래프
- **최소 신장 트리**: 신장 트리 중 모든 간선 가중치의 합이 최소인 것

핵심 성질: **MST는 항상 V-1개의 간선**을 갖습니다.

## 크루스칼 알고리즘

**그리디** 전략을 사용합니다.

1. 모든 간선을 가중치 **오름차순** 정렬
2. 가장 작은 간선부터 차례로 검토
3. 해당 간선이 **사이클을 형성하지 않으면** MST에 추가
4. V-1개 간선이 선택되면 종료

사이클 판단은 **유니온 파인드(DSU)**를 사용해 O(α(n)) ≈ O(1) 에 처리합니다.

![크루스칼 MST 구성 과정](/assets/posts/dsa-mst-kruskal-graph.svg)

## Python 구현

```python
class DSU:
    def __init__(self, n):
        self.p = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.p[x] != x:
            self.p[x] = self.find(self.p[x])  # 경로 압축
        return self.p[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False  # 같은 집합: 사이클 형성
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.p[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        return True

def kruskal(n, edges):
    """
    edges: [(u, v, weight), ...]
    반환: (MST 간선 리스트, 총 가중치)
    """
    edges.sort(key=lambda e: e[2])
    dsu = DSU(n)
    mst, total = [], 0

    for u, v, w in edges:
        if dsu.union(u, v):     # 사이클 없음: 선택
            mst.append((u, v, w))
            total += w
            if len(mst) == n - 1:
                break           # V-1개 완성: 조기 종료

    return mst, total
```

![크루스칼 + 유니온 파인드 구현](/assets/posts/dsa-mst-kruskal-code.svg)

## 시간·공간 복잡도

| 단계 | 복잡도 |
|---|---|
| 간선 정렬 | O(E log E) |
| union-find 연산 × E회 | O(E · α(V)) ≈ O(E) |
| **전체** | **O(E log E)** |
| 공간 | O(V + E) |

## MST의 유일성

MST는 **모든 간선의 가중치가 서로 다르면 유일**합니다. 동일한 가중치가 있으면 여러 MST가 존재할 수 있습니다. 단, 총 가중치는 동일합니다.

## 활용 — 최소 비용 클러스터링

MST에서 가중치 상위 k-1개 간선을 제거하면 k개의 클러스터로 분리할 수 있습니다.

```python
def k_clustering(n, edges, k):
    """k개 클러스터로 분리 — MST에서 상위 k-1개 간선 제거"""
    edges.sort(key=lambda e: e[2])
    dsu = DSU(n)
    mst = []

    for u, v, w in edges:
        if dsu.union(u, v):
            mst.append((u, v, w))
            if len(mst) == n - 1:
                break

    # 상위 k-1개 간선 제거: n-k번만 union
    edges.sort(key=lambda e: e[2])
    dsu2 = DSU(n)
    count = 0
    for u, v, w in edges:
        if dsu2.union(u, v):
            count += 1
            if count == n - k:
                # 다음 선택될 간선이 클러스터 간 최소 거리
                for eu, ev, ew in edges:
                    if dsu2.find(eu) != dsu2.find(ev):
                        return ew
    return 0
```

## 크루스칼 vs 프림

| 특성 | 크루스칼 | 프림 |
|---|---|---|
| 기반 | 간선 기준 그리디 | 노드 기준 그리디 |
| 자료구조 | 유니온 파인드 | 우선순위 큐 |
| 시간 | O(E log E) | O((V+E) log V) |
| 유리한 경우 | Sparse 그래프 | Dense 그래프 |

## 요약

크루스칼은 **정렬 + 유니온 파인드**의 조합입니다. 간선이 적을수록(E ≪ V²) 유리하고, 구현이 직관적입니다. `edges.sort()` 한 줄과 DSU만 있으면 MST를 빠르게 구할 수 있습니다.

---

**지난 글:** [플로이드-워셜(Floyd-Warshall) — 모든 쌍 최단 경로](/posts/dsa-floyd-warshall/)

**다음 글:** [프림(Prim) 알고리즘 — 그리디 방식으로 MST 확장](/posts/dsa-mst-prim/)

<br>
읽어주셔서 감사합니다. 😊
