---
title: "꼬리 재귀와 재귀 깊이 제한: sys.setrecursionlimit 완전 이해"
description: "Python의 재귀 깊이 제한(1000), RecursionError 원인, 꼬리 재귀 최적화(TCO) 부재, 트램폴린 기법, 반복문 변환, lru_cache 활용 등 실전 해결책을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "재귀", "꼬리재귀", "RecursionError", "TCO", "트램폴린", "sys"]
featured: false
draft: false
---

[지난 글](/posts/python-pipe-pattern/)에서 파이프 패턴으로 데이터를 변환하는 방법을 살펴봤다. 함수형 프로그래밍에서는 재귀가 자주 등장하는데, Python에서는 재귀를 쓸 때 반드시 알아야 할 제약이 있다. 이번 글에서는 Python의 재귀 깊이 제한과 이를 우회하는 방법들을 정리한다.

## Python의 재귀 깊이 제한

CPython은 기본적으로 재귀 깊이를 **1000**으로 제한한다. 1001번째 재귀 호출 시 `RecursionError`가 발생한다.

![재귀 호출 스택](/assets/posts/python-tail-recursion-limit-stack.svg)

```python
import sys
print(sys.getrecursionlimit())   # 1000

def count_down(n):
    if n == 0:
        return "done"
    return count_down(n - 1)

count_down(999)    # OK
count_down(1000)   # RecursionError: maximum recursion depth exceeded
```

재귀 깊이 제한이 있는 이유는 C 스택을 보호하기 위해서다. Python의 각 함수 호출은 C 스택 프레임을 사용하므로, 무제한으로 늘리면 운영체제 스택 오버플로가 발생할 수 있다.

## 꼬리 재귀(Tail Recursion)와 Python

**꼬리 재귀**는 함수의 마지막 연산이 재귀 호출인 경우다. 이론적으로 컴파일러/인터프리터가 꼬리 재귀를 최적화(TCO: Tail Call Optimization)하면 스택 프레임을 재사용해 O(1) 공간으로 실행할 수 있다.

```python
# 일반 재귀 — 각 호출이 스택에 쌓임
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)   # 곱셈이 남아 있어 꼬리 재귀 아님

# 꼬리 재귀 스타일 — 누산기 사용
def factorial_tail(n, acc=1):
    if n <= 1:
        return acc
    return factorial_tail(n - 1, n * acc)   # 마지막 연산이 재귀 호출
```

그러나 **Python은 TCO를 의도적으로 구현하지 않았다**. Guido van Rossum은 스택 트레이스가 불분명해진다는 이유로 TCO 추가를 거부했다. 꼬리 재귀 스타일로 작성해도 스택은 여전히 쌓인다.

## 해결 방법들

![재귀 깊이 문제 해결 전략](/assets/posts/python-tail-recursion-limit-solutions.svg)

### 방법 1: sys.setrecursionlimit

```python
import sys
sys.setrecursionlimit(10000)
```

빠르고 간단하지만 C 스택 오버플로 위험이 있다. 운영체제 스택 크기(보통 1~8MB)를 초과하면 프로세스가 크래시한다. 절대 무작정 늘리지 말고, 실제로 필요한 만큼만 설정해야 한다.

### 방법 2: 반복문으로 변환 (가장 권장)

```python
# 재귀 → 반복문
def factorial_iter(n: int) -> int:
    result = 1
    while n > 1:
        result *= n
        n -= 1
    return result

factorial_iter(100000)   # 문제 없음

# 피보나치 반복문 버전
def fib_iter(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

대부분의 재귀 알고리즘은 반복문으로 변환할 수 있다. 성능도 좋고 스택 걱정도 없다.

### 방법 3: 트램폴린(Trampoline) 기법

꼬리 재귀 함수를 수정하지 않고 실행 방식만 바꾸는 기법이다. 재귀 호출 대신 thunk(호출 가능한 객체)를 반환하고, 루프에서 계속 실행한다.

```python
def trampoline(f, *args):
    v = f(*args)
    while callable(v):
        v = v()
    return v

def factorial_tramp(n, acc=1):
    if n <= 1:
        return acc
    return lambda: factorial_tramp(n - 1, n * acc)   # thunk 반환

result = trampoline(factorial_tramp, 10000)
print(result)   # 매우 큰 숫자, 스택 오버플로 없음
```

### 방법 4: lru_cache로 재귀 깊이 간접 감소

`lru_cache`가 있으면 동일 인자에 대한 재계산을 건너뛰므로, 피보나치 같은 중복 호출 구조에서는 실제 스택 깊이가 줄어든다.

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

# fib(900)은 깊이 900이지만, 이미 계산된 것은 재귀 없이 반환
```

단, `fib(5000)` 처럼 처음 호출할 때는 여전히 깊이 5000의 재귀가 발생한다.

### 방법 5: 명시적 스택으로 DFS/BFS 구현

트리 순회, 그래프 탐색처럼 재귀가 자연스러운 경우도 명시적 스택을 사용하면 깊이 제한을 완전히 피할 수 있다.

```python
def dfs_iterative(tree):
    stack = [tree]
    result = []
    while stack:
        node = stack.pop()
        result.append(node.value)
        for child in reversed(node.children):
            stack.append(child)
    return result
```

## 현재 재귀 깊이 확인

```python
import sys

def current_depth():
    frame = sys._getframe()
    depth = 0
    while frame:
        frame = frame.f_back
        depth += 1
    return depth
```

`sys.getframe()`으로 현재 프레임을 얻고, `f_back`으로 호출 스택을 거슬러 올라가 깊이를 측정할 수 있다.

다음 글에서는 함수형 프로그래밍에서 반복 계산을 피하는 **메모이제이션 패턴**을 자세히 다룬다.

---

**지난 글:** [파이프 패턴: 데이터를 흘리는 함수형 파이프라인](/posts/python-pipe-pattern/)

**다음 글:** [메모이제이션 패턴: 계산 결과 캐싱 전략](/posts/python-memoization-pattern/)

<br>
읽어주셔서 감사합니다. 😊
