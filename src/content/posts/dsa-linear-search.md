---
title: "선형 탐색(Linear Search)"
description: "배열을 처음부터 끝까지 순차 비교하는 선형 탐색의 기본 구현, Sentinel 최적화, Self-organizing 탐색, 실전 활용 패턴과 이진 탐색 전환 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["선형탐색", "LinearSearch", "순차탐색", "Sentinel", "탐색알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-sorting-stability/)에서 정렬 안정성을 다뤘습니다. 이번부터는 **탐색(Search)** 알고리즘 시리즈입니다. 첫 번째는 가장 단순한 탐색인 **선형 탐색(Linear Search)**으로, 구현이 쉽고 정렬되지 않은 배열에서도 사용할 수 있어 여전히 중요합니다.

## 기본 구현

배열의 첫 원소부터 순서대로 target과 비교합니다.

```cpp
int linearSearch(int* a, int n, int target) {
    for (int i = 0; i < n; i++)
        if (a[i] == target) return i;
    return -1;  // 없음
}
```

Python에서는 `in` 연산자가 내부적으로 선형 탐색을 수행합니다:

```python
# list에서 선형 탐색
7 in [3, 41, 52, 26, 38, 57, 9, 49, 7, 18]  # True

# 인덱스까지 필요하면
def linear_search(a, target):
    for i, x in enumerate(a):
        if x == target:
            return i
    return -1
```

![선형 탐색: 순차적 비교 과정](/assets/posts/dsa-linear-search-process.svg)

## 복잡도 분석

| 경우 | 시간 |
|---|---|
| 최선 | O(1) — 첫 번째 원소 |
| 평균 | O(N/2) ≈ O(N) |
| 최악 | O(N) — 마지막이거나 없음 |
| 공간 | O(1) |

## Sentinel 탐색: 분기 최소화

일반 선형 탐색은 루프마다 두 조건(`i < n`, `a[i] == target`)을 검사합니다. **Sentinel** 기법은 배열 끝에 target을 미리 심어두면 경계 검사 없이도 루프가 반드시 종료됩니다.

```cpp
int sentinelSearch(int* a, int n, int target) {
    int last = a[n-1];
    a[n-1] = target;    // 배열 끝에 sentinel 배치
    int i = 0;
    while (a[i] != target) i++;  // 경계 검사 불필요
    a[n-1] = last;      // 복원
    return (i < n-1 || a[n-1] == target) ? i : -1;
}
```

루프당 비교가 2→1회로 줄어 실제로 30~50% 빠르게 동작합니다. 특히 캐시 미스가 드문 소규모 배열에서 효과적입니다.

![선형 탐색 최적화: Sentinel + Self-organizing](/assets/posts/dsa-linear-search-variants.svg)

## Self-organizing Search

탐색 후 발견된 원소를 배열 앞쪽으로 이동합니다. 자주 탐색하는 원소가 앞에 모이면 평균 탐색 시간이 줄어듭니다.

```python
def self_organizing_search(a, target):
    for i in range(len(a)):
        if a[i] == target:
            # Move-to-front: 발견 원소를 앞으로
            a.insert(0, a.pop(i))
            return 0
    return -1
```

**두 가지 변형**:
- **Move-to-front**: 발견 원소를 맨 앞으로 이동 — 핫 데이터가 O(1)에 수렴
- **Transpose**: 발견 원소를 한 칸 앞으로 — 더 안정적, 순서 변화 완만

## 언제 선형 탐색을 써야 하나?

| 상황 | 권장 탐색 |
|---|---|
| 정렬되지 않은 배열, 소규모(N < 100) | **선형 탐색** |
| 연결 리스트 | **선형 탐색** (이진 탐색 불가) |
| 정렬된 배열, 대규모 | **이진 탐색** |
| 해시 가능한 키 | **해시 탐색** O(1) |
| 자주 동일 키 탐색 | **캐시·Self-organizing** |

**소규모 배열에서 선형이 이진보다 빠른 이유**: 이진 탐색은 `log₂N` 번 분기하지만, 캐시 미스와 분기 예측 오버헤드가 있습니다. N ≈ 10~30 수준에서는 선형이 상수 계수 면에서 유리합니다.

## 링크드 리스트 탐색

연결 리스트는 임의 접근이 불가능하므로 선형 탐색만 가능합니다.

```python
def list_search(head, target):
    cur = head
    while cur:
        if cur.val == target:
            return cur
        cur = cur.next
    return None
```

---

**지난 글:** [정렬 안정성(Sorting Stability)](/posts/dsa-sorting-stability/)

**다음 글:** [이진 탐색(Binary Search)](/posts/dsa-binary-search/)

<br>
읽어주셔서 감사합니다. 😊
