---
title: "파이썬 고차 함수 완전 정복 — map, filter, sorted와 직접 만들기"
description: "파이썬의 고차 함수 개념과 map·filter·sorted 내장 함수, 그리고 함수 합성·메모이제이션·파이프라인 같은 직접 만드는 패턴을 예제 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "고차함수", "map", "filter", "함수형프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/python-first-class-functions/)에서 파이썬 함수가 일급 객체임을 확인했습니다. 이번에는 그 토대 위에서 **고차 함수(higher-order function)** 를 집중적으로 다룹니다. 함수를 인자로 받거나 반환하는 함수가 어떻게 코드를 유연하고 간결하게 만드는지 실전 예제로 살펴봅니다.

## 고차 함수란

다음 두 조건 중 하나 이상을 만족하면 고차 함수입니다.

- 다른 함수를 **인자**로 받는다
- 다른 함수를 **반환**한다

수학의 미적분 연산자가 함수를 받아 함수를 반환하는 것과 같은 발상입니다. 파이썬은 언어 차원에서 이를 지원하며, 내장 함수 여러 개가 고차 함수입니다.

## map — 모든 원소에 함수 적용

```python
# 기본 사용
nums = [1, 2, 3, 4, 5]
squares = list(map(lambda x: x**2, nums))
# [1, 4, 9, 16, 25]

# 기존 함수 이름만 넘기기 — lambda 불필요
words = ["hello", "world"]
upper_words = list(map(str.upper, words))
# ['HELLO', 'WORLD']

# 두 이터러블을 동시에 처리
a = [1, 2, 3]
b = [10, 20, 30]
sums = list(map(lambda x, y: x + y, a, b))
# [11, 22, 33]
```

`map` 은 **이터레이터**를 반환합니다. 즉시 평가하려면 `list()` 나 `tuple()` 로 감싸야 합니다. 지연 평가(lazy evaluation) 덕분에 거대한 시퀀스에서 메모리 효율이 좋습니다.

![고차 함수 내장 함수](/assets/posts/python-higher-order-functions-builtins.svg)

## filter — 조건을 만족하는 원소만 추출

```python
nums = range(-5, 6)

positives = list(filter(lambda x: x > 0, nums))
# [1, 2, 3, 4, 5]

# None을 함수로 전달하면 falsy 값 제거
mixed = [0, 1, "", "hello", None, [], [1, 2]]
truthy = list(filter(None, mixed))
# [1, 'hello', [1, 2]]
```

`filter(None, iterable)` 패턴은 falsy 값을 빠르게 제거할 때 유용합니다.

## sorted와 key 함수

`sorted` 는 `key` 인자로 함수를 받아 정렬 기준을 유연하게 바꿉니다.

```python
people = [
    {"name": "Charlie", "age": 30},
    {"name": "Alice", "age": 25},
    {"name": "Bob", "age": 35},
]

# 나이 기준 정렬
by_age = sorted(people, key=lambda p: p["age"])
# Alice(25), Charlie(30), Bob(35)

# 이름 알파벳 역순
by_name_desc = sorted(people, key=lambda p: p["name"], reverse=True)

# 다중 기준 — 나이 오름차순, 이름 알파벳순
data = [("Bob", 30), ("Alice", 30), ("Charlie", 25)]
sorted(data, key=lambda x: (x[1], x[0]))
# [('Charlie', 25), ('Alice', 30), ('Bob', 30)]
```

`operator.itemgetter` 와 `operator.attrgetter` 를 쓰면 람다 없이 더 빠릅니다.

```python
from operator import itemgetter, attrgetter

sorted(people, key=itemgetter("age"))   # dict 필드
sorted(objects, key=attrgetter("name")) # 객체 속성
```

## map/filter vs 컴프리헨션

```python
# 아래 두 줄은 동등
list(map(lambda x: x**2, range(10)))
[x**2 for x in range(10)]

# filter도 마찬가지
list(filter(lambda x: x > 0, nums))
[x for x in nums if x > 0]
```

