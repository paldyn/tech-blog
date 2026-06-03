---
title: "그래프 DFS (깊이 우선 탐색)"
description: "재귀·스택으로 그래프를 깊이 우선 탐색하는 DFS의 동작 원리, in/out 타임스탬프, 방향 그래프 사이클 감지, 위상 정렬 기반까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["DFS", "깊이 우선 탐색", "사이클 감지", "그래프", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-graph-bfs/)에서 BFS로 최단 경로를 구하는 방법을 다뤘습니다. 이번에는 **깊이 우선 탐색(Depth-First Search, DFS)**를 살펴봅니다. DFS는 한 방향으로 끝까지 파고들었다 돌아오는 방식으로, 사이클 감지, 위상 정렬, SCC 등 다양한 알고리즘의 기반이 됩니다.

## 동작 원리

현재 정점에서 방문하지 않은 이웃을 재귀적으로 방문합니다. 더 이상 갈 곳이 없으면 백트래킹합니다.

- **in-time**: 정점을 처음 방문하는 시점
- **out-time**: 정점의 모든 서브트리 탐색이 완료되는 시점

out-time 역순 = **위상 정렬 순서**입니다.

![DFS 탐색 과정](/assets/posts/dsa-graph-dfs-process.svg)

## 기본 구현

```javascript
function dfs(graph, V) {
  const visited = new Array(V).fill(false);

  function visit(u) {
    visited[u] = true;
    console.log('방문:', u);
    for (const { v } of graph.adj[u]) {
      if (!visited[v]) visit(v);
    }
    console.log('완료:', u); // post-order
  }

  for (let i = 0; i < V; i++)
    if (!visited[i]) visit(i);
}
```

## 방향 그래프 사이클 감지

무방향 그래프는 방문 여부만 체크하면 되지만, **방향 그래프에서는 3색 상태**가 필요합니다.

- `0` (WHITE): 미방문
- `1` (GRAY): 현재 DFS 경로에 있음
- `2` (BLACK): 완전히 처리됨

GRAY 정점으로 향하는 간선 = **back edge = 사이클** 증거입니다.

```javascript
const state = new Array(V).fill(0); // 0=미방문, 1=경로중, 2=완료
let hasCycle = false;

function dfs(u) {
  state[u] = 1;
  for (const { v } of graph.adj[u]) {
    if (state[v] === 1) { hasCycle = true; return; }
    if (state[v] === 0) dfs(v);
  }
  state[u] = 2;
}
for (let i = 0; i < V; i++)
  if (state[i] === 0) dfs(i);
```

![DFS 구현](/assets/posts/dsa-graph-dfs-impl.svg)

## 위상 정렬 (DFS 기반)

완료 시점(post-order)에 스택에 쌓고 역순으로 꺼내면 위상 정렬 순서가 됩니다.

```javascript
const order = [];
const visited = new Array(V).fill(false);

function dfsTopoSort(u) {
  visited[u] = true;
  for (const { v } of graph.adj[u])
    if (!visited[v]) dfsTopoSort(v);
  order.push(u); // post-order
}

for (let i = 0; i < V; i++)
  if (!visited[i]) dfsTopoSort(i);

order.reverse(); // 위상 정렬 순서
```

## 연결 컴포넌트 분류

```javascript
const comp = new Array(V).fill(-1);
let numComp = 0;

function dfsComp(u, c) {
  comp[u] = c;
  for (const { v } of graph.adj[u])
    if (comp[v] === -1) dfsComp(v, c);
}

for (let i = 0; i < V; i++)
  if (comp[i] === -1) dfsComp(i, numComp++);
// comp[i]: 정점 i가 속한 컴포넌트 번호
```

## in/out 타임스탬프 활용

```javascript
let timer = 0;
const tin = [], tout = [];

function dfsTimestamp(u) {
  tin[u] = timer++;
  for (const { v } of graph.adj[u])
    if (!visited[v]) dfsTimestamp(v);
  tout[u] = timer++;
}
// u가 v의 조상: tin[u] <= tin[v] && tout[v] <= tout[u]
```

이 성질로 **트리에서 조상-자손 관계를 O(1)로 판별**할 수 있습니다.

## 재귀 vs 반복 DFS

| | 재귀 | 반복 (스택 명시) |
|---|---|---|
| 코드 | 간결 | 길지만 명확 |
| 스택 오버플로 | V 크면 위험 | 없음 |
| post-order | 자연스러움 | 별도 처리 필요 |

V가 수십만 이상이면 반복 DFS를 쓰거나, 언어에 따라 재귀 한도를 늘려야 합니다 (Python: `sys.setrecursionlimit`).

## 복잡도

| | 시간 | 공간 |
|---|---|---|
| DFS | O(V + E) | O(V) (재귀 스택) |

---

**지난 글:** [그래프 BFS](/posts/dsa-graph-bfs/)

**다음 글:** [다중 소스 BFS](/posts/dsa-multi-source-bfs/)

<br>
읽어주셔서 감사합니다. 😊
