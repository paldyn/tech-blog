---
title: "셸 정렬(Shell Sort)"
description: "삽입 정렬을 간격(gap)으로 확장한 셸 정렬의 원리, Knuth·Hibbard·Ciura 간격 수열, O(N^1.5)~O(N log²N) 복잡도 분석, 불안정 정렬인 이유를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["셸정렬", "ShellSort", "정렬", "Gap수열", "불안정정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-insertion-sort/)에서 삽입 정렬의 O(N) 최선 성능과 Tim Sort와의 관계를 살펴봤습니다. 이번에는 **셸 정렬(Shell Sort)**입니다. 셸 정렬은 삽입 정렬의 단점(원소가 멀리 있을 때 이동 거리가 큼)을 간격(gap)을 이용한 분할로 해결한 알고리즘입니다.

## 핵심 아이디어

삽입 정렬의 병목은 작은 원소가 배열 오른쪽 끝에 있을 때 왼쪽 끝으로 이동하는 데 N번 이동이 필요하다는 점입니다. 셸 정렬은 처음에 큰 간격으로 서브 배열을 나눠 삽입 정렬하고, 점점 간격을 줄여 마지막에 gap=1(일반 삽입 정렬)로 마무리합니다. 큰 간격 단계에서 원소의 "대략적 위치"를 잡아두면, gap=1 단계에서 이동 거리가 매우 짧아집니다.

![셸 정렬 간격 축소 과정](/assets/posts/dsa-shell-sort-gaps.svg)

## 구현 (Knuth 간격 수열)

Knuth 수열 `1, 4, 13, 40, 121, ...`(gap = 3*gap + 1)은 구현이 단순하고 실전 성능이 좋습니다.

```cpp
void shellSort(vector<int>& a) {
    int n = a.size();
    int gap = 1;
    while (gap < n / 3) gap = gap * 3 + 1; // Knuth 수열 상한
    while (gap >= 1) {
        for (int i = gap; i < n; i++) {
            int key = a[i];
            int j = i;
            while (j >= gap && a[j - gap] > key) {
                a[j] = a[j - gap];
                j -= gap;
            }
            a[j] = key;
        }
        gap /= 3;
    }
}
```

![셸 정렬 Knuth 구현](/assets/posts/dsa-shell-sort-code.svg)

## 간격 수열과 복잡도

간격 수열 선택이 복잡도를 결정합니다.

| 수열 | 공식 | 복잡도 |
|---|---|---|
| Shell (1959) | N/2, N/4, ..., 1 | O(N²) |
| Hibbard (1963) | 1, 3, 7, 15, ... (2^k-1) | O(N^{3/2}) |
| **Knuth (1973)** | 1, 4, 13, 40, ... (3^k-1)/2 | **O(N^{3/2})** |
| Sedgewick (1986) | 1, 5, 19, 41, ... | O(N^{4/3}) |
| **Ciura (2001)** | 1,4,10,23,57,132,301,701 | 실험적 최적 |

Ciura 수열은 이론적 분석이 없지만 실험적으로 가장 빠릅니다.

```python
# Ciura 수열 사용
GAPS = [701, 301, 132, 57, 23, 10, 4, 1]

def shell_sort(a):
    for gap in GAPS:
        for i in range(gap, len(a)):
            key = a[i]
            j = i
            while j >= gap and a[j - gap] > key:
                a[j] = a[j - gap]
                j -= gap
            a[j] = key
```

## 불안정 정렬인 이유

gap > 1인 단계에서 같은 키를 가진 원소가 다른 서브 배열에 배치되어 상대 순서가 바뀔 수 있습니다. 예: `[2a, 1, 2b]`에서 gap=2 단계에 2a와 2b가 모두 이동하면 순서가 뒤집힐 수 있습니다.

## 실전 활용

- 추가 메모리 없이(O(1) 공간) O(N log N)에 가까운 성능
- 임베디드, 메모리 제약 환경에서 선택 정렬 대신
- 표준 라이브러리보다 빠르지 않지만, 직접 구현할 때 고려

현대 실전 코드에서는 대부분 std::sort(퀵 정렬 + 힙 정렬 + 삽입 정렬 하이브리드)를 사용합니다.

---

**지난 글:** [삽입 정렬(Insertion Sort)](/posts/dsa-insertion-sort/)

**다음 글:** [병합 정렬(Merge Sort)](/posts/dsa-merge-sort/)

<br>
읽어주셔서 감사합니다. 😊
