---
title: "REST 원칙 — 자원, 표현, 무상태"
description: "Roy Fielding의 REST 정의와 6가지 아키텍처 제약, 자원·표현·URI의 분리, 균일 인터페이스 4요소를 통해 RESTful의 본질을 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["REST", "RESTful", "RoyFielding", "무상태", "HATEOAS", "균일인터페이스", "RESTvsRPC"]
featured: false
draft: false
---

[지난 글](/posts/http-multipart-form-data/)에서 파일 업로드를 위한 `multipart/form-data`의 내부 구조를 살펴봤다. 이번 글에서는 한 단계 위로 올라가, 우리가 매일 만드는 HTTP API의 설계 철학인 **REST(Representational State Transfer)** 의 원칙을 처음 정의된 그대로 정확히 짚어본다. "REST API"라는 말은 흔하지만, 그것이 무엇을 의미하는지는 자주 오해된다.

## REST는 누가, 무엇으로 정의했나

REST는 2000년 Roy Fielding의 박사 학위 논문 "Architectural Styles and the Design of Network-based Software Architectures"에서 정의됐다. Fielding은 HTTP/1.1과 URI 명세의 공동 저자이기도 하다. 즉 REST는 어떤 프레임워크나 라이브러리가 아니라 **웹이 왜 그렇게 잘 확장됐는가를 설명하는 아키텍처 스타일(architectural style)** 이다.

핵심을 한 문장으로 요약하면 이렇다. 클라이언트는 자원의 **표현(representation)** 을 주고받으며, 그 표현을 통해 애플리케이션의 **상태(state)** 를 전이(transfer)시킨다. 이름 "Representational State Transfer" 자체가 메커니즘을 그대로 담고 있다.

## 6가지 아키텍처 제약

REST는 추상적인 구호가 아니라 6개의 구체적인 **제약(constraint)** 의 집합이다. 이 제약들을 모두 따를 때 시스템은 확장성, 단순성, 가시성 같은 웹의 바람직한 속성을 얻는다.

![REST 6대 아키텍처 제약](/assets/posts/http-rest-constraints.svg)

1. **클라이언트-서버**: UI(클라이언트)와 데이터 저장(서버)의 관심사를 분리해 각각 독립적으로 진화시킨다.
2. **무상태(Stateless)**: 모든 요청은 처리에 필요한 정보를 스스로 담아야 한다. 서버는 요청 사이에 클라이언트의 세션 상태를 저장하지 않는다.
3. **캐시 가능(Cacheable)**: 응답은 자신이 캐시 가능한지 명시해야 하며, 가능하다면 클라이언트는 재사용해 불필요한 통신을 줄인다.
4. **균일 인터페이스(Uniform Interface)**: REST를 다른 스타일과 구분 짓는 중심 제약. 아래에서 4요소로 다시 나눈다.
5. **계층화 시스템(Layered System)**: 클라이언트는 자신이 최종 서버와 직접 통신하는지, 프록시·게이트웨이를 거치는지 알 수 없다.
6. **code-on-demand (선택)**: 서버가 실행 가능한 코드(예: JavaScript)를 보내 클라이언트 기능을 일시 확장할 수 있다. 유일하게 선택적인 제약이다.

무상태 제약은 특히 자주 깨진다. 서버 메모리에 로그인 세션을 들고 있는 방식은 엄밀히 말해 stateless가 아니다. 토큰처럼 요청마다 인증 정보를 함께 보내는 방식이 무상태 원칙에 부합한다.

## 자원, 표현, 그리고 식별자

REST의 핵심 추상은 **자원(resource)** 이다. 자원은 이름 붙일 수 있는 모든 정보다. 사용자, 주문, 오늘의 날씨처럼. 중요한 것은 자원과 그것을 표현하는 데이터를 명확히 구분하는 것이다.

- **자원**: 개념적인 대상 그 자체. 시간에 따라 값이 바뀌어도 동일한 자원이다.
- **식별자(URI)**: 자원을 가리키는 안정적인 이름. 예: `/users/42`
- **표현(representation)**: 특정 시점·특정 형식으로 직렬화된 자원의 스냅샷. JSON, XML, HTML 등.

![자원과 표현, 콘텐츠 협상](/assets/posts/http-rest-resource-representation.svg)

하나의 URI가 여러 표현을 가질 수 있고, 클라이언트는 `Accept` 헤더로 원하는 표현을 협상한다.

```http
GET /users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
```

