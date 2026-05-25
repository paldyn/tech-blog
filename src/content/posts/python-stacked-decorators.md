---
title: "중첩 데코레이터와 적용 순서"
description: "@A @B @C로 여러 데코레이터를 쌓을 때 적용 순서와 실행 순서가 어떻게 다른지, 순서가 결과에 미치는 영향을 코드 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "데코레이터", "중첩", "스택", "적용순서"]
featured: false
draft: false
---

[지난 글](/posts/python-class-decorator/)에서 클래스 기반 데코레이터를 살펴봤다. 실무에서는 하나의 함수에 여러 데코레이터를 동시에 적용하는 경우가 많다. 이때 **적용 순서**와 **실행 순서**가 직관과 반대여서 혼란을 일으킨다. 이 글에서 그 규칙을 명확히 정리한다.

## 적용(wrapping) 순서: 아래에서 위로

```python
@A
@B
@C
def func():
    pass
```

Python은 이 코드를 다음과 동일하게 처리한다.

```python
func = A(B(C(func)))
```

함수에서 **가장 가까운** `@C`가 먼저 적용되고, 그 다음 `@B`, 마지막으로 `@A`가 적용된다. 위에서 아래가 아니라 **아래에서 위**로 wrap된다.

## 실행 순서: 위에서 아래로

wrap 순서와 실행 순서는 **반대**다. `func()`를 호출하면 가장 바깥인 `A wrapper`가 먼저 실행된다.

```python
# 실행 흐름
A_wrapper 전처리
  B_wrapper 전처리
    C_wrapper 전처리
      원본 func 실행
    C_wrapper 후처리
  B_wrapper 후처리
A_wrapper 후처리
```

쉽게 기억하는 방법: 겹겹이 쌓인 양파 껍질처럼, 벗길 때는 바깥 껍질부터(실행 순서), 입을 때는 안쪽부터(적용 순서).

![중첩 데코레이터 적용 및 실행 순서](/assets/posts/python-stacked-decorators-order.svg)

## 실험으로 확인하기

```python
from functools import wraps

def make_tag(name):
    def decorator(func):
        @wraps(func)
        def wrapper(*a, **k):
            return f"<{name}>" + func(*a, **k) + f"</{name}>"
        return wrapper
    return decorator

@make_tag("b")   # 마지막 적용 (바깥)
@make_tag("i")   # 첫 번째 적용 (안쪽)
def greet():
    return "Hello"

print(greet())   # <b><i>Hello</i></b>
```

`greet = make_tag("b")(make_tag("i")(greet))`와 동일하다. 실행 시 `<b>` wrapper가 먼저 실행되고, 그 안에서 `<i>` wrapper, 마지막으로 원본 `greet`가 실행된다.

![중첩 데코레이터 코드 예시](/assets/posts/python-stacked-decorators-code.svg)

## 순서가 결과를 바꾸는 경우

데코레이터 순서는 기능적 차이를 만들 수 있다.

```python
import time
from functools import wraps

def log(func):
    @wraps(func)
    def wrapper(*a, **k):
        print(f"[LOG] {func.__name__} 호출")
        return func(*a, **k)
    return wrapper

def timer(func):
    @wraps(func)
    def wrapper(*a, **k):
        start = time.perf_counter()
        result = func(*a, **k)
        print(f"[TIME] {time.perf_counter()-start:.4f}s")
        return result
    return wrapper

# 순서 A: log가 바깥, timer가 안쪽
@log
@timer
def process_a():
    time.sleep(0.01)

# 순서 B: timer가 바깥, log가 안쪽
@timer
@log
def process_b():
    time.sleep(0.01)

process_a()
# [LOG] process_a 호출   ← log가 먼저
# [TIME] 0.0101s          ← timer가 func 실행 시간만 측정

process_b()
# [LOG] process_b 호출   ← log 실행 시간도 포함됨
# [TIME] 0.0102s          ← timer가 log + func 시간 측정
```

`timer`가 바깥(`@timer @log`)이면 `log` 실행 시간까지 포함하여 측정한다. `timer`가 안쪽(`@log @timer`)이면 원본 함수 실행 시간만 측정한다. 어느 쪽이 맞는지는 의도에 따라 다르다.

## __name__과 중첩 데코레이터

각 데코레이터에 `@wraps`를 올바르게 적용했다면, 아무리 많이 쌓아도 `__name__`은 원본을 가리킨다.

```python
@log
@timer
def process():
    """처리 함수"""
    pass

print(process.__name__)   # process
print(process.__doc__)    # 처리 함수
print(process.__wrapped__)  # timer의 wrapper
# inspect.unwrap(process)로 원본까지 도달 가능
```

`__wrapped__`는 바로 안쪽 함수를 가리킨다. `inspect.unwrap`으로 체인 전체를 따라가면 원본 `process`에 도달할 수 있다.

## 실무 권장 순서

여러 데코레이터를 함께 쓸 때 보편적으로 권장하는 순서가 있다.

```python
@login_required    # 가장 바깥: 진입 전 인증 체크
@cache(ttl=60)    # 그 다음: 캐시 hit이면 내부 실행 불필요
@log_call          # 마지막 바깥: 실제 처리 전 로깅
def get_user(uid):
    ...
```

외부 관심사(인증, 캐시)를 바깥에, 내부 관심사(로깅, 타이밍)를 안쪽에 두는 것이 일반적인 패턴이다. 팀마다 컨벤션이 다를 수 있으므로 일관성이 중요하다.

---

**지난 글:** [클래스로 만드는 데코레이터](/posts/python-class-decorator/)

**다음 글:** [상태를 가진 데코레이터](/posts/python-decorator-state/)

<br>
읽어주셔서 감사합니다. 😊
