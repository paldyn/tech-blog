---
title: "중간에서 만나기 (Meet in the Middle)"
description: "O(2ᴺ) 완전 탐색을 O(2^(N/2) · log N)으로 줄이는 Meet in the Middle 기법의 원리, 부분합 문제 구현, 적용 조건을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 2
type: "knowledge"
category: "Algorithm"
tags: ["MeetInTheMiddle", "분할정복", "부분합", "지수시간최적화", "탐색"]
featured: false
draft: false
---

[지난 글](/posts/dsa-ternary-search/)에서 단봉 함수의 최적값을 찾는 삼분 탐색을 다뤘습니다. 이번에는 지수 시간 완전 탐색을 절반의 지수로 줄이는 **중간에서 만나기(Meet in the Middle)** 기법입니다.

## 문제 배경

N개의 원소를 가진 집합에서 **부분집합의 합이 target인 경우의 수**를 구한다고 합시다. 완전 탐색의 복잡도는 `O(2ᴺ)`입니다. N = 40이면 `2⁴⁰ ≈ 1조`로 불가능합니다.

이진 탐색으로 해결할 수도 없습니다. 정렬된 단조 구조가 없기 때문입니다. 그런데 집합을 **반으로 쪼개면** 이야기가 달라집니다.

![중간에서 만나기 개념](/assets/posts/dsa-meet-in-the-middle-concept.svg)

## 핵심 아이디어

1. 집합 A를 왼쪽 절반 L과 오른쪽 절반 R로 나눕니다.
2. L의 **모든 부분집합 합** sums_L을 열거합니다. (`2^(N/2)` 개)
3. R의 **모든 부분집합 합** sums_R을 열거하고 **정렬**합니다.
4. 각 `l ∈ sums_L`에 대해 `target - l`이 sums_R에 있는지 **이진 탐색**합니다.

각 단계 비용: `O(2^(N/2))` + `O(2^(N/2) log N)` = **O(2^(N/2) · N/2)**

N = 40 기준: `2²⁰ × 20 ≈ 2000만` 연산. 완전 탐색 1조 대비 **5만 배** 빠릅니다.

## 구현

![부분합 쌍 개수 구하기](/assets/posts/dsa-meet-in-the-middle-impl.svg)

```python
from bisect import bisect_left, bisect_right
from itertools import combinations

def count_pairs(A, target):
    n = len(A)
    L, R = A[:n // 2], A[n // 2:]

    # 왼쪽 절반 부분합 전체 열거
    sums_L = []
    for k in range(len(L) + 1):
        for c in combinations(L, k):
            sums_L.append(sum(c))

    # 오른쪽 절반 부분합 정렬
    sums_R = sorted(
        sum(c)
        for k in range(len(R) + 1)
        for c in combinations(R, k)
    )

    # 이진 탐색으로 매칭
    count = 0
    for l in sums_L:
        need = target - l
        count += bisect_right(sums_R, need) - bisect_left(sums_R, need)
    return count
```

## 비트 마스크로 빠른 열거

조합(combinations) 대신 비트 마스크를 쓰면 상수 인자가 줄어듭니다.

```python
def enumerate_sums(arr):
    n = len(arr)
    sums = []
    for mask in range(1 << n):
        s = sum(arr[i] for i in range(n) if mask >> i & 1)
        sums.append(s)
    return sums
```

N/2 = 20이면 `1 << 20 = 1,048,576`번 반복. 실용적입니다.

## 더 어려운 응용: 4-SUM

4개의 배열 A, B, C, D에서 `a + b + c + d = target`인 쌍 찾기.

1. A + B 의 모든 합 → hash_map에 저장
2. C + D 의 모든 합 → hash_map 조회

`O(N²)` 으로 해결. 순수 완전 탐색 `O(N⁴)` 대비 훨씬 빠릅니다.

## 적용 가능 조건

| 조건 | 내용 |
|------|------|
| N 범위 | 30 ≤ N ≤ 50 (2^N 불가, 2^(N/2) 가능) |
| 분할 가능성 | 독립적인 두 부분으로 분리 |
| 조합 방식 | 각 절반을 완전 탐색 후 merge |

N이 25 이하면 완전 탐색이 더 단순하고, N이 50보다 크면 Meet in the Middle도 불가합니다.

---

**지난 글:** [삼분 탐색(Ternary Search)](/posts/dsa-ternary-search/)

**다음 글:** [퀵셀렉트(Quickselect)](/posts/dsa-quickselect/)

<br>
읽어주셔서 감사합니다. 😊
