---
title: "GraphQL over HTTP — 단일 엔드포인트의 설계"
description: "HTTP 관점에서 GraphQL을 살펴봅니다. 단일 POST 엔드포인트, 요청·응답 본문 형식, 200 + errors의 상태코드 모호성, 그리고 캐싱이 어려운 이유와 보완책까지 REST와 균형 있게 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["GraphQL", "HTTP", "REST", "API설계", "캐싱", "엔드포인트", "PersistedQueries"]
featured: false
draft: false
---

[지난 글](/posts/http-rest-richardson-maturity/)에서 REST가 HTTP를 얼마나 충실히 쓰는지를 0~3단계로 측정하는 Richardson 성숙도 모델을 살펴봤다. REST는 자원마다 URI를 부여하고 HTTP 메서드·상태코드의 의미를 그대로 빌려 쓰는 설계다. 그런데 같은 HTTP 위에서 정반대에 가까운 선택을 한 기술이 있다. **GraphQL**이다. GraphQL은 자원을 URI로 나누지 않고, 하나의 엔드포인트에 쿼리를 POST로 보낸다. 흥미로운 점은 이것이 Richardson 모델 기준으로는 오히려 Level 0(POX/RPC 터널)과 닮았다는 사실이다. 그렇다면 GraphQL은 후퇴일까? 이 글은 GraphQL을 "쿼리 언어"가 아니라 **HTTP 트랜스포트 위에서 어떻게 동작하는가**라는 관점에서 풀어 본다.

## 단일 엔드포인트라는 선택

REST API를 호출할 때 우리는 여러 URI를 오간다. 사용자 정보는 `GET /users/1`, 그 사용자의 글은 `GET /users/1/posts`, 글의 댓글은 `GET /posts/9/comments`처럼 자원마다 주소가 다르다. 화면 하나를 그리려면 여러 번 왕복해야 하고, 각 응답에는 지금 화면에 필요 없는 필드까지 들어 있다. 전자가 **under-fetching**(필요한 걸 다 못 받아서 추가 호출), 후자가 **over-fetching**(필요 이상으로 많이 받음)이다.

GraphQL은 이 구조를 뒤집는다. 엔드포인트는 보통 `POST /graphql` 단 하나다. 무엇을 가져올지는 URI가 아니라 **요청 본문에 담은 쿼리**가 결정한다. 클라이언트가 필요한 필드를 직접 적어 보내면, 서버는 그 모양 그대로 응답한다.

![REST 다중 엔드포인트와 GraphQL 단일 엔드포인트 비교](/assets/posts/http-graphql-vs-rest.svg)

핵심은 "응답의 모양을 누가 정하는가"가 서버에서 클라이언트로 넘어왔다는 점이다. 그래서 over/under-fetching이 구조적으로 줄어든다. 대신 HTTP의 라우팅·캐싱·상태코드 같은 장치들은 더 이상 자동으로 작동하지 않는다. 이 트레이드오프가 이 글 전체를 관통하는 주제다.

## 요청 본문 — query, variables, operationName

GraphQL 요청은 거의 언제나 `POST /graphql`에 `Content-Type: application/json`으로 보낸다. 본문 JSON에는 세 개의 표준 필드가 들어간다.

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json

