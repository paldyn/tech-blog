---
title: "차이 배열 (Difference Array)"
description: "구간 일괄 업데이트를 O(1)에 처리하고 누적 합으로 O(N) 복원하는 차이 배열의 원리, 구현, 2차원 확장, 대표 응용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["차이배열", "DifferenceArray", "구간업데이트", "누적합응용", "O(N)"]
featured: false
draft: false
---

[지난 글](/posts/dsa-prefix-sum/)에서 구간 합을 O(1)에 조회하는 누적 합을 다뤘습니다. 이번에는 그 역방향 — **구간 일괄 업데이트**를 O(1)에 처리하는 **차이 배열(Difference Array)**입니다.

## 핵심 아이디어

차이 배열 `D[i] = A[i] - A[i-1]`을 정의합니다. (D[0] = A[0])

`A[l..r] += v`를 수행하면:
- D[l] += v (구간 시작: v만큼 증가)
- D[r+1] -= v (구간 끝+1: v만큼 감소)

두 점만 수정하므로 **O(1)**. 모든 업데이트 완료 후 D의 누적 합으로 **O(N)**에 최종 A를 복원합니다.

![차이 배열 개념](/assets/posts/dsa-difference-array-concept.svg)

## 왜 동작하는가

`A[l..r] += v` 효과를 D에서 보면:
- 인덱스 `l`부터 `r`까지 D의 누적 합에 v가 더해집니다.
- 인덱스 `r+1`부터 D[r+1] -= v로 v가 상쇄됩니다.

D의 누적 합 = 누적 합(D) = 원본 배열 A. 차이 배열은 누적 합의 **역연산**입니다.

## 구현

![차이 배열 구현 및 항공편 예시](/assets/posts/dsa-difference-array-impl.svg)

```python
def range_update(n, operations):
    """operations: [(l, r, v), ...]  A[l..r] += v"""
    D = [0] * (n + 1)
    for l, r, v in operations:
        D[l] += v
        if r + 1 <= n:
            D[r + 1] -= v
    # 누적 합으로 복원
    for i in range(1, n):
        D[i] += D[i - 1]
    return D[:n]
```

## 응용 1: 항공편 예약

`bookings[i] = [first, last, seats]`: 항공편 `[first, last]` 구간에 seats석 예약.

```python
def corp_flight_bookings(bookings, n):
    D = [0] * (n + 1)
    for l, r, v in bookings:
        D[l - 1] += v       # 1-indexed → 0-indexed
        if r < n:
            D[r] -= v
    for i in range(1, n):
        D[i] += D[i - 1]
    return D[:n]

# 예: bookings = [[1,2,10],[2,3,20],[2,5,25]], n=5
# 결과: [10, 55, 45, 25, 25]
```

Q개 예약 처리: O(Q + N). 순수 루프 O(NQ) 대비 극적으로 빠릅니다.

## 응용 2: 최대 동시 이벤트 수

```python
def max_concurrent(intervals):
    """intervals: [(start, end), ...]"""
    if not intervals:
        return 0
    max_t = max(e for _, e in intervals)
    D = [0] * (max_t + 2)
    for s, e in intervals:
        D[s] += 1
        D[e + 1] -= 1
    # 누적 합의 최댓값
    cur = 0
    return max((cur := cur + d) for d in D)
```

## 응용 3: 2차원 차이 배열

행렬에서 직사각형 구간 일괄 업데이트를 O(1)에 처리합니다.

```python
def build_2d_diff(R, C):
    return [[0] * (C + 2) for _ in range(R + 2)]

def update_2d(D, r1, c1, r2, c2, v):
    D[r1][c1] += v
    D[r1][c2 + 1] -= v
    D[r2 + 1][c1] -= v
    D[r2 + 1][c2 + 1] += v  # 포함·배제 보정

def restore_2d(D, R, C):
    A = [[0] * C for _ in range(R)]
    for r in range(R):
        for c in range(C):
            val = D[r][c]
            if r > 0: val += A[r-1][c]
            if c > 0: val += A[r][c-1]
            if r > 0 and c > 0: val -= A[r-1][c-1]
            A[r][c] = val
    return A
```

## 차이 배열 vs 세그먼트 트리

| 항목 | 차이 배열 | 세그먼트 트리 |
|------|-----------|---------------|
| 구간 업데이트 | O(1) | O(log N) |
| 중간 조회 | 불가 (복원 전) | O(log N) |
| 최종 복원 | O(N) | — |
| 구현 복잡도 | 매우 단순 | 복잡 |

업데이트를 모두 적용한 후 **한 번에 전체 배열**을 봐야 한다면 차이 배열이 최적입니다. 업데이트 중간에 조회가 필요하면 세그먼트 트리 또는 펜윅 트리를 써야 합니다.

---

**지난 글:** [누적 합(Prefix Sum)](/posts/dsa-prefix-sum/)

**다음 글:** [카데인 알고리즘(Kadane's Algorithm)](/posts/dsa-kadane-algorithm/)

<br>
읽어주셔서 감사합니다. 😊
