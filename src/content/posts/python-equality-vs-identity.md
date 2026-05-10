---
title: "동등성 vs 동일성: == 와 is 의 차이"
description: "Python에서 == 는 값 비교, is 는 객체 동일성 검사임을 이해하고, id(), 인터닝(작은 정수 캐시·문자열 인터닝), 올바른 사용 규칙을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "동등성", "동일성", "is", "==", "id", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-truthy-falsy/)에서 참·거짓값을 살펴봤다. 이번에는 Python 초보자가 가장 많이 헷갈리는 주제 중 하나인 **`==`(동등성)와 `is`(동일성)**의 차이를 명확히 이해한다.

## == vs is

```python
a = [1, 2, 3]
b = [1, 2, 3]
c = a           # a와 같은 객체를 참조

a == b   # True  — 값이 같은가? (__eq__ 호출)
a is b   # False — 같은 객체인가? (id 비교)

a == c   # True
a is c   # True  — a와 c는 같은 객체
```

`==`는 `__eq__` 메서드를 호출해 **값**을 비교한다. `is`는 두 변수가 **메모리상 동일한 객체**를 가리키는지 확인한다.

## id() 함수

`id(x)`는 객체의 메모리 주소(CPython 기준)를 반환한다. `is`는 `id(a) == id(b)`와 동일하다.

```python
a = [1, 2]
b = [1, 2]
c = a

id(a) == id(b)   # False (다른 객체)
id(a) == id(c)   # True  (같은 객체)
a is c           # True
```

![동등성 vs 동일성](/assets/posts/python-equality-vs-identity-overview.svg)

## is를 써야 하는 경우

`is`는 싱글턴 검사에만 써야 한다. PEP 8도 이를 권장한다.

```python
# 권장: None, True, False는 is 사용
if x is None:
    ...
if x is not None:
    ...
if flag is True:     # 엄밀한 True 검사가 필요할 때
    ...

# 비권장: ==는 __eq__ 재정의에 취약할 수 있음
if x == None:        # PEP 8 E711
    ...
```

## 작은 정수 캐시 — CPython 최적화

CPython은 -5 ~ 256 범위의 정수를 미리 캐시한다. 이 범위에서는 같은 값을 가진 변수가 같은 객체를 참조한다.

```python
a = 100; b = 100
a is b    # True  (캐시됨)

c = 300; d = 300
c is d    # False (CPython에서, 구현 의존)
c == d    # True  (항상 안전)
```

이 동작은 CPython 구현 세부사항이다. 다른 구현(PyPy 등)에서는 다를 수 있다. **정수 비교에는 항상 `==`를 써야 한다.**

## 문자열 인터닝

CPython은 특정 문자열(식별자처럼 생긴 것)을 자동으로 인터닝한다.

```python
a = "hello"; b = "hello"
a is b   # True (보통, 하지만 비보장)

a = "hello world"; b = "hello world"
a is b   # False (비보장)
a == b   # True  (항상 안전)
```

문자열 비교는 항상 `==`를 써야 한다. 특별한 이유로 인터닝이 필요하면 `sys.intern()`을 명시적으로 쓴다.

![인터닝과 is 함정](/assets/posts/python-equality-vs-identity-interning.svg)

## __eq__ 재정의

클래스에서 `==`의 동작을 정의할 수 있다.

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return self.x == other.x and self.y == other.y

p1 = Point(1, 2)
p2 = Point(1, 2)
p1 == p2    # True  (__eq__ 호출)
p1 is p2    # False (다른 객체)
```

`NotImplemented`를 반환하면 Python이 반대편 객체의 `__eq__`를 시도한다.

## 요약

| 연산자 | 의미 | 쓰는 경우 |
|--------|------|----------|
| `==` | 값 동등성 (`__eq__`) | 대부분의 비교 |
| `is` | 객체 동일성 (`id` 비교) | `None`, `True`, `False` 검사만 |
| `is not` | 객체 비동일성 | `x is not None` |

---

**지난 글:** [참·거짓값(Truthy/Falsy): Python 조건식 완전 이해](/posts/python-truthy-falsy/)

**다음 글:** [해시와 동등성: __hash__와 __eq__의 관계](/posts/python-hash-and-equality/)

<br>
읽어주셔서 감사합니다. 😊
