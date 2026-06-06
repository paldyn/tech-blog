---
title: "덕 타이핑 vs isinstance — 타입을 묻지 않는 법"
description: "'오리처럼 행동하면 오리다.' 파이썬의 덕 타이핑이 무엇인지, 그리고 isinstance로 타입을 직접 검사하는 것이 언제 적절하고 언제 코드를 굳게 만드는지 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["덕 타이핑", "isinstance", "다형성", "Protocol", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pythonic-vs-non-pythonic/)에서 파이썬다움의 큰 그림을 그렸다면, 이번에는 그 정신이 가장 선명하게 드러나는 갈림길 하나를 들여다본다. 함수에 어떤 값이 들어왔을 때, 우리는 그것이 "무엇인지"를 물을 수도 있고 "무엇을 할 수 있는지"를 볼 수도 있다. 전자는 `isinstance`로 타입을 검사하는 길이고, 후자는 그냥 필요한 동작을 시도해 보는 길 — 흔히 **덕 타이핑(duck typing)**이라 부르는 파이썬의 기본 방식이다.

## "오리처럼 행동하면 오리다"

덕 타이핑이라는 이름은 다음 한 문장에서 왔다. "어떤 새가 오리처럼 걷고 오리처럼 꽥꽥거린다면, 그 새는 오리라고 불러도 된다." 즉 객체가 **무슨 타입인가**는 중요하지 않고, **어떤 동작을 지원하는가**만 중요하다는 발상이다.

```python
def render(items):
    return ", ".join(str(x) for x in items)
```

이 함수는 `items`가 리스트인지 튜플인지 집합인지 제너레이터인지 전혀 묻지 않는다. 그저 "순회할 수 있으면 된다"는 한 가지 능력만 요구한다. 그래서 다음이 모두 동작한다.

```python
render([1, 2, 3])          # 리스트
render((1, 2, 3))          # 튜플
render({1, 2, 3})          # 집합
render(x for x in range(3))  # 제너레이터
```

타입을 묻지 않았기 때문에, 나중에 누군가 "순회 가능한" 새로운 타입을 만들어 넘겨도 함수는 고치지 않고 그대로 동작한다. 이것이 덕 타이핑이 주는 유연함이다.

![무엇이냐 vs 무엇을 할 수 있느냐](/assets/posts/python-ducktyping-vs-isinstance-compare.svg)

## isinstance로 타입을 직접 묻는 길

반대로 `isinstance`는 "이 값이 정확히 이 타입(혹은 그 하위 타입)인가"를 직접 검사한다.

```python
def render(items):
    if isinstance(items, list):
        return ", ".join(str(x) for x in items)
    raise TypeError("list만 받습니다")
```

이렇게 쓰면 튜플이나 집합은 충분히 순회 가능한데도 거부당한다. 함수가 필요로 하는 능력(순회)보다 훨씬 좁은 조건(리스트일 것)을 강제하면서, 쓸데없이 코드를 굳게 만든 셈이다. 이런 식의 불필요한 타입 검사는 파이썬에서 가장 흔한 "덜 파이썬다운" 습관 중 하나다. 다른 언어에서 넘어온 사람일수록 입구에서 타입을 확인하고 싶은 충동을 느끼기 쉬운데, 파이썬에서는 대개 그냥 동작을 시도하는 편이 낫다.

## 그래도 isinstance가 맞는 자리

그렇다고 `isinstance`가 나쁜 도구라는 말은 아니다. 정말로 타입에 따라 처리가 **근본적으로 달라져야** 할 때, 또는 외부에서 들어온 값을 경계에서 **엄격히 검증**해야 할 때는 명시적인 타입 검사가 옳다.

```python
def normalize(value):
    # 문자열과 리스트를 의도적으로 다르게 처리해야 한다
    if isinstance(value, str):
        return [value]          # 문자열은 통째로 한 원소
    if isinstance(value, (list, tuple)):
        return list(value)      # 시퀀스는 그대로 펼친다
    raise TypeError(f"지원하지 않는 타입: {type(value).__name__}")
```

여기서 문자열을 그냥 순회하면 글자 하나씩 쪼개져 버리므로, "문자열이면 통째로 다룬다"는 의도를 명시적으로 표현해야 한다. 이처럼 **타입별 분기가 진짜 목적인 경우**가 `isinstance`의 정당한 자리다. 한 가지 팁은, 검사할 때 구체적인 타입(`list`) 대신 추상 베이스 클래스(`collections.abc.Iterable`, `Sequence` 등)를 쓰면 덕 타이핑의 유연함과 검사의 명시성을 어느 정도 함께 가져갈 수 있다는 것이다.

```python
from collections.abc import Iterable

def render(items):
    if not isinstance(items, Iterable):
        raise TypeError("순회 가능한 값이 필요합니다")
    return ", ".join(str(x) for x in items)
```

이 검사는 "리스트인가"가 아니라 "순회 가능한가"를 묻기 때문에, 함수가 실제로 요구하는 능력과 검사 조건이 일치한다.

## Protocol — 유연함을 타입으로 표현하기

덕 타이핑의 약점은 "어떤 능력이 필요한지"가 코드 어디에도 명시되지 않아, 정적 타입 검사기나 동료가 한눈에 알기 어렵다는 점이다. 파이썬은 이 간극을 메우려고 `typing.Protocol`을 제공한다. "이런 메서드를 가진 무엇이든"이라는 구조적 계약을 타입으로 적을 수 있게 해준다.

```python
from typing import Protocol

class Closeable(Protocol):
    def close(self) -> None: ...

def shutdown(resource: Closeable) -> None:
    resource.close()
```

`shutdown`은 여전히 덕 타이핑처럼 동작한다 — `close()` 메서드만 있으면 무엇이든 받는다. 동시에 타입 힌트가 "이 함수는 `close` 가능한 것을 받는다"는 의도를 명시하므로, mypy나 pyright가 잘못된 호출을 미리 잡아 줄 수 있다. 유연함은 그대로 두고, 계약만 타입으로 끌어올린 것이다.

![언제 무엇을 쓸까](/assets/posts/python-ducktyping-vs-isinstance-guide.svg)

## 정리

파이썬의 기본 태도는 "무엇이냐"가 아니라 "무엇을 할 수 있느냐"를 보는 덕 타이핑이다. 평범한 코드라면 타입을 검사하지 말고 그냥 필요한 동작을 시도하자 — 그래야 코드가 새로운 타입에도 열려 있다. `isinstance`는 타입별로 처리가 정말 달라져야 하거나 입력을 엄격히 검증해야 하는 경계에서만 꺼내고, 그때도 구체 타입보다 `collections.abc`의 추상 타입을 검사하는 편이 유연하다. 그리고 "이런 능력을 가진 것"이라는 계약을 타입으로 적고 싶다면 `Protocol`이 덕 타이핑과 정적 검사를 동시에 잡아 준다.

---

**지난 글:** [파이썬다운 코드란? — Pythonic vs Non-Pythonic](/posts/python-pythonic-vs-non-pythonic/)

**다음 글:** [리스트 vs 튜플, 언제 무엇을 쓸까](/posts/python-list-vs-tuple-when-to-use/)

<br>
읽어주셔서 감사합니다. 😊
