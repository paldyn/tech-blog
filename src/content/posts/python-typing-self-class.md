---
title: "Self 타입: 메서드 체이닝과 자기 참조"
description: "Self 타입으로 메서드 체이닝과 팩토리 메서드를 서브클래스에서도 정확히 추론하게 만드는 법, TypeVar bound 방식과의 비교까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Self", "메서드체이닝", "팩토리메서드", "타입힌트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-runtime-checked/)에서 런타임 타입 검사의 가능과 한계를 살펴봤다. 이번 글은 타입 힌트 시리즈의 마지막으로, 자기 자신을 반환하는 메서드의 타입을 우아하게 표현하는 `Self` 타입을 다룬다. 빌더 패턴이나 메서드 체이닝을 구현해 본 적이 있다면, "이 메서드의 반환 타입을 어떻게 적지?"라는 고민을 한 번쯤 해 봤을 것이다.

## 문제: 클래스 이름으로 적으면 깨진다

메서드가 `self`를 반환할 때, 단순히 클래스 이름을 반환 타입으로 적으면 서브클래스에서 문제가 생긴다.

```python
class Query:
    def filter(self, **kw) -> "Query":   # 클래스 이름으로 명시
        return self

class UserQuery(Query):
    def only_active(self) -> "UserQuery":
        return self

q = UserQuery().filter(active=True)
q.only_active()   # 오류: filter()의 반환은 Query라 only_active가 없다
```

`filter`의 반환 타입을 `Query`로 적었기 때문에, `UserQuery`에서 호출해도 검사기는 결과를 `Query`로만 본다. 그래서 서브클래스 고유 메서드 `only_active`를 쓸 수 없다.

## Self가 답이다

파이썬 3.11에 추가된 `Self`는 "이 메서드를 호출한 실제 클래스"를 가리킨다. 베이스 클래스에 한 번만 적어도, 서브클래스에서 호출하면 자동으로 그 서브클래스 타입으로 추론된다.

```python
from typing import Self

class Query:
    def __init__(self) -> None:
        self._where: dict = {}

    def filter(self, **kw) -> Self:
        self._where.update(kw)
        return self           # Self 반환

class UserQuery(Query): ...

q = UserQuery().filter(age=30)   # q: UserQuery 으로 추론
```

![Self로 정확한 반환 타입 표현](/assets/posts/python-typing-self-class-code.svg)

`UserQuery().filter(...)`의 결과가 `UserQuery`로 추론되므로, 이어서 서브클래스 메서드를 호출해도 검사기가 통과시킨다.

## 메서드 체이닝

`Self`가 가장 빛나는 곳은 메서드 체이닝이다. 각 메서드가 `Self`를 반환하면, 호출을 점으로 계속 이어 가도 타입이 정확히 유지된다.

```python
from typing import Self

class Query:
    def filter(self, **kw) -> Self: ...
    def order_by(self, field: str) -> Self: ...
    def limit(self, n: int) -> Self: ...

result = (
    Query()
    .filter(active=True)
    .order_by("name")
    .limit(10)
)
```

![Self 타입과 메서드 체이닝](/assets/posts/python-typing-self-class-chaining.svg)

체인의 모든 단계에서 타입이 `Query`(혹은 서브클래스)로 유지되므로, 자동완성과 검사가 끝까지 작동한다.

## 팩토리 메서드와 classmethod

`Self`는 인스턴스를 만들어 반환하는 `classmethod`에서도 유용하다. 대안 생성자를 만들 때 서브클래스 타입을 정확히 반환한다.

```python
from typing import Self

class Model:
    @classmethod
    def from_dict(cls, data: dict) -> Self:
        obj = cls()
        obj.__dict__.update(data)
        return obj

class User(Model): ...

u = User.from_dict({"name": "Sam"})   # u: User 으로 추론
```

`from_dict`를 `Model`에 한 번만 정의해도, `User.from_dict(...)`는 `User`를 반환하는 것으로 추론된다.

## TypeVar bound 방식과 비교

`Self`가 등장하기 전에는 `TypeVar`의 bound로 같은 효과를 냈다. 비교해 두면 옛 코드를 읽을 때 도움이 된다.

```python
from typing import TypeVar

T = TypeVar("T", bound="Query")

class Query:
    def filter(self: T, **kw) -> T:   # 옛 방식
        return self
```

`self: T` 형태로 메서드의 self에 타입 변수를 바인딩하는 방식인데, 장황하고 직관적이지 않다. 3.11 이상이라면 `Self`가 훨씬 짧고 읽기 쉬우므로 새 코드에서는 `Self`를 쓰는 것이 정석이다.

이것으로 타입 힌트 시리즈를 마무리한다. 기본 어노테이션에서 제네릭, Union, Literal·Final, TypedDict, Protocol, ParamSpec, 검사 도구, 런타임 검증, 그리고 Self까지 — 파이썬의 점진적 타이핑은 코드를 실행하지 않고도 수많은 버그를 미리 잡아 준다. 작은 함수 하나부터 힌트를 달아 보면, 그 안정감이 곧 습관이 될 것이다.

---

**지난 글:** [런타임 타입 검사: runtime_checkable과 그 한계](/posts/python-typing-runtime-checked/)

<br>
읽어주셔서 감사합니다. 😊
