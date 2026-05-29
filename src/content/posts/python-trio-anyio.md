---
title: "Trio와 AnyIO"
description: "구조적 동시성을 내세운 Trio의 nursery 개념과 asyncio와의 차이, 두 백엔드를 모두 지원하는 AnyIO로 라이브러리를 작성하는 방법, 언제 어떤 것을 선택할지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "Trio", "AnyIO", "구조적동시성", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/python-aiohttp-httpx/)에서 비동기 HTTP 클라이언트로 대량 요청을 처리했다. asyncio는 표준 라이브러리이자 사실상의 표준이지만, 동시성을 더 안전하고 일관되게 다루려는 다른 접근도 있다. 그 대표가 **Trio**이고, asyncio와 Trio를 모두 아우르는 호환 계층이 **AnyIO**다.

## Trio가 제안하는 것 — 구조적 동시성

asyncio에서 `create_task`로 만든 Task는 부모와 분리되어 떠돈다. 부모 코루틴이 끝나도 자식 Task가 살아남아 누수가 되거나, 예외가 조용히 사라지기 쉽다. Trio는 **구조적 동시성(structured concurrency)**으로 이 문제를 정면으로 다룬다. 모든 동시 작업은 반드시 **nursery**(작업 보육실) 블록 안에서 생성되고, 그 블록을 벗어나기 전에 모든 자식이 끝나야 한다.

![구조적 동시성 nursery 개념](/assets/posts/python-trio-anyio-nursery.svg)

```python
import trio

async def child(name, seconds):
    await trio.sleep(seconds)
    print(f"{name} 완료")

async def main():
    async with trio.open_nursery() as nursery:
        nursery.start_soon(child, "A", 1)
        nursery.start_soon(child, "B", 2)
    # 이 줄은 A, B가 모두 끝난 뒤에야 도달한다
    print("모든 자식 완료")

trio.run(main())
```

nursery 블록은 자식이 전부 끝날 때까지 기다리고, 하나라도 예외를 던지면 나머지를 자동으로 취소한 뒤 예외를 위로 올린다. 작업의 생애가 코드 블록 범위에 묶이므로 "떠도는 Task"가 원천적으로 사라진다.

## asyncio도 이 아이디어를 받아들였다

Trio의 nursery는 영향력이 컸다. Python 3.11에 도입된 `asyncio.TaskGroup`이 바로 이 구조적 동시성을 표준 라이브러리로 가져온 것이다.

```python
import asyncio

async def child(name, seconds):
    await asyncio.sleep(seconds)
    print(f"{name} 완료")

async def main():
    async with asyncio.TaskGroup() as tg:   # nursery에 해당
        tg.create_task(child("A", 1))
        tg.create_task(child("B", 2))
    print("모든 자식 완료")

asyncio.run(main())
```

개념이 거의 같다. Trio가 먼저 검증한 설계가 표준에 흡수된 사례다.

## AnyIO — 하나의 코드로 두 백엔드

라이브러리를 만드는 입장에서는 사용자가 asyncio를 쓸지 Trio를 쓸지 알 수 없다. **AnyIO**는 두 런타임 위에 공통 인터페이스를 제공해, 한 번 작성한 코드가 asyncio와 Trio 양쪽에서 그대로 돌게 해 준다.

![AnyIO의 공통 인터페이스 계층](/assets/posts/python-trio-anyio-layers.svg)

```python
import anyio

async def child(name, seconds):
    await anyio.sleep(seconds)
    print(f"{name} 완료")

async def main():
    async with anyio.create_task_group() as tg:   # nursery/TaskGroup 통합
        tg.start_soon(child, "A", 1)
        tg.start_soon(child, "B", 2)

anyio.run(main)                       # 기본 asyncio 백엔드
# anyio.run(main, backend="trio")     # Trio 백엔드로 전환
```

AnyIO는 FastAPI, HTTPX 같은 주요 라이브러리의 내부 동시성 계층으로도 쓰여, 사실상 비동기 생태계의 호환 표준 역할을 한다.

## 무엇을 선택할까

선택 기준은 단순하다. 표준만으로 충분하고 의존성을 줄이고 싶다면 **asyncio**(특히 `TaskGroup`이 있는 3.11+)가 기본이다. 동시성 설계의 안전성과 명확함을 최우선으로 두고 새 애플리케이션을 짠다면 **Trio**가 매력적이다. 그리고 두 런타임에서 모두 동작해야 하는 **라이브러리를 만든다면 AnyIO**가 정답이다.

```python
# 애플리케이션: 표준으로 충분 → asyncio + TaskGroup
# 안전성 우선 새 앱     → trio
# 재사용 라이브러리     → anyio (백엔드 무관)
```

세 가지 모두 같은 `async`/`await` 문법 위에 서 있으므로, 하나를 이해하면 나머지로 옮겨 가기 어렵지 않다. 다음 글에서는 다시 표준 동시성으로 돌아와, 스레드 사이에서 안전하게 데이터를 주고받는 `queue.Queue`를 살펴본다.

---

**지난 글:** [aiohttp와 httpx](/posts/python-aiohttp-httpx/)

**다음 글:** [스레드 안전 Queue](/posts/python-queue-thread-safe/)

<br>
읽어주셔서 감사합니다. 😊
