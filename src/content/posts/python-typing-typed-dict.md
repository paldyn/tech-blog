---
title: "TypedDict: 딕셔너리에 구조를 부여하기"
description: "TypedDict로 딕셔너리의 키와 값 타입을 고정하고, 선택적 키·total 옵션·중첩 구조까지 다루며 JSON 데이터를 안전하게 처리하는 법을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["TypedDict", "딕셔너리", "JSON", "타입힌트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-literal-final/)에서 값과 불변을 타입으로 제약하는 법을 배웠다. 실무에서 우리는 JSON 응답이나 설정처럼 "정해진 키를 가진 딕셔너리"를 자주 다룬다. `dict[str, Any]`라고 힌트를 달면 타입 검사가 사실상 무력해진다. 키 이름을 오타 내도, 값 타입이 틀려도 검사기가 잡지 못한다. `TypedDict`는 딕셔너리에 **구조**를 부여해 이 문제를 해결한다.

## 평범한 dict의 한계

먼저 `TypedDict` 없이 딕셔너리를 다룰 때 무엇이 문제인지 보자.

```python
def make_user() -> dict:
    return {"name": "Sam", "age": 30}

u = make_user()
print(u["nmae"])   # 오타! 그래도 검사기는 통과시킨다
print(u["age"] + "년")  # 타입 오류지만 잡지 못한다
```

`dict`는 어떤 키가 있는지, 각 값이 무슨 타입인지 검사기에 알려 주지 않는다. 그래서 오타와 타입 실수가 런타임까지 살아남는다.

## TypedDict 정의하기

`TypedDict`를 상속해 클래스처럼 키와 값 타입을 적으면, 검사기가 그 구조를 강제한다.

```python
from typing import TypedDict

class User(TypedDict):
    name: str
    age: int

u: User = {"name": "Sam", "age": 30}
print(u["nmae"])    # 오류: "nmae"라는 키는 없다
print(u["age"] + 1) # OK: age는 int로 알려져 있다
```

![TypedDict — dict에 키 구조를 부여](/assets/posts/python-typing-typed-dict-structure.svg)

중요한 점은 `User`가 진짜 클래스가 아니라는 것이다. 런타임에 `u`는 그냥 평범한 `dict`다. `TypedDict`는 검사기에만 존재하는 구조 정보일 뿐, 인스턴스를 만들거나 메서드를 갖지 않는다.

## 선택적 키

모든 키가 항상 존재하진 않는다. `NotRequired`로 특정 키를 선택적으로 표시할 수 있다.

```python
from typing import TypedDict, NotRequired

class User(TypedDict):
    name: str
    age: int
    email: NotRequired[str]   # 있어도 없어도 됨

a: User = {"name": "Sam", "age": 30}              # OK
b: User = {"name": "Sue", "age": 25, "email": "x@y.z"}  # OK
c: User = {"name": "Tom"}    # 오류: age 누락
```

![TypedDict 정의와 선택적 키](/assets/posts/python-typing-typed-dict-code.svg)

반대로 대부분의 키가 선택적이라면 `total=False`로 정의 전체를 선택적으로 만들고, 필수 키만 `Required`로 표시할 수도 있다.

```python
from typing import TypedDict, Required

class Config(TypedDict, total=False):
    host: Required[str]   # 이것만 필수
    port: int
    debug: bool
```

## 중첩과 재사용

`TypedDict`는 서로 중첩할 수 있어, 복잡한 JSON 구조를 그대로 모델링하기 좋다.

```python
from typing import TypedDict

class Address(TypedDict):
    city: str
    zipcode: str

class Person(TypedDict):
    name: str
    address: Address    # 중첩 TypedDict

p: Person = {
    "name": "Sam",
    "address": {"city": "Seoul", "zipcode": "04524"},
}
```

`p["address"]["city"]`에 접근할 때 검사기는 `city`가 문자열임을 안다. API 응답을 다룰 때 이 중첩 구조가 큰 힘을 발휘한다.

## TypedDict vs dataclass

비슷해 보이지만 쓰임이 다르다. `TypedDict`는 **이미 딕셔너리 형태인 데이터**(JSON 파싱 결과, 외부 API 응답)에 타입을 입힐 때 적합하다. 새로운 객체를 설계한다면 `dataclass`가 더 낫다. dataclass는 진짜 클래스라 메서드·기본값·검증을 가질 수 있지만, TypedDict는 런타임 오버헤드가 전혀 없고 기존 dict 코드와 자연스럽게 섞인다. 정리하면, "딕셔너리를 dict인 채로 안전하게" 쓰고 싶을 때 TypedDict를 선택한다. 다음 글에서는 상속 없이 인터페이스를 정의하는 Protocol을 살펴본다.

---

**지난 글:** [Literal과 Final: 값과 불변을 타입으로 표현하기](/posts/python-typing-literal-final/)

**다음 글:** [typing.Protocol: 상속 없는 구조적 타이핑](/posts/python-typing-protocol/)

<br>
읽어주셔서 감사합니다. 😊
