---
title: "단조 스택 (Monotonic Stack)"
description: "스택의 원소를 단조 증가 또는 단조 감소로 유지해 Next Greater Element, 히스토그램 최대 넓이 등을 O(n)에 해결하는 기법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["단조스택", "monotonic stack", "NGE", "히스토그램", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-deque/)에서 덱의 슬라이딩 윈도우 응용을 다뤘습니다. 이번에는 스택에 특수한 불변식(invariant)을 부여해 강력한 문제들을 선형 시간에 해결하는 **단조 스택(Monotonic Stack)**을 소개합니다. 이름이 생소하게 들릴 수 있지만, Next Greater Element 같은 고전 문제부터 히스토그램 최대 넓이까지 다양한 면접 단골 문제의 핵심 기법입니다.

## 단조 스택이란

일반 스택에 **항상 단조 증가(또는 단조 감소) 순서를 유지**하는 불변식을 추가한 것입니다.

- **단조 감소 스택**: 스택 바닥→top으로 갈수록 값이 감소 (top이 가장 작음)
- **단조 증가 스택**: 스택 바닥→top으로 갈수록 값이 증가 (top이 가장 큼)

새 원소를 push할 때 불변식이 깨지면, 깨지지 않을 때까지 pop합니다.

```python
# 단조 감소 스택 유지
stack = []
for val in arr:
    while stack and stack[-1] < val:   # top이 현재값보다 작으면 pop
        stack.pop()
    stack.append(val)
```

## 응용 1 — Next Greater Element (NGE)

배열의 각 원소에 대해 **오른쪽에서 처음 만나는 더 큰 값**을 구합니다. 브루트 포스는 O(n²)이지만 단조 스택으로 **O(n)**에 해결됩니다.

![단조 스택 — NGE](/assets/posts/dsa-monotonic-stack-nge.svg)

**핵심 관찰**: 새 원소 x가 스택 top보다 크면, top이 기다리던 "오른쪽의 첫 큰 값"이 x임을 의미합니다.

```python
def next_greater(arr: list) -> list:
    n = len(arr)
    nge = [-1] * n      # 기본값 -1 (없음)
    stack = []          # 인덱스 저장

    for i, val in enumerate(arr):
        while stack and arr[stack[-1]] < val:
            idx = stack.pop()
            nge[idx] = val      # idx의 NGE는 val
        stack.append(i)

    return nge

print(next_greater([2, 1, 5, 3, 6, 4]))
# [5, 5, 6, 6, -1, -1]
```

## 응용 2 — 히스토그램 최대 직사각형

가로 폭 1짜리 막대들로 이루어진 히스토그램에서 만들 수 있는 **가장 넓은 직사각형 넓이**를 구합니다.

![히스토그램 최대 직사각형](/assets/posts/dsa-monotonic-stack-histogram.svg)

```python
def largest_rectangle(heights: list) -> int:
    heights = heights + [0]   # sentinel: 끝에 0 추가해 잔여 원소 처리
    stack = []                 # 단조 증가 스택 (인덱스)
    max_area = 0

    for i, h in enumerate(heights):
        while stack and heights[stack[-1]] >= h:
            top = stack.pop()
            # 너비: 현재 인덱스 - 스택의 새 top - 1
            width = i if not stack else i - stack[-1] - 1
            max_area = max(max_area, heights[top] * width)
        stack.append(i)

    return max_area

print(largest_rectangle([2, 1, 5, 6, 2, 3]))  # 10
```

## 응용 3 — 빗물 가두기 (Trapping Rain Water)

높이 배열이 주어졌을 때, 막대 사이에 고이는 총 빗물 양을 구합니다.

```python
def trap_rain(height: list) -> int:
    stack = []
    water = 0

    for i, h in enumerate(height):
        while stack and height[stack[-1]] < h:
            bottom = stack.pop()
            if not stack:
                break
            left = stack[-1]
            width = i - left - 1
            bounded_h = min(height[left], h) - height[bottom]
            water += bounded_h * width
        stack.append(i)

    return water

print(trap_rain([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]))  # 6
```

## 단조 스택 선택 가이드

| 문제 유형 | 스택 종류 | pop 조건 |
|-----------|-----------|----------|
| 오른쪽 첫 큰 값 (NGE) | 단조 감소 | top < 현재값 |
| 오른쪽 첫 작은 값 (NSE) | 단조 증가 | top > 현재값 |
| 왼쪽 첫 큰 값 | 단조 감소 + 역순 | top < 현재값 |
| 히스토그램 최대 넓이 | 단조 증가 | top >= 현재값 |

## 시간/공간 복잡도

```text
시간: O(n) — 각 원소는 스택에 최대 1번 push, 1번 pop
공간: O(n) — 최악의 경우 스택에 n개 원소 (단조 정렬된 배열)
```

나이브 이중 루프 O(n²)를 O(n)으로 개선하는 핵심 기법이므로, 면접에서 "O(n)으로 풀 수 있냐"는 질문이 나오면 단조 스택을 가장 먼저 떠올려야 합니다.

## 정리

- 단조 스택은 스택의 단조성 불변식을 유지해 선형 시간 내에 강력한 문제들을 해결합니다.
- NGE/NSE, 히스토그램 넓이, 빗물 가두기는 모두 O(n) 단조 스택 패턴으로 풀립니다.
- 각 원소의 push/pop이 최대 1회이므로 전체 복잡도는 항상 O(n)입니다.

---

**지난 글:** [덱](/posts/dsa-deque/)

**다음 글:** [스킵 리스트](/posts/dsa-skip-list/)

<br>
읽어주셔서 감사합니다. 😊
