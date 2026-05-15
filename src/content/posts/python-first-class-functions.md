---
title: "파이썬의 일급 함수 — 함수를 값처럼 다루기"
description: "파이썬에서 함수가 일급 객체인 이유와 변수 할당·인자 전달·반환값·자료구조 저장 등 실전 활용 패턴을 깊이 있게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "일급함수", "함수형프로그래밍", "고차함수", "콜백"]
featured: false
draft: false
---

[지난 글](/posts/python-recursion-limit/)에서 재귀 호출의 한계와 스택 깊이 제한을 살펴봤습니다. 이번에는 파이썬의 함수가 왜 **일급 객체(first-class object)** 인지, 그리고 그것이 실전 코드 설계에 어떤 힘을 가져다 주는지 깊이 파고듭니다.

## 일급 객체란 무엇인가

프로그래밍 언어에서 어떤 값이 **일급 객체**로 취급된다는 말은 세 가지를 의미합니다.

1. 변수에 담을 수 있다
2. 함수의 인자로 전달할 수 있다
3. 함수의 반환값이 될 수 있다

파이썬의 정수·문자열·리스트는 당연히 이 조건을 만족합니다. 그리고 **함수도 완전히 같은 방식으로 동작합니다.** `def` 로 정의한 함수는 `function` 타입의 객체이며, 다른 값과 동등하게 다룰 수 있습니다.

```python
def greet(name: str) -> str:
    return f"안녕하세요, {name}님!"

# 함수 객체 자체를 확인
print(type(greet))   # <class 'function'>
print(greet)         # <function greet at 0x...>
print(greet.__name__)# greet
```

`greet` 뒤에 `()`를 붙이지 않으면 **호출이 아닌 참조**입니다. 함수 객체 그 자체를 가리키는 이름일 뿐입니다.

## 변수에 할당하기

```python
def square(n: int) -> int:
    return n * n

# 함수 객체를 변수에 바인딩
fn = square
print(fn(5))   # 25
print(fn is square)  # True — 같은 객체
```

`fn = square` 는 `square` 라는 이름이 가리키는 함수 객체를 `fn` 도 가리키게 할 뿐입니다. 복사가 아닌 참조입니다.

![일급 함수 개념](/assets/posts/python-first-class-functions-concept.svg)

## 함수를 인자로 전달하기

다른 함수를 인자로 받는 함수를 **고차 함수(higher-order function)** 라고 부릅니다. 파이썬 내장 함수 `sorted`, `map`, `filter` 가 대표적입니다.

```python
data = [3, -1, 4, -1, 5, -9, 2]

# key 인자에 함수를 전달
sorted(data, key=abs)
# [1, 1, 2, 3, 4, 5, 9] — 절댓값 기준 오름차순
```

직접 만든 함수도 마찬가지입니다.

```python
def apply_twice(func, value):
    return func(func(value))

apply_twice(str.upper, "hello")  # 이미 대문자라 변화 없음
apply_twice(lambda x: x * 2, 3)  # 12
```

## 함수를 반환값으로 사용하기

함수가 다른 함수를 만들어 반환하는 패턴은 **팩토리(factory)** 또는 **클로저(closure)** 의 기초가 됩니다.

```python
def make_multiplier(factor: int):
    def multiplier(value: int) -> int:
        return value * factor
    return multiplier  # 함수 객체 반환

double = make_multiplier(2)
triple = make_multiplier(3)

print(double(5))  # 10
print(triple(5))  # 15
```

반환된 `multiplier` 함수는 `factor` 변수를 기억하고 있습니다. 이것이 클로저이며, 일급 함수 없이는 불가능한 구조입니다.

## 자료구조에 담기

함수 객체를 리스트·딕셔너리에 담으면 **디스패치 테이블(dispatch table)** 을 만들 수 있습니다.

```python
# if/elif 분기 대신 dict로 연산 선택
OPERATIONS = {
    "+": lambda a, b: a + b,
    "-": lambda a, b: a - b,
    "*": lambda a, b: a * b,
    "/": lambda a, b: a / b,
}

def calculate(op: str, a: float, b: float) -> float:
    if op not in OPERATIONS:
        raise ValueError(f"알 수 없는 연산: {op}")
    return OPERATIONS[op](a, b)

print(calculate("+", 3, 4))  # 7
print(calculate("*", 3, 4))  # 12
```

새 연산자를 추가할 때 `if/elif` 블록을 수정하지 않아도 됩니다. 딕셔너리에 항목 하나만 추가하면 됩니다.

## 전략 패턴과 콜백

![일급 함수 활용 패턴](/assets/posts/python-first-class-functions-usage.svg)

전략 패턴은 알고리즘을 함수로 캡슐화해 런타임에 교체합니다.

```python
from typing import Callable, List

def process_data(
    data: List[int],
    transform: Callable[[int], int],
    predicate: Callable[[int], bool],
) -> List[int]:
    return [transform(x) for x in data if predicate(x)]

nums = range(-5, 6)

# 양수만 제곱
process_data(nums, lambda x: x**2, lambda x: x > 0)
# [1, 4, 9, 16, 25]

# 홀수만 두 배
process_data(nums, lambda x: x * 2, lambda x: x % 2 != 0)
# [-10, -6, -2, 2, 6, 10]
```

`transform` 과 `predicate` 를 바꾸는 것만으로 완전히 다른 동작을 만들어냅니다.

## `__call__` — 호출 가능 객체

함수 외에도 `__call__` 메서드를 정의한 클래스 인스턴스는 함수처럼 호출할 수 있습니다.

```python
class Adder:
    def __init__(self, n: int):
        self.n = n

    def __call__(self, x: int) -> int:
        return x + self.n

add10 = Adder(10)
print(add10(5))   # 15
print(callable(add10))  # True
```

`callable()` 내장 함수는 객체가 호출 가능한지 확인합니다. 함수·메서드·`__call__` 을 가진 클래스 인스턴스 모두 `True` 를 반환합니다.

## 함수 속성

파이썬 함수는 여러 유용한 속성을 가집니다.

```python
def example(a: int, b: str = "default") -> bool:
    """예시 함수입니다."""
    return True

print(example.__name__)       # example
print(example.__doc__)        # 예시 함수입니다.
print(example.__annotations__) # {'a': int, 'b': str, 'return': bool}
print(example.__defaults__)   # ('default',)
print(example.__code__.co_varnames)  # ('a', 'b')
```

이 속성들은 프레임워크·데코레이터 작성 시 매우 중요합니다.

## 함수 동등성 비교

```python
def f(): pass
def g(): pass

f == g   # False — 다른 객체
f == f   # True  — 같은 객체
f is f   # True
```

파이썬 함수는 **참조 동등성**으로 비교됩니다. 코드가 동일해도 다른 `def` 로 만들면 다른 객체입니다.

## 핵심 정리

- 파이썬 함수는 `function` 타입 객체 — 변수 할당, 인자 전달, 반환, 컬렉션 저장 모두 가능
- 고차 함수(`sorted`, `map` 등)의 동작 원리가 일급 함수
- 디스패치 테이블로 `if/elif` 체인을 깔끔하게 대체
- `__call__` 으로 클래스 인스턴스도 함수처럼 동작

---

**다음 글:** [파이썬 고차 함수 완전 정복](/posts/python-higher-order-functions/)

<br>
읽어주셔서 감사합니다. 😊
