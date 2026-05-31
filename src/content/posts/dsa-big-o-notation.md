---
title: "빅오(Big-O) 표기법"
description: "알고리즘 복잡도를 표현하는 빅오 표기법의 규칙, 자주 쓰이는 복잡도 클래스, 실수하기 쉬운 함정까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["빅오", "시간복잡도", "알고리즘", "복잡도 표기"]
featured: false
draft: false
---

[지난 글](/posts/dsa-time-space-complexity/)에서 시간·공간 복잡도의 개념과 계산 방법을 살펴봤습니다. 이제 복잡도를 간결하게 표현하는 표준 언어인 **빅오(Big-O) 표기법**을 배울 차례입니다.

## 빅오 표기법이란

빅오 표기법 `O(f(n))`은 알고리즘의 실행 시간(또는 공간)이 **최악의 경우** 입력 크기 n의 함수 f(n)에 비례해 증가함을 나타냅니다. 수학적으로는 어떤 양의 상수 c와 n₀가 존재해서 n ≥ n₀일 때 T(n) ≤ c·f(n)임을 의미합니다.

쉽게 말하면: "n이 충분히 클 때, 내 알고리즘은 f(n)보다 빠르게 증가하지 않는다"는 **상한(upper bound)** 보장입니다.

## 4가지 핵심 규칙

![빅오 표기법 핵심 규칙](/assets/posts/dsa-big-o-notation-rules.svg)

### 규칙 1: 상수 계수 제거

`O(2n)`, `O(3n)`, `O(100n)` 모두 `O(n)`입니다. n이 충분히 크면 상수 배율의 차이는 하드웨어나 컴파일러 최적화 수준의 차이보다 작아집니다.

```python
# 상수 2는 제거
def double_loop(arr):
    for x in arr:      # n번
        print(x)
    for x in arr:      # n번
        print(x * 2)
# O(2n) → O(n)
```

### 규칙 2: 하위 항 제거

`O(n² + n + 1)` → `O(n²)`. n이 1억일 때 n²=10¹⁶, n=10⁸이므로 n항은 n²의 0.0000001%에 불과합니다.

```python
def combined(arr):
    # O(n²): 중첩 루프
    for i in range(len(arr)):
        for j in range(len(arr)):
            pass
    # O(n): 순회
    for x in arr:
        pass
# O(n² + n) → O(n²)
```

### 규칙 3: 다른 입력은 다른 변수

두 개의 서로 다른 입력이 있으면 각각 다른 변수로 표현해야 합니다.

```python
def process_both(arr_a, arr_b):
    for x in arr_a:   # a번
        print(x)
    for x in arr_b:   # b번
        print(x)
# O(a + b), O(n + n) = O(2n)이 아님!
```

### 규칙 4: 중첩된 다른 입력

```python
def find_common(arr_a, arr_b):
    for x in arr_a:          # a번
        for y in arr_b:      # b번
            if x == y:
                print(x)
# O(a × b), NOT O(n²)
```

## 자주 쓰이는 복잡도 클래스

![빅오 표기법 치트시트](/assets/posts/dsa-big-o-notation-cheatsheet.svg)

## 빅오 계산 연습

```python
# 예제 1: 무엇인가?
def example1(n):
    count = 0
    i = n
    while i > 0:
        count += 1
        i = i // 2      # 절반씩 줄어듦
    return count
# O(log n) — 이진 탐색과 같은 패턴

# 예제 2: 무엇인가?
def example2(arr):
    for i in range(len(arr)):           # n
        for j in range(i + 1, len(arr)):  # 최대 n
            if arr[i] > arr[j]:
                arr[i], arr[j] = arr[j], arr[i]
# O(n²) — 삽입 정렬 패턴

# 예제 3: 재귀
def example3(n):
    if n <= 0:
        return 0
    return example3(n // 2) + example3(n // 2)
# O(n) — 재귀 트리의 총 노드 수가 n
```

## 빅오 vs 실제 성능

빅오는 **점근적** 분석이므로 작은 n에서는 상수 인자가 더 중요할 수 있습니다.

- n=10일 때: `5n² = 500` vs `100n = 1000` — O(n)이 더 느림
- n=100일 때: `5n² = 50000` vs `100n = 10000` — O(n²)이 더 느림
- n≥20부터 O(n²) 알고리즘이 역전된다

따라서 **작은 데이터셋에서는 간단한 O(n²) 알고리즘이 오히려 나을 수 있습니다**. 예를 들어 삽입 정렬은 n이 작을 때 퀵 정렬보다 빠릅니다.

```python
# 파이썬 timsort는 이 원리를 실제로 활용
# 작은 구간(n < 64)에서는 삽입 정렬을 사용
```

## 공간 복잡도에도 같은 규칙 적용

```python
def clone(arr):
    return arr[:]       # 크기 n의 새 배열 → O(n) 공간

def is_sorted(arr):
    for i in range(len(arr) - 1):
        if arr[i] > arr[i + 1]:
            return False
    return True         # 추가 공간 없음 → O(1) 공간
```

## 정리

- 빅오 = 최악 경우의 **상한** 표현
- 상수 계수와 하위 항은 제거
- 다른 입력은 반드시 다른 변수로 (a + b, a × b)
- `O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!)`
- 작은 n에서는 상수 인자도 중요 — 맹목적으로 복잡한 알고리즘을 택하지 말 것

---

**지난 글:** [시간·공간 복잡도](/posts/dsa-time-space-complexity/)

**다음 글:** [점근적 표기법](/posts/dsa-asymptotic-notation/)

<br>
읽어주셔서 감사합니다. 😊
