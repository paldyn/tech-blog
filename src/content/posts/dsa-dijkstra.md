---
title: "다익스트라(Dijkstra) 알고리즘 — 최단 경로의 정석"
description: "우선순위 큐를 활용해 음수 없는 가중치 그래프에서 O((V+E)log V)에 최단 경로를 구하는 다익스트라 알고리즘을 구조부터 구현까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["다익스트라", "Dijkstra", "최단 경로", "우선순위 큐", "그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-union-find/)에서 집합의 연결 여부를 O(α(n))에 판단하는 유니온 파인드를 살펴봤습니다. 이번에는 **가중치 그래프에서 단일 출발점으로부터 모든 노드까지의 최단 거리**를 구하는 **다익스트라(Dijkstra) 알고리즘**을 깊이 파헤칩니다. GPS 내비게이션, 네트워크 라우팅 프로토콜(OSPF), 게임 경로 탐색 등 실제 시스템 곳곳에 쓰이는 핵심 알고리즘입니다.

## 핵심 아이디어

다익스트라의 직관은 단순합니다. **"아직 확정되지 않은 노드 중 현재 거리가 가장 짧은 것을 선택해 확정하면, 그 거리는 절대로 더 나빠질 수 없다."** 이것이 성립하는 이유는 **모든 간선의 가중치가 0 이상**이기 때문입니다. 음수 간선이 있으면 이 성질이 깨져서 다익스트라를 쓸 수 없습니다(그 경우엔 벨만-포드를 사용합니다).

이 그리디 선택 규칙을 효율적으로 구현하기 위해 **최소 힙(min-heap) 기반 우선순위 큐**를 사용합니다.

## 알고리즘 단계

1. 출발 노드의 거리를 0, 나머지를 ∞로 초기화
2. `(0, start)` 를 우선순위 큐에 삽입
3. 큐에서 `(d, u)`를 꺼냄
   - `d > dist[u]`이면 이미 더 짧은 경로로 처리됨 → **스킵**
   - 아니면 u의 인접 노드 v에 대해 `dist[v] > d + w` 이면 거리 갱신 후 큐 삽입
4. 큐가 빌 때까지 반복

![다익스트라 최단 경로 그래프](/assets/posts/dsa-dijkstra-graph.svg)

## Python 구현

```python
import heapq

def dijkstra(graph, start):
    # graph: {u: [(v, weight), ...]}
    dist = {v: float('inf') for v in graph}
    dist[start] = 0
    pq = [(0, start)]  # (distance, node)

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:   # 이미 처리된 노드
            continue
        for v, w in graph[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                heapq.heappush(pq, (d + w, v))

    return dist

# 사용 예
graph = {
    'A': [('B', 4), ('C', 2)],
    'B': [('D', 3), ('E', 5)],
    'C': [('D', 1), ('F', 8)],
    'D': [('E', 2), ('F', 4)],
    'E': [('F', 1)],
    'F': []
}
print(dijkstra(graph, 'A'))
# {'A': 0, 'B': 4, 'C': 2, 'D': 3, 'E': 5, 'F': 6}
```

![다익스트라 우선순위 큐 구현](/assets/posts/dsa-dijkstra-code.svg)

## 경로 추적

최단 **거리**만이 아니라 **경로**도 필요하다면 `prev` 딕셔너리를 추가합니다.

```python
def dijkstra_path(graph, start, end):
    dist = {v: float('inf') for v in graph}
    prev = {v: None for v in graph}
    dist[start] = 0
    pq = [(0, start)]

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in graph[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                prev[v] = u
                heapq.heappush(pq, (d + w, v))

    # 경로 역추적
    path, cur = [], end
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    return dist[end], list(reversed(path))

dist, path = dijkstra_path(graph, 'A', 'F')
print(dist, path)   # 6, ['A', 'C', 'D', 'E', 'F']
```

## 시간·공간 복잡도

| 구현 방식 | 시간 복잡도 | 공간 복잡도 |
|---|---|---|
| 인접 행렬 + 선형 탐색 | O(V²) | O(V²) |
| 인접 리스트 + 이진 힙 | O((V+E) log V) | O(V+E) |
| 피보나치 힙 | O(E + V log V) | O(V+E) |

실무에서는 대부분 **인접 리스트 + 이진 힙** 조합을 사용합니다. 피보나치 힙은 상수가 커서 실제로는 잘 쓰이지 않습니다.

## 주요 특성과 제약

- **음수 간선 불가**: 가중치가 모두 ≥ 0이어야 합니다
- **단일 출발점**: 여러 출발점에서 시작하려면 플로이드-워셜이나 멀티소스 BFS를 고려합니다
- **희소 그래프에 강함**: E ≪ V²인 경우 힙 기반이 훨씬 효율적입니다

## 활용 예시

```python
# 프로그래머스 / BOJ 스타일 인접 리스트 입력 처리
import sys, heapq
input = sys.stdin.readline

def solve():
    V, E = map(int, input().split())
    start = int(input())
    graph = [[] for _ in range(V + 1)]
    for _ in range(E):
        u, v, w = map(int, input().split())
        graph[u].append((v, w))

    INF = float('inf')
    dist = [INF] * (V + 1)
    dist[start] = 0
    pq = [(0, start)]

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in graph[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                heapq.heappush(pq, (dist[v], v))

    for i in range(1, V + 1):
        print(dist[i] if dist[i] < INF else "INF")
```

## 요약

다익스트라는 **그리디 + 우선순위 큐**의 아름다운 조합입니다. 핵심은 **이미 처리된 노드를 스킵하는 `d > dist[u]` 조건**으로 중복 처리를 방지하는 것입니다. 음수 가중치 없는 환경이라면 이 알고리즘 하나로 대부분의 최단 경로 문제를 해결할 수 있습니다.

---

**다음 글:** [A* 탐색 알고리즘 — 휴리스틱으로 더 빠르게](/posts/dsa-a-star-search/)

<br>
읽어주셔서 감사합니다. 😊
