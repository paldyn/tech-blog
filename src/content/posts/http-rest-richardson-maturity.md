---
title: "Richardson 성숙도 모델 — REST의 4단계"
description: "Leonard Richardson의 4단계 성숙도 모델로 POX부터 HATEOAS까지 REST API의 수준을 단계별로 분석하고, 현실의 API가 Level 2에 머무는 이유를 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["REST", "RichardsonMaturityModel", "HATEOAS", "HTTP", "API설계", "하이퍼미디어", "RESTful"]
featured: false
draft: false
---

[지난 글](/posts/http-rest-principles/)에서 자원·표현·무상태라는 REST의 핵심 원칙을 정리했다. 그런데 "이 API는 RESTful한가?"라는 질문은 예/아니오로 딱 떨어지지 않는다. 현실의 API는 REST 원칙을 부분적으로만 따르는 경우가 대부분이다. 이 **정도(degree)**를 단계로 나눠 측정하자는 것이 Leonard Richardson이 2008년 QCon에서 제안한 **Richardson 성숙도 모델(Richardson Maturity Model, RMM)**이다. Martin Fowler가 이를 글로 정리하면서 널리 알려졌다.

## 모델의 큰 그림

RMM은 API가 HTTP를 얼마나 충실히 활용하는지를 0~3의 네 단계로 나눈다. 각 단계는 이전 단계 위에 한 가지 요소를 더한다. **자원** 분리, **HTTP 동사**의 의미, 그리고 **하이퍼미디어** 컨트롤이다.

![Richardson 성숙도 모델 4단계](/assets/posts/http-rmm-levels.svg)

Fowler는 Level 1·2·3 세 단계를 모두 충족했을 때를 "**The Glory of REST**"라고 불렀다. 즉 Roy Fielding이 정의한 의미의 REST는 사실상 Level 3을 가리킨다. 하지만 실무에서 "REST API"라고 부르는 것의 거의 전부는 Level 2다.

## Level 0 — POX / RPC 터널

가장 낮은 단계는 HTTP를 **단순한 전송 터널**로만 쓴다. 엔드포인트는 보통 하나뿐이고, 모든 요청은 POST로 그 한 곳에 보낸다. 무엇을 할지는 본문(payload)에 담는다. XML-RPC, SOAP, 그리고 옛날식 "POX(Plain Old XML)" 서비스가 여기 속한다.

```http
POST /bookingService HTTP/1.1
Host: api.example.com
Content-Type: application/xml

<getSlots><date>2026-06-20</date></getSlots>
```

조회든 생성이든 같은 URI에 POST로 보내고, 동작 이름은 본문 안에 있다. 응답은 성공·실패와 무관하게 대부분 `200 OK`이며, 오류 역시 본문에 담아 보낸다. HTTP의 메서드도 상태코드도 의미 없이 무시되는, 사실상 "HTTP 위의 RPC"다.

## Level 1 — 자원 분리

Level 1은 거대한 단일 엔드포인트를 **여러 자원(URI)으로 쪼갠다**. 예약 슬롯은 `/slots`, 예약은 `/reservations`처럼 각 개념이 자기 주소를 갖는다.

```http
POST /slots/12 HTTP/1.1
Content-Type: application/json

{ "action": "reserve" }
```

분할정복의 이점은 크다. "이 슬롯에 무언가를 한다"는 식으로 대화 단위가 작아진다. 다만 아직 **동사는 본문이나 URI에 들어 있다.** `POST /slots/12`에 `action: reserve`처럼 동작을 명시한다. HTTP 메서드의 표준 의미는 여전히 활용하지 않는다.

## Level 2 — HTTP 동사와 상태코드

Level 2부터 진짜 HTTP를 쓴다. 자원에 대한 동작을 **HTTP 메서드의 의미**로 표현한다. 조회는 `GET`, 생성은 `POST`, 교체는 `PUT`, 삭제는 `DELETE`. 그리고 결과는 **상태코드의 의미**로 돌려준다. 성공한 조회는 `200`, 생성은 `201 Created`, 충돌은 `409`, 없는 자원은 `404`.

![같은 작업의 레벨별 HTTP 표현](/assets/posts/http-rmm-request-evolution.svg)

