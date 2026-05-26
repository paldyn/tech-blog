---
title: "threading 모듈"
description: "Python threading 모듈로 스레드를 생성하고 관리하는 방법, daemon 스레드, Lock/Event/Semaphore 동기화 프리미티브, threading.local() 스레드 로컬 저장소를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "threading", "Thread", "Lock", "동기화", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/python-gil/)에서 GIL이 무엇인지, 그리고 I/O 바운드 작업에서는 멀티스레딩이 효과적이라는 점을 살펴봤다. 이번에는 Python의 `threading` 모듈을 직접 사용하는 방법을 다룬다.

## Thread 생성

`threading.Thread`로 스레드를 만들고, `start()`로 실행하고, `join()`으로 완료를 기다린다.

```python
import threading
import time

def worker(name, delay):
    print(f"{name} 시작")
    time.sleep(delay)
    print(f"{name} 완료")

t = threading.Thread(target=worker, args=("T1", 2))
t.start()    # 별도 스레드에서 worker 실행 시작
t.join()     # t 가 끝날 때까지 현재 스레드 대기
print("메인 계속")
```

`Thread(target=fn, args=(...), kwargs={...})` 형태로 인수를 전달한다.

![threading 모듈 구조](/assets/posts/python-threading-module-basics.svg)

## 여러 스레드 동시 실행

```python
threads = [
    threading.Thread(target=worker, args=(f"T{i}", i))
    for i in range(3)
]

for t in threads: t.start()
for t in threads: t.join()   # 모든 스레드 완료 대기
print("모두 완료")
```

![threading 기본 예제](/assets/posts/python-threading-module-code.svg)

## Thread 클래스 상속

상태를 저장해야 하거나 더 구조적인 코드가 필요할 때 `Thread`를 상속해 `run()`을 오버라이드한다.

```python
class DownloadThread(threading.Thread):
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.result = None

    def run(self):
        # self.url 다운로드 처리
        self.result = download(self.url)

t = DownloadThread("https://example.com/data")
t.start()
t.join()
print(t.result)
```

## Daemon 스레드

`daemon=True`로 설정하면 메인 스레드가 종료될 때 이 스레드도 강제 종료된다. 주기적 모니터링, 백그라운드 로깅처럼 프로세스 생존과 무관한 보조 작업에 쓴다.

```python
def background_monitor():
    while True:
        log_stats()
        time.sleep(60)

t = threading.Thread(target=background_monitor, daemon=True)
t.start()
# 메인이 끝나면 background_monitor 도 종료됨
```

## Lock — 공유 자원 보호

여러 스레드가 같은 변수를 동시에 수정하면 경쟁 조건이 생긴다. `Lock`으로 한 번에 하나만 접근하도록 보호한다.

```python
counter = 0
lock = threading.Lock()

def safe_increment():
    global counter
    with lock:             # lock.acquire() / release() 자동
        counter += 1

threads = [threading.Thread(target=safe_increment) for _ in range(1000)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)  # 정확히 1000
```

## Event — 스레드 간 신호

`Event`는 한 스레드가 다른 스레드에게 "이제 시작해도 된다"는 신호를 보낼 때 쓴다.

```python
ready = threading.Event()

def producer():
    time.sleep(1)
    ready.set()   # 신호 보내기

def consumer():
    ready.wait()  # 신호 받을 때까지 대기
    print("작업 시작")

t1 = threading.Thread(target=producer)
t2 = threading.Thread(target=consumer)
t1.start(); t2.start()
t1.join(); t2.join()
```

## Semaphore — 동시 접근 수 제한

`Semaphore(n)`은 최대 `n`개의 스레드가 동시에 특정 구간에 진입하도록 제한한다.

```python
# 동시에 최대 3개의 DB 연결만 허용
db_sem = threading.Semaphore(3)

def db_task(task_id):
    with db_sem:
        print(f"Task {task_id}: DB 접근 중")
        time.sleep(1)
```

## threading.local() — 스레드 로컬 저장소

`threading.local()`은 각 스레드마다 독립된 저장 공간을 제공한다. 스레드 간에 공유되지 않으므로 락 없이도 안전하다.

```python
local_data = threading.local()

def process_request(user_id):
    local_data.user = user_id   # 이 스레드만의 user
    do_work()

def do_work():
    print(f"처리 중: {local_data.user}")  # 각 스레드가 자신의 값 읽음
```

웹 프레임워크에서 요청별 컨텍스트(현재 사용자, DB 커넥션 등)를 저장할 때 자주 쓰는 패턴이다.

## 요약

| 도구 | 용도 |
|------|------|
| `Thread(target, args)` | 함수를 별도 스레드로 실행 |
| `t.start()` / `t.join()` | 시작 / 완료 대기 |
| `daemon=True` | 메인 종료 시 함께 종료 |
| `Lock` | 공유 자원 상호 배제 |
| `Event` | 스레드 간 신호 전달 |
| `Semaphore(n)` | 동시 접근 수 제한 |
| `threading.local()` | 스레드별 독립 저장소 |

---

**지난 글:** [GIL — 전역 인터프리터 잠금](/posts/python-gil/)

**다음 글:** [multiprocessing 기초](/posts/python-multiprocessing-basics/)

<br>
읽어주셔서 감사합니다. 😊