가이드라인: `lambda` 가 필요 없는 경우(기존 함수 이름만 전달)엔 `map` 이 더 간결하고, 그 외엔 리스트 컴프리헨션이 가독성이 낫습니다.

## 직접 만드는 고차 함수

### 함수 합성 (compose)

수학의 `(f∘g)(x) = f(g(x))` 를 코드로 표현합니다.

```python
def compose(*funcs):
    """오른쪽에서 왼쪽으로 함수를 합성한다."""
    from functools import reduce
    return reduce(lambda f, g: lambda x: f(g(x)), funcs)

strip = str.strip
upper = str.upper
exclaim = lambda s: s + "!"

process = compose(exclaim, upper, strip)
process("  hello  ")  # "HELLO!"
```

![직접 만드는 고차 함수](/assets/posts/python-higher-order-functions-custom.svg)

### 파이프라인 (pipeline)

합성의 반대 방향 — 왼쪽에서 오른쪽으로 실행합니다. 데이터 변환 흐름을 직관적으로 읽을 수 있습니다.

```python
from functools import reduce

def pipeline(*funcs):
    return lambda val: reduce(lambda v, f: f(v), funcs, val)

clean = pipeline(
    str.strip,
    str.lower,
    lambda s: s.replace(" ", "_"),
)

clean("  Hello World  ")  # "hello_world"
```

### 부분 적용 (partial application)

특정 인자를 미리 고정해 새로운 함수를 만듭니다.

```python
from functools import partial

def power(base, exp):
    return base ** exp

square = partial(power, exp=2)
cube   = partial(power, exp=3)

square(5)  # 25
cube(3)    # 27
```

### 고차 함수로 만드는 재시도 로직

```python
import time
from typing import Callable, TypeVar

T = TypeVar("T")

def with_retry(func: Callable[..., T], max_attempts: int = 3, delay: float = 1.0):
    def wrapper(*args, **kwargs) -> T:
        for attempt in range(max_attempts):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if attempt == max_attempts - 1:
                    raise
                time.sleep(delay * (attempt + 1))
    return wrapper

# 사용
fetch_with_retry = with_retry(fetch_data, max_attempts=3)
result = fetch_with_retry("https://api.example.com/data")
```

## reduce — 누적 연산

`functools.reduce` 는 시퀀스를 단일 값으로 누적합니다.

```python
from functools import reduce

nums = [1, 2, 3, 4, 5]

total = reduce(lambda acc, x: acc + x, nums, 0)   # 15
product = reduce(lambda acc, x: acc * x, nums, 1) # 120

# 중첩 딕셔너리 접근
nested = {"a": {"b": {"c": 42}}}
keys = ["a", "b", "c"]
reduce(lambda d, k: d[k], keys, nested)  # 42
```

## any / all — 조건을 함수로 받는 내장 함수

```python
nums = [2, 4, 6, 8, 9]

any(x % 2 != 0 for x in nums)  # True  — 홀수 하나 이상
all(x > 0 for x in nums)        # True  — 모두 양수
```

`any`/`all` 은 제너레이터 표현식과 함께 사용하면 단락 평가(short-circuit)가 적용됩니다.

## 핵심 정리

- `map`, `filter`, `sorted` 는 함수를 인자로 받는 고차 함수
- `map`/`filter` 는 이터레이터 반환 — 즉시 평가 필요 시 `list()` 감싸기
- 컴프리헨션이 대개 더 읽기 쉽지만, 기존 함수 참조 시엔 `map` 이 간결
- 함수 합성·파이프라인·`partial` 로 재사용 가능한 연산 단위 설계
- `reduce` 로 누적 연산을 선언적으로 표현

---

**지난 글:** [파이썬의 일급 함수 — 함수를 값처럼 다루기](/posts/python-first-class-functions/)

**다음 글:** [파이썬 함수 어노테이션 완전 가이드](/posts/python-function-annotations/)

<br>
읽어주셔서 감사합니다. 😊
