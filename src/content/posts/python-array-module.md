---
title: "array 모듈: 타입 고정 배열"
description: "Python array 모듈로 타입 고정 배열을 사용하는 방법, 타입코드, 메모리 효율, 바이너리 파일 I/O 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["python", "array", "메모리", "타입 고정 배열", "바이너리 IO"]
featured: false
draft: false
---

[지난 글](/posts/python-bisect/)에서 bisect로 정렬을 유지하며 이진 탐색하는 법을 익혔습니다. 이번 글에서는 `array` 모듈을 다룹니다. Python의 `list`는 모든 타입을 담을 수 있지만 그 유연성 때문에 각 요소마다 Python 객체 오버헤드가 붙습니다. `array.array`는 **타입 코드로 원소 타입을 고정**해 메모리를 효율적으로 사용합니다. 수백만 개의 숫자를 다뤄야 하거나 바이너리 파일을 읽고 써야 할 때 유용합니다.

## array 생성과 기본 사용법

```python
from array import array

# 'i'는 signed int, 초기값 전달
arr = array('i', [1, 2, 3, 4, 5])

print(arr)         # array('i', [1, 2, 3, 4, 5])
print(arr[2])      # 3
print(arr[1:3])    # array('i', [2, 3])

arr.append(6)
arr.extend([7, 8])

# 다른 타입 삽입 시 TypeError
arr.append(3.14)   # TypeError
```

list와 동일하게 인덱스 접근, 슬라이싱, append, extend, pop 등을 사용할 수 있습니다. 단 **지정한 타입코드와 일치하는 값만** 저장할 수 있습니다.

![array 모듈 — 타입 고정 배열](/assets/posts/python-array-module-typecodes.svg)

## 메모리 효율 확인

```python
import sys
from array import array

lst = list(range(1_000_000))
arr = array('i', range(1_000_000))

print(sys.getsizeof(lst))  # 약 8 MB
print(arr.buffer_info())   # (주소, 요소 수)
print(arr.itemsize)        # 4  ← 요소 하나 크기(바이트)
print(arr.itemsize * len(arr))  # 4 MB
```

`'i'` 타입의 int는 4바이트이므로 100만 개면 4 MB. list의 포인터+객체 방식(약 8 MB+)보다 훨씬 적습니다.

## 타입코드 정보 조회

```python
arr = array('d', [1.1, 2.2, 3.3])

print(arr.typecode)   # 'd'
print(arr.itemsize)   # 8  ← double은 8바이트
```

## 바이너리 파일 I/O

`array`는 바이너리 파일에 직접 쓰고 읽는 메서드를 제공합니다.

```python
from array import array

# float 배열 파일에 저장
data = array('f', [1.0, 2.5, 3.14, 0.5])

with open("sensor_data.bin", "wb") as f:
    data.tofile(f)

# 읽어 오기 (요소 개수를 알아야 함)
restored = array('f')
with open("sensor_data.bin", "rb") as f:
    restored.fromfile(f, 4)  # 4개 요소 읽기

print(list(restored))  # [1.0, 2.5, 3.140000104904175, 0.5]
```

bytes와도 상호 변환할 수 있습니다.

```python
b = data.tobytes()
arr2 = array('f')
arr2.frombytes(b)
```

![array 모듈 코드 패턴](/assets/posts/python-array-module-code.svg)

## list, array, numpy 비교

```python
# 어떤 걸 선택해야 할까?

# 소규모 데이터, 혼합 타입 → list
items = [1, "hello", 3.14, True]

# 동일 타입 대량 숫자, 메모리 절약 → array
sensor_readings = array('f', raw_data)

# 수치 연산(행렬, 벡터, 통계) → NumPy
import numpy as np
matrix = np.array([[1, 2], [3, 4]])
result = matrix @ matrix  # 행렬 곱
```

| 기준 | list | array | numpy |
|---|---|---|---|
| 혼합 타입 | 가능 | 불가 | 불가 |
| 메모리 효율 | 낮음 | 높음 | 매우 높음 |
| 수치 연산 | 느림 | 느림 | 빠름(C 구현) |
| 바이너리 I/O | 직접 구현 필요 | 내장 지원 | 지원 |

순수 Python에서 메모리만 절약하고 싶다면 `array`, 수치 연산이 필요하다면 `numpy`가 적합합니다.

---

**지난 글:** [bisect: 이진 탐색으로 정렬 유지](/posts/python-bisect/)

<br>
읽어주셔서 감사합니다. 😊
