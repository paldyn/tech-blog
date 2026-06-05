---
title: "LCA — 이진 리프팅(Binary Lifting)"
description: "트리에서 두 노드의 최소 공통 조상(LCA)을 O(N log N) 전처리, O(log N) 쿼리로 구하는 이진 리프팅 원리, up 테이블 구성, 쿼리 처리, 트리 거리 계산까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["LCA", "최소공통조상", "이진리프팅", "BinaryLifting", "트리"]
featured: false
draft: false
---

[지난 글](/posts/dsa-bipartite-matching/)에서 이분 매칭을 다뤘습니다. 이번에는 트리 알고리즘의 핵심 테크닉인 **LCA(Lowest Common Ancestor, 최소 공통 조상)**를 다룹니다. 두 노드 u, v의 LCA는 u와 v를 모두 자손으로 갖는 노드 중 가장 깊은 노드입니다. 이진 리프팅은 전처리 O(N log N), 쿼리 O(log N)으로 대용량 쿼리를 효율적으로 처리합니다.

## 핵심 아이디어: 이진 점프 테이블

`up[v][k]` = 노드 v의 2^k번째 조상을 저장하는 테이블입니다.

- `up[v][0]` = v의 부모 (1칸 위)
- `up[v][1]` = v의 조부모 (2칸 위) = `up[up[v][0]][0]`
- `up[v][k]` = `up[up[v][k-1]][k-1]` (점화식)

이 테이블을 미리 채워두면 임의의 k칸을 이진수 분해로 O(log N)에 올라갈 수 있습니다.

![LCA 이진 리프팅 테이블](/assets/posts/dsa-lca-binary-lifting-table.svg)

## 전처리: DFS로 테이블 구성

```cpp
const int LOG = 18; // 2^18 > 2*10^5
int up[MAXN][LOG], depth[MAXN];

void dfs(int v, int p, int d) {
    up[v][0] = p;
    depth[v] = d;
    for (int k = 1; k < LOG; k++)
        up[v][k] = up[up[v][k-1]][k-1];
    for (int u : adj[v])
        if (u != p) dfs(u, v, d + 1);
}
// 루트: dfs(root, root, 0);
// up[root][k] = root (루트의 조상은 자기 자신)
```

전처리 복잡도: O(N log N) — N개 노드 × LOG 단계.

## 쿼리: O(log N)

LCA를 구하는 과정은 세 단계입니다.

1. **깊이 맞추기**: depth[u] > depth[v]면 u를 위로 올려 같은 깊이로 만듦
2. **함께 올리기**: 두 노드가 같아질 때까지 함께 올리되, LCA가 되는 순간은 건너뜀
3. **LCA 확정**: 마지막으로 한 칸 더 올리면 LCA

![LCA 쿼리 처리 O(log N)](/assets/posts/dsa-lca-binary-lifting-query.svg)

## 트리 위 두 노드 간 거리

LCA를 구하면 트리 거리도 O(log N)에 계산됩니다.

```cpp
int dist(int u, int v) {
    int l = lca(u, v);
    return depth[u] + depth[v] - 2 * depth[l];
}
```

## k번째 조상

이진 리프팅 테이블을 쓰면 "v의 k번째 조상" 쿼리도 O(log N)입니다.

```cpp
int kthAncestor(int v, int k) {
    for (int i = LOG - 1; i >= 0; i--)
        if ((k >> i) & 1) v = up[v][i];
    return v;
}
```

## 경로 위 집계값 (Weighted LCA)

간선에 가중치가 있을 때 경로 합을 구하려면 `up[][]` 대신 경로 집계값(최솟값, XOR 등)을 저장하는 추가 테이블을 유지합니다.

```cpp
int minVal[MAXN][LOG]; // 경로 위 최솟값
// minVal[v][k] = v에서 2^k 위까지 경로의 최솟값
// minVal[v][k] = min(minVal[v][k-1], minVal[up[v][k-1]][k-1])
```

## 복잡도 비교

| 방법 | 전처리 | 쿼리 | 특징 |
|---|---|---|---|
| 순진한 DFS | O(1) | O(N) | 구현 간단, 쿼리 느림 |
| **이진 리프팅** | **O(N log N)** | **O(log N)** | 가장 범용적 |
| 오일러 투어 + 세그트리 | O(N log N) | O(log N) | 구현 복잡 |
| 파르침 + 블록 분해 | O(N) | O(1) | ±1 RMQ 필요 |

이진 리프팅은 구현이 단순하고 k번째 조상·경로 집계까지 확장하기 쉬워 CP에서 가장 널리 쓰입니다.

---

**지난 글:** [이분 매칭(Bipartite Matching)](/posts/dsa-bipartite-matching/)

**다음 글:** [버블 정렬(Bubble Sort)](/posts/dsa-bubble-sort/)

<br>
읽어주셔서 감사합니다. 😊
