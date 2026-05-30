---
title: "런타임 타입 검사: runtime_checkable과 그 한계"
description: "runtime_checkable Protocol로 isinstance를 쓰는 법과 그것이 검증하지 못하는 것, get_type_hints·typeguard·pydantic까지 런타임 타입 검사를 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["runtime_checkable", "런타임검사", "isinstance", "pydantic", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-mypy-pyright/)에서 정적 검사기로 타입을 확인하는 법을 배웠다. 정적 검사는 코드를 실행하기 전에 동작하므로, 실제로 외부에서 들어온 데이터(JSON, 사용자 입력)가 약속한 타입인지는 보장하지 못한다. 그렇다면 런타임에 타입을 검사할 수는 없을까? 가능하지만, 무엇이 되고 무엇이 안 되는지를 정확히 아는 것이 중요하다.

## isinstance는 제네릭을 모른다

가장 먼저 부딪히는 한계는 `isinstance`가 제네릭 파라미터를 검사하지 못한다는 점이다.

```python
isinstance([1, 2, 3], list)         # True — OK
isinstance([1, 2, 3], list[int])    # TypeError!
```

`list[int]`를 `isinstance`에 넘기면 아예 예외가 난다. `isinstance`는 "이것이 리스트인가"는 답할 수 있어도 "정수만 든 리스트인가"는 답할 수 없다. 런타임 타입 검사의 근본적 제약이다.

## runtime_checkable Protocol

Protocol에 `@runtime_checkable`을 붙이면 `isinstance`로 검사할 수 있게 된다. 단, 검사하는 것은 **메서드와 속성의 존재 여부**뿐이다.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Closable(Protocol):
    def close(self) -> None: ...

f = open("a.txt")
print(isinstance(f, Closable))   # True — close()가 있으므로
```

![@runtime_checkable 사용](/assets/posts/python-typing-runtime-checked-code.svg)

`f`가 `Closable`을 상속하지 않았어도 `close()` 메서드가 있으니 `True`가 나온다. 구조적 타이핑이 런타임에도 작동하는 셈이다.

## 무엇을 검사하지 못하는가

여기에 함정이 있다. `runtime_checkable`은 "이름이 있는가"만 확인하고, **시그니처는 검사하지 않는다.**

```python
@runtime_checkable
class Closable(Protocol):
    def close(self) -> None: ...

class Fake:
    def close(self, force, mode, timeout):   # 시그니처가 전혀 다른데
        ...

print(isinstance(Fake(), Closable))   # True! 이름만 같으면 통과
```

![runtime_checkable의 가능과 한계](/assets/posts/python-typing-runtime-checked-concept.svg)

`Fake.close`는 인자가 완전히 다르지만 `isinstance`는 `True`를 돌려준다. 메서드 인자 타입, 속성의 실제 값 타입, 제네릭 파라미터는 모두 검사 범위 밖이다. 따라서 `runtime_checkable`은 가벼운 능력 확인용일 뿐, 엄밀한 검증 도구로 믿어선 안 된다.

## 힌트를 읽어 직접 검사하기

더 정밀한 런타임 검사가 필요하면 `get_type_hints`로 힌트를 읽어 직접 검사 로직을 짤 수 있다.

```python
from typing import get_type_hints

def check(value: object, expected: type) -> bool:
    return isinstance(value, expected)

def f(x: int, y: str) -> None: ...

hints = get_type_hints(f)
print(hints)   # {'x': <class 'int'>, 'y': <class 'str'>, 'return': None}
```

다만 직접 짜는 검사는 중첩 제네릭, Union, Optional 등을 다 처리하려면 금세 복잡해진다. 그래서 보통은 검증 라이브러리에 맡긴다.

## 검증은 라이브러리에 맡기자

런타임 타입 검증이 진짜 필요한 경계는 보통 외부 입력이 들어오는 지점, 즉 API 요청 본문이나 설정 파일이다. 이런 곳에는 전용 라이브러리가 훨씬 안전하고 편하다.

```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    age: int

# 외부 JSON을 검증하며 파싱
u = User(**{"name": "Sam", "age": 30})    # OK
bad = User(**{"name": "Sam", "age": "삼십"})  # ValidationError
```

pydantic은 타입 힌트를 읽어 런타임에 실제로 값을 검증하고, 형 변환과 상세한 오류 메시지까지 제공한다. `typeguard` 같은 도구는 데코레이터로 함수 인자를 런타임 검사해 주기도 한다. 정리하면, **정적 검사는 코드의 논리를, 런타임 검증은 외부 데이터를** 책임진다고 역할을 나누는 것이 건강한 설계다. 다음 글에서는 메서드 체이닝을 타입 안전하게 만드는 Self 타입을 다룬다.

---

**지난 글:** [mypy와 pyright: 두 정적 타입 검사기 비교](/posts/python-mypy-pyright/)

**다음 글:** [Self 타입: 메서드 체이닝과 자기 참조](/posts/python-typing-self-class/)

<br>
읽어주셔서 감사합니다. 😊
