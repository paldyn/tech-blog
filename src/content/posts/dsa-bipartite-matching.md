---
title: "이분 매칭(Bipartite Matching)"
description: "이분 그래프에서 최대 매칭을 구하는 헝가리안 DFS 알고리즘과 Hopcroft-Karp, König 정리(최소 버텍스 커버 = 최대 매칭), 그리고 유량으로의 환원을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["이분매칭", "BipartiteMatching", "헝가리안", "HopcroftKarp", "König정리"]
featured: false
draft: false
---

[지난 글](/posts/dsa-min-cut/)에서 최소 컷과 Max-Flow Min-Cut 정리를 다뤘습니다. 이번에는 네트워크 플로우의 대표 응용인 **이분 매칭(Bipartite Matching)**을 다룹니다. 작업-담당자 배정, 시험-감독관 매칭, 학생-프로젝트 할당 등 "양쪽을 1:1로 연결하는 최대 대응"을 구하는 문제가 모두 이분 매칭으로 풀립니다.

## 이분 그래프와 매칭

**이분 그래프**는 노드를 두 집합 L, R로 분리할 수 있고, 간선이 오직 L-R 사이에만 존재하는 그래프입니다. **매칭**은 각 노드가 최대 하나의 간선에만 포함되는 간선 집합이고, **최대 매칭**은 그 크기가 최대인 매칭입니다.

![이분 매칭 — 증가 경로](/assets/posts/dsa-bipartite-matching-augment.svg)

## 증가 경로(Augmenting Path)

매칭을 늘리는 핵심 개념은 **증가 경로**입니다. 비매칭 L 노드에서 시작해 비매칭 간선 → 매칭 간선 → 비매칭 간선 → ... 형태로 번갈아 따라가다 비매칭 R 노드에 도달하는 경로입니다. 이 경로를 찾으면 매칭/비매칭을 뒤집어 매칭 크기를 1 늘릴 수 있습니다.

**Berge의 정리**: 더 이상 증가 경로가 없으면 매칭이 최대입니다.

## 헝가리안 알고리즘 (DFS)

각 L 노드에서 DFS로 증가 경로를 탐색합니다. visited 배열로 같은 R 노드를 두 번 방문하지 않게 하고, R 노드에 이미 매칭이 있으면 그 L 노드를 재귀적으로 재배치 시도합니다.

```cpp
bool dfs(int u) {
    for (int v : adj[u]) {
        if (!visited[v]) {
            visited[v] = true;
            // v가 미매칭이거나, v의 현재 파트너를 다른 곳에 배치 가능
            if (matchR[v] == -1 || dfs(matchR[v])) {
                matchL[u] = v;
                matchR[v] = u;
                return true;
            }
        }
    }
    return false;
}

int maxMatching() {
    fill(matchL, matchL + L, -1);
    fill(matchR, matchR + R, -1);
    int ans = 0;
    for (int u = 0; u < L; u++) {
        fill(visited, visited + R, false);
        if (dfs(u)) ans++;
    }
    return ans;
}
```

복잡도는 O(VE)입니다. L의 각 노드마다 최대 E번 탐색합니다.

![이분 매칭 구현과 복잡도](/assets/posts/dsa-bipartite-matching-code.svg)

## Hopcroft-Karp 알고리즘

헝가리안의 O(VE)를 **O(E√V)**로 개선합니다. BFS로 최단 증가 경로들의 레이어를 구성하고, DFS로 서로 겹치지 않는 증가 경로를 한 번에 여러 개 처리합니다. 이분 그래프에서 단계 수가 O(√V)로 제한되기 때문입니다.

```python
def hopcroft_karp():
    while bfs():   # O(E) — BFS로 최단 레이어 구성
        for u in L:
            if matchL[u] == -1:
                dfs(u)   # O(E) total — 포화 경로 제외
    # 총 O(E√V)
```

## König의 정리

이분 그래프에서 **최대 매칭 크기 = 최소 버텍스 커버 크기**입니다. 최소 버텍스 커버는 모든 간선에 적어도 하나의 끝점이 포함되는 최소 노드 집합입니다.

```
최대 매칭 = M
최소 버텍스 커버 = |M|
최대 독립 집합 = V - |M|
```

최소 버텍스 커버 복원: 매칭 완료 후 비매칭 L 노드에서 교대 경로로 도달 가능한 노드 집합 Z를 구하면, `(L \ Z_L) ∪ (R ∩ Z_R)`이 최소 버텍스 커버입니다.

## 유량으로의 환원

s → L 노드 (용량 1), L → R 간선 (용량 1), R 노드 → t (용량 1)로 구성하면 Dinic 알고리즘으로 최대 유량 = 최대 매칭을 구할 수 있습니다. 이 경우 Dinic의 이분 그래프 복잡도 O(E√V)를 자동으로 달성합니다.

## 응용

| 문제 유형 | 모델링 |
|---|---|
| 작업-담당자 배정 | L=작업, R=담당자, 가능 간선 연결 |
| 기숙사-학생 배정 | L=학생, R=방, 지원 간선 연결 |
| 최소 경로 커버 (DAG) | L=노드 출발, R=노드 도착, 간선 연결 |
| 최대 독립 집합 | V − 최대 매칭 (König) |

---

**지난 글:** [최소 컷(Min-Cut)과 최대 유량-최소 컷 정리](/posts/dsa-min-cut/)

**다음 글:** [LCA — 이진 리프팅(Binary Lifting)](/posts/dsa-lca-binary-lifting/)

<br>
읽어주셔서 감사합니다. 😊
