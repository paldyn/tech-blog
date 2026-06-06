---
title: "카운팅 정렬(Counting Sort)"
description: "비교 없이 O(N+K)에 정렬하는 카운팅 정렬의 세 단계(빈도 집계·누적합·역방향 배치), 안정 정렬 보장 원리, 기수 정렬과의 연계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["카운팅정렬", "CountingSort", "선형시간정렬", "안정정렬", "비교기반하한"]
featured: false
draft: false
---

[지난 글](/posts/dsa-heap-sort/)에서 O(N log N)을 보장하는 힙 정렬을 다뤘습니다. 이번에는 비교 연산을 전혀 쓰지 않고 **O(N + K)**에 정렬하는 **카운팅 정렬(Counting Sort)**입니다. 값의 범위 K가 충분히 작다면 이론적 하한(Ω(N log N))을 깨는 선형 시간 정렬이 가능합니다.

## 핵심 아이디어

비교 기반 정렬은 "A가 B보다 크냐?"를 반복하므로 최소 Ω(N log N) 비교가 필요합니다. 카운팅 정렬은 **각 값이 몇 번 등장하는지 직접 세어** 위치를 계산하므로 비교가 없습니다. 단, 값이 0~K 범위의 정수여야 합니다.

## 3단계 알고리즘

```python
def counting_sort(a, k):
    # k = 최댓값
    c = [0] * (k + 1)   # 1단계: 빈도 집계
    for x in a:
        c[x] += 1

    for i in range(1, k + 1):  # 2단계: 누적합
        c[i] += c[i - 1]

    b = [0] * len(a)
    for x in reversed(a):      # 3단계: 역방향 배치
        c[x] -= 1
        b[c[x]] = x
    return b
```

**1단계 — 빈도 집계**: `c[x]`에 값 `x`의 등장 횟수를 저장합니다.

**2단계 — 누적합**: `c[x]`를 `x` 이하인 원소의 총 수로 바꿉니다. 이 값이 곧 `x`가 출력 배열에서 마지막으로 배치될 위치 + 1입니다.

**3단계 — 역방향 배치**: 입력을 역순으로 읽으며 `b[--c[a[i]]] = a[i]`로 배치합니다. 역방향이 중요한 이유는 같은 값이 여러 개일 때 **상대 순서를 유지(안정 정렬)**하기 위해서입니다.

![카운팅 정렬 3단계 과정](/assets/posts/dsa-counting-sort-process.svg)

## C++ 구현

```cpp
void countingSort(int* a, int n, int k) {
    vector<int> c(k + 1, 0), b(n);
    // 1. 빈도 집계
    for (int x : array(a, a+n)) c[x]++;
    // 2. 누적합
    for (int i = 1; i <= k; i++) c[i] += c[i-1];
    // 3. 역방향 배치
    for (int i = n-1; i >= 0; i--) b[--c[a[i]]] = a[i];
    copy(b.begin(), b.end(), a);
}
```

![카운팅 정렬 구현 코드](/assets/posts/dsa-counting-sort-code.svg)

## 복잡도 분석

| 단계 | 시간 | 공간 |
|---|---|---|
| 빈도 집계 | O(N) | O(K) |
| 누적합 | O(K) | — |
| 역방향 배치 | O(N) | O(N) |
| **전체** | **O(N + K)** | **O(N + K)** |

K ≪ N이면 사실상 O(N). K가 N보다 훨씬 크면 메모리와 시간 모두 낭비되므로 적합하지 않습니다.

## 안정 정렬인 이유

역방향 배치에서 같은 값 `x`가 여러 개 있을 때, 입력 배열에서 나중에 나온 `x`일수록 `c[x]--` 후 더 앞 위치에 배치됩니다 — 결과적으로 원래 순서(먼저 나온 것이 더 앞)가 보존됩니다.

이 안정성은 **기수 정렬(Radix Sort)**의 핵심 요건입니다. 기수 정렬은 카운팅 정렬을 자릿수별 서브루틴으로 사용하므로 안정성이 깨지면 전체 결과가 틀려집니다.

## 실전 활용 패턴

```python
# 빈도 분포 → 정렬된 순서로 재구성 (가장 단순한 버전)
from collections import Counter

def counting_sort_simple(a):
    cnt = Counter(a)
    return [x for x in range(min(a), max(a)+1) for _ in range(cnt[x])]
```

이 단순 버전은 객체가 아닌 정수 자체만 복원하므로 안정 정렬이 의미 없을 때 씁니다. 레코드(키+값 쌍)를 정렬할 때는 3단계 역방향 배치가 필요합니다.

## 활용 사례

- **기수 정렬(Radix Sort)** 내부 서브루틴 (K=10, K=256)
- **성적 분포** 계산 — 0~100 점수 정렬
- **알파벳 정렬** — 소문자 26가지 K=25
- **히스토그램** 생성 — 픽셀 값 0~255

---

**지난 글:** [힙 정렬(Heap Sort)](/posts/dsa-heap-sort/)

**다음 글:** [기수 정렬(Radix Sort)](/posts/dsa-radix-sort/)

<br>
읽어주셔서 감사합니다. 😊
