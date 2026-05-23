---
title: "제너레이터 기반 코루틴: send()와 초기 코루틴 패턴"
description: "yield를 이용한 코루틴의 개념, send()로 값을 주입하는 방법, 프라이밍 규칙, 데이터 파이프라인 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "코루틴", "coroutine", "send", "yield", "제너레이터"]
featured: false
draft: false
---

[지난 글](/posts/python-yield-from/)에서 `yield from`으로 서브제너레이터에 작업을 위임하는 방법을 배웠다. 이번 글에서는 `yield`의 또 다른 면을 살펴본다. `yield`는 값을 **내보낼** 뿐 아니라 **받을** 수도 있다. 이 기능을 활용한 것이 제너레이터 기반 코루틴이다.

## 코루틴이란

코루틴(coroutine)은 **실행을 일시 정지하고 재개할 수 있는 함수**다. 일반 함수가 호출자에게 값을 반환하는 것과 달리, 코루틴은 실행 도중 값을 주고받으며 협력적으로 동작한다. "협력적 멀티태스킹"의 기본 단위다.

Python의 제너레이터 함수는 `send()` 메서드를 통해 코루틴으로 활용할 수 있다.

## send()로 값 주입하기

일반 제너레이터의 `yield`는 값을 반환하기만 한다. 하지만 `yield`는 표현식이기도 하다. `send()` 메서드로 전달한 값이 `yield` 표현식의 **결과값**이 된다.

```python
def echo():
    while True:
        received = yield           # send()가 보낸 값을 받음
        print(f"받은 값: {received}")

coro = echo()
next(coro)          # 프라이밍: 첫 번째 yield까지 실행
coro.send("안녕")   # 받은 값: 안녕
coro.send("Python") # 받은 값: Python
coro.close()
```

`value = yield expr` 형태에서:
- `expr`의 결과가 `next()`나 `send()`를 호출한 쪽에 반환된다
- `send(val)`로 전달한 `val`이 `value`에 저장된다

![코루틴 상태 전이](/assets/posts/python-coroutine-basics-states.svg)

## 프라이밍(Priming) 규칙

코루틴을 처음 사용하기 전에 반드시 `next(coro)` 또는 `coro.send(None)`을 호출해야 한다. 이를 **프라이밍**이라 한다.

제너레이터가 생성된 직후에는 아직 `yield` 문에 도달하지 않았다. `send()`로 값을 받을 준비가 되지 않은 상태다. 프라이밍은 코루틴을 첫 번째 `yield`까지 실행시켜 대기 상태로 만든다.

```python
def coro_func():
    x = yield 1
    print(f"x = {x}")

c = coro_func()

# 프라이밍 없이 send(값) → TypeError
# c.send(10)  # TypeError: can't send non-None value to a just-started generator

# 올바른 순서
first = next(c)    # 프라이밍, 1 반환
print(first)       # 1
c.send(10)         # x = 10
```

매번 수동으로 프라이밍하는 게 번거롭다면 데코레이터로 자동화할 수 있다.

```python
def prime(func):
    def wrapper(*args, **kwargs):
        coro = func(*args, **kwargs)
        next(coro)    # 자동 프라이밍
        return coro
    return wrapper

@prime
def auto_primed():
    while True:
        value = yield
        print(f"처리: {value}")

c = auto_primed()   # 이미 프라이밍됨
c.send("Hello")     # 처리: Hello
```

## 값을 내보내고 받는 코루틴

`yield`가 값을 반환하면서 동시에 `send()`로 새 값을 받는 패턴이다.

![코루틴 데이터 파이프라인 패턴](/assets/posts/python-coroutine-basics-pattern.svg)

```python
def running_average():
    total, count = 0, 0
    average = None
    while True:
        value = yield average      # average를 내보내고, 새 value를 받음
        if value is not None:
            total += value
            count += 1
            average = total / count

avg = running_average()
next(avg)              # 프라이밍 → None 반환

print(avg.send(10))    # 10.0
print(avg.send(20))    # 15.0
print(avg.send(30))    # 20.0
```

## 코루틴으로 데이터 파이프라인 구성

코루틴을 연결해 데이터를 단계적으로 처리하는 파이프라인을 만들 수 있다.

```python
@prime
def printer():
    while True:
        line = yield
        print(f"[출력] {line}")

@prime
def uppercase(target):
    while True:
        value = yield
        target.send(value.upper())

@prime
def filter_short(target, min_len=3):
    while True:
        value = yield
        if len(value) >= min_len:
            target.send(value)

# 파이프라인 조립
pipeline = filter_short(uppercase(printer()), min_len=3)

pipeline.send("hi")      # 길이 < 3, 통과 안 됨
pipeline.send("hello")   # [출력] HELLO
pipeline.send("ok")      # 길이 < 3, 통과 안 됨
pipeline.send("world")   # [출력] WORLD
```

## 코루틴 종료와 GeneratorExit

`close()`를 호출하면 코루틴 내부의 현재 `yield` 위치에 `GeneratorExit` 예외가 발생한다. 이 예외를 잡아 정리 작업을 수행할 수 있다.

```python
def managed_coro():
    try:
        while True:
            value = yield
            print(f"처리: {value}")
    except GeneratorExit:
        print("정리 작업 수행 중...")
    finally:
        print("코루틴 종료")

c = managed_coro()
next(c)
c.send(1)
c.send(2)
c.close()
# 정리 작업 수행 중...
# 코루틴 종료
```

`GeneratorExit`은 `BaseException`을 상속하므로 일반 `except Exception`으로는 잡히지 않는다. 명시적으로 `except GeneratorExit`이나 `finally`로 처리한다.

## 제너레이터 코루틴의 한계와 async/await

제너레이터 기반 코루틴은 강력하지만 몇 가지 한계가 있다.

1. **프라이밍 필요**: 매번 `next()`를 먼저 호출해야 한다
2. **가독성**: `yield`가 값 생산과 값 소비 두 가지 역할을 해서 코드가 직관적이지 않다
3. **이벤트 루프 통합**: 비동기 I/O와 결합하려면 추가 복잡성이 생긴다

Python 3.5부터 `async def`와 `await`가 이 모든 문제를 해결한다. `await`는 본질적으로 `yield from`에 해당하며, 코루틴임을 명확히 표시하고 프라이밍도 필요 없다.

```python
import asyncio

async def modern_coro():
    await asyncio.sleep(1)   # yield from sleep(1) 과 동일한 의미
    return "완료"
```

제너레이터 코루틴은 역사적으로 중요하고, 저수준에서 asyncio 내부를 이해할 때 필수적이다. 다음 글에서는 `send()`, `throw()`, `close()` 메서드를 체계적으로 정리한다.

---

**지난 글:** [yield from: 서브제너레이터 위임과 투명한 전달](/posts/python-yield-from/)

**다음 글:** [제너레이터 제어: send(), throw(), close() 완전 정복](/posts/python-send-throw-close/)

<br>
읽어주셔서 감사합니다. 😊
