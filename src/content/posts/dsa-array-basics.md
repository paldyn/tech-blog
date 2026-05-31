---
title: "배열의 기초"
description: "가장 기본적인 자료구조인 배열의 메모리 구조, O(1) 인덱스 접근 원리, 삽입·삭제의 비용을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["배열", "자료구조", "메모리", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/dsa-amortized-analysis/)에서 분할 상환 분석을 배웠습니다. 이제 본격적으로 자료구조를 공부할 차례입니다. 시리즈의 첫 번째 자료구조는 모든 것의 기반이 되는 **배열(Array)**입니다.

## 배열이란

배열은 **같은 타입의 원소들을 연속된 메모리 공간에 순서대로 저장**하는 자료구조입니다. 가장 단순하고 원시적인 자료구조이지만, 인덱스로 O(1) 시간에 임의 접근(random access)이 가능하다는 강력한 특성 덕분에 현재도 가장 널리 사용됩니다.

## 메모리 구조와 인덱스 접근

![배열의 메모리 구조](/assets/posts/dsa-array-basics-structure.svg)

배열이 O(1) 접근을 가능하게 하는 이유는 간단합니다. 원소들이 **연속된 메모리**에 있고 모두 **같은 크기**이므로, i번째 원소의 주소를 상수 시간에 계산할 수 있습니다.

```
주소 = base_address + i × element_size
```

int 배열(원소 4바이트)이 0x1000에서 시작한다면:
- `arr[0]` → 0x1000
- `arr[3]` → 0x1000 + 3×4 = 0x100C
- `arr[999]` → 0x1000 + 999×4 = 0x1F9C

어디든 단 한 번의 계산으로 접근합니다. **CPU 캐시 친화적**이기도 합니다 — 순차 접근 시 데이터가 캐시 라인에 이미 로드되어 있어 매우 빠릅니다.

## 기본 연산의 복잡도

```python
arr = [10, 25, 37, 42, 58]

# O(1): 인덱스 접근
value = arr[3]          # 42

# O(1): 인덱스 수정
arr[3] = 99             # [10, 25, 37, 99, 58]

# O(n): 탐색 (정렬되지 않은 배열)
def find(arr, target):
    for i, v in enumerate(arr):  # 최악 n번
        if v == target:
            return i
    return -1

# O(log n): 탐색 (정렬된 배열 + 이진 탐색)
import bisect
idx = bisect.bisect_left(arr, 37)
```

## 삽입과 삭제: 왜 O(n)인가

![배열 삽입·삭제의 시각화](/assets/posts/dsa-array-basics-operations.svg)

중간에 원소를 삽입하거나 삭제하려면 뒤의 원소들을 밀거나 당겨야 합니다.

```python
# 삽입: index 위치에 val 추가
def insert_at(arr, index, val):
    arr.append(None)  # 배열 크기 1 증가
    # 뒤에서부터 한 칸씩 오른쪽으로 이동
    for i in range(len(arr) - 1, index, -1):
        arr[i] = arr[i - 1]
    arr[index] = val
# 최악(index=0): n번 이동 → O(n)

# 삭제: index 위치 원소 제거
def delete_at(arr, index):
    # index 뒤 원소들을 왼쪽으로 당김
    for i in range(index, len(arr) - 1):
        arr[i] = arr[i + 1]
    arr.pop()
# 최악(index=0): n-1번 이동 → O(n)
```

단, **끝(tail)에 삽입/삭제**는 O(1)입니다. Python의 `list.append()`와 `list.pop()`이 빠른 이유입니다.

## 다차원 배열

2D 배열은 행 우선(row-major) 또는 열 우선(column-major) 순서로 메모리에 펼쳐집니다.

```python
# Python에서 2D 배열 (리스트의 리스트)
matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
]

# 접근: O(1)
val = matrix[1][2]  # 6

# 행 우선 1D 배열로 표현 시
# matrix[r][c] = flat[r * cols + c]
flat = [1, 2, 3, 4, 5, 6, 7, 8, 9]
cols = 3
val = flat[1 * cols + 2]  # 6

# NumPy: C-contiguous(행 우선)가 기본값
import numpy as np
m = np.array([[1,2,3],[4,5,6],[7,8,9]])
print(m[1, 2])   # 6, O(1)
```

## 배열 vs 연결 리스트 비교

| 연산 | 배열 | 연결 리스트 |
|---|---|---|
| 인덱스 접근 | **O(1)** | O(n) |
| 탐색 | O(n) | O(n) |
| 끝 삽입/삭제 | **O(1)** | O(1)* |
| 중간 삽입/삭제 | O(n) | **O(1)** (위치 알 때) |
| 메모리 | 연속, 캐시 효율적 | 비연속, 포인터 오버헤드 |

*연결 리스트에서 tail 포인터를 유지할 때

## 언어별 배열 구현

```python
# Python: 동적 배열 (list)
arr = [1, 2, 3]
arr.append(4)    # amortized O(1)
arr.insert(1, 9) # O(n)

# 고정 크기 배열이 필요하다면 array 모듈 또는 numpy
import array
arr = array.array('i', [1, 2, 3])  # int32 배열

# Java: 정적 배열
# int[] arr = new int[5];  크기 고정

# Java: 동적 배열
# ArrayList<Integer> list = new ArrayList<>();
```

## 정리

- 배열 = 연속 메모리 + 같은 타입 → O(1) 인덱스 접근
- `arr[i]` 주소 = base + i × size (단순 산술)
- 끝에서 삽입/삭제: O(1) / 중간: O(n)
- 캐시 효율이 뛰어나 순차 처리에서 연결 리스트보다 빠름

---

**지난 글:** [분할 상환 분석](/posts/dsa-amortized-analysis/)

**다음 글:** [동적 배열](/posts/dsa-dynamic-array/)

<br>
읽어주셔서 감사합니다. 😊
