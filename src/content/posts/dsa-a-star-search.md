---
title: "A* 탐색 알고리즘 — 휴리스틱으로 더 빠르게"
description: "f(n) = g(n) + h(n) 공식으로 목표 방향을 예측하며 탐색하는 A* 알고리즘의 원리, 허용 가능 휴리스틱 조건, 격자 기반 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["A스타", "A* 알고리즘", "휴리스틱", "최단 경로", "그래프 탐색"]
featured: false
draft: false
---

[지난 글](/posts/dsa-dijkstra/)에서 음수 없는 가중치 그래프에서 최단 경로를 구하는 다익스트라를 배웠습니다. **A\*(A-Star) 탐색 알고리즘**은 다익스트라에 **휴리스틱(heuristic)** 정보를 더해 목표 방향으로 편향 탐색합니다. 게임 AI 경로 탐색, 로봇 네비게이션, 지도 경로 안내 등 실시간 성능이 요구되는 영역에서 다익스트라보다 훨씬 적은 노드를 방문하며 최단 경로를 찾아냅니다.

## 핵심 공식

```text
f(n) = g(n) + h(n)
```

- **g(n)**: 출발점에서 현재 노드 n까지의 **실제 비용**
- **h(n)**: 현재 노드 n에서 목표까지의 **추정 비용** (휴리스틱)
- **f(n)**: 이 노드를 경유했을 때의 **총 추정 비용**

A\*는 f(n)이 가장 작은 노드를 먼저 확장합니다. h(n)=0으로 두면 다익스트라와 동일해집니다.

## 허용 가능 휴리스틱

A\*가 최적 경로를 보장하려면 h(n)이 **허용 가능(admissible)** 해야 합니다.

> h(n) ≤ h\*(n) — 실제 남은 비용을 절대 과대평가하지 않는다

- **맨해튼 거리** `|dx| + |dy|`: 격자에서 상하좌우만 이동 가능할 때
- **유클리드 거리** `√(dx² + dy²)`: 8방향 이동 가능할 때
- **체비쇼프 거리** `max(|dx|, |dy|)`: 대각선 비용이 1일 때

![A* 격자 탐색 시각화](/assets/posts/dsa-a-star-grid.svg)

## Python 구현 (격자 기반)

```python
import heapq

def heuristic(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])  # 맨해튼

def a_star(grid, start, goal):
    rows, cols = len(grid), len(grid[0])
    open_set = [(0, start)]
    g = {start: 0}
    came_from = {}

    while open_set:
        _, cur = heapq.heappop(open_set)
        if cur == goal:
            return reconstruct_path(came_from, cur)

        r, c = cur
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != 1:
                nb = (nr, nc)
                new_g = g[cur] + 1
                if new_g < g.get(nb, float('inf')):
                    g[nb] = new_g
                    f = new_g + heuristic(nb, goal)
                    heapq.heappush(open_set, (f, nb))
                    came_from[nb] = cur
    return None  # 경로 없음

def reconstruct_path(came_from, cur):
    path = [cur]
    while cur in came_from:
        cur = came_from[cur]
        path.append(cur)
    return list(reversed(path))
```

![A* 알고리즘 구현 코드](/assets/posts/dsa-a-star-code.svg)

## 타이 브레이킹

f(n)이 동일한 노드가 여럿이면 순서에 따라 탐색 방향이 달라집니다. 우선순위 큐에 `(f, h, node)` 형태로 넣어 h가 작은 것(목표에 가까운 것)을 우선시하면 직선적인 경로를 더 빨리 찾습니다.

```python
# 타이 브레이킹: f 같으면 h가 작은 것 먼저
heapq.heappush(open_set, (f, heuristic(nb, goal), nb))
```

## A* vs 다익스트라 vs BFS

| 특성 | BFS | 다익스트라 | A* |
|---|---|---|---|
| 가중치 처리 | 불가(균일) | O | O |
| 휴리스틱 | 없음 | 없음 | O |
| 시간 복잡도 | O(V+E) | O((V+E)log V) | O(b^d) |
| 최적성 | 균일 가중치만 | O | 허용 가능 h 시 O |
| 실용 속도 | 느림 | 느림 | **빠름** |

b는 분기 계수, d는 목표 깊이입니다.

## 가중치 그래프에서의 A*

격자가 아닌 일반 가중치 그래프에서도 사용 가능합니다.

```python
def a_star_weighted(graph, start, goal, h):
    open_set = [(h(start, goal), 0, start)]  # (f, g, node)
    g = {start: 0}
    came_from = {}

    while open_set:
        f, cost, u = heapq.heappop(open_set)
        if cost > g.get(u, float('inf')):
            continue
        if u == goal:
            return reconstruct_path(came_from, u), cost

        for v, w in graph[u]:
            new_g = g[u] + w
            if new_g < g.get(v, float('inf')):
                g[v] = new_g
                came_from[v] = u
                heapq.heappush(open_set, (new_g + h(v, goal), new_g, v))
    return None, float('inf')
```

## 성능 특성

h(n)의 정확도에 따라 성능이 크게 달라집니다.

- **h(n) = 0**: 다익스트라와 동일 (최악 성능)
- **h(n) = h\*(n)**: 직선만 따라 목표 도달 (최선 성능)
- **h(n) > h\*(n)**: 최적 보장 없음, Weighted A\* (속도와 최적성 트레이드오프)

## 요약

A\*는 **다익스트라 + 방향성**입니다. 좋은 휴리스틱이 있다면 탐색 공간을 극적으로 줄여 실시간 경로 탐색이 가능해집니다. 격자 지도, 네비게이션, 퍼즐(15-puzzle, 소코반) 등 목표 위치가 명확한 문제에서 최강의 알고리즘입니다.

---

**지난 글:** [다익스트라(Dijkstra) 알고리즘 — 최단 경로의 정석](/posts/dsa-dijkstra/)

**다음 글:** [벨만-포드(Bellman-Ford) — 음수 가중치와 음수 사이클 탐지](/posts/dsa-bellman-ford/)

<br>
읽어주셔서 감사합니다. 😊
