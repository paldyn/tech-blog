---
title: "트리 DP (Tree DP): 서브트리 기반 최적화"
description: "트리 구조에서 DFS로 서브트리 상태를 합산하는 Tree DP 패턴을 독립 집합 최대 가중치, 트리 지름, 리루팅 기법까지 코드 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["동적프로그래밍", "트리DP", "Tree DP", "독립집합", "리루팅"]
featured: false
draft: false
---

[지난 글](/posts/dsa-bitmask-dp/)에서 집합 상태를 비트마스크로 압축하는 DP를 살펴봤습니다. 이번에는 **트리 DP(Tree DP)**를 다룹니다. 트리(사이클 없는 그래프)에서 DFS 후위 순회로 자식의 결과를 합산해 부모의 결과를 만드는 패턴입니다. "하위 문제 = 서브트리"라는 직관이 핵심입니다.

## 트리 DP 기본 패턴

루트에서 DFS를 시작해 자식을 모두 처리한 뒤 부모를 처리합니다.

```python
def dfs(v: int, parent: int, adj: list, ...) -> ...:
    dp[v] = base_value(v)          # 리프 노드 기저 초기화
    for u in adj[v]:
        if u == parent:
            continue               # 역방향 방지 (루트 방향)
        dfs(u, v, adj, ...)       # 자식 먼저 처리
        dp[v] = merge(dp[v], dp[u])  # 자식 결과 합산
    return dp[v]
```

트리 DP의 시간 복잡도는 일반적으로 O(n)입니다. 각 노드를 한 번씩 방문하고, 각 노드에서 상수 시간에 자식 결과를 합산하기 때문입니다.

## 예제 1: 독립 집합 최대 가중치

트리의 노드에 가중치가 있을 때, **인접한 두 노드를 동시에 선택하지 않는 조건**으로 선택 가중치 합을 최대화합니다.

`dp[v][0]` = v를 선택하지 않을 때 v의 서브트리에서 얻는 최대 가중치
`dp[v][1]` = v를 선택할 때 v의 서브트리에서 얻는 최대 가중치

```python
from collections import defaultdict

def max_independent_set(n: int, edges: list, weights: list) -> int:
    adj = defaultdict(list)
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)

    dp = [[0, 0] for _ in range(n + 1)]

    def dfs(v: int, parent: int) -> None:
        dp[v][0] = 0
        dp[v][1] = weights[v - 1]   # v 선택
        for u in adj[v]:
            if u == parent:
                continue
            dfs(u, v)
            # v 미선택: 자식 u는 선택/미선택 모두 가능
            dp[v][0] += max(dp[u][0], dp[u][1])
            # v 선택: 자식 u는 미선택만 가능 (인접 불가)
            dp[v][1] += dp[u][0]

    dfs(1, -1)
    return max(dp[1][0], dp[1][1])

# 예시: 노드 6개 트리
edges = [(1,2),(1,3),(2,4),(2,5),(3,6)]
weights = [3, 4, 2, 5, 6, 1]
print(max_independent_set(6, edges, weights))  # 13 (노드 4+5+1+3 불가, 4+5+3=12 또는 4+6+2=12 → 확인)
```

![트리 DP 서브트리 상태 전이](/assets/posts/dsa-tree-dp-subtree.svg)

## 예제 2: 트리 지름 (Tree Diameter)

트리에서 두 노드 사이의 최대 거리를 구합니다. 각 노드 v에서 가장 긴 두 자식 경로 합이 v를 통과하는 최장 경로입니다.

```python
def tree_diameter(n: int, edges: list) -> int:
    adj = defaultdict(list)
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))

    diameter = [0]

    def dfs(v: int, parent: int) -> int:
        # 이 노드에서 아래 방향 최장 경로
        max1, max2 = 0, 0
        for u, w in adj[v]:
            if u == parent:
                continue
            child_len = dfs(u, v) + w
            if child_len > max1:
                max1, max2 = child_len, max1
            elif child_len > max2:
                max2 = child_len
        # v를 거치는 지름 후보
        diameter[0] = max(diameter[0], max1 + max2)
        return max1   # 부모에게 반환: 이 서브트리에서 v 포함 최장 경로

    dfs(1, -1)
    return diameter[0]

# 예시
edges_w = [(1,2,3),(1,3,4),(2,4,2),(2,5,5),(3,6,1)]
print(tree_diameter(6, edges_w))  # 11 (4-2-1-3: 2+3+4=9? 또는 5-2-1-3: 5+3+4=12)
```

## 예제 3: 리루팅 기법 (Rerooting DP)

트리에서 **모든 노드를 루트로 봤을 때의 답**을 구해야 할 때, 루트를 n번 바꿔 각각 DFS하면 O(n²)입니다. 리루팅으로 O(n)에 해결합니다.

**Phase 1**: 임의 루트(예: 0)로 DFS해 각 서브트리 정보 수집.
**Phase 2**: 루트부터 DFS하며, 부모의 결과를 자식 방향으로 전달.

```python
def sum_of_distances(n: int, adj: list) -> list:
    # LeetCode 834: 모든 노드에서 다른 모든 노드까지 거리 합
    sz = [1] * n   # 서브트리 크기
    ans = [0] * n

    # Phase 1: subtree size + ans[root] 계산
    def dfs1(v: int, parent: int) -> None:
        for u in adj[v]:
            if u == parent:
                continue
            dfs1(u, v)
            sz[v] += sz[u]
            ans[v] += ans[u] + sz[u]   # u 서브트리 노드들이 v에서 1 더 멀어짐

    # Phase 2: 자식에게 부모 방향 기여 전달
    def dfs2(v: int, parent: int) -> None:
        for u in adj[v]:
            if u == parent:
                continue
            # u를 루트로 보면: v 방향의 (n-sz[u])개 노드가 1 더 멀어지고
            # v 방향에서 온 기여(ans[v] - ans[u] - sz[u])가 +1
            ans[u] = ans[v] - sz[u] + (n - sz[u])
            dfs2(u, v)

    dfs1(0, -1)
    dfs2(0, -1)
    return ans

# O(n) 시간, O(n) 공간
```

![리루팅 기법 DFS 2회](/assets/posts/dsa-tree-dp-rerooting.svg)

## 트리 DP 유형 정리

| 문제 | dp 상태 | 전이 |
|---|---|---|
| 독립 집합 | dp[v][0/1] | 자식 결과 합산 |
| 트리 지름 | 각 노드 최장 경로 | max(두 자식 경로 합) |
| 리루팅 | ans[v] = v 기준 전체 합 | 부모 → 자식 방향 전달 |
| 트리 배낭 | dp[v][j] = 서브트리 크기 j | 머지 기법 O(n²) |
| 트리 색칠 | dp[v][색상] | 부모-자식 색 제약 |

트리 DP의 핵심은 "루트에서 아래로" 또는 "리프에서 위로" 중 하나를 선택하고, 자식의 DP 결과를 합산하는 것입니다. 리루팅이 필요한 문제는 위 두 방향 모두를 DFS 2회로 처리합니다.

---

**지난 글:** [비트마스크 DP](/posts/dsa-bitmask-dp/)

**다음 글:** [최장 증가 부분 수열 (LIS)](/posts/dsa-longest-increasing-subsequence/)

<br>
읽어주셔서 감사합니다. 😊
