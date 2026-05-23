---
title: "비동기 제너레이터: async def + yield의 결합"
description: "async def에 yield를 결합한 비동기 제너레이터의 동작 원리, 동기 제너레이터와의 차이, 비동기 컴프리헨션, 실전 스트리밍 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "비동기", "async generator", "yield", "async for", "asyncio"]
featured: false
draft: false
---

[지난 글](/posts/python-async-iterator/)에서 `__aiter__`와 `__anext__`로 비동기 이터레이터를 직접 구현하는 방법을 배웠다. 코드가 꽤 장황했다. 비동기 제너레이터를 쓰면 훨씬 간결하게 같은 결과를 얻을 수 있다. `async def`에 `yield`를 추가하는 것만으로 비동기 이터레이터가 완성된다.

## 비동기 제너레이터란

`async def` 함수 안에 `yield`가 있으면 그 함수는 **비동기 제너레이터 함수**가 된다. 호출하면 **비동기 제너레이터 객체**를 반환한다. 이 객체는 비동기 이터레이터 프로토콜(`__aiter__`, `__anext__`)을 구현하고 있다.

```python
async def async_gen():
    yield 1
    yield 2
    yield 3

ag = async_gen()
print(type(ag))   # <class 'async_generator'>
```

`async_gen()`을 호출해도 즉시 실행되지 않는다. 동기 제너레이터와 동일하게, `__anext__()`가 호출될 때만 `yield`까지 실행된다.

## 동기 제너레이터와의 차이

![비동기 제너레이터 동작 흐름](/assets/posts/python-async-generator-flow.svg)

핵심 차이는 두 가지다.

1. `async def`로 선언하므로 내부에서 `await`를 사용할 수 있다
2. `async for`나 `await anext()`로 소비해야 한다

```python
import asyncio

async def delayed_range(n):
    for i in range(n):
        await asyncio.sleep(0.1)   # I/O 대기 시뮬레이션
        yield i

async def main():
    async for val in delayed_range(3):
        print(val)   # 0, 1, 2 — 각 값 사이에 0.1초 대기

asyncio.run(main())
```

`yield`만 있는 동기 제너레이터에서는 `await`를 사용할 수 없다. 비동기 제너레이터는 두 기능을 결합한다.

## await + yield 패턴

비동기 제너레이터의 강점은 `await`와 `yield`를 자유롭게 혼용할 수 있다는 점이다.

```python
async def fetch_items(ids):
    for item_id in ids:
        data = await fetch_from_db(item_id)   # await로 비동기 I/O
        if data:
            yield data                         # yield로 결과 스트리밍
```

페이지네이션, 스트리밍 응답, 데이터베이스 커서 등에 이 패턴이 자주 쓰인다.

![비동기 제너레이터 실전 예제](/assets/posts/python-async-generator-example.svg)

## 비동기 컴프리헨션

`async for`를 컴프리헨션 안에서 쓸 수 있다. 이를 **비동기 컴프리헨션**이라 한다.

```python
async def main():
    # 비동기 리스트 컴프리헨션
    results = [n async for n in delayed_range(5)]

    # 비동기 집합 컴프리헨션
    uniq = {n % 3 async for n in delayed_range(9)}

    # 비동기 딕셔너리 컴프리헨션
    squares = {n: n**2 async for n in delayed_range(5)}

    # 비동기 제너레이터 표현식
    gen = (n * 2 async for n in delayed_range(3))
    result = [n async for n in gen]   # [0, 2, 4]
```

비동기 컴프리헨션은 `async def` 함수 안에서만 쓸 수 있다.

## 비동기 제너레이터의 제약

동기 제너레이터와 비교해 몇 가지 제약이 있다.

```python
# 1. return에 값을 줄 수 없다
async def wrong():
    yield 1
    return 42    # SyntaxError: 'return' with value in async generator

# 2. yield from을 사용할 수 없다
async def wrong2():
    yield from range(3)   # SyntaxError: 'yield from' inside async function

# 3. async for로 위임해야 한다
async def correct():
    async for item in async_sub():   # yield from 대신 이렇게
        yield item
```

`yield from`을 쓰고 싶다면 동기 `yield from`은 불가하고, 대신 `async for`로 소비하며 `yield`한다.

## 비동기 제너레이터 종료 처리

비동기 제너레이터도 `aclose()` 메서드를 제공한다. GC가 자동으로 호출하거나 직접 호출할 수 있다.

```python
async def resource_gen():
    resource = await acquire_resource()
    try:
        while True:
            data = await resource.read()
            if not data:
                break
            yield data
    finally:
        await resource.release()   # aclose() 호출 시 실행됨

async def main():
    gen = resource_gen()
    async for chunk in gen:
        if should_stop:
            await gen.aclose()   # 명시적 종료
            break
```

`finally`로 리소스를 정리하면 `aclose()` 호출 시 항상 실행된다.

## asyncio.run_sync_in_executor와 비동기 제너레이터

블로킹 동기 코드를 비동기로 감쌀 때도 비동기 제너레이터가 유용하다.

```python
import asyncio

def blocking_generator(n):
    """블로킹 동기 제너레이터"""
    for i in range(n):
        import time; time.sleep(0.1)
        yield i

async def non_blocking_wrapper(n):
    """블로킹 제너레이터를 스레드풀에서 실행"""
    loop = asyncio.get_event_loop()
    it = iter(blocking_generator(n))
    while True:
        try:
            val = await loop.run_in_executor(None, next, it)
            yield val
        except StopIteration:
            return
```

## 비동기 제너레이터로 비동기 이터레이터 재구현

[지난 글](/posts/python-async-iterator/)에서 클래스로 구현한 `AsyncRange`를 비동기 제너레이터로 간결하게 재작성할 수 있다.

```python
# 클래스 기반 (지난 글)
class AsyncRange:
    def __init__(self, stop): ...
    def __aiter__(self): ...
    async def __anext__(self): ...

# 비동기 제너레이터 기반 (훨씬 간결)
async def async_range(stop):
    for i in range(stop):
        await asyncio.sleep(0)
        yield i

# 사용법은 동일
async def main():
    async for n in async_range(5):
        print(n)
```

간단한 비동기 이터레이터는 비동기 제너레이터 함수로, 복잡한 상태 관리가 필요하면 클래스 기반 이터레이터로 구현하는 것이 좋은 기준이다.

## 정리

| 특성 | 동기 제너레이터 | 비동기 제너레이터 |
|------|----------------|-----------------|
| 선언 | `def` + `yield` | `async def` + `yield` |
| await 가능 | ✗ | ✓ |
| 소비 방법 | `for` / `next()` | `async for` / `await anext()` |
| yield from | ✓ | ✗ (async for + yield로 대체) |
| return 값 | ✓ | ✗ |
| aclose() | 없음 | ✓ |

비동기 제너레이터는 스트리밍 데이터 처리, 페이지네이션, 이벤트 스트림 등 I/O 집약적 파이프라인에서 강력한 도구다. 다음 글에서는 itertools 모듈의 핵심 함수들을 살펴본다.

---

**지난 글:** [비동기 이터레이터: __aiter__와 __anext__ 프로토콜](/posts/python-async-iterator/)

**다음 글:** [itertools 핵심: chain, product, combinations](/posts/python-itertools-chain-product/)

<br>
읽어주셔서 감사합니다. 😊
