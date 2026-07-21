---
title: "힙 정렬(Heap Sort)"
description: "Max-Heap을 이용해 항상 O(N log N)을 보장하는 힙 정렬의 Build-Heap 과정, heapify, 제자리 정렬 구현, 그리고 퀵/병합 정렬과의 실전 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["힙정렬", "HeapSort", "MaxHeap", "heapify", "우선순위큐"]
featured: false
draft: false
---

[지난 글](/posts/dsa-quick-sort/)에서 평균 O(N log N)의 퀵 정렬을 다뤘습니다. 이번에는 **힙 정렬(Heap Sort)**로, 최선·평균·최악 모두 O(N log N)을 보장하며 추가 메모리 없이 제자리에서 정렬하는 알고리즘입니다.

## 힙이란?

**힙(Heap)**은 완전 이진 트리의 일종으로, **Max-Heap**은 부모 노드가 자식보다 항상 크거나 같은 성질을 가집니다. 배열로 표현할 때 인덱스 `i`의 왼쪽 자식은 `2i+1`, 오른쪽 자식은 `2i+2`입니다.

```text
배열: [4, 10, 3, 5, 1]

         4(0)
       /      \
    10(1)     3(2)
   /    \
 5(3)   1(4)
```

Max-Heap으로 만들면: `[10, 5, 3, 4, 1]` — 루트(인덱스 0)가 항상 최댓값입니다.

## heapify: 힙 성질 복원

```cpp
void heapify(int* a, int n, int i) {
    int largest = i;
    int l = 2*i+1, r = 2*i+2;
    if (l < n && a[l] > a[largest]) largest = l;
    if (r < n && a[r] > a[largest]) largest = r;
    if (largest != i) {
        swap(a[i], a[largest]);
        heapify(a, n, largest); // 재귀적으로 아래 서브트리도 복원
    }
}
```

`i` 위치의 원소가 자식보다 작으면 가장 큰 자식과 교환하고, 바뀐 위치에서 다시 heapify를 반복합니다. 시간 복잡도는 트리 높이에 비례해 **O(log N)**입니다.

![힙 정렬: 힙 구축과 추출 과정](/assets/posts/dsa-heap-sort-structure.svg)

## Build-Max-Heap: O(N)

배열 전체를 힙으로 만들 때, 단순히 heapify를 N번 호출하면 O(N log N)이 됩니다. 그러나 **리프 노드부터 Bottom-up으로** 처리하면 O(N)입니다.

```cpp
// 리프는 이미 힙 조건 만족 → 내부 노드(n/2-1 ~ 0)만 처리
for (int i = n/2 - 1; i >= 0; i--)
    heapify(a, n, i);
```

이 최적화의 핵심: 트리 하단 절반은 리프이므로 heapify 비용이 0이고, 상위 레벨로 올라갈수록 노드 수가 절반으로 줄기 때문에 전체 합산이 O(N)으로 수렴합니다.

## heapSort: 전체 구현

```cpp
void heapSort(int* a, int n) {
    // 1단계: Build Max-Heap O(N)
    for (int i = n/2 - 1; i >= 0; i--)
        heapify(a, n, i);

    // 2단계: 루트(최대값)를 끝으로 보내고 힙 크기 축소
    for (int i = n - 1; i > 0; i--) {
        swap(a[0], a[i]);    // 최대값 → 배열 끝 확정
        heapify(a, i, 0);    // 줄어든 힙에서 재복원
    }
}
```

![힙 정렬 heapify + heapSort 구현 코드](/assets/posts/dsa-heap-sort-code.svg)

## 복잡도 분석

| 단계 | 시간 |
|---|---|
| Build-Max-Heap | O(N) |
| N-1번 추출 × heapify | O(N log N) |
| **전체** | **O(N log N)** |
| 공간 복잡도 | **O(1)** — 제자리 정렬 |

퀵 정렬과 달리 **최악 케이스가 없습니다**. 재귀 호출은 heapify의 O(log N) 깊이뿐이므로 스택 오버플로우 위험도 낮습니다.

## 실전에서의 위치

힙 정렬은 **이론적으로 완벽**하지만 실전에서는 다음 이유로 퀵 정렬보다 느린 경우가 많습니다:

- **캐시 지역성(Cache Locality)** 부족: 힙은 배열의 멀리 떨어진 위치를 자주 참조합니다 (부모-자식 간격 = `i` vs `2i+1/2i+2`). 퀵 정렬은 연속 메모리를 참조해 캐시 히트율이 높습니다.
- **Introsort**: C++ `std::sort`, Java `Arrays.sort`(primitive) 등은 퀵 정렬 + 힙 정렬 + 삽입 정렬을 조합한 **Introsort**를 씁니다. 재귀 깊이가 2 log N을 초과하면 힙 정렬로 전환해 O(N log N) 최악을 보장합니다.

**언제 힙 정렬이 적합한가?**
- 추가 메모리를 절대 쓸 수 없는 임베디드 환경
- 최악 케이스 보장이 필수인 실시간 시스템
- 우선순위 큐 자체가 이미 힙으로 구현된 경우

## Python 구현

```python
def heapify(a, n, i):
    largest = i
    l, r = 2*i + 1, 2*i + 2
    if l < n and a[l] > a[largest]:
        largest = l
    if r < n and a[r] > a[largest]:
        largest = r
    if largest != i:
        a[i], a[largest] = a[largest], a[i]
        heapify(a, n, largest)

def heap_sort(a):
    n = len(a)
    for i in range(n // 2 - 1, -1, -1):
        heapify(a, n, i)
    for i in range(n - 1, 0, -1):
        a[0], a[i] = a[i], a[0]
        heapify(a, i, 0)
```

---

**지난 글:** [퀵 정렬(Quick Sort)](/posts/dsa-quick-sort/)

**다음 글:** [카운팅 정렬(Counting Sort)](/posts/dsa-counting-sort/)

<br>
읽어주셔서 감사합니다. 😊
