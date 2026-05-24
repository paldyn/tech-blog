---
title: "메모이제이션 패턴: 계산 결과 캐싱 전략"
description: "메모이제이션의 원리, functools.lru_cache와 cache 데코레이터, 수동 딕셔너리 캐시, TTL 캐시, 캐시 무효화 전략, 그리고 메모이제이션 함정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "메모이제이션", "lru_cache", "cache", "functools", "성능최적화", "캐싱"]
featured: false
draft: false
---

[지난 글](/posts/python-tail-recursion-limit/)에서 재귀 깊이 제한과 해결책을 살펴봤다. 재귀와 밀접하게 연결된 또 다른 최적화 기법이 **메모이제이션(Memoization)**이다. 동일한 인자로 함수가 반복 호출될 때 이전 결과를 캐시해서 재계산을 피하는 방식이다.

## 메모이제이션이란?

메모이제이션은 함수의 반환 값을 캐시에 저장하고, 같은 인자로 다시 호출하면 캐시에서 즉시 반환하는 기법이다. **순수 함수에만 적용 가능하다** — 같은 입력에 항상 같은 출력을 보장해야 캐시가 유효하기 때문이다.

![메모이제이션 동작 원리](/assets/posts/python-memoization-pattern-concept.svg)

```python
# 메모이제이션 없는 피보나치 — 지수 시간
def fib_naive(n):
    if n < 2:
        return n
    return fib_naive(n - 1) + fib_naive(n - 2)

# fib_naive(40) → 약 1억 번 호출
# fib_naive(50) → 약 10억 번 이상
```

피보나치에서 `fib(3)`은 `fib(5)`를 계산하는 과정에서 여러 번 호출된다. 메모이제이션 없이는 지수 시간, 메모이제이션을 적용하면 선형 시간으로 줄어든다.

## functools.lru_cache

Python 표준 라이브러리의 `functools.lru_cache`가 메모이제이션 데코레이터다.

```python
from functools import lru_cache
import time

@lru_cache(maxsize=128)   # 최대 128개 결과 캐시
def slow_function(n: int) -> int:
    time.sleep(0.01)   # 느린 계산 시뮬레이션
    return n * n

# 처음 호출: 실제 계산
slow_function(5)    # ~10ms

# 두 번째 이상: 캐시 히트
slow_function(5)    # ~0ms

# 캐시 통계
print(slow_function.cache_info())
# CacheInfo(hits=1, misses=1, maxsize=128, currsize=1)

# 캐시 초기화
slow_function.cache_clear()
```

`maxsize=128`은 최대 128개의 (입력, 결과) 쌍을 저장한다. LRU(Least Recently Used) 방식으로 128개를 초과하면 가장 오래 쓰이지 않은 항목부터 제거한다. `maxsize=None`으로 설정하면 무제한 캐시가 된다.

## functools.cache (Python 3.9+)

```python
from functools import cache

@cache   # @lru_cache(maxsize=None)과 동일
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(100))   # 354224848179261915075, 즉시 계산
```

Python 3.9에서 추가된 `@cache`는 `@lru_cache(maxsize=None)`의 간단한 버전이다. 무제한 캐시가 필요하고 LRU 제거 정책이 필요 없을 때 더 명시적이고 약간 더 빠르다.

## 구현 방식 비교

![메모이제이션 구현 방식](/assets/posts/python-memoization-pattern-impl.svg)

**수동 딕셔너리 메모이제이션**이 `lru_cache`보다 유리한 경우가 있다. 캐시 만료(TTL), 조건부 캐시, 외부 저장소(Redis) 연동 등 커스텀 로직이 필요할 때다.

```python
def make_memoized(fn):
    cache = {}
    def wrapper(*args):
        if args not in cache:
            cache[args] = fn(*args)
        return cache[args]
    wrapper.cache = cache
    return wrapper

@make_memoized
def heavy(n: int) -> int:
    return sum(range(n))
```

**TTL 기반 캐시** — API 응답처럼 일정 시간 후 무효화가 필요할 때:

```python
import time
from functools import wraps

def ttl_cache(ttl: float = 60.0):
    def decorator(fn):
        cache = {}
        timestamps = {}
        @wraps(fn)
        def wrapper(*args):
            now = time.monotonic()
            if args in cache and now - timestamps[args] < ttl:
                return cache[args]
            result = fn(*args)
            cache[args] = result
            timestamps[args] = now
            return result
        return wrapper
    return decorator

@ttl_cache(ttl=30.0)
def fetch_user(user_id: int) -> dict:
    return db.get_user(user_id)   # 30초 동안 캐시
```

## 메모이제이션의 함정

**함정 1: 가변 인자**

`lru_cache`는 인자가 해시 가능해야 한다. 리스트나 딕셔너리를 인자로 받는 함수에는 직접 쓸 수 없다.

```python
@lru_cache
def process(data: list) -> int:   # TypeError: unhashable type 'list'
    return sum(data)

# 해결: tuple로 변환
@lru_cache
def process(data: tuple) -> int:
    return sum(data)

process(tuple([1, 2, 3]))
```

**함정 2: 불순 함수에 적용**

`datetime.now()`, 랜덤 값, DB 쿼리 결과처럼 동일 입력에 다른 출력을 내는 함수에 메모이제이션을 적용하면 첫 번째 결과가 영원히 캐시된다.

```python
# 위험: 불순 함수에 lru_cache
@lru_cache
def current_time():   # 항상 첫 호출 시 시간 반환
    return datetime.now()
```

**함정 3: 메모리 누수**

`maxsize=None`이면 캐시가 무한정 커진다. 장기 실행 프로세스에서는 `maxsize`를 적절히 설정하거나 주기적으로 `cache_clear()`를 호출해야 한다.

```python
# 주기적 캐시 초기화
import schedule

schedule.every(1).hours.do(expensive.cache_clear)
```

메모이제이션은 순수 함수, 반복 호출 빈도가 높은 함수, 계산 비용이 큰 함수에 적용할 때 최대 효과를 낸다. 다음 글에서는 지금까지 배운 함수형 도구들을 조합해 **함수형 데이터 파이프라인**을 구축하는 방법을 살펴본다.

---

**지난 글:** [꼬리 재귀와 재귀 깊이 제한: sys.setrecursionlimit 완전 이해](/posts/python-tail-recursion-limit/)

**다음 글:** [함수형 데이터 파이프라인: 실전 설계 패턴](/posts/python-functional-data-pipelines/)

<br>
읽어주셔서 감사합니다. 😊
