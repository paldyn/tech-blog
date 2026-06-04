---
title: "FastAPI 기초: 타입 힌트로 만드는 API"
description: "타입 힌트를 그대로 검증과 문서화에 활용하는 현대적 웹 프레임워크 FastAPI. 경로·쿼리 파라미터, Pydantic 요청 본문, 자동 생성되는 대화형 문서까지 핵심을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["FastAPI", "API", "타입힌트", "Pydantic", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-django-orm-basics/)에서 데이터베이스를 파이썬 클래스로 다루는 ORM을 봤다면, 이번엔 그 데이터를 외부에 노출하는 API를 짓는 또 다른 방식을 본다. FastAPI는 비교적 최근에 등장했지만 빠르게 표준의 자리에 올랐다. 그 비결은 단순하다. 우리가 이미 쓰고 있는 **파이썬 타입 힌트**를 검증·형변환·문서화에 그대로 재활용한다는 것이다. 타입을 적는 노력 하나로 여러 가지 일이 공짜로 따라온다.

## 첫 엔드포인트

기본 구조는 Flask와 닮았지만, 비동기와 타입이 처음부터 자연스럽게 녹아 있다.

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello, FastAPI"}
```

데코레이터가 `@app.route` 대신 `@app.get`, `@app.post`처럼 HTTP 메서드별로 나뉘어 있어 의도가 또렷하다. 반환한 딕셔너리는 자동으로 JSON 응답이 된다. 실행은 ASGI 서버인 uvicorn으로 한다.

```bash
uvicorn main:app --reload
```

## 타입 힌트가 검증이 된다

FastAPI의 핵심은 함수 매개변수에 붙인 타입 힌트가 단순한 주석이 아니라 **실제로 동작한다**는 점이다.

![타입 힌트 하나가 세 가지 일을 한다](/assets/posts/python-fastapi-basics-type-flow.svg)

```python
@app.get("/items/{item_id}")
async def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}
```

`item_id: int`라고 적어 두면 세 가지가 자동으로 일어난다. 첫째, `/items/abc`처럼 정수로 바꿀 수 없는 값이 오면 FastAPI가 직접 `422` 오류로 거른다. 둘째, `/items/3`의 `"3"`은 함수 안에서 정수 `3`으로 변환되어 들어온다. 셋째, 이 타입 정보가 자동 문서에 그대로 반영된다. `q: str | None = None`처럼 기본값을 주면 그 파라미터는 선택적인 쿼리 스트링이 된다.

## 요청 본문은 Pydantic 모델로

POST로 JSON을 받을 때는 Pydantic 모델로 본문의 모양을 선언한다. 그러면 들어온 JSON이 그 모델에 맞는지 검증된 뒤, 검증을 통과한 객체만 함수로 전달된다.

![요청 본문 → Pydantic 모델 검증](/assets/posts/python-fastapi-basics-request-body.svg)

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: int
    in_stock: bool = True

@app.post("/items/")
async def create_item(item: Item):
    return {"name": item.name, "total": item.price}
```

요청 본문에 `name`이 빠졌거나 `price`에 숫자가 아닌 값이 오면, 함수가 실행되기도 전에 FastAPI가 친절한 오류 메시지와 함께 거절한다. 함수 안에서는 `item.price`가 정수임이 보장되므로, "값이 있나?", "숫자 맞나?" 같은 방어 코드가 통째로 사라진다.

## 공짜로 따라오는 대화형 문서

타입과 모델을 적어 두면 FastAPI는 OpenAPI 명세를 자동 생성하고, 그것을 바탕으로 대화형 문서 페이지까지 띄워 준다.

```text
http://127.0.0.1:8000/docs    → Swagger UI (직접 호출해 볼 수 있음)
http://127.0.0.1:8000/redoc   → ReDoc (읽기 좋은 문서)
```

별도 설정 없이 `/docs`에 들어가면 모든 엔드포인트, 파라미터 타입, 요청·응답 구조가 정리되어 있고, 브라우저에서 바로 호출해 볼 수도 있다. 문서를 따로 관리하지 않아도 코드와 항상 일치하는 문서가 유지된다는 점이 협업에서 특히 강력하다.

FastAPI의 철학은 "타입을 한 번 적으면 검증·변환·문서가 자동으로 따라온다"로 요약된다. 표준 타입 힌트 위에 세워졌기에 새로운 문법을 익힐 부담이 적고, 비동기를 기본으로 지원해 성능도 좋다. 그런데 이 모든 것을 굴리려면 ASGI 서버가 필요하다. 다음 글에서는 그 서버인 uvicorn과, FastAPI를 떠받치는 ASGI라는 규약을 들여다본다.

---

**지난 글:** [Django ORM 기초: 모델로 DB 다루기](/posts/python-django-orm-basics/)

**다음 글:** [uvicorn과 ASGI: 비동기 서버의 토대](/posts/python-uvicorn-asgi/)

<br>
읽어주셔서 감사합니다. 😊
