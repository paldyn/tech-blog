---
title: "functools.lru_cache: 메모이제이션 캐싱"
description: "Python functools.lru_cache와 cache 데코레이터를 설명합니다. LRU 캐싱 원리, maxsize 설정, cache_info/cache_clear, hashable 제약, 재귀 함수 최적화, 메서드에 사용할 때의 주의사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "functools", "lru_cache", "cache", "메모이제이션", "캐싱", "성능최적화", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-itertools-basics/)에서 `itertools`로 이터레이터를 조합하는 방법을 살펴봤습니다. 이번 글에서는 `functools` 모듈의 핵심 기능인 `lru_cache`를 다룹니다. 같은 인자로 반복 호출되는 함수에 캐싱을 붙이면, 코드 한 줄로 극적인 성능 향상을 얻을 수 있습니다.

## LRU 캐시란?

**LRU(Least Recently Used)** 캐시는 가장 최근에 쓴 결과를 저장하고, 공간이 부족해지면 가장 오래 전에 쓴 항목부터 제거하는 캐시 전략입니다. `lru_cache`는 이 전략을 함수 결과에 적용합니다. 함수를 처음 호출하면 실제로 실행하고 결과를 저장(MISS), 같은 인자로 다시 호출하면 저장된 값을 즉시 반환(HIT)합니다.

![lru_cache 동작 원리](/assets/posts/python-functools-lru-cache-flow.svg)

## 기본 사용

```python
from functools import lru_cache

@lru_cache
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(35))  # 9227465
```

캐시 없이 재귀로 구현하면 `fibonacci(35)`는 약 2억 9천만 번 호출이 발생합니다. `@lru_cache`를 붙이면 각 `n`에 대해 단 한 번만 계산하므로 호출 횟수가 36번으로 줄어듭니다.

## maxsize 설정

```python
from functools import lru_cache

@lru_cache(maxsize=128)   # 기본값 (Python 3.8부터 괄호 생략 가능)
def get_data(key):
    ...

@lru_cache(maxsize=None)  # 무제한 캐시
def pure_math(x, y):
    ...

@lru_cache(maxsize=32)    # 최근 32개만 유지
def fetch_user(user_id: int):
    return db.query(user_id)
```

`maxsize=None`이면 항목을 절대 제거하지 않습니다. Python 3.9부터는 이를 `@cache`라는 더 간결한 이름으로 제공합니다.

## @cache (Python 3.9+)

```python
from functools import cache

@cache
def expensive(n):
    # 결과가 무한정 저장됨 (메모리 주의)
    return n ** 2
```

`@cache`는 `@lru_cache(maxsize=None)`과 동일하지만, LRU 순서를 추적하는 오버헤드가 없어 더 빠르고 메모리도 적게 씁니다. 입력 공간이 작은 순수 함수에 적합합니다.

## 통계 조회와 초기화

```python
fibonacci(10)
print(fibonacci.cache_info())
# CacheInfo(hits=8, misses=11, maxsize=128, currsize=11)

# 캐시 비우기
fibonacci.cache_clear()
print(fibonacci.cache_info())
# CacheInfo(hits=0, misses=0, maxsize=128, currsize=0)
```

`hits/misses` 비율로 캐시 효율을 모니터링할 수 있습니다. 히트율이 낮다면 `maxsize`를 늘리거나 캐시 적용 대상을 재검토하세요.

![lru_cache 코드 예제](/assets/posts/python-functools-lru-cache-code.svg)

## hashable 인자 제약

`lru_cache`는 인자를 딕셔너리 키로 사용하므로 **해시 가능(hashable)한 타입만** 받을 수 있습니다.

```python
@lru_cache
def process(data):
    ...

process([1, 2, 3])  # TypeError: unhashable type: 'list'
```

리스트나 딕셔너리를 넘겨야 할 때는 변환이 필요합니다.

```python
@lru_cache
def process(data: tuple):   # 튜플로 변환해 전달
    return sum(data)

process(tuple([1, 2, 3]))  # OK
```

## 메서드에 사용할 때 주의사항

클래스 메서드에 `@lru_cache`를 적용하면 `self`가 캐시 키에 포함됩니다. 인스턴스마다 별도 캐시가 생기고, 인스턴스가 살아있는 한 캐시도 GC되지 않아 **메모리 누수**가 발생할 수 있습니다.

```python
class Analyzer:
    @lru_cache(maxsize=64)
    def compute(self, x):   # self가 키에 포함
        return x * x

a = Analyzer()
a.compute(5)   # 캐시됨, 하지만 a가 제거될 때 캐시도 제거되지 않을 수 있음
```

인스턴스 메서드에는 `methodtools.lru_cache` 같은 전용 라이브러리를 쓰거나, 클래스 외부의 순수 함수에 캐시를 적용하는 방식을 권장합니다.

## typed 옵션

```python
@lru_cache(typed=True)
def typed_fn(x):
    return x

typed_fn(1)    # int 1 — 캐시
typed_fn(1.0)  # float 1.0 — 별도 캐시 항목
# typed=False(기본)면 1과 1.0이 같은 캐시 항목
```

## 실전 활용: API 결과 캐싱

```python
from functools import lru_cache
import requests

@lru_cache(maxsize=256)
def get_exchange_rate(currency: str) -> float:
    resp = requests.get(f"https://api.example.com/rate/{currency}")
    return resp.json()["rate"]

# 처음 호출: 실제 HTTP 요청
rate_usd = get_exchange_rate("USD")

# 같은 인자 재호출: 캐시에서 즉시 반환
rate_usd_again = get_exchange_rate("USD")
```

주기적으로 갱신이 필요한 데이터라면 `cache_clear()`를 스케줄링하거나, TTL 기능이 있는 `cachetools` 같은 라이브러리를 사용하세요.

## lru_cache vs 직접 구현 dict 캐시

```python
# 직접 구현
_cache = {}
def my_func(n):
    if n in _cache:
        return _cache[n]
    result = n ** 2  # 비싼 연산
    _cache[n] = result
    return result

# lru_cache 사용
from functools import lru_cache

@lru_cache(maxsize=128)
def my_func(n):
    return n ** 2  # 더 깔끔
```

`lru_cache`는 크기 제한, LRU 축출, 통계 조회, 스레드 안전성을 모두 제공합니다. 직접 구현이 필요한 특수한 경우가 아니라면 `lru_cache`를 쓰세요.

---

**지난 글:** [itertools 기초: 조합형 이터레이터 완벽 활용](/posts/python-itertools-basics/)

**다음 글:** [functools.partial: 인자를 고정한 함수 만들기](/posts/python-functools-partial/)

<br>
읽어주셔서 감사합니다. 😊
