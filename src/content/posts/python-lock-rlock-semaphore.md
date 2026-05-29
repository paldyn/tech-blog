---
title: "Lock, RLock, Semaphore"
description: "threading의 Lock으로 임계 구역을 보호하는 법, 재진입이 가능한 RLock의 필요성, 동시 접근 수를 제한하는 Semaphore, with 문으로 안전하게 락을 다루는 패턴과 교착 상태를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "threading", "Lock", "Semaphore", "동기화"]
featured: false
draft: false
---

[지난 글](/posts/python-queue-thread-safe/)에서 `queue.Queue`가 내부 락 덕분에 스레드 안전하다는 것을 봤다. 큐가 처리해 주지 못하는, 공유 변수를 직접 보호해야 하는 상황도 있다. 이때 쓰는 가장 기본적인 동기화 도구가 `threading.Lock`이며, 그 변형으로 `RLock`과 `Semaphore`가 있다.

## 왜 락이 필요한가

여러 스레드가 같은 변수를 동시에 수정하면 경쟁 상태가 생긴다. `counter += 1`조차 읽기-증가-쓰기 세 단계로 나뉘어, 중간에 다른 스레드가 끼어들면 갱신이 사라질 수 있다.

```python
import threading

counter = 0

def increment():
    global counter
    for _ in range(100_000):
        counter += 1     # 원자적이지 않음 → 경쟁 상태

threads = [threading.Thread(target=increment) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)   # 400000이 아니라 그보다 작은 값이 나올 수 있다
```

## Lock으로 임계 구역 보호하기

`Lock`은 한 번에 하나의 스레드만 임계 구역에 들어가도록 보장한다. 락을 획득한 스레드가 작업을 끝내고 풀어 줄 때까지, 다른 스레드는 대기한다.

![Lock이 임계 구역을 보호하는 모습](/assets/posts/python-lock-rlock-semaphore-lock.svg)

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:           # 획득 → 블록 끝에서 자동 해제
            counter += 1

threads = [threading.Thread(target=increment) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)   # 항상 400000
```

`with lock:`은 `lock.acquire()`와 `lock.release()`를 자동으로 짝지어 준다. 예외가 나도 락이 반드시 풀리므로, 직접 `acquire`/`release`를 부르는 것보다 훨씬 안전하다.

## RLock — 같은 스레드의 재진입

일반 `Lock`은 이미 락을 쥔 스레드가 그 락을 **다시 획득하려 하면 교착**된다. 자기 자신을 기다리느라 영원히 멈추는 것이다. 락을 잡은 메서드가 같은 락을 잡는 다른 메서드를 호출하는 구조에서 이 문제가 생긴다. `RLock`(재진입 락)은 같은 스레드라면 중첩 획득을 허용한다.

```python
import threading

class Account:
    def __init__(self):
        self._lock = threading.RLock()
        self._balance = 0

    def deposit(self, amount):
        with self._lock:
            self._balance += amount

    def deposit_twice(self, amount):
        with self._lock:           # 락 보유 중
            self.deposit(amount)   # 같은 락을 또 획득 → RLock이라 OK
            self.deposit(amount)
```

`RLock`은 획득 횟수를 세어, 같은 스레드가 획득한 만큼 해제해야 완전히 풀린다. 일반 `Lock`이었다면 `deposit_twice`에서 교착됐을 것이다.

## Semaphore — 동시 N개 허용

`Lock`이 "동시 1개"라면 `Semaphore`는 "동시 N개"다. 내부 카운터를 가지고, 정해진 수만큼의 스레드가 동시에 통과하도록 허용한다. 동시 접속 수 제한이나 자원 풀 관리에 어울린다.

![Lock, RLock, Semaphore 비교](/assets/posts/python-lock-rlock-semaphore-compare.svg)

```python
import threading
import time

sem = threading.Semaphore(3)   # 동시 3개까지

def worker(n):
    with sem:                  # 자리가 없으면 대기
        print(f"{n} 작업 중")
        time.sleep(1)

threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
for t in threads: t.start()
for t in threads: t.join()
# 한 번에 최대 3개씩만 "작업 중"이 출력된다
```

비슷한 패턴이 asyncio에도 `asyncio.Semaphore`로 있어, 앞서 본 대량 HTTP 요청의 동시성 제한에 쓰인다.

## 교착 상태 피하기

락을 여러 개 쓰면 **교착 상태(deadlock)** 위험이 생긴다. 스레드 A가 락1을 잡고 락2를 기다리는데, 스레드 B는 락2를 잡고 락1을 기다리면 둘 다 영원히 멈춘다. 가장 단순한 예방책은 **모든 스레드가 락을 같은 순서로 획득**하는 것이다.

```python
lock_a = threading.Lock()
lock_b = threading.Lock()

# ✅ 모든 스레드가 a → b 순서로 획득하면 교착 없음
def safe():
    with lock_a:
        with lock_b:
            ...   # 작업
```

정리하면, 단순 보호에는 `Lock`, 재진입이 필요하면 `RLock`, 동시 개수를 제한하려면 `Semaphore`를 쓴다. 그리고 가능하면 락을 직접 다루기보다 `queue.Queue` 같은 상위 도구로 공유 상태 자체를 줄이는 것이 가장 안전한 길이다.

---

**지난 글:** [스레드 안전 Queue](/posts/python-queue-thread-safe/)

<br>
읽어주셔서 감사합니다. 😊
