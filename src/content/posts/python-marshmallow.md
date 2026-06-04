---
title: "marshmallow: 스키마 기반 직렬화"
description: "Schema 클래스로 직렬화와 역직렬화를 다루는 marshmallow. load와 dump의 두 방향, 필드 검증, 그리고 Pydantic과의 차이까지 데이터 변환 라이브러리의 또 다른 접근을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["marshmallow", "직렬화", "검증", "스키마", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pydantic-validation/)에서 타입 힌트로 데이터를 검증하는 Pydantic을 봤다. 그런데 같은 문제 — 바깥 데이터를 검증하고, 안쪽 객체를 다시 내보내는 일 — 를 다른 방식으로 풀어 온 라이브러리가 있다. 바로 marshmallow다. Pydantic이 등장하기 전부터 Flask 생태계에서 널리 쓰였고, 지금도 많은 코드베이스에 살아 있다. 핵심 발상은 데이터의 구조를 **Schema**라는 클래스에 따로 선언하고, 그 스키마로 양방향 변환을 처리한다는 것이다.

## Schema: 필드를 명시적으로 선언

marshmallow에서는 `Schema`를 상속해 각 필드를 `fields`로 적는다. Pydantic처럼 타입 힌트를 재활용하는 대신, 필드 객체를 명시적으로 나열하는 점이 다르다.

```python
from marshmallow import Schema, fields

class UserSchema(Schema):
    name = fields.Str(required=True)
    age = fields.Int(required=True)
    email = fields.Email(missing=None)   # 선택, 기본값 None

schema = UserSchema()
```

`fields.Str`, `fields.Int`, `fields.Email`처럼 타입별 필드를 쓰고, `required=True`로 필수 여부를, `missing`으로 기본값을 정한다. `Email` 같은 전용 필드는 형식 검증까지 내장하고 있다. 데이터 구조가 스키마 클래스 하나에 또렷하게 모인다.

## load와 dump: 두 방향

marshmallow의 모델을 이해하는 핵심은 두 메서드다. `load`는 바깥 데이터를 받아 검증·역직렬화하고, `dump`는 안쪽 객체를 바깥으로 내보낼 형태로 직렬화한다.

![load와 dump: 두 방향의 변환](/assets/posts/python-marshmallow-load-dump.svg)

```python
# load: 들어올 때 — 검증하고 파이썬 값으로
raw = {"name": "민수", "age": "30", "email": "a@b.com"}
data = schema.load(raw)
# {"name": "민수", "age": 30, "email": "a@b.com"}  ← age가 int로

# dump: 나갈 때 — 객체를 직렬화 가능한 형태로
output = schema.dump(data)
# {"name": "민수", "age": 30, "email": "a@b.com"}
```

`load`는 들어온 데이터의 타입을 맞추고 규칙을 검사한다. `age`의 `"30"`이 정수 `30`으로 변환되는 것도 이때 일어난다. 반대로 `dump`는 데이터베이스 모델이나 객체를 받아 JSON으로 보내기 좋은 딕셔너리로 바꾼다. 이 "받을 때 load, 보낼 때 dump"의 방향 구분이 marshmallow의 멘탈 모델 전부라고 해도 좋다.

## 검증 실패는 ValidationError로

`load` 과정에서 규칙을 어기면 `ValidationError`가 발생하고, 어떤 필드가 왜 틀렸는지 딕셔너리로 모아 알려 준다.

```python
from marshmallow import ValidationError

try:
    schema.load({"age": "not-a-number"})   # name 누락 + age 타입 오류
except ValidationError as err:
    print(err.messages)
    # {'name': ['Missing data for required field.'],
    #  'age': ['Not a valid integer.']}
```

여러 필드의 오류를 한꺼번에 모아서 보고하므로, 폼이나 API 요청을 검증할 때 사용자에게 어디를 고쳐야 하는지 한 번에 전달하기 좋다.

## marshmallow냐 Pydantic이냐

둘은 결국 같은 일을 한다. 그렇다면 선택의 기준은 무엇일까?

![marshmallow vs Pydantic](/assets/posts/python-marshmallow-vs-pydantic.svg)

marshmallow는 스키마를 데이터 모델과 분리해 두므로, 하나의 객체를 상황에 따라 다른 스키마로 직렬화하기 좋다. Flask 생태계와의 오랜 궁합, `flask-marshmallow`나 SQLAlchemy 연동도 잘 갖춰져 있다. 반면 Pydantic은 타입 힌트가 곧 스키마라 코드가 간결하고, v2는 Rust 코어로 속도가 빠르며 IDE 자동완성과도 잘 맞는다. FastAPI가 기본으로 채택한 덕에 최근 신규 프로젝트의 사실상 표준이 되었다.

정리하면, 이미 Flask와 marshmallow로 짜인 코드라면 굳이 갈아탈 이유는 적고, 명시적 스키마와 유연한 직렬화가 필요할 때 여전히 좋은 선택이다. 새로 시작하거나 타입 힌트 중심으로 가고 싶다면 Pydantic이 더 자연스럽다. 두 도구 모두 "데이터의 경계를 스키마로 지킨다"는 같은 가치를 공유한다. 다음 글에서는 시간이 오래 걸리는 작업을 요청 흐름 밖으로 떼어 내 처리하는 비동기 작업 큐, Celery를 살펴본다.

---

**지난 글:** [Pydantic: 데이터 검증을 타입으로](/posts/python-pydantic-validation/)

**다음 글:** [Celery: 무거운 작업을 백그라운드로](/posts/python-celery-tasks/)

<br>
읽어주셔서 감사합니다. 😊
