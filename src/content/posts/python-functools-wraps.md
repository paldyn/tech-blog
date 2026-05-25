---
title: "functools.wraps: 데코레이터와 메타데이터 보존"
description: "데코레이터 적용 후 사라지는 __name__, __doc__, __annotations__ 등 메타데이터를 functools.wraps로 보존하는 방법과 그 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "functools", "wraps", "데코레이터", "메타데이터"]
featured: false
draft: false
---

[지난 글](/posts/python-decorator-essence/)에서 데코레이터의 본질과 `@syntax`가 `func = decorator(func)`와 동일하다는 것을 살펴봤다. 이번 글에서는 데코레이터를 실무에서 올바르게 사용하기 위해 반드시 알아야 할 `functools.wraps`를 다룬다. 이것을 빠뜨리면 디버깅과 자동화 도구가 조용히 오동작한다.

## 메타데이터 소실 문제

데코레이터를 적용하면 원본 함수의 이름이 `wrapper`로 바뀐다. 간단한 실험으로 확인해보자.

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@my_decorator
def add(a: int, b: int) -> int:
    """두 수를 더합니다."""
    return a + b

print(add.__name__)        # wrapper  ← 바뀜!
print(add.__doc__)         # None     ← 사라짐!
print(add.__annotations__) # {}       ← 사라짐!
```

`add`라는 이름은 이제 `wrapper` 함수를 가리키기 때문에 `__name__`은 `"wrapper"`가 된다. 독스트링과 타입 힌트도 `wrapper`에 없으므로 모두 사라진다.

이 문제는 단순한 불편함이 아니다. 로그 시스템이 함수 이름으로 `"wrapper"`를 찍고, FastAPI가 타입 힌트를 읽지 못해 자동 API 문서가 깨지고, `pytest`에서 함수 추적이 꼬인다.

## functools.wraps 해결책

`functools.wraps`는 원본 함수의 메타데이터를 `wrapper`에 복사해주는 데코레이터다.

```python
from functools import wraps

def my_decorator(func):
    @wraps(func)          # ← 이 한 줄이 전부
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@my_decorator
def add(a: int, b: int) -> int:
    """두 수를 더합니다."""
    return a + b

print(add.__name__)        # add      ✓
print(add.__doc__)         # 두 수를 더합니다.  ✓
print(add.__annotations__) # {'a': int, 'b': int, 'return': int}  ✓
print(add.__wrapped__)     # <function add at 0x...>  ← 원본 함수 참조
```

`@wraps(func)`는 `wrapper = wraps(func)(wrapper)`, 즉 `update_wrapper(wrapper, func)`를 호출하는 것과 같다.

![functools.wraps 비교](/assets/posts/python-functools-wraps-problem.svg)

## wraps가 복사하는 속성

`functools.wraps`는 `WRAPPER_ASSIGNMENTS` 상수에 정의된 속성을 복사한다.

```python
import functools
print(functools.WRAPPER_ASSIGNMENTS)
# ('__module__', '__name__', '__qualname__',
#  '__annotations__', '__doc__')

print(functools.WRAPPER_UPDATES)
# ('__dict__',)
```

`__dict__`는 복사가 아닌 update(병합)다. 원본 함수에 커스텀 속성이 있으면 `wrapper.__dict__`에 추가된다.

![복사되는 속성 목록](/assets/posts/python-functools-wraps-attributes.svg)

## __wrapped__와 inspect.unwrap

`@wraps(func)`는 `wrapper.__wrapped__ = func`도 설정한다. 이를 통해 데코레이터를 걷어내고 원본 함수에 접근할 수 있다.

```python
import inspect

@my_decorator
@my_decorator   # 두 번 적용
def greet(name):
    """인사 함수"""
    return f"Hello, {name}"

# 체인 따라 원본까지 도달
original = inspect.unwrap(greet)
print(original.__name__)  # greet
print(original.__doc__)   # 인사 함수
```

`inspect.unwrap`은 `__wrapped__` 체인을 재귀적으로 따라가서 가장 안쪽 원본 함수를 반환한다. 테스트에서 모킹 없이 원본을 직접 호출할 때도 유용하다.

## 직접 update_wrapper 사용

`wraps`를 사용할 수 없는 상황(예: 클래스 기반 데코레이터)에서는 `update_wrapper`를 직접 호출한다.

```python
from functools import update_wrapper

class Timer:
    def __init__(self, func):
        self.func = func
        update_wrapper(self, func)   # ← 직접 호출

    def __call__(self, *args, **kwargs):
        import time
        start = time.perf_counter()
        result = self.func(*args, **kwargs)
        print(f"{self.func.__name__}: {time.perf_counter()-start:.4f}s")
        return result

@Timer
def slow(n):
    """느린 함수"""
    return sum(range(n))

print(slow.__name__)  # slow   ✓
print(slow.__doc__)   # 느린 함수  ✓
```

## 실무 규칙

데코레이터를 작성할 때 `@wraps(func)`는 선택이 아니라 기본값이어야 한다. 빠뜨리면 조용히 메타데이터가 사라진다. 린터(flake8, pylint)에서도 이를 잡아주지 않으므로 습관으로 만들어야 한다. 데코레이터 코드 템플릿을 하나 만들어두고 매번 복사해서 시작하는 것이 좋다.

```python
from functools import wraps

def my_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        # 전처리
        result = func(*args, **kwargs)
        # 후처리
        return result
    return wrapper
```

다음 글에서는 인자를 받는 데코레이터를 만드는 방법, 즉 `@decorator(arg)`처럼 인자를 전달하는 패턴을 다룬다.

---

**지난 글:** [데코레이터의 본질: 함수를 감싸는 함수](/posts/python-decorator-essence/)

**다음 글:** [인자를 받는 데코레이터 만들기](/posts/python-decorator-args/)

<br>
읽어주셔서 감사합니다. 😊
