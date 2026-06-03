---
title: "0-1 BFS — deque를 이용한 O(V+E) 최단 경로"
description: "간선 가중치가 0 또는 1로 제한된 그래프에서 deque를 활용해 O(V+E)로 최단 경로를 구하는 0-1 BFS의 원리와 구현, 적용 패턴을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["0-1 BFS", "deque", "최단 경로", "그래프", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-multi-source-bfs/)에서 다중 소스 BFS를 통해 여러 시작점의 최단 거리를 한 번에 구하는 방법을 살펴봤습니다. 이번에는 간선 가중치가 **0 또는 1**로 제한된 특수한 그래프에서 **다익스트라보다 빠른 O(V+E)** 를 달성하는 **0-1 BFS**를 다룹니다.

## 핵심 아이디어

일반 BFS는 모든 간선이 가중치 1일 때만 최단 경로를 보장합니다. 가중치가 0과 1이 섞여 있다면?

- **가중치 0 간선**: 탐색해도 거리가 증가하지 않으므로 **같은 레이어**에 속함 → **앞에 삽입 (push_front)**
- **가중치 1 간선**: 거리가 1 증가 → **뒤에 삽입 (push_back)**

이렇게 하면 deque 앞에는 항상 현재 거리의 노드들이, 뒤에는 다음 거리의 노드들이 위치합니다. 일반 BFS처럼 거리 순서가 보장됩니다.

![0-1 BFS 개념](/assets/posts/dsa-zero-one-bfs-concept.svg)

## 구현

```javascript
function zeroOneBfs(graph, V, src) {
  const dist = new Array(V).fill(Infinity);
  dist[src] = 0;
  const dq = [src]; // deque (배열로 간이 구현)

  while (dq.length) {
    const u = dq.shift(); // pop_front

    for (const { v, w } of graph.adj[u]) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        // w=0: 앞에, w=1: 뒤에
        w === 0 ? dq.unshift(v) : dq.push(v);
      }
    }
  }
  return dist;
}
```

> **주의**: JS의 `dq.shift()`와 `dq.unshift()`는 O(n)입니다. 대규모 그래프에서는 연결 리스트 기반 deque나 고정 크기 원형 버퍼를 사용하세요.

![0-1 BFS 구현](/assets/posts/dsa-zero-one-bfs-impl.svg)

## 왜 다익스트라 대신?

다익스트라는 우선순위 큐(힙)를 사용해 O((V+E) log V)입니다. 가중치가 0/1로 제한되면 0-1 BFS로 **O(V+E)**를 달성합니다.

| 알고리즘 | 가중치 조건 | 복잡도 |
|---|---|---|
| BFS | 모두 동일 (1) | O(V+E) |
| **0-1 BFS** | **0 또는 1** | **O(V+E)** |
| 다익스트라 | 양수 | O((V+E) log V) |
| 벨만-포드 | 음수 포함 | O(VE) |

## 활용 패턴

### 미로에서 특수 타일

특정 타일을 밟으면 비용 0, 일반 이동은 비용 1입니다.

```python
from collections import deque

def minCost(grid):
    R, C = len(grid), len(grid[0])
    dist = [[float('inf')] * C for _ in range(R)]
    dist[0][0] = 0
    dq = deque([(0, 0)])

    while dq:
        r, c = dq.popleft()
        for dr, dc, w in [(-1,0,1),(1,0,1),(0,-1,1),(0,1,1),(0,0,0)]:
            nr, nc = r+dr, c+dc
            if 0<=nr<R and 0<=nc<C:
                cost = dist[r][c] + w
                if cost < dist[nr][nc]:
                    dist[nr][nc] = cost
                    if w == 0:
                        dq.appendleft((nr, nc))
                    else:
                        dq.append((nr, nc))
    return dist[R-1][C-1]
```

### k번 무료 통행

상태를 `(노드, 남은 무료 횟수)`로 확장하면 일반적인 "최대 k번 무료 통행" 문제도 0-1 BFS로 풀 수 있습니다.

```javascript
// 상태: [node, freeLeft]
// 무료 사용: 비용 0 → push_front
// 유료: 비용 1 → push_back
function minCostWithFreePass(graph, V, src, dst, k) {
  const dist = Array.from({ length: V }, () => new Array(k + 1).fill(Infinity));
  dist[src][k] = 0;
  const dq = [[src, k]];

  while (dq.length) {
    const [u, free] = dq.shift();
    for (const { v, w } of graph.adj[u]) {
      // 유료 이동
      if (dist[u][free] + w < dist[v][free]) {
        dist[v][free] = dist[u][free] + w;
        dq.push([v, free]);
      }
      // 무료 이동 (free > 0)
      if (free > 0 && dist[u][free] < dist[v][free - 1]) {
        dist[v][free - 1] = dist[u][free];
        dq.unshift([v, free - 1]);
      }
    }
  }
  return Math.min(...dist[dst]);
}
```

---

**지난 글:** [다중 소스 BFS](/posts/dsa-multi-source-bfs/)

**다음 글:** [위상 정렬](/posts/dsa-topological-sort/)

<br>
읽어주셔서 감사합니다. 😊
