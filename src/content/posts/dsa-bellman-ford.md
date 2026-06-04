---
title: "벨만-포드(Bellman-Ford) — 음수 가중치와 음수 사이클 탐지"
description: "모든 간선을 V-1번 반복해 음수 가중치 그래프에서도 최단 경로를 구하고, V번째 완화로 음수 사이클을 탐지하는 벨만-포드 알고리즘을 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["벨만포드", "Bellman-Ford", "음수 사이클", "최단 경로", "그래프"]
featured: false
draft: false
---

[지난 글](/posts/dsa-a-star-search/)에서 휴리스틱으로 탐색을 가속하는 A\*를 다뤘습니다. 그러나 A\*와 다익스트라는 모두 **음수 가중치 간선**이 있으면 올바른 결과를 보장하지 못합니다. **벨만-포드(Bellman-Ford)** 알고리즘은 음수 가중치를 처리하고, 나아가 **음수 사이클(negative cycle)의 존재 여부까지 탐지**합니다. 화폐 차익거래(arbitrage) 탐지, 네트워크 거리 벡터 라우팅(RIP 프로토콜) 등에 활용됩니다.

## 핵심 아이디어

벨만-포드는 **완화(relaxation)** 를 반복합니다.

> 최단 경로는 최대 V-1개의 간선을 사용한다(사이클 없이). 따라서 V-1번 완화하면 반드시 수렴한다.

단, 음수 사이클이 있으면 V번째 완화에서도 거리가 줄어드는 간선이 발생합니다. 이를 통해 음수 사이클을 탐지합니다.

## 완화(Relaxation) 규칙

```
if dist[u] + w < dist[v]:
    dist[v] = dist[u] + w
```

출발 노드에서 u까지의 거리와 u→v 간선 가중치의 합이 기존 v까지의 거리보다 짧으면 갱신합니다.

![벨만-포드 음수 가중치 그래프](/assets/posts/dsa-bellman-ford-graph.svg)

## Python 구현

```python
def bellman_ford(V, edges, src):
    """
    edges: [(u, v, weight), ...]
    반환: dist 배열 or None (음수 사이클 존재 시)
    """
    dist = [float('inf')] * V
    dist[src] = 0

    # V-1번 반복: 최대 V-1개 간선을 쓰는 최단 경로 확정
    for _ in range(V - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w

    # V번째 반복에서 갱신 발생 = 음수 사이클 존재
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            return None  # 음수 사이클 탐지

    return dist
```

![벨만-포드 완화 반복 테이블](/assets/posts/dsa-bellman-ford-relax.svg)

## 조기 종료 최적화

한 이터레이션에서 갱신이 없으면 이미 수렴한 것이므로 바로 종료합니다.

```python
def bellman_ford_early_stop(V, edges, src):
    dist = [float('inf')] * V
    dist[src] = 0

    for i in range(V - 1):
        updated = False
        for u, v, w in edges:
            if dist[u] != float('inf') and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                updated = True
        if not updated:
            break  # 조기 종료

    # 음수 사이클 확인
    for u, v, w in edges:
        if dist[u] != float('inf') and dist[u] + w < dist[v]:
            return None
    return dist
```

## 시간·공간 복잡도

| 항목 | 값 |
|---|---|
| 시간 복잡도 | O(V × E) |
| 공간 복잡도 | O(V) |
| 음수 가중치 | 가능 |
| 음수 사이클 탐지 | O |
| 다익스트라 대비 | 느리지만 더 범용 |

## 음수 사이클 탐지 활용: 차익거래

통화 교환 그래프에서 음수 사이클 = 수익 사이클입니다.

```python
import math

def find_arbitrage(currencies, rates):
    # 로그 변환: w = -log(rate), 음수 사이클 = 수익 경로
    n = len(currencies)
    edges = []
    for i in range(n):
        for j in range(n):
            if rates[i][j] > 0:
                edges.append((i, j, -math.log(rates[i][j])))

    dist = [float('inf')] * n
    dist[0] = 0

    for _ in range(n - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w

    # 음수 사이클 = 차익 거래 가능
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            return True  # 차익 거래 존재!
    return False
```

## 다익스트라와 비교

| 특성 | 다익스트라 | 벨만-포드 |
|---|---|---|
| 음수 가중치 | 불가 | 가능 |
| 음수 사이클 탐지 | 불가 | 가능 |
| 시간 복잡도 | O((V+E)log V) | O(VE) |
| 구현 복잡도 | 중간 | 단순 |

## 요약

벨만-포드는 **느리지만 강력합니다**. 음수 간선이 없다면 다익스트라를, 있다면 벨만-포드를 선택하면 됩니다. V-1번 완화로 최단 경로를 확정하고 V번째 완화로 음수 사이클을 잡아내는 두 단계가 이 알고리즘의 전부입니다.

---

**지난 글:** [A* 탐색 알고리즘 — 휴리스틱으로 더 빠르게](/posts/dsa-a-star-search/)

**다음 글:** [플로이드-워셜(Floyd-Warshall) — 모든 쌍 최단 경로](/posts/dsa-floyd-warshall/)

<br>
읽어주셔서 감사합니다. 😊
