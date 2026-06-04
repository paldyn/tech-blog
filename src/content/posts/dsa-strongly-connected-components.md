---
title: "강한 연결 요소(SCC) — 코사라주와 타잔 알고리즘"
description: "방향 그래프에서 서로 도달 가능한 노드 집합인 SCC를 DFS 2회의 코사라주와 DFS 1회의 타잔 알고리즘으로 O(V+E)에 구하는 방법을 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["SCC", "강한연결요소", "코사라주", "타잔", "방향그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-mst-prim/)에서 무방향 그래프의 MST를 구하는 프림을 배웠습니다. 이번에는 **방향 그래프(Directed Graph)** 에서 핵심 구조인 **강한 연결 요소(SCC, Strongly Connected Component)**를 찾는 알고리즘을 다룹니다. SCC는 **서로 양방향으로 도달 가능한 노드들의 최대 집합**입니다. 웹 페이지 링크 분석, 컴파일러의 순환 의존성 탐지, 게임 맵의 폐쇄 구역 분석 등에 활용됩니다.

## SCC란?

방향 그래프에서 두 노드 u, v가 **u → v 경로와 v → u 경로가 모두 존재**할 때 같은 SCC에 속합니다.

모든 SCC를 하나의 노드로 축소하면 **압축 그래프(Condensation Graph)**가 만들어지는데, 이는 항상 **DAG(사이클 없는 방향 그래프)**입니다.

![SCC 구조와 압축 그래프](/assets/posts/dsa-scc-graph.svg)

## 코사라주(Kosaraju) 알고리즘

가장 직관적인 방법입니다.

1. **1단계**: 원래 그래프에서 DFS 수행, 노드 종료 순서를 스택에 기록
2. **2단계**: 그래프의 **역방향(transpose)** 에서 스택에서 꺼내는 순서대로 DFS — 각 DFS가 탐색하는 노드가 하나의 SCC

```python
from collections import defaultdict

def kosaraju(n, adj):
    # 역방향 그래프 구성
    radj = defaultdict(list)
    for u in adj:
        for v in adj[u]:
            radj[v].append(u)

    # 1단계: 종료 순서 스택
    visited = [False] * n
    order = []

    def dfs1(v):
        visited[v] = True
        for w in adj[v]:
            if not visited[w]:
                dfs1(w)
        order.append(v)

    for v in range(n):
        if not visited[v]:
            dfs1(v)

    # 2단계: 역방향 그래프 DFS
    visited2 = [False] * n
    sccs = []

    def dfs2(v, comp):
        visited2[v] = True
        comp.append(v)
        for w in radj[v]:
            if not visited2[w]:
                dfs2(w, comp)

    for v in reversed(order):
        if not visited2[v]:
            comp = []
            dfs2(v, comp)
            sccs.append(comp)

    return sccs
```

## 타잔(Tarjan) 알고리즘

DFS **한 번**으로 SCC를 모두 찾습니다. 각 노드에 `disc`(발견 시각)와 `low`(도달 가능한 최소 disc)를 부여하고, `low[u] == disc[u]`이면 u가 SCC의 루트입니다.

```python
def tarjan(n, graph):
    disc = [-1] * n
    low = [-1] * n
    on_stack = [False] * n
    stack = []
    timer = [0]
    sccs = []

    def dfs(u):
        disc[u] = low[u] = timer[0]
        timer[0] += 1
        stack.append(u)
        on_stack[u] = True

        for v in graph[u]:
            if disc[v] == -1:
                dfs(v)
                low[u] = min(low[u], low[v])
            elif on_stack[v]:
                low[u] = min(low[u], disc[v])

        # SCC 루트: low[u] == disc[u]
        if low[u] == disc[u]:
            scc = []
            while True:
                w = stack.pop()
                on_stack[w] = False
                scc.append(w)
                if w == u:
                    break
            sccs.append(scc)

    for v in range(n):
        if disc[v] == -1:
            dfs(v)

    return sccs
```

