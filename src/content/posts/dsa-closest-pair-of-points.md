---
title: "가장 가까운 두 점 (Closest Pair of Points)"
description: "2D 평면에서 가장 가까운 두 점을 O(N log N)에 찾는 분할 정복 알고리즘의 원리, strip 탐색, 구현을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["최근접점쌍", "ClosestPair", "분할정복", "계산기하", "O(NlogN)"]
featured: false
draft: false
---

[지난 글](/posts/dsa-divide-and-conquer/)에서 분할 정복의 세 단계와 병합 정렬, 마스터 정리를 다뤘습니다. 이번에는 분할 정복의 비직관적이고 우아한 적용 사례인 **가장 가까운 두 점 (Closest Pair of Points)** 문제를 살펴봅니다. 2D 평면의 N개 점에서 거리가 가장 가까운 두 점을 찾는 이 문제는 무식하게 풀면 O(N²)이지만, 분할 정복을 이용하면 O(N log N)에 해결할 수 있습니다.

## 문제 정의

N개의 점 `P = {p₁, p₂, ..., pₙ}`이 2D 평면에 주어질 때, `dist(pᵢ, pⱼ)`를 최소화하는 두 점 `pᵢ, pⱼ`를 찾습니다.

유클리드 거리: `dist(p, q) = √((px-qx)² + (py-qy)²)`

브루트포스(O(N²)) 접근은 모든 쌍을 확인합니다. N=10^5라면 10^10 연산으로 불가능합니다.

## 분할 정복 접근

![가장 가까운 두 점 개념도](/assets/posts/dsa-closest-pair-of-points-concept.svg)

알고리즘의 핵심 아이디어는 다음과 같습니다.

1. **분할**: x좌표 중앙값 기준으로 점을 왼쪽/오른쪽 절반으로 나눕니다.
2. **정복**: 왼쪽 절반의 최근접 거리 δ_L, 오른쪽 절반의 최근접 거리 δ_R을 재귀적으로 구합니다.
3. **결합**: δ = min(δ_L, δ_R). 중앙선을 가로지르는 cross-pair 중 δ보다 짧은 쌍이 있는지 "strip" 영역에서 확인합니다.

분할 단계와 정복 단계는 직관적이지만, 결합 단계의 strip 탐색이 이 알고리즘의 핵심입니다.

## Strip 탐색 - 왜 O(N)인가?

![Strip 탐색 및 7점 증명](/assets/posts/dsa-closest-pair-of-points-strip.svg)

중앙선 x = mx에서 x 거리가 δ 이내인 점들만 cross-pair 후보입니다. 이 점들을 y좌표 기준으로 정렬한 뒤 슬라이딩 윈도우로 탐색합니다.

**핵심 관찰**: strip 안에서 y 차이가 δ 이상인 두 점은 거리가 δ보다 크므로 비교할 필요가 없습니다. 따라서 각 점 s에 대해 `|s.y - t.y| < δ`인 점 t만 비교합니다.

**7점 증명**: δ×2δ 직사각형(중앙선 기준 왼쪽 δ, 오른쪽 δ, y 방향 δ) 안에 들어올 수 있는 점의 수는 최대 8개(양쪽 각 4개)입니다. 이는 δ/2 x δ/2 격자를 이용한 비둘기집 원리로 증명합니다. 현재 점 자신을 제외하면 최대 7개만 비교하므로 strip 탐색 전체는 O(N)입니다.

## 전체 구현

```python
import math

def dist(p, q):
    return math.hypot(p[0]-q[0], p[1]-q[1])

def brute_force(pts):
    min_d = float('inf')
    for i in range(len(pts)):
        for j in range(i+1, len(pts)):
            min_d = min(min_d, dist(pts[i], pts[j]))
    return min_d

def strip_closest(strip, d):
    strip.sort(key=lambda p: p[1])  # y 기준 정렬
    min_d = d
    for i in range(len(strip)):
        j = i + 1
        while j < len(strip) and strip[j][1] - strip[i][1] < min_d:
            min_d = min(min_d, dist(strip[i], strip[j]))
            j += 1
    return min_d

def closest_pair_rec(pts):
    n = len(pts)
    if n <= 3:
        return brute_force(pts)

    mid = n // 2
    mx = pts[mid][0]

    dl = closest_pair_rec(pts[:mid])
    dr = closest_pair_rec(pts[mid:])
    d = min(dl, dr)

    # strip: 중앙선 기준 x 거리 d 이내 점
    strip = [p for p in pts if abs(p[0] - mx) < d]
    return min(d, strip_closest(strip, d))

def closest_pair(points):
    pts = sorted(points, key=lambda p: p[0])  # x 기준 정렬
    return closest_pair_rec(pts)
```

## 복잡도 분석

`T(N) = 2T(N/2) + O(N log N)` — strip 정렬을 매번 하면 마스터 정리 케이스 2보다 비용이 큽니다.

실제 O(N log N) 달성을 위해 y 기준 정렬된 배열을 별도로 유지하고 병합 정렬처럼 처리합니다.

```python
def closest_pair_opt(pts_x, pts_y):
    """
    pts_x: x 기준 정렬된 점 배열
    pts_y: y 기준 정렬된 점 배열
    """
    n = len(pts_x)
    if n <= 3:
        return brute_force(pts_x)

    mid = n // 2
    mx = pts_x[mid][0]

    # y 정렬된 배열을 좌/우로 분리 (O(N))
    pts_y_left  = [p for p in pts_y if p[0] <= mx]
    pts_y_right = [p for p in pts_y if p[0] > mx]

    dl = closest_pair_opt(pts_x[:mid], pts_y_left)
    dr = closest_pair_opt(pts_x[mid:], pts_y_right)
    d = min(dl, dr)

    # strip은 이미 y 기준 정렬된 상태
    strip = [p for p in pts_y if abs(p[0] - mx) < d]
    return min(d, strip_closest_sorted(strip, d))
```

이 최적화 버전의 재귀식: `T(N) = 2T(N/2) + O(N)` → 마스터 정리 케이스 2 → **O(N log N)**.

## 알고리즘 요약

| 단계 | 작업 | 시간 |
|------|------|------|
| 전처리 | x 기준 정렬 | O(N log N) |
| 분할 | 중앙 인덱스 찾기 | O(1) |
| 정복 | 재귀 x 2 | 2T(N/2) |
| strip 구성 | y 기준 정렬 유지 | O(N) |
| strip 탐색 | 각 점 최대 7번 비교 | O(N) |
| **전체** | | **O(N log N)** |

## 실전 응용

가장 가까운 두 점 알고리즘은 GIS(지리 정보 시스템), 클러스터링, 충돌 감지 등에 활용됩니다. 코딩 테스트에서는 직접 구현보다 아이디어를 묻는 경우가 많습니다. strip 탐색에서 "각 점이 최대 7개와만 비교한다"는 비둘기집 원리 기반 증명이 핵심 면접 질문입니다.

---

**지난 글:** [분할 정복 (Divide and Conquer)](/posts/dsa-divide-and-conquer/)

**다음 글:** [탐욕 알고리즘 (Greedy Algorithm)](/posts/dsa-greedy/)

<br>
읽어주셔서 감사합니다. 😊
