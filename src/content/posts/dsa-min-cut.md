---
title: "최소 컷(Min-Cut)과 최대 유량-최소 컷 정리"
description: "네트워크를 S·T 두 집합으로 나누는 최소 컷의 개념, Max-Flow Min-Cut 정리 증명, Dinic 완료 후 컷 복원 방법, 프로젝트 선택·이미지 분할 등 주요 응용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["최소컷", "MinCut", "MaxFlow", "네트워크플로우", "프로젝트선택"]
featured: false
draft: false
---

[지난 글](/posts/dsa-max-flow-dinic/)에서 Dinic 알고리즘으로 최대 유량을 O(V²E)에 구하는 방법을 살펴봤습니다. 이번에는 최대 유량과 쌍대(dual) 관계에 있는 **최소 컷(Min-Cut)**을 다룹니다. "최대 유량 = 최소 컷 용량"이라는 정리는 네트워크 플로우 이론의 핵심이며, 이를 응용하면 프로젝트 선택, 이미지 분할, 네트워크 신뢰성 등 폭넓은 문제를 해결할 수 있습니다.

## 컷(Cut)이란

**s-t 컷**은 노드 집합 V를 s를 포함하는 집합 S와 t를 포함하는 집합 T로 나눈 것입니다. 컷 용량은 S → T 방향(앞방향)으로 가는 간선의 용량 합입니다. T → S 방향(역방향) 간선은 컷 용량에 포함되지 않습니다.

$$\text{cap}(S, T) = \sum_{u \in S,\, v \in T} c(u, v)$$

![최대 유량-최소 컷 정리 시각화](/assets/posts/dsa-min-cut-theorem.svg)

## Max-Flow Min-Cut 정리

**최대 유량 = 최소 컷 용량**

### 직관적 이해

어떤 컷도 s → t 경로를 막으려면 컷 간선 전체를 제거해야 합니다. 따라서 유량이 컷 용량을 초과할 수 없고(`flow ≤ cut`), 최대 유량은 최소 컷 용량에 의해 위에서 제한됩니다.

반대로, 증가 경로가 없어진 시점(최대 유량 도달)에서 잔여 그래프에서 s에 도달 가능한 노드 집합 S를 취하면, S → T 방향 간선이 모두 포화된 컷이 됩니다. 이 컷의 용량이 최대 유량과 정확히 일치합니다.

### 형식적 증명 요약

1. **flow ≤ cut**: 유량 보존 원리에 의해 s를 출발한 유량은 모두 컷 간선을 통과해야 함
2. **최대 유량 시 flow = cut**: 잔여 그래프에서 s 도달 가능 집합 S를 취하면, 그 경계 간선이 모두 포화 → 컷 용량 = 유량

## 최소 컷 복원

Dinic 완료 후 잔여 그래프에서 BFS/DFS로 s에서 도달 가능한 노드 집합 S를 구합니다.

```cpp
vector<bool> findSSet(int s) {
    vector<bool> vis(V, false);
    queue<int> q;
    vis[s] = true;
    q.push(s);
    while (!q.empty()) {
        int v = q.front(); q.pop();
        for (auto& e : graph[v]) {
            // 잔여 용량 > 0인 간선만 따라감
            if (e.cap > 0 && !vis[e.to]) {
                vis[e.to] = true;
                q.push(e.to);
            }
        }
    }
    return vis; // vis[v]=true → S 집합
}
// 컷 간선: vis[u]=true, vis[v]=false인 원래 간선
```

`vis[u] = true`이고 `vis[v] = false`인 원래 그래프 간선 (u, v)가 바로 최소 컷에 포함되는 간선입니다.

![최소 컷 복원과 대표 응용](/assets/posts/dsa-min-cut-applications.svg)

## 응용: 프로젝트 선택 (Closure Problem)

이익이 있는 프로젝트와 비용이 드는 장비를 선택해 순이익을 최대화하는 문제입니다.

- 이익 프로젝트 p: `s → p` 간선 용량 = profit(p)
- 비용 장비 q: `q → t` 간선 용량 = cost(q)
- 의존성 (p → q): `p → q` 간선 용량 = ∞ (프로젝트 p를 하려면 장비 q 필요)

최대 순이익 = 전체 이익 합 − 최소 컷 용량

컷에 포함되는 s → p 간선 = 포기한 이익, 컷에 포함되는 q → t 간선 = 지불하는 비용입니다.

```python
total_profit = sum(profit[p] for p in projects)
max_net = total_profit - dinic(s, t)
```

## 응용: 최소 노드 컷 (Vertex Connectivity)

간선 컷이 아니라 노드를 제거해 s-t를 차단하는 최소 노드 컷을 구할 때, 각 노드를 in/out 두 노드로 분리하고 in→out 간선 용량 = 1로 설정합니다. 간선은 out→in 방향으로 용량 ∞로 연결합니다.

```text
노드 v → v_in, v_out (용량 1)
간선 (u,v) → (u_out → v_in) 용량 ∞
```

## 복잡도

최소 컷 복원은 Dinic 실행 후 O(V + E) BFS 한 번이므로 전체 복잡도는 Dinic과 동일합니다.

---

**지난 글:** [최대 유량 — 디닉(Dinic) 알고리즘](/posts/dsa-max-flow-dinic/)

**다음 글:** [이분 매칭(Bipartite Matching)](/posts/dsa-bipartite-matching/)

<br>
읽어주셔서 감사합니다. 😊
