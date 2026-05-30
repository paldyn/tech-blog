---
title: "ParamSpec: 데코레이터의 시그니처를 보존하기"
description: "ParamSpec과 P.args·P.kwargs로 데코레이터가 원본 함수의 매개변수 시그니처를 그대로 유지하게 만드는 법, Concatenate까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["ParamSpec", "데코레이터", "Concatenate", "타입힌트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-protocol/)에서 구조적 타이핑을 다뤘다. 데코레이터에 타입을 입혀 본 적이 있다면, 한 가지 답답한 문제를 만났을 것이다. 데코레이터로 함수를 감싸는 순간, 원본 함수의 매개변수 정보가 `(*args, **kwargs)`로 뭉개져 버린다. IDE 자동완성도 사라지고, 잘못된 인자를 넘겨도 검사기가 잡지 못한다. `ParamSpec`은 이 "시그니처 소실" 문제를 해결하기 위해 파이썬 3.10에 도입됐다.

## 문제: 데코레이터가 시그니처를 지운다

타입을 어설프게 단 데코레이터가 어떤 문제를 일으키는지 보자.

```python
from typing import Callable, Any

def logged(fn: Callable[..., Any]) -> Callable[..., Any]:
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        print("호출:", fn.__name__)
        return fn(*args, **kwargs)
    return wrapper

@logged
def add(a: int, b: int) -> int:
    return a + b

add("x", "y")   # 검사기가 잡지 못한다! Callable[..., Any]이므로
```

`Callable[..., Any]`는 "아무 인자나 받아 아무거나 반환"을 뜻한다. 감싼 뒤의 `add`는 원래의 `(a: int, b: int) -> int` 정보를 완전히 잃었다.

## ParamSpec과 P.args, P.kwargs

`ParamSpec`은 **함수의 매개변수 목록 전체**를 하나의 변수로 잡아낸다. `TypeVar`가 하나의 타입을 담는다면, `ParamSpec`은 "매개변수 시그니처"를 통째로 담는다. 그리고 `P.args`와 `P.kwargs`로 그 시그니처를 `wrapper`에 전달한다.

```python
from typing import Callable, ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

def logged(fn: Callable[P, R]) -> Callable[P, R]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print("호출:", fn.__name__)
        return fn(*args, **kwargs)
    return wrapper
```

![ParamSpec — 데코레이터가 시그니처를 보존](/assets/posts/python-typing-paramspec-flow.svg)

`Callable[P, R]`은 "매개변수 시그니처 `P`, 반환 타입 `R`인 함수"를 뜻한다. 데코레이터가 같은 `P`와 `R`을 그대로 반환하므로, 감싼 함수가 원본과 동일한 시그니처를 유지한다.

![ParamSpec로 타입 안전한 데코레이터](/assets/posts/python-typing-paramspec-code.svg)

## 시그니처가 살아 있다

이제 감싼 함수도 원본처럼 타입 검사를 받는다.

```python
@logged
def add(a: int, b: int) -> int:
    return a + b

add(1, 2)        # OK, 반환은 int로 추론
add("x", "y")    # 오류: int 자리에 str
add(1)           # 오류: 인자 부족
```

`P.args`와 `P.kwargs`는 반드시 짝으로, `*args`와 `**kwargs`에만 써야 한다. 이 둘이 함께 있어야 검사기가 "원본의 모든 인자를 그대로 전달한다"고 이해한다.

## Concatenate: 인자를 추가하거나 제거하기

데코레이터가 인자를 하나 더 추가하거나, 앞쪽 인자를 소비하는 경우도 있다. 이때 `Concatenate`를 쓴다.

```python
from typing import Callable, Concatenate, ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

# 첫 인자로 Connection을 주입하는 데코레이터
def with_conn(
    fn: Callable[Concatenate[Connection, P], R],
) -> Callable[P, R]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        conn = get_connection()
        return fn(conn, *args, **kwargs)
    return wrapper
```

`Concatenate[Connection, P]`는 "맨 앞에 `Connection` 인자가 있고, 그 뒤로 `P`의 나머지 인자가 이어진다"는 뜻이다. 데코레이터가 `conn`을 주입하므로, 감싼 함수의 호출자는 `conn`을 넘기지 않아도 된다.

## functools.wraps와 함께

`ParamSpec`은 타입 정보를 보존하지만, `__name__`이나 `__doc__` 같은 런타임 메타데이터는 별개다. 둘을 함께 챙기려면 `functools.wraps`를 같이 쓴다.

```python
import functools
from typing import Callable, ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

def logged(fn: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        return fn(*args, **kwargs)
    return wrapper
```

`ParamSpec`은 정적 타입을, `functools.wraps`는 런타임 메타데이터를 보존한다. 둘을 함께 써야 비로소 완전히 투명한 데코레이터가 된다. 다음 글에서는 이런 타입들을 실제로 검사하는 도구인 mypy와 pyright를 비교한다.

---

**지난 글:** [typing.Protocol: 상속 없는 구조적 타이핑](/posts/python-typing-protocol/)

**다음 글:** [mypy와 pyright: 두 정적 타입 검사기 비교](/posts/python-mypy-pyright/)

<br>
읽어주셔서 감사합니다. 😊
