---
title: "불변성(Immutability): Python에서 변하지 않는 것들"
description: "Python의 불변 타입(int, str, tuple 등)과 가변 타입(list, dict 등)의 차이, 인터닝, 해싱, 얕은 불변성 함정과 frozen dataclass 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "불변성", "Immutable", "Mutable", "tuple", "frozenset", "dataclass"]
featured: false
draft: false
---

[지난 글](/posts/python-infinite-iterator/)에서 무한 이터레이터를 다뤘다. 이번 글부터는 함수형 프로그래밍의 핵심 개념들을 살펴본다. 그 첫 번째 주제는 **불변성(Immutability)**이다. Python에서 불변성을 이해하면 버그를 예방하고, 스레드 안전 코드를 작성하고, 함수형 스타일의 설계를 자연스럽게 적용할 수 있다.

## 불변 타입 vs 가변 타입

![불변 vs 가변 타입 비교](/assets/posts/python-immutability-concept.svg)

Python의 모든 객체는 **불변(Immutable)** 또는 **가변(Mutable)** 중 하나다.

**불변 타입**: `int`, `float`, `complex`, `str`, `bytes`, `tuple`, `frozenset`, `bool`  
**가변 타입**: `list`, `dict`, `set`, `bytearray`, 대부분의 사용자 정의 클래스

불변 객체는 생성된 이후 값을 바꿀 수 없다. `"hello"`라는 문자열에 무언가를 이어 붙이면, 원래 문자열이 바뀌는 것이 아니라 새로운 문자열 객체가 만들어진다.

```python
s = "hello"
s += " world"   # 새로운 str 객체 생성, "hello"는 변경되지 않음
print(s)        # hello world

# 직접 수정 시도는 TypeError
# s[0] = "H"   → TypeError: 'str' object does not support item assignment
```

## 불변성이 중요한 세 가지 이유

**1. dict 키와 set 원소**: Python의 `dict` 키와 `set` 원소는 해시 가능(hashable)해야 한다. 해시 가능하려면 값이 변하지 않아야 한다. 불변 객체만 해시 가능하다.

```python
# tuple은 dict 키로 사용 가능
coords = {(0, 0): "origin", (1, 0): "right"}

# list는 불가
# bad = {[0, 0]: "origin"}  → TypeError: unhashable type: 'list'
```

**2. 스레드 안전성**: 여러 스레드가 같은 불변 객체를 공유해도 경쟁 조건(race condition)이 발생하지 않는다. 값이 바뀌지 않으므로 잠금(lock)이 필요 없다.

**3. 코드 예측 가능성**: 함수에 불변 객체를 전달하면 함수 내부에서 그 값을 바꿀 수 없다. 부작용(side effect) 걱정 없이 안전하게 전달할 수 있다.

## 객체 동일성과 인터닝

![불변성과 객체 동일성](/assets/posts/python-immutability-identity.svg)

Python에서 `==`는 값이 같은지, `is`는 같은 객체인지를 확인한다.

```python
a = 256
b = 256
print(a == b)   # True  (값 비교)
print(a is b)   # True  (CPython이 -5~256 정수를 캐시/인터닝)

x = 1000
y = 1000
print(x == y)   # True
print(x is y)   # False (큰 정수는 별도 객체 생성)
```

CPython은 성능 최적화를 위해 자주 쓰이는 작은 정수(-5부터 256)와 짧은 문자열을 **인터닝(interning)**한다. 같은 값이면 동일한 객체를 재사용한다. 이는 구현 세부사항이므로 코드에서 `is`로 값을 비교하는 것은 잘못된 패턴이다.

## 얕은 불변성의 함정

`tuple`은 불변이지만 **얕은 불변성(shallow immutability)**만 보장한다. tuple 안에 가변 객체가 들어 있으면, 그 객체의 내용은 바꿀 수 있다.

```python
t = ([1, 2], [3, 4])
t[0].append(99)
print(t)   # ([1, 2, 99], [3, 4])  ← tuple 자체는 변하지 않지만 내부 list는 변경됨

# tuple이 해시 불가능해지는 이유
# t2 = ([1, 2], 3)
# hash(t2)  → TypeError: unhashable type: 'list'
```

진정한 불변 객체를 원한다면 내부의 모든 값도 불변이어야 한다.

## frozen dataclass로 불변 레코드 만들기

`@dataclass(frozen=True)`를 사용하면 속성 변경 시 `FrozenInstanceError`를 발생시키는 불변 데이터 클래스를 만들 수 있다.

```python
from dataclasses import dataclass, replace

@dataclass(frozen=True)
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
# p.x = 10.0  → FrozenInstanceError

# 값을 바꾸려면 새 객체 생성
p2 = replace(p, x=10.0)
print(p)   # Point(x=1.0, y=2.0)
print(p2)  # Point(x=10.0, y=2.0)
```

`replace()`는 기존 객체는 그대로 두고 변경된 필드만 반영한 새 객체를 반환한다. 이 패턴이 함수형 프로그래밍에서 불변 데이터를 "수정"하는 표준 방식이다.

## 불변성을 활용한 설계 원칙

불변성은 단순히 타입의 속성이 아니라 **설계 원칙**이기도 하다. 가능하면 데이터를 불변으로 설계하고, 변경이 필요할 때는 새 객체를 반환하는 방식을 선호한다. 이렇게 하면 코드를 추론하기 쉬워지고, 디버깅이 단순해지고, 동시성 프로그래밍에서 실수가 줄어든다.

다음 글에서는 이 불변성 원칙과 밀접히 연결된 **순수 함수(Pure Functions)**를 살펴본다.

---

**지난 글:** [무한 이터레이터: count, cycle, repeat와 islice 활용](/posts/python-infinite-iterator/)

**다음 글:** [순수 함수(Pure Functions): 부작용 없는 함수 설계](/posts/python-pure-functions/)

<br>
읽어주셔서 감사합니다. 😊
