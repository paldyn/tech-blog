---
title: "희소 테이블 (Sparse Table)"
description: "O(n log n) 전처리로 구간 최솟값(RMQ)을 O(1)에 쿼리하는 희소 테이블의 원리, 구현, 멱등 연산 제약, LCA 응용까지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["희소 테이블", "Sparse Table", "RMQ", "구간 최솟값", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-kd-tree/)에서 다차원 공간 탐색을 위한 k-d 트리를 다뤘습니다. 이번에는 **정적 배열**에서 구간 최솟값(Range Minimum Query, RMQ) 쿼리를 놀라운 **O(1)**로 처리하는 희소 테이블(Sparse Table)을 알아봅니다.

## 핵심 아이디어

길이 2ʲ인 부분 배열의 최솟값을 미리 계산해 저장해 두면, 임의 구간 [l, r]에 대해 두 개의 미리 계산된 구간으로 덮을 수 있습니다. **min은 멱등(idempotent)** 연산이라 겹치는 원소를 두 번 세어도 결과가 변하지 않기 때문입니다.

```text
k = floor(log₂(r - l + 1))
RMQ(l, r) = min(sp[k][l], sp[k][r - 2ᵏ + 1])
```

두 구간이 겹쳐도 최솟값이 올바르게 나옵니다. 이게 **O(1) 쿼리**의 비밀입니다.

![희소 테이블 구조](/assets/posts/dsa-sparse-table-structure.svg)

## 전처리

```javascript
const LOG = [0, 0];
for (let i = 2; i <= n; i++)
  LOG[i] = LOG[i >> 1] + 1;

// sp[j][i] = min(a[i..i + 2^j - 1])
const sp = Array.from({ length: LOG[n] + 1 }, () => new Array(n));
for (let i = 0; i < n; i++) sp[0][i] = a[i];

for (let j = 1; (1 << j) <= n; j++) {
  for (let i = 0; i + (1 << j) <= n; i++) {
    sp[j][i] = Math.min(
      sp[j - 1][i],
      sp[j - 1][i + (1 << (j - 1))]
    );
  }
}
```

점화식: `sp[j][i] = min(sp[j-1][i], sp[j-1][i + 2^(j-1)])`  
→ "2ʲ 길이 구간의 최솟값 = 앞쪽 절반과 뒤쪽 절반의 최솟값 중 작은 것"

![희소 테이블 구현](/assets/posts/dsa-sparse-table-impl.svg)

## O(1) 쿼리

```javascript
function query(l, r) {
  const k = LOG[r - l + 1];
  return Math.min(sp[k][l], sp[k][r - (1 << k) + 1]);
}
```

`LOG[len]` 조회로 k를 O(1)에 구하고, 두 번의 배열 접근으로 끝납니다.

## 멱등 연산만 O(1) 가능

| 연산 | O(1) 가능? | 이유 |
|---|---|---|
| min, max | ✓ | 멱등: 중복 원소를 두 번 봐도 무관 |
| gcd, and, or | ✓ | 멱등 |
| **sum** | ✗ | 겹치는 구간을 두 번 더하면 오류 |

합산 쿼리가 필요하면 펜윅 트리나 세그먼트 트리를 써야 합니다.

## LCA 응용

희소 테이블의 가장 유명한 활용처는 **LCA(Lowest Common Ancestor)** 입니다.

1. **오일러 투어**: DFS로 트리를 배열로 변환 (방문할 때마다 깊이 기록)
2. LCA(u, v) = 오일러 투어 배열에서 u와 v 사이 구간의 **최소 깊이** 노드
3. 해당 RMQ를 희소 테이블로 O(1) 처리

```python
# 오일러 투어로 LCA
# euler[]: DFS 방문 순서, first[v]: 노드 v의 첫 방문 위치
def lca(u, v):
    l, r = min(first[u], first[v]), max(first[u], first[v])
    return euler[rmq(l, r)]  # rmq: 깊이가 최소인 인덱스
```

## 복잡도

| | 시간 | 공간 |
|---|---|---|
| 전처리 | O(n log n) | O(n log n) |
| 쿼리 | **O(1)** | — |

## 한계

- 배열이 정적이어야 합니다 (값 업데이트 불가). 동적이면 세그먼트 트리 사용
- 메모리가 O(n log n)으로 n이 크면 주의 (n=10⁷이면 약 23×10⁷ ≈ 920MB)

---

**지난 글:** [k-d 트리](/posts/dsa-kd-tree/)

**다음 글:** [그래프 표현](/posts/dsa-graph-representation/)

<br>
읽어주셔서 감사합니다. 😊
