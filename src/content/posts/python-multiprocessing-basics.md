---
title: "multiprocessing 기초"
description: "Python multiprocessing 모듈로 별도 프로세스를 생성하는 방법, Queue와 Pipe로 프로세스 간 통신(IPC), Pool.map 기초, Windows/Linux 차이점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "multiprocessing", "Process", "Queue", "병렬처리", "GIL"]
featured: false
draft: false
---

[지난 글](/posts/python-threading-module/)에서 `threading` 모듈로 스레드를 다루는 방법을 살펴봤다. CPU 바운드 작업을 진짜로 병렬 실행하려면 GIL을 피해야 한다. `multiprocessing` 모듈은 별도의 Python 프로세스를 생성해 각 프로세스가 독립된 GIL을 갖게 하므로 멀티코어를 온전히 활용할 수 있다.

## threading vs multiprocessing

멀티스레딩은 하나의 프로세스 안에서 메모리를 공유하며 동작하고, 멀티프로세싱은 별도 프로세스를 생성해 메모리를 독립적으로 운영한다.

![멀티스레딩 vs 멀티프로세싱](/assets/posts/python-multiprocessing-basics-concept.svg)

## Process 기본 사용법

```python
from multiprocessing import Process

def worker(name):
    print(f"{name}: 작업 시작")
    result = sum(i * i for i in range(10_000_000))
    print(f"{name}: 결과 = {result}")

if __name__ == "__main__":
    p = Process(target=worker, args=("P1",))
    p.start()   # 자식 프로세스 시작
    p.join()    # 완료 대기
```

**`if __name__ == "__main__":` 블록이 필수다.** 없으면 Windows에서 자식 프로세스가 모듈을 임포트할 때 다시 `Process`를 생성하는 무한 루프가 발생한다.

## Queue — 프로세스 간 통신(IPC)

프로세스는 메모리를 공유하지 않는다. 결과를 전달하려면 `Queue`, `Pipe`, `Manager` 같은 IPC 수단이 필요하다.

```python
from multiprocessing import Process, Queue

def compute(n, q):
    result = sum(i * i for i in range(n))
    q.put(result)   # 결과를 큐에 넣기

if __name__ == "__main__":
    q = Queue()
    p = Process(target=compute, args=(10_000_000, q))
    p.start()
    result = q.get()   # 자식 프로세스 결과 수신
    p.join()
    print(result)
```

![multiprocessing 기본 예제](/assets/posts/python-multiprocessing-basics-code.svg)

## Pipe — 양방향 통신

`Pipe()`는 두 개의 연결 엔드를 반환한다. 부모-자식 간 양방향 통신에 쓴다.

```python
from multiprocessing import Process, Pipe

def child_proc(conn):
    msg = conn.recv()         # 부모에서 수신
    conn.send(msg.upper())    # 응답 전송
    conn.close()

if __name__ == "__main__":
    parent_conn, child_conn = Pipe()
    p = Process(target=child_proc, args=(child_conn,))
    p.start()
    parent_conn.send("hello")       # 자식에게 전송
    print(parent_conn.recv())       # 자식 응답 수신 → "HELLO"
    p.join()
```

## Pool — 간단한 병렬 실행

`Pool`은 프로세스 풀을 관리하고 작업을 분배하는 고수준 API다. `map()`으로 이터러블의 각 원소에 함수를 병렬 적용한다.

```python
from multiprocessing import Pool

def square(n):
    return n * n

if __name__ == "__main__":
    with Pool(processes=4) as pool:
        results = pool.map(square, range(10))
    print(results)
    # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

`Pool`은 내부에서 프로세스를 재사용하므로 매번 `Process`를 생성하는 것보다 효율적이다.

## 공유 메모리

`Value`와 `Array`로 프로세스 간 공유 메모리를 만들 수 있다.

```python
from multiprocessing import Process, Value

def add_100(n):
    n.value += 100

if __name__ == "__main__":
    shared = Value("i", 0)   # 'i' = int
    procs = [Process(target=add_100, args=(shared,)) for _ in range(4)]
    for p in procs: p.start()
    for p in procs: p.join()
    print(shared.value)  # 400 (경쟁 조건 주의 — Lock 필요할 수 있음)
```

## 시작 방법: spawn vs fork

`multiprocessing`은 세 가지 시작 방식을 지원한다.

| 방식 | 설명 | 기본 OS |
|------|------|---------|
| `spawn` | 새 Python 인터프리터 시작 | Windows, macOS (3.8+) |
| `fork` | 부모 프로세스 복사 | Linux |
| `forkserver` | 전용 서버 프로세스 경유 | Unix |

`fork`는 빠르지만 멀티스레드 환경에서 불안정할 수 있다. `spawn`은 느리지만 안전하다.

```python
import multiprocessing as mp

mp.set_start_method("spawn")  # 시작 방법 명시적 설정
```

## 요약

- `Process(target, args)` → 별도 프로세스로 함수 실행
- `Queue` / `Pipe` → 프로세스 간 데이터 전달
- `Pool.map(fn, iterable)` → 고수준 병렬 맵
- `Value` / `Array` → 공유 메모리
- CPU 바운드는 `multiprocessing`, I/O 바운드는 `threading` / `asyncio`

---

**지난 글:** [threading 모듈](/posts/python-threading-module/)

**다음 글:** [ProcessPoolExecutor](/posts/python-process-pool/)

<br>
읽어주셔서 감사합니다. 😊
