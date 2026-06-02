---
title: "세그먼트 트리 — Lazy Propagation"
description: "구간 전체를 한 번에 업데이트하는 Lazy Propagation의 원리, push_down 구현, 범위 업데이트·쿼리 O(log n) 달성, 그리고 실전 활용 패턴을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["세그먼트 트리", "Lazy Propagation", "구간 업데이트", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-segment-tree/)에서 세그먼트 트리로 구간 합을 O(log n)에 쿼리하고 포인트 업데이트를 처리했습니다. 하지만 "배열의 [l, r] 구간 전체에 5를 더하라"는 **범위 업데이트**는 어떻게 할까요? 포인트 업데이트를 r-l+1번 반복하면 O(n log n)이 됩니다. **Lazy Propagation**은 이를 O(log n)으로 줄이는 기법입니다.

## 핵심 아이디어

변경 사항을 즉시 자식에게 전파하지 않고, **별도의 lazy 배열에 표시**만 해둡니다. 나중에 해당 노드를 실제로 방문할 때 자식에게 전파합니다. "지연 전파"라는 이름이 여기서 나옵니다.

![Lazy Propagation 개념](/assets/posts/dsa-segment-tree-lazy-propagation-concept.svg)

## Push-Down 구현

lazy가 쌓인 노드를 방문하기 전에 자식으로 전파합니다.

```python
def _push_down(self, node, s, e):
    if self.lazy[node] == 0:
        return
    mid = (s + e) // 2
    lc, rc = 2 * node, 2 * node + 1
    # 왼쪽 자식 업데이트
    self.tree[lc] += self.lazy[node] * (mid - s + 1)
    self.lazy[lc] += self.lazy[node]
    # 오른쪽 자식 업데이트
    self.tree[rc] += self.lazy[node] * (e - mid)
    self.lazy[rc] += self.lazy[node]
    # 현재 노드 lazy 초기화
    self.lazy[node] = 0
```

## 범위 업데이트 및 쿼리

![Lazy Propagation 구현](/assets/posts/dsa-segment-tree-lazy-propagation-impl.svg)

```python
class LazySegTree:
    def __init__(self, arr):
        self.n = len(arr)
        self.tree = [0] * 4 * self.n
        self.lazy = [0] * 4 * self.n  # lazy 배열 추가
        self._build(arr, 1, 0, self.n - 1)

    def range_update(self, l, r, val):  # O(log n)
        self._ru(1, 0, self.n - 1, l, r, val)

    def _ru(self, node, s, e, l, r, val):
        if r < s or e < l:
            return
        if l <= s and e <= r:           # 완전 포함
            self.tree[node] += val * (e - s + 1)
            self.lazy[node] += val
            return
        self._push_down(node, s, e)     # 부분 포함: 먼저 전파
        mid = (s + e) // 2
        self._ru(2*node,     s,     mid, l, r, val)
        self._ru(2*node + 1, mid+1, e,   l, r, val)
        self.tree[node] = self.tree[2*node] + self.tree[2*node+1]

    def query(self, l, r):              # O(log n)
        return self._lq(1, 0, self.n - 1, l, r)

    def _lq(self, node, s, e, l, r):
        if r < s or e < l:
            return 0
        if l <= s and e <= r:
            return self.tree[node]
        self._push_down(node, s, e)     # 쿼리 전에도 전파 필수!
        mid = (s + e) // 2
        return (self._lq(2*node,     s,     mid, l, r) +
                self._lq(2*node + 1, mid+1, e,   l, r))
```

## 동작 예시

```python
arr = [1, 2, 3, 4, 5]
st = LazySegTree(arr)

print(st.query(0, 4))     # 15
st.range_update(1, 3, 10) # arr[1..3] += 10 → [1, 12, 13, 14, 5]
print(st.query(0, 4))     # 45
print(st.query(1, 3))     # 39 (12+13+14)
st.range_update(0, 4, -5) # 전체 -5
print(st.query(2, 2))     # 8 (13-5)
```

## 범위 합산(Range Sum) vs 범위 최솟값

최솟값 트리에서 범위 업데이트는 합산과 다릅니다. `min` 연산이므로 자식 업데이트 방식이 달라집니다.

```python
# 최솟값 트리 push_down
def _push_down_min(self, node, s, e):
    if self.lazy[node] == 0:
        return
    lc, rc = 2 * node, 2 * node + 1
    self.tree[lc] += self.lazy[node]   # min 트리에서 +연산 전파
    self.lazy[lc] += self.lazy[node]
    self.tree[rc] += self.lazy[node]
    self.lazy[rc] += self.lazy[node]
    self.lazy[node] = 0

# 병합: min
self.tree[node] = min(self.tree[2*node], self.tree[2*node+1])
```

## 구간 할당(Range Assignment)

덧셈이 아니라 **할당**(set all to val)은 lazy 의미가 달라집니다.

```python
# lazy[node] != -1이면 할당 값으로 해석
def _push_down_assign(self, node, s, e):
    if self.lazy[node] == -1:   # -1 = "no pending"
        return
    mid = (s + e) // 2
    lc, rc = 2 * node, 2 * node + 1
    self.tree[lc] = self.lazy[node] * (mid - s + 1)
    self.lazy[lc] = self.lazy[node]
    self.tree[rc] = self.lazy[node] * (e - mid)
    self.lazy[rc] = self.lazy[node]
    self.lazy[node] = -1
```

## 복잡도 요약

| 연산 | 시간 |
|---|---|
| 빌드 | O(n) |
| 범위 업데이트 | O(log n) |
| 구간 쿼리 | O(log n) |
| 공간 | O(n) |

Lazy Propagation을 사용하면 범위 업데이트가 단건 업데이트와 같은 O(log n)이 됩니다. 경쟁 프로그래밍과 구간 처리 문제에서 가장 많이 쓰이는 고급 세그먼트 트리 기법입니다.

---

**지난 글:** [세그먼트 트리 (Segment Tree)](/posts/dsa-segment-tree/)

<br>
읽어주셔서 감사합니다. 😊
