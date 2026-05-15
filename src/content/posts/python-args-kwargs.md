---
title: "*args와 **kwargs: 가변 인수 완전 정리"
description: "Python에서 임의 개수의 인수를 받는 *args(튜플)와 **kwargs(딕셔너리)의 동작 원리, 혼합 선언 순서, 호출 시 언패킹까지 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "*args", "**kwargs", "가변 인수", "언패킹"]
featured: false
draft: false
---

[지난 글](/posts/python-default-args-pitfall/)에서 가변 객체를 기본값으로 쓸 때의 함정을 살펴봤다. 이번에는 인수 개수를 미리 정하지 않아도 되는 `*args`와 `**kwargs`를 다룬다.

## *args — 위치 인수를 튜플로 수집

매개변수 이름 앞에 `*`를 붙이면 그 자리 이후의 모든 위치 인수를 **튜플**로 묶어 받는다.

```python
def add(*args):
    return sum(args)

print(add(1, 2))         # 3
print(add(1, 2, 3, 4))   # 10
print(add())             # 0
```

함수 내부에서 `args`는 일반 튜플이다.

```python
def show_types(*args):
    print(type(args))   # <class 'tuple'>
    for i, v in enumerate(args):
        print(i, v)

show_types("a", "b", "c")
# 0 a
# 1 b
# 2 c
```

## **kwargs — 키워드 인수를 딕셔너리로 수집

매개변수 이름 앞에 `**`를 붙이면 이름을 가진 인수를 **딕셔너리**로 묶어 받는다.

```python
def info(**kwargs):
    for key, val in kwargs.items():
        print(f"{key}: {val}")

info(name="철수", age=25, city="서울")
# name: 철수
# age: 25
# city: 서울
```

![*args와 **kwargs 동작 원리](/assets/posts/python-args-kwargs-diagram.svg)

## 혼합 선언 순서

일반 매개변수, `*args`, 키워드 전용 매개변수, `**kwargs` 순서를 지켜야 한다.

```python
def full(a, b, *args, key="val", **kwargs):
    print(a, b)      # 일반 위치 인수
    print(args)      # 나머지 위치 → tuple
    print(key)       # 키워드 전용 (기본값 있음)
    print(kwargs)    # 나머지 키워드 → dict

full(1, 2, 3, 4, key="K", x=9, y=10)
# 1 2
# (3, 4)
# K
# {'x': 9, 'y': 10}
```

## 호출 시 언패킹 — * 와 **

정의할 때 `*`로 수집하는 것과 반대로, 호출할 때 `*`/`**`를 붙이면 컨테이너를 풀어서 전달한다.

```python
def add(a, b, c):
    return a + b + c

nums = [10, 20, 30]
print(add(*nums))   # 60  — 리스트를 위치 인수로 풀기

opts = {"a": 1, "b": 2, "c": 3}
print(add(**opts))  # 6   — 딕셔너리를 키워드 인수로 풀기
```

![*args + **kwargs 혼합과 언패킹](/assets/posts/python-args-kwargs-combined.svg)

## 실용적인 패턴

**래퍼 함수**: 모든 인수를 그대로 전달할 때 유용하다.

```python
import time

def timed(func, *args, **kwargs):
    start = time.perf_counter()
    result = func(*args, **kwargs)
    elapsed = time.perf_counter() - start
    print(f"{func.__name__}: {elapsed:.4f}s")
    return result

timed(sorted, [3, 1, 4, 1, 5], reverse=True)
```

**포워딩 패턴**: 부모 클래스 초기화를 투명하게 전달한다.

```python
class LoggedList(list):
    def __init__(self, *args, **kwargs):
        print("LoggedList 생성")
        super().__init__(*args, **kwargs)
```

## 이름은 관례일 뿐

`args`와 `kwargs`는 관례적인 이름일 뿐, 기술적으로는 `*nums`나 `**options` 등 어떤 이름도 쓸 수 있다. 하지만 `*args`, `**kwargs`가 파이썬 커뮤니티의 강력한 관례이므로 따르는 편이 좋다.

---

**지난 글:** [기본 인수의 함정: 가변 객체를 기본값으로 쓰면 안 되는 이유](/posts/python-default-args-pitfall/)

**다음 글:** [키워드 전용 인수: * 이후 매개변수 강제하기](/posts/python-keyword-only-args/)

<br>
읽어주셔서 감사합니다. 😊
