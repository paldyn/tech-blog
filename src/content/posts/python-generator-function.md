---
title: "제너레이터 함수: yield로 만드는 지연 이터레이터"
description: "yield 키워드로 제너레이터 함수를 만드는 방법, 실행 흐름의 일시 정지와 재개, 지연 평가의 장점을 실용 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "제너레이터", "yield", "지연평가", "이터레이터", "메모리효율"]
featured: false
draft: false
---

[지난 글](/posts/python-iter-next/)에서 `iter()`와 `next()` 내장 함수를 살펴봤다. 이터레이터를 직접 구현하려면 클래스에 `__iter__`와 `__next__`를 모두 작성해야 했다. 제너레이터 함수는 이 과정을 대폭 단순화하면서 동시에 강력한 지연 평가 기능을 제공한다.

## 제너레이터 함수란

함수 본문에 `yield` 키워드가 하나라도 있으면 그 함수는 **제너레이터 함수**가 된다. 일반 함수와 달리 호출해도 즉시 실행되지 않는다. 대신 **제너레이터 객체**를 반환한다. 이 객체는 이터레이터 프로토콜을 완전히 구현하고 있다.

```python
def simple_gen():
    print("A 실행")
    yield 1
    print("B 실행")
    yield 2
    print("C 실행")

gen = simple_gen()   # 아직 print 호출 안 됨
print(type(gen))     # <class 'generator'>

print(next(gen))     # "A 실행" 출력 후 1 반환
print(next(gen))     # "B 실행" 출력 후 2 반환
# next(gen)          # "C 실행" 출력 후 StopIteration 발생
```

`yield`는 값을 반환하고 **그 자리에서 실행을 멈춘다**. `next()`가 다시 호출되면 멈춘 곳에서 재개한다. 이 동작이 일반 함수의 `return`과 결정적으로 다른 점이다.

## 실행 흐름의 일시 정지와 재개

제너레이터는 다섯 가지 상태를 갖는다.

![제너레이터 함수 실행 흐름](/assets/posts/python-generator-function-lifecycle.svg)

1. **생성됨**: 제너레이터 함수를 호출한 직후. 코드는 한 줄도 실행되지 않았다.
2. **실행 중**: `next()`에 의해 재개돼 다음 `yield`를 향해 달려가는 중.
3. **일시 정지**: `yield`를 만났을 때. 현재 프레임(지역 변수, 실행 위치)이 저장된다.
4. **종료**: 함수 끝에 도달하거나 `return`을 만남. `StopIteration` 발생.
5. **닫힘**: `close()`를 명시적으로 호출하거나 GC가 수거했을 때.

```python
import inspect

def gen_func():
    yield 1
    yield 2

g = gen_func()
print(inspect.getgeneratorstate(g))  # GEN_CREATED

next(g)
print(inspect.getgeneratorstate(g))  # GEN_SUSPENDED

list(g)  # 소진
print(inspect.getgeneratorstate(g))  # GEN_CLOSED
```

## yield와 return의 차이

`return`은 함수를 종료하고 값을 단 한 번 반환한다. `yield`는 값을 반환하고 실행을 일시 정지한다. 제너레이터 함수에서 `return`은 `StopIteration`을 발생시키며, 반환 값은 `StopIteration` 예외 객체의 `value` 속성에 저장된다.

```python
def gen_with_return():
    yield 1
    yield 2
    return "완료"   # StopIteration("완료") 발생

g = gen_with_return()
print(next(g))    # 1
print(next(g))    # 2
try:
    next(g)
except StopIteration as e:
    print(e.value) # "완료"
```

`return`의 값은 일반 for 루프에서는 볼 수 없다. `yield from`과 함께 서브제너레이터 패턴에서 활용된다 (다음 글 참조).

## 지연 평가와 메모리 효율

제너레이터의 가장 큰 장점은 **지연 평가(lazy evaluation)**다. 값을 미리 모두 계산하지 않고 요청할 때마다 하나씩 생성한다.

