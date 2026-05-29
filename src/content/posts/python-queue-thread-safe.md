---
title: "스레드 안전 Queue"
description: "queue.Queue로 스레드 사이에서 안전하게 데이터를 주고받는 생산자-소비자 패턴, put과 get의 블로킹 동작, task_done과 join, LifoQueue와 PriorityQueue까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "queue", "스레드", "생산자소비자", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/python-trio-anyio/)에서 구조적 동시성을 살펴봤다. 다시 스레드 기반 동시성으로 돌아오면, 여러 스레드가 데이터를 주고받을 때 일반 리스트를 공유하는 것은 위험하다. 여러 스레드가 동시에 수정하면 경쟁 상태가 생기기 때문이다. 표준 라이브러리의 `queue.Queue`는 내부에 락을 갖춰, 직접 동기화하지 않아도 스레드 사이에서 안전하게 데이터를 전달한다.

## 생산자-소비자 패턴

`Queue`의 대표적인 쓰임은 생산자-소비자 패턴이다. 한쪽 스레드들은 작업을 큐에 넣고(`put`), 다른 쪽 스레드들은 큐에서 꺼내(`get`) 처리한다. 큐가 중간 버퍼 역할을 하며 양쪽의 속도 차이를 흡수한다.

![생산자-소비자 패턴](/assets/posts/python-queue-thread-safe-producer-consumer.svg)

```python
import queue
import threading

q = queue.Queue()

def producer():
    for i in range(5):
        q.put(i)          # 큐에 넣기 (스레드 안전)

def consumer():
    while True:
        item = q.get()    # 비어 있으면 들어올 때까지 대기
        print("처리:", item)
        q.task_done()

threading.Thread(target=consumer, daemon=True).start()
producer()
q.join()                  # 모든 항목이 처리될 때까지 대기
```

`Queue`의 모든 메서드는 내부에서 락으로 보호되므로, 여러 스레드가 동시에 `put`/`get`을 호출해도 데이터가 깨지지 않는다.

## put과 get의 블로킹 동작

`get()`은 기본적으로 **블로킹**이다. 큐가 비어 있으면 항목이 들어올 때까지 호출한 스레드가 멈춘다. 이 덕분에 소비자는 바쁜 대기(busy-wait) 없이 효율적으로 작업을 기다린다.

```python
import queue

q = queue.Queue(maxsize=2)   # 최대 2개

q.put(1)
q.put(2)
# q.put(3)  → 큐가 가득 차 자리가 날 때까지 블로킹

# 즉시 반환받고 싶으면 block=False 또는 timeout 사용
try:
    q.put(3, timeout=1)      # 1초 안에 못 넣으면 queue.Full 예외
except queue.Full:
    print("큐가 가득 참")

try:
    item = q.get(timeout=1)  # 1초 안에 못 꺼내면 queue.Empty 예외
except queue.Empty:
    print("큐가 비어 있음")
```

`maxsize`를 주면 큐 크기가 제한되어, 생산자가 소비자보다 너무 빠를 때 메모리가 무한정 늘어나는 것을 막는다(역압, backpressure).

## task_done과 join

작업이 모두 처리됐는지 추적하려면 `task_done()`과 `join()`을 쓴다. 소비자가 항목 하나를 처리할 때마다 `task_done()`을 호출하고, 메인 스레드는 `join()`으로 미처리 항목이 0이 될 때까지 기다린다.

```python
import queue
import threading

q = queue.Queue()

def worker():
    while True:
        item = q.get()
        # ... 처리 ...
        q.task_done()        # 하나 끝났다고 표시

for _ in range(3):
    threading.Thread(target=worker, daemon=True).start()

for item in range(10):
    q.put(item)

q.join()                     # 10개가 모두 task_done 될 때까지 대기
print("모든 작업 완료")
```

`put`한 횟수와 `task_done`한 횟수가 맞아야 `join()`이 풀린다. `task_done`을 빠뜨리면 `join()`이 영원히 끝나지 않으니 주의한다.

## LifoQueue와 PriorityQueue

`queue` 모듈은 FIFO인 기본 `Queue` 외에 두 가지 변형을 더 제공한다. `LifoQueue`는 스택처럼 마지막에 넣은 것이 먼저 나오고, `PriorityQueue`는 우선순위가 높은(값이 작은) 항목이 먼저 나온다.

![queue 모듈의 세 가지 큐](/assets/posts/python-queue-thread-safe-types.svg)

```python
import queue

pq = queue.PriorityQueue()
pq.put((2, "보통 작업"))
pq.put((0, "긴급 작업"))
pq.put((1, "우선 작업"))

while not pq.empty():
    priority, task = pq.get()
    print(priority, task)
# 0 긴급 작업 / 1 우선 작업 / 2 보통 작업
```

세 큐 모두 같은 인터페이스(`put`/`get`/`join`)와 스레드 안전성을 공유한다. 참고로 asyncio에는 코루틴용으로 동작이 거의 같은 `asyncio.Queue`가 따로 있으니, 스레드냐 코루틴이냐에 맞춰 골라 쓰면 된다. 다음 글에서는 큐가 내부에서 쓰는 더 낮은 수준의 동기화 도구인 Lock, RLock, Semaphore를 직접 다뤄 본다.

---

**지난 글:** [Trio와 AnyIO](/posts/python-trio-anyio/)

**다음 글:** [Lock, RLock, Semaphore](/posts/python-lock-rlock-semaphore/)

<br>
읽어주셔서 감사합니다. 😊
