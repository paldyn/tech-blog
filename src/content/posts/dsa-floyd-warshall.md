---
title: "플로이드-워셜(Floyd-Warshall) — 모든 쌍 최단 경로"
description: "3중 루프로 모든 쌍의 최단 경로를 O(V³)에 구하는 플로이드-워셜 알고리즘의 DP 원리, 음수 사이클 탐지, 경로 추적까지 완전히 파헤칩니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["플로이드워셜", "Floyd-Warshall", "전체쌍최단경로", "동적프로그래밍", "그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-bellman-ford/)에서 단일 출발점의 최단 경로를 음수 간선에서도 구하는 벨만-포드를 다뤘습니다. **플로이드-워셜(Floyd-Warshall)**은 한 발 더 나아가 **모든 쌍(All-Pairs)의 최단 경로**를 단 3중 루프로 구합니다. 노드가 수백 개 이내인 dense 그래프, 전이 폐쇄(transitive closure) 계산, 음수 사이클 탐지 등에 쓰이는 강력한 DP 알고리즘입니다.

## 핵심 아이디어 — DP 점화식

```
dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
```

**"노드 k를 중간 경유지로 허용할 때 i → j 경로가 단축되는가?"** 를 k = 0, 1, ..., V-1 순서로 모든 쌍에 대해 체크합니다. k가 늘어날수록 경유 가능한 노드 집합이 커지며 거리가 수렴합니다.

## Python 구현

```python
def floyd_warshall(n, edges):
    INF = float('inf')
    # 초기화
    d = [[INF] * n for _ in range(n)]
    for i in range(n):
        d[i][i] = 0
    for u, v, w in edges:
        d[u][v] = w

    # 3중 루프 — O(V³)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if d[i][k] + d[k][j] < d[i][j]:
                    d[i][j] = d[i][k] + d[k][j]

    # 음수 사이클 탐지: 대각선 값이 음수이면 사이클 존재
    for i in range(n):
        if d[i][i] < 0:
            return None

    return d
```

![플로이드-워셜 거리 행렬 변환](/assets/posts/dsa-floyd-warshall-matrix.svg)

## 경로 추적

next 배열을 함께 관리하면 실제 경로를 재구성할 수 있습니다.

```python
def floyd_warshall_with_path(n, edges):
    INF = float('inf')
    d = [[INF] * n for _ in range(n)]
    nxt = [[None] * n for _ in range(n)]

    for i in range(n):
        d[i][i] = 0
    for u, v, w in edges:
        if w < d[u][v]:
            d[u][v] = w
            nxt[u][v] = v

    for k in range(n):
        for i in range(n):
            for j in range(n):
                if d[i][k] + d[k][j] < d[i][j]:
                    d[i][j] = d[i][k] + d[k][j]
                    nxt[i][j] = nxt[i][k]

    return d, nxt

def get_path(nxt, u, v):
    if nxt[u][v] is None:
        return []
    path = [u]
    while u != v:
        u = nxt[u][v]
        path.append(u)
    return path
```

![플로이드-워셜 구현 코드](/assets/posts/dsa-floyd-warshall-code.svg)

## 음수 사이클 탐지

알고리즘 수행 후 `d[i][i] < 0`인 노드가 있으면 그 노드를 포함하는 음수 사이클이 존재합니다. 벨만-포드는 단일 출발점 기준으로 탐지하지만, 플로이드-워셜은 **어느 노드를 포함하는 음수 사이클인지까지** 파악 가능합니다.

```python
# 음수 사이클에 영향받는 노드 찾기
neg_cycle_nodes = set()
for i in range(n):
    for j in range(n):
        # i→j 경로 중 음수 사이클 노드를 경유하면 -inf
        for k in range(n):
            if d[k][k] < 0 and d[i][k] < INF and d[k][j] < INF:
                d[i][j] = -INF
```

## 전이 폐쇄 (Transitive Closure)

가중치 없이 **두 노드 사이에 경로가 존재하는지**만 구할 때는 불리언 버전을 사용합니다.

```python
def transitive_closure(n, edges):
    reach = [[False] * n for _ in range(n)]
    for i in range(n):
        reach[i][i] = True
    for u, v in edges:
        reach[u][v] = True

    for k in range(n):
        for i in range(n):
            for j in range(n):
                reach[i][j] = reach[i][j] or (reach[i][k] and reach[k][j])
    return reach
```

## 시간·공간 복잡도

| 항목 | 값 |
|---|---|
| 시간 복잡도 | O(V³) |
| 공간 복잡도 | O(V²) |
| 음수 가중치 | 가능 |
| 음수 사이클 탐지 | 가능 (d[i][i] < 0) |

## V번 다익스트라 vs 플로이드-워셜

- **Sparse 그래프** (E ≪ V²): V번 다익스트라가 O(VE log V)로 더 빠름
- **Dense 그래프** (E ≈ V²): 플로이드-워셜 O(V³)이 상수가 작아 유리
- **음수 간선 포함**: 플로이드-워셜만 사용 가능

## 요약

플로이드-워셜의 아름다움은 **3줄 핵심 루프**에 있습니다. DP 관점에서 k를 허용 경유지 집합에 추가하는 방식으로 점진적으로 최적해를 갱신합니다. V가 수백 이내면 이 알고리즘 하나로 모든 쌍 최단 경로를 간단히 해결할 수 있습니다.

---

**지난 글:** [벨만-포드(Bellman-Ford) — 음수 가중치와 음수 사이클 탐지](/posts/dsa-bellman-ford/)

**다음 글:** [크루스칼(Kruskal) 알고리즘 — 최소 신장 트리 구성](/posts/dsa-mst-kruskal/)

<br>
읽어주셔서 감사합니다. 😊
