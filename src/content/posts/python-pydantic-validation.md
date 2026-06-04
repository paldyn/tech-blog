---
title: "Pydantic: 데이터 검증을 타입으로"
description: "타입 힌트로 데이터 검증을 선언하는 Pydantic. BaseModel로 모델을 정의하고, 자동 형변환과 Field 제약, ValidationError, 그리고 직렬화까지 신뢰할 수 있는 데이터의 경계를 만드는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Pydantic", "검증", "타입힌트", "직렬화", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-requests-vs-httpx/)에서 외부 API로부터 데이터를 받아 오는 법을 봤다. 그런데 바깥에서 온 데이터는 늘 미덥지 않다. 필수 필드가 빠져 있거나, 숫자여야 할 자리에 문자열이 오거나, 형식이 어긋날 수 있다. 이런 데이터를 함수 곳곳에서 일일이 확인하는 대신, **데이터가 들어오는 경계에서 한 번에 검증**하면 깔끔하다. Pydantic은 바로 그 일을, 우리가 이미 쓰는 타입 힌트만으로 해 준다. 앞서 FastAPI가 요청 본문을 검증할 때 쓴 그 도구다.

## 모델 = 데이터의 모양 + 검증 규칙

Pydantic의 출발점은 `BaseModel`을 상속한 클래스다. 필드에 타입 힌트를 붙이는 것만으로 "이런 모양이어야 한다"는 규칙이 정의된다.

![모델 선언 = 검증 규칙](/assets/posts/python-pydantic-validation-model.svg)

```python
from pydantic import BaseModel, Field

class User(BaseModel):
    name: str
    age: int = Field(ge=0)        # 0 이상
    email: str | None = None       # 선택 필드

user = User(name="민수", age=30)
print(user.name, user.age)         # 민수 30
```

기본값이 없는 `name`은 필수이고, 기본값을 준 `email`은 선택이다. `Field(ge=0)`처럼 제약을 붙이면 "0 이상"이라는 조건까지 검사한다. 데이터의 구조와 검증 규칙이 한 곳에 모여 있어, 이 클래스만 보면 어떤 데이터를 기대하는지 한눈에 들어온다.

## 검증은 객체를 만들 때 일어난다

핵심은 모델 인스턴스를 만드는 그 순간 검증이 수행된다는 점이다. 통과하면 타입이 보장된 객체가 나오고, 실패하면 무엇이 왜 틀렸는지 알려 주는 예외가 발생한다.

![검증 성공과 실패의 두 갈래](/assets/posts/python-pydantic-validation-parse-flow.svg)

```python
from pydantic import ValidationError

raw = {"name": "민수", "age": "30"}      # age가 문자열 "30"
user = User(**raw)
print(user.age, type(user.age))          # 30 <class 'int'>  ← 자동 형변환

try:
    User(name="민수", age=-5)            # 제약 위반
except ValidationError as e:
    print(e)                              # age: greater than or equal to 0
```

`age`에 문자열 `"30"`이 들어와도 Pydantic이 정수 `30`으로 **자동 변환**해 준다. 반면 `age=-5`처럼 제약을 어기거나 타입을 맞출 수 없으면 `ValidationError`가 발생하며, 어떤 필드가 어떤 규칙을 어겼는지 구조화된 정보로 알려 준다. JSON 문자열은 `User.model_validate_json(...)`으로 곧장 검증할 수 있다.

## 경계에서 한 번, 안에서는 안심

이 방식의 진짜 가치는 검증을 **경계 한 곳으로 모은다**는 데 있다. 데이터가 들어오는 입구에서 모델로 한 번 걸러 두면, 그 뒤의 코드에서는 값이 올바르다는 것을 믿고 로직에만 집중할 수 있다.

```python
def process(raw: dict):
    user = User(**raw)          # 여기서 검증 (틀리면 즉시 실패)
    # 이 아래로는 user.age가 0 이상의 int임이 보장됨
    return f"{user.name}({user.age})"
```

`if not isinstance(...)`, `if value is None` 같은 방어 코드가 함수마다 흩어지지 않고, 입구의 모델 정의 하나로 대체된다. 잘못된 데이터는 안으로 들어오기 전에 막히므로, 깊은 곳에서 엉뚱한 값 때문에 터지는 일이 크게 준다.

## 객체를 다시 dict·JSON으로

검증만큼 자주 쓰는 것이 반대 방향, 즉 모델 객체를 다시 직렬화하는 일이다. API 응답을 만들거나 저장할 때 쓴다.

```python
user.model_dump()         # → {"name": "민수", "age": 30, "email": None}
user.model_dump_json()    # → '{"name":"민수","age":30,"email":null}'
```

`model_dump()`는 딕셔너리로, `model_dump_json()`은 JSON 문자열로 바꿔 준다. 받을 때는 검증하고 보낼 때는 직렬화하는 이 두 방향을 한 모델로 처리하니, 데이터의 안과 밖을 잇는 일관된 통로가 된다. (Pydantic v1을 쓴다면 `dict()`, `json()`, `parse_obj()` 등 이름이 다르니 버전을 확인하자.)

Pydantic의 핵심은 "검증을 타입으로 선언한다"는 한 문장이다. 모델 하나에 데이터의 모양과 규칙을 모아 두고, 경계에서 한 번 걸러 안쪽을 안전하게 만든다. FastAPI가 이것을 기본으로 채택한 이유이기도 하다. 다음 글에서는 비슷한 일을 다른 철학으로 풀어 온 또 하나의 검증·직렬화 라이브러리, marshmallow를 살펴본다.

---

**지난 글:** [requests vs httpx: HTTP 클라이언트 고르기](/posts/python-requests-vs-httpx/)

**다음 글:** [marshmallow: 스키마 기반 직렬화](/posts/python-marshmallow/)

<br>
읽어주셔서 감사합니다. 😊
