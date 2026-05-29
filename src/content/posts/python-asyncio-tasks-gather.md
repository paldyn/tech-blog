---
title: "asyncio Task와 gather"
description: "create_task로 코루틴을 동시 실행하는 Task를 만드는 방법, gather로 여러 작업을 모아 기다리기, return_exceptions 옵션, TaskGroup까지 asyncio 동시성의 핵심 도구를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "asyncio", "Task", "gather", "TaskGroup"]
featured: false
draft: false
---

[지난 글](/posts/python-asyncio-event-loop/)에서 이벤트 루프가 준비된 코루틴을 순환하며 실행한다는 것을 봤다. 그런데 코루틴을 단순히 `await`하면 한 번에 하나씩 순차로 실행될 뿐이다. 여러 코루틴을 **동시에** 진행시키려면 루프에 작업으로 등록해야 하고, 그 도구가 `Task`와 `gather`다.

## await만으로는 동시 실행이 안 된다

`await some_coro()`는 그 코루틴이 끝날 때까지 현재 코루틴을 멈춘다. 여러 개를 줄줄이 `await`하면 결국 순차 실행이 된다.

![순차 await와 gather의 차이](/assets/posts/python-asyncio-tasks-gather-concept.svg)

동시 실행의 핵심은 코루틴을 **먼저 모두 루프에 등록**한 뒤 결과를 기다리는 것이다. 그래야 첫 작업이 대기에 들어간 사이 다음 작업이 시작될 수 있다.

## create_task로 Task 만들기

`asyncio.create_task()`는 코루틴을 즉시 루프에 스케줄링하고 `Task` 객체를 돌려준다. Task를 만든 순간 작업은 이미 진행되기 시작하고, 나중에 `await`로 결과를 회수한다.

```python
import asyncio

async def work(name, delay):
    await asyncio.sleep(delay)
    return f"{name} 완료"

async def main():
    t1 = asyncio.create_task(work("A", 2))  # 지금부터 진행 시작
    t2 = asyncio.create_task(work("B", 2))
    # 두 작업이 동시에 도는 동안 여기서 다른 일도 가능
    print(await t1, await t2)   # 약 2초 뒤 둘 다 완료

asyncio.run(main())
```

`Task`는 `Future`의 하위 타입으로, 상태(PENDING → FINISHED/CANCELLED)를 가진다. 완료되면 `result()`로 값을, 실패했으면 그 안에 담긴 예외를 다시 던진다.

![Task의 생애주기 상태](/assets/posts/python-asyncio-tasks-gather-states.svg)

## gather — 여러 작업을 한 번에

작업이 여러 개라면 `asyncio.gather()`가 간결하다. 넘긴 코루틴들을 모두 동시에 실행하고, 결과를 **입력 순서대로** 리스트로 반환한다.

```python
import asyncio

async def fetch(n):
    await asyncio.sleep(1)
    return n * 10

async def main():
    results = await asyncio.gather(fetch(1), fetch(2), fetch(3))
    print(results)   # [10, 20, 30] — 약 1초 만에

asyncio.run(main())
```

이터러블을 펼쳐 넣을 때는 `*`를 쓴다. `await asyncio.gather(*[fetch(i) for i in range(100)])`처럼 100개를 한 번에 동시 실행할 수 있다.

## 예외 처리 — return_exceptions

`gather`는 기본적으로 작업 하나가 예외를 던지면 그 예외를 즉시 위로 전파한다. 이때 나머지 작업은 취소되지 않고 계속 돌지만 결과는 받을 수 없다. 모든 결과(성공이든 예외든)를 받고 싶으면 `return_exceptions=True`를 준다.

```python
import asyncio

async def maybe_fail(n):
    if n == 2:
        raise ValueError("2는 실패")
    await asyncio.sleep(0.1)
    return n

async def main():
    results = await asyncio.gather(
        maybe_fail(1), maybe_fail(2), maybe_fail(3),
        return_exceptions=True,
    )
    print(results)   # [1, ValueError('2는 실패'), 3]

asyncio.run(main())
```

이 옵션을 쓰면 예외가 결과 리스트의 해당 자리에 **값처럼** 담긴다. 호출 측에서 `isinstance(r, Exception)`로 걸러 처리하면 된다.

## TaskGroup — 더 안전한 묶음 (3.11+)

Python 3.11부터는 `asyncio.TaskGroup`이 권장된다. `async with` 블록 안에서 만든 Task들을 묶어 관리하고, 하나가 실패하면 나머지를 자동으로 취소한 뒤 예외를 모아 던진다. 이른바 **구조적 동시성(structured concurrency)**이다.

```python
import asyncio

async def work(n):
    await asyncio.sleep(n)
    return n

async def main():
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(work(1))
        t2 = tg.create_task(work(2))
    # 블록을 벗어날 때 모든 작업의 완료가 보장된다
    print(t1.result(), t2.result())

asyncio.run(main())
```

`gather`보다 누수가 적고 예외 처리가 명확해, 새 코드에서는 `TaskGroup`을 우선 고려할 만하다. 다음 글에서는 이렇게 만든 Task를 안전하게 취소하는 방법을 다룬다.

---

**지난 글:** [asyncio 이벤트 루프](/posts/python-asyncio-event-loop/)

**다음 글:** [asyncio 작업 취소](/posts/python-asyncio-cancellation/)

<br>
읽어주셔서 감사합니다. 😊
