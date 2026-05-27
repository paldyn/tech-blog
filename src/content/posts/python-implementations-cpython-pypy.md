---
title: "CPython, PyPy — Python 구현체 완전 비교"
description: "Python 표준 구현체 CPython의 작동 원리와 JIT 기반 PyPy의 차이, 언제 어떤 구현체를 선택해야 하는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "CPython", "PyPy", "인터프리터", "JIT"]
featured: false
draft: false
---

[지난 글](/posts/python-2-vs-3/)에서 Python 2와 3의 차이를 살펴봤습니다. 보통 "Python을 설치한다"고 하면 python.org에서 받는 CPython을 의미하지만, Python 언어 자체는 하나의 명세(specification)이고 여러 구현체가 존재합니다. 이 글에서는 주요 구현체를 비교합니다.

## Python은 언어이고, CPython은 구현체

Python이 JavaScript와 다른 점은 공식 언어 명세와 구현체가 분리되어 있다는 점입니다. 같은 Python 코드를 다른 엔진으로 실행할 수 있습니다.

```python
import sys
print(sys.implementation.name)  # 'cpython', 'pypy', 'micropython' 등
print(sys.version)               # 버전 정보
```

## CPython — 표준 구현체

CPython은 C 언어로 작성된 Python의 공식 구현체입니다. 우리가 가장 흔히 쓰는 `python` 명령이 바로 CPython입니다.

![CPython 실행 파이프라인](/assets/posts/python-implementations-cpython-arch.svg)

실행 과정은 크게 네 단계입니다.

1. **파싱**: 소스 코드를 AST(추상 구문 트리)로 변환
2. **컴파일**: AST를 바이트코드로 변환 (`.pyc` 파일로 캐싱)
3. **PVM 실행**: Python Virtual Machine이 바이트코드 해석 및 실행

`dis` 모듈로 바이트코드를 직접 볼 수 있습니다.

```python
import dis

def add(a, b):
    return a + b

dis.dis(add)
# LOAD_FAST   0 (a)
# LOAD_FAST   1 (b)
# BINARY_OP   0 (+)
# RETURN_VALUE
```

CPython의 핵심 제약은 **GIL(Global Interpreter Lock)**입니다. 한 번에 하나의 스레드만 Python 바이트코드를 실행할 수 있어, CPU 집약 작업을 멀티스레드로 병렬화하기 어렵습니다.

## PyPy — JIT 컴파일러 구현체

PyPy는 Python으로 작성된 Python 구현체입니다(RPython이라는 Python 서브셋으로 작성). 핵심 차별점은 **JIT(Just-In-Time) 컴파일러**입니다.

PyPy는 코드를 실행하면서 자주 호출되는 "핫 경로(hot path)"를 감지하고, 해당 코드를 실시간으로 기계어로 컴파일합니다. 결과적으로 반복이 많은 코드에서 CPython 대비 5~10배 빠른 속도를 냅니다.

```python
# 이런 루프에서 PyPy가 압도적으로 빠름
total = 0
for i in range(100_000_000):
    total += i
print(total)

# CPython: ~5초
# PyPy:    ~0.5초 (JIT 웜업 후)
```

단, PyPy는 C 확장 모듈(CPython C API 기반) 호환성이 제한적입니다. NumPy, Pandas 같은 라이브러리는 CPython 환경에서 더 안정적으로 동작합니다.

![Python 구현체 비교](/assets/posts/python-implementations-overview.svg)

## 기타 구현체

**Jython**은 JVM 위에서 실행되는 Python 구현체입니다. Java 라이브러리를 Python 코드에서 직접 호출할 수 있지만, 현재 Python 2.7 기반에 머물러 있어 활용이 제한됩니다.

**IronPython**은 .NET CLR 위에서 실행됩니다. C# 코드와의 상호 운용이 필요한 Windows 환경에서 쓰입니다.

**MicroPython**은 마이크로컨트롤러를 위한 최소화된 Python 구현체입니다. ESP32, Raspberry Pi Pico 같은 장치에서 256KB 수준의 RAM으로도 동작합니다.

```python
# MicroPython — Raspberry Pi Pico 예시
from machine import Pin
import time

led = Pin(25, Pin.OUT)
while True:
    led.toggle()
    time.sleep(0.5)
```

**Cython**은 Python 코드를 C로 변환하는 컴파일러입니다. 성능 병목이 되는 함수를 Cython으로 작성하면 CPython 환경에서도 C에 가까운 속도를 낼 수 있습니다.

## 어떤 구현체를 선택할까?

| 상황 | 권장 구현체 |
|---|---|
| 일반 개발, 데이터 과학 | CPython (기본) |
| 장기 실행 CPU 집약 서버 | PyPy |
| Java 생태계와 연동 | Jython |
| 마이크로컨트롤러 / IoT | MicroPython |
| 성능 병목 C 최적화 | Cython |

대부분의 경우 CPython이 정답입니다. PyPy를 고려할 시점은 프로파일링으로 CPU 바운드 병목을 확인한 후입니다.

## 정리

Python은 단일 구현체가 아니라 여러 엔진이 존재하는 언어 생태계입니다. CPython은 호환성, PyPy는 성능, MicroPython은 임베디드 환경에 특화되어 있습니다. 다음 글에서는 실제로 Python을 개발 환경에 설치하고 pyenv로 여러 버전을 관리하는 방법을 다룹니다.

---

**지난 글:** [Python 2 vs 3 — 무엇이 얼마나 달라졌나](/posts/python-2-vs-3/)

**다음 글:** [pyenv로 Python 버전 관리하기](/posts/python-install-pyenv/)

<br>
읽어주셔서 감사합니다. 😊
