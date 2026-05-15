---
title: "재귀 깊이 제한: sys.setrecursionlimit과 스택 오버플로"
description: "Python의 기본 재귀 깊이 제한(1000), RecursionError의 원인, sys.setrecursionlimit 사용법, 깊은 재귀를 반복문으로 안전하게 전환하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "재귀", "RecursionError", "sys.setrecursionlimit", "스택", "최적화"]
featured: false
draft: false
---

[지난 글](/posts/python-closure/)에서 클로저와 자유 변수를 다뤘다. 이번에는 재귀 함수를 쓸 때 반드시 알아야 하는 **깊이 제한**과 그 해결책을 살펴본다.

## 재귀 깊이 제한이란

Python은 기본적으로 재귀 호출을 **1000번**으로 제한한다. 이 제한을 초과하면 `RecursionError`가 발생한다.

```python
import sys
print(sys.getrecursionlimit())   # 1000
```

간단한 재귀 팩토리얼 함수로 확인해 보자.

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))      # 120  (깊이: 5)
print(factorial(999))    # OK
print(factorial(1001))   # RecursionError!
```

## 왜 제한이 있나

모든 함수 호출은 **콜 스택(call stack)**에 스택 프레임을 쌓는다. 각 프레임은 지역 변수, 반환 주소 등을 포함하고 메모리를 소비한다. 무제한으로 재귀하면 스택 메모리가 고갈되는 **스택 오버플로(stack overflow)**가 발생한다.

CPython은 이를 방지하기 위해 1000이라는 제한을 둔다.

![재귀 호출 스택과 깊이 제한](/assets/posts/python-recursion-limit-stack.svg)

## sys.setrecursionlimit

제한을 늘리려면 `sys.setrecursionlimit()`을 사용한다.

```python
import sys
sys.setrecursionlimit(5000)

print(factorial(3000))   # 이제 가능
```

그러나 이 방법은 신중하게 사용해야 한다.

- 실제 스택 크기는 OS와 환경에 따라 다르다
- 제한을 무턱대고 올리면 프로그램이 OS 수준에서 충돌할 수 있다
- 근본 원인(무한 재귀, 너무 깊은 재귀)을 해결하는 편이 낫다

## 재귀의 한계를 인식하는 패턴

재귀 깊이가 예측 불가능한 경우에는 안전하게 처리한다.

```python
import sys

def safe_recursive(n, depth=0):
    if depth > sys.getrecursionlimit() - 100:
        raise RecursionError(f"깊이 초과: {depth}")
    if n <= 0:
        return 0
    return n + safe_recursive(n - 1, depth + 1)
```

## 더 나은 해결책: 반복문으로 전환

깊은 재귀가 예상되면 반복문 + 명시적 스택으로 전환한다. 이 방법은 스택 크기를 힙 메모리로 이동시켜 사실상 무제한으로 처리할 수 있다.

```python
# 재귀 팩토리얼 → 반복
def factorial_iter(n):
    result = 1
    while n > 1:
        result *= n
        n -= 1
    return result
```

![재귀 → 반복 전환 패턴](/assets/posts/python-recursion-limit-iterative.svg)

## 꼬리 재귀 최적화가 없는 Python

C나 Haskell과 달리 **CPython은 꼬리 재귀 최적화(TCO)를 지원하지 않는다**. Guido van Rossum은 스택 트레이스 가독성을 이유로 의도적으로 TCO를 채택하지 않았다.

따라서 꼬리 재귀 형태로 작성해도 동일하게 스택이 쌓인다.

```python
# 꼬리 재귀처럼 보이지만 CPython에서는 최적화 안 됨
def factorial_tail(n, acc=1):
    if n <= 1:
        return acc
    return factorial_tail(n - 1, n * acc)
```

## 메모이제이션으로 깊이 줄이기

재귀 깊이 문제의 일부는 동일한 값을 반복 계산하는 것에서 온다. `functools.lru_cache`로 메모이제이션하면 실제 호출 깊이를 줄일 수 있다.

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(50))   # 빠르게 계산
```

## 정리

| 상황 | 해결책 |
|------|--------|
| 단순한 깊이 초과 | `sys.setrecursionlimit()` 증가 (신중히) |
| 깊이 예측 불가 | 반복문 + 명시적 스택으로 전환 |
| 중복 계산 있음 | `lru_cache` 메모이제이션 적용 |
| 무한 재귀 | 기저 조건(base case) 재확인 |

---

**지난 글:** [클로저: 함수가 환경을 기억하는 방법](/posts/python-closure/)

<br>
읽어주셔서 감사합니다. 😊
