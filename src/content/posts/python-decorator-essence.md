---
title: "데코레이터의 본질: 함수를 감싸는 함수"
description: "Python 데코레이터가 왜 '고차 함수'인지, @syntax가 내부에서 어떻게 동작하는지, 클로저와의 관계를 예제 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "데코레이터", "고차함수", "클로저", "함수형"]
featured: false
draft: false
---

[지난 글](/posts/python-side-effect-isolation/)에서 부작용을 격리하는 패턴을 살펴봤다. 이번 글에서는 Python에서 가장 '파이썬다운' 기능 중 하나인 데코레이터를 처음부터 제대로 이해한다. 데코레이터는 결국 함수를 인자로 받고 함수를 반환하는 고차 함수다. 그 원리를 모르면 `@`가 마법처럼 보이지만, 알고 나면 놀랍도록 단순하다.

## @syntax의 실제 의미

Python에서 `@decorator`는 문법 설탕(syntactic sugar)이다. 다음 두 코드는 완전히 동일하다.

```python
# @syntax 사용
@log_call
def greet(name):
    print(f"Hello, {name}")

# @syntax 없이 직접 쓰면
def greet(name):
    print(f"Hello, {name}")
greet = log_call(greet)
```

파이썬 인터프리터가 `@log_call` 줄을 만나면 `greet = log_call(greet)`를 실행하는 것과 정확히 같은 일을 한다. `greet`라는 이름은 이제 `log_call`이 반환한 새 함수를 가리킨다.

## 데코레이터의 구조

데코레이터는 세 가지 요소로 이루어진다. 외부 함수(데코레이터 자체), 내부 함수(wrapper), 그리고 재바인딩이다.

```python
def log_call(func):          # ← 데코레이터: func를 인자로 받음
    def wrapper(*args, **kwargs):
        print(f"→ {func.__name__}")
        result = func(*args, **kwargs)   # 원본 호출
        print(f"← {func.__name__}")
        return result
    return wrapper           # ← wrapper를 반환 (호출하지 않음!)

@log_call
def greet(name):
    print(f"Hello, {name}")

greet("Alice")
# → greet
# Hello, Alice
# ← greet
```

핵심은 `return wrapper`다. `wrapper`를 **호출하지 않고 객체로 반환**한다. 이후 `greet("Alice")`를 호출하면 실제로는 `wrapper("Alice")`가 실행된다.

![데코레이터 구조 개념도](/assets/posts/python-decorator-essence-concept.svg)

## 클로저와의 관계

`wrapper` 안에서 `func`를 사용하는 것이 가능한 이유는 클로저 때문이다. `wrapper`는 자신이 정의된 시점의 `func`를 캡처한다. `log_call`이 반환된 이후에도 `wrapper`는 `func`를 기억한다.

```python
def make_multiplier(n):
    def multiply(x):
        return x * n    # n은 클로저로 캡처됨
    return multiply

double = make_multiplier(2)
triple = make_multiplier(3)

print(double(5))   # 10
print(triple(5))   # 15
# double과 triple은 각각 다른 n을 기억함
```

데코레이터도 마찬가지다. `log_call(greet)`를 호출하면 `func=greet`를 기억하는 `wrapper`가 만들어진다. 이 `wrapper`가 나중에 호출될 때 `func`를 통해 원본 `greet`에 접근한다.

## 가장 단순한 데코레이터부터 만들어보기

처음엔 아무것도 하지 않는 데코레이터로 시작하면 구조가 잘 보인다.

```python
def do_nothing(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@do_nothing
def add(a, b):
    return a + b

print(add(2, 3))   # 5
print(type(add))   # <class 'function'>
print(add.__name__)  # wrapper  ← 이름이 바뀐 문제!
```

마지막 줄이 흥미롭다. `add.__name__`이 `wrapper`가 됐다. 원본 함수의 메타데이터(이름, 독스트링 등)가 사라진 것이다. 이 문제는 다음 글에서 `functools.wraps`로 해결한다.

![데코레이터 코드 패턴](/assets/posts/python-decorator-essence-code.svg)

## 실용적인 예시: 실행 시간 측정

```python
import time

def timer(func):
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__}: {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_sum(n):
    return sum(range(n))

slow_sum(1_000_000)   # slow_sum: 0.0234s
```

`@timer` 하나로 어떤 함수에든 시간 측정 기능을 붙일 수 있다. 원본 함수 코드는 전혀 건드리지 않는다. 이것이 데코레이터의 핵심 가치다 — **관심사 분리(separation of concerns)**.

## 데코레이터 적용 시점

중요한 사실이 있다. 데코레이터는 **함수가 정의될 때** 한 번 실행된다. 호출할 때마다 실행되는 게 아니다.

```python
def show_when_applied(func):
    print(f"데코레이터 적용: {func.__name__}")  # ← 정의 시 실행
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

print("before")
@show_when_applied
def hello():
    pass
print("after")

# 출력:
# before
# 데코레이터 적용: hello   ← 정의 시 즉시 실행됨
# after
```

모듈이 임포트될 때 데코레이터가 실행된다. 이 특성을 이용해 함수 등록(registry 패턴)에도 데코레이터를 활용한다.

## 정리

데코레이터를 이해하는 데 필요한 개념은 두 가지다. 함수가 일급 객체라는 것, 그리고 클로저다. `@decorator`는 `func = decorator(func)`의 문법 설탕이고, 데코레이터는 wrapper 함수를 반환하는 고차 함수다. 다음 글에서는 `functools.wraps`를 사용해 데코레이터 적용 시 메타데이터가 사라지는 문제를 해결한다.

---

**다음 글:** [functools.wraps: 데코레이터와 메타데이터 보존](/posts/python-functools-wraps/)

<br>
읽어주셔서 감사합니다. 😊
