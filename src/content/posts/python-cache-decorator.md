---
title: "캐시 데코레이터: lru_cache와 cache"
description: "functools.lru_cache, cache, cached_property의 동작 원리, LRU 알고리즘, 메모이제이션 패턴, 메서드에서의 메모리 누수 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "lru_cache", "cache", "메모이제이션", "functools", "성능"]
featured: false
draft: false
---

[지난 글](/posts/python-property-as-decorator/)에서 `@property`와 `cached_property`를 살펴봤다. 이번 글에서는 함수 결과를 캐싱하는 `functools.lru_cache`와 `cache`를 깊이 다룬다. 재귀 함수 최적화부터 API 응답 캐싱까지 실무에서 자주 쓰이는 패턴이다.

## 메모이제이션이란

**메모이제이션(memoization)**은 함수를 처음 호출한 결과를 저장해 두고, 같은 인자로 다시 호출되면 저장된 결과를 반환하는 최적화 기법이다. 순수 함수(같은 입력 → 항상 같은 출력)에만 올바르게 적용된다.

```python
# 캐시 없이 피보나치: O(2^n) 호출 폭발
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

# fib(40) → 약 2억 번 호출
```

`fib(40)` 하나 계산에 약 2억 번의 재귀 호출이 발생한다. `fib(38)`이 반복 계산되기 때문이다.

## functools.cache (Python 3.9+)

```python
from functools import cache

@cache
def fib(n: int) -> int:
    if n < 2: return n
    return fib(n-1) + fib(n-2)

print(fib(100))   # 즉시 계산, 100번만 호출
```

`@cache`는 `lru_cache(maxsize=None)`의 단순 별칭이다. 크기 제한이 없으므로 모든 결과가 영구 저장된다. 크기 추적 오버헤드가 없어 `lru_cache`보다 약간 빠르다.

## functools.lru_cache (Python 3.2+)

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def fetch_user(user_id: int) -> dict:
    return db.query("SELECT ...", user_id)

info = fetch_user.cache_info()
# CacheInfo(hits=42, misses=8, maxsize=128, currsize=8)

fetch_user.cache_clear()   # 캐시 전체 비우기
```

`maxsize=128`이면 최근 128개의 (인자, 결과) 쌍을 저장한다. 128개를 초과하면 **LRU(Least Recently Used)** 알고리즘으로 가장 오래 전에 쓰인 항목을 제거한다.

`cache_info()`는 캐시 통계를 반환한다. `hits`(캐시 적중), `misses`(캐시 미적중), `maxsize`, `currsize`를 확인할 수 있다.

![캐시 데코레이터 비교표](/assets/posts/python-cache-decorator-comparison.svg)

## LRU 동작 원리

LRU 캐시는 내부적으로 **딕셔너리 + 이중 연결 리스트**로 구현된다. 캐시에 접근할 때마다 해당 항목이 리스트의 앞으로 이동한다. 리스트의 끝이 "가장 오래 안 쓰인" 항목이다.

```
# maxsize=3 캐시 예시
# 초기: []
fib(1) → [1]
fib(2) → [2, 1]
fib(3) → [3, 2, 1]
fib(4) → [4, 3, 2]  ← 1 제거 (LRU)
fib(2) → [2, 4, 3]  ← 2 MRU(앞)으로 이동
fib(1) → [1, 2, 4]  ← 3 제거 (LRU), 1 재계산
```

## 인자는 hashable이어야 한다

`lru_cache`/`cache`는 인자를 딕셔너리 키로 쓰므로 **모든 인자가 hashable**이어야 한다.

```python
@cache
def process_list(data: list) -> int:   # TypeError!
    return sum(data)

# 리스트는 unhashable → 에러
process_list([1, 2, 3])

# 해결: tuple로 변환
@cache
def process_list(data: tuple) -> int:
    return sum(data)

process_list(tuple([1, 2, 3]))   # OK
```

딕셔너리를 캐시하고 싶다면 `frozenset(d.items())`나 별도의 직렬화가 필요하다.

![lru_cache 코드 패턴](/assets/posts/python-cache-decorator-code.svg)

## 메서드에 cache 적용 시 메모리 누수

`lru_cache`를 인스턴스 메서드에 직접 쓰면 `self`가 캐시 키에 포함되어 메모리 누수가 생긴다.

```python
class MyClass:
    @lru_cache(maxsize=None)   # 위험!
    def compute(self, x):
        return x * 2

obj = MyClass()
obj.compute(1)
# 캐시가 obj를 참조 → obj가 gc되지 않음
del obj   # 실제로 메모리 해제 안 됨
```

인스턴스 메서드에는 `cached_property` 또는 인스턴스별 캐시를 직접 구현한다.

```python
from functools import cached_property

class MyClass:
    @cached_property
    def expensive_value(self):
        return compute_something()
    # 인스턴스 __dict__에 저장 → gc와 함께 해제됨
```

## 캐시 무효화

`lru_cache`는 TTL(Time-to-Live) 지원이 없다. 시간 기반 무효화가 필요하면 직접 구현해야 한다.

```python
import time
from functools import wraps

def ttl_cache(seconds=60, maxsize=128):
    def decorator(func):
        cache = {}
        @wraps(func)
        def wrapper(*args):
            now = time.monotonic()
            if args in cache:
                result, ts = cache[args]
                if now - ts < seconds:
                    return result
            result = func(*args)
            cache[args] = (result, now)
            if len(cache) > maxsize:
                oldest = min(cache, key=lambda k: cache[k][1])
                del cache[oldest]
            return result
        wrapper.cache_clear = cache.clear
        return wrapper
    return decorator

@ttl_cache(seconds=300)
def get_config(key):
    return load_from_db(key)
```

---

**지난 글:** [property 데코레이터 완전 이해](/posts/python-property-as-decorator/)

**다음 글:** [deprecated 경고 데코레이터](/posts/python-deprecated-warnings-decorator/)

<br>
읽어주셔서 감사합니다. 😊
