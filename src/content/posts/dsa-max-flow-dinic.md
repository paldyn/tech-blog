---
title: "최대 유량 — 디닉(Dinic) 알고리즘"
description: "BFS 레벨 그래프와 DFS 블로킹 플로우를 조합한 Dinic 알고리즘의 O(V²E) 복잡도, 구현 패턴, 이분 매칭에서의 O(E√V) 특수 성능을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["Dinic", "최대유량", "레벨그래프", "블로킹플로우", "네트워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/dsa-max-flow-ford-fulkerson/)에서 포드-풀커슨(Ford-Fulkerson)과 Edmonds-Karp를 통해 최대 유량의 핵심 원리인 증가 경로와 잔여 그래프를 살펴봤습니다. 이번 글에서는 **Dinic 알고리즘**을 다룹니다. Dinic은 BFS로 레벨 그래프를 구성하고 DFS로 블로킹 플로우를 한 번에 흘려 Edmonds-Karp(O(VE²))보다 빠른 **O(V²E)**를 달성합니다.

## 핵심 아이디어

Edmonds-Karp는 BFS로 증가 경로를 하나씩 찾습니다. Dinic은 한 걸음 더 나아가 BFS를 통해 그래프를 **레벨별 계층**으로 나누고, 그 레벨 그래프 위에서 **블로킹 플로우 전체**를 한 번에 흘립니다. 블로킹 플로우가 완료되면 레벨이 최소 1 증가하므로 반복 횟수가 최대 V번으로 제한됩니다.

![Dinic 알고리즘 레벨 그래프](/assets/posts/dsa-max-flow-dinic-level-graph.svg)

## 레벨 그래프

BFS로 소스 s에서 각 노드까지의 최단 거리(hop 수)를 `level[]`에 기록합니다. **유효 간선**은 `level[v] == level[u] + 1`을 만족하는 간선만 남기고, 레벨을 건너뛰거나 역방향으로 가는 간선은 블로킹 플로우 단계에서 완전히 무시합니다.

```cpp
bool bfs(int s, int t) {
    fill(level, level + V, -1);
    queue<int> q;
    level[s] = 0;
    q.push(s);
    while (!q.empty()) {
        int v = q.front(); q.pop();
        for (auto& e : graph[v]) {
            if (e.cap > 0 && level[e.to] < 0) {
                level[e.to] = level[v] + 1;
                q.push(e.to);
            }
        }
    }
    return level[t] >= 0; // t에 도달 가능한지 반환
}
```

## 블로킹 플로우 (DFS + iter 최적화)

블로킹 플로우 탐색에서 핵심 최적화는 **iter[] 배열**입니다. 각 노드에서 다음에 검사할 간선의 인덱스를 기록해, 이미 포화된 간선을 다시 탐색하지 않습니다. 이를 "현재 호 최적화(current arc optimization)"라 부릅니다.

```cpp
int dfs(int v, int t, int f) {
    if (v == t) return f;
    for (int& i = iter[v]; i < graph[v].size(); i++) {
        Edge& e = graph[v][i];
        if (e.cap > 0 && level[v] < level[e.to]) {
            int d = dfs(e.to, t, min(f, e.cap));
            if (d > 0) {
                e.cap -= d;
                graph[e.to][e.rev].cap += d;
                return d;
            }
        }
    }
    return 0;
}
```

포화된 간선에 도달하면 iter[v]를 증가시켜 다음 간선으로 넘어갑니다. 한 번 버린 간선은 같은 BFS 단계 내에서 다시 보지 않습니다.

## 전체 알고리즘

```cpp
int dinic(int s, int t) {
    int flow = 0;
    while (bfs(s, t)) {          // BFS로 레벨 그래프 구성
        fill(iter, iter + V, 0); // iter 초기화
        int d;
        while ((d = dfs(s, t, INT_MAX)) > 0)
            flow += d;           // 블로킹 플로우 소진
    }
    return flow;
}
```

![Dinic 알고리즘 단계별 흐름과 복잡도](/assets/posts/dsa-max-flow-dinic-complexity.svg)

## 복잡도 분석

| 구분 | 복잡도 | 이유 |
|---|---|---|
| BFS 단계 횟수 | O(V) | 블로킹 플로우 후 레벨 최소 +1 |
| 블로킹 플로우 1회 | O(VE) | iter 최적화로 각 간선 최대 V번 |
| **전체** | **O(V²E)** | — |
| 이분 그래프 | **O(E√V)** | 레벨 수가 O(√V)로 제한 |
| 단위 용량 그래프 | **O(E√E)** | — |

Edmonds-Karp의 O(VE²)에 비해 실전에서 압도적으로 빠르며, 이분 매칭을 포함한 다수의 문제에서 사실상 표준으로 사용됩니다.

## 이분 그래프에서의 Dinic

이분 매칭 문제를 `s → 좌측 → 우측 → t` 형태로 변환하면 모든 용량이 1이 됩니다. 이때 레벨 수가 O(√V)로 줄어들어 전체 복잡도가 **O(E√V)**가 됩니다. 일반 이분 매칭의 Hopcroft-Karp와 동일한 복잡도를 자동으로 달성합니다.

```cpp
// 이분 매칭을 유량으로
// 소스에서 좌측 노드로 용량 1
// 좌측→우측 간선 용량 1
// 우측에서 싱크로 용량 1
// dinic(s, t) = 최대 매칭 수
```

## 구현 팁

- 역방향 간선 관리: `graph[v]`에 `{to, cap, rev}` 구조체를 저장하고 `rev`는 역방향 인덱스
- 용량 0 간선도 저장해 역방향 추적 가능하게 유지
- 멀티소스/멀티싱크: 슈퍼소스 s', 슈퍼싱크 t' 추가 후 동일 알고리즘 적용
- 최소 컷: Dinic 완료 후 BFS에서 level[v] >= 0인 노드 집합이 s 측 컷

---

**지난 글:** [최대 유량 — 포드-풀커슨(Ford-Fulkerson) 알고리즘](/posts/dsa-max-flow-ford-fulkerson/)

**다음 글:** [최소 컷(Min-Cut)과 최대 유량-최소 컷 정리](/posts/dsa-min-cut/)

<br>
읽어주셔서 감사합니다. 😊
