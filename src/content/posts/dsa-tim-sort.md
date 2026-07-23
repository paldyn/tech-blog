---
title: "팀 정렬(Tim Sort)"
description: "Python과 Java의 기본 정렬 알고리즘인 팀 정렬의 Run 탐지·minRun 계산·갤로핑 병합·병합 불변식 등 핵심 기법과 실전 성능 특성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["팀정렬", "TimSort", "Python정렬", "안정정렬", "하이브리드정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-bucket-sort/)에서 분포 기반 버킷 정렬을 다뤘습니다. 이번에는 **팀 정렬(Tim Sort)**입니다. Python의 `list.sort()`, Java의 `Arrays.sort(Object[])` 등이 채택한 하이브리드 정렬로, 삽입 정렬과 병합 정렬을 결합해 **실제 데이터에서 탁월한 성능**을 보입니다.

## Tim Sort란?

Tim Peters가 2002년 Python에 도입한 **하이브리드 정렬 알고리즘**입니다. 실세계 데이터는 완전히 무작위가 아니라 **부분적으로 정렬된 구간(Run)**이 존재한다는 관찰에서 출발합니다.

- 삽입 정렬: 소규모 데이터에서 빠름, 안정 정렬
- 병합 정렬: 대규모 데이터에서 안정 O(N log N), 안정 정렬
- 팀 정렬: 두 가지를 조합해 **이미 정렬된 데이터를 재활용**

## 핵심 단계

### 1. Run 탐지

배열을 선형 탐색하며 **연속 오름/내림 구간(Run)**을 찾습니다. 내림 Run은 뒤집어 오름으로 만듭니다.

```python
def find_run(a, lo, hi):
    run_end = lo + 1
    if run_end == hi:
        return run_end
    if a[run_end] < a[lo]:   # 내림 Run
        while run_end < hi and a[run_end] < a[run_end-1]:
            run_end += 1
        a[lo:run_end] = reversed(a[lo:run_end])
    else:                    # 오름 Run
        while run_end < hi and a[run_end] >= a[run_end-1]:
            run_end += 1
    return run_end
```

![팀 정렬: Run 탐지와 병합 과정](/assets/posts/dsa-tim-sort-concept.svg)

### 2. minRun: 최소 Run 길이

Run이 너무 짧으면 병합 오버헤드가 커집니다. **minRun** (32~64)보다 짧은 Run은 **삽입 정렬로 연장**합니다.

```python
def min_run(n):
    r = 0
    while n >= 64:
        r |= n & 1
        n >>= 1
    return n + r  # 32 <= 결과 <= 64
```

minRun을 32~64로 유지하면 병합 횟수가 log₂(N/minRun)으로 최적화됩니다.

### 3. Run 스택과 병합 불변식

찾은 Run을 **스택**에 쌓습니다. 스택 맨 위 3개 Run의 길이를 `X, Y, Z` (위에서 아래)라 할 때 두 조건이 유지되어야 합니다:

```text
1. Z > Y + X
2. Y > X
```

조건을 위반하면 즉시 병합합니다. 이 **불변식**이 병합 횟수를 O(N log N)으로 보장하고 실전에서 균형 잡힌 병합 트리를 만듭니다.

### 4. Galloping(갤로핑) 모드

병합 시 한쪽 Run에서 연속 **7회 이상 이기면** 갤로핑 모드로 전환합니다. 이진 탐색으로 경계를 찾아 **블록 단위 복사**해 비교 횟수를 줄입니다.

```text
A: [1, 2, 3, 100, 101]   B: [50, 60, 70]

일반 병합: 1→2→3→... (비교 3회로 A[0..2] 처리)
갤로핑:   A[0..2] 통째로 복사 후 B[0] 비교
```

![팀 정렬: minRun 계산과 갤로핑 병합](/assets/posts/dsa-tim-sort-merge.svg)

## 복잡도

| 경우 | 시간 | 비고 |
|---|---|---|
| 최선 | **O(N)** | 이미 정렬된 경우 (Run 1개) |
| 평균 | **O(N log N)** | 실제 데이터는 대부분 이에 가까움 |
| 최악 | **O(N log N)** | 완전 역순 등 |
| 공간 | O(N) | 병합용 임시 버퍼 |
| 안정성 | **안정** | — |

## 실전 활용 언어/환경

| 환경 | 정렬 알고리즘 |
|---|---|
| Python `list.sort()` | Tim Sort |
| Java `Arrays.sort(Object[])` | Tim Sort |
| Java `Collections.sort()` | Tim Sort |
| Android Java | Tim Sort |
| C++ `std::sort` | Introsort (퀵+힙+삽입) |
| Java `Arrays.sort(int[])` | Dual-Pivot Quick Sort |

## 실제 효과

```python
import random
import time

# 부분 정렬 데이터: Tim Sort가 빠름
data = list(range(10**6))
random.shuffle(data[:1000])  # 앞 0.1%만 섞음

# Python sort() = Tim Sort
# 이미 정렬된 99.9% 구간은 O(N) 처리
```

실제 로그, 타임스탬프, 사용자 입력 등 **부분 정렬된 데이터가 흔한 환경**에서 Tim Sort는 이론적 평균(O(N log N))보다 훨씬 빠르게 동작합니다.

---

**지난 글:** [버킷 정렬(Bucket Sort)](/posts/dsa-bucket-sort/)

**다음 글:** [외부 정렬(External Sorting)](/posts/dsa-external-sorting/)

<br>
읽어주셔서 감사합니다. 😊
