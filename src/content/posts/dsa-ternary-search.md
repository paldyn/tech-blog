---
title: "삼분 탐색 (Ternary Search)"
description: "단봉 함수의 최댓값·최솟값을 O(log N)에 구하는 삼분 탐색의 원리, 정수·실수 구현 패턴, 이진 탐색과의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["삼분탐색", "TernarySearch", "단봉함수", "최적화", "탐색알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-binary-search-on-answer/)에서 이진 탐색을 정답 공간에 적용하는 파라메트릭 서치를 다뤘습니다. 이번에는 같은 탐색 아이디어를 **단봉 함수(Unimodal Function)**에 적용하는 **삼분 탐색(Ternary Search)**입니다.

## 단봉 함수란

삼분 탐색이 작동하려면 탐색 대상이 **단봉 함수**여야 합니다. 단봉 함수는 최대 하나의 극값(극대 또는 극소)을 가지며, 그 전까지는 단조 증가, 그 이후로는 단조 감소하는 함수입니다.

예시: 포물선 `f(x) = -(x-5)²`, 구간 내 볼록 함수, 여러 물리·기하 최적화 문제.

![삼분 탐색: 단봉 함수와 탐색 구간 축소](/assets/posts/dsa-ternary-search-concept.svg)

## 핵심 아이디어

구간 `[lo, hi]`를 세 등분하는 두 점 `m1`, `m2`를 잡습니다.

```text
m1 = lo + (hi - lo) / 3
m2 = hi - (hi - lo) / 3
```

그리고 `f(m1)`과 `f(m2)`를 비교합니다.

- `f(m1) < f(m2)` → 최대값은 m1 오른쪽에 있으므로 `lo = m1 + 1`
- `f(m1) > f(m2)` → 최대값은 m2 왼쪽에 있으므로 `hi = m2 - 1`
- `f(m1) == f(m2)` → 최대값은 `[m1, m2]` 사이에 있으므로 `lo = m1 + 1`, `hi = m2 - 1`

한 번의 비교로 구간이 **2/3로 줄어듭니다**. 이를 반복하면 `O(log₃ N)`에 정답을 구합니다.

## 정수형 vs 실수형 구현

두 구현 패턴이 있습니다. 정수 좌표에서 이산적인 최적값을 구할 때와, 연속 실수 범위에서 수렴값을 구할 때입니다.

![삼분 탐색 구현 패턴](/assets/posts/dsa-ternary-search-impl.svg)

```python
# 정수형: hi - lo <= 2 가 될 때까지 반복
def ternary_search_int(lo, hi):
    while hi - lo > 2:
        m1 = lo + (hi - lo) // 3
        m2 = hi - (hi - lo) // 3
        if f(m1) < f(m2):
            lo = m1 + 1
        else:
            hi = m2 - 1
    return max(f(x) for x in range(lo, hi + 1))

# 실수형: 충분한 횟수(100~200회) 반복으로 수렴
def ternary_search_real(lo, hi):
    for _ in range(200):
        m1 = lo + (hi - lo) / 3
        m2 = hi - (hi - lo) / 3
        if f(m1) < f(m2):
            lo = m1
        else:
            hi = m2
    return (lo + hi) / 2
```

실수형에서 반복 횟수 200회면 구간이 `(2/3)^200 ≈ 10^{-35}` 배로 줄어 충분합니다.

## 이진 탐색과의 비교

| 항목 | 이진 탐색 | 삼분 탐색 |
|------|-----------|-----------|
| 적용 대상 | 단조 함수 | 단봉 함수 |
| 비교 횟수 | 1회/반복 | 2회/반복 |
| 구간 축소율 | 1/2 | 2/3 |
| 시간 복잡도 | O(log₂ N) | O(log₁.₅ N) ≈ O(log N) |

이진 탐색이 단조성을, 삼분 탐색이 단봉성을 활용합니다. 함수 형태가 단봉이지만 단조가 아닐 때 삼분 탐색을 씁니다.

## 대표 적용 사례

**기하 최적화**: 볼록 다각형 위의 점에서 특정 점까지 최소 거리 구하기.

```python
# 볼록 다각형의 꼭짓점 배열 poly에서 점 P까지 최소 거리
def closest_on_convex(poly, P):
    n = len(poly)
    lo, hi = 0, n - 1
    while hi - lo > 2:
        m1 = lo + (hi - lo) // 3
        m2 = hi - (hi - lo) // 3
        if dist(poly[m1], P) < dist(poly[m2], P):
            hi = m2 - 1
        else:
            lo = m1 + 1
    return min(dist(poly[i], P) for i in range(lo, hi + 1))
```

**이차 함수 최솟값**: `f(x) = ax² + bx + c` 꼴의 볼록 함수에서 최솟값 x 탐색.

## 주의사항

- 함수가 **엄격히 단봉**이어야 합니다. 평평한 구간(plateau)이 있으면 `f(m1) == f(m2)` 처리를 추가해야 합니다.
- 정수형에서 종료 조건 `hi - lo <= 2`를 놓치면 무한 루프에 빠질 수 있습니다.
- 이진 탐색으로 풀 수 있는 문제라면 이진 탐색이 더 빠릅니다(비교 1회 vs 2회).

---

**지난 글:** [정답에 이진 탐색(Binary Search on Answer)](/posts/dsa-binary-search-on-answer/)

**다음 글:** [중간에서 만나기(Meet in the Middle)](/posts/dsa-meet-in-the-middle/)

<br>
읽어주셔서 감사합니다. 😊
