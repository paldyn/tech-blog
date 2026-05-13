---
title: "파이썬 콜 스택과 트레이스백 읽기"
description: "파이썬 콜 스택의 동작 원리, 트레이스백 해석 방법, traceback·inspect·sys 모듈로 스택 프레임에 프로그래밍으로 접근하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "traceback", "콜스택", "디버깅", "inspect"]
featured: false
draft: false
---

[지난 글](/posts/python-function-annotations/)에서 함수 어노테이션을 살펴봤습니다. 이번에는 함수 호출이 실행 엔진 내부에서 어떻게 쌓이는지, 오류가 났을 때 트레이스백을 어떻게 읽는지 파고듭니다. 트레이스백을 제대로 읽을 수 있어야 디버깅이 빠릅니다.

## 콜 스택이란

파이썬 인터프리터는 함수를 호출할 때마다 **스택 프레임(stack frame)** 을 하나씩 쌓습니다. 프레임에는 해당 함수의 지역 변수, 현재 실행 위치(코드 라인), 반환 주소가 담깁니다. 함수가 반환되면 해당 프레임은 제거됩니다.

이 구조가 **LIFO(Last In, First Out)** 스택이기 때문에 **콜 스택**이라 부릅니다.

```python
def c():
    return 1 / 0   # ZeroDivisionError 발생

def b():
    return c()

def a():
    return b()

a()
```

실행 순서를 따라가면 스택은 아래처럼 쌓입니다.

```
[module]  →  [a]  →  [a, b]  →  [a, b, c]  → 예외 발생
```

![콜 스택 동작 원리](/assets/posts/python-call-stack-traceback-stack.svg)

## 트레이스백 읽는 법

트레이스백(traceback)은 콜 스택의 스냅샷입니다. **아래에서 위로** 읽는 것이 핵심입니다.

```
Traceback (most recent call last):
  File "app.py", line 8, in <module>
    a()
  File "app.py", line 6, in a
    return b()
  File "app.py", line 4, in b
    return c()
  File "app.py", line 2, in c
    return 1 / 0
ZeroDivisionError: division by zero
```

1. **마지막 줄** — 예외 타입과 메시지. 가장 먼저 확인
2. **그 바로 위 두 줄** — 실제 오류가 발생한 파일·라인·코드
3. **그 위 줄들** — 오류로 이어진 호출 경로 (내 코드 → 라이브러리 경계 확인)

라이브러리 깊숙이 들어간 트레이스백은 대부분 **내 코드의 마지막 진입 지점**이 핵심입니다. 그 아래는 라이브러리 내부 경로이므로 빠르게 건너뛰면 됩니다.

## 체인 예외 트레이스백

```python
try:
    int("abc")
except ValueError as e:
    raise RuntimeError("변환 실패") from e
```

```
Traceback (most recent call last):
  File "...", line 2, in <module>
    int("abc")
ValueError: invalid literal for int() with base 10: 'abc'

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "...", line 4, in <module>
    raise RuntimeError("변환 실패") from e
RuntimeError: 변환 실패
```

두 트레이스백이 "The above exception..." 구분자로 연결됩니다. 원인 예외가 위에, 결과 예외가 아래에 표시됩니다.

## traceback 모듈

`traceback` 모듈은 트레이스백을 프로그래밍으로 처리합니다.

```python
import traceback
import logging

logger = logging.getLogger(__name__)

def safe_execute(func, *args):
    try:
        return func(*args)
    except Exception:
        # 문자열로 변환해 로그에 기록
        tb_str = traceback.format_exc()
        logger.error("오류 발생:\n%s", tb_str)
        return None

# 현재 스택 트레이스 출력 (예외 없이도)
traceback.print_stack()

# 예외 정보만 추출
try:
    1 / 0
except ZeroDivisionError:
    exc_type, exc_value, exc_tb = sys.exc_info()
    frames = traceback.extract_tb(exc_tb)
    for frame in frames:
        print(f"{frame.filename}:{frame.lineno} in {frame.name}")
        print(f"  {frame.line}")
```

![traceback·inspect 모듈 활용](/assets/posts/python-call-stack-traceback-inspect.svg)

## inspect 모듈 — 런타임 스택 탐색

```python
import inspect

def current_function_name() -> str:
    return inspect.currentframe().f_code.co_name

def caller_info() -> tuple[str, int]:
    stack = inspect.stack()
    caller_frame = stack[1]  # 0=현재, 1=호출자
    return caller_frame.function, caller_frame.lineno

def show_call_chain():
    for frame_info in inspect.stack():
        print(f"{frame_info.filename}:{frame_info.lineno} in {frame_info.function}")
```

`inspect.stack()` 은 프레임 객체 리스트를 반환합니다. 각 프레임에는 파일명, 라인 번호, 함수명, 소스 코드 컨텍스트가 있습니다.

## 프레임 객체 직접 다루기

```python
import sys

def inspect_locals():
    frame = sys._getframe(0)   # 현재 프레임
    print("함수명:", frame.f_code.co_name)
    print("라인번호:", frame.f_lineno)
    print("지역변수:", frame.f_locals)
    print("전역변수 키:", list(frame.f_globals.keys())[:5])

x = 42
y = "hello"
inspect_locals()
# 함수명: inspect_locals
# 라인번호: 3
# 지역변수: {}  ← 함수 진입 직후라 아직 없음
```

`sys._getframe(n)` 에서 `n` 은 스택 깊이입니다. 0이 현재, 1이 호출자, 2가 그 위입니다. 내부 API이므로 `inspect.stack()` 이 더 안전합니다.

## 재귀 깊이 초과 트레이스백 해석

```python
def infinite():
    return infinite()

infinite()
```

```
RecursionError: maximum recursion depth exceeded
```

이 경우 트레이스백이 수백~수천 줄로 출력됩니다. 반복되는 패턴이 보이면 재귀 루프가 원인입니다. `sys.setrecursionlimit()` 으로 한계를 높이는 것은 임시방편이며, 재귀를 반복문으로 바꾸거나 기저 조건을 점검하는 게 올바른 해결책입니다.

## 커스텀 예외 훅

```python
import sys
import traceback

def custom_excepthook(exc_type, exc_value, exc_tb):
    print("=== 예외 발생 ===")
    traceback.print_exception(exc_type, exc_value, exc_tb)
    print("=================")
    # 여기서 Sentry, 로그 등에 기록 가능

sys.excepthook = custom_excepthook
```

`sys.excepthook` 을 교체하면 처리되지 않은 예외가 발생할 때마다 커스텀 로직을 실행할 수 있습니다. 모니터링 시스템 연동에 유용합니다.

## 핵심 정리

- 콜 스택 = 함수 호출마다 쌓이는 LIFO 프레임 구조
- 트레이스백은 아래에서 위로 — 마지막 줄이 실제 원인
- `traceback.format_exc()` 로 트레이스백을 문자열로 기록
- `inspect.stack()` 으로 런타임에 호출 경로 탐색
- `sys.excepthook` 으로 전역 예외 처리 훅 등록

---

**지난 글:** [파이썬 함수 어노테이션 완전 가이드](/posts/python-function-annotations/)

**다음 글:** [순수 함수 vs 부수 효과 — 파이썬에서의 함수형 사고](/posts/python-pure-vs-impure/)

<br>
읽어주셔서 감사합니다. 😊
