---
title: "그래프 표현 방식 (인접 행렬 · 인접 리스트 · 엣지 리스트)"
description: "그래프를 코드로 나타내는 세 가지 방법의 공간·시간 트레이드오프를 분석하고, 각 방식이 적합한 알고리즘 상황을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["그래프", "인접 행렬", "인접 리스트", "엣지 리스트", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-sparse-table/)에서 정적 배열의 구간 쿼리를 O(1)로 처리하는 희소 테이블을 다뤘습니다. 이제부터는 그래프 알고리즘 시리즈를 시작합니다. 첫 번째로 **그래프를 메모리에 어떻게 저장하느냐**는 이후의 모든 그래프 알고리즘 구현에 영향을 미치는 기초 선택입니다.

## 그래프란

정점(Vertex)과 간선(Edge)으로 이루어진 자료구조입니다. 방향 그래프(directed)와 무방향 그래프(undirected), 가중치 그래프(weighted)와 비가중치 그래프로 나뉩니다.

- **V**: 정점 수, **E**: 간선 수
- 희소 그래프(sparse): E ≪ V², 밀집 그래프(dense): E ≈ V²

## 세 가지 표현 방식

![그래프 표현 방식 비교](/assets/posts/dsa-graph-representation-types.svg)

### ① 인접 행렬 (Adjacency Matrix)

V×V 2차원 배열 `matrix[u][v]`에 간선 가중치(또는 0/1)를 저장합니다.

```javascript
const matrix = Array.from({ length: V }, () => new Array(V).fill(0));

// 방향 간선 u→v (가중치 w)
matrix[u][v] = w;

// 무방향이면 양쪽 저장
matrix[u][v] = matrix[v][u] = w;

// 간선 존재 확인 O(1)
if (matrix[u][v] !== 0) { /* 간선 있음 */ }
```

- **공간**: O(V²) — V=10,000이면 10⁸ 셀 (메모리 위험)
- **간선 확인**: O(1)
- **이웃 순회**: O(V) — 희소 그래프에서 비효율

### ② 인접 리스트 (Adjacency List)

각 정점마다 연결된 이웃 목록을 배열로 저장합니다. 가장 범용적인 방식입니다.

```javascript
class Graph {
  constructor(V) {
    this.adj = Array.from({ length: V }, () => []);
  }
  // 방향 간선 u→v, 가중치 w
  addEdge(u, v, w = 1) {
    this.adj[u].push({ v, w });
  }
  // 무방향이면 역방향도 추가
  addUndirected(u, v, w = 1) {
    this.adj[u].push({ v, w });
    this.adj[v].push({ v: u, w });
  }
}
```

- **공간**: O(V + E)
- **이웃 순회**: O(degree) — BFS/DFS에 최적
- **간선 확인**: O(degree) — 행렬보다 느림

### ③ 엣지 리스트 (Edge List)

모든 간선을 `[src, dst, weight]` 튜플 배열로 저장합니다.

```javascript
const edges = [
  [0, 1, 5],
  [0, 2, 3],
  [1, 3, 2],
  [2, 3, 4],
];
```

- **공간**: O(E)
- **간선 정렬**: 자연스럽게 O(E log E) — 크루스칼 MST에 적합
- **이웃 순회**: O(E) — BFS/DFS에 부적합

![그래프 표현 구현](/assets/posts/dsa-graph-representation-impl.svg)

## 선택 기준

| 상황 | 권장 표현 |
|---|---|
| BFS, DFS, 다익스트라 | 인접 리스트 |
| 플로이드-워셜 (V² 접근 필수) | 인접 행렬 |
| 크루스칼 MST (간선 정렬 필요) | 엣지 리스트 |
| 밀집 그래프 (V 작음, 간선 많음) | 인접 행렬 |
| 희소 그래프 (일반적 상황) | 인접 리스트 |

## 정점 번호 매핑

정점이 문자열이나 좌표라면 Map으로 번호를 부여합니다.

```javascript
const id = new Map();
function nodeId(label) {
  if (!id.has(label)) id.set(label, id.size);
  return id.get(label);
}

// "Seoul" → 0, "Busan" → 1, ...
const g = new Graph(cities.length);
g.addEdge(nodeId("Seoul"), nodeId("Busan"), 325);
```

## 다음 단계

그래프를 어떻게 저장하는지 결정됐으면, 이를 탐색하는 방법이 필요합니다. 다음 글에서는 **너비 우선 탐색(BFS)**으로 최단 경로를 구하는 방법을 다룹니다.

---

**지난 글:** [희소 테이블](/posts/dsa-sparse-table/)

**다음 글:** [그래프 BFS](/posts/dsa-graph-bfs/)

<br>
읽어주셔서 감사합니다. 😊
