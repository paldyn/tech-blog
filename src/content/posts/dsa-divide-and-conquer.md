---
title: "분할 정복 (Divide and Conquer)"
description: "분할 정복의 세 단계(분할·정복·결합), 시간 복잡도 분석, 병합 정렬·퀵 정렬·이진 탐색 적용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["분할정복", "DivideAndConquer", "병합정렬", "알고리즘패러다임"]
featured: false
draft: false
---

[지난 글](/posts/dsa-recursion/)에서 재귀의 기본 구조와 콜 스택, 메모이제이션을 다뤘습니다. 이번에는 재귀를 활용하는 가장 강력한 알고리즘 패러다임 중 하나인 **분할 정복(Divide and Conquer)**을 살펴봅니다. 병합 정렬, 퀵 정렬, 이진 탐색, FFT 등 수많은 고전 알고리즘이 이 패러다임을 따릅니다.

## 세 단계

분할 정복은 문제를 **분할(Divide) → 정복(Conquer) → 결합(Combine)** 세 단계로 처리합니다.

1. **분할**: 문제를 동일한 유형의 더 작은 부분 문제로 나눕니다.
2. **정복**: 각 부분 문제를 재귀적으로 해결합니다. 문제가 충분히 작으면 기저 조건으로 직접 해결합니다.
3. **결합**: 부분 문제의 해를 합쳐 원래 문제의 해를 구성합니다.

핵심 요건은 **부분 문제가 원래 문제와 같은 구조**를 가져야 한다는 것입니다. 이 조건이 성립할 때 재귀 호출이 자연스럽게 적용됩니다.

![분할 정복 패러다임 - Merge Sort 시각화](/assets/posts/dsa-divide-and-conquer-paradigm.svg)

## 병합 정렬

분할 정복의 교과서적 예시입니다. 배열을 절반으로 나누고, 각 절반을 정렬한 뒤, 두 정렬된 배열을 병합합니다.

![병합 정렬 코드](/assets/posts/dsa-divide-and-conquer-code.svg)

```python
def merge_sort(arr):
    if len(arr) <= 1:        # 기저 조건
        return arr
    mid = len(arr) // 2      # 분할
    left  = merge_sort(arr[:mid])   # 정복
    right = merge_sort(arr[mid:])   # 정복
    return merge(left, right)        # 결합

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]
```

병합 정렬의 복잡도: T(N) = 2T(N/2) + O(N) → **O(N log N)**. 최선·평균·최악 모두 동일하며, 안정 정렬(Stable Sort)입니다.

## 시간 복잡도 분석 - 마스터 정리

분할 정복 알고리즘의 복잡도는 **마스터 정리(Master Theorem)**로 구합니다.

재귀 점화식이 `T(N) = a·T(N/b) + f(N)` 형태일 때, `p = log_b(a)`로 두면:

| 케이스 | 조건 | 복잡도 |
|--------|------|--------|
| 케이스 1 | f(N) = O(N^(p-ε)) | T(N) = Θ(N^p) |
| 케이스 2 | f(N) = Θ(N^p) | T(N) = Θ(N^p · log N) |
| 케이스 3 | f(N) = Ω(N^(p+ε)) | T(N) = Θ(f(N)) |

주요 알고리즘 예시:

| 알고리즘 | a | b | f(N) | 복잡도 |
|----------|---|---|------|--------|
| 병합 정렬 | 2 | 2 | N | O(N log N) |
| 이진 탐색 | 1 | 2 | 1 | O(log N) |
| 카라츠바 곱셈 | 3 | 2 | N | O(N^1.585) |
| 행렬 곱셈(Strassen) | 7 | 2 | N² | O(N^2.807) |

## 퀵 정렬

퀵 정렬도 분할 정복이지만, 분할 기준(피벗)이 동적이며 결합 단계가 없습니다.

```python
def quick_sort(arr, lo, hi):
    if lo < hi:
        # 분할: 피벗을 기준으로 분리
        pivot_idx = partition(arr, lo, hi)
        # 정복: 각 절반을 재귀 정렬
        quick_sort(arr, lo, pivot_idx - 1)
        quick_sort(arr, pivot_idx + 1, hi)
        # 결합 없음: 제자리 정렬

def partition(arr, lo, hi):
    pivot = arr[hi]
    i = lo - 1
    for j in range(lo, hi):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i+1], arr[hi] = arr[hi], arr[i+1]
    return i + 1
```

퀵 정렬 평균: O(N log N). 최악(이미 정렬된 배열): O(N²). 랜덤 피벗 선택으로 최악 케이스를 방지합니다.

## 이진 탐색

이진 탐색은 "결합" 단계가 없는 가장 단순한 분할 정복입니다.

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2    # 분할
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1         # 오른쪽 절반만 정복
        else:
            hi = mid - 1         # 왼쪽 절반만 정복
    return -1
```

## 분할 정복 vs 동적 프로그래밍

두 패러다임의 차이는 **부분 문제의 중복 여부**입니다.

- **분할 정복**: 부분 문제들이 서로 독립적. 중복 없음. 각 부분 문제를 한 번씩만 풂.
- **동적 프로그래밍**: 부분 문제가 중복됨. 메모이제이션 또는 테이블화로 중복 계산 제거.

피보나치는 부분 문제가 중복되므로 DP가 적합하고, 병합 정렬은 부분 문제가 독립적이므로 D&C가 적합합니다.

## 분할 정복의 실전 패턴

```python
def divide_and_conquer(problem, l, r):
    # 1. 기저 조건
    if r - l <= threshold:
        return brute_force(problem, l, r)

    # 2. 분할
    mid = (l + r) // 2

    # 3. 정복
    left_ans  = divide_and_conquer(problem, l, mid)
    right_ans = divide_and_conquer(problem, mid+1, r)

    # 4. 결합
    return combine(left_ans, right_ans, problem, l, mid, r)
```

이 템플릿은 다음 글에서 다룰 **가장 가까운 두 점** 문제에 직접 적용됩니다. 2D 평면의 N개 점에서 가장 가까운 두 점을 O(N log N)에 찾는 문제는 분할 정복의 비직관적인 적용 사례로, 면접에서도 자주 등장합니다.

---

**지난 글:** [재귀 (Recursion)](/posts/dsa-recursion/)

**다음 글:** [가장 가까운 두 점 (Closest Pair of Points)](/posts/dsa-closest-pair-of-points/)

<br>
읽어주셔서 감사합니다. 😊