같은 URI에 `Accept: application/xml`을 보내면 동일한 자원의 XML 표현을 받는다. URI는 형식이 아니라 자원을 가리킨다는 점이 핵심이다. 그래서 `/users/42.json`처럼 형식을 URI에 박아 넣는 설계는 REST 관점에서 권장되지 않는다.

## 균일 인터페이스의 4요소

균일 인터페이스는 다시 4개의 하위 제약으로 구성된다.

1. **자원의 식별**: 각 자원은 URI로 식별된다.
2. **표현을 통한 자원 조작**: 클라이언트는 표현(과 메타데이터)을 통해 자원을 생성·수정·삭제한다. 서버 내부 구조를 직접 다루지 않는다.
3. **self-descriptive 메시지**: 각 메시지는 스스로를 어떻게 처리해야 하는지에 필요한 정보를 담는다. `Content-Type`, 메서드, 상태코드가 그 예다. 중간 프록시도 메시지만 보고 캐시·라우팅을 판단할 수 있다.
4. **HATEOAS** (Hypermedia As The Engine Of Application State): 응답에 다음에 할 수 있는 행동을 링크로 포함해, 클라이언트가 하드코딩된 URI 규칙 없이 하이퍼미디어를 따라 상태를 전이한다.

```json
{
  "id": 42,
  "name": "Kim",
  "_links": {
    "self":   { "href": "/users/42" },
    "orders": { "href": "/users/42/orders" }
  }
}
```

HATEOAS는 실무에서 가장 덜 구현되는 요소지만, REST의 완성도를 가르는 결정적 기준이다.

## HTTP 메서드와 상태코드의 의미적 사용

균일 인터페이스를 HTTP 위에서 실현할 때, 메서드와 상태코드는 **의미(semantics)** 에 맞게 써야 한다. 동사를 URI에 넣지 말고 HTTP 메서드로 행위를 표현한다.

| 메서드 | 의미 | 안전 | 멱등 |
|--------|------|------|------|
| GET | 자원 조회 | O | O |
| POST | 하위 자원 생성·처리 | X | X |
| PUT | 자원 전체 교체 | X | O |
| PATCH | 자원 부분 수정 | X | X |
| DELETE | 자원 삭제 | X | O |

상태코드 역시 결과를 정확히 전달해야 한다. 생성에는 `201 Created`, 본문 없는 성공에는 `204 No Content`, 클라이언트 잘못에는 `4xx`, 서버 잘못에는 `5xx`. 모든 응답을 `200 OK`로 내려보내고 본문에 에러를 담는 방식은 self-descriptive 원칙을 위배한다.

```http
POST /users HTTP/1.1
Content-Type: application/json

{"name": "Kim"}

HTTP/1.1 201 Created
Location: /users/43
```

## REST vs RPC

REST를 가장 선명하게 이해하는 방법은 RPC(Remote Procedure Call) 스타일과 대비하는 것이다. RPC는 **동작(함수)** 을 호출하고, REST는 **자원** 을 다룬다.

```text
RPC 스타일 (동작 중심)
  POST /getUser?id=42
  POST /createUser
  POST /deleteUser?id=42

REST 스타일 (자원 중심)
  GET    /users/42
  POST   /users
  DELETE /users/42
```

RPC는 엔드포인트마다 새로운 동사를 만들어내므로 인터페이스가 균일하지 않다. REST는 한정된 메서드 집합을 자원에 균일하게 적용하므로 캐시, 프록시, 표준 도구가 그대로 동작한다. 이것이 바로 균일 인터페이스가 주는 이점이다.

## 정리하며

REST는 라이브러리가 아니라 6개 제약으로 정의된 아키텍처 스타일이며, 그 중심에는 자원·표현·URI의 분리와 균일 인터페이스가 있다. 무상태와 캐시 가능성이 확장성을 만들고, self-descriptive 메시지와 HATEOAS가 시스템의 진화 가능성을 높인다.

그런데 현실의 "REST API"는 이 원칙을 어느 정도까지 지키느냐가 제각각이다. 단순히 URL을 자원처럼 만든 수준부터 완전한 HATEOAS까지, 그 성숙도를 단계로 나눠 평가하는 모델이 있다. 다음 글에서는 **Richardson 성숙도 모델**로 REST의 4단계를 짚어본다.

---

**지난 글:** [multipart/form-data — 파일 업로드의 내부](/posts/http-multipart-form-data/)

**다음 글:** [Richardson 성숙도 모델 — REST의 4단계](/posts/http-rest-richardson-maturity/)

<br>
읽어주셔서 감사합니다. 😊
