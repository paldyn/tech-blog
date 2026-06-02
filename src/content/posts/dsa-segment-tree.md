---
title: "세그먼트 트리 (Segment Tree)"
description: "배열의 구간 합/최솟값/최댓값을 O(log n)에 쿼리·업데이트하는 세그먼트 트리의 구조, 빌드, 쿼리, 포인트 업데이트 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["세그먼트 트리", "Segment Tree", "구간 쿼리", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-trie/)에서 문자열 특화 자료구조인 트라이를 다뤘습니다. 이번에는 **구간 쿼리(range query)** 문제를 효율적으로 처리하는 세그먼트 트리를 살펴봅니다. "배열의 [l, r] 구간 합은?", "구간 최솟값은?" 같은 질문을 O(log n)에 처리하면서, 값 업데이트도 O(log n)에 반영합니다.

## 동기

단순 배열에서 구간 합은 매번 O(n)이 걸립니다. 접두사 합(prefix sum)은 쿼리를 O(1)로 줄이지만 업데이트가 O(n)입니다. 세그먼트 트리는 **쿼리와 업데이트 모두 O(log n)**을 달성합니다.

| 자료구조 | 쿼리 | 업데이트 |
|---|---|---|
| 순차 탐색 | O(n) | O(1) |
| 접두사 합 | O(1) | O(n) |
| **세그먼트 트리** | **O(log n)** | **O(log n)** |
| 펜윅 트리 | O(log n) | O(log n) |

## 구조

![세그먼트 트리 구조](/assets/posts/dsa-segment-tree-structure.svg)

- 루트는 전체 구간 [0, n-1]
- 내부 노드는 구간의 합(또는 최솟값, 최댓값 등)
- 리프는 배열의 단일 원소
- 노드 인덱스: 루트=1, 왼쪽=2i, 오른쪽=2i+1 (1-indexed)
- 배열 크기: 4n으로 충분

## 구현

![세그먼트 트리 구현](/assets/posts/dsa-segment-tree-query.svg)

```python
class SegTree:
    def __init__(self, arr):
        self.n = len(arr)
        self.tree = [0] * 4 * self.n
        self._build(arr, 1, 0, self.n - 1)

    def _build(self, arr, node, s, e):
        if s == e:
            self.tree[node] = arr[s]
            return
        mid = (s + e) // 2
        self._build(arr, 2 * node,     s,     mid)
        self._build(arr, 2 * node + 1, mid+1, e)
        self.tree[node] = self.tree[2*node] + self.tree[2*node+1]
```

## 구간 쿼리

세 가지 경우로 분기합니다.

```python
def query(self, l, r):
    return self._q(1, 0, self.n-1, l, r)

def _q(self, node, s, e, l, r):
    if r < s or e < l:          # 완전 벗어남
        return 0
    if l <= s and e <= r:       # 완전 포함
        return self.tree[node]
    mid = (s + e) // 2          # 부분 포함 → 분할
    return (self._q(2*node,     s,     mid, l, r) +
            self._q(2*node + 1, mid+1, e,   l, r))

# 예시
arr = [2, 4, 3, 1, 6, 7, 2, 5]
st = SegTree(arr)
print(st.query(1, 5))  # 4+3+1+6+7 = 21
print(st.query(0, 7))  # 30 (전체 합)
```

## 포인트 업데이트

```python
def update(self, i, val):
    self._u(1, 0, self.n-1, i, val)

def _u(self, node, s, e, i, val):
    if s == e:
        self.tree[node] = val
        return
    mid = (s + e) // 2
    if i <= mid:
        self._u(2*node,     s,     mid, i, val)
    else:
        self._u(2*node + 1, mid+1, e,   i, val)
    self.tree[node] = self.tree[2*node] + self.tree[2*node+1]

st.update(3, 10)  # arr[3] = 1 → 10
print(st.query(0, 3))  # 2+4+3+10 = 19
```

## 최솟값/최댓값 트리로 변환

합 대신 `min` 또는 `max`로 바꾸기만 하면 됩니다.

```python
def _build_min(self, arr, node, s, e):
    if s == e:
        self.tree[node] = arr[s]; return
    mid = (s + e) // 2
    self._build_min(arr, 2*node, s, mid)
    self._build_min(arr, 2*node+1, mid+1, e)
    self.tree[node] = min(self.tree[2*node], self.tree[2*node+1])

def _q_min(self, node, s, e, l, r):
    if r < s or e < l: return float('inf')
    if l <= s and e <= r: return self.tree[node]
    mid = (s + e) // 2
    return min(self._q_min(2*node, s, mid, l, r),
               self._q_min(2*node+1, mid+1, e, l, r))
```

## 반복적(Iterative) 구현

재귀 없이 구현하면 스택 오버헤드가 없고 더 빠릅니다. 배열 크기를 2의 거듭제곱으로 맞추는 방식을 사용합니다.

```python
class SegTreeIter:
    def __init__(self, arr):
        self.n = len(arr)
        self.tree = [0] * (2 * self.n)
        # 리프 채우기
        for i, v in enumerate(arr):
            self.tree[self.n + i] = v
        # 내부 노드 채우기 (뒤에서 앞으로)
        for i in range(self.n - 1, 0, -1):
            self.tree[i] = self.tree[2*i] + self.tree[2*i+1]

    def update(self, i, val):
        i += self.n
        self.tree[i] = val
        while i > 1:
            i //= 2
            self.tree[i] = self.tree[2*i] + self.tree[2*i+1]

    def query(self, l, r):   # [l, r] 포함
        l += self.n; r += self.n + 1
        res = 0
        while l < r:
            if l & 1: res += self.tree[l]; l += 1
            if r & 1: r -= 1; res += self.tree[r]
            l >>= 1; r >>= 1
        return res
```

## 성능 요약

- 빌드: O(n)
- 쿼리: O(log n)
- 업데이트(포인트): O(log n)
- 공간: O(n) (4n 배열)

범위 업데이트(구간 전체를 동시에 수정)가 필요하면 **Lazy Propagation**이 필요합니다. 이는 다음 글에서 다룹니다.

---

**지난 글:** [트라이 (Trie)](/posts/dsa-trie/)

**다음 글:** [세그먼트 트리 — Lazy Propagation](/posts/dsa-segment-tree-lazy-propagation/)

<br>
읽어주셔서 감사합니다. 😊
