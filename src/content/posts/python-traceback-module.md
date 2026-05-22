---
title: "traceback 모듈로 예외 정보 완전 제어하기"
description: "Python traceback 모듈의 주요 함수를 설명합니다. print_exc, format_exc, walk_tb의 사용법, 트레이스백 구조 분석, 로깅과의 통합, 예외 정보를 커스텀 형식으로 출력하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "traceback", "디버깅", "로깅", "예외정보", "스택트레이스"]
featured: false
draft: false
---

[지난 글](/posts/python-warnings/)에서 경고 시스템을 살펴봤다. 예외가 발생했을 때 가장 먼저 보는 것이 트레이스백(traceback)이다. Python 표준 라이브러리의 `traceback` 모듈을 쓰면 트레이스백을 파일에 저장하거나, 원하는 형식으로 출력하거나, 프로그래밍적으로 분석할 수 있다. 이번 글에서는 그 방법을 완전히 정리한다.

## 트레이스백 읽는 법

Python 트레이스백은 **아래에서 위로** 읽는다.

```
Traceback (most recent call last):
  File "app.py", line 12, in main         ← 호출 흐름 (오래된 것부터)
    result = process(data)
  File "app.py", line 25, in process
    value = transform(item)
  File "app.py", line 40, in transform
    return int(value)                     ← 실제 문제 발생 직전
ValueError: invalid literal for int()    ← 예외 타입 + 메시지 (여기부터 읽기)
```

![트레이스백 해부도](/assets/posts/python-traceback-module-anatomy.svg)

실제로 디버깅할 때는:
1. **마지막 줄**: 예외 타입과 메시지 확인
2. **마지막 파일**: 실제로 오류가 난 코드 확인
3. **위로 올라가며**: 어떤 경로로 그 코드에 도달했는지 파악

## traceback 모듈 기본 함수

### print_exc()

```python
import traceback

try:
    int("abc")
except ValueError:
    traceback.print_exc()   # 현재 예외의 트레이스백을 stderr에 출력
```

`print_exc()`는 `sys.exc_info()`로 현재 예외를 가져와 출력한다. `except` 블록 안에서만 의미 있다.

파일로 리다이렉션:

```python
import traceback
import sys

with open("error.log", "a") as f:
    try:
        risky()
    except Exception:
        traceback.print_exc(file=f)
```

### format_exc()

트레이스백을 문자열로 반환한다. 로그에 저장할 때 가장 많이 쓴다.

```python
import traceback
import logging

logger = logging.getLogger(__name__)

try:
    complex_operation()
except Exception:
    tb_str = traceback.format_exc()
    logger.error("작업 실패:\n%s", tb_str)
    # 또는
    logger.error("작업 실패", exc_info=True)   # logging이 직접 트레이스백 추가
```

`logger.error(..., exc_info=True)`가 더 편리하다. `exc_info=True`가 있으면 `logging`이 내부적으로 `format_exc()`와 동일한 정보를 포함한다.

![traceback 모듈 주요 함수](/assets/posts/python-traceback-module-methods.svg)

### format_exception()

예외 객체를 직접 넘길 수 있다.

```python
import traceback

try:
    int("abc")
except ValueError as e:
    lines = traceback.format_exception(e)
    # ['Traceback (most recent call last):\n', '  File ...', 'ValueError: ...\n']
    print("".join(lines))
```

Python 3.10+에서는 예외 하나만 인자로 넘길 수 있다. 이전에는 `(type, value, tb)` 세 인자가 필요했다.

## 스택 프레임 순회: walk_tb

```python
import traceback

try:
    int("abc")
except Exception:
    import sys
    exc = sys.exc_info()
    for frame, lineno in traceback.walk_tb(exc[2]):
        print(f"{frame.f_code.co_filename}:{lineno} ({frame.f_code.co_name})")
```

출력:
```
/path/to/script.py:4 (main)
/path/to/script.py:10 (process)
```

`walk_tb`는 `FrameSummary` 대신 실제 `frame` 객체를 반환한다. 프레임 객체에서 지역 변수까지 접근할 수 있어 디버깅에 유용하다.

```python
for frame, lineno in traceback.walk_tb(exc[2]):
    # 해당 프레임의 지역 변수 확인
    local_vars = {k: repr(v) for k, v in frame.f_locals.items()}
    print(f"  지역 변수: {local_vars}")
```

## StackSummary 활용

```python
import traceback

try:
    int("abc")
except Exception:
    summary = traceback.extract_tb(sys.exc_info()[2])
    for frame_summary in summary:
        print(f"파일: {frame_summary.filename}")
        print(f"줄번호: {frame_summary.lineno}")
        print(f"함수명: {frame_summary.name}")
        print(f"코드: {frame_summary.line}")
```

`FrameSummary` 객체는 직렬화 가능해서 로그나 JSON에 저장하기 좋다.

## 커스텀 에러 리포터

```python
import traceback
import json
from datetime import datetime

def format_error_report(exc: Exception) -> dict:
    """예외를 JSON 친화적인 딕셔너리로 변환"""
    tb_list = traceback.extract_tb(exc.__traceback__)
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "type": type(exc).__name__,
        "message": str(exc),
        "traceback": [
            {
                "file": f.filename,
                "line": f.lineno,
                "function": f.name,
                "code": f.line,
            }
            for f in tb_list
        ],
    }

try:
    process_data()
except Exception as e:
    report = format_error_report(e)
    send_to_sentry(report)   # 에러 트래킹 서비스로 전송
```

## 예외 체인 순회

예외 연결이 있는 경우 전체 체인을 출력하려면 `traceback.format_exception()`이 자동으로 처리한다.

```python
import traceback

def outer():
    try:
        inner()
    except ValueError as e:
        raise RuntimeError("외부 오류") from e

def inner():
    raise ValueError("내부 오류")

try:
    outer()
except RuntimeError:
    traceback.print_exc()
    # ValueError와 RuntimeError 체인 전체 출력
```

체인을 수동으로 순회하려면:

```python
def print_exception_chain(exc):
    chain = []
    current = exc
    while current is not None:
        chain.append(current)
        if current.__cause__ is not None:
            current = current.__cause__
        elif current.__context__ is not None and not current.__suppress_context__:
            current = current.__context__
        else:
            break
    
    for i, e in enumerate(reversed(chain)):
        print(f"{'  ' * i}{type(e).__name__}: {e}")
```

## 트레이스백을 문자열로 저장하는 전체 패턴

```python
import traceback
import logging
import sys

logger = logging.getLogger(__name__)

def safe_execute(func, *args, **kwargs):
    """예외를 잡아 로그에 남기고 None을 반환"""
    try:
        return func(*args, **kwargs)
    except Exception as e:
        # 전체 체인 포함한 트레이스백
        tb = traceback.format_exc()
        logger.error(
            "함수 실행 실패: %s.%s\n%s",
            func.__module__, func.__qualname__, tb
        )
        return None
```

`traceback` 모듈은 예외를 아름답게 프레젠테이션하는 도구다. 프로덕션 로그에 트레이스백을 올바르게 포함시키면 버그를 원격에서도 정확하게 재현하고 추적할 수 있다. 다음 글에서는 예외 처리 전반의 모범 사례와 흔한 안티패턴을 정리한다.

---

**지난 글:** [warnings 모듈: 경고를 오류처럼 다루기](/posts/python-warnings/)

**다음 글:** [예외 처리 모범 사례와 안티패턴](/posts/python-exception-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