{
  "query": "query($id: ID!) { user(id: $id) { name } }",
  "variables": { "id": 1 },
  "operationName": null
}
```

`query`는 실행할 GraphQL 문서다. `variables`는 쿼리 안의 변수(`$id`)에 바인딩할 값으로, 값을 쿼리 문자열에 직접 끼워 넣지 않게 해 주어 인젝션을 막고 쿼리 문자열을 재사용 가능하게 만든다. `operationName`은 한 문서에 여러 operation이 있을 때 어느 것을 실행할지 고르는 이름이며, 단일 operation이면 생략하거나 `null`이다.

응답의 미디어 타입에는 두 가지가 있다. 전통적으로 서버는 `application/json`을 돌려줬지만, [GraphQL over HTTP 명세](https://graphql.github.io/graphql-over-http/)는 `application/graphql-response+json`을 권장한다. 후자를 쓰면 클라이언트는 "이 응답은 GraphQL 규약을 따른다"고 신뢰할 수 있고, 서버가 HTTP 상태코드를 좀 더 적극적으로 활용할 여지도 생긴다.

## GET으로 쿼리 보내기

조회만 하는 쿼리(query operation)는 HTTP `GET`으로도 보낼 수 있다. 쿼리·변수를 쿼리 스트링에 실으면 된다.

```http
GET /graphql?query=%7Buser(id:1)%7Bname%7D%7D HTTP/1.1
Host: api.example.com
```

GET을 쓰는 이유는 단 하나, **캐싱**이다. GET 요청은 URL이 곧 캐시 키가 되므로 브라우저·CDN·프록시의 표준 HTTP 캐시가 그대로 동작한다. 다만 데이터를 바꾸는 mutation은 GET으로 보내면 안 된다. GET은 안전(safe)·멱등(idempotent)해야 한다는 HTTP 규약 때문이며, 프리페치나 재시도가 부작용을 일으킬 수 있다. 또 URL 길이 제한 탓에 큰 쿼리는 GET에 담기 어렵다. 이 한계가 뒤에 나올 persisted queries의 동기가 된다.

## 상태코드의 모호성 — 200 + errors

REST에서는 결과를 상태코드로 말한다. 없는 자원은 `404`, 권한 없음은 `403`, 충돌은 `409`다. GraphQL은 다르다. 전통적인 구현에서는 **요청이 GraphQL 서버에 도달해 파싱·실행되기만 하면, 필드 단위 에러가 있어도 HTTP `200 OK`를 돌려준다.** 성패는 응답 본문의 `errors` 배열로 판단한다.

![GraphQL HTTP 요청/응답 구조와 상태코드 모호성](/assets/posts/http-graphql-request-response.svg)

```json
{
  "data": { "user": null },
  "errors": [
    {
      "message": "User not found",
      "path": ["user"],
      "extensions": { "code": "NOT_FOUND" }
    }
  ]
}
```

왜 이렇게 설계했을까? GraphQL은 한 요청에서 **부분 성공**이 가능하기 때문이다. 한 쿼리로 여러 필드를 요청했을 때, 일부는 성공하고 일부만 실패할 수 있다. 그러면 `data`에는 성공한 부분이, `errors`에는 실패한 부분이 함께 담긴다. 이 상태를 단일 HTTP 상태코드 하나로 표현하기 어렵기 때문에 "전송은 성공(200), 의미는 본문 참조"라는 규약을 택한 것이다.

부작용도 분명하다. 모니터링·로깅 도구가 HTTP 상태코드만 보면 모든 게 정상으로 보이고, 클라이언트는 매번 본문을 파싱해야 에러를 알 수 있다. 그래서 GraphQL over HTTP 명세는 `application/graphql-response+json`을 쓸 때, 요청 자체가 잘못된 경우(파싱 실패 등)는 `400`을 돌려주도록 정리해 두었다. 인증 실패에 `401`을 쓰는 등 트랜스포트 레벨 오류에 적절한 상태코드를 부여하는 구현도 늘고 있다.

## 캐싱이 어려운 이유

REST가 가진 가장 큰 무기 중 하나는 **HTTP 캐싱**이다. `GET /posts/9`는 URL이 고정돼 있어 CDN·브라우저가 손쉽게 캐시하고, `ETag`·`Cache-Control`로 재검증까지 한다. GraphQL은 이 이점을 거의 잃는다. 이유는 두 가지다.

첫째, 요청이 `POST`다. HTTP 명세상 POST 응답은 기본적으로 캐시되지 않는다. 둘째, 모든 요청이 같은 URL(`/graphql`)로 가고, 실제 내용은 본문에 들어 있다. URL이 캐시 키 역할을 못 하므로 프록시·CDN 입장에서는 모든 요청이 똑같아 보인다.

그래서 GraphQL 생태계는 캐싱을 **다른 층위**로 옮겨 해결한다. 응답 전체를 URL 기준으로 캐시하는 대신, 각 객체에 전역 고유 ID를 부여해 클라이언트 측에서 **정규화 캐시(normalized cache)**를 운영한다(Apollo Client, Relay 등). 같은 `User:1`이 여러 쿼리에 등장해도 캐시에는 한 번만 저장되고, 다른 쿼리가 그 객체를 참조할 수 있다. HTTP 캐시를 잃은 대신 클라이언트 캐시를 얻은 셈이다.

## Batching과 Persisted Queries

POST·단일 URL 구조를 보완하는 두 가지 대표적 기법이 있다.

**Batching**은 여러 쿼리를 한 HTTP 요청에 묶는다. JSON 배열로 여러 operation을 보내면 서버가 한 번에 처리한다. 짧은 시간에 발생하는 다수의 작은 쿼리를 하나로 합쳐 왕복 횟수와 연결 오버헤드를 줄인다. 다만 배치 안의 한 쿼리가 느리면 전체 응답이 같이 늦어지는 단점이 있다.

**Persisted Queries(영속 쿼리)**는 쿼리 문서 전체 대신 그 **해시**만 보내는 기법이다.

```http
GET /graphql?extensions={"persistedQuery":{
  "version":1,
  "sha256Hash":"ecf4ed..."}}&variables={"id":1} HTTP/1.1
