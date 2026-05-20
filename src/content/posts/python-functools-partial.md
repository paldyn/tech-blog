---
title: "functools.partial: 인자를 고정한 함수 만들기"
description: "Python functools.partial의 동작 원리와 활용 패턴을 설명합니다. 위치·키워드 인자 고정, partial 객체 내부 구조(func/args/keywords), lambda와의 차이, 콜백 등록, map/filter 조합, partialmethod까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "functools", "partial", "커링", "부분적용", "고차함수", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-functools-lru-cache/)에서 `lru_cache`로 함수 결과를 캐싱하는 방법을 살펴봤습니다. 이번 글에서는 `functools.partial`을 다룹니다. 함수 인자 일부를 미리 고정해 새로운 함수를 만드는 이 기능은, 반복되는 인자를 제거하고 코드를 더 읽기 좋게 만드는 데 유용합니다.

## partial이란?

`partial(func, *args, **kwargs)`는 `func`에 인자를 미리 바인딩한 새로운 callable 객체를 반환합니다. 이 객체를 호출할 때는 남은 인자만 전달하면 됩니다.

```python
from functools import partial

def power(base, exponent):
    return base ** exponent

square = partial(power, exponent=2)
cube   = partial(power, exponent=3)

square(5)   # 25
cube(5)     # 125
```

![partial 개념](/assets/posts/python-functools-partial-concept.svg)

## 위치 인자 vs 키워드 인자 고정

```python
from functools import partial

def multiply(a, b):
    return a * b

# 위치 인자 고정 (앞에서부터 순서대로)
double = partial(multiply, 2)
double(5)   # 10  (2 * 5)
double(7)   # 14  (2 * 7)

# 키워드 인자 고정
def greet(name, greeting="안녕"):
    return f"{greeting}, {name}!"

hello = partial(greet, greeting="Hello")
hello("Alice")   # "Hello, Alice!"
hello("Bob")     # "Hello, Bob!"
```

## partial 객체 내부 구조

`partial`은 원래 함수와 고정된 인자를 그대로 보관합니다.

```python
from functools import partial

add = lambda a, b: a + b
add5 = partial(add, 5)

print(add5.func)      # <function <lambda> at 0x...>
print(add5.args)      # (5,)
print(add5.keywords)  # {}

req = partial(requests.get, timeout=10, verify=True)
print(req.keywords)   # {'timeout': 10, 'verify': True}
```

## partial vs lambda

두 방법은 비슷해 보이지만 중요한 차이가 있습니다.

```python
import pickle
from functools import partial

# partial은 pickle 가능
double_p = partial(lambda a, b: a * b, 2)
# pickle 직렬화 가능 → multiprocessing, joblib 등에서 사용 가능

# lambda는 pickle 불가
double_l = lambda x: x * 2
# pickle.dumps(double_l) → AttributeError
```

**콜백 등록, 멀티프로세싱 작업 전달** 등에서는 `partial`이 `lambda`보다 안전합니다.

![partial 코드 패턴](/assets/posts/python-functools-partial-code.svg)

## 실전 활용 패턴

### 콜백에 추가 인자 전달

```python
from functools import partial

def handle_click(button_id, event):
    print(f"버튼 {button_id} 클릭: {event}")

# GUI 라이브러리 예시 — on_click은 event 하나만 인자로 받음
button1.on_click(partial(handle_click, "submit"))
button2.on_click(partial(handle_click, "cancel"))
```

람다로도 쓸 수 있지만 `partial`이 의도를 더 명확하게 드러냅니다.

### map/filter 조합

```python
from functools import partial
import operator

add10 = partial(operator.add, 10)
list(map(add10, [1, 2, 3, 4]))   # [11, 12, 13, 14]

# 비교 함수로 필터링
is_positive = partial(operator.lt, 0)   # 0 < x 인지 확인
list(filter(is_positive, [-1, 2, -3, 4]))  # [2, 4]
```

### sorted key 재사용

```python
from functools import partial
import operator

# name 기준 정렬 함수 재사용
by_name = partial(sorted, key=operator.itemgetter('name'))
by_age  = partial(sorted, key=operator.itemgetter('age'), reverse=True)

users = [{'name': '김', 'age': 30}, {'name': '이', 'age': 25}]
by_name(users)   # name 오름차순
by_age(users)    # age 내림차순
```

### HTTP 클라이언트 공통 설정

```python
import requests
from functools import partial

# 공통 헤더/타임아웃을 미리 고정
api_get = partial(
    requests.get,
    headers={"Authorization": "Bearer TOKEN"},
    timeout=30,
)

# 이후 URL만 전달
resp1 = api_get("https://api.example.com/users")
resp2 = api_get("https://api.example.com/posts")
```

## partialmethod

클래스 메서드에 적용할 때는 `partialmethod`를 사용합니다.

```python
from functools import partialmethod

class DataProcessor:
    def process(self, data, *, mode, strict=False):
        ...

    # 메서드를 부분 적용해 새 메서드로 등록
    process_strict = partialmethod(process, mode='strict', strict=True)
    process_fast   = partialmethod(process, mode='fast')

proc = DataProcessor()
proc.process_strict([1, 2, 3])   # mode='strict', strict=True 자동 적용
```

일반 `partial`로 클래스 속성에 넣으면 descriptor protocol이 무시되어 `self`가 제대로 바인딩되지 않습니다. 메서드에는 반드시 `partialmethod`를 써야 합니다.

## 인자 순서 뒤집기 패턴

`partial`은 앞에서부터 인자를 고정하므로, 뒤쪽 위치 인자를 먼저 고정하려면 래퍼가 필요합니다.

```python
from functools import partial

def divide(a, b):
    return a / b

# b를 고정하고 싶다면: partial은 앞부터 채우므로 키워드 인자로 우회하거나
# 인자 순서를 바꾼 래퍼를 만들어 사용
def rdivide(b, a):   # 인자 순서 교환
    return a / b

halve = partial(rdivide, 2)   # b=2 고정 → a/2 계산
halve(10)   # 5.0
halve(30)   # 15.0
```

---

**지난 글:** [functools.lru_cache: 메모이제이션 캐싱](/posts/python-functools-lru-cache/)

**다음 글:** [operator 모듈: 연산을 함수로 다루기](/posts/python-operator-module/)

<br>
읽어주셔서 감사합니다. 😊
