---
title: "asyncio 이벤트 루프"
description: "asyncio 이벤트 루프가 코루틴을 어떻게 스케줄링하는지, run의 동작, get_running_loop, call_soon과 call_later, 루프를 직접 다룰 때 주의할 점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "asyncio", "이벤트루프", "비동기", "스케줄링"]
featured: false
draft: false
---

[지난 글](/posts/python-asyncio-basics/)에서 asyncio가 단일 스레드에서 코루틴을 협력적으로 전환해 동시성을 만든다는 것을 봤다. 그 전환을 실제로 관리하는 주체가 **이벤트 루프**다. 이번에는 루프가 한 사이클마다 무엇을 하는지, 그리고 코드에서 루프를 어떻게 다루는지 살펴본다.

## 이벤트 루프의 한 사이클

이벤트 루프는 무한 반복하는 단순한 구조다. 매 사이클마다 실행 준비된 작업을 처리하고, OS에 I/O가 준비됐는지 묻고, 시간이 된 타이머를 깨운다. 이 세 가지를 끝없이 반복할 뿐이다.

![이벤트 루프의 한 사이클 단계](/assets/posts/python-asyncio-event-loop-cycle.svg)

루프가 I/O 폴링에 쓰는 것은 OS의 `select`/`epoll`/`kqueue` 같은 메커니즘이다. 준비된 소켓이 없으면 루프는 가장 가까운 타이머가 만료될 때까지 **블로킹된 채 대기**한다. 이 덕분에 할 일이 없을 때 CPU를 100% 태우지 않는다.

## asyncio.run이 하는 일

대부분의 프로그램은 루프를 직접 만들 필요 없이 `asyncio.run()` 한 줄이면 된다. 이 함수는 새 이벤트 루프를 만들고, 넘긴 코루틴을 끝까지 실행한 뒤, 루프를 닫고 정리한다.

![asyncio.run의 세 단계](/assets/posts/python-asyncio-event-loop-run.svg)

```python
import asyncio

async def main():
    print("실행 중")

asyncio.run(main())   # 루프 생성 → 실행 → 정리
```

`asyncio.run()`은 **프로그램당 한 번**만 호출하는 것이 원칙이다. 매번 호출하면 새 루프가 생성/파괴되므로 비용이 크고, 이미 실행 중인 루프 안에서 다시 호출하면 `RuntimeError`가 난다.

## 실행 중인 루프 가져오기

코루틴 안에서 현재 루프가 필요하면 `asyncio.get_running_loop()`를 쓴다. 이 함수는 실행 중인 루프가 없으면 예외를 던지므로, 코루틴 바깥에서 잘못 부르는 실수를 잡아 준다.

```python
import asyncio

async def main():
    loop = asyncio.get_running_loop()
    print(loop.time())        # 루프 기준 단조 시계 값
    print(loop.is_running())  # True

asyncio.run(main())
```

예전에 쓰던 `asyncio.get_event_loop()`는 실행 중인 루프가 없으면 새로 만드는 등 동작이 모호해 혼란을 일으켰다. 코루틴 안이라면 항상 `get_running_loop()`를 쓰는 것이 안전하다.

## call_soon과 call_later

루프에는 일반 함수(코루틴이 아닌)를 예약하는 저수준 API도 있다. `call_soon()`은 다음 사이클에, `call_later()`는 지정한 시간 뒤에 콜백을 실행한다.

```python
import asyncio

def callback(name):
    print(f"{name} 실행됨")

async def main():
    loop = asyncio.get_running_loop()
    loop.call_soon(callback, "즉시")
    loop.call_later(1.0, callback, "1초 뒤")
    await asyncio.sleep(1.5)   # 콜백들이 실행될 시간을 준다

asyncio.run(main())
```

이 콜백들은 일반 함수이므로 `await`할 수 없고, 안에서 블로킹하면 루프 전체가 멈춘다. 보통은 코루틴과 `await`로 충분하고, `call_soon`류는 프레임워크나 라이브러리 내부에서 주로 쓰인다.

## 루프를 막으면 안 되는 이유

이벤트 루프는 단일 스레드다. 한 코루틴이 `await` 없이 무거운 계산이나 동기 블로킹 호출(`time.sleep`, 동기 `requests.get` 등)을 하면, 그 시간 동안 **다른 모든 코루틴이 멈춘다**. 루프가 다음 사이클로 넘어갈 수 없기 때문이다.

```python
import asyncio
import time

async def bad():
    time.sleep(3)        # ❌ 루프 전체를 3초간 정지시킴

async def good():
    await asyncio.sleep(3)  # ✅ 다른 코루틴이 그동안 실행됨
```

블로킹 코드를 꼭 써야 한다면 `loop.run_in_executor()`로 스레드/프로세스 풀에 떠넘겨 루프를 해방시킬 수 있다. 이 패턴은 뒤의 "블로킹 I/O와 asyncio" 글에서 자세히 다룬다. 다음 글에서는 여러 코루틴을 동시에 스케줄링하는 핵심 도구인 Task와 gather를 살펴본다.

---

**지난 글:** [asyncio 기초](/posts/python-asyncio-basics/)

**다음 글:** [asyncio Task와 gather](/posts/python-asyncio-tasks-gather/)

<br>
읽어주셔서 감사합니다. 😊
