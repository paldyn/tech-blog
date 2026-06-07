---
title: "퀵셀렉트 (Quickselect)"
description: "정렬 없이 k번째 작은 원소를 평균 O(N)에 구하는 퀵셀렉트의 파티션 원리, Lomuto 구현, Median of Medians 결정론적 알고리즘을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["퀵셀렉트", "Quickselect", "k번째원소", "파티션", "선형시간선택"]
featured: false
draft: false
---

[지난 글](/posts/dsa-meet-in-the-middle/)에서 지수 탐색을 절반으로 줄이는 Meet in the Middle을 다뤘습니다. 이번에는 정렬 없이 **k번째 작은 원소**를 평균 O(N)에 구하는 **퀵셀렉트(Quickselect)**입니다.

## 핵심 아이디어

퀵 정렬의 파티션 단계를 활용합니다. 피벗을 잡아 파티션하면 피벗의 **최종 인덱스**가 확정됩니다. 이 인덱스가 k와 같으면 정답이고, 작으면 오른쪽, 크면 왼쪽만 재귀합니다.

퀵 정렬이 양쪽 모두를 재귀하는 반면, 퀵셀렉트는 **한쪽만** 재귀합니다. 평균 처리량이 `N + N/2 + N/4 + ... = 2N = O(N)`으로 수렴합니다.

![퀵셀렉트 개념 및 파티션 과정](/assets/posts/dsa-quickselect-concept.svg)

## 구현 (Lomuto 파티션)

![퀵셀렉트 Lomuto 파티션 구현](/assets/posts/dsa-quickselect-impl.svg)

```python
import random

def quickselect(arr, k, lo=0, hi=None):
    """k번째 작은 원소 반환 (0-indexed, in-place)"""
    if hi is None:
        hi = len(arr) - 1
    if lo == hi:
        return arr[lo]

    # 랜덤 피벗 선택 → 최악 O(N²) 방지
    pivot_i = random.randint(lo, hi)
    arr[pivot_i], arr[hi] = arr[hi], arr[pivot_i]
    pivot = arr[hi]
    store = lo

    for i in range(lo, hi):
        if arr[i] <= pivot:
            arr[store], arr[i] = arr[i], arr[store]
            store += 1
    arr[store], arr[hi] = arr[hi], arr[store]

    if k == store:
        return arr[store]
    elif k < store:
        return quickselect(arr, k, lo, store - 1)
    else:
        return quickselect(arr, k, store + 1, hi)
```

`store` 위치가 파티션 후 피벗의 최종 인덱스입니다. 왼쪽은 모두 `<= pivot`, 오른쪽은 모두 `> pivot`입니다.

## 시간 복잡도 분석

| 경우 | 복잡도 | 조건 |
|------|--------|------|
| 평균 | O(N) | 랜덤 피벗 |
| 최악 | O(N²) | 피벗이 항상 최솟값/최댓값 |
| Median of Medians | O(N) | 결정론적 피벗 선택 |

랜덤 피벗으로 최악 케이스를 실용적으로 회피합니다. 이론적으로 완벽한 O(N) 보장이 필요하면 Median of Medians를 씁니다.

## Median of Medians (결정론적 O(N))

5개씩 묶어 중앙값을 구하고, 그 중앙값들의 중앙값을 피벗으로 씁니다.

```python
def median_of_medians(arr, lo, hi):
    n = hi - lo + 1
    if n <= 5:
        return sorted(arr[lo:hi+1])[n // 2]
    # 5개씩 청크로 나눠 중앙값 리스트 구성
    medians = []
    for i in range(lo, hi + 1, 5):
        chunk = sorted(arr[i:min(i + 5, hi + 1)])
        medians.append(chunk[len(chunk) // 2])
    return median_of_medians(medians, 0, len(medians) - 1)
```

피벗이 항상 전체의 30~70% 사이에 위치하므로 재귀 깊이 O(log N), 전체 O(N)이 보장됩니다.

## 퀵셀렉트 vs 정렬 후 인덱싱

```python
# 방법 A: 정렬 후 인덱싱 — O(N log N)
arr.sort()
result = arr[k]

# 방법 B: 퀵셀렉트 — 평균 O(N), 원본 배열 변경됨
result = quickselect(arr[:], k)  # 복사본 전달

# 방법 C: heapq.nsmallest — O(N log k)
import heapq
result = heapq.nsmallest(k + 1, arr)[-1]
```

k가 작을 때는 힙(`O(N log k)`), k가 중간 범위일 때는 퀵셀렉트, 여러 순위를 한꺼번에 필요로 할 때는 정렬을 씁니다.

## 주의사항

- 퀵셀렉트는 원본 배열을 **변경**합니다. 원본 보존이 필요하면 복사본을 전달하세요.
- Python의 `random.randint`는 충분히 균일하지만, 악의적인 입력에 대비하려면 매 실행마다 시드를 달리 해야 합니다.
- k는 0-indexed입니다. "1번째 작은 값"은 `k=0`입니다.

---

**지난 글:** [중간에서 만나기(Meet in the Middle)](/posts/dsa-meet-in-the-middle/)

**다음 글:** [상위 K개 원소(Top-K Elements)](/posts/dsa-top-k-elements/)

<br>
읽어주셔서 감사합니다. 😊
