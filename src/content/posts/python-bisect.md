---
title: "bisect: 이진 탐색으로 정렬 유지"
description: "Python bisect 모듈로 정렬된 리스트에서 O(log n) 이진 탐색을 수행하고, insort로 정렬을 유지하며 삽입하는 방법을 배웁니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["python", "bisect", "이진 탐색", "정렬", "알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/python-heapq/)에서 heapq로 최솟값을 효율적으로 다루는 법을 익혔습니다. 이번에는 `bisect` 모듈을 살펴봅니다. 정렬된 리스트에서 선형 탐색은 O(n)이지만, `bisect`의 이진 탐색은 **O(log n)**으로 삽입 위치를 찾습니다. 정렬된 상태를 유지하면서 데이터를 효율적으로 관리해야 할 때 필수 도구입니다.

## bisect_left와 bisect_right

두 함수 모두 **정렬된 리스트에서 값 x의 삽입 위치 인덱스**를 반환합니다.

```python
import bisect

a = [1, 3, 5, 5, 7, 9]

# bisect_left: x보다 크거나 같은 첫 번째 위치
print(bisect.bisect_left(a, 5))   # 2  ← 첫 번째 5 앞
print(bisect.bisect_left(a, 4))   # 2  ← 4가 들어갈 위치

# bisect_right (= bisect): x보다 큰 첫 번째 위치
print(bisect.bisect_right(a, 5))  # 4  ← 마지막 5 뒤
print(bisect.bisect(a, 4))        # 2  ← bisect_right와 동일
```

![bisect 삽입 위치 탐색](/assets/posts/python-bisect-concept.svg)

## insort — 정렬 유지하며 삽입

```python
a = [1, 3, 5, 7]

bisect.insort(a, 4)   # [1, 3, 4, 5, 7]
bisect.insort(a, 5)   # [1, 3, 4, 5, 5, 7]  ← 기존 5 뒤에 삽입

# insort_left: 동일 값 앞에 삽입
bisect.insort_left(a, 5)  # [1, 3, 4, 5, 5, 5, 7]
```

`insort`는 삽입 위치를 O(log n)에 찾지만, 실제 삽입에는 O(n) 이동이 필요합니다. 빈번한 삽입이 필요한 대용량 데이터라면 `sortedcontainers` 라이브러리의 `SortedList`를 고려하세요.

## 값 존재 여부 확인

```python
def contains(a, x):
    i = bisect.bisect_left(a, x)
    return i < len(a) and a[i] == x

a = [1, 3, 5, 7, 9]
print(contains(a, 5))  # True
print(contains(a, 4))  # False
```

정렬된 리스트에서 `x in a`는 O(n)이지만 `bisect_left`를 쓰면 O(log n)입니다.

## 범위 내 원소 개수 세기

```python
a = [1, 2, 2, 3, 3, 3, 4, 5]

def count_range(a, lo, hi):
    return bisect.bisect_right(a, hi) - bisect.bisect_left(a, lo)

print(count_range(a, 2, 3))  # 5  ← 2,2,3,3,3
print(count_range(a, 3, 3))  # 3  ← 3,3,3
```

![bisect 실전 패턴](/assets/posts/python-bisect-patterns.svg)

## 등급 조회 패턴

경계값 배열과 bisect를 조합하면 if-elif 체인을 줄일 수 있습니다.

```python
import bisect

breakpoints = [60, 70, 80, 90]
grades = ['F', 'D', 'C', 'B', 'A']

def grade(score):
    return grades[bisect.bisect_right(breakpoints, score)]

scores = [45, 62, 75, 83, 91]
print([grade(s) for s in scores])  # ['F', 'D', 'C', 'B', 'A']
```

## Python 3.10+ — key 인수

3.10부터 `key` 인수가 추가되어 복잡한 객체에도 직접 사용할 수 있습니다.

```python
# Python 3.10+
data = [("Alice", 25), ("Bob", 30), ("Carol", 35)]
i = bisect.bisect_left(data, 28, key=lambda x: x[1])
print(i)  # 1  ← ("Bob", 30) 앞
```

3.9 이하에서는 정렬 키만 담은 별도 리스트를 유지하거나 `SortedList` 같은 외부 라이브러리를 사용하세요.

---

**지난 글:** [heapq: 파이썬 힙과 우선순위 큐](/posts/python-heapq/)

**다음 글:** [array 모듈: 타입 고정 배열](/posts/python-array-module/)

<br>
읽어주셔서 감사합니다. 😊
