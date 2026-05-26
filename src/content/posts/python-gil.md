---
title: "GIL — 전역 인터프리터 잠금"
description: "CPython의 GIL이 무엇인지, 왜 존재하는지, CPU 바운드와 I/O 바운드 작업에 각각 어떤 영향을 미치는지, Python 3.13의 free-threaded 실험까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "GIL", "threading", "multiprocessing", "CPython", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/python-async-context-manager/)에서 비동기 컨텍스트 매니저를 다뤘다. Python의 동시성·병렬성을 이해하려면 먼저 **GIL(Global Interpreter Lock)** 을 알아야 한다. 스레드를 여러 개 만들었는데 CPU가 하나만 돌아가는 것처럼 느껴진다면 GIL 때문이다.

## GIL이란

GIL은 CPython 인터프리터가 파이썬 바이트코드를 실행할 때 **단 하나의 스레드만** 실행되도록 보장하는 뮤텍스(Mutex)다.

멀티코어 CPU에서 여러 스레드가 동시에 파이썬 코드를 실행하려 해도, GIL이 있으면 한 번에 하나씩 순서대로 실행된다.

![GIL 개념도](/assets/posts/python-gil-concept.svg)

## GIL이 존재하는 이유

CPython은 모든 파이썬 객체의 참조 횟수를 세어 메모리를 관리한다. 참조 카운트 변경이 원자적이지 않기 때문에, 여러 스레드가 동시에 객체를 조작하면 카운트가 잘못되어 메모리가 해제되어야 할 때 안 되거나, 아직 살아 있는 객체가 해제되는 문제가 생긴다. GIL은 이 경쟁 조건(race condition)을 막는 가장 단순한 해결책이었다.

```python
import sys

x = []
# 참조 카운트 확인
print(sys.getrefcount(x))  # 2 (x 변수 + getrefcount 인수)
```

## CPU 바운드 vs I/O 바운드

GIL의 영향은 작업 유형에 따라 크게 달라진다.

**CPU 바운드 작업** (이미지 처리, 암호화, 수치 계산 등):
- 스레드가 GIL을 쥐고 계속 계산하므로 다른 스레드가 끼어들 기회가 없음
- 멀티스레딩으로 속도 향상 거의 없음 (오히려 컨텍스트 스위칭 비용으로 느려질 수도 있음)

**I/O 바운드 작업** (파일 읽기, 네트워크 요청 등):
- I/O 시스템콜을 기다리는 동안 GIL이 자동으로 해제됨
- 해제된 사이에 다른 스레드가 실행됨
- 멀티스레딩이 효과적

![GIL 영향: CPU vs I/O](/assets/posts/python-gil-impact.svg)

## GIL을 우회하는 방법

### multiprocessing — CPU 바운드용

```python
from multiprocessing import Pool

def heavy_calc(n):
    return sum(i * i for i in range(n))

with Pool(processes=4) as pool:
    results = pool.map(heavy_calc, [10**7] * 4)
```

각 프로세스는 독립된 파이썬 인터프리터와 독립된 GIL을 갖는다. 진정한 병렬 실행이 가능하다.

### C 확장 — Cython, NumPy

C로 작성된 확장 코드는 `Py_BEGIN_ALLOW_THREADS` / `Py_END_ALLOW_THREADS` 매크로로 GIL을 수동으로 해제할 수 있다. NumPy의 배열 연산이 빠른 이유 중 하나다.

```python
import numpy as np

# NumPy 연산은 GIL 없이 실행 가능
a = np.arange(10_000_000)
result = np.sum(a * a)  # 내부에서 GIL 해제
```

### asyncio — I/O 바운드용

```python
import asyncio

async def fetch(url):
    # 비동기 I/O — GIL 과 무관하게 이벤트 루프로 동시성 달성
    ...
```

## GIL 확인 실험

```python
import threading
import time

count = 0

def increment():
    global count
    for _ in range(1_000_000):
        count += 1

# 두 스레드가 count 를 동시에 올림
t1 = threading.Thread(target=increment)
t2 = threading.Thread(target=increment)
t1.start(); t2.start()
t1.join(); t2.join()

print(count)  # 2_000_000 이 아닐 수 있음 — count += 1 은 원자적이지 않음
```

GIL이 있어도 `count += 1`처럼 읽기-수정-쓰기가 한 바이트코드가 아닌 연산은 경쟁 조건에 취약하다. GIL은 객체의 참조 카운트를 보호하지, 파이썬 레벨 연산 원자성을 보장하지 않는다.

## Python 3.13 — Free-threaded CPython

Python 3.13부터 GIL 없는 빌드가 실험적으로 제공된다.

```bash
# free-threaded 버전 설치 (pyenv 기준)
pyenv install 3.13t

# GIL 비활성화 확인
python3.13t -c "import sys; print(sys._is_gil_enabled())"  # False
```

진정한 멀티코어 병렬성을 얻을 수 있지만 아직 기본값이 아니다. 서드파티 C 확장 호환성 문제가 남아 있다.

## 요약

| 구분 | 내용 |
|------|------|
| GIL | CPython에서 한 번에 하나의 스레드만 실행 |
| CPU 바운드 | 멀티스레딩 효과 없음 → multiprocessing 사용 |
| I/O 바운드 | I/O 대기 중 GIL 해제 → threading 효과적 |
| 우회 | multiprocessing / C 확장 / asyncio |
| 미래 | Python 3.13 free-threaded 실험 중 |

---

**지난 글:** [비동기 컨텍스트 매니저](/posts/python-async-context-manager/)

**다음 글:** [threading 모듈](/posts/python-threading-module/)

<br>
읽어주셔서 감사합니다. 😊
