---
title: "정답에 이진 탐색(Binary Search on Answer)"
description: "최솟값의 최댓값·최댓값의 최솟값 형태 최적화 문제를 O(N log X)에 해결하는 파라메트릭 서치의 단조 함수 조건, 템플릿, 대표 문제 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["파라메트릭서치", "ParametricSearch", "BinarySearchOnAnswer", "이진탐색응용", "최적화"]
featured: false
draft: false
---

[지난 글](/posts/dsa-binary-search/)에서 정렬된 배열에서 값을 찾는 이진 탐색을 다뤘습니다. 이번에는 이진 탐색을 **배열이 아닌 정답 후보 공간**에 적용하는 **파라메트릭 서치(Parametric Search)**, 즉 정답에 이진 탐색입니다.

## 핵심 아이디어

"최솟값의 최댓값"이나 "최댓값의 최솟값"처럼 **최적화 문제**를 이진 탐색으로 풀 수 있을 때가 있습니다. 조건은 단 하나:

> **정답 후보 공간에서 `feasible(x)` 함수의 결과가 단조(monotone)해야 한다.**

`feasible(x) = "x가 가능한 정답인가?"` 함수가 `F F F ... F T T ... T` 또는 `T T T ... T F F ... F` 형태여야 합니다. 이 경계(경계)가 바로 정답입니다.

![파라메트릭 서치: 단조 함수와 정답 경계](/assets/posts/dsa-binary-search-on-answer-concept.svg)

## 템플릿

```python
def feasible(mid):
    # 문제별 구현: mid가 가능한 정답인지 판단
    pass

def binary_search_on_answer(lo, hi):
    # feasible이 True인 가장 작은 값 탐색
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):
            hi = mid       # True → 더 작은 값 탐색
        else:
            lo = mid + 1   # False → 더 큰 값 탐색
    return lo  # lo == hi == 정답
```

**최댓값의 최솟값** 탐색:
- feasible이 True이면 `hi = mid` (더 작은 값 탐색)
- 종료 시 `lo = hi = 정답`

**최솟값의 최댓값** 탐색 (반전):
- feasible이 True이면 `lo = mid + 1` (더 큰 값 탐색)
- 종료 시 `lo - 1 = 정답` (또는 `hi = 정답`)

## 대표 예제: 나무 자르기

N개의 나무를 절단기로 잘라 총 M미터 이상 얻으려 할 때, 절단기 높이 H의 최댓값을 구합니다.

```cpp
bool feasible(vector<int>& h, long long H, long long M) {
    long long total = 0;
    for (int x : h) if (x > H) total += x - H;
    return total >= M;
}

int solve(vector<int>& h, long long M) {
    long long lo = 0, hi = *max_element(h.begin(), h.end());
    while (lo < hi) {
        long long mid = lo + (hi - lo + 1) / 2;  // 최댓값 탐색 시 올림
        if (feasible(h, mid, M)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
```

![나무 자르기 예제: 이진 탐색 과정](/assets/posts/dsa-binary-search-on-answer-example.svg)

**최댓값을 탐색할 때 mid 계산**: `lo + (hi - lo + 1) / 2`로 올림 나눗셈을 씁니다. `lo = mid`로 업데이트할 때 `mid = lo`이면 무한 루프에 빠지기 때문입니다.

## 자주 나오는 패턴

| 문제 유형 | feasible(x) 정의 | 탐색 방향 |
|---|---|---|
| 최대 부하 최소화 | "부하 x로 M명이 처리 가능?" | 최솟값 탐색 |
| 최소 거리 최대화 | "간격 x 이상으로 배치 가능?" | 최댓값 탐색 |
| k번째 원소 | "x 이하 원소 수 >= k?" | 최솟값 탐색 |
| 최대 수익 | "이익 x 이상 달성 가능?" | 최댓값 탐색 |

## 연속 공간 이진 탐색 (실수)

정답이 실수일 때는 반복 횟수로 루프를 제어합니다.

```python
def ternary_feasible(x):
    # 실수 공간에서 판단
    pass

lo, hi = 0.0, 1e9
for _ in range(100):  # 오차 = 1e9 / 2^100 ≈ 0
    mid = (lo + hi) / 2
    if feasible(mid):
        hi = mid
    else:
        lo = mid
# 또는 while hi - lo > 1e-9:
```

## 복잡도

파라메트릭 서치의 전체 복잡도는 `O(feasible 시간 × log(정답 범위))`.

- feasible이 O(N): 전체 O(N log X) — X = 정답 범위
- feasible이 O(N log N): 전체 O(N log N × log X)

이 구조 덕분에 **직접 최적화하면 NP가 될 문제**도 O(N log X)로 해결할 수 있습니다.

## 파라메트릭 서치 체크리스트

문제를 받았을 때 파라메트릭 서치 적용 여부를 확인하는 방법:

1. "최소화/최대화"가 등장하는가?
2. 정답 공간이 정수 or 실수 범위인가?
3. "정답 x가 가능한지" 판단하는 함수가 단조인가?
4. feasible 판단이 직접 최적화보다 쉬운가?

4가지 모두 Yes이면 파라메트릭 서치를 적용합니다.

```python
# BOJ 1654: 랜선 자르기 — k개 이상 얻을 수 있는 최대 길이
def feasible(cables, length, k):
    return sum(c // length for c in cables) >= k

lo, hi = 1, max(cables)
while lo < hi:
    mid = lo + (hi - lo + 1) // 2
    if feasible(cables, mid, k):
        lo = mid
    else:
        hi = mid - 1
answer = lo
```

---

**지난 글:** [이진 탐색(Binary Search)](/posts/dsa-binary-search/)

<br>
읽어주셔서 감사합니다. 😊
