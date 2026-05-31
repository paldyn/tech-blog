---
title: "동적 배열"
description: "크기가 자동으로 늘어나는 동적 배열의 구조, 성장 인자의 원리, Python list와 Java ArrayList의 내부 동작을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["동적배열", "ArrayList", "Python list", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/dsa-array-basics/)에서 정적 배열의 메모리 구조를 살펴봤습니다. 정적 배열은 크기를 미리 알아야 한다는 단점이 있습니다. **동적 배열(Dynamic Array)**은 이 제한을 해결해 자동으로 크기가 늘어납니다.

## 동적 배열의 아이디어

정적 배열보다 **더 큰 내부 버퍼(capacity)**를 유지하되, 실제 원소 수(size)는 따로 관리합니다. 버퍼가 꽉 차면 더 큰 버퍼를 새로 만들고 모든 원소를 복사합니다.

```python
# Python의 sys.getsizeof로 list 내부 capacity 관찰
import sys

arr = []
prev_size = sys.getsizeof(arr)
for i in range(20):
    arr.append(i)
    curr_size = sys.getsizeof(arr)
    if curr_size != prev_size:
        print(f"len={len(arr):2d}, capacity 변경: {prev_size}→{curr_size} bytes")
        prev_size = curr_size
# 0→56→88→120→184→248→... bytes 로 단계적으로 증가
```

## 크기 확장 전략: 왜 2배인가

![동적 배열 크기 확장 전략](/assets/posts/dsa-dynamic-array-resize.svg)

핵심은 **기하급수적 성장(geometric growth)**입니다. 1씩 늘리면 n번 append에 O(n²) 총 비용이 들지만, 2배씩 늘리면 O(n)입니다.

- 확장 횟수: n번 append 시 log₂n번만 확장
- 총 복사 비용: 1+2+4+...+n = 2n-1 = O(n)
- append 1회 분할 상환 비용: O(n)/n = O(1)

```python
# 왜 정확히 2배가 아닌 1.5배 또는 기타 인수를 쓰는가?
# 2배: 총 낭비 메모리 최대 50% (capacity/2 ~ capacity 사이)
# 1.5배: 낭비 메모리 최대 33%, 재사용 가능성 ↑
# CPython: 약 1.125배 성장 (메모리 절약 중시)
# Java ArrayList: 1.5배 (oldCapacity + oldCapacity >> 1)
# Go slice: 작을 때 2배, 클 때 더 작게

def compute_java_new_cap(old_cap):
    return old_cap + (old_cap >> 1)  # = old_cap * 1.5

print(compute_java_new_cap(10))  # 15
print(compute_java_new_cap(100)) # 150
```

## 직접 구현해보기

![동적 배열 직접 구현](/assets/posts/dsa-dynamic-array-impl.svg)

```python
class DynamicArray:
    def __init__(self):
        self._cap = 1
        self._size = 0
        self._data = [None] * self._cap

    def __len__(self):
        return self._size

    def __getitem__(self, idx):
        if not (0 <= idx < self._size):
            raise IndexError("인덱스 범위 초과")
        return self._data[idx]

    def append(self, val):          # amortized O(1)
        if self._size == self._cap:
            self._resize(self._cap * 2)
        self._data[self._size] = val
        self._size += 1

    def pop(self):                  # amortized O(1)
        if self._size == 0:
            raise IndexError("빈 배열")
        val = self._data[self._size - 1]
        self._size -= 1
        # 25% 미만 사용 시 절반으로 축소 (메모리 회수)
        if self._size < self._cap // 4 and self._cap > 1:
            self._resize(self._cap // 2)
        return val

    def insert(self, idx, val):     # O(n)
        if self._size == self._cap:
            self._resize(self._cap * 2)
        for i in range(self._size, idx, -1):
            self._data[i] = self._data[i - 1]
        self._data[idx] = val
        self._size += 1

    def _resize(self, new_cap):
        new_data = [None] * new_cap
        new_data[:self._size] = self._data[:self._size]
        self._data = new_data
        self._cap = new_cap
```

### 축소(shrink) 전략

pop 후 25% 사용 시 절반으로 줄이는 이유가 있습니다. 만약 50% 사용 시 줄이면 `push → pop → push → pop` 패턴에서 매번 확장/축소가 일어나 O(n) worst case가 반복됩니다 (thrashing). 25% 기준은 이를 방지합니다.

## 복잡도 정리

| 연산 | 시간 | 비고 |
|---|---|---|
| 접근 arr[i] | O(1) | 계산 1회 |
| 끝 삽입 append | **O(1)** amortized | 가끔 O(n) 확장 |
| 끝 삭제 pop | **O(1)** amortized | 가끔 O(n) 축소 |
| 중간 삽입 | O(n) | 원소 이동 |
| 중간 삭제 | O(n) | 원소 이동 |
| 탐색 (비정렬) | O(n) | |
| 탐색 (정렬) | O(log n) | 이진 탐색 |

## 실무 주의사항

```python
# 1. 불필요한 중간 삽입 피하기
arr = list(range(1000000))
arr.insert(0, -1)   # O(n): 100만 원소를 한 칸씩 밀어야 함

# 대신: deque (양쪽 끝 O(1) 삽입)
from collections import deque
dq = deque(range(1000000))
dq.appendleft(-1)   # O(1)

# 2. 빈번한 크기 변경 예측 시 미리 할당
arr = [None] * 1000000  # 확장 없이 시작

# 3. 반복 순회 중 수정 금지
arr = [1, 2, 3, 4, 5]
# 잘못된 패턴:
for i, v in enumerate(arr):
    if v % 2 == 0:
        arr.pop(i)  # 인덱스가 밀려 원소 건너뜀!

# 올바른 패턴:
arr = [v for v in arr if v % 2 != 0]
```

## 정리

- 동적 배열 = 정적 배열 + 자동 확장
- 2배(또는 1.5배) 성장으로 append amortized O(1) 보장
- 축소는 25% 이하 사용 시만 — thrashing 방지
- Python list, Java ArrayList, C++ vector 모두 이 원리

---

**지난 글:** [배열의 기초](/posts/dsa-array-basics/)

**다음 글:** [단일 연결 리스트](/posts/dsa-singly-linked-list/)

<br>
읽어주셔서 감사합니다. 😊