![지연 평가의 이점](/assets/posts/python-generator-function-lazy.svg)

```python
# 1억 개 숫자의 제곱합 — 리스트 사용 시 수 GB 메모리 필요
total = sum(x * x for x in range(100_000_000))
# 제너레이터 식을 활용 → 상수 메모리로 처리
```

이 코드는 1억 개의 숫자를 한꺼번에 메모리에 올리지 않는다. `sum()`이 요청할 때마다 하나씩 제너레이터에서 꺼내 더한다.

## 무한 시퀀스 표현

제너레이터는 논리적으로 끝이 없는 시퀀스를 표현할 수 있다. 리스트로는 불가능하다.

```python
def fibonacci():
    a, b = 0, 1
    while True:         # 무한 루프
        yield a
        a, b = b, a + b

fib = fibonacci()
for _ in range(10):
    print(next(fib), end=" ")   # 0 1 1 2 3 5 8 13 21 34
```

`while True` 루프를 쓰지만 메모리를 무한정 사용하지 않는다. 제너레이터를 소비하는 쪽이 멈추면 생성도 멈춘다.

## 파이프라인 구성

제너레이터를 연결하면 데이터 파이프라인을 구성할 수 있다.

```python
def read_lines(path):
    with open(path) as f:
        for line in f:
            yield line.rstrip()

def filter_empty(lines):
    for line in lines:
        if line:
            yield line

def to_upper(lines):
    for line in lines:
        yield line.upper()

# 파이프라인 구성 — 실제 파일 읽기는 for 루프가 실행될 때 발생
pipeline = to_upper(filter_empty(read_lines("data.txt")))
for line in pipeline:
    print(line)
```

각 단계는 독립적인 제너레이터다. 데이터는 파이프라인을 따라 **한 줄씩** 처리된다. 파일 전체를 메모리에 올릴 필요가 없다.

## 제너레이터 표현식

리스트 컴프리헨션과 같은 문법이지만 `[]` 대신 `()`를 쓰면 제너레이터 표현식이 된다.

```python
# 리스트 컴프리헨션 — 즉시 계산, 메모리 O(n)
squares_list = [x**2 for x in range(1000)]

# 제너레이터 표현식 — 지연 계산, 메모리 O(1)
squares_gen = (x**2 for x in range(1000))

print(type(squares_list))  # list
print(type(squares_gen))   # generator

# 바로 sum/max/min 등에 전달할 때 괄호 생략 가능
total = sum(x**2 for x in range(1000))
```

제너레이터 표현식은 제너레이터 함수의 축약 형태다. 간단한 변환 파이프라인에는 표현식이 더 간결하고, 복잡한 로직에는 함수 형태가 적합하다.

## 주의: 제너레이터는 한 번만 순회

제너레이터 객체는 소진되면 재사용할 수 없다.

```python
gen = (x for x in range(3))
print(list(gen))  # [0, 1, 2]
print(list(gen))  # []  -- 이미 소진됨
```

여러 번 순회해야 한다면 제너레이터 함수를 다시 호출하거나, 결과를 리스트에 저장한다.

## 정리

| 특성 | 일반 함수 | 제너레이터 함수 |
|------|-----------|----------------|
| 반환 | 값 | 제너레이터 객체 |
| 실행 | 즉시 전체 | next() 호출마다 yield까지 |
| 메모리 | O(n) | O(1) |
| 무한 시퀀스 | 불가 | 가능 |
| 재사용 | 매번 새로 호출 | 소진 후 재사용 불가 |

제너레이터 함수는 Python의 강력한 도구 중 하나다. 다음 글에서는 제너레이터 간 위임을 가능하게 하는 `yield from`을 살펴본다.

---

**지난 글:** [iter()와 next() 내장 함수 심층 탐구](/posts/python-iter-next/)

**다음 글:** [yield from: 서브제너레이터 위임과 투명한 전달](/posts/python-yield-from/)

<br>
읽어주셔서 감사합니다. 😊
