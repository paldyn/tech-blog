---
title: "k-d 트리 (k-dimensional Tree)"
description: "다차원 공간을 재귀적으로 분할해 최근접 이웃 탐색과 범위 탐색을 O(log n)에 처리하는 k-d 트리의 구조, 빌드, 검색 알고리즘을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["k-d 트리", "kd-tree", "공간 자료구조", "최근접 이웃", "다차원 탐색"]
featured: false
draft: false
---

[지난 글](/posts/dsa-fenwick-tree/)에서 1차원 배열의 prefix sum을 O(log n)에 관리하는 펜윅 트리를 살펴봤습니다. 이번에는 **다차원 공간**에서의 범위 탐색과 최근접 이웃(Nearest Neighbor) 탐색을 효율적으로 처리하는 **k-d 트리(k-dimensional Tree)**를 다룹니다.

## 문제 상황

지도 앱에서 "내 위치에서 가장 가까운 카페 찾기", 이미지에서 "이 색과 가장 유사한 팔레트 색 찾기" 같은 문제를 단순 순차 탐색으로 처리하면 O(n)입니다. n이 수백만이면 응답이 불가능합니다.

k-d 트리는 k차원 공간을 재귀적으로 이등분해 **평균 O(log n)** 탐색을 가능하게 합니다.

## 핵심 아이디어: 축 교대 분할

트리의 각 레벨에서 어느 축(x, y, z, ...)으로 공간을 나눌지를 **depth mod k** 로 결정합니다. 2D라면 짝수 깊이에서 x축, 홀수 깊이에서 y축으로 중앙값 기준 분할합니다.

![k-d 트리 구조](/assets/posts/dsa-kd-tree-structure.svg)

분할된 트리에서 각 노드는 해당 초평면(hyperplane)의 기준점이고, 왼쪽 서브트리는 기준값보다 작은 공간, 오른쪽은 큰 공간입니다.

## 트리 빌드

```javascript
function buildKdTree(points, depth = 0) {
  if (!points.length) return null;

  const axis = depth % 2; // 2D: 0=x, 1=y
  points.sort((a, b) => a[axis] - b[axis]);
  const mid = Math.floor(points.length / 2);

  return {
    point: points[mid],
    left:  buildKdTree(points.slice(0, mid), depth + 1),
    right: buildKdTree(points.slice(mid + 1), depth + 1),
  };
}
```

중앙값(median)을 루트로 삼기 때문에 트리가 균형을 이룹니다. 빌드 시간은 정렬 비용으로 **O(n log²n)**이며, 중앙값 선택을 quickselect로 최적화하면 **O(n log n)**입니다.

## 최근접 이웃 탐색

```javascript
let best = { dist: Infinity, point: null };

function nearest(node, target, depth = 0) {
  if (!node) return;

  const dist = euclidean(node.point, target);
  if (dist < best.dist)
    best = { dist, point: node.point };

  const axis = depth % 2;
  const diff = target[axis] - node.point[axis];

  // 가까운 방향 먼저 탐색 (가지치기 극대화)
  const [near, far] = diff < 0
    ? [node.left, node.right]
    : [node.right, node.left];

  nearest(near, target, depth + 1);

  // 초평면까지 거리 < 현재 최선이면 반대쪽도 탐색
  if (diff * diff < best.dist)
    nearest(far, target, depth + 1);
}
```

핵심은 "초평면까지 거리"(`diff * diff`)가 현재 최선보다 작을 때만 반대쪽을 탐색한다는 점입니다. 이 **가지치기(pruning)** 덕분에 평균적으로 O(log n) 노드만 방문합니다.

![k-d 트리 구현](/assets/posts/dsa-kd-tree-impl.svg)

## 범위 탐색

```javascript
function rangeSearch(node, lo, hi, depth = 0, result = []) {
  if (!node) return result;

  const [x, y] = node.point;
  if (x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1])
    result.push(node.point);

  const axis = depth % 2;
  if (lo[axis] <= node.point[axis])
    rangeSearch(node.left, lo, hi, depth + 1, result);
  if (hi[axis] >= node.point[axis])
    rangeSearch(node.right, lo, hi, depth + 1, result);

  return result;
}
```

## 복잡도 정리

| 연산 | 평균 | 최악 |
|---|---|---|
| 빌드 | O(n log n) | O(n log n) |
| 최근접 이웃 탐색 | O(log n) | O(n) |
| 범위 탐색 | O(√n + k) | O(n) |

최악 O(n)은 트리가 퇴화됐거나 모든 점이 답이 될 때입니다. 실제로 랜덤 데이터에서는 평균 성능이 잘 나옵니다.

## 한계와 대안

- **고차원 저주(curse of dimensionality)**: 차원 k가 커질수록 가지치기 효과가 줄어들어 O(n)에 수렴. 보통 k ≤ 20 권장
- **동적 삽입/삭제**: 트리 균형 유지가 어려움. 주기적 재빌드가 일반적
- **대안**: Ball Tree(구형 영역 분할, 고차원에 유리), R-Tree(데이터베이스 지리 인덱스)

---

**지난 글:** [펜윅 트리](/posts/dsa-fenwick-tree/)

**다음 글:** [희소 테이블 (Sparse Table)](/posts/dsa-sparse-table/)

<br>
읽어주셔서 감사합니다. 😊
