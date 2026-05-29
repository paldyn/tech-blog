---
title: "블로킹 I/O와 asyncio"
description: "asyncio에서 동기 블로킹 호출이 이벤트 루프 전체를 멈추는 이유와 증상, run_in_executor와 asyncio.to_thread로 블로킹 코드를 스레드로 떠넘기는 방법, CPU 바운드 작업의 처리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "asyncio", "블로킹", "run_in_executor", "to_thread"]
featured: false
draft: false
---

[지난 글](/posts/python-async-await-syntax/)에서 `await`가 제어권을 양보해 동시성을 만든다는 것을 봤다. 바꿔 말하면, `await` 없이 시간을 잡아먹는 코드는 양보를 하지 않는다. 이것이 asyncio 입문자가 가장 자주 부딪히는 함정이다. 비동기 함수 안에 동기 블로킹 호출을 넣으면, 동시성이 사라지고 오히려 동기 코드보다 못해진다.

## 블로킹 한 줄이 전체를 멈춘다

asyncio는 단일 스레드에서 돈다. 한 코루틴이 `time.sleep()`이나 동기 `requests.get()` 같은 블로킹 호출을 하면, 그 호출이 반환될 때까지 **이벤트 루프 자체가 멈춘다**. 그동안 다른 어떤 코루틴도 진행되지 못한다.

![블로킹 호출이 루프를 멈추는 모습](/assets/posts/python-blocking-io-async-problem.svg)

```python
import asyncio
import time

async def bad(name):
    print(f"{name} 시작")
    time.sleep(2)          # ❌ 루프 전체를 2초간 정지
    print(f"{name} 끝")

async def main():
    await asyncio.gather(bad("A"), bad("B"), bad("C"))

asyncio.run(main())   # 동시성 없음 — 약 6초 소요
```

세 작업을 `gather`로 동시에 돌리려 했지만 `time.sleep`이 양보하지 않으므로 순차 실행되어 6초가 걸린다. `time.sleep`을 `await asyncio.sleep`으로 바꾸면 약 2초로 줄어든다.

## 증상 알아채기

블로킹 함정은 조용히 성능을 갉아먹어 발견이 늦다. 비동기 서버인데 동시 요청 처리가 안 되거나, `gather`로 묶었는데 시간이 합산되어 나온다면 의심해 볼 만하다. 대표적인 블로킹 호출들을 외워 두면 도움이 된다.

- `time.sleep()` → `asyncio.sleep()`
- 동기 `requests` / `urllib` → `aiohttp` / `httpx`(async)
- 동기 DB 드라이버 → 비동기 드라이버(asyncpg 등)
- 무거운 CPU 계산(이미지 처리, 압축 등)

## run_in_executor로 떠넘기기

비동기 대안이 없는 동기 라이브러리를 꼭 써야 할 때가 있다. 그럴 때는 그 호출을 **별도 스레드**에서 실행해 루프를 해방시킨다. `loop.run_in_executor()`가 블로킹 함수를 스레드 풀에 넘기고, 그 완료를 `await`할 수 있는 awaitable로 돌려준다.

![블로킹 코드를 executor로 떠넘기기](/assets/posts/python-blocking-io-async-executor.svg)

```python
import asyncio
import requests   # 동기 라이브러리

def blocking_fetch(url):
    return requests.get(url).status_code

async def main():
    loop = asyncio.get_running_loop()
    # None → 기본 ThreadPoolExecutor 사용
    status = await loop.run_in_executor(None, blocking_fetch, "https://example.com")
    print(status)

asyncio.run(main())
```

이렇게 하면 블로킹 작업이 스레드에서 도는 동안 루프는 다른 코루틴을 계속 처리한다.

## asyncio.to_thread — 더 간단한 길

Python 3.9부터는 `asyncio.to_thread()`가 같은 일을 더 깔끔하게 해 준다. 루프를 직접 가져올 필요 없이 함수와 인자를 넘기면 된다.

```python
import asyncio
import requests

async def main():
    results = await asyncio.gather(
        asyncio.to_thread(requests.get, "https://example.com"),
        asyncio.to_thread(requests.get, "https://python.org"),
    )
    print([r.status_code for r in results])

asyncio.run(main())
```

두 동기 요청이 각각 스레드에서 동시에 처리되어, 합산이 아니라 더 느린 쪽 하나의 시간에 끝난다. 키워드 인자도 `to_thread(fn, arg, key=value)`처럼 그대로 전달된다.

## CPU 바운드는 프로세스로

스레드 풀은 I/O 블로킹에는 효과적이지만, **순수 CPU 계산**에는 GIL 때문에 큰 도움이 안 된다. 무거운 계산은 `ProcessPoolExecutor`를 executor로 지정해 별도 프로세스에서 돌리는 것이 맞다.

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

def heavy(n):
    return sum(i * i for i in range(n))

async def main():
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, heavy, 10**7)
    print(result)

asyncio.run(main())
```

정리하면, asyncio 안에서 블로킹 코드는 절대 그냥 호출하지 말고, I/O는 스레드 executor로, CPU는 프로세스 executor로 떠넘긴다. 다음 글에서는 동기 `requests`를 대체하는 비동기 HTTP 클라이언트인 aiohttp와 httpx를 살펴본다.

---

**지난 글:** [async / await 문법](/posts/python-async-await-syntax/)

**다음 글:** [aiohttp와 httpx](/posts/python-aiohttp-httpx/)

<br>
읽어주셔서 감사합니다. 😊
