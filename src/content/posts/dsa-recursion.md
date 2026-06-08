---
title: "재귀 (Recursion)"
description: "재귀의 개념, 기저 조건, 재귀 트리 분석, 꼬리 재귀 최적화, 반복 전환 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["재귀", "Recursion", "기저조건", "재귀트리", "콜스택"]
featured: false
draft: false
---

[지난 글](/posts/dsa-offline-query-processing/)에서 오프라인 쿼리 처리의 다양한 기법을 살펴봤습니다. 이번에는 분할 정복, 트리 탐색, 동적 프로그래밍 등 수많은 알고리즘의 기반이 되는 **재귀(Recursion)**의 개념과 구현 패턴을 다룹니다.

## 재귀란?

재귀는 함수가 자기 자신을 호출해 문제를 더 작은 부분 문제로 분해하는 기법입니다. 수학적 귀납법과 같은 논리 구조로, "더 작은 문제의 답을 알고 있다면 현재 문제의 답을 구할 수 있다"는 원리에 기반합니다.

재귀 함수는 반드시 세 요소를 갖춰야 합니다.

1. **기저 조건(Base Case)**: 재귀를 멈추는 조건. 반드시 도달 가능해야 합니다.
2. **재귀 케이스(Recursive Case)**: 더 작은 입력으로 자기 자신을 호출합니다.
3. **결합(Combine)**: 하위 호출의 결과를 합쳐 현재 문제의 답을 만듭니다.

![factorial 재귀 호출 트리](/assets/posts/dsa-recursion-call-tree.svg)

## 재귀의 두 가지 유형

![재귀 구조 코드](/assets/posts/dsa-recursion-structure.svg)

**선형 재귀(Linear Recursion)**는 각 호출이 딱 하나의 재귀 호출을 만드는 구조입니다. factorial이 대표적입니다. 호출 체인이 선형으로 쌓여 O(N) 공간이 소요됩니다.

**이진 재귀(Binary Recursion)**는 각 호출이 두 개의 재귀 호출을 만드는 구조입니다. fibonacci가 대표적이며, 메모이제이션 없이는 O(2^N)의 중복 계산이 발생합니다.

## 콜 스택과 메모리

재귀 호출이 일어날 때마다 스택 프레임(지역 변수, 반환 주소, 매개변수)이 콜 스택에 쌓입니다.

```python
import sys

def factorial(n: int) -> int:
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# Python 기본 재귀 깊이 제한: 1000
# 필요 시 늘릴 수 있음
sys.setrecursionlimit(10**6)

# N=4일 때 콜스택
# factorial(4) -> factorial(3) -> factorial(2) -> factorial(1)
# 4개의 스택 프레임이 동시에 존재
```

Python의 기본 재귀 깊이 제한은 1000입니다. 깊은 재귀가 필요하면 `sys.setrecursionlimit`을 늘리거나 반복문으로 전환해야 합니다.

## 꼬리 재귀와 반복 전환

재귀 호출이 함수의 마지막 연산인 경우 **꼬리 재귀(Tail Recursion)**라고 합니다. 꼬리 재귀는 이론적으로 스택 프레임을 재사용할 수 있어 O(1) 공간으로 최적화됩니다. 다만 Python은 꼬리 재귀 최적화(TCO)를 지원하지 않으므로 명시적으로 반복문으로 바꿔야 합니다.

```python
# 꼬리 재귀 형태
def factorial_tail(n: int, acc: int = 1) -> int:
    if n <= 1:
        return acc
    return factorial_tail(n - 1, acc * n)  # 마지막 연산이 재귀 호출

# Python에서는 반복문으로 변환
def factorial_iter(n: int) -> int:
    acc = 1
    while n > 1:
        acc *= n
        n -= 1
    return acc
```

## 재귀 트리 분석

재귀 함수의 시간 복잡도는 재귀 트리를 그려 분석합니다.

```python
def merge_sort(arr):
    """
    T(N) = 2T(N/2) + O(N)
    마스터 정리: T(N) = O(N log N)
    """
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)
```

마스터 정리(Master Theorem)로 재귀 복잡도를 빠르게 구할 수 있습니다.

`T(N) = aT(N/b) + f(N)` 형태에서:

| 조건 | 복잡도 |
|------|--------|
| f(N) = O(N^(log_b a - ε)) | T(N) = O(N^(log_b a)) |
| f(N) = Θ(N^(log_b a)) | T(N) = O(N^(log_b a) log N) |
| f(N) = Ω(N^(log_b a + ε)) | T(N) = O(f(N)) |

병합 정렬은 a=2, b=2, f(N)=N으로 케이스 2에 해당해 O(N log N)입니다.

## 메모이제이션

이진 재귀의 중복 계산 문제는 메모이제이션으로 해결합니다.

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# 또는 직접 구현
memo = {}
def fib_memo(n: int) -> int:
    if n <= 1:
        return n
    if n in memo:
        return memo[n]
    memo[n] = fib_memo(n-1) + fib_memo(n-2)
    return memo[n]
```

`@lru_cache`는 Python에서 메모이제이션을 가장 간단히 적용하는 방법입니다. 중복 호출을 캐시해 O(2^N) → O(N)으로 줄입니다.

## 실전 팁

**스택 오버플로우 방지**: 재귀 깊이가 10^4를 넘는다면 반복문 전환이나 명시적 스택 사용을 검토합니다.

**기저 조건 먼저**: 코딩 테스트에서 재귀를 작성할 때 기저 조건을 먼저 작성하면 무한 재귀를 예방합니다.

**트리·그래프 탐색**: DFS는 재귀로 표현하면 코드가 간결해집니다. 단, 깊은 그래프에서는 스택 대신 명시적 스택 사용을 권장합니다.

```python
def dfs(graph, node, visited=None):
    if visited is None:
        visited = set()
    visited.add(node)
    for neighbor in graph[node]:
        if neighbor not in visited:
            dfs(graph, neighbor, visited)
    return visited
```

재귀는 분할 정복, 백트래킹, 동적 프로그래밍 등 고급 알고리즘의 기반입니다. 기저 조건과 재귀 케이스를 명확히 정의하는 습관이 올바른 재귀 코드 작성의 핵심입니다.

---

**지난 글:** [오프라인 쿼리 처리](/posts/dsa-offline-query-processing/)

**다음 글:** [분할 정복 (Divide and Conquer)](/posts/dsa-divide-and-conquer/)

<br>
읽어주셔서 감사합니다. 😊
