---
title: "비동기 이터레이터: __aiter__와 __anext__ 프로토콜"
description: "비동기 이터레이터 프로토콜(__aiter__, __anext__), async for 루프 동작 원리, StopAsyncIteration, 실전 구현 예제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "비동기", "async for", "__aiter__", "__anext__", "asyncio"]
featured: false
draft: false
---

[지난 글](/posts/python-send-throw-close/)에서 제너레이터 제어 메서드를 완전히 정리했다. 이번 글에서는 비동기 세계로 이동한다. Python의 `async for` 루프는 동기 `for` 루프와 비슷하지만 I/O 대기 중에 이벤트 루프에 제어권을 넘길 수 있다. 이를 가능하게 하는 것이 비동기 이터레이터 프로토콜이다.

## 비동기 이터레이터 프로토콜

동기 이터레이터 프로토콜은 `__iter__`와 `__next__`로 구성된다. 비동기 버전은 `__aiter__`와 `async def __anext__`로 구성된다.

| 구분 | 메서드 | 반환 |
|------|--------|------|
| 비동기 이터러블 | `__aiter__()` | 비동기 이터레이터 |
| 비동기 이터레이터 | `async def __anext__()` | 다음 값 (코루틴) |

소진되면 `StopIteration` 대신 `StopAsyncIteration`을 발생시킨다.

![동기 vs 비동기 이터레이터 프로토콜](/assets/posts/python-async-iterator-protocol.svg)

## async for 루프 동작 원리

`async for item in obj`는 내부적으로 다음과 같이 동작한다.

```python
# async for item in obj:
#     body

_it = obj.__aiter__()
while True:
    try:
        item = await _it.__anext__()
    except StopAsyncIteration:
        break
    # body
```

`await _it.__anext__()`가 핵심이다. 이 호출은 코루틴이므로 I/O 대기 중에 이벤트 루프에 제어권을 넘길 수 있다. 동기 이터레이터의 `next()`가 블로킹(blocking)이라면, 비동기 이터레이터의 `__anext__()`는 논블로킹(non-blocking)이다.

## 사용자 정의 비동기 이터레이터

`__aiter__`와 `async def __anext__`를 구현하면 된다.

![사용자 정의 비동기 이터레이터](/assets/posts/python-async-iterator-custom.svg)

```python
import asyncio

class AsyncRange:
    """비동기 이터레이터: 0부터 stop 미만까지 순회"""
    def __init__(self, stop: int):
        self.current = 0
        self.stop = stop

    def __aiter__(self):
        return self                     # 자기 자신이 이터레이터

    async def __anext__(self) -> int:
        if self.current >= self.stop:
            raise StopAsyncIteration    # 동기의 StopIteration과 대응
        await asyncio.sleep(0)          # 이벤트 루프에 제어 반환 시뮬레이션
        val = self.current
        self.current += 1
        return val

async def main():
    async for n in AsyncRange(5):
        print(n, end=" ")   # 0 1 2 3 4

asyncio.run(main())
```

`__anext__`가 `async def`이므로 내부에서 `await`를 자유롭게 사용할 수 있다. 데이터베이스 조회, HTTP 요청 등 I/O 작업도 넣을 수 있다.

## 실전 예제: 페이지네이션 API

비동기 이터레이터의 실제 활용 사례다. 페이지네이션이 있는 API를 순회할 때 유용하다.

```python
import asyncio
import aiohttp   # pip install aiohttp

class GithubRepos:
    """GitHub 레포지토리를 페이지 단위로 비동기 순회"""
    def __init__(self, user: str):
        self.user = user
        self.page = 1
        self.buffer = []
        self.done = False

    def __aiter__(self):
        return self

    async def __anext__(self) -> dict:
        if self.buffer:
            return self.buffer.pop(0)
        if self.done:
            raise StopAsyncIteration

        url = f"https://api.github.com/users/{self.user}/repos"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"page": self.page}) as resp:
                data = await resp.json()
        if not data:
            self.done = True
            raise StopAsyncIteration

        self.buffer = data
        self.page += 1
        return self.buffer.pop(0)

async def main():
    async for repo in GithubRepos("python"):
        print(repo["name"])
```

각 페이지를 가져오는 네트워크 요청이 진행되는 동안 이벤트 루프는 다른 코루틴을 실행할 수 있다.

## anext() 내장 함수

`next()`의 비동기 버전이다. Python 3.10부터 `anext()`가 내장 함수로 추가됐다.

```python
async def demo():
    it = AsyncRange(3)

    val = await anext(it)         # 0
    val = await anext(it)         # 1
    val = await anext(it)         # 2
    val = await anext(it, -1)     # -1 (소진 → 기본값, StopAsyncIteration 없음)

asyncio.run(demo())
```

## aiter() 내장 함수

Python 3.10에서 `aiter()` 내장 함수도 추가됐다. `obj.__aiter__()`를 호출하는 편의 함수다.

```python
async def demo():
    obj = AsyncRange(3)
    it = aiter(obj)              # obj.__aiter__() 호출
    print(await anext(it))       # 0
```

## 비동기 이터러블과 이터레이터의 분리

동기 이터레이터와 마찬가지로 비동기 이터러블과 이터레이터를 분리하면 여러 번 순회가 가능하다.

```python
class AsyncNumberRange:
    """비동기 이터러블: 매번 새 이터레이터 반환"""
    def __init__(self, stop: int):
        self.stop = stop

    def __aiter__(self):
        return AsyncRange(self.stop)   # 매번 새 이터레이터

async def main():
    r = AsyncNumberRange(3)
    async for n in r: print(n)   # 0 1 2
    async for n in r: print(n)   # 0 1 2  (재순회 가능)
```

`AsyncRange` 자체는 한 번 소진되면 끝이지만, `AsyncNumberRange`는 `__aiter__`를 호출할 때마다 새 `AsyncRange`를 만든다.

## async for vs 동기 for 비교

```python
import asyncio

# 동기: 각 I/O 작업이 순차적으로 블로킹
def sync_process(items):
    for item in items:
        time.sleep(0.1)      # 블로킹
        process(item)

# 비동기: 각 I/O 대기 중 다른 코루틴 실행 가능
async def async_process(items):
    async for item in items:   # items는 비동기 이터러블
        await asyncio.sleep(0.1)   # non-blocking
        process(item)
```

비동기 이터레이터의 강점은 `__anext__` 내에서 `await`를 사용해 I/O 대기 시 이벤트 루프에 제어를 넘기는 것이다. 단순한 계산만 한다면 동기 이터레이터로도 충분하다.

## 정리

| 구분 | 동기 | 비동기 |
|------|------|--------|
| 이터러블 메서드 | `__iter__()` | `__aiter__()` |
| 이터레이터 메서드 | `__next__()` | `async def __anext__()` |
| 종료 예외 | `StopIteration` | `StopAsyncIteration` |
| 순회 구문 | `for x in obj` | `async for x in obj` |
| 내장 함수 | `iter()`, `next()` | `aiter()`, `anext()` (3.10+) |

비동기 이터레이터는 비동기 제너레이터로 더 쉽게 구현할 수 있다. 다음 글에서 이를 살펴본다.

---

**지난 글:** [제너레이터 제어: send(), throw(), close() 완전 정복](/posts/python-send-throw-close/)

**다음 글:** [비동기 제너레이터: async def + yield의 결합](/posts/python-async-generator/)

<br>
읽어주셔서 감사합니다. 😊
