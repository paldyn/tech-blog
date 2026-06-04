---
title: "단절점과 단절선 — 그래프의 취약 구조 탐지"
description: "제거하면 그래프가 분리되는 단절점(AP)과 단절선(Bridge)을 DFS의 disc/low 값으로 O(V+E)에 탐지하는 알고리즘을 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["단절점", "단절선", "Bridge", "Articulation Point", "그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-strongly-connected-components/)에서 방향 그래프의 SCC를 구하는 코사라주·타잔 알고리즘을 다뤘습니다. 이번에는 **무방향 그래프에서 취약 구조**를 찾는 **단절점(Articulation Point)**과 **단절선(Bridge)** 탐지 알고리즘을 알아봅니다. 네트워크에서 제거 시 연결이 끊기는 노드나 링크를 미리 파악해 장애 대비 설계에 활용됩니다.

## 정의

- **단절점**: 해당 노드를 제거하면 그래프가 2개 이상의 컴포넌트로 분리
- **단절선(브리지)**: 해당 간선을 제거하면 그래프가 분리

두 개념 모두 DFS의 **발견 시각(disc)**과 **도달 가능 최솟값(low)**을 활용합니다.

## low 값의 의미

```
low[u] = min(
  disc[u],              # 자기 자신 발견 시각
  disc[w] for w in 역방향 간선(back edge),  # 조상에 직접 연결
  low[v] for v in 자식 노드               # 자식을 통해 도달 가능한 최솟값
)
```

`low[v] ≥ disc[u]`이면 v의 서브트리는 u를 통하지 않으면 u의 조상에 접근 불가 → **u가 단절점**

`low[v] > disc[u]`이면 u-v 간선 없이는 두 컴포넌트 연결 불가 → **u-v가 단절선**

![단절점·단절선 그래프 시각화](/assets/posts/dsa-articulation-graph.svg)

## Python 구현

```python
def find_ap_bridges(n, adj):
    """
    n: 노드 수, adj: 인접 리스트 (무방향)
    반환: (단절점 집합, 단절선 리스트)
    """
    disc = [-1] * n
    low = [0] * n
    aps, bridges = set(), []
    timer = [0]

    def dfs(u, parent):
        disc[u] = low[u] = timer[0]
        timer[0] += 1
        children = 0

        for v in adj[u]:
            if disc[v] == -1:
                children += 1
                dfs(v, u)
                low[u] = min(low[u], low[v])

                # 단절선 조건
                if low[v] > disc[u]:
                    bridges.append((u, v))

                # 단절점 조건 1: 루트이고 자식 2개 이상
                if parent == -1 and children > 1:
                    aps.add(u)
                # 단절점 조건 2: 루트 아니고 low[v] >= disc[u]
                if parent != -1 and low[v] >= disc[u]:
                    aps.add(u)

            elif v != parent:
                # 역방향 간선: low 갱신
                low[u] = min(low[u], disc[v])

    for v in range(n):
        if disc[v] == -1:
            dfs(v, -1)

    return aps, bridges
```

![단절점·단절선 구현 코드](/assets/posts/dsa-articulation-code.svg)

## 다중 간선 처리

노드 u-v 사이에 여러 간선이 있으면 `v != parent` 조건만으로는 병렬 간선을 구분할 수 없습니다. 간선 ID를 사용해야 합니다.

```python
def find_ap_bridges_multigraph(n, adj_with_id):
    """adj_with_id: {u: [(v, edge_id), ...]}"""
    disc = [-1] * n
    low = [0] * n
    timer = [0]
    aps, bridges = set(), []

    def dfs(u, parent_edge):
        disc[u] = low[u] = timer[0]
        timer[0] += 1
        children = 0

        for v, eid in adj_with_id[u]:
            if eid == parent_edge:  # 온 경로 간선 스킵
                continue
            if disc[v] == -1:
                children += 1
                dfs(v, eid)
                low[u] = min(low[u], low[v])
                if low[v] > disc[u]:
                    bridges.append((u, v))
                if parent_edge == -1 and children > 1:
                    aps.add(u)
                if parent_edge != -1 and low[v] >= disc[u]:
                    aps.add(u)
            else:
                low[u] = min(low[u], disc[v])

    for v in range(n):
        if disc[v] == -1:
            dfs(v, -1)

    return aps, bridges
```

## 2-엣지 연결 컴포넌트 (2-ECC)

브리지를 제거한 후 남은 연결 컴포넌트를 **2-엣지 연결 컴포넌트**라 합니다. 브리지 모두 제거 후 BFS/DFS로 컴포넌트를 구하면 됩니다.

```python
def two_edge_connected_components(n, adj_with_id):
    _, bridges = find_ap_bridges_multigraph(n, adj_with_id)
    bridge_set = set(map(tuple, bridges))
    bridge_set |= {(v, u) for u, v in bridges}

    visited = [False] * n
    comps = []

    def bfs(start):
        q = [start]
        visited[start] = True
        comp = [start]
        while q:
            u = q.pop()
            for v, _ in adj_with_id[u]:
                if not visited[v] and (u, v) not in bridge_set:
                    visited[v] = True
                    comp.append(v)
                    q.append(v)
        return comp

    for v in range(n):
        if not visited[v]:
            comps.append(bfs(v))
    return comps
```

## 시간·공간 복잡도

| 항목 | 값 |
|---|---|
| 시간 복잡도 | O(V + E) |
| 공간 복잡도 | O(V) |
| 알고리즘 기반 | DFS + disc/low |

## 요약

단절점은 `low[v] ≥ disc[u]`, 단절선은 `low[v] > disc[u]` 하나씩의 조건 차이입니다. 루트 노드는 자식 개수로 단절점 여부를 판단하는 예외 케이스만 주의하면 됩니다. DFS 한 번으로 그래프의 모든 취약 구조를 O(V+E)에 파악할 수 있습니다.

---

**지난 글:** [강한 연결 요소(SCC) — 코사라주와 타잔 알고리즘](/posts/dsa-strongly-connected-components/)

**다음 글:** [오일러 경로와 오일러 회로 — 한붓그리기](/posts/dsa-eulerian-path/)

<br>
읽어주셔서 감사합니다. 😊