```http
GET /slots?date=2026-06-20 HTTP/1.1
→ 200 OK
[ { "id": 12, "time": "14:00", "available": true } ]

POST /slots/12/reservations HTTP/1.1
{ "name": "PALDYN" }
→ 201 Created
Location: /reservations/77
```

이 단계의 가치는 **HTTP 인프라와의 협업**에 있다. `GET`은 안전(safe)하고 멱등(idempotent)하므로 캐시·프록시·CDN이 자유롭게 캐싱할 수 있고, `PUT`/`DELETE`의 멱등성 덕분에 클라이언트가 안전하게 재시도할 수 있다. 상태코드는 사람과 기계 모두에게 일관된 결과 어휘를 제공한다.

세상에서 "RESTful API"라고 부르는 것의 절대다수가 정확히 여기, Level 2에 있다.

## Level 3 — HATEOAS

마지막 단계는 응답에 **하이퍼미디어 컨트롤**, 즉 다음에 할 수 있는 행동을 가리키는 **링크**를 포함한다. 이것이 HATEOAS(Hypermedia As The Engine Of Application State)다.

```json
{
  "id": 77,
  "status": "confirmed",
  "_links": {
    "self":   { "href": "/reservations/77" },
    "cancel": { "href": "/reservations/77", "method": "DELETE" },
    "payment":{ "href": "/reservations/77/payment" }
  }
}
```

핵심은 **클라이언트가 URI 구조를 하드코딩하지 않는다**는 것이다. 서버가 "지금 이 예약에서 가능한 행동은 취소와 결제"라고 응답에 담아 알려주면, 클라이언트는 링크의 `rel`(self·cancel·payment) 같은 의미만 알면 된다. 결제가 끝난 예약에는 `cancel` 링크가 사라질 것이고, 클라이언트는 별도 분기 없이 "있는 링크만 따라가면" 된다. 서버는 URI 구조나 워크플로를 클라이언트를 깨뜨리지 않고 진화시킬 수 있다. 이것이 Fielding이 말한 "hypermedia as the engine of application state"의 본뜻이다.

## 왜 현실은 Level 2에 머무는가

Level 3의 가치는 분명하지만 비용도 분명하다.

- **클라이언트 복잡도**: 링크를 동적으로 해석하는 하이퍼미디어 클라이언트는, URI를 알고 호출하는 코드보다 만들기 어렵다. 대부분의 프런트엔드는 어차피 특정 백엔드에 맞춰 개발·배포되므로 동적 발견의 이점이 작다.
- **표준화 미흡**: 링크를 어디에 어떤 형식으로 넣을지(HAL, JSON:API, Siren 등)가 난립한다. 합의된 단일 표준이 없다.
- **즉각적 보상 부족**: Level 2까지의 이점(캐싱·멱등성·상태코드)은 바로 체감되지만, HATEOAS의 진가는 API가 장기간 진화할 때 드러난다. 짧은 개발 주기에서는 투자 회수가 느리다.

그래서 대다수 팀은 Level 2에서 멈춘다. 그리고 그것은 **나쁜 선택이 아니다.** Fowler조차 RMM은 "REST를 이해하는 도구이지, 반드시 Level 3에 도달해야 한다는 등급표가 아니다"라고 말했다. 공개 API, 장수명 플랫폼, 다양한 클라이언트가 붙는 경우라면 Level 3의 비용이 정당화되지만, 통제된 단일 클라이언트 환경에서는 Level 2가 합리적인 균형점이다.

## 정리

RMM은 "RESTful인가?"를 단계로 환원해 생각을 정리해준다. Level 0은 HTTP를 터널로만 쓰고, Level 1은 자원을 나누며, Level 2는 메서드와 상태코드의 의미를 살리고, Level 3은 하이퍼미디어로 상태를 전이한다. 자신의 API가 어느 단계에 있는지, 그리고 한 단계 올라갈 가치가 비용을 넘는지를 묻는 것이 이 모델의 실용적 쓰임이다.

---

**지난 글:** [REST 원칙 — 자원, 표현, 무상태](/posts/http-rest-principles/)

**다음 글:** [GraphQL over HTTP — 단일 엔드포인트의 설계](/posts/http-graphql-over-http/)

<br>
읽어주셔서 감사합니다. 😊
