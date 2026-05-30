---
title: "typing.Protocol: 상속 없는 구조적 타이핑"
description: "Protocol로 명시적 상속 없이 인터페이스를 정의하는 구조적 서브타이핑을 다루고, ABC와의 차이·제네릭 Protocol·실전 활용까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Protocol", "구조적타이핑", "덕타이핑", "타입힌트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-typed-dict/)에서 딕셔너리에 구조를 부여하는 TypedDict를 배웠다. 파이썬은 전통적으로 "오리처럼 걷고 운다면 오리다"라는 덕 타이핑(duck typing)을 사랑해 왔다. 어떤 객체가 `close()` 메서드만 있으면, 그것이 무엇을 상속했든 상관없이 닫을 수 있다. 문제는 이 유연함을 정적 검사기에 어떻게 알려 주느냐다. `typing.Protocol`은 바로 이 덕 타이핑을 타입 시스템 안으로 가져온다.

## 명목적 타이핑 vs 구조적 타이핑

대부분의 정적 언어는 **명목적(nominal)** 타이핑을 쓴다. "B가 A의 하위 타입이려면 명시적으로 A를 상속해야 한다"는 규칙이다. 반면 `Protocol`은 **구조적(structural)** 타이핑을 제공한다. "필요한 메서드와 속성을 갖췄다면, 상속 선언 없이도 그 타입으로 인정한다."

```python
from typing import Protocol

class SupportsClose(Protocol):
    def close(self) -> None: ...

def shut(resource: SupportsClose) -> None:
    resource.close()
```

`shut`은 `close()` 메서드를 가진 무엇이든 받는다. 파일, 소켓, DB 커넥션, 직접 만든 클래스 모두 `SupportsClose`를 상속하지 않았어도 통과한다.

## 상속 없이 부합하기

핵심은 클래스가 `Protocol`을 상속하지 **않아도** 된다는 점이다. 시그니처만 맞으면 자동으로 부합한다.

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...

class Circle:               # Drawable 상속 안 함
    def draw(self) -> None:
        print("○")

class Button:               # 역시 상속 안 함
    def draw(self) -> None:
        print("[OK]")

def render(item: Drawable) -> None:
    item.draw()

render(Circle())   # OK
render(Button())   # OK
```

![Protocol — 상속 없는 구조적 타이핑](/assets/posts/python-typing-protocol-concept.svg)

이것이 ABC(추상 베이스 클래스)와 결정적으로 다른 점이다. ABC를 쓰려면 모든 구현 클래스가 그 ABC를 상속해야 한다. 하지만 외부 라이브러리의 클래스나 표준 타입은 우리가 상속을 추가할 수 없다. `Protocol`은 그런 경우에도 "이 모양이면 된다"고 선언할 수 있다.

![Protocol 정의와 사용](/assets/posts/python-typing-protocol-code.svg)

## 속성도 포함할 수 있다

Protocol은 메서드뿐 아니라 속성도 요구할 수 있다.

```python
from typing import Protocol

class Named(Protocol):
    name: str
    def greet(self) -> str: ...

def announce(x: Named) -> str:
    return f"{x.name}: {x.greet()}"
```

`Named`는 `name` 속성과 `greet` 메서드를 모두 가진 객체를 요구한다.

## 제네릭 Protocol

`Protocol`도 제네릭으로 만들 수 있다. 표준 라이브러리의 `Iterable`, `Container` 같은 타입이 바로 제네릭 Protocol로 정의되어 있다.

```python
from typing import Protocol, TypeVar

T = TypeVar("T")

class Readable(Protocol[T]):
    def read(self) -> T: ...

def consume(src: Readable[bytes]) -> bytes:
    return src.read()
```

## ABC와 Protocol, 언제 무엇을

둘은 경쟁이 아니라 보완 관계다. **내가 만든 클래스 계층**을 강제하고 공통 구현을 공유하고 싶으면 ABC가 적합하다. 반면 **이미 존재하는 다양한 타입**(내가 수정할 수 없는 것 포함)을 하나의 인터페이스로 묶고 싶으면 Protocol이 답이다. 라이브러리 API를 설계할 때는 호출자에게 상속을 강요하지 않는 Protocol이 더 친화적인 경우가 많다. 다음 글에서는 데코레이터의 시그니처를 보존하는 ParamSpec을 다룬다.

---

**지난 글:** [TypedDict: 딕셔너리에 구조를 부여하기](/posts/python-typing-typed-dict/)

**다음 글:** [ParamSpec: 데코레이터의 시그니처를 보존하기](/posts/python-typing-paramspec/)

<br>
읽어주셔서 감사합니다. 😊
