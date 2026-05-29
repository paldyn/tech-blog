---
title: "asyncio 기초"
description: "asyncio가 무엇이고 언제 쓰는지, 코루틴과 async/await로 단일 스레드에서 동시성을 구현하는 원리, asyncio.run으로 비동기 프로그램을 시작하는 기본 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "asyncio", "비동기", "코루틴", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/python-thread-pool-executor/)에서 `ThreadPoolExecutor`로 I/O 바운드 작업을 스레드 풀로 병렬화했다. 스레드는 OS가 임의로 전환하기 때문에 동기화에 신경 써야 하고, 수천 개의 동시 연결을 다루면 스레드 생성 비용도 부담이 된다. `asyncio`는 단일 스레드 안에서 코루틴을 협력적으로 전환해 수만 개의 I/O 작업을 가볍게 처리한다.

## asyncio가 푸는 문제

네트워크 요청, 데이터베이스 조회, 파일 읽기 같은 I/O 작업은 대부분의 시간을 **응답을 기다리는 데** 쓴다. 동기 코드는 응답이 올 때까지 스레드를 멈춰 두지만, 그 시간에 CPU는 놀고 있다. asyncio는 한 작업이 I/O를 기다리는 동안 다른 작업을 실행해 이 빈 시간을 활용한다.

![동기 블로킹과 asyncio 동시 실행 비교](/assets/posts/python-asyncio-basics-sync-vs-async.svg)

핵심은 **동시성(concurrency)이지 병렬성(parallelism)이 아니라는 점**이다. asyncio는 한 번에 하나의 코루틴만 실행한다. 다만 그 코루틴이 `await`로 대기에 들어가면 즉시 다른 코루틴으로 넘어가므로, 겉으로는 여러 작업이 동시에 진행되는 것처럼 보인다. CPU를 오래 쓰는 계산 작업에는 효과가 없고, 오히려 멀티프로세싱이 맞다.

## 첫 번째 비동기 프로그램

코루틴은 `async def`로 정의하고, 다른 코루틴을 기다릴 때 `await`를 쓴다. 프로그램의 진입점은 `asyncio.run()`이다.

```python
import asyncio

async def main():
    print("시작")
    await asyncio.sleep(1)  # I/O 대기를 흉내내는 비동기 sleep
    print("1초 뒤 종료")

asyncio.run(main())
```

`asyncio.sleep()`은 `time.sleep()`과 다르다. `time.sleep()`은 스레드 전체를 멈추지만, `asyncio.sleep()`은 제어권을 이벤트 루프에 양보해 그동안 다른 코루틴이 실행될 수 있게 한다.

## 코루틴은 호출만으로 실행되지 않는다

`async def` 함수를 그냥 호출하면 코드가 실행되지 않고 **코루틴 객체**만 만들어진다. 실제 실행은 `await`하거나 이벤트 루프에 넘겨야 일어난다.

```python
async def greet():
    return "안녕하세요"

coro = greet()      # 아직 실행 안 됨, 코루틴 객체일 뿐
print(coro)         # <coroutine object greet at 0x...>

result = asyncio.run(greet())  # 여기서 실제 실행
print(result)       # 안녕하세요
```

코루틴 객체를 만들어 놓고 `await`하지 않으면 `RuntimeWarning: coroutine was never awaited` 경고가 뜬다. 비동기 함수의 반환값을 쓰려면 반드시 `await`해야 한다.

## 동시에 여러 코루틴 실행하기

진짜 이득은 여러 코루틴을 동시에 돌릴 때 나온다. `asyncio.gather()`로 여러 코루틴을 한꺼번에 실행하면, 각 코루틴이 대기에 들어갈 때마다 다른 코루틴이 진행된다.

```python
import asyncio
import time

async def fetch(name, delay):
    print(f"{name} 시작")
    await asyncio.sleep(delay)   # 네트워크 응답 대기를 흉내
    print(f"{name} 완료")
    return name

async def main():
    start = time.perf_counter()
    results = await asyncio.gather(
        fetch("A", 2),
        fetch("B", 2),
        fetch("C", 2),
    )
    elapsed = time.perf_counter() - start
    print(results, f"{elapsed:.1f}초")

asyncio.run(main())
```

세 작업이 각각 2초씩 걸리지만 전체는 약 2초에 끝난다. 동기 코드라면 6초가 걸렸을 일이다. 세 코루틴이 모두 거의 동시에 대기에 들어갔다가 함께 깨어나기 때문이다.

## 이벤트 루프와 코루틴의 협력

asyncio의 심장은 **이벤트 루프**다. 루프는 실행 준비가 된 코루틴을 하나씩 깨워 실행하다가, 코루틴이 `await`로 대기를 선언하면 그 코루틴을 잠시 내려놓고 다른 준비된 코루틴을 실행한다. I/O가 완료되면 해당 코루틴을 다시 실행 대기열에 올린다.

![코루틴과 이벤트 루프의 협력 구조](/assets/posts/python-asyncio-basics-coroutine-flow.svg)

이 전환은 **협력적(cooperative)**이다. 스레드처럼 OS가 강제로 끼어드는 것이 아니라, 코루틴이 `await` 지점에서 스스로 제어권을 양보한다. 그래서 `await` 없이 CPU만 오래 쓰는 코루틴은 다른 코루틴을 굶기게 된다.

## 언제 asyncio를 쓸까

asyncio는 **I/O 바운드이면서 동시 작업이 많을 때** 빛난다. 수백~수만 개의 HTTP 요청, 웹소켓 연결, 데이터베이스 쿼리를 다루는 서버가 대표적이다. 반대로 작업이 몇 개 안 되거나 CPU 계산이 주가 되는 경우에는 동기 코드나 스레드/프로세스 풀이 더 단순하고 빠르다.

```python
# I/O 바운드 + 대량 동시성 → asyncio 적합
async def crawl(urls):
    async def get(u):
        await asyncio.sleep(0.1)   # 실제로는 비동기 HTTP 요청
        return f"{u} 응답"
    return await asyncio.gather(*(get(u) for u in urls))

print(asyncio.run(crawl([f"page{i}" for i in range(1000)])))
```

위 코드는 1000개의 요청을 거의 동시에 보낸다. 스레드 1000개를 띄우는 것보다 메모리도 적게 쓰고 전환 비용도 낮다. 다음 글에서는 이 모든 것을 조율하는 이벤트 루프의 동작을 더 깊이 들여다본다.

---

**지난 글:** [ThreadPoolExecutor](/posts/python-thread-pool-executor/)

**다음 글:** [asyncio 이벤트 루프](/posts/python-asyncio-event-loop/)

<br>
읽어주셔서 감사합니다. 😊
