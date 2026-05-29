---
title: "async / await 문법"
description: "async def로 코루틴을 정의하고 await로 결과를 기다리는 문법의 정확한 의미, awaitable의 종류, async for와 async with, 코루틴과 제너레이터의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "async", "await", "코루틴", "awaitable"]
featured: false
draft: false
---

[지난 글](/posts/python-asyncio-cancellation/)에서 작업을 취소하고 타임아웃을 거는 법을 다뤘다. 지금까지 `async`와 `await`를 자연스럽게 써 왔지만, 이 두 키워드가 정확히 무엇을 의미하는지 한 번 짚고 넘어갈 필요가 있다. 문법의 의미를 정확히 알면 흔한 오류를 피할 수 있다.

## async def는 코루틴 함수를 만든다

`async def`로 정의한 함수는 일반 함수가 아니라 **코루틴 함수**다. 이 함수를 호출하면 본문이 실행되는 대신 코루틴 객체가 반환된다. 실제 실행은 그 코루틴을 `await`하거나 루프에 등록해야 시작된다.

![async def와 await의 역할](/assets/posts/python-async-await-syntax-anatomy.svg)

```python
async def add(a, b):
    return a + b

coro = add(1, 2)     # 본문은 아직 실행 안 됨
print(type(coro))    # <class 'coroutine'>

import asyncio
print(asyncio.run(add(1, 2)))   # 3 — 여기서 실행
```

## await는 결과를 기다리며 양보한다

`await`는 두 가지를 동시에 한다. 첫째, 대상이 끝날 때까지 **현재 코루틴을 멈추고** 결과를 받아 온다. 둘째, 멈춰 있는 동안 **이벤트 루프에 제어권을 양보**해 다른 코루틴이 실행되게 한다. 이 양보가 asyncio 동시성의 핵심이다.

`await`는 반드시 `async def` 함수 **안에서만** 쓸 수 있다. 일반 함수나 모듈 최상단에서 쓰면 `SyntaxError`가 난다.

## await할 수 있는 것 — awaitable

아무것이나 `await`할 수 있는 것은 아니다. `await`의 대상은 **awaitable**이어야 한다. awaitable에는 세 종류가 있다.

![awaitable의 세 종류](/assets/posts/python-async-await-syntax-awaitables.svg)

```python
import asyncio

async def main():
    # 1) 코루틴
    await asyncio.sleep(0.1)
    # 2) Task / Future
    task = asyncio.create_task(asyncio.sleep(0.1))
    await task
    # 3) await 5  → TypeError: object int can't be used in 'await' expression

asyncio.run(main())
```

일반 값(정수, 문자열, 리스트 등)은 awaitable이 아니므로 `await` 대상이 될 수 없다. 동기 함수의 반환값을 `await`하려다 `TypeError`를 만나는 것이 초보자의 흔한 실수다.

## async for와 async with

`async`는 반복문과 컨텍스트 매니저에도 붙는다. 비동기 이터레이터를 도는 `async for`는 각 항목을 가져올 때마다 `await`할 수 있고, `async with`는 진입/종료 시점에 비동기 작업(예: 비동기 연결 열고 닫기)을 수행한다.

```python
import asyncio

async def main():
    # 비동기 컨텍스트 매니저 (예: DB 연결, HTTP 세션)
    async with open_connection() as conn:
        # 비동기 이터레이터에서 한 줄씩
        async for row in conn.stream("SELECT ..."):
            process(row)
```

이 둘도 `async def` 안에서만 쓸 수 있다. 비동기 이터레이터와 컨텍스트 매니저의 구현 자체는 시리즈의 별도 글에서 자세히 다룬다.

## 코루틴은 제너레이터의 사촌이다

내부적으로 코루틴은 제너레이터와 비슷한 메커니즘 위에 서 있다. 둘 다 실행 도중에 멈췄다가 재개할 수 있다. 차이는 제너레이터가 `yield`로 **값을 바깥에 내보내며** 멈추는 반면, 코루틴은 `await`로 **다른 작업의 완료를 기다리며** 멈춘다는 점이다.

```python
# 제너레이터: 값을 생산하며 일시정지
def counter():
    n = 0
    while True:
        yield n      # 값을 내보내고 멈춤
        n += 1

# 코루틴: 다른 작업을 기다리며 일시정지
async def fetch_all(urls):
    for url in urls:
        await download(url)   # 완료를 기다리며 멈춤
```

이 구조적 유사성 덕분에 둘 다 "중단 가능한 함수"라는 같은 뿌리에서 출발한다. 다음 글에서는 asyncio에서 가장 위험한 함정인, 블로킹 I/O가 루프 전체를 멈추는 문제와 그 해결책을 다룬다.

---

**지난 글:** [asyncio 작업 취소](/posts/python-asyncio-cancellation/)

**다음 글:** [블로킹 I/O와 asyncio](/posts/python-blocking-io-async/)

<br>
읽어주셔서 감사합니다. 😊
