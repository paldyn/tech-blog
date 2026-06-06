---
title: "정렬 안정성(Sorting Stability)"
description: "동일 키의 상대 순서를 보존하는 안정 정렬의 정의와 중요성, 알고리즘별 안정성 비교표, 불안정 정렬을 안정으로 만드는 기법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["안정정렬", "SortingStability", "StableSort", "정렬비교", "다중키정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-external-sorting/)에서 외부 정렬을 다뤘습니다. 이번에는 정렬 알고리즘의 핵심 속성 중 하나인 **정렬 안정성(Sorting Stability)**입니다. 안정성이 왜 중요한지, 어떤 알고리즘이 안정하고 왜 그런지 살펴봅니다.

## 안정 정렬의 정의

**안정 정렬(Stable Sort)**: 동일한 키를 가진 원소들이 정렬 후에도 **원래 입력 순서를 유지**하는 정렬.

예를 들어 (이름, 점수) 레코드를 점수 기준으로 정렬할 때:

```
입력: [Alice:3, Bob:1, Carol:3, Dave:2, Eve:1]

안정 정렬 후: [Bob:1, Eve:1, Dave:2, Alice:3, Carol:3]
                  ↑         ↑                ↑         ↑
             Bob before Eve 유지     Alice before Carol 유지

불안정 정렬 후: [Eve:1, Bob:1, Dave:2, Carol:3, Alice:3]  (가능)
                  ↑순서 바뀜↑               ↑순서 바뀜↑
```

![안정 정렬 vs 불안정 정렬 비교](/assets/posts/dsa-sorting-stability-compare.svg)

## 왜 안정성이 중요한가?

### 1. 다중 키 정렬 (Multi-key Sort)

학생을 학년으로 먼저 정렬한 뒤 이름으로 재정렬할 때, **안정 정렬을 쓰면** 이름 정렬 후에도 같은 이름 안에서 학년 순서가 유지됩니다.

```python
students = [('Alice', 2), ('Bob', 1), ('Alice', 1), ('Bob', 2)]
# 이름 기준 안정 정렬
sorted_students = sorted(students, key=lambda x: x[0])
# [('Alice', 2), ('Alice', 1), ('Bob', 1), ('Bob', 2)]
# Alice 내에서는 2→1 순서 유지 (원래 순서)
```

### 2. 기수 정렬의 정확성

기수 정렬은 낮은 자릿수부터 정렬하므로 **각 단계가 안정 정렬**이어야 합니다. 그렇지 않으면 이전 단계 결과가 깨집니다.

### 3. UI/UX 사용자 경험

사용자가 테이블을 열 A로 정렬한 뒤 열 B로 재정렬할 때, 안정 정렬이면 B가 같은 항목들이 A 순서를 유지합니다. 스프레드시트, 데이터베이스 GUI에서 중요합니다.

## 알고리즘별 안정성

| 안정 | 불안정 |
|---|---|
| 버블 정렬 | 선택 정렬 |
| 삽입 정렬 | 퀵 정렬 |
| 병합 정렬 | 힙 정렬 |
| 카운팅 정렬 | 셸 정렬 |
| 기수 정렬 | Introsort |
| 버킷 정렬 | — |
| 팀 정렬 | — |

![정렬 알고리즘 완전 비교표](/assets/posts/dsa-sorting-stability-table.svg)

## 각 알고리즘의 안정성 이유

**삽입 정렬이 안정한 이유**: `a[j] > key` 조건에서 등호를 포함하지 않아 같은 값의 원소는 이동하지 않습니다.

**퀵 정렬이 불안정한 이유**: 파티션 과정에서 같은 값의 원소가 피벗 기준으로 양쪽에 임의 배치될 수 있습니다.

**힙 정렬이 불안정한 이유**: heapify 과정에서 부모-자식 교환이 원래 순서와 무관하게 발생합니다.

**병합 정렬이 안정한 이유**: 병합 시 왼쪽 부분 배열 원소를 `<=` 조건으로 먼저 선택하면 같은 값에서 왼쪽(원래 앞) 원소가 먼저 배치됩니다.

```python
def stable_merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:  # 왼쪽 먼저 (등호 포함 = 안정성)
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]
```

## 불안정 정렬을 안정으로 만들기

인덱스를 비교 키에 추가해 타이브레이킹(Tiebreaking)으로 사용합니다.

```python
def stable_sort_wrapper(a, key=lambda x: x):
    # (키값, 원래인덱스, 원소) 튜플로 변환
    tagged = [(key(x), i, x) for i, x in enumerate(a)]
    tagged.sort()  # 파이썬 기본 sort = 팀 정렬 (안정)
    return [x for _, _, x in tagged]

# 퀵 정렬에도 적용 가능:
import functools
def stable_quicksort(a, key=lambda x: x):
    indexed = [(key(x), i, x) for i, x in enumerate(a)]
    # 인덱스가 타이브레이커 역할
    indexed.sort(key=lambda t: (t[0], t[1]))
    return [x for _, _, x in indexed]
```

O(N) 추가 공간이 필요하지만, 불안정 정렬을 그대로 쓸 수 있습니다.

## 실전 언어별 안정성 보장

| 언어 | 정렬 함수 | 안정성 | 알고리즘 |
|---|---|---|---|
| Python | `list.sort()`, `sorted()` | 보장 | Tim Sort |
| Java | `Arrays.sort(Object[])` | 보장 | Tim Sort |
| Java | `Arrays.sort(int[])` | 미보장 | Dual-Pivot Quick |
| C++ | `std::stable_sort` | 보장 | Merge Sort |
| C++ | `std::sort` | 미보장 | Introsort |
| JavaScript | `Array.prototype.sort` | 보장 (ES2019+) | Tim Sort |

JavaScript는 ES2019부터 안정 정렬을 표준 요구사항으로 명시했습니다.

---

**지난 글:** [외부 정렬(External Sorting)](/posts/dsa-external-sorting/)

**다음 글:** [선형 탐색(Linear Search)](/posts/dsa-linear-search/)

<br>
읽어주셔서 감사합니다. 😊
