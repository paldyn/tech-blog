---
title: "카데인 알고리즘 (Kadane's Algorithm)"
description: "최대 부분 배열 합을 O(N), O(1) 공간에 구하는 카데인 알고리즘의 DP 원리, 구간 추적 구현, 최소·원형·최대 곱 변형을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["카데인알고리즘", "Kadane", "최대부분배열", "동적프로그래밍", "O(N)"]
featured: false
draft: false
---

[지난 글](/posts/dsa-difference-array/)에서 구간 업데이트를 O(1)에 처리하는 차이 배열을 다뤘습니다. 이번에는 **최대 부분 배열 합(Maximum Subarray Sum)**을 O(N), O(1) 공간에 구하는 **카데인 알고리즘(Kadane's Algorithm)**입니다.

## 핵심 아이디어

"현재 원소를 포함하는 최대 부분 배열 합"을 `current`로 정의합니다.

```
current = max(A[i], current + A[i])
```

- `A[i]` 선택: 이전 부분 배열이 도움이 안 되므로 **새로 시작**
- `current + A[i]` 선택: 이전 부분 배열을 **연장**

`current`가 음수가 되면 이전 구간은 버리고 현재 원소부터 새 구간을 시작합니다. 이 결정이 한 번에 O(1)이므로 전체 O(N)입니다.

![카데인 알고리즘 개념 및 변형](/assets/posts/dsa-kadane-algorithm-concept.svg)

## 기본 구현

```python
def kadane(A):
    """최대 부분 배열 합 반환"""
    current = best = A[0]
    for x in A[1:]:
        current = max(x, current + x)
        best = max(best, current)
    return best
```

모든 원소가 음수여도 정확히 동작합니다. `A[0]`으로 초기화하면 빈 배열(합 0)을 정답으로 반환하지 않아도 됩니다.

## 구간 추적 구현

![구간 추적 및 최대 곱 변형](/assets/posts/dsa-kadane-algorithm-impl.svg)

```python
def kadane_with_range(A):
    """(최대합, 시작 인덱스, 끝 인덱스) 반환"""
    cur = best = A[0]
    start = end = tmp_start = 0
    for i in range(1, len(A)):
        if A[i] > cur + A[i]:
            cur = A[i]
            tmp_start = i       # 새 구간 시작
        else:
            cur += A[i]
        if cur > best:
            best = cur
            start = tmp_start
            end = i
    return best, start, end
```

## DP 관점

카데인 알고리즘은 DP 점화식의 단순화입니다.

```
dp[i] = i번째 원소로 끝나는 최대 부분 배열 합
dp[i] = max(A[i], dp[i-1] + A[i])
answer = max(dp[0], dp[1], ..., dp[N-1])
```

`dp[i]`가 오직 `dp[i-1]`에만 의존하므로, 배열 대신 변수 하나(`current`)로 O(1) 공간에 계산합니다.

## 변형 1: 최소 부분 배열 합

```python
def min_subarray_sum(A):
    current = best = A[0]
    for x in A[1:]:
        current = min(x, current + x)  # min으로만 변경
        best = min(best, current)
    return best
```

## 변형 2: 원형 배열 최대 부분 배열 합

원형 배열에서 구간은 "연속"이거나 "경계를 넘어 양쪽 끝 연결" 두 경우입니다.

```python
def max_circular_subarray(A):
    total = sum(A)

    # 일반 경우: 카데인 그대로
    max_normal = kadane(A)

    # 경계를 넘는 경우: 전체합 - (최소 중간 부분)
    # 최소 중간 부분 = 최소 부분 배열 합
    min_sub = min_subarray_sum(A)
    max_circular = total - min_sub

    # 모든 원소가 음수면 max_circular가 0(빈 배열)이 될 수 있으므로 max_normal 반환
    if max_circular == 0:
        return max_normal
    return max(max_normal, max_circular)
```

## 변형 3: 최대 곱 부분 배열

음수 두 개의 곱이 양수가 될 수 있으므로, **최대값과 최솟값 모두 추적**합니다.

```python
def max_product_subarray(A):
    mx = mn = best = A[0]
    for x in A[1:]:
        cands = (x, mx * x, mn * x)
        mx = max(cands)
        mn = min(cands)
        best = max(best, mx)
    return best
```

## 변형 4: k번 이하의 분할로 최대 합

```python
def max_sum_k_splits(A, k):
    """A를 최대 k개 연속 구간으로 나눠 합의 최대값"""
    # DP: dp[j][i] = i번째까지 j개 구간으로 나눈 최대합
    # 카데인을 j=1부터 k까지 반복 적용
    pass  # 구현은 DP + 카데인 조합
```

## 정리

| 변형 | 핵심 변경 | 복잡도 |
|------|-----------|--------|
| 기본 | max(x, cur+x) | O(N) |
| 최솟값 | min(x, cur+x) | O(N) |
| 원형 | max(일반, total-최소) | O(N) |
| 최대 곱 | max/min 동시 추적 | O(N) |

카데인 알고리즘은 "이전 결과를 유지할지 버릴지" 선택하는 그리디 DP의 핵심 패턴입니다. 많은 부분 배열 최적화 문제의 기반이 됩니다.

---

**지난 글:** [차이 배열(Difference Array)](/posts/dsa-difference-array/)

**다음 글:** [제곱근 분해(Sqrt Decomposition)](/posts/dsa-sqrt-decomposition/)

<br>
읽어주셔서 감사합니다. 😊
