---
title: "CPython과 PyPy: Python 구현체의 세계"
description: "CPython이 표준인 이유, PyPy의 JIT 가속 원리, Jython과 IronPython의 용도를 설명합니다. Python 구현체를 선택하는 기준을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "CPython", "PyPy", "JIT", "구현체", "GIL"]
featured: false
draft: false
---

[지난 글](/posts/python-2-vs-3/)에서 Python 2와 3의 차이를 살펴봤다. 그런데 "Python"이라고 할 때 실제로 어떤 프로그램을 가리키는 걸까? Python은 언어 명세(language specification)이고, 그 명세를 구현한 프로그램이 따로 있다. 마치 ECMAScript가 JavaScript의 명세이고 V8, SpiderMonkey 등이 그 구현체인 것처럼. Python의 대표적인 구현체를 이해하면 언어의 동작 원리와 성능에 대한 이해가 깊어진다.

## CPython: 표준 참조 구현체

대부분의 개발자가 사용하는 "Python"은 CPython이다. python.org에서 다운로드하는 것이 CPython이고, 대부분의 리눅스 배포판에 기본 포함된 Python도 CPython이다.

왜 CPython이냐고 물으면, "C로 작성된 Python 인터프리터"이기 때문이다. Python 언어 런타임 자체가 C 언어로 구현되어 있다.

### CPython 실행 파이프라인

CPython이 `hello.py`를 실행할 때 내부적으로 거치는 단계를 살펴보자.

![CPython 실행 파이프라인](/assets/posts/python-implementations-cpython-pypy-architecture.svg)

```python
# hello.py
print("Hello, World!")
```

이 코드가 실행되는 과정:

1. **Tokenizer (어휘 분석)**: 소스 코드를 토큰으로 쪼갠다. `print`, `(`, `"Hello, World!"`, `)` 등
2. **Parser (구문 분석)**: 토큰들로 AST(Abstract Syntax Tree, 추상 구문 트리)를 생성한다
3. **Compiler**: AST를 바이트코드(bytecode)로 변환한다
4. **PVM (Python Virtual Machine)**: 바이트코드를 한 줄씩 실행한다

```python
# 바이트코드 확인
import dis

def greet(name):
    return f"Hello, {name}!"

dis.dis(greet)
# LOAD_GLOBAL  f-string
# LOAD_FAST    name
# FORMAT_VALUE ...
# RETURN_VALUE
```

`dis` 모듈로 함수의 바이트코드를 직접 볼 수 있다. 이 바이트코드가 `__pycache__` 폴더의 `.pyc` 파일에 캐시된다. 소스가 바뀌지 않으면 다음 실행 시 파싱 없이 캐시된 바이트코드를 바로 실행한다.

### GIL: CPython의 가장 유명한 제약

CPython의 가장 논란이 많은 특징은 **GIL(Global Interpreter Lock, 전역 인터프리터 잠금)**이다.

GIL은 한 번에 하나의 스레드만 Python 바이트코드를 실행할 수 있도록 하는 잠금 장치다. 멀티코어 CPU가 있어도 Python 스레드는 동시에 실행되지 않는다.

```python
import threading
import time

def cpu_task():
    count = 0
    for _ in range(10_000_000):
        count += 1
    return count

# 단일 스레드: 2초
start = time.time()
cpu_task()
cpu_task()
print(f"순차: {time.time() - start:.2f}s")

# 멀티 스레드: GIL 때문에 여전히 ~2초
start = time.time()
t1 = threading.Thread(target=cpu_task)
t2 = threading.Thread(target=cpu_task)
t1.start(); t2.start()
t1.join(); t2.join()
print(f"병렬: {time.time() - start:.2f}s")
# GIL 때문에 실제로 병렬 실행이 안 됨
```

GIL이 존재하는 이유는 **레퍼런스 카운팅 기반 메모리 관리** 때문이다. CPython은 객체의 참조 횟수를 추적해 0이 되면 해제하는데, 이 카운터를 여러 스레드가 동시에 수정하면 메모리 오염이 발생할 수 있다. GIL이 이 문제를 단순하게 해결한다.

GIL의 영향을 받지 않는 경우도 있다. I/O 작업(네트워크, 파일 읽기쓰기) 중에는 GIL이 해제된다. 웹 서버처럼 I/O 중심 작업에서는 멀티스레딩이 효과적이다.

Python 3.12부터 GIL을 비활성화할 수 있는 실험적 모드가 도입되었고, 3.13에서는 정식으로 "No-GIL" 빌드를 선택할 수 있다. Python의 멀티코어 활용이 근본적으로 바뀔 수 있는 중요한 변화다.

## PyPy: JIT 컴파일러를 품은 Python

PyPy는 "RPython으로 작성된 Python 인터프리터"다. 일반적인 Python 코드보다 훨씬 빠른 실행을 목표로 한다.

![Python 구현체 비교](/assets/posts/python-implementations-cpython-pypy-comparison.svg)

### JIT(Just-In-Time) 컴파일이란?

