---
title: "이진 탐색(Binary Search)"
description: "정렬된 배열에서 O(log N)에 값을 찾는 이진 탐색의 경계 조건, lower_bound·upper_bound 패턴, 오버플로우 방지, 실전 라이브러리 활용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["이진탐색", "BinarySearch", "lowerBound", "upperBound", "O(logN)"]
featured: false
draft: false
---

[지난 글](/posts/dsa-linear-search/)에서 O(N) 선형 탐색을 다뤘습니다. 이번에는 **이진 탐색(Binary Search)**입니다. 정렬된 배열에서 매 단계마다 탐색 범위를 절반으로 줄여 **O(log N)**에 원소를 찾습니다. N=10억이라도 30번이면 충분합니다.

## 핵심 원리

정렬된 배열에서 중간값(mid)을 확인합니다:
- `a[mid] == target` → 발견
- `a[mid] < target` → 오른쪽 절반만 탐색 (`lo = mid + 1`)
- `a[mid] > target` → 왼쪽 절반만 탐색 (`hi = mid - 1`)

![이진 탐색: target=23 탐색 과정](/assets/posts/dsa-binary-search-process.svg)

## 기본 구현

```cpp
int binarySearch(vector<int>& a, int target) {
    int lo = 0, hi = (int)a.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;  // 오버플로우 방지!
        if (a[mid] == target) return mid;
        else if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}
```

**오버플로우 방지**: `(lo + hi) / 2`는 lo, hi가 모두 큰 값이면 int 오버플로우가 발생합니다. `lo + (hi - lo) / 2`로 쓰는 것이 안전합니다.

## lower_bound / upper_bound

실전에서 이진 탐색의 진짜 핵심은 **정확한 일치보다 경계 탐색**입니다.

- **lower_bound**: `a[i] >= target`인 가장 작은 인덱스
- **upper_bound**: `a[i] > target`인 가장 작은 인덱스

```cpp
// t 이상인 첫 인덱스
int lowerBound(vector<int>& a, int t) {
    int lo = 0, hi = a.size();  // hi = n (범위 밖)
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < t) lo = mid + 1;
        else hi = mid;
    }
    return lo;  // lo == hi 보장
}

// t 초과인 첫 인덱스
int upperBound(vector<int>& a, int t) {
    int lo = 0, hi = a.size();
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= t) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

// t의 등장 횟수
int count_t = upperBound(a, t) - lowerBound(a, t);
```

![이진 탐색 구현 패턴과 경계 조건](/assets/posts/dsa-binary-search-code.svg)

## 경계 조건 정리

경계 조건은 이진 탐색에서 가장 자주 틀리는 부분입니다.

| 패턴 | hi 초기값 | while 조건 | 종료 보장 |
|---|---|---|---|
| 정확 일치 | `n - 1` | `lo <= hi` | hi < lo |
| lower/upper_bound | `n` | `lo < hi` | lo == hi |

`lo < hi` 패턴에서 `hi = mid` (not `mid - 1`)로 좁히는 이유: hi가 정답의 후보이므로 제외하면 안 됩니다.

## STL / 파이썬 라이브러리

```python
import bisect

a = [1, 3, 5, 7, 9, 11]

# 정확 탐색
idx = bisect.bisect_left(a, 5)   # lower_bound → 2
print(a[idx] == 5)               # True

# 삽입 위치
pos = bisect.bisect_right(a, 5)  # upper_bound → 3

# 등장 횟수
cnt = bisect.bisect_right(a, 7) - bisect.bisect_left(a, 7)  # 1
```

```cpp
// C++ STL
auto it = lower_bound(a.begin(), a.end(), target);
if (it != a.end() && *it == target)
    cout << (it - a.begin());  // 인덱스

// 등장 횟수
int cnt = upper_bound(a.begin(), a.end(), t)
        - lower_bound(a.begin(), a.end(), t);
```

## 재귀 구현

```python
def binary_search_rec(a, target, lo, hi):
    if lo > hi:
        return -1
    mid = lo + (hi - lo) // 2
    if a[mid] == target:
        return mid
    elif a[mid] < target:
        return binary_search_rec(a, target, mid + 1, hi)
    else:
        return binary_search_rec(a, target, lo, mid - 1)
```

재귀 깊이가 O(log N)이므로 스택 오버플로우 위험이 거의 없지만, 반복 버전이 상수 계수 면에서 더 빠릅니다.

## 복잡도와 선형 탐색 비교

| N | 선형 탐색 | 이진 탐색 |
|---|---|---|
| 100 | 최대 100 | 최대 7 |
| 10,000 | 최대 10,000 | 최대 14 |
| 1,000,000 | 최대 1,000,000 | 최대 20 |
| 10⁹ | 최대 10⁹ | 최대 30 |

---

**지난 글:** [선형 탐색(Linear Search)](/posts/dsa-linear-search/)

**다음 글:** [정답에 이진 탐색(Binary Search on Answer)](/posts/dsa-binary-search-on-answer/)

<br>
읽어주셔서 감사합니다. 😊
