---
title: "유니온 파인드 (Disjoint Set Union)"
description: "경로 압축과 랭크 합치기로 O(α(n))에 집합 연산을 처리하는 유니온 파인드의 구조, 구현, 크루스칼 MST 응용까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["유니온 파인드", "Union Find", "DSU", "Disjoint Set", "크루스칼"]
featured: false
draft: false
---

[지난 글](/posts/dsa-topological-sort/)에서 DAG의 선후 관계를 정렬하는 위상 정렬을 다뤘습니다. 이번에는 **동적으로 집합을 합치고 연결 여부를 판단**하는 **유니온 파인드(Union-Find / Disjoint Set Union)**를 알아봅니다. 크루스칼 MST, 연결 컴포넌트 추적, 사이클 감지 등 다양한 알고리즘의 핵심 서브루틴입니다.

## 핵심 연산

- **find(x)**: x가 속한 집합의 루트(대표 원소) 반환
- **union(x, y)**: x와 y가 속한 두 집합을 합침
- **connected(x, y)**: x와 y가 같은 집합인지 확인

초기에는 각 원소가 자기 자신을 루트로 하는 독립 집합입니다.

## 두 가지 최적화

### ① 경로 압축 (Path Compression)

`find(x)` 호출 시 경로 상의 모든 노드가 루트를 직접 가리키도록 합니다.

```javascript
find(x) {
  if (this.parent[x] !== x)
    this.parent[x] = this.find(this.parent[x]); // 재귀적 압축
  return this.parent[x];
}
```

이후 같은 경로의 `find` 호출은 O(1)입니다.

### ② 랭크 합치기 (Union by Rank)

작은 트리를 큰 트리 아래에 붙여 트리 높이를 O(log n)으로 제한합니다.

```javascript
union(x, y) {
  const rx = this.find(x), ry = this.find(y);
  if (rx === ry) return false; // 이미 같은 집합

  if (this.rank[rx] < this.rank[ry])      this.parent[rx] = ry;
  else if (this.rank[rx] > this.rank[ry]) this.parent[ry] = rx;
  else { this.parent[ry] = rx; this.rank[rx]++; }

  this.comp--;
  return true; // 새로 합쳐짐
}
```

![유니온 파인드 구조](/assets/posts/dsa-union-find-structure.svg)

## 완성 구현

```javascript
class DSU {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
    this.comp = n; // 연결 컴포넌트 수
  }

  find(x) {
    if (this.parent[x] !== x)
      this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return false;
    if (this.rank[rx] < this.rank[ry])      this.parent[rx] = ry;
    else if (this.rank[rx] > this.rank[ry]) this.parent[ry] = rx;
    else { this.parent[ry] = rx; this.rank[rx]++; }
    this.comp--;
    return true;
  }

  connected(x, y) { return this.find(x) === this.find(y); }
}
```

![유니온 파인드 구현](/assets/posts/dsa-union-find-impl.svg)

## 복잡도

| 최적화 | find | union |
|---|---|---|
| 없음 | O(n) | O(n) |
| 경로 압축만 | O(log n) amortized | O(log n) |
| 랭크만 | O(log n) | O(log n) |
| **둘 다** | **O(α(n))** | **O(α(n))** |

α(n)은 역아커만 함수로, n이 우주의 원자 수보다 커도 5 이하입니다. 실질적으로 **O(1)**로 볼 수 있습니다.

## 응용: 크루스칼 MST

모든 간선을 가중치 순으로 정렬하고, 사이클을 만들지 않는(= union이 true를 반환하는) 간선만 선택합니다.

```javascript
function kruskalMST(V, edges) {
  edges.sort((a, b) => a[2] - b[2]); // 가중치 오름차순
  const dsu = new DSU(V);
  let totalWeight = 0;
  const mstEdges = [];

  for (const [u, v, w] of edges) {
    if (dsu.union(u, v)) {  // 사이클 아니면 선택
      mstEdges.push([u, v, w]);
      totalWeight += w;
      if (mstEdges.length === V - 1) break; // MST 완성
    }
  }
  return { mstEdges, totalWeight };
}
```

## 응용: 무방향 그래프 사이클 감지

간선을 추가할 때 `union`이 `false`를 반환하면 이미 같은 컴포넌트 → 사이클입니다.

```javascript
function hasCycle(V, edges) {
  const dsu = new DSU(V);
  for (const [u, v] of edges)
    if (!dsu.union(u, v)) return true; // 사이클 발견
  return false;
}
```

## 응용: 연결 컴포넌트 수

```javascript
const dsu = new DSU(n);
for (const [u, v] of connections)
  dsu.union(u, v);
console.log(dsu.comp); // 연결 컴포넌트 수
```

---

**지난 글:** [위상 정렬](/posts/dsa-topological-sort/)

**다음 글:** [다익스트라 알고리즘](/posts/dsa-dijkstra/)

<br>
읽어주셔서 감사합니다. 😊
