---
title: "퀵 정렬(Quick Sort)"
description: "피벗 선택과 파티션으로 평균 O(N log N)을 달성하는 퀵 정렬의 Lomuto·Hoare 파티션, 3-way 파티션, 랜덤 피벗, 최악 O(N²) 회피 전략과 실전 최적화를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["퀵정렬", "QuickSort", "파티션", "분할정복", "불안정정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-merge-sort/)에서 항상 O(N log N)을 보장하는 병합 정렬을 다뤘습니다. 이번에는 **퀵 정렬(Quick Sort)**입니다. 평균 O(N log N)이지만 최악 O(N²)이 될 수 있음에도 실전에서는 캐시 지역성과 낮은 상수 계수 덕분에 병합 정렬보다 빠른 경우가 많습니다.

## 핵심 아이디어

피벗(pivot) 원소를 하나 선택해 배열을 "피벗보다 작은 것 | 피벗 | 피벗보다 큰 것"으로 나눕니다(파티션). 피벗은 최종 위치에 확정되고, 두 서브 배열을 재귀적으로 정렬합니다.

![퀵 정렬 Lomuto 파티션 과정](/assets/posts/dsa-quick-sort-partition.svg)

## Lomuto 파티션

구현이 단순합니다. i는 "피벗보다 작은 원소들의 경계"를 추적합니다.

```cpp
int partition(vector<int>& a, int l, int r) {
    int pivot = a[r]; // 마지막 원소를 피벗으로
    int i = l - 1;
    for (int j = l; j < r; j++) {
        if (a[j] <= pivot)
            swap(a[++i], a[j]);
    }
    swap(a[i + 1], a[r]); // 피벗을 제자리로
    return i + 1;
}

void quickSort(vector<int>& a, int l, int r) {
    if (l < r) {
        int p = partition(a, l, r);
        quickSort(a, l, p - 1);
        quickSort(a, p + 1, r);
    }
}
```

## Hoare 파티션

두 포인터를 양쪽에서 좁혀 교환합니다. Lomuto보다 교환 횟수가 적고 실전에서 약간 더 빠릅니다.

```cpp
int hoarePartition(vector<int>& a, int l, int r) {
    int pivot = a[l + (r - l) / 2];
    int i = l - 1, j = r + 1;
    while (true) {
        do { i++; } while (a[i] < pivot);
        do { j--; } while (a[j] > pivot);
        if (i >= j) return j;
        swap(a[i], a[j]);
    }
}
```

## 3-way 파티션 (중복 키 최적화)

중복 키가 많으면 `[lt, gt]` 구간에 모든 피벗 동일 값을 모아 재귀 범위를 줄입니다. 모두 같은 키이면 O(N)으로 처리됩니다.

![3-way 파티션 구현](/assets/posts/dsa-quick-sort-code.svg)

## 복잡도와 피벗 전략

| 피벗 선택 | 최선 | 평균 | 최악 |
|---|---|---|---|
| 첫/마지막 원소 | O(N log N) | O(N log N) | O(N²) |
| **랜덤 피벗** | O(N log N) | **O(N log N)** | O(N²) 극히 드묾 |
| 중앙값(median-of-3) | O(N log N) | O(N log N) | O(N²) 드묾 |

최악 케이스는 이미 정렬된 배열에 첫/마지막 피벗을 쓸 때 발생합니다. **랜덤 피벗**으로 이를 확률적으로 회피합니다.

## 공간 복잡도

재귀 스택 깊이가 평균 O(log N), 최악 O(N)입니다. 큰 서브 배열에 먼저 재귀하거나, 크기 임계값 이하에서 삽입 정렬로 전환하면 스택을 O(log N)으로 제한할 수 있습니다.

## 실전 최적화 (Introsort)

C++의 `std::sort`는 **Introsort**로 구현됩니다.

- 기본: 퀵 정렬 (캐시 효율, 낮은 상수)
- 재귀 깊이 > 2 log N: 힙 정렬로 전환 (최악 O(N²) 방지)
- 크기 ≤ 16: 삽입 정렬로 전환 (소규모 배열 최적)

```cpp
// 개념적 introsort
void introsort(a, l, r, depth_limit) {
    if (r - l < 16) insertionSort(a, l, r);
    else if (depth_limit == 0) heapSort(a, l, r);
    else {
        p = partition(a, l, r);
        introsort(a, l, p-1, depth_limit-1);
        introsort(a, p+1, r, depth_limit-1);
    }
}
```

## 불안정 정렬

비인접 교환으로 같은 키를 가진 원소의 상대 순서가 바뀔 수 있습니다. 안정 정렬이 필요하면 `std::stable_sort`(병합 정렬 기반)를 사용합니다.

---

**지난 글:** [병합 정렬(Merge Sort)](/posts/dsa-merge-sort/)

<br>
읽어주셔서 감사합니다. 😊
