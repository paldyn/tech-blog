---
title: "타입 힌트 입문: 파이썬에 타입을 더하는 법"
description: "파이썬의 타입 힌트가 무엇이고 왜 필요한지, 변수·함수에 어떻게 붙이는지, 그리고 정적 검사기와 런타임의 관계를 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["타입힌트", "타이핑", "mypy", "정적분석", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-lock-rlock-semaphore/)에서 동시성 도구를 다루며 코드가 커질수록 "이 변수에 무엇이 들어오는가"를 추적하기 어려워진다는 점을 느꼈을 것이다. 파이썬은 동적 타입 언어라 변수에 타입을 선언하지 않아도 동작하지만, 규모가 커지면 그 자유로움이 오히려 버그의 온상이 된다. 타입 힌트는 이 간극을 메우기 위해 파이썬 3.5부터 점진적으로 도입된 기능으로, 코드의 의도를 명시하고 도구가 오류를 미리 잡아낼 수 있게 해 준다.

## 타입 힌트란 무엇인가

타입 힌트(type hint)는 변수나 함수에 "이 자리에는 이런 타입이 와야 한다"는 정보를 덧붙이는 문법이다. 핵심은 이것이 **선택적(optional)** 이며 **점진적(gradual)** 이라는 점이다. 일부만 붙여도 되고, 전혀 붙이지 않은 코드와 섞어 써도 문제가 없다.

가장 중요한 오해부터 짚고 넘어가자. 타입 힌트는 **실행 시점에 강제되지 않는다.** `def f(x: int)` 라고 써 두어도 `f("문자열")` 을 호출하면 파이썬은 아무 불평 없이 실행한다. 타입 힌트는 인터프리터가 아니라 **정적 검사기**(mypy, pyright 등)와 IDE가 읽는 메타데이터다.

![타입 힌트는 어떻게 동작하는가](/assets/posts/python-typing-overview-concept.svg)

이 분리가 파이썬 타이핑 철학의 핵심이다. 검사기는 코드를 실행하지 않고 분석해서 타입이 맞지 않는 곳을 찾아내고, 정작 인터프리터는 힌트를 무시하고 평소처럼 동작한다. 덕분에 성능 손해 없이 안전성을 얻는다.

## 변수와 함수에 힌트 달기

문법은 직관적이다. 변수는 `이름: 타입`, 함수는 매개변수마다 `이름: 타입`을 쓰고 반환은 `-> 타입`으로 표기한다.

```python
from typing import Optional

def greet(name: str, times: int = 1) -> str:
    return ("Hi " + name) * times

age: int = 30
nickname: Optional[str] = None
```

매개변수 `name`은 문자열, `times`는 정수이며 기본값 `1`을 가진다. 반환 타입은 `-> str`이다. 변수 `age`에도 `: int`로 힌트를 달았다. 이렇게 명시해 두면 검사기가 잘못된 호출을 발견한다.

![변수·함수에 타입 힌트 달기](/assets/posts/python-typing-overview-code.svg)

`greet("Sam", "twice")` 처럼 `times` 자리에 문자열을 넘기면 검사기가 즉시 오류로 표시한다. 실행해 보지 않아도, 코드를 작성하는 그 순간 IDE가 빨간 줄을 그어 준다.

## 왜 타입 힌트를 쓰는가

타입 힌트가 주는 이점은 세 가지로 정리할 수 있다.

```python
# 1. 자동완성과 문서화
def send(user: User, msg: str) -> bool: ...
# IDE가 user. 만 입력해도 User의 속성을 제안한다

# 2. 리팩터링 안전성
# 함수 시그니처를 바꾸면 검사기가 모든 호출부를 점검한다

# 3. 버그 조기 발견
# None이 들어올 수 있는 곳에서 .upper()를 호출하면 경고
```

특히 협업 환경에서 타입 힌트는 살아 있는 문서가 된다. 주석은 코드와 따로 놀다가 낡아 버리지만, 타입 힌트는 검사기가 끊임없이 검증하므로 거짓말을 하지 않는다.

## 런타임에 힌트를 읽기

힌트가 런타임에 강제되진 않지만, 필요하면 직접 읽을 수는 있다. 함수의 `__annotations__` 속성이나 `typing.get_type_hints()`로 접근한다.

```python
from typing import get_type_hints

def f(x: int, y: str) -> bool:
    return True

print(get_type_hints(f))
# {'x': <class 'int'>, 'y': <class 'str'>, 'return': <class 'bool'>}
```

pydantic 같은 라이브러리는 바로 이 정보를 읽어 런타임 검증을 수행한다. 즉 표준 타이핑은 "검사기를 위한 힌트"지만, 이 메타데이터를 활용해 런타임 검증을 추가하는 생태계가 풍부하게 발전해 있다.

## 점진적으로 도입하기

기존 프로젝트에 타입을 한꺼번에 다 붙일 필요는 없다. 가장 자주 호출되는 핵심 함수, 가장 버그가 잦은 모듈부터 시작하면 된다. 힌트가 없는 코드는 검사기가 `Any`로 간주하고 넘어가므로, 부분적으로만 적용해도 그만큼의 이득을 얻는다. 다음 글부터는 이 타입 힌트를 더 정교하게 표현하는 도구들을 하나씩 살펴본다.

---

**지난 글:** [Lock, RLock, Semaphore](/posts/python-lock-rlock-semaphore/)

**다음 글:** [제네릭: TypeVar와 Generic으로 타입을 재사용하기](/posts/python-typing-generics/)

<br>
읽어주셔서 감사합니다. 😊
