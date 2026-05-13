---
title: "파이썬 함수 어노테이션 완전 가이드"
description: "파이썬 함수 어노테이션의 문법, __annotations__ 딕셔너리, typing 모듈 변천사, Callable·Optional·Union 표기법을 실전 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "타입힌트", "어노테이션", "typing", "mypy"]
featured: false
draft: false
---

[지난 글](/posts/python-higher-order-functions/)에서 고차 함수를 다뤘습니다. 이번에는 함수 정의에 타입 정보를 표현하는 **어노테이션(annotation)** 을 파고듭니다. 런타임에는 강제력이 없지만, 코드 읽기·정적 분석·IDE 지원에서 어노테이션은 핵심 역할을 합니다.

## 어노테이션이란

어노테이션은 파라미터와 반환값에 **메타데이터를 첨부하는 문법**입니다. PEP 3107(Python 3.0)에서 도입되었고, PEP 484(Python 3.5)에서 타입 힌트 규약이 정해졌습니다.

```python
def add(x: int, y: int) -> int:
    return x + y
```

- `x: int` — x 파라미터의 어노테이션은 `int`
- `-> int` — 반환값의 어노테이션은 `int`

어노테이션은 **런타임에 강제되지 않습니다.** `add("a", "b")` 를 호출해도 오류 없이 `"ab"` 를 반환합니다. 어노테이션은 힌트이지 타입 시스템이 아닙니다.

## `__annotations__` 딕셔너리

모든 어노테이션은 함수 객체의 `__annotations__` 딕셔너리에 저장됩니다.

```python
def greet(name: str, age: int = 0) -> str:
    return f"{name}({age})"

print(greet.__annotations__)
# {'name': <class 'str'>, 'age': <class 'int'>, 'return': <class 'str'>}
```

반환 어노테이션의 키는 문자열 `"return"` 입니다. `inspect.get_annotations()` (Python 3.10+) 또는 `typing.get_type_hints()` 로 더 안전하게 접근할 수 있습니다.

![함수 어노테이션 문법](/assets/posts/python-function-annotations-syntax.svg)

## typing 모듈과 버전별 변천

### Python 3.5 ~ 3.8

`typing` 모듈에서 `List`, `Dict`, `Optional`, `Union` 등을 임포트해야 했습니다.

```python
from typing import List, Dict, Optional, Union, Callable, Any

def process(
    items: List[int],
    mapping: Dict[str, Any],
    callback: Optional[Callable[[int], str]] = None,
) -> Union[str, None]:
    ...
```

### Python 3.9 이후 — 내장 타입에 직접 제네릭

`list[int]`, `dict[str, int]` 처럼 내장 타입을 대괄호와 함께 직접 쓸 수 있습니다. `typing.List` 는 deprecated 상태입니다.

```python
def process(items: list[int], mapping: dict[str, str]) -> list[str]:
    return [mapping.get(str(i), "") for i in items]
```

### Python 3.10 이후 — 유니온 `|` 연산자

```python
# 이전 방식
def f(x: Union[int, str]) -> Optional[str]: ...

# 3.10+ 방식
def f(x: int | str) -> str | None: ...
```

### 지연 평가 — `from __future__ import annotations`

전방 참조(아직 정의되지 않은 클래스를 어노테이션으로 사용)나 성능이 중요한 경우 이 임포트를 파일 상단에 추가합니다.

```python
from __future__ import annotations

class Node:
    def __init__(self, next: Node | None = None):  # 전방 참조 가능
        self.next = next
```

이 경우 어노테이션은 문자열로 저장되고, `typing.get_type_hints()` 호출 시에만 실제 타입 객체로 평가됩니다.

![타입 힌트 버전별 변천](/assets/posts/python-function-annotations-typing.svg)

## 주요 타입 표현

### Optional과 None

```python
from typing import Optional  # Python 3.8 이하

def find(name: str) -> Optional[str]:  # str | None 과 동일
    return None

# Python 3.10+
def find(name: str) -> str | None:
    return None
```

### Callable

함수를 받는 파라미터의 타입을 표현합니다.

```python
from collections.abc import Callable

# Callable[[인자타입, ...], 반환타입]
def apply(func: Callable[[int, int], int], a: int, b: int) -> int:
    return func(a, b)

apply(lambda x, y: x + y, 3, 4)  # 7
```

### TypeVar — 제네릭 함수

```python
from typing import TypeVar

T = TypeVar("T")

def identity(value: T) -> T:
    return value

# 타입 체커가 입력 타입을 추론해 반환 타입을 맞춰줌
x: int = identity(42)   # OK
y: str = identity("hi") # OK
```

### ParamSpec — 데코레이터 어노테이션 (Python 3.10+)

```python
from typing import ParamSpec, TypeVar, Callable
import functools

P = ParamSpec("P")
R = TypeVar("R")

def logged(func: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"호출: {func.__name__}")
        return func(*args, **kwargs)
    return wrapper
```

## 어노테이션 없는 코드 vs 있는 코드

```python
# 어노테이션 없음 — 의도 불명확
def calc(data, mode, threshold=0):
    ...

# 어노테이션 있음 — 인터페이스가 문서화됨
def calc(
    data: list[float],
    mode: str,
    threshold: float = 0.0,
) -> dict[str, float]:
    ...
```

어노테이션은 docstring 없이도 함수 인터페이스를 명확하게 전달합니다.

## 런타임 검사 — typing.get_type_hints

```python
import typing

def greet(name: str, age: int = 0) -> str:
    return f"{name}({age})"

hints = typing.get_type_hints(greet)
# {'name': <class 'str'>, 'age': <class 'int'>, 'return': <class 'str'>}
```

`get_type_hints()` 는 `from __future__ import annotations` 로 문자열화된 어노테이션을 실제 타입 객체로 평가합니다. 데코레이터·프레임워크에서 런타임 타입 검사를 구현할 때 사용합니다.

## 실전 활용 — 입력 검증 데코레이터

```python
import functools
import typing

def validate_types(func):
    hints = typing.get_type_hints(func)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        sig = inspect.signature(func)
        bound = sig.bind(*args, **kwargs)
        for param, value in bound.arguments.items():
            if param in hints:
                expected = hints[param]
                if not isinstance(value, expected):
                    raise TypeError(
                        f"{param}: {type(value).__name__} != {expected.__name__}"
                    )
        return func(*args, **kwargs)

    return wrapper

@validate_types
def add(x: int, y: int) -> int:
    return x + y

add(1, 2)       # OK
add(1, "two")   # TypeError: y: str != int
```

## 핵심 정리

- 어노테이션은 `파라미터: 타입`, 반환은 `-> 타입` 문법
- `__annotations__` 딕셔너리에 저장, 런타임 강제 없음
- Python 3.9+에서 내장 타입 직접 제네릭, 3.10+에서 `|` 유니온
- `from __future__ import annotations` 로 전방 참조·지연 평가 가능
- `typing.get_type_hints()` 로 런타임 타입 정보 접근

---

**지난 글:** [파이썬 고차 함수 완전 정복](/posts/python-higher-order-functions/)

**다음 글:** [파이썬 콜 스택과 트레이스백 읽기](/posts/python-call-stack-traceback/)

<br>
읽어주셔서 감사합니다. 😊
