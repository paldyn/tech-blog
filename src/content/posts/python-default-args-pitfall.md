---
title: "기본 인수의 함정: 가변 객체를 기본값으로 쓰면 안 되는 이유"
description: "리스트나 딕셔너리를 함수 기본값으로 사용하면 호출마다 공유되는 이유와, None 센티널 패턴으로 안전하게 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "기본 인수", "가변 객체", "함정", "None 센티널"]
featured: false
draft: false
---

[지난 글](/posts/python-positional-keyword-args/)에서 위치 인수와 키워드 인수 전달 방식을 다뤘다. 이번에는 기본값 인수에 숨어있는 대표적인 함정을 짚는다. Python 개발자라면 누구나 한 번쯤 겪는 버그다.

## 버그 재현

직관적으로 보이는 아래 코드는 예상과 다르게 동작한다.

```python
def append_item(item, lst=[]):
    lst.append(item)
    return lst

print(append_item(1))   # [1]
print(append_item(2))   # [2] 예상 → [1, 2] 실제
print(append_item(3))   # [3] 예상 → [1, 2, 3] 실제
```

각 호출이 독립적인 새 리스트를 받을 것 같지만, 세 호출 모두 같은 리스트 객체를 수정한다.

## 원인: 기본값은 정의 시 한 번만 평가된다

Python에서 함수 기본값은 **함수가 정의될 때 단 한 번 평가**된다. 즉, `def append_item(item, lst=[]):` 가 실행되는 순간 `[]`가 생성되어 함수 객체의 `__defaults__` 속성에 저장된다.

```python
def append_item(item, lst=[]):
    lst.append(item)
    return lst

# 기본값 확인
print(append_item.__defaults__)   # ([],)
append_item(1)
print(append_item.__defaults__)   # ([1],)  — 변경됨!
```

호출할 때마다 새 `[]`를 만드는 것이 아니라, 동일한 객체를 재사용한다.

![가변 기본값의 함정](/assets/posts/python-default-args-pitfall-bug.svg)

## 해결책: None 센티널 패턴

관례적인 해결법은 기본값을 `None`으로 지정하고, 함수 본문 첫 줄에서 새 가변 객체를 생성하는 것이다.

```python
def append_item(item, lst=None):
    if lst is None:
        lst = []       # 호출마다 새 리스트 생성
    lst.append(item)
    return lst

print(append_item(1))   # [1]
print(append_item(2))   # [2]  — 독립적!
```

딕셔너리도 동일하다.

```python
def add_key(key, val, d=None):
    if d is None:
        d = {}
    d[key] = val
    return d
```

![올바른 패턴 — None 센티널](/assets/posts/python-default-args-pitfall-fix.svg)

## 안전한 타입과 위험한 타입

| 기본값 타입 | 안전 여부 | 이유 |
|-------------|-----------|------|
| `int`, `float`, `str`, `bool` | ✅ 안전 | 불변(immutable) |
| `None` | ✅ 안전 | 불변 |
| `tuple` | ✅ 안전 | 불변 — 수정 불가 |
| `list`, `dict`, `set` | ❌ 위험 | 가변(mutable) — 수정 공유 |

## 의도적으로 활용하는 경우

드물지만 이 동작을 의도적으로 사용하기도 한다. 캐시처럼 호출 간에 상태를 공유하고 싶을 때다.

```python
def memoize(n, _cache={}):
    if n not in _cache:
        _cache[n] = n * n
    return _cache[n]

print(memoize(5))   # 25
print(memoize(5))   # 25 (캐시 적중)
```

하지만 이런 패턴은 `functools.lru_cache`를 쓰는 편이 훨씬 명확하다.

## 정리

기본값으로 가변 객체를 사용하면 모든 호출이 같은 객체를 공유한다. **가변 객체 기본값은 항상 `None`으로 대체**하고 함수 본문에서 생성한다.

---

**지난 글:** [위치 인수와 키워드 인수: Python 인수 전달 방식의 기본](/posts/python-positional-keyword-args/)

**다음 글:** [*args와 **kwargs: 가변 인수 완전 정리](/posts/python-args-kwargs/)

<br>
읽어주셔서 감사합니다. 😊
