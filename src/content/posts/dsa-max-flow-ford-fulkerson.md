---
title: "최대 유량 — 포드-풀커슨(Ford-Fulkerson) 알고리즘"
description: "증가 경로를 반복 탐색해 source에서 sink로의 최대 유량을 구하는 포드-풀커슨과 Edmonds-Karp의 잔여 그래프, 역방향 간선, 최대-유량 최소-컷 정리를 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["최대유량", "포드풀커슨", "Ford-Fulkerson", "Edmonds-Karp", "네트워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/dsa-eulerian-path/)에서 모든 간선을 한 번씩 통과하는 오일러 경로를 다뤘습니다. 이번에는 **네트워크 플로우**의 핵심 알고리즘인 **포드-풀커슨(Ford-Fulkerson)**을 다룹니다. 파이프라인 최대 처리량, 이분 매칭, 프로젝트 선택 등 다양한 문제를 최대 유량으로 모델링해 해결할 수 있습니다.

## 기본 개념

- **소스(source, s)**: 유량이 출발하는 노드
- **싱크(sink, t)**: 유량이 도달하는 노드
- **용량(capacity)**: 간선이 수용할 수 있는 최대 유량
- **유량(flow)**: 현재 흐르는 양 — 용량을 초과할 수 없음
- **잔여 그래프(residual graph)**: `잔여[u][v] = cap[u][v] - flow[u][v]`

## 핵심 아이디어

1. 잔여 그래프에서 s → t 경로(**증가 경로**)를 찾음
2. 경로 위 **병목(bottleneck)** = 경로의 최소 잔여 용량
3. 병목만큼 유량 증가, 역방향 간선 유량 감소
4. 증가 경로가 없을 때까지 반복

역방향 간선은 **잘못 보낸 유량을 취소**하는 능력을 부여합니다.

![최대 유량 네트워크](/assets/posts/dsa-max-flow-network.svg)

## Python 구현 — Edmonds-Karp (BFS)

BFS로 증가 경로를 찾으면 O(VE²)가 보장됩니다.

```python
from collections import deque

def max_flow_edmonds_karp(cap, s, t, n):
    """
    cap: n×n 용량 행렬 (방향 그래프)
    반환: 최대 유량
    """
    flow = [[0] * n for _ in range(n)]
    total = 0

    while True:
        # BFS: 증가 경로 탐색
        parent = [-1] * n
        parent[s] = s
        q = deque([s])

        while q and parent[t] == -1:
            u = q.popleft()
            for v in range(n):
                if parent[v] == -1 and cap[u][v] - flow[u][v] > 0:
                    parent[v] = u
                    q.append(v)

        if parent[t] == -1:
            break  # 증가 경로 없음: 최대 유량 달성

        # 병목 계산
        bottleneck = float('inf')
        v = t
        while v != s:
            u = parent[v]
            bottleneck = min(bottleneck, cap[u][v] - flow[u][v])
            v = u

        # 유량 갱신
        v = t
        while v != s:
            u = parent[v]
            flow[u][v] += bottleneck
            flow[v][u] -= bottleneck  # 역방향 간선
            v = u

        total += bottleneck

    return total
```

![포드-풀커슨 증가 경로와 잔여 그래프](/assets/posts/dsa-max-flow-augmenting.svg)

## 인접 리스트 기반 구현 (실전)

용량 행렬 대신 간선 리스트 기반으로 역방향 간선을 인덱스로 관리합니다.

```python
from collections import deque, defaultdict

class MaxFlow:
    def __init__(self, n):
        self.graph = defaultdict(list)
        self.n = n

    def add_edge(self, u, v, cap):
        self.graph[u].append([v, cap, len(self.graph[v])])
        self.graph[v].append([u, 0, len(self.graph[u]) - 1])

    def bfs(self, s, t):
        self.level = [-1] * self.n
        self.level[s] = 0
        q = deque([s])
        while q:
            u = q.popleft()
            for v, cap, _ in self.graph[u]:
                if cap > 0 and self.level[v] == -1:
                    self.level[v] = self.level[u] + 1
                    q.append(v)
        return self.level[t] != -1

    def dfs(self, u, t, f):
        if u == t:
            return f
        for e in self.graph[u]:
            v, cap, rev = e
            if cap > 0 and self.level[v] == self.level[u] + 1:
                d = self.dfs(v, t, min(f, cap))
                if d > 0:
                    e[1] -= d
                    self.graph[v][rev][1] += d
                    return d
        return 0

    def max_flow(self, s, t):
        flow = 0
        while self.bfs(s, t):
            while True:
                f = self.dfs(s, t, float('inf'))
                if f == 0:
                    break
                flow += f
        return flow  # Dinic's Algorithm: O(V²E)
```

## 최대-유량 최소-컷 정리

> **최대 유량 = 최소 컷 용량**

**컷(Cut)**은 소스 측 S와 싱크 측 T로 노드를 분리하는 간선 집합입니다. 최소 컷은 컷 용량을 최소화하는 분리 방법이며, 이것이 최대 유량과 정확히 일치합니다.

```python
def find_min_cut(cap, flow, s, n):
    """최대 유량 계산 후 소스 측 도달 가능 노드 집합"""
    residual_adj = [
        [v for v in range(n) if cap[u][v] - flow[u][v] > 0]
        for u in range(n)
    ]
    visited = set()
    q = deque([s])
    visited.add(s)
    while q:
        u = q.popleft()
        for v in residual_adj[u]:
            if v not in visited:
                visited.add(v)
                q.append(v)
    # visited = 소스 측, 나머지 = 싱크 측
    # 소스 측 → 싱크 측 간선이 min-cut
    return visited
```

## 이분 매칭 — 최대 유량 응용

이분 그래프에서 최대 매칭은 최대 유량으로 O(E√V)에 해결됩니다.

```python
def bipartite_matching(left, right, edges):
    """
    left, right: 노드 수
    edges: [(u, v), ...] — u는 왼쪽, v는 오른쪽
    """
    n = left + right + 2
    s, t = 0, n - 1
    mf = MaxFlow(n)

    for u in range(1, left + 1):
        mf.add_edge(s, u, 1)
    for v in range(left + 1, left + right + 1):
        mf.add_edge(v, t, 1)
    for u, v in edges:
        mf.add_edge(u, left + v, 1)

    return mf.max_flow(s, t)
```

## 복잡도 비교

| 알고리즘 | 경로 탐색 | 시간 복잡도 |
|---|---|---|
| Ford-Fulkerson | DFS | O(Ef) — f는 최대 유량 |
| Edmonds-Karp | BFS | O(VE²) |
| Dinic's | BFS + blocking flow | O(V²E) |

정수 용량 그래프에서 Ford-Fulkerson의 O(Ef)는 f가 크면 느릴 수 있습니다. 실전에서는 Edmonds-Karp나 Dinic을 사용합니다.

## 요약

포드-풀커슨의 본질은 **잔여 그래프에서 증가 경로를 반복 탐색**하는 것입니다. 역방향 간선이 잘못된 유량 할당을 수정할 수 있게 해주며, 최종적으로 최대-유량 최소-컷 정리에 의해 최적해를 보장합니다. 이분 매칭, 프로젝트 선택, 홀 정리 등 수많은 최적화 문제가 최대 유량으로 환원됩니다.

---

**지난 글:** [오일러 경로와 오일러 회로 — 한붓그리기](/posts/dsa-eulerian-path/)

**다음 글:** [최대 유량 — 디닉(Dinic) 알고리즘](/posts/dsa-max-flow-dinic/)

<br>
읽어주셔서 감사합니다. 😊
