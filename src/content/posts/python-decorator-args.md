---
title: "인자를 받는 데코레이터 만들기"
description: "@repeat(n=3)처럼 인자를 전달하는 데코레이터 패턴, 3겹 중첩 함수 구조, functools.partial을 활용한 단순화 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "데코레이터", "인자", "팩토리", "클로저"]
featured: false
draft: false
---

[지난 글](/posts/python-functools-wraps/)에서 `functools.wraps`로 메타데이터를 보존하는 방법을 배웠다. 이제 데코레이터의 다음 단계로, `@repeat(n=3)`처럼 **인자를 전달하는 데코레이터**를 만드는 방법을 다룬다. 인자 없는 데코레이터가 2겹 함수라면, 인자 있는 데코레이터는 3겹 함수다.

## 왜 3겹이 필요한가

`@repeat(n=3)`이 실행될 때 Python은 두 단계를 거친다.

```python
# @repeat(n=3)은 아래 두 줄과 동일
_decorator = repeat(n=3)   # 1단계: repeat 호출, 데코레이터 반환
greet = _decorator(greet)  # 2단계: 반환된 데코레이터에 함수 전달
```

`repeat(n=3)`가 먼저 호출되어 **데코레이터를 반환**하고, 그 데코레이터가 `greet`를 받아 `wrapper`를 반환한다. 따라서 구조가 하나 더 늘어난다.

- 인자 없는 데코레이터: `decorator(func) → wrapper`
- 인자 있는 데코레이터: `factory(args) → decorator(func) → wrapper`

## 기본 구현

```python
from functools import wraps

def repeat(n=1):                      # ① 팩토리: n을 받음
    def decorator(func):              # ② 데코레이터: func를 받음
        @wraps(func)
        def wrapper(*args, **kwargs): # ③ wrapper: 실제 실행
            for _ in range(n):
                func(*args, **kwargs)
        return wrapper
    return decorator

@repeat(n=3)
def hello():
    print("Hi!")

hello()   # Hi! / Hi! / Hi!
print(hello.__name__)  # hello
```

`n`은 `decorator`의 클로저 변수가 되고, `func`는 `wrapper`의 클로저 변수가 된다. `wrapper`는 두 값 모두에 접근할 수 있다.

![3겹 구조 시각화](/assets/posts/python-decorator-args-layers.svg)

## 선택적 인자: 괄호 없이도 쓸 수 있게

`@repeat`(괄호 없음)와 `@repeat(n=3)` 두 방식을 모두 지원하려면 약간의 처리가 필요하다.

```python
from functools import wraps, partial

def repeat(_func=None, *, n=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(n):
                func(*args, **kwargs)
        return wrapper

    if _func is not None:
        return decorator(_func)   # @repeat 형태
    return decorator              # @repeat(n=3) 형태

@repeat          # 괄호 없음 → n=1 기본값
def once():
    print("once")

@repeat(n=2)     # 괄호 있음 → n=2
def twice():
    print("twice")

once()    # once
twice()   # twice / twice
```

`_func`가 `None`이면 `@repeat(n=3)`처럼 인자가 전달된 것이고, 함수가 직접 들어오면 `@repeat`처럼 괄호 없이 쓴 것이다.

![인자 있는 데코레이터 코드](/assets/posts/python-decorator-args-code.svg)

## functools.partial 활용

`partial`을 사용하면 팩토리 패턴을 더 간결하게 표현할 수 있다.

```python
from functools import wraps, partial

def repeat(func=None, *, n=1):
    if func is None:
        return partial(repeat, n=n)   # n 고정, func 대기
    @wraps(func)
    def wrapper(*args, **kwargs):
        for _ in range(n):
            func(*args, **kwargs)
    return wrapper
```

`partial(repeat, n=n)`은 `n`이 고정된 `repeat`를 반환한다. 이후 `@repeat(n=3)`이 호출되면 `partial` 객체가 함수를 받아 `repeat(func, n=3)`를 실행한다.

## 실용 예시: 재시도 데코레이터

```python
import time
from functools import wraps

def retry(times=3, delay=0.5, exceptions=(Exception,)):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == times:
                        raise
                    time.sleep(delay)
                    print(f"재시도 {attempt}/{times}: {e}")
        return wrapper
    return decorator

@retry(times=3, delay=1.0, exceptions=(ConnectionError,))
def fetch_data(url):
    ...
```

`times`, `delay`, `exceptions` 모두 팩토리 레이어에서 받고 `wrapper`에서 클로저로 사용된다. 이 패턴은 실무에서 네트워크 요청, DB 연결, 외부 API 호출에 자주 쓰인다.

## 정리

인자 있는 데코레이터는 **팩토리 → 데코레이터 → wrapper** 3겹 구조다. 핵심은 `factory(인자)`가 실제 데코레이터를 반환하고, 그 데코레이터가 함수를 받아 wrapper를 반환한다는 흐름이다. `functools.wraps`는 3겹 구조에서도 `wrapper`에 붙이면 된다. 다음 글에서는 함수가 아닌 클래스로 데코레이터를 구현하는 방법을 다룬다.

---

**지난 글:** [functools.wraps: 데코레이터와 메타데이터 보존](/posts/python-functools-wraps/)

**다음 글:** [클래스로 만드는 데코레이터](/posts/python-class-decorator/)

<br>
읽어주셔서 감사합니다. 😊
