---
title: "버블 정렬(Bubble Sort)"
description: "인접 원소를 비교·교환해 큰 값을 오른쪽으로 밀어내는 버블 정렬의 동작 원리, 조기 종료 최적화, O(N²) 복잡도 분석, 안정 정렬 특성과 실전 활용 범위를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["버블정렬", "BubbleSort", "정렬", "안정정렬", "비교정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-lca-binary-lifting/)에서 LCA 이진 리프팅을 다뤘습니다. 이제 **정렬 알고리즘** 시리즈를 시작합니다. 첫 번째는 **버블 정렬(Bubble Sort)**입니다. 구현이 가장 단순한 정렬이지만, 안정 정렬이고 이미 정렬된 배열에 O(N) 조기 종료가 가능해 교육적 가치가 높습니다.

## 동작 원리

배열을 왼쪽부터 순회하며 인접한 두 원소를 비교하고, 순서가 잘못됐으면 교환합니다. 한 번의 패스(pass)가 끝나면 가장 큰 값이 맨 오른쪽에 자리를 잡습니다. 이 과정을 N-1번 반복합니다.

"거품(bubble)"이라는 이름은 큰 값이 물 위의 거품처럼 오른쪽으로 떠오르는 모습에서 유래합니다.

![버블 정렬 패스별 진행 과정](/assets/posts/dsa-bubble-sort-process.svg)

## 구현

기본 구현에서 중요한 최적화는 **조기 종료(early exit)**입니다. 한 패스에서 교환이 한 번도 발생하지 않으면 배열이 이미 정렬된 것이므로 즉시 종료합니다.

```cpp
void bubbleSort(vector<int>& a) {
    int n = a.size();
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                swap(a[j], a[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break; // 이미 정렬됨
    }
}
```

![버블 정렬 최적화 구현](/assets/posts/dsa-bubble-sort-code.svg)

## 복잡도 분석

| 경우 | 비교 횟수 | 이유 |
|---|---|---|
| 최선 (이미 정렬됨) | O(N) | 1번 패스 후 교환 없어 종료 |
| 평균 | O(N²) | 약 N²/4 비교 |
| 최악 (역순 정렬) | O(N²) | N(N-1)/2 비교·교환 |

공간 복잡도는 O(1) — 제자리 정렬입니다.

## 안정 정렬

버블 정렬은 **안정 정렬**입니다. `a[j] > a[j+1]`일 때만 교환하므로, 같은 키를 가진 원소들의 상대 순서가 보존됩니다. (`>=` 조건으로 교환하면 불안정해집니다.)

## 실전 활용

버블 정렬은 N이 큰 데이터에 사용하기엔 너무 느립니다. 그러나 다음 상황에서는 의미가 있습니다.

- **교육**: 정렬 알고리즘의 첫 번째 예시로 이해하기 쉬움
- **거의 정렬된 데이터**: 조기 종료 덕분에 O(N)에 가까운 성능
- **메모리 제약이 극단적인 임베디드**: 추가 공간 0, 코드 크기 최소

현업에서는 대부분 퀵 정렬, 병합 정렬, 또는 표준 라이브러리의 `std::sort`를 사용합니다.

## 변형: 칵테일 정렬

버블 정렬을 앞뒤 양방향으로 교대로 수행하는 변형입니다. "거북이"(왼쪽 끝에 있는 작은 값)가 느리게 이동하는 문제를 완화합니다.

```python
def cocktail_sort(a):
    left, right = 0, len(a) - 1
    while left < right:
        for i in range(left, right):
            if a[i] > a[i+1]: a[i], a[i+1] = a[i+1], a[i]
        right -= 1
        for i in range(right, left, -1):
            if a[i] < a[i-1]: a[i], a[i-1] = a[i-1], a[i]
        left += 1
```

여전히 O(N²)이지만 상수 계수가 작아지는 경우가 있습니다.

---

**지난 글:** [LCA — 이진 리프팅(Binary Lifting)](/posts/dsa-lca-binary-lifting/)

**다음 글:** [선택 정렬(Selection Sort)](/posts/dsa-selection-sort/)

<br>
읽어주셔서 감사합니다. 😊