![코사라주 vs 타잔 코드 비교](/assets/posts/dsa-scc-kosaraju.svg)

## 재귀 깊이 문제 해결 — 반복 타잔

Python의 기본 재귀 한도(1000)를 초과하는 큰 그래프에서는 반복 버전이 필요합니다.

```python
import sys
sys.setrecursionlimit(10 ** 6)  # 간단한 해결책

# 또는 반복 DFS로 타잔 구현
def tarjan_iterative(n, graph):
    disc = [-1] * n
    low = [-1] * n
    on_stack = [False] * n
    stack = []
    timer = [0]
    sccs = []
    call_stack = []

    for start in range(n):
        if disc[start] != -1:
            continue
        call_stack.append((start, iter(graph[start])))
        disc[start] = low[start] = timer[0]
        timer[0] += 1
        stack.append(start)
        on_stack[start] = True

        while call_stack:
            u, neighbors = call_stack[-1]
            try:
                v = next(neighbors)
                if disc[v] == -1:
                    disc[v] = low[v] = timer[0]
                    timer[0] += 1
                    stack.append(v)
                    on_stack[v] = True
                    call_stack.append((v, iter(graph[v])))
                elif on_stack[v]:
                    low[u] = min(low[u], disc[v])
            except StopIteration:
                call_stack.pop()
                if call_stack:
                    parent = call_stack[-1][0]
                    low[parent] = min(low[parent], low[u])
                if low[u] == disc[u]:
                    scc = []
                    while True:
                        w = stack.pop()
                        on_stack[w] = False
                        scc.append(w)
                        if w == u:
                            break
                    sccs.append(scc)
    return sccs
```

## 활용 — 2-SAT

SCC의 대표적인 응용은 **2-SAT(2-Satisfiability Problem)**입니다. 각 리터럴 xi와 ¬xi를 노드로 만들고 논리 함의 관계를 간선으로 표현한 뒤, **xi와 ¬xi가 같은 SCC에 있으면 UNSAT**입니다.

```python
def two_sat(n, clauses):
    """
    n개 변수, clauses: [(a, b)] where a or b = True
    변수 i: 노드 2i, 변수 ¬i: 노드 2i+1
    """
    graph = defaultdict(list)
    for a, b in clauses:
        # (a or b) == (¬a → b) and (¬b → a)
        graph[a ^ 1].append(b)
        graph[b ^ 1].append(a)

    sccs = tarjan(2 * n, graph)
    comp = [0] * (2 * n)
    for i, scc in enumerate(sccs):
        for v in scc:
            comp[v] = i

    for i in range(n):
        if comp[2 * i] == comp[2 * i + 1]:
            return None  # UNSAT
    return [comp[2 * i] > comp[2 * i + 1] for i in range(n)]
```

## 알고리즘 비교

| 특성 | 코사라주 | 타잔 |
|---|---|---|
| DFS 횟수 | 2회 | 1회 |
| 시간 복잡도 | O(V+E) | O(V+E) |
| 추가 공간 | 역방향 그래프 | disc/low/stack |
| 구현 난이도 | 낮음 | 중간 |
| 실용성 | 이해하기 쉬움 | 상수 작음 |

## 요약

SCC는 방향 그래프에서 **동치 클래스**를 정의합니다. 코사라주는 두 번의 DFS로 직관적으로, 타잔은 한 번의 DFS로 low 값을 활용해 구합니다. 압축 그래프(Condensation)를 만들면 복잡한 방향 그래프를 DAG로 단순화해 후속 처리가 쉬워집니다.

---

**지난 글:** [프림(Prim) 알고리즘 — 그리디 방식으로 MST 확장](/posts/dsa-mst-prim/)

**다음 글:** [단절점과 단절선 — 그래프의 취약 구조 탐지](/posts/dsa-articulation-points-bridges/)

<br>
읽어주셔서 감사합니다. 😊
