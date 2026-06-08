---
title: "오프라인 쿼리 처리 (Offline Query Processing)"
description: "오프라인 쿼리 처리의 개념, 온라인 vs 오프라인 비교, 주요 기법(Mo's, 정렬, 분할 정복, 오프라인 LCA)을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["오프라인쿼리", "알고리즘최적화", "쿼리정렬", "배치처리"]
featured: false
draft: false
---

[지난 글](/posts/dsa-mo-algorithm/)에서 Mo's Algorithm을 이용해 정적 구간 쿼리를 O((N+Q)√N)에 처리하는 방법을 다뤘습니다. 이번에는 Mo's Algorithm이 속하는 더 큰 패러다임인 **오프라인 쿼리 처리(Offline Query Processing)**의 개념과 다양한 기법을 체계적으로 정리합니다.

## 온라인 vs 오프라인

알고리즘 문제에서 쿼리 처리는 크게 두 방식으로 나뉩니다.

**온라인(Online)** 방식은 쿼리가 도착하는 즉시 답을 반환해야 합니다. 이전 쿼리의 답을 다음 쿼리의 입력에 XOR하거나 더하는 형태로 암호화된 쿼리가 대표적인 온라인 강제 조건입니다. 세그먼트 트리, BIT, 스플레이 트리 같은 자료구조가 주로 사용됩니다.

**오프라인(Offline)** 방식은 모든 쿼리를 미리 읽어 최적 순서로 처리합니다. 쿼리를 재배열하거나 데이터 구조 관점에서 최적의 방문 순서를 결정할 수 있어 같은 문제를 더 빠르게 풀 수 있습니다.

![온라인 vs 오프라인 비교](/assets/posts/dsa-offline-query-processing-comparison.svg)

## 오프라인 처리의 핵심 이점

1. **쿼리 재정렬**: 비용이 낮은 순서로 쿼리를 처리해 포인터 이동이나 재계산을 최소화합니다.
2. **배치 처리**: 유사한 쿼리를 묶어 한 번의 전처리로 여러 쿼리를 처리합니다.
3. **분할 정복 적용**: 쿼리를 재귀적으로 분할해 각 단계에서 효율적인 처리가 가능합니다.
4. **이벤트 시뮬레이션**: 쿼리와 업데이트를 시간순으로 정렬해 하나의 스캔으로 모두 처리합니다.

## 4가지 주요 기법

![오프라인 쿼리 처리 4가지 기법](/assets/posts/dsa-offline-query-processing-techniques.svg)

### 1. Mo's Algorithm (구간 쿼리 정렬)

블록 크기 B = √N으로 배열을 나누고, 쿼리를 `(L//B, R)` 기준으로 정렬합니다. L과 R 포인터를 이동시키며 O(1) add/remove로 상태를 갱신합니다. 총 복잡도 O((N+Q)√N).

```python
B = int(N**0.5) or 1
queries.sort(key=lambda q: (q[0]//B,
    q[1] if (q[0]//B)%2==0 else -q[1]))
```

### 2. 이벤트 정렬 (시간축 처리)

업데이트와 쿼리를 하나의 이벤트 리스트로 합쳐 시간(또는 인덱스)순으로 정렬한 뒤 스캔합니다.

```python
events = []
for i, val in enumerate(updates):
    events.append(('update', i, val))
for l, r, t, idx in queries:
    events.append(('query', l, r, t, idx))
events.sort(key=lambda e: e[1])  # 시간순 정렬
```

BIT나 세그먼트 트리와 조합하면 "시점 t에서의 구간 합" 같은 쿼리를 O((N+Q) log N)에 처리합니다.

### 3. CDQ 분할 정복 (Divide & Conquer)

중국의 Chen Dan Qi가 고안한 기법으로, 쿼리를 중간점 기준으로 분할해 "왼쪽 업데이트가 오른쪽 쿼리에 미치는 영향"을 계산합니다.

```python
def cdq(queries, l, r):
    if l == r:
        return
    mid = (l + r) // 2
    cdq(queries, l, mid)
    cdq(queries, mid + 1, r)
    # 왼쪽 업데이트 -> 오른쪽 쿼리 기여 계산
    calc_contribution(queries[l:mid+1], queries[mid+1:r+1])
```

3차원 편향 문제(3D partial order)를 O(N log² N)에 해결하는 핵심 기법입니다.

### 4. 병합 정렬 기반 (역전 쌍 등)

병합 정렬의 병합 단계에서 좌측 절반과 우측 절반 사이의 관계(역전 쌍 수, 범위 내 원소 수 등)를 함께 계산합니다.

```python
def merge_count(arr, l, r):
    if l >= r:
        return 0
    mid = (l + r) // 2
    count = merge_count(arr, l, mid)
    count += merge_count(arr, mid+1, r)
    # 병합하면서 역전 쌍 카운트
    count += count_cross_inversions(arr, l, mid, r)
    return count
```

역전 쌍(inversion count)을 O(N log N)에 계산하는 표준 기법입니다.

## 오프라인 LCA

오프라인 쿼리 처리의 고전적 예시는 **Tarjan의 오프라인 LCA** 알고리즘입니다. 모든 LCA 쿼리를 미리 수집해 DFS 중 Union-Find로 처리하면 O((N+Q) α(N))의 사실상 선형 복잡도를 달성합니다.

```python
def offline_lca(root, queries):
    # 각 노드에 대한 쿼리를 인접 리스트로 준비
    query_map = defaultdict(list)
    for u, v, idx in queries:
        query_map[u].append((v, idx))
        query_map[v].append((u, idx))

    ans = [0] * len(queries)
    ancestor = {}
    visited = set()
    uf = UnionFind(N)

    def dfs(node, parent):
        ancestor[uf.find(node)] = node
        for child in tree[node]:
            if child != parent:
                dfs(child, node)
                uf.union(node, child)
                ancestor[uf.find(node)] = node
        visited.add(node)
        for other, idx in query_map[node]:
            if other in visited:
                ans[idx] = ancestor[uf.find(other)]
    dfs(root, -1)
    return ans
```

## 오프라인 처리 가능 여부 판단

| 조건 | 판단 | 권장 기법 |
|------|------|-----------|
| 이전 답이 다음 입력에 영향 | 온라인 필수 | 세그먼트 트리, BIT |
| 업데이트 + 구간 쿼리 | 오프라인 가능 | 이벤트 정렬, CDQ |
| 업데이트 없는 구간 쿼리 | 오프라인 최적 | Mo's Algorithm |
| 트리 경로 쿼리 | 오프라인 가능 | 오프라인 LCA, HLD |
| 역전 쌍 / 쌍 비교 | 오프라인 최적 | 병합 정렬 기반 |

오프라인 처리가 가능한 경우 온라인 알고리즘보다 구현이 단순하면서도 2~10배 빠른 경우가 많습니다. 문제를 읽었을 때 "이 쿼리들이 서로 독립적인가?"를 먼저 확인하는 습관을 들이면 적합한 알고리즘을 빠르게 선택할 수 있습니다.

---

**지난 글:** [Mo의 알고리즘 (Mo's Algorithm)](/posts/dsa-mo-algorithm/)

**다음 글:** [재귀 (Recursion)](/posts/dsa-recursion/)

<br>
읽어주셔서 감사합니다. 😊
