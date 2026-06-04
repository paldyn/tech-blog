---
title: "프림(Prim) 알고리즘 — 그리디 방식으로 MST 확장"
description: "시작 노드에서 최소 가중치 간선으로 트리를 확장하는 프림 알고리즘의 우선순위 큐 구현, 크루스칼과의 비교, 실전 활용까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["프림", "Prim", "MST", "최소신장트리", "우선순위큐"]
featured: false
draft: false
---

[지난 글](/posts/dsa-mst-kruskal/)에서 간선을 정렬해 사이클 없이 선택하는 크루스칼 알고리즘을 배웠습니다. **프림(Prim) 알고리즘**은 같은 MST를 다른 방식으로 구합니다. **임의의 시작 노드에서 출발해 현재 트리와 연결되는 최소 가중치 간선**을 반복적으로 선택하며 트리를 키워갑니다. 다익스트라와 매우 유사한 구조로 우선순위 큐를 활용합니다.

## 알고리즘 동작

1. 임의의 시작 노드를 MST에 포함
2. MST에 포함된 노드와 연결된 **모든 후보 간선**을 우선순위 큐에 삽입
3. 큐에서 가중치가 가장 작은 간선 꺼냄
4. 도착 노드가 이미 방문됐으면 스킵
5. 미방문이면 MST에 추가, 인접 간선을 큐에 삽입
6. V-1개 간선이 선택될 때까지 반복

![프림 MST 확장 과정](/assets/posts/dsa-mst-prim-graph.svg)

## Python 구현

```python
import heapq

def prim(graph, start=0):
    """
    graph: {u: [(v, weight), ...]}
    반환: (MST 간선 리스트, 총 가중치)
    """
    visited = set()
    mst, total = [], 0
    # (가중치, 도착노드, 출발노드)
    pq = [(0, start, -1)]

    while pq:
        w, v, u = heapq.heappop(pq)
        if v in visited:
            continue
        visited.add(v)
        if u != -1:
            mst.append((u, v, w))
            total += w

        for nv, nw in graph[v]:
            if nv not in visited:
                heapq.heappush(pq, (nw, nv, v))

    return mst, total

# 사용 예
graph = {
    0: [(1, 2), (2, 4)],
    1: [(0, 2), (2, 3), (3, 5)],
    2: [(0, 4), (1, 3), (3, 1)],
    3: [(1, 5), (2, 1)]
}
mst, cost = prim(graph, start=0)
print(cost)   # 6 (= 2+3+1)
```

![프림 알고리즘 Python 구현](/assets/posts/dsa-mst-prim-code.svg)

## 인접 행렬 버전 — Dense 그래프

인접 행렬 + 선형 탐색 버전은 O(V²)로 dense 그래프에서 힙 버전보다 빠릅니다.

```python
def prim_dense(adj, n):
    """adj: n×n 가중치 행렬, adj[i][j]=INF면 연결 없음"""
    INF = float('inf')
    key = [INF] * n       # 현재 MST와의 최소 연결 비용
    in_mst = [False] * n
    parent = [-1] * n
    key[0] = 0

    for _ in range(n):
        # 미포함 노드 중 key 최소 노드 선택 O(V)
        u = min((v for v in range(n) if not in_mst[v]), key=lambda v: key[v])
        in_mst[u] = True

        for v in range(n):
            if not in_mst[v] and adj[u][v] < key[v]:
                key[v] = adj[u][v]
                parent[v] = u

    total = sum(key[1:])
    return parent, total
```

## 시간·공간 복잡도

| 구현 방식 | 시간 복잡도 | 적합 케이스 |
|---|---|---|
| 인접 행렬 + 선형 탐색 | O(V²) | Dense (E ≈ V²) |
| 인접 리스트 + 이진 힙 | O((V+E) log V) | Sparse |
| 피보나치 힙 | O(E + V log V) | 이론적 최적 |

## 다익스트라와의 비교

프림과 다익스트라는 코드 구조가 매우 유사합니다.

| 항목 | 다익스트라 | 프림 |
|---|---|---|
| 큐 기준 | dist[u] (출발점~u) | 트리~u 연결 비용 |
| 목표 | 최단 경로 | MST |
| 음수 간선 | 불가 | 가능 |

둘 다 그리디이지만 다익스트라는 누적 거리, 프림은 현재 간선 가중치로 우선순위를 정합니다.

## 실전 활용 — 두 클러스터 최소 연결 비용

```python
# 두 그룹 간 최소 비용 연결 (클러스터 합치기)
def min_bridge_cost(adj, group_a, group_b):
    min_cost = float('inf')
    for u in group_a:
        for v in group_b:
            if adj[u][v] < min_cost:
                min_cost = adj[u][v]
                best = (u, v)
    return min_cost, best
```

## 요약

프림은 **우선순위 큐로 항상 트리 경계의 최소 간선을 선택**합니다. 코드 구조는 다익스트라와 거의 동일하지만 목적이 MST 구성이라는 점이 다릅니다. Dense 그래프에서는 인접 행렬 + O(V²) 버전이, Sparse 그래프에서는 힙 버전이 더 유리합니다.

---

**지난 글:** [크루스칼(Kruskal) 알고리즘 — 최소 신장 트리 구성](/posts/dsa-mst-kruskal/)

**다음 글:** [강한 연결 요소(SCC) — 코사라주와 타잔 알고리즘](/posts/dsa-strongly-connected-components/)

<br>
읽어주셔서 감사합니다. 😊
