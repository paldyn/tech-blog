---
title: "그래프 BFS (너비 우선 탐색)"
description: "큐를 이용해 그래프를 층위별로 탐색하는 BFS의 동작 원리, 최단 경로 보장 이유, 경로 복원 구현, 이분 그래프 판별까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["BFS", "너비 우선 탐색", "최단 경로", "그래프", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-graph-representation/)에서 그래프를 메모리에 저장하는 세 가지 방법을 살펴봤습니다. 이제 그래프를 실제로 탐색해 봅니다. **너비 우선 탐색(Breadth-First Search, BFS)**은 시작 정점에서 가까운 정점부터 차례로 방문하며, **비가중 그래프에서 최단 경로를 보장**하는 대표 알고리즘입니다.

## 동작 원리

큐(Queue)를 이용합니다. 시작 정점을 큐에 넣고, 큐에서 꺼낼 때마다 방문하지 않은 이웃을 모두 큐에 추가합니다.

같은 레벨(layer)의 정점은 같은 거리에 있습니다. 층위별로 퍼져 나가기 때문에 **최단 거리가 자동으로 보장**됩니다.

![BFS 탐색 과정](/assets/posts/dsa-graph-bfs-process.svg)

## 구현: 최단 거리 + 경로 복원

```javascript
function bfs(graph, V, src, dst) {
  const dist = new Array(V).fill(-1);
  const prev = new Array(V).fill(-1);
  const queue = [src];
  dist[src] = 0;
  let head = 0;

  while (head < queue.length) {
    const u = queue[head++]; // O(1) dequeue
    for (const { v } of graph.adj[u]) {
      if (dist[v] === -1) {  // 미방문
        dist[v] = dist[u] + 1;
        prev[v] = u;         // 경로 추적용
        queue.push(v);
      }
    }
  }
  return { dist, prev };
}

// 경로 복원: dst에서 역추적
function getPath(prev, dst) {
  const path = [];
  for (let v = dst; v !== -1; v = prev[v])
    path.unshift(v);
  return path; // [src, ..., dst]
}
```

> **주의**: `queue.shift()`는 O(n)이라 전체 BFS가 O(V²)로 악화됩니다. `head` 포인터로 dequeue를 O(1)로 유지하세요.

![BFS 구현](/assets/posts/dsa-graph-bfs-impl.svg)

## 이분 그래프 판별

2가지 색으로 정점을 칠할 수 있으면 이분 그래프(bipartite)입니다. BFS로 레이어를 나누면서 같은 레이어끼리 간선이 있으면 이분 그래프가 아닙니다.

```javascript
function isBipartite(graph, V) {
  const color = new Array(V).fill(-1);

  for (let start = 0; start < V; start++) {
    if (color[start] !== -1) continue; // 이미 방문

    color[start] = 0;
    const queue = [start];
    let head = 0;

    while (head < queue.length) {
      const u = queue[head++];
      for (const { v } of graph.adj[u]) {
        if (color[v] === -1) {
          color[v] = 1 - color[u]; // 반대 색
          queue.push(v);
        } else if (color[v] === color[u]) {
          return false; // 같은 색 인접 → 이분 아님
        }
      }
    }
  }
  return true;
}
```

## 그리드 BFS

2D 미로에서 최단 경로를 구할 때 자주 씁니다. 정점 번호 대신 `[r, c]` 좌표를 씁니다.

```javascript
const dr = [-1, 1, 0, 0];
const dc = [0, 0, -1, 1];

function gridBfs(grid, sr, sc, er, ec) {
  const R = grid.length, C = grid[0].length;
  const dist = Array.from({ length: R }, () => new Array(C).fill(-1));
  dist[sr][sc] = 0;
  const queue = [[sr, sc]];
  let head = 0;

  while (head < queue.length) {
    const [r, c] = queue[head++];
    if (r === er && c === ec) return dist[r][c];
    for (let d = 0; d < 4; d++) {
      const nr = r + dr[d], nc = c + dc[d];
      if (nr >= 0 && nr < R && nc >= 0 && nc < C
          && grid[nr][nc] !== '#' && dist[nr][nc] === -1) {
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nr, nc]);
      }
    }
  }
  return -1; // 도달 불가
}
```

## 복잡도

| | 시간 | 공간 |
|---|---|---|
| BFS | O(V + E) | O(V) |
| 그리드 BFS (R×C) | O(R×C) | O(R×C) |

---

**지난 글:** [그래프 표현](/posts/dsa-graph-representation/)

**다음 글:** [그래프 DFS](/posts/dsa-graph-dfs/)

<br>
읽어주셔서 감사합니다. 😊
