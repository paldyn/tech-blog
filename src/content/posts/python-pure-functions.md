---
title: "순수 함수(Pure Functions): 부작용 없는 함수 설계"
description: "순수 함수의 정의, 불순 함수와의 차이, 리팩터링 방법, 테스트 용이성, 메모이제이션, 병렬 처리 안전성을 코드 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "순수함수", "함수형프로그래밍", "부작용", "PureFunctions", "SideEffect"]
featured: false
draft: false
---

[지난 글](/posts/python-immutability/)에서 불변성이 왜 중요한지 살펴봤다. 불변성과 함께 함수형 프로그래밍의 핵심 축을 이루는 것이 **순수 함수(Pure Functions)**다. 순수 함수로 코드를 구성하면 테스트가 쉬워지고, 버그가 줄어들고, 코드의 동작을 머릿속에서 추론하기 훨씬 편해진다.

## 순수 함수란?

순수 함수는 두 가지 조건을 만족한다.

**1. 참조 투명성(Referential Transparency)**: 동일한 입력에 대해 항상 동일한 출력을 반환한다. `add(2, 3)`은 언제 호출해도 `5`를 반환한다.

**2. 부작용 없음(No Side Effects)**: 함수 외부의 상태를 읽거나 변경하지 않는다. 전역 변수 수정, 파일 쓰기, DB 접근, 출력(print), 인자 변경이 모두 부작용이다.

![순수 함수 vs 불순 함수](/assets/posts/python-pure-functions-concept.svg)

```python
# 순수 함수 예시
def square(n: int) -> int:
    return n * n   # 항상 같은 결과, 외부 변경 없음

def double_all(numbers: list[int]) -> list[int]:
    return [n * 2 for n in numbers]   # 원본 변경 없음

# 불순 함수 예시
import random
def get_discount() -> float:
    return random.random() * 0.5   # 실행마다 다른 결과 → 불순

import datetime
def today_greeting() -> str:
    return f"오늘은 {datetime.date.today()}"   # 외부 상태(날짜) 의존 → 불순
```

## 부작용의 종류

불순 함수를 만드는 부작용의 대표적인 형태를 알아두면 코드 리뷰 때 바로 알아차릴 수 있다.

```python
# 전역 변수 수정
counter = 0
def increment():
    global counter
    counter += 1  # 외부 상태 변경

# 인자 직접 변경 (가장 흔한 실수)
def normalize_impure(data: list) -> None:
    for i in range(len(data)):
        data[i] = data[i] / max(data)   # 입력 훼손!

# 순수 버전
def normalize(data: list[float]) -> list[float]:
    maximum = max(data)
    return [x / maximum for x in data]   # 새 리스트 반환
```

인자를 직접 변경하는 함수는 호출자가 모르는 사이에 데이터를 망가뜨릴 수 있다. `None`을 반환하는 함수는 대부분 불순하다는 신호다.

## 순수 함수의 세 가지 실용적 이점

![순수 함수 설계 전략](/assets/posts/python-pure-functions-design.svg)

**이점 1: 단위 테스트가 간단해진다**

순수 함수는 입력만 주면 출력을 바로 검증할 수 있다. mock 객체, 데이터베이스 연결, 파일 시스템 준비가 필요 없다.

```python
# 테스트가 이렇게 간단해진다
def test_normalize():
    result = normalize([2.0, 4.0, 8.0])
    assert result == [0.25, 0.5, 1.0]
```

**이점 2: 메모이제이션 자동 적용**

동일 입력에 항상 동일 출력을 보장하므로 결과를 캐시할 수 있다. `functools.lru_cache`가 바로 이 원리를 이용한다.

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)   # 순수하므로 캐시 가능
```

불순 함수에 `lru_cache`를 적용하면 캐시된 "오래된" 결과가 반환될 수 있어 위험하다.

**이점 3: 병렬 처리 안전**

여러 스레드나 프로세스가 동시에 순수 함수를 호출해도 공유 상태가 없으므로 경쟁 조건이 발생하지 않는다. `concurrent.futures`와 함께 쓸 때 특히 유용하다.

```python
from concurrent.futures import ProcessPoolExecutor

def heavy_computation(data: list[float]) -> float:
    return sum(x ** 2 for x in data)   # 순수 함수

with ProcessPoolExecutor() as pool:
    results = list(pool.map(heavy_computation, chunks))
```

## 순수 함수를 향한 리팩터링

모든 코드를 순수하게 만들 수는 없다. DB 접근, 파일 IO, 사용자 입력은 본질적으로 불순하다. 현실적인 전략은 **불순한 부분을 경계로 밀어내고, 핵심 로직은 순수 함수로 분리**하는 것이다.

```python
# 나쁜 패턴: 로직과 IO가 섞임
def process_and_save(filename: str) -> None:
    with open(filename) as f:
        data = [float(line) for line in f]
    result = sum(x * 2 for x in data if x > 0)
    with open("result.txt", "w") as f:
        f.write(str(result))

# 좋은 패턴: 순수 로직 분리
def compute(data: list[float]) -> float:   # 순수
    return sum(x * 2 for x in data if x > 0)

def run(filename: str) -> None:   # 불순, but 최소화
    with open(filename) as f:
        data = [float(line) for line in f]
    result = compute(data)
    with open("result.txt", "w") as f:
        f.write(str(result))
```

`compute` 함수는 파일 이름도, IO도 모른다. 테스트할 때는 `compute([1.0, -2.0, 3.0])`처럼 직접 호출하면 된다.

## 언제 순수 함수를 강요하지 않아야 하는가

순수성에 집착하다 보면 코드가 오히려 복잡해지는 경우가 있다. IO, 로깅, 캐시 갱신 같은 필수 부작용은 자연스럽게 두어야 한다. 목표는 순수 함수를 최대화하되, 불순한 코드를 경계에 격리하는 것이다.

다음 글에서는 함수형 프로그래밍의 주요 도구 중 하나인 `functools.reduce`를 다룬다.

---

**지난 글:** [불변성(Immutability): Python에서 변하지 않는 것들](/posts/python-immutability/)

**다음 글:** [functools.reduce: 시퀀스를 단일 값으로 접기](/posts/python-functools-reduce/)

<br>
읽어주셔서 감사합니다. 😊
