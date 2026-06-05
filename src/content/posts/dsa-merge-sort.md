---
title: "병합 정렬(Merge Sort)"
description: "분할 정복으로 O(N log N)을 보장하는 병합 정렬의 원리, top-down·bottom-up 구현, 안정 정렬 특성, O(N) 추가 메모리, 역위 수 세기 응용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["병합정렬", "MergeSort", "분할정복", "안정정렬", "O(NlogN)"]
featured: false
draft: false
---

[지난 글](/posts/dsa-shell-sort/)에서 간격 수열로 삽입 정렬을 개선한 셸 정렬을 살펴봤습니다. 이번에는 **병합 정렬(Merge Sort)**입니다. 분할 정복 패러다임의 대표 알고리즘으로, 최선/평균/최악 모두 **O(N log N)**을 보장하는 유일한 비교 기반 정렬 중 하나입니다.

## 핵심 아이디어

1. **분할(Divide)**: 배열을 절반으로 나눔
2. **정복(Conquer)**: 각 절반을 재귀적으로 정렬
3. **병합(Merge)**: 두 정렬된 절반을 합쳐 하나의 정렬된 배열 생성

병합 과정에서 두 포인터로 양쪽을 비교하며 순서대로 합치므로 O(N)이고, 재귀 트리 깊이가 log N이어서 전체 O(N log N)입니다.

![병합 정렬 분할 정복 트리](/assets/posts/dsa-merge-sort-tree.svg)

## 구현 (Top-Down)

```cpp
void merge(vector<int>& a, int l, int m, int r) {
    vector<int> tmp;
    int i = l, j = m + 1;
    while (i <= m && j <= r)
        tmp.push_back(a[i] <= a[j] ? a[i++] : a[j++]);
    while (i <= m) tmp.push_back(a[i++]);
    while (j <= r) tmp.push_back(a[j++]);
    copy(tmp.begin(), tmp.end(), a.begin() + l);
}

void mergeSort(vector<int>& a, int l, int r) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    mergeSort(a, l, m);
    mergeSort(a, m + 1, r);
    merge(a, l, m, r);
}
```

![병합 정렬 병합 구현](/assets/posts/dsa-merge-sort-code.svg)

## Bottom-Up 병합 정렬

재귀 없이 반복문으로 구현합니다. 크기 1짜리 서브 배열부터 시작해 크기를 두 배씩 늘리며 병합합니다.

```cpp
void mergeSortIterative(vector<int>& a) {
    int n = a.size();
    for (int size = 1; size < n; size *= 2) {
        for (int l = 0; l < n - size; l += 2 * size) {
            int m = l + size - 1;
            int r = min(l + 2 * size - 1, n - 1);
            merge(a, l, m, r);
        }
    }
}
```

스택 오버플로 걱정이 없고 메모리 할당 패턴이 예측 가능합니다.

## 복잡도

| 항목 | 값 |
|---|---|
| 시간 (최선/평균/최악) | O(N log N) |
| 공간 | O(N) — 보조 배열 필요 |
| 안정성 | 안정 |

**안정 정렬인 이유**: 병합 시 `a[i] <= a[j]`일 때 왼쪽을 먼저 취하므로 같은 키는 원래 순서를 유지합니다.

**O(N) 공간**: 병합 시 보조 배열이 필요합니다. 제자리 병합 정렬도 가능하지만 구현이 복잡하고 상수 계수가 커집니다.

## 역위(Inversion) 수 세기

병합 정렬의 병합 단계를 이용해 배열의 역위 수를 O(N log N)에 셀 수 있습니다. 오른쪽 절반의 원소 j가 왼쪽 절반의 원소 i보다 먼저 선택될 때마다 `(m - i + 1)`만큼 역위를 누적합니다.

```cpp
long long mergeCount(vector<int>& a, int l, int m, int r) {
    long long inv = 0;
    int i = l, j = m + 1;
    vector<int> tmp;
    while (i <= m && j <= r) {
        if (a[i] <= a[j]) tmp.push_back(a[i++]);
        else {
            inv += m - i + 1; // i~m 모두 a[j]보다 큼
            tmp.push_back(a[j++]);
        }
    }
    // ...나머지 복사
    return inv;
}
```

## 연결 리스트 정렬

연결 리스트는 랜덤 접근이 없어 퀵 정렬이 비효율적이지만, 병합 정렬은 인접 노드만 참조하므로 **O(N log N), O(log N) 공간**으로 효율적으로 정렬할 수 있습니다.

---

**지난 글:** [셸 정렬(Shell Sort)](/posts/dsa-shell-sort/)

**다음 글:** [퀵 정렬(Quick Sort)](/posts/dsa-quick-sort/)

<br>
읽어주셔서 감사합니다. 😊
