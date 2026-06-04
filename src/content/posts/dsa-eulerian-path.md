---
title: "오일러 경로와 오일러 회로 — 한붓그리기"
description: "모든 간선을 정확히 한 번 통과하는 오일러 경로·회로의 존재 조건과 히어홀저 알고리즘으로 O(E)에 경로를 구성하는 방법, 방향·무방향 그래프 모두 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["오일러경로", "오일러회로", "Eulerian Path", "히어홀저", "그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-articulation-points-bridges/)에서 그래프에서 제거하면 연결이 끊기는 단절점·단절선을 탐지했습니다. 이번에는 **모든 간선을 정확히 한 번씩 통과**하는 **오일러 경로(Eulerian Path)**와 **오일러 회로(Eulerian Circuit)**를 다룹니다. 18세기 오일러가 쾨니히스베르크 다리 문제를 풀며 그래프 이론의 문을 열었던 그 개념입니다.

## 오일러 경로 vs 오일러 회로

- **오일러 회로**: 시작점과 끝점이 같은 오일러 경로 — 출발 노드에서 출발해 모든 간선을 한 번씩 방문하고 돌아옴
- **오일러 경로**: 시작과 끝이 다를 수 있음 — 모든 간선을 한 번씩 방문

주의: **해밀턴 경로**(모든 **노드**를 한 번씩)와 혼동하지 마세요. 오일러는 간선, 해밀턴은 노드입니다.

![오일러 경로 vs 오일러 회로](/assets/posts/dsa-eulerian-path-graph.svg)

## 존재 조건

### 무방향 그래프

| 종류 | 조건 |
|---|---|
| 오일러 회로 | 모든 노드의 차수(degree)가 짝수 + 연결 그래프 |
| 오일러 경로 | 홀수 차수 노드가 정확히 2개 + 연결 그래프 (2개 중 하나가 시작, 하나가 끝) |

### 방향 그래프

| 종류 | 조건 |
|---|---|
| 오일러 회로 | 모든 노드 in-degree = out-degree + 강하게 연결 |
| 오일러 경로 | 시작점: out-deg = in-deg + 1, 끝점: in-deg = out-deg + 1, 나머지: in-deg = out-deg |

## 히어홀저(Hierholzer) 알고리즘

DFS 기반의 O(E) 알고리즘입니다. 스택을 사용해 막힌 노드부터 경로에 추가합니다.

```python
from collections import defaultdict

def hierholzer(graph, start):
    """
    graph: {u: [v1, v2, ...]} — 사용 후 간선 제거 가능
    방향 그래프: graph[u]에서 pop만
    무방향 그래프: graph[u].remove(v) + graph[v].remove(u)
    """
    # 인접 리스트 복사 (원본 보존)
    g = {u: list(vs) for u, vs in graph.items()}
    stack = [start]
    path = []

    while stack:
        v = stack[-1]
        if g.get(v):
            u = g[v].pop()
            stack.append(u)
        else:
            path.append(stack.pop())

    return list(reversed(path))

# 무방향 그래프 예시
graph = {
    0: [1, 2],
    1: [0, 2, 3],
    2: [0, 1, 3],
    3: [1, 2]
}
# 차수: 0→2, 1→3(홀), 2→3(홀), 3→2 → 오일러 경로 존재 (1 또는 2에서 시작)
print(hierholzer(graph, 1))  # [1, 0, 2, 1, 3, 2] 등
```

![히어홀저 알고리즘 구현](/assets/posts/dsa-eulerian-hierholzer.svg)

## 존재 여부 확인 함수

```python
from collections import deque

def check_eulerian(n, adj):
    """
    반환: ('circuit', start) 또는 ('path', start, end) 또는 None
    adj: 무방향 인접 리스트
    """
    # 연결성 확인 (간선 있는 노드들만)
    degree = [len(adj[v]) for v in range(n)]
    has_edges = any(degree)
    if not has_edges:
        return None

    # BFS 연결성 확인
    start_node = next(v for v in range(n) if degree[v] > 0)
    visited = set()
    q = deque([start_node])
    visited.add(start_node)
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in visited:
                visited.add(v)
                q.append(v)

    if any(degree[v] > 0 and v not in visited for v in range(n)):
        return None  # 비연결

    odd_nodes = [v for v in range(n) if degree[v] % 2 == 1]
    if len(odd_nodes) == 0:
        return ('circuit', start_node)
    elif len(odd_nodes) == 2:
        return ('path', odd_nodes[0], odd_nodes[1])
    else:
        return None  # 오일러 경로/회로 없음
```

## 방향 그래프의 오일러 경로

```python
def eulerian_path_directed(n, graph):
    """
    graph: {u: [v1, v2, ...]} 방향 그래프
    """
    in_deg = [0] * n
    out_deg = [0] * n
    for u in range(n):
        for v in graph.get(u, []):
            out_deg[u] += 1
            in_deg[v] += 1

    start = -1
    for u in range(n):
        diff = out_deg[u] - in_deg[u]
        if diff == 1:
            start = u
        elif abs(diff) > 1 or (diff == -1 and in_deg[u] - out_deg[u] > 1):
            return None  # 불가능

    if start == -1:
        start = next((u for u in range(n) if out_deg[u] > 0), 0)

    return hierholzer(graph, start)
```

## 활용 사례

- **DNA 시퀀싱**: De Bruijn 그래프에서 오일러 경로로 염기 서열 조립
- **중국인 우체부 문제(CPP)**: 최소 비용으로 모든 도로를 순회하는 문제
- **회로 기판 드릴링**: 모든 홀을 최소 이동으로 뚫는 경로
- **퍼즐**: 한붓그리기가 가능한지 판단

## 요약

오일러 경로·회로는 **차수 조건 하나**로 존재 여부가 결정됩니다. 구성은 히어홀저 알고리즘으로 O(E)에 해결합니다. 스택에서 더 이상 나갈 곳이 없는 노드를 경로 앞에 삽입하는 역발상이 핵심입니다.

---

**지난 글:** [단절점과 단절선 — 그래프의 취약 구조 탐지](/posts/dsa-articulation-points-bridges/)

**다음 글:** [최대 유량 — 포드-풀커슨(Ford-Fulkerson) 알고리즘](/posts/dsa-max-flow-ford-fulkerson/)

<br>
읽어주셔서 감사합니다. 😊
