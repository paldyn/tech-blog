---
title: "삽입 정렬(Insertion Sort)"
description: "정렬된 구간에 새 원소를 올바른 위치에 삽입하는 삽입 정렬의 원리, 안정 정렬 특성, 거의 정렬된 데이터에서 O(N) 성능, 이진 탐색 최적화, Tim Sort와의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["삽입정렬", "InsertionSort", "정렬", "안정정렬", "TimSort"]
featured: false
draft: false
---

[지난 글](/posts/dsa-selection-sort/)에서 선택 정렬을 다뤘습니다. 이번에는 **삽입 정렬(Insertion Sort)**입니다. 카드 게임에서 손에 쥔 카드를 순서에 맞게 끼워 넣는 방식과 동일합니다. 거의 정렬된 데이터에서 O(N)에 가까운 성능을 내고, Tim Sort의 기반이 되는 중요한 알고리즘입니다.

## 동작 원리

배열의 두 번째 원소부터 시작해, 현재 원소(key)를 이미 정렬된 왼쪽 구간의 올바른 위치에 삽입합니다. 삽입 위치를 찾을 때 key보다 큰 원소들을 오른쪽으로 한 칸씩 밀어 공간을 만듭니다.

![삽입 정렬 카드 삽입 과정](/assets/posts/dsa-insertion-sort-process.svg)

## 구현

```cpp
void insertionSort(vector<int>& a) {
    int n = a.size();
    for (int i = 1; i < n; i++) {
        int key = a[i];
        int j = i - 1;
        // key보다 큰 원소들을 오른쪽으로 밀기
        while (j >= 0 && a[j] > key) {
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = key;
    }
}
```

![삽입 정렬 구현 및 이진 탐색 최적화](/assets/posts/dsa-insertion-sort-binary.svg)

## 복잡도 분석

| 경우 | 비교 | 이동 |
|---|---|---|
| 최선 (정렬됨) | O(N) | O(1) |
| 평균 | O(N²) | O(N²) |
| 최악 (역순) | O(N²) | O(N²) |

**최선 케이스가 O(N)인 이유**: 이미 정렬된 배열이라면 각 원소의 while 루프가 한 번도 실행되지 않아 전체가 N번 비교로 끝납니다.

공간 복잡도는 O(1) — 제자리 정렬이고, **안정 정렬**입니다(`>` 조건으로 같은 값은 이동하지 않음).

## 이진 탐색 최적화

삽입 위치를 이진 탐색으로 찾으면 비교 횟수는 O(N log N)으로 줄지만, 원소 이동(shift)은 여전히 O(N²)입니다. 따라서 배열 기반에서는 시간 복잡도 전체를 줄이지 못합니다. 연결 리스트라면 이동 없이 O(1) 삽입이 가능합니다.

```python
import bisect

def binary_insertion_sort(a):
    for i in range(1, len(a)):
        key = a[i]
        pos = bisect.bisect_left(a, key, 0, i)
        a[pos+1:i+1] = a[pos:i]  # shift
        a[pos] = key
```

## 거의 정렬된 데이터

삽입 정렬의 이동 횟수는 **역위(inversion) 수**와 정확히 같습니다. 역위가 k개이면 O(N + k)가 됩니다. 거의 정렬된 데이터(역위 수 ≈ O(N))에서 삽입 정렬은 O(N)에 가까운 성능을 냅니다.

```text
[1, 2, 3, 5, 4] → 역위 1개 → O(N+1) = O(N)
[5, 4, 3, 2, 1] → 역위 10개 → O(N²)
```

## Tim Sort와의 관계

파이썬과 자바의 표준 정렬인 **Tim Sort**는 삽입 정렬과 병합 정렬을 결합합니다. 배열을 작은 "런(run)"으로 나누어 각 런을 삽입 정렬로 정렬하고, 런들을 병합 정렬로 합칩니다. 작은 크기에서 삽입 정렬의 뛰어난 캐시 지역성과 적응성을 활용합니다.

```text
Tim Sort 런 크기: 보통 32~64
- 런 정렬: 삽입 정렬 O(k²) but k 작음
- 런 병합: 병합 정렬 O(N log N)
- 전체: O(N log N), 정렬된 구간에서 O(N)
```

---

**지난 글:** [선택 정렬(Selection Sort)](/posts/dsa-selection-sort/)

**다음 글:** [셸 정렬(Shell Sort)](/posts/dsa-shell-sort/)

<br>
읽어주셔서 감사합니다. 😊
