---
title: "파이프 패턴: 데이터를 흘리는 함수형 파이프라인"
description: "함수형 파이프 패턴의 개념, toolz.pipe와 커스텀 Pipe 클래스 구현, pandas .pipe() 메서드 활용, 그리고 파이프 패턴의 적절한 사용 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "파이프패턴", "함수형프로그래밍", "pipe", "compose", "데이터변환"]
featured: false
draft: false
---

[지난 글](/posts/python-toolz-cytoolz/)에서 toolz 라이브러리의 `pipe` 함수를 맛봤다. 이번 글에서는 **파이프 패턴(Pipe Pattern)**을 더 깊이 다룬다. 파이프 패턴은 데이터를 일련의 변환 함수들을 통과시켜 최종 결과를 얻는 방식으로, Unix 셸의 `|` 파이프와 동일한 발상이다.

## 파이프 패턴이란?

중첩 함수 호출을 안쪽에서 바깥쪽으로 읽어야 하는 불편함을 해소한다. 데이터가 위에서 아래로, 왼쪽에서 오른쪽으로 흐르도록 만드는 것이 핵심이다.

![파이프 패턴 데이터 흐름](/assets/posts/python-pipe-pattern-flow.svg)

```python
# 중첩 호출 — 안쪽부터 읽어야 함
result = sum(map(lambda x: x**2, filter(lambda x: x % 2 == 0, range(10))))

# 파이프 스타일 — 왼쪽에서 오른쪽으로 자연스럽게
from toolz import pipe
from functools import partial

result = pipe(
    range(10),
    partial(filter, lambda x: x % 2 == 0),   # 1단계: 짝수 필터
    partial(map, lambda x: x ** 2),           # 2단계: 제곱
    sum,                                       # 3단계: 합계
)
print(result)   # 120
```

## toolz.pipe

`toolz.pipe(value, *fns)`는 `value`를 첫 번째 함수에 전달하고, 그 결과를 다음 함수에, 계속해서 마지막 함수까지 통과시킨다.

```python
from toolz import pipe, curry
from toolz.curried import map, filter

# toolz.curried는 커링된 버전 제공
result = pipe(
    range(1, 11),
    filter(lambda x: x % 2 == 0),   # curried filter
    map(lambda x: x ** 2),           # curried map
    list,
)
print(result)   # [4, 16, 36, 64, 100]
```

`toolz.curried` 서브모듈은 `map`, `filter` 같은 내장 함수의 커링된 버전을 제공해서, 인자 하나만 전달해도 바로 파이프에서 사용 가능하다.

## 커스텀 Pipe 클래스: `|` 연산자 오버로딩

Python의 `|` 연산자를 오버로딩하면 Unix 셸과 비슷한 파이프 문법을 만들 수 있다.

![파이프 패턴 고급 구현](/assets/posts/python-pipe-pattern-advanced.svg)

```python
class Pipe:
    def __init__(self, value):
        self.value = value

    def __or__(self, fn):
        return Pipe(fn(self.value))

    def __ror__(self, value):
        return Pipe(fn(value))

# 사용 예
result = (Pipe([3, 1, 4, 1, 5, 9, 2]) | sorted | list).value
print(result)   # [1, 1, 2, 3, 4, 5, 9]

# 람다도 연결 가능
result = (
    Pipe(range(10))
    | (lambda x: filter(lambda n: n % 2 == 0, x))
    | (lambda x: map(lambda n: n ** 2, x))
    | sum
).value
print(result)   # 120
```

## pandas .pipe() 메서드

`pandas`의 `DataFrame`도 `.pipe()` 메서드를 지원한다. 데이터 전처리 파이프라인을 함수 합성 방식으로 표현할 때 매우 유용하다.

```python
import pandas as pd

def add_tax(df: pd.DataFrame, rate: float = 0.1) -> pd.DataFrame:
    return df.assign(price_with_tax=df["price"] * (1 + rate))

def filter_expensive(df: pd.DataFrame, threshold: float) -> pd.DataFrame:
    return df[df["price"] > threshold]

def round_prices(df: pd.DataFrame) -> pd.DataFrame:
    return df.round(2)

# 파이프라인 적용
result = (
    raw_df
    .pipe(filter_expensive, threshold=100)
    .pipe(add_tax, rate=0.1)
    .pipe(round_prices)
)
```

각 변환 함수가 순수 함수(`DataFrame` → `DataFrame`)이므로 독립적으로 테스트할 수 있고, 순서 변경도 쉽다.

## 파이프 패턴의 에러 처리

파이프 패턴의 약점은 중간 단계에서 예외가 발생했을 때 디버깅이 어렵다는 점이다.

```python
# 에러 발생 시 어느 단계인지 파악하기 어려움
result = pipe(data, parse, transform, validate, save)

# 방법 1: 각 단계에 logging 추가
def logged(fn, label):
    def wrapper(x):
        result = fn(x)
        print(f"[{label}] {type(result).__name__} 반환")
        return result
    return wrapper

result = pipe(
    data,
    logged(parse, "parse"),
    logged(transform, "transform"),
)

# 방법 2: 에러를 Either 타입으로 감싸기 (고급)
```

## 언제 파이프 패턴을 쓸까?

파이프 패턴이 적합한 상황:
- 변환 단계가 3개 이상
- 각 단계가 순수 함수 (데이터 in → 데이터 out)
- pandas, numpy 등 메서드 체이닝을 지원하는 라이브러리 사용

파이프 패턴이 과한 상황:
- 단계가 1~2개라면 직접 호출이 더 명확
- 중간에 복잡한 분기나 루프가 있다면 일반 코드가 낫다

다음 글에서는 재귀와 Python의 재귀 깊이 제한에 대해 살펴본다.

---

**지난 글:** [toolz와 cytoolz: Python 함수형 프로그래밍 라이브러리](/posts/python-toolz-cytoolz/)

**다음 글:** [꼬리 재귀와 재귀 깊이 제한: sys.setrecursionlimit 완전 이해](/posts/python-tail-recursion-limit/)

<br>
읽어주셔서 감사합니다. 😊
