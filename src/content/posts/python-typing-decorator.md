---
title: "타입 힌트와 데코레이터"
description: "Callable, TypeVar, ParamSpec을 사용해 데코레이터에 정확한 타입 힌트를 붙이는 방법과 mypy/pyright가 데코레이터 타입을 추론하는 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "타입힌트", "ParamSpec", "TypeVar", "mypy", "데코레이터"]
featured: false
draft: false
---

[지난 글](/posts/python-decorator-state/)에서 상태를 가진 데코레이터를 구현했다. 이번 글에서는 데코레이터에 **정확한 타입 힌트**를 붙이는 방법을 다룬다. 타입 힌트 없는 데코레이터는 함수에 적용했을 때 원본 함수의 파라미터 타입 정보가 사라져 IDE 자동완성과 mypy 검사가 무력화된다.

## 타입 정보가 사라지는 문제

데코레이터에 타입 힌트를 붙이지 않으면 어떤 문제가 생기는지 확인해보자.

```python
from functools import wraps

def log(func):   # 타입 힌트 없음
    @wraps(func)
    def wrapper(*args, **kwargs):
        print(f"calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log
def add(a: int, b: int) -> int:
    return a + b

# IDE에서 add(...)의 파라미터 타입을 알 수 없음
# mypy: add has type (*args: Any, **kwargs: Any) -> Any
```

`add`는 이제 `(*args: Any, **kwargs: Any) -> Any` 타입이 된다. `add("hello", "world")`를 써도 타입 에러가 잡히지 않는다.

## TypeVar로 기본 타입 보존

간단한 방법은 `TypeVar`와 `Callable`로 함수 타입 자체를 보존하는 것이다.

```python
from typing import TypeVar, Callable
from functools import wraps

F = TypeVar("F", bound=Callable)

def log(func: F) -> F:
    @wraps(func)
    def wrapper(*args, **kwargs):
        print(f"calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper  # type: ignore

@log
def add(a: int, b: int) -> int:
    return a + b

add(1, 2)       # OK
add("a", "b")   # mypy 에러 잡힘!
```

`F`는 함수 타입의 TypeVar다. `log(func: F) -> F`는 "입력과 같은 타입을 반환한다"는 뜻이다. 하지만 `wrapper`의 내부 타입은 `(*args, **kwargs)`라서 `return wrapper`에 `# type: ignore`가 필요하다는 한계가 있다.

![Callable vs ParamSpec 비교](/assets/posts/python-typing-decorator-overview.svg)

## ParamSpec: 파라미터 타입까지 완벽 보존

Python 3.10에서 도입된 `ParamSpec`은 함수의 **파라미터 명세 전체**를 타입 변수로 캡처한다.

```python
from collections.abc import Callable
from typing import ParamSpec, TypeVar
from functools import wraps

P = ParamSpec("P")
R = TypeVar("R")

def log(func: Callable[P, R]) -> Callable[P, R]:
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log
def add(a: int, b: int) -> int:
    return a + b

add(1, 2)       # OK
add("a", "b")   # mypy 에러! (int 기대, str 전달)
reveal_type(add)  # (a: int, b: int) -> int
```

`P.args`와 `P.kwargs`는 `P`가 캡처한 파라미터 명세에서 위치 인자와 키워드 인자 타입을 각각 추출한다. `wrapper`가 `func`와 동일한 시그니처를 가진다고 타입 체커에 알려준다.

## 인자 있는 데코레이터의 타입 힌트

팩토리 패턴(`@retry(times=3)`)에서는 타입을 두 곳에 써야 한다.

```python
from collections.abc import Callable
from typing import ParamSpec, TypeVar
from functools import wraps

P = ParamSpec("P")
R = TypeVar("R")

def retry(
    func: Callable[P, R],
    *,
    times: int = 3
) -> Callable[P, R]:
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        for _ in range(times):
            try:
                return func(*args, **kwargs)
            except Exception:
                pass
        raise RuntimeError("All retries failed")
    return wrapper
```

인자 있는 데코레이터라면 `partial` 패턴을 활용하거나 오버로드를 쓸 수도 있다.

![완전한 타입 힌트 데코레이터](/assets/posts/python-typing-decorator-code.svg)

## overload로 선택적 인자 데코레이터 타입 지정

`@repeat` / `@repeat(n=3)` 두 형태를 지원할 때 `@overload`로 각각 타입을 지정한다.

```python
from typing import overload, ParamSpec, TypeVar, Callable
from functools import wraps, partial

P = ParamSpec("P")
R = TypeVar("R")

@overload
def repeat(func: Callable[P, R]) -> Callable[P, R]: ...
@overload
def repeat(*, n: int) -> Callable[[Callable[P, R]], Callable[P, R]]: ...

def repeat(func=None, *, n=1):
    if func is None:
        return partial(repeat, n=n)
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        for _ in range(n):
            func(*args, **kwargs)
    return wrapper
```

`@overload`는 런타임에 실행되지 않고 타입 체커에만 보인다. 실제 구현은 타입 힌트 없는 마지막 `def repeat`이다.

## Python 3.9 이하 호환

`ParamSpec`은 3.10+ 내장이지만 `typing_extensions`로 이전 버전에서 사용할 수 있다.

```python
try:
    from typing import ParamSpec
except ImportError:
    from typing_extensions import ParamSpec  # pip install typing-extensions
```

실무 라이브러리에서는 이 패턴으로 하위 호환성을 유지하는 것이 일반적이다.

## 정리

데코레이터에 올바른 타입 힌트를 붙이는 핵심은 `ParamSpec`이다. `P = ParamSpec("P")`로 파라미터 명세를 캡처하고, `wrapper(*args: P.args, **kwargs: P.kwargs)`로 동일한 시그니처를 선언하면 타입 체커가 데코레이터 이후에도 원본 함수의 타입 정보를 유지한다.

---

**지난 글:** [상태를 가진 데코레이터](/posts/python-decorator-state/)

**다음 글:** [property 데코레이터 완전 이해](/posts/python-property-as-decorator/)

<br>
읽어주셔서 감사합니다. 😊
