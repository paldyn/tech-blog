---
title: "CPython vs PyPy: Python 구현체의 세계"
description: "CPython, PyPy, Jython, IronPython 등 Python 구현체들의 차이를 설명합니다. JIT 컴파일이 무엇인지, 언제 PyPy를 써야 하는지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "CPython", "PyPy", "JIT", "구현체"]
featured: false
draft: false
---

[지난 글](/posts/python-2-vs-3/)에서 Python 2와 3의 코드 레벨 차이를 살펴봤다. 그런데 "Python을 실행한다"는 말은 정확히 무슨 뜻일까? Python 언어 명세를 실제로 실행하는 소프트웨어가 **구현체(implementation)**다. Python에는 공식 표준 구현체인 CPython 외에도 여러 구현체가 존재한다.

## CPython: 레퍼런스 구현체

가장 흔히 쓰이는 Python 구현체는 **CPython**이다. `python3` 명령을 실행하면 대부분 CPython이 동작한다. C 언어로 작성됐기 때문에 이름 앞에 'C'가 붙었다.

CPython의 실행 흐름은 다음과 같다.

```python
# CPython이 이 코드를 실행하는 과정
# 1단계: 소스 코드 파싱 → AST(추상 구문 트리) 생성
# 2단계: AST → 바이트코드 (.pyc) 컴파일
# 3단계: PVM(Python Virtual Machine)이 바이트코드 해석 실행

import dis

def add(a, b):
    return a + b

# 바이트코드 확인
dis.dis(add)
# LOAD_FAST  'a'
# LOAD_FAST  'b'
# BINARY_OP  +
# RETURN_VALUE
```

CPython은 **GIL(Global Interpreter Lock)**을 가지고 있다. GIL은 한 시점에 하나의 스레드만 Python 바이트코드를 실행할 수 있도록 하는 잠금 장치다. I/O 중심 작업에서는 큰 문제가 없지만, CPU 집약적인 병렬 계산에서는 병목이 된다.

## PyPy: JIT 컴파일의 힘

**PyPy**는 Python으로(정확히는 RPython이라는 Python의 제한된 서브셋으로) 작성된 Python 구현체다. 핵심 차이는 **JIT(Just-In-Time) 컴파일**이다.

CPython은 바이트코드를 매번 인터프리터로 해석한다. PyPy는 실행 중 "핫스팟(자주 실행되는 코드)"을 감지해서 기계어로 컴파일한다. 두 번째 실행부터는 이미 컴파일된 기계어가 바로 실행된다.

```python
# PyPy가 효과적인 경우: 반복 루프가 많은 코드
import time

def heavy_loop():
    total = 0
    for i in range(10_000_000):
        total += i
    return total

start = time.time()
result = heavy_loop()
print(f"결과: {result}, 시간: {time.time() - start:.3f}초")

# CPython: 약 0.8초
# PyPy:    약 0.08초 (약 10배 빠름)
```

반면 PyPy가 느려지는 경우도 있다. JIT 컴파일 자체에 초기 오버헤드가 있어서 프로그램이 짧게 실행되면 오히려 더 느리다. 또한 NumPy, C 확장 모듈 등 CPython 특화 라이브러리는 PyPy에서 작동하지 않거나 느릴 수 있다.

![CPython vs PyPy 실행 흐름](/assets/posts/python-implementations-cpython-pypy-arch.svg)

## 언제 PyPy를 쓸까

PyPy를 사용하면 이득을 볼 수 있는 상황이 있다.

```python
# PyPy 적합: 순수 Python 루프, 알고리즘, 시뮬레이션
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

# CPython 부적합: 이런 반복이 수백만 번 실행되면 PyPy가 유리

# PyPy 부적합: NumPy, pandas, TensorFlow 등 C 확장 의존 코드
import numpy as np  # PyPy에서 느리거나 미지원
arr = np.array([1, 2, 3, 4, 5])
```

PyPy를 쓰면 이득인 상황은 다음과 같다. 수치 계산이나 시뮬레이션처럼 순수 Python 루프가 수백만 번 반복되는 경우, 장시간 실행되는 서버 프로세스나 데이몬 프로세스, C 확장에 의존하지 않는 범용 Python 코드다.

## 그 밖의 구현체들

![Python 구현체 비교](/assets/posts/python-implementations-cpython-pypy-compare.svg)

**Jython**은 JVM(Java Virtual Machine) 위에서 동작하는 Python 구현체다. Java 클래스와 직접 상호운용할 수 있어서 Java 생태계와 Python을 연결해야 할 때 유용하다. 다만 현재 Python 3를 지원하지 않아 2.7까지만 동작한다.

**IronPython**은 .NET CLR(Common Language Runtime) 위에서 동작한다. C# 라이브러리를 Python 코드에서 직접 사용할 수 있다. GIL이 없어서 진정한 멀티스레딩이 가능하다.

**MicroPython**은 마이크로컨트롤러와 임베디드 환경에 최적화된 경량 구현체다. Raspberry Pi Pico, ESP32 같은 소형 하드웨어에서 Python을 실행할 수 있게 해준다.

```python
# MicroPython 예: 마이크로컨트롤러 제어
from machine import Pin
import time

led = Pin(25, Pin.OUT)

while True:
    led.toggle()
    time.sleep(0.5)  # 0.5초마다 LED 깜박임
```

**Cython**은 조금 결이 다르다. Cython은 Python 문법을 C 코드로 컴파일하는 도구다. NumPy처럼 성능이 중요한 Python 패키지의 핵심 부분을 C로 변환하는 데 사용된다.

## 어떤 구현체를 선택할까

대부분의 경우 **CPython이 정답**이다. 생태계 호환성이 가장 높고, 모든 파이썬 패키지가 CPython을 기준으로 동작한다. NumPy, Pandas, TensorFlow, Django 등 인기 라이브러리 모두 CPython을 기준으로 만들어져 있다.

**PyPy**는 C 확장에 의존하지 않는 순수 Python 알고리즘 코드의 성능을 높여야 할 때 고려한다.

나머지 구현체들은 특정 생태계(JVM, .NET)와의 통합이나 임베디드 환경처럼 명확한 이유가 있을 때만 선택한다.

이 시리즈에서 다루는 모든 코드는 CPython 기준이다. 다음 편에서는 CPython을 시스템에 설치하고 여러 버전을 관리하는 방법을 살펴본다.

---

**지난 글:** [Python의 역사: Guido van Rossum부터 현재까지](/posts/python-history/)

**다음 글:** [pyenv로 Python 버전 관리하기](/posts/python-install-pyenv/)

<br>
읽어주셔서 감사합니다. 😊
