---
title: "time 모듈 vs datetime: 언제 무엇을 쓸까"
description: "Python time 모듈과 datetime 모듈의 차이를 설명합니다. time.time(), time.sleep(), time.perf_counter(), time.monotonic() 등 time 모듈의 핵심 함수와 datetime과의 역할 구분을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "time", "datetime", "성능측정", "sleep", "perf_counter", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-zoneinfo-timezone/)에서 `zoneinfo`로 타임존을 처리하는 방법을 살펴봤습니다. 이번에는 `time` 모듈을 정리하고 `datetime` 모듈과의 역할 차이를 명확히 합니다. 비슷해 보이는 두 모듈은 실제로 전혀 다른 목적을 가집니다.

## time 모듈의 역할

`time` 모듈은 Python을 C 라이브러리의 시간 관련 함수와 연결하는 저수준 인터페이스입니다. 주로 세 가지 용도로 씁니다.

1. **Unix 타임스탬프 얻기** — 현재 시각을 정수/실수로
2. **실행 대기** — `time.sleep()`
3. **코드 성능 측정** — `time.perf_counter()`

`datetime` 모듈이 날짜/시간 객체를 다루고 사람이 읽을 수 있는 포맷 변환에 특화되어 있다면, `time` 모듈은 숫자 기반의 저수준 처리에 초점을 맞춥니다.

![time vs datetime 비교](/assets/posts/python-time-vs-datetime-comparison.svg)

## time.time() — Unix 타임스탬프

```python
import time

# 현재 시각 (epoch 1970-01-01 00:00:00 UTC로부터 경과 초)
ts = time.time()
print(ts)       # 1747699800.123456  (float)

# 타임스탬프로 datetime 만들기
from datetime import datetime, timezone
dt = datetime.fromtimestamp(ts, tz=timezone.utc)
print(dt)       # 2026-05-20 00:30:00+00:00
```

`time.time()`은 시스템 시계에 의존합니다. NTP 보정, 서머타임 전환 등으로 가끔 역방향(감소)할 수 있습니다. 경과 시간을 정확히 측정하려면 `perf_counter()`를 씁니다.

## time.sleep() — 실행 일시 정지

```python
import time

print("시작")
time.sleep(1.5)   # 1.5초 대기 (스레드 차단)
print("1.5초 후")

# sleep은 GIL을 해제 — 다른 스레드가 실행될 수 있음
# 비동기 코드에서는 asyncio.sleep() 사용
```

`time.sleep()`은 현재 스레드를 블로킹합니다. `async def` 함수 내에서는 `await asyncio.sleep(n)`을 써야 이벤트 루프가 멈추지 않습니다.

## time.perf_counter() — 고해상도 성능 측정

```python
import time

start = time.perf_counter()

# 측정할 코드
for i in range(1_000_000):
    pass

elapsed = time.perf_counter() - start
print(f"소요 시간: {elapsed:.6f}초")
```

`perf_counter()`는 단조 증가하는 고해상도 클럭입니다. 역방향이 없으므로 실행 시간 측정에 가장 적합합니다. 마이크로초(10^-6초) 이하 정밀도를 제공합니다.

`time.time()` 대신 `perf_counter()`를 써야 하는 이유:
- `time.time()`은 NTP 시간 조정으로 역방향 가능
- `perf_counter()`는 하드웨어 타이머 기반으로 항상 증가

![time 모듈 코드 패턴](/assets/posts/python-time-vs-datetime-code.svg)

## time.process_time() — CPU 시간

```python
import time

cpu_start = time.process_time()
time.sleep(1)   # 대기 시간은 CPU 시간에 포함 안 됨
cpu_end = time.process_time()

print(f"CPU 시간: {cpu_end - cpu_start:.6f}초")  # 거의 0
```

`process_time()`은 프로세스가 실제로 CPU를 사용한 시간만 측정합니다. `sleep`, I/O 대기 시간은 제외됩니다. 알고리즘 복잡도 분석에 유용합니다.

## time.monotonic() — 단조 증가 시계

```python
import time

# monotonic: 역방향 불가, 하지만 perf_counter보다 낮은 해상도
t1 = time.monotonic()
time.sleep(0.5)
t2 = time.monotonic()
print(t2 - t1)   # ≈ 0.5

# 타임아웃 구현에 적합
deadline = time.monotonic() + 10  # 10초 후 만료
while time.monotonic() < deadline:
    if task_done():
        break
```

`monotonic()`과 `perf_counter()`는 둘 다 단조 증가합니다만, `perf_counter()`가 더 높은 해상도를 제공합니다. 타임아웃 구현에는 두 가지 모두 사용할 수 있습니다.

## time.struct_time — 구조화된 시각

```python
import time

# 현재 로컬 시각 구조체
lt = time.localtime()
print(lt.tm_year)   # 2026
print(lt.tm_mon)    # 5
print(lt.tm_mday)   # 20
print(lt.tm_hour)   # 9
print(lt.tm_wday)   # 1 (0=월요일)

# UTC 시각 구조체
gt = time.gmtime()

# struct_time → 문자열
s = time.strftime("%Y-%m-%d %H:%M:%S", lt)

# 문자열 → struct_time
st = time.strptime("2026-05-20", "%Y-%m-%d")
```

`time.struct_time`은 `datetime` 이전에 많이 쓰였습니다. 레거시 코드나 C 라이브러리 인터페이스에서 여전히 나타납니다.

## timeit — 코드 스니펫 벤치마크

```python
import timeit

# 문자열 결합 방식 비교
t1 = timeit.timeit(
    '"".join(str(i) for i in range(100))',
    number=10000
)
t2 = timeit.timeit(
    '"".join([str(i) for i in range(100)])',
    number=10000
)
print(f"generator: {t1:.4f}s, list: {t2:.4f}s")
```

`timeit` 모듈은 내부적으로 `perf_counter()`를 사용하여 작은 코드 조각을 반복 실행한 평균 시간을 측정합니다.

## 언제 무엇을 쓸까

| 작업 | 권장 모듈/함수 |
|------|---------------|
| 현재 날짜 구하기 | `datetime.date.today()` |
| 날짜 계산 (7일 후 등) | `datetime + timedelta` |
| 포맷 변환 (`strftime`) | `datetime.strftime()` |
| 현재 Unix 타임스탬프 | `time.time()` |
| 실행 시간 측정 | `time.perf_counter()` |
| 일정 시간 대기 | `time.sleep()` |
| 비동기 대기 | `asyncio.sleep()` |
| 타임아웃 구현 | `time.monotonic()` |
| CPU 시간 측정 | `time.process_time()` |
| 코드 벤치마크 | `timeit` 모듈 |

요약하면: **날짜와 시간을 "다루고 표현"해야 한다면 `datetime`**, **측정하거나 대기해야 한다면 `time`**입니다.

---

**지난 글:** [zoneinfo로 타임존 다루기](/posts/python-zoneinfo-timezone/)

<br>
읽어주셔서 감사합니다. 😊