```

작동 방식은 이렇다. 클라이언트는 먼저 쿼리 해시만 보낸다. 서버가 그 해시를 알면 미리 등록된 쿼리를 실행한다. 모르면(`PersistedQueryNotFound`) 클라이언트가 전체 쿼리를 한 번 보내 등록하고, 이후로는 해시만 보낸다(Automatic Persisted Queries, APQ). 이점이 크다. 본문이 해시로 줄어들어 **GET 사용이 가능**해지고, 그러면 다시 **HTTP·CDN 캐싱**을 활용할 수 있다. 더 나아가 허용된 해시만 실행하도록 제한하면 임의 쿼리를 막는 보안 장치(allowlist)로도 쓸 수 있다.

## 그래서 REST와 GraphQL, 무엇을?

GraphQL은 HTTP의 자원·메서드·상태코드 모델을 일부러 우회하고, 그 대가로 클라이언트 주도의 정밀한 데이터 페칭을 얻었다. REST는 HTTP의 캐싱·라우팅·상태코드를 그대로 활용하는 대신 응답 모양의 유연성을 일부 포기한다. 우열의 문제가 아니라 **트레이드오프**다.

화면마다 필요한 데이터 모양이 천차만별이고 클라이언트(웹·모바일·다양한 버전)가 다양하다면 GraphQL의 유연성이 빛난다. 반대로 캐싱이 성능의 핵심이거나, 파일 다운로드처럼 자원-URI 매핑이 자연스럽거나, 단순하고 예측 가능한 API라면 REST가 더 잘 맞는다. [GraphQL over HTTP 명세](https://graphql.github.io/graphql-over-http/)는 이 기술이 HTTP 위에서 일관되게 동작하도록 미디어 타입과 상태코드 규약을 다듬고 있으니, GraphQL을 도입한다면 한 번 읽어 둘 가치가 있다.

다음 글에서는 다시 HTTP 본연으로 돌아와, 서버가 클라이언트에게 일방적으로 이벤트를 흘려보내는 **Server-Sent Events**를 다룬다.

---

**지난 글:** [Richardson 성숙도 모델 — REST의 4단계](/posts/http-rest-richardson-maturity/)

**다음 글:** [Server-Sent Events — 서버에서 흘려보내는 이벤트](/posts/http-server-sent-events/)

<br>
읽어주셔서 감사합니다. 😊
