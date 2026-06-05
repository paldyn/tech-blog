---
title: "선택 정렬(Selection Sort)"
description: "미정렬 구간에서 최솟값을 찾아 앞으로 이동하는 선택 정렬의 원리, O(N²) 비교·O(N) 교환 특성, 불안정 정렬인 이유, 버블 정렬과의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["선택정렬", "SelectionSort", "정렬", "불안정정렬", "비교정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-bubble-sort/)에서 버블 정렬을 다뤘습니다. 이번에는 **선택 정렬(Selection Sort)**입니다. 미정렬 구간에서 최솟값을 찾아 맨 앞으로 보내는 방식으로, 버블 정렬보다 교환 횟수가 훨씬 적습니다.

## 동작 원리

배열을 정렬된 영역(왼쪽)과 미정렬 영역(오른쪽)으로 나누고, 매 단계마다 미정렬 영역에서 가장 작은 값을 찾아 미정렬 영역의 첫 번째 자리와 교환합니다. 이를 N-1번 반복하면 정렬이 완료됩니다.

![선택 정렬 최솟값 선택 과정](/assets/posts/dsa-selection-sort-process.svg)

## 구현

```cpp
void selectionSort(vector<int>& a) {
    int n = a.size();
    for (int i = 0; i < n - 1; i++) {
        int minIdx = i;
        for (int j = i + 1; j < n; j++) {
            if (a[j] < a[minIdx])
                minIdx = j;
        }
        if (minIdx != i)
            swap(a[i], a[minIdx]);
    }
}
```

![선택 정렬 구현 및 비교](/assets/posts/dsa-selection-sort-compare.svg)

## 복잡도 분석

비교 횟수는 항상 `(N-1) + (N-2) + ... + 1 = N(N-1)/2`로 **O(N²)**입니다. 입력이 이미 정렬되어 있어도 줄어들지 않습니다.

교환 횟수는 최대 N-1번입니다. 버블 정렬의 최악 O(N²) 교환에 비해 훨씬 적습니다.

| 항목 | 복잡도 |
|---|---|
| 시간 (최선/평균/최악) | O(N²) |
| 교환 횟수 | O(N) |
| 공간 | O(1) |
| 안정성 | 불안정 |

## 불안정 정렬인 이유

같은 키를 가진 원소가 있을 때 비인접 교환이 상대 순서를 깨뜨릴 수 있습니다. 예를 들어 `[3a, 3b, 1]`을 정렬하면 1을 3a 자리로 가져오면서 `[1, 3b, 3a]`가 되어 3a, 3b 순서가 바뀝니다.

안정성이 필요하다면 교환 대신 삽입으로 구현(삽입 정렬 방식)하거나 다른 안정 정렬을 사용해야 합니다.

## 선택 정렬이 유리한 상황

- **쓰기 비용이 비싼 매체**: 플래시 메모리처럼 쓰기 횟수에 따라 수명이 줄어드는 매체에서는 교환 횟수 최소화가 중요합니다.
- **원소 이동 비용이 큰 경우**: 원소 자체가 크고 비교는 빠를 때, 교환을 최소화하는 선택 정렬이 유리할 수 있습니다.

## 힙 정렬과의 관계

선택 정렬의 핵심 아이디어(매번 최솟값 선택)를 유지하면서 최솟값 탐색을 O(log N)으로 줄인 것이 **힙 정렬**입니다. 힙 정렬은 선택 정렬의 O(N) 최솟값 탐색을 힙 자료구조로 개선한 결과입니다.

```
선택 정렬: 최솟값 탐색 O(N) × N회 = O(N²)
힙 정렬:  최솟값 추출 O(log N) × N회 = O(N log N)
```

---

**지난 글:** [버블 정렬(Bubble Sort)](/posts/dsa-bubble-sort/)

**다음 글:** [삽입 정렬(Insertion Sort)](/posts/dsa-insertion-sort/)

<br>
읽어주셔서 감사합니다. 😊
