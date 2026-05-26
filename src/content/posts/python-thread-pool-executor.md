---
title: "ThreadPoolExecutor"
description: "concurrent.futures.ThreadPoolExecutor로 I/O 바운드 작업을 스레드 풀로 병렬화하는 방법, map과 submit 차이, as_completed, Future 객체 사용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "ThreadPoolExecutor", "concurrent.futures", "Future", "I/O바운드", "스레드풀"]
featured: false
draft: false
---

[지난 글](/posts/python-process-pool/)에서 `ProcessPoolExecutor`로 CPU 바운드 작업을 병렬화했다. I/O 바운드 작업에는 프로세스보다 스레드가 적합하다. `ThreadPoolExecutor`는 `ProcessPoolExecutor`와 동일한 인터페이스를 가져, 두 가지를 상황에 따라 쉽게 바꿔 쓸 수 있다.

## ThreadPoolExecutor 기본 사용법

```python
from concurrent.futures import ThreadPoolExecutor
import requests

def fetch(url):
    response = requests.get(url)
    return response.status_code

urls = ["https://httpbin.org/delay/1"] * 5

with ThreadPoolExecutor(max_workers=5) as executor:
    results = list(executor.map(fetch, urls))
    # 5개 요청 동시 실행 — 총 시간 ≈ 1초 (순차 실행이면 5초)
print(results)
```

`with` 블록을 나가면 모든 스레드가 완료될 때까지 자동 대기한다.

![ThreadPoolExecutor 작동 원리](/assets/posts/python-thread-pool-executor-concept.svg)

## submit + as_completed — 완료 순 처리

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import time, random

def fetch_url(url):
    time.sleep(random.uniform(0.5, 2.0))
    return f"OK: {url}"

urls = ["site1.com", "site2.com", "site3.com"]

with ThreadPoolExecutor(max_workers=5) as ex:
    futures = {ex.submit(fetch_url, u): u for u in urls}
    for fut in as_completed(futures):
        url = futures[fut]
        print(f"{url}: {fut.result()}")
# 완료된 순서대로 출력
```

![ThreadPoolExecutor 코드 예제](/assets/posts/python-thread-pool-executor-code.svg)

## map vs submit 선택 기준

| 상황 | 추천 |
|------|------|
| 단순 이터러블 분배, 순서 중요 | `map` |
| 완료 즉시 처리, 타임아웃 필요 | `submit` + `as_completed` |
| 작업별 예외 개별 처리 | `submit` + `fut.result()` |
| 진행률 출력 필요 | `submit` + `as_completed` |

## Future 객체 다루기

`submit()`이 반환하는 `Future`는 비동기 계산의 핸들이다.

```python
with ThreadPoolExecutor() as ex:
    fut = ex.submit(time.sleep, 2)

    # 아직 실행 중
    print(fut.running())  # True
    print(fut.done())     # False

    # 완료 대기 (타임아웃 설정 가능)
    try:
        result = fut.result(timeout=5)
    except TimeoutError:
        fut.cancel()
```

## 예외 처리

자식 스레드의 예외는 `fut.result()` 호출 시 재발생한다.

```python
def risky(n):
    if n == 2:
        raise ValueError(f"n={n} 오류")
    return n

with ThreadPoolExecutor() as ex:
    futs = [ex.submit(risky, i) for i in range(4)]

for f in futs:
    try:
        print(f.result())
    except ValueError as e:
        print(f"예외: {e}")
```

## max_workers 설정

`ThreadPoolExecutor`의 기본 `max_workers`는 `min(32, os.cpu_count() + 4)`다. CPU 코어 수와 별개로, I/O 대기 시간이 길수록 더 많은 스레드가 효과적이다.

```python
import os
from concurrent.futures import ThreadPoolExecutor

# I/O 바운드 — 코어 수의 몇 배도 효과적
with ThreadPoolExecutor(max_workers=20) as ex:
    results = list(ex.map(download_file, file_list))
```

다만 너무 많은 스레드는 메모리와 컨텍스트 스위칭 비용을 늘린다. 실제 측정을 통해 적절한 값을 찾는 것이 좋다.

## ProcessPoolExecutor vs ThreadPoolExecutor

```python
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

# CPU 바운드 → Process
with ProcessPoolExecutor() as ex:
    cpu_results = list(ex.map(cpu_intensive, data))

# I/O 바운드 → Thread
with ThreadPoolExecutor() as ex:
    io_results = list(ex.map(io_bound, urls))
```

두 클래스 모두 동일한 `Executor` 인터페이스를 구현하므로 `ProcessPoolExecutor`를 `ThreadPoolExecutor`로 교체하거나 반대로 교체할 때 코드 변경이 최소화된다.

## 요약

- `ThreadPoolExecutor(max_workers=N)` → N개 스레드 풀
- `map(fn, iterable)` → 순서 보장, I/O 대기 중 GIL 해제로 병렬 실행
- `submit(fn, *args)` → Future 반환
- `as_completed(futures)` → 완료된 순서대로 처리
- I/O 바운드에 최적 / CPU 바운드엔 `ProcessPoolExecutor`

---

**지난 글:** [ProcessPoolExecutor](/posts/python-process-pool/)

<br>
읽어주셔서 감사합니다. 😊
