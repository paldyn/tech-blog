---
title: "커링과 부분 적용: functools.partial 완전 정복"
description: "커링과 부분 적용의 차이, functools.partial 사용법, sorted/map/threading/URL 빌더 등 실전 패턴, 그리고 Python에서 직접 커링을 구현하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "커링", "Currying", "partial", "functools", "함수형프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/python-functools-reduce/)에서 `reduce`로 시퀀스를 단일 값으로 접는 방법을 살펴봤다. 이번 글은 함수의 인자를 미리 고정하는 두 가지 기법, **커링(Currying)**과 **부분 적용(Partial Application)**을 다룬다. 이 둘을 구분하고, Python에서 `functools.partial`을 활용하는 실전 패턴을 익혀보자.

## 커링과 부분 적용의 차이

두 개념은 종종 혼동되지만 엄밀히 다르다.

**커링**: 여러 인자를 받는 함수를 단항 함수의 체인으로 변환한다. `f(a, b, c)`를 `f(a)(b)(c)` 형태로 만드는 것이다.

**부분 적용**: 함수의 일부 인자를 미리 고정해 새 함수를 만든다. 남은 인자가 하나일 필요는 없다.

![커링 vs 부분 적용](/assets/posts/python-currying-partial-concept.svg)

```python
# 커링 직접 구현
def add(a):
    return lambda b: a + b

add5 = add(5)
print(add5(3))   # 8

# 자동 커링 구현
def curry(f):
    import inspect
    n = len(inspect.signature(f).parameters)
    def curried(*args):
        if len(args) >= n:
            return f(*args)
        return lambda *more: curried(*(args + more))
    return curried

@curry
def volume(l, w, h):
    return l * w * h

vol_l2 = volume(2)          # l=2 고정
vol_l2w3 = vol_l2(3)        # l=2, w=3 고정
print(vol_l2w3(4))           # 24
```

## functools.partial

Python에서 부분 적용은 `functools.partial`로 구현한다. `partial(func, *args, **kwargs)`는 `func`의 일부 인자가 고정된 새 callable을 반환한다.

```python
from functools import partial

def power(base, exp):
    return base ** exp

square = partial(power, exp=2)
cube   = partial(power, exp=3)

print(square(4))   # 16
print(cube(3))     # 27

# partial 객체 내부 확인
print(square.func)      # <function power>
print(square.args)      # ()
print(square.keywords)  # {"exp": 2}
```

`partial` 객체는 `func`, `args`, `keywords` 속성으로 원본 함수와 고정된 인자를 확인할 수 있다.

## 실전 활용 패턴

![partial 활용 패턴](/assets/posts/python-currying-partial-patterns.svg)

**패턴 1: map과 조합**

`map`에 단항 함수가 필요할 때 `partial`로 이항 함수의 한 인자를 고정한다.

```python
from functools import partial

def multiply(a, b):
    return a * b

triple = partial(multiply, b=3)
result = list(map(triple, [1, 2, 3, 4]))
print(result)   # [3, 6, 9, 12]
```

**패턴 2: 콜백에 추가 인자 전달**

`threading.Thread`, `asyncio`, GUI 이벤트 핸들러 등 콜백 시그니처가 고정된 곳에서 추가 인자를 전달할 때 유용하다.

```python
import threading
from functools import partial

def download(url: str, timeout: int) -> None:
    print(f"downloading {url} with timeout={timeout}")

urls = ["http://a.com", "http://b.com"]
threads = [
    threading.Thread(target=partial(download, url, timeout=30))
    for url in urls
]
```

**패턴 3: 설정 고정 함수 생성**

DB 연결, API 베이스 URL 등을 미리 고정해 더 간결한 인터페이스를 만든다.

```python
from functools import partial

def query(db, table: str, where: str = "") -> list:
    sql = f"SELECT * FROM {table}"
    if where:
        sql += f" WHERE {where}"
    return db.execute(sql).fetchall()

# db 연결 고정
db_query = partial(query, db_connection)
users = db_query("users")
active = db_query("users", where="active=1")
```

## lambda vs partial

짧은 고정은 `lambda`로도 쓸 수 있지만, `partial`이 더 명시적이고 디버깅에 유리하다.

```python
from functools import partial

add5_lambda  = lambda x: x + 5
add5_partial = partial(int.__add__, 5)

# partial이 더 유리한 이유
print(add5_partial)  # functools.partial(<slot wrapper '__add__' of 'int'>, 5)
# lambda는 <lambda> 만 표시

# 직렬화 시 partial이 더 안전 (lambda는 pickle 불가)
import pickle
data = pickle.dumps(add5_partial)   # 가능
# pickle.dumps(add5_lambda)        # AttributeError
```

## Python에서 커링이 덜 자주 쓰이는 이유

Haskell 같은 순수 함수형 언어에서는 모든 함수가 기본적으로 커링된다. Python에서는 키워드 인자(`**kwargs`)와 기본값이 있어 대부분의 경우 커링 없이도 유연하게 인터페이스를 설계할 수 있다.

실제 Python 코드베이스에서는 `partial`을 커링보다 더 자주 본다. 커링은 주로 `toolz`, `cytoolz` 같은 함수형 라이브러리를 쓸 때 등장한다. 다음 글에서 바로 그 라이브러리들을 살펴본다.

---

**지난 글:** [functools.reduce: 시퀀스를 단일 값으로 접기](/posts/python-functools-reduce/)

**다음 글:** [toolz와 cytoolz: Python 함수형 프로그래밍 라이브러리](/posts/python-toolz-cytoolz/)

<br>
읽어주셔서 감사합니다. 😊
