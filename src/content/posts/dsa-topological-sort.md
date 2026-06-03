---
title: "위상 정렬 (Topological Sort)"
description: "DAG에서 선후 관계를 만족하는 노드 순서를 구하는 위상 정렬의 원리, Kahn(BFS) 알고리즘, DFS 기반 구현, 사이클 감지까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["위상 정렬", "Topological Sort", "DAG", "Kahn", "그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-zero-one-bfs/)에서 가중치 0/1 그래프의 최단 경로를 O(V+E)로 구하는 0-1 BFS를 다뤘습니다. 이번에는 **방향 비순환 그래프(DAG)**에서 선행 관계를 지키는 노드 순서를 구하는 **위상 정렬(Topological Sort)**을 알아봅니다.

## 위상 정렬이란

DAG에서 간선 u→v가 있으면 u는 반드시 v보다 앞에 나오는 노드 순서입니다. 강의 선수 과목, 빌드 의존성, 작업 스케줄링 등에 사용됩니다.

- **전제 조건**: 그래프가 DAG(사이클 없는 방향 그래프)여야 합니다
- **유일하지 않음**: 여러 유효한 순서가 존재할 수 있습니다

![위상 정렬 개념](/assets/posts/dsa-topological-sort-concept.svg)

## Kahn 알고리즘 (BFS 기반)

진입 차수(in-degree)가 0인 노드부터 처리합니다.

```javascript
function kahnSort(graph, V) {
  // ① 진입 차수 계산
  const indeg = new Array(V).fill(0);
  for (let u = 0; u < V; u++)
    for (const { v } of graph.adj[u])
      indeg[v]++;

  // ② in-degree 0인 노드 초기화
  const queue = [];
  for (let i = 0; i < V; i++)
    if (indeg[i] === 0) queue.push(i);

  // ③ BFS
  const order = [];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    for (const { v } of graph.adj[u])
      if (--indeg[v] === 0) queue.push(v);
  }

  // ④ 사이클 감지
  return order.length === V ? order : null; // null이면 사이클 존재
}
```

**사이클 감지**: 결과 배열 크기가 V보다 작으면 사이클이 있는 것입니다. 사이클 안의 노드들은 in-degree가 영원히 0이 되지 않아 큐에 들어오지 못합니다.

## DFS 기반 위상 정렬

완료(post-order) 시점에 결과에 추가하고 역순으로 반전합니다.

```javascript
function dfsTopoSort(graph, V) {
  const visited = new Array(V).fill(false);
  const order = [];

  function dfs(u) {
    visited[u] = true;
    for (const { v } of graph.adj[u])
      if (!visited[v]) dfs(v);
    order.push(u); // post-order
  }

  for (let i = 0; i < V; i++)
    if (!visited[i]) dfs(i);

  return order.reverse(); // 역순 = 위상 정렬 순서
}
```

![위상 정렬 구현](/assets/posts/dsa-topological-sort-impl.svg)

## 응용: 병렬 실행 레이어 계산

같은 레이어의 작업들은 동시에 실행 가능합니다. Kahn 알고리즘을 레이어 단위로 변형합니다.

```javascript
function parallelLayers(graph, V) {
  const indeg = new Array(V).fill(0);
  for (let u = 0; u < V; u++)
    for (const { v } of graph.adj[u])
      indeg[v]++;

  const layers = [];
  let currentLayer = [];
  for (let i = 0; i < V; i++)
    if (indeg[i] === 0) currentLayer.push(i);

  while (currentLayer.length) {
    layers.push([...currentLayer]);
    const nextLayer = [];
    for (const u of currentLayer)
      for (const { v } of graph.adj[u])
        if (--indeg[v] === 0) nextLayer.push(v);
    currentLayer = nextLayer;
  }
  return layers; // [[동시 실행 가능 작업들], ...]
}
```

## 응용: 과목 이수 가능 여부

LeetCode "Course Schedule" 유형: n개의 과목, prerequisites 배열이 주어질 때 모든 과목을 이수할 수 있는지 확인합니다.

```javascript
function canFinish(numCourses, prerequisites) {
  const adj = Array.from({ length: numCourses }, () => []);
  const indeg = new Array(numCourses).fill(0);

  for (const [a, b] of prerequisites) {
    adj[b].push({ v: a });
    indeg[a]++;
  }

  const queue = [];
  for (let i = 0; i < numCourses; i++)
    if (indeg[i] === 0) queue.push(i);

  let count = 0, head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    count++;
    for (const { v } of adj[u])
      if (--indeg[v] === 0) queue.push(v);
  }
  return count === numCourses; // false면 사이클 = 이수 불가
}
```

## 복잡도

| | 시간 | 공간 |
|---|---|---|
| Kahn | O(V + E) | O(V) |
| DFS 기반 | O(V + E) | O(V) |

---

**지난 글:** [0-1 BFS](/posts/dsa-zero-one-bfs/)

**다음 글:** [유니온 파인드](/posts/dsa-union-find/)

<br>
읽어주셔서 감사합니다. 😊
