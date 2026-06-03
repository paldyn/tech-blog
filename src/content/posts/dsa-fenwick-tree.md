---
title: "펜윅 트리 (Binary Indexed Tree)"
description: "lowbit 트릭으로 prefix sum을 O(log n)에 업데이트·쿼리하는 펜윅 트리의 구조와 구현, 역위 수·2D BIT 응용까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["펜윅 트리", "BIT", "Binary Indexed Tree", "구간 합", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-segment-tree-lazy-propagation/)에서 세그먼트 트리에 지연 전파(lazy propagation)를 붙여 구간 업데이트를 O(log n)으로 처리하는 방법을 살펴봤습니다. 이번에는 그보다 훨씬 간결한 코드로 prefix sum 쿼리·업데이트를 O(log n)에 처리하는 **펜윅 트리(Fenwick Tree / Binary Indexed Tree)**를 다룹니다.

## 왜 펜윅 트리인가

세그먼트 트리는 강력하지만 구현 코드가 길고 메모리도 4n을 씁니다. 단순 prefix sum 업데이트/쿼리만 필요하다면 펜윅 트리가 코드 분량을 1/3로 줄이면서 동일한 O(log n)을 보장합니다.

| 자료구조 | update | query | 메모리 |
|---|---|---|---|
| 접두사 합 배열 | O(n) | O(1) | O(n) |
| 세그먼트 트리 | O(log n) | O(log n) | O(4n) |
| **펜윅 트리** | **O(log n)** | **O(log n)** | **O(n)** |

## 핵심 아이디어: lowbit

펜윅 트리의 비밀은 `lowbit(i) = i & (-i)` 한 줄입니다. 이 값은 i의 이진 표현에서 **가장 낮은 1비트**만 남긴 값으로, 인덱스 i가 담당하는 구간의 크기를 나타냅니다.

```
lowbit(1) = 1  (01₂)   → BIT[1]은 [1,1] 담당
lowbit(2) = 2  (10₂)   → BIT[2]은 [1,2] 담당
lowbit(4) = 4  (100₂)  → BIT[4]은 [1,4] 담당
lowbit(6) = 2  (110₂)  → BIT[6]은 [5,6] 담당
```

![펜윅 트리 구조](/assets/posts/dsa-fenwick-tree-structure.svg)

## 구현

```javascript
const n = 8;
const tree = new Array(n + 1).fill(0);

// 점 업데이트: a[i] += delta
function update(i, delta) {
  for (; i <= n; i += i & -i)
    tree[i] += delta;
}

// 접두사 합: sum(a[1..i])
function query(i) {
  let sum = 0;
  for (; i > 0; i -= i & -i)
    sum += tree[i];
  return sum;
}

// 구간 합: sum(a[l..r])
function rangeQuery(l, r) {
  return query(r) - query(l - 1);
}
```

`update`는 i에 lowbit을 **더해** 상위 부모로 올라가고, `query`는 lowbit을 **빼서** 이전 구간으로 내려갑니다. 두 루프 모두 최대 log₂n번 반복합니다.

![펜윅 트리 구현](/assets/posts/dsa-fenwick-tree-impl.svg)

## 초기화

n개의 원소 배열로 BIT를 O(n log n)에 초기화할 수도 있지만, O(n)으로 더 빠르게 할 수도 있습니다.

```javascript
// O(n) 초기화
function build(arr) {
  for (let i = 1; i <= n; i++) {
    tree[i] += arr[i - 1];       // 자신에 값 추가
    const parent = i + (i & -i); // 부모 인덱스
    if (parent <= n)
      tree[parent] += tree[i];
  }
}
```

## 역위 수 (Inversion Count)

배열에서 i < j이지만 a[i] > a[j]인 쌍의 개수를 구하는 데 BIT를 활용할 수 있습니다. 오른쪽에서 왼쪽으로 순회하면서 현재 값보다 작은 것들의 개수를 query로 누적합니다.

```javascript
function inversionCount(arr) {
  const MAX = 100001;
  const bit = new Array(MAX).fill(0);
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    count += queryBit(bit, arr[i] - 1, MAX);
    updateBit(bit, arr[i], 1, MAX);
  }
  return count;
}
```

## 2D BIT

2차원 구간 합도 BIT를 중첩해 처리할 수 있습니다. `tree[i][j]`를 관리하면서 행과 열 모두 lowbit 루프를 적용합니다.

```javascript
// 2D BIT update: (x, y) 위치에 delta 추가
function update2D(x, y, delta) {
  for (let i = x; i <= rows; i += i & -i)
    for (let j = y; j <= cols; j += j & -j)
      tree2d[i][j] += delta;
}
```

## 한계

- **구간 업데이트 + 점 쿼리**: 차이 배열(difference array) 기법과 조합하면 가능
- **구간 업데이트 + 구간 쿼리**: BIT 2개를 유지하는 고급 기법 필요
- 완전한 구간 업데이트·쿼리가 필요하면 세그먼트 트리가 적합

---

**지난 글:** [세그먼트 트리 지연 전파](/posts/dsa-segment-tree-lazy-propagation/)

**다음 글:** [k-d 트리](/posts/dsa-kd-tree/)

<br>
읽어주셔서 감사합니다. 😊
