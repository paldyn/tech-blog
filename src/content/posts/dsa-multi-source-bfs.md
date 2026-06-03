---
title: "다중 소스 BFS (Multi-Source BFS)"
description: "여러 시작점에서 동시에 BFS를 실행하는 기법으로, 모든 소스에 대한 최단 거리를 O(V+E) 한 번으로 구하는 방법과 대표 활용 패턴을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["다중 소스 BFS", "Multi-Source BFS", "BFS", "최단 거리", "그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-graph-dfs/)에서 DFS의 동작 원리와 사이클 감지를 다뤘습니다. 이번에는 BFS의 강력한 변형인 **다중 소스 BFS(Multi-Source BFS)**를 소개합니다. 여러 시작점에서 동시에 확산하는 이 기법은 단일 BFS K번 실행의 O(K×(V+E))를 **O(V+E)** 로 줄여줍니다.

## 문제 예시

"그리드의 각 칸에서 가장 가까운 소스(S) 셀까지의 거리를 구하라."

단순 접근: 각 소스 S에서 BFS를 돌린다 → O(K × R×C)  
다중 소스 BFS: 모든 S를 동시에 큐에 넣고 BFS 한 번 → **O(R×C)**

![다중 소스 BFS 개념](/assets/posts/dsa-multi-source-bfs-concept.svg)

## 핵심 아이디어

모든 소스에서 동시 출발합니다. 각 소스는 이미 거리 0인 상태로 큐에 들어가므로, BFS가 퍼져 나가면서 모든 셀에 **가장 가까운 소스까지의 거리**가 자동으로 채워집니다.

이는 **가상 슈퍼소스(virtual super-source)** 패턴과 동일합니다. 모든 실제 소스에 가중치 0 간선으로 연결된 슈퍼소스 S를 만들고, S에서 단일 BFS를 실행하는 것과 같습니다.

## 구현

```javascript
function multiSourceBfs(grid) {
  const R = grid.length, C = grid[0].length;
  const dist = Array.from({ length: R }, () => new Array(C).fill(-1));
  const queue = [];

  // ① 모든 소스를 거리 0으로 초기화하며 큐에 투입
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      if (grid[r][c] === 'S') {
        dist[r][c] = 0;
        queue.push([r, c]);
      }

  // ② 일반 BFS와 동일하게 진행
  const dr = [-1, 1, 0, 0];
  const dc = [0, 0, -1, 1];
  let head = 0;

  while (head < queue.length) {
    const [r, c] = queue[head++];
    for (let d = 0; d < 4; d++) {
      const nr = r + dr[d], nc = c + dc[d];
      if (nr >= 0 && nr < R && nc >= 0 && nc < C
          && grid[nr][nc] !== '#' && dist[nr][nc] === -1) {
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nr, nc]);
      }
    }
  }
  return dist; // dist[r][c]: 가장 가까운 소스까지 거리
}
```

![다중 소스 BFS 구현](/assets/posts/dsa-multi-source-bfs-impl.svg)

## 대표 문제

### 01 매트릭스

`matrix[i][j]`가 0 또는 1인 그리드에서 각 1 셀의 가장 가까운 0 셀까지 거리를 구합니다.

```javascript
function updateMatrix(matrix) {
  const R = matrix.length, C = matrix[0].length;
  const dist = matrix.map(row => row.map(v => v === 0 ? 0 : -1));
  const queue = [];

  // 모든 0 셀이 소스
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      if (matrix[r][c] === 0) queue.push([r, c]);

  // BFS 확산
  const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];
  let head = 0;
  while (head < queue.length) {
    const [r, c] = queue[head++];
    for (let d = 0; d < 4; d++) {
      const nr = r + dr[d], nc = c + dc[d];
      if (nr >= 0 && nr < R && nc >= 0 && nc < C && dist[nr][nc] === -1) {
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nr, nc]);
      }
    }
  }
  return dist;
}
```

### 썩는 귤 (Rotting Oranges)

처음부터 썩은 귤(2)이 소스입니다. BFS로 확산하면서 모든 신선한 귤(1)이 언제 감염되는지 구합니다. 도달 못하는 1이 있으면 -1을 반환합니다.

```python
from collections import deque

def orangesRotting(grid):
    R, C = len(grid), len(grid[0])
    q = deque()
    fresh = 0
    for r in range(R):
        for c in range(C):
            if grid[r][c] == 2:
                q.append((r, c, 0))
            elif grid[r][c] == 1:
                fresh += 1
    time = 0
    for r, c, t in q:
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r+dr, c+dc
            if 0<=nr<R and 0<=nc<C and grid[nr][nc]==1:
                grid[nr][nc] = 2
                fresh -= 1
                time = max(time, t+1)
                q.append((nr, nc, t+1))
    return -1 if fresh > 0 else time
```

## 복잡도

| | 시간 | 공간 |
|---|---|---|
| 다중 소스 BFS | O(V + E) | O(V) |
| 소스 K개 개별 BFS | O(K × (V+E)) | O(V) |

---

**지난 글:** [그래프 DFS](/posts/dsa-graph-dfs/)

**다음 글:** [0-1 BFS](/posts/dsa-zero-one-bfs/)

<br>
읽어주셔서 감사합니다. 😊
