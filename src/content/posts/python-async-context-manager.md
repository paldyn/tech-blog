---
title: "비동기 컨텍스트 매니저"
description: "__aenter__와 __aexit__을 구현해 async with 문에서 비동기 자원을 관리하는 방법, @asynccontextmanager 데코레이터, AsyncExitStack 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "asyncio", "async with", "__aenter__", "__aexit__", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/python-exitstack/)에서 `ExitStack`으로 동적 컨텍스트 매니저를 관리하는 방법을 살펴봤다. 비동기 I/O를 다루다 보면 `await`가 필요한 자원 획득·해제를 `with` 문으로 감싸야 할 때가 생긴다. Python은 이를 위해 **비동기 컨텍스트 매니저 프로토콜**을 제공한다.

## 왜 비동기 컨텍스트 매니저가 필요한가

동기 `__enter__`/`__exit__`는 `await`를 쓸 수 없다. 데이터베이스 연결이나 HTTP 세션처럼 비동기 I/O가 필요한 자원은 `__aenter__`/`__aexit__` 쌍이 필요하다.

```python
# 잘못된 예: 동기 __enter__ 안에서 await 불가
class AsyncDB:
    def __enter__(self):
        self.conn = await db.connect()  # SyntaxError!
```

![비동기 컨텍스트 매니저 프로토콜](/assets/posts/python-async-context-manager-protocol.svg)

## 클래스로 구현: __aenter__ / __aexit__

두 메서드 모두 `async def`로 선언하고 필요하면 `await`를 사용한다.

```python
import asyncio

class AsyncDBConn:
    async def __aenter__(self):
        await asyncio.sleep(0)  # 비동기 연결 시뮬레이션
        self.conn = "connected"
        return self.conn

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await asyncio.sleep(0)  # 비동기 종료
        return False

async def main():
    async with AsyncDBConn() as conn:
        print(conn)  # connected
```

![비동기 컨텍스트 매니저 코드 예제](/assets/posts/python-async-context-manager-code.svg)

## @asynccontextmanager

`contextlib.asynccontextmanager` 데코레이터는 `@contextmanager`의 비동기 버전이다. `async def` 제너레이터 함수에 적용하면 `async with`에서 쓸 수 있는 컨텍스트 매니저가 된다.

```python
from contextlib import asynccontextmanager
import aiofiles  # 예시용

@asynccontextmanager
async def managed_file(path):
    f = await aiofiles.open(path)
    try:
        yield f
    finally:
        await f.close()

async def main():
    async with managed_file("data.txt") as f:
        content = await f.read()
```

패턴은 동기 버전과 동일하다: `yield` 앞이 진입, `yield value`가 `as`에 바인딩, `yield` 뒤가 탈출. `try/finally`로 예외 안전하게 작성하는 것도 같다.

## asyncio.timeout (Python 3.11+)

Python 3.11부터 `asyncio.timeout`이 비동기 컨텍스트 매니저로 제공된다.

```python
import asyncio

async def fetch_with_timeout():
    try:
        async with asyncio.timeout(5.0):  # 5초 타임아웃
            result = await slow_network_call()
    except TimeoutError:
        result = None
    return result
```

## 실용 예제: HTTP 세션 관리

aiohttp 라이브러리의 `ClientSession`이 대표적인 비동기 컨텍스트 매니저다.

```python
import aiohttp

async def fetch(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()
    # 블록 종료 시 세션과 응답 자동 종료
```

## AsyncExitStack

동적 개수의 비동기 컨텍스트 매니저를 관리할 때는 `contextlib.AsyncExitStack`을 쓴다.

```python
from contextlib import AsyncExitStack

async def multi_connect(hosts):
    async with AsyncExitStack() as stack:
        conns = [
            await stack.enter_async_context(connect(h))
            for h in hosts
        ]
        await do_parallel_work(conns)
```

## 동기/비동기 혼용

비동기 컨텍스트 매니저 안에서 동기 컨텍스트 매니저를 `with`로 쓰는 건 괜찮다. 반대로 비동기 컨텍스트 매니저를 일반 `with`에 쓰면 오류가 난다.

```python
async def example():
    async with async_resource() as ar:  # OK
        with sync_resource() as sr:     # OK — 중첩 가능
            pass

# 이건 안 됨
with async_resource():  # TypeError: 'async with' required
    pass
```

## 요약

- `__aenter__` + `__aexit__` → `async with` 문에서 사용 가능한 비동기 컨텍스트 매니저
- 두 메서드 모두 `async def`, 내부에서 `await` 사용 가능
- `@asynccontextmanager` → `async def` 제너레이터로 클래스 없이 구현
- `AsyncExitStack` → 동적 개수의 비동기 컨텍스트 매니저 관리

---

**지난 글:** [ExitStack — 동적 컨텍스트 매니저 스택](/posts/python-exitstack/)

**다음 글:** [GIL — 전역 인터프리터 잠금](/posts/python-gil/)

<br>
읽어주셔서 감사합니다. 😊