CPython은 바이트코드를 항상 인터프리터가 해석해서 실행한다. PyPy는 다르다. 코드를 실행하다가 "이 부분은 자주 실행되는구나"라고 판단하면, 그 부분을 실시간으로 기계어(native code)로 컴파일한다. 이것이 JIT이다.

```python
# 이런 루프는 PyPy에서 극적으로 빠르다
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

# CPython: ~3초
# PyPy: ~0.3초 (약 10배)
result = fibonacci(10_000_000)
```

반복문이 많고 순수 Python 코드가 많을수록 PyPy의 이점이 크다. 벤치마크에 따라 CPython 대비 2~10배 빠른 경우도 있다.

### PyPy의 한계

PyPy가 만능은 아니다.

**C 확장 모듈 호환성**: NumPy, pandas 같은 라이브러리는 CPython C API로 작성된 C 확장 모듈을 사용한다. PyPy는 자체 C API 구현(cpyext)이 있지만 호환성이 완전하지 않다. PyPy로 NumPy를 쓰는 것은 가능하지만 성능이 기대만큼 나오지 않을 수 있다.

**워밍업 시간**: JIT는 코드를 실행하면서 최적화 기회를 찾는다. 즉, 실행 초반에는 빠르지 않다가 점점 빨라진다. 짧게 실행되고 끝나는 스크립트는 PyPy가 오히려 느릴 수 있다.

**메모리 사용**: JIT 컴파일된 코드와 원래 바이트코드를 모두 메모리에 유지하기 때문에 CPython보다 메모리를 더 사용한다.

PyPy가 빛을 발하는 상황은 수치 계산이 많은 순수 Python 코드, 장시간 실행되는 서버, C 확장 의존도가 낮은 코드다.

## Jython: JVM 위의 Python

Jython은 Java로 구현된 Python 인터프리터다. Python 코드를 JVM 바이트코드로 컴파일해서 JVM 위에서 실행한다.

```python
# Jython에서 Java 라이브러리 직접 사용
from java.util import ArrayList

items = ArrayList()
items.add("Python")
items.add("Jython")
print(items.size())  # 2
```

Java 생태계와 Python 코드를 통합해야 하는 경우에 유용하다. Android 앱에서 Python 스크립트를 실행하거나, Java 기반 서버에 Python 비즈니스 로직을 추가할 때 사용된다.

단점은 최신 Python 버전 지원이 느리다는 것이다. Jython은 현재 Python 2.7 수준에 머물러 있어 Python 3 생태계를 사용할 수 없다.

## IronPython: .NET의 Python

IronPython은 C#으로 작성되어 .NET 런타임에서 실행된다. .NET 라이브러리를 Python 코드에서 직접 사용할 수 있다.

```python
# IronPython에서 .NET 라이브러리 사용
import clr
clr.AddReference("System.Windows.Forms")
from System.Windows.Forms import Form, Button

form = Form()
form.Text = "IronPython 윈도우"
button = Button()
button.Text = "클릭"
form.Controls.Add(button)
```

C#, F# 코드와 Python을 혼용하거나 .NET 생태계의 GUI, 데이터 처리 라이브러리를 Python에서 쓸 때 유용하다.

## MicroPython: 마이크로컨트롤러의 Python

MicroPython은 메모리가 수십~수백 KB에 불과한 마이크로컨트롤러(ESP32, RP2040 등)에서 실행되도록 설계된 Python 서브셋이다.

```python
# MicroPython으로 LED 깜빡이기 (ESP32)
from machine import Pin
import time

led = Pin(2, Pin.OUT)

while True:
    led.value(1)   # LED on
    time.sleep(0.5)
    led.value(0)   # LED off
    time.sleep(0.5)
```

Python 표준 라이브러리의 일부만 지원하지만, 임베디드 환경에서 Python 문법으로 하드웨어를 제어할 수 있다는 점이 강력하다.

## 어느 구현체를 선택해야 하는가?

대부분의 상황에서 답은 CPython이다. 생태계 호환성이 가장 넓고, 공식 지원이 활발하며, 거의 모든 라이브러리가 CPython을 기반으로 만들어졌다.

PyPy는 다음 경우에 고려한다. 수치 계산 중심의 코드를 C 확장 없이 최대한 빠르게 실행해야 할 때, 또는 장시간 실행되는 서버에서 성능을 높이고 싶을 때다. 웹 프레임워크 중에서는 Tornado, Bottle 등이 PyPy 호환성이 좋다.

Jython과 IronPython은 각각 JVM/.NET 생태계와의 통합이 필요한 특수한 상황에서 선택한다.

다음 편에서는 CPython을 설치하고 버전을 관리하는 도구인 pyenv를 다룬다. 여러 Python 버전을 동시에 관리해야 하는 현실적인 문제를 pyenv가 어떻게 해결하는지 살펴볼 것이다.

---

**지난 글:** [Python 2 vs 3: 왜 모두가 3으로 넘어왔는가](/posts/python-2-vs-3/)

**다음 글:** [pyenv로 Python 버전 마스터하기](/posts/python-install-pyenv/)

<br>
읽어주셔서 감사합니다. 😊
