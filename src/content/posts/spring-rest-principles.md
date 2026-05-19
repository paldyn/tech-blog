---
title: "REST API 설계 원칙 — URI·메서드·표현의 일관성"
description: "Roy Fielding이 제시한 REST 6가지 제약조건부터 Richardson 성숙도 모델, URI 설계 규칙, HTTP 메서드 의미론, Stateless 통신까지 Spring 기반 REST API 설계의 근본 원칙을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "REST", "API설계", "URI", "HTTP", "Stateless", "HATEOAS", "RichardsonMaturityModel"]
featured: false
draft: false
---

[지난 글](/posts/springboot-transaction-best-practice/)에서 `@Transactional` 실전 가이드를 마무리했습니다. 이제 시리즈의 다음 장인 **REST API 설계**로 넘어갑니다. Spring으로 REST API를 만드는 방법은 이미 알고 있더라도, '왜 이렇게 설계해야 하는가'라는 질문에 답하려면 REST의 원칙부터 이해해야 합니다. 인터넷에 수많은 API가 "RESTful"을 자처하지만, 그 중 Roy Fielding이 정의한 REST를 실제로 충족하는 API는 드뭅니다. 이 글에서는 REST가 무엇인지, 어떤 제약조건을 충족해야 하는지, 그리고 Spring에서 원칙을 지키는 API를 어떻게 만드는지 살펴봅니다.

## REST란 무엇인가

REST(Representational State Transfer)는 2000년 Roy Fielding의 박사 논문에서 처음 소개된 **분산 하이퍼미디어 시스템을 위한 아키텍처 스타일**입니다. 프로토콜이나 표준 규격이 아니라 아키텍처 제약조건의 집합입니다. 이 제약조건을 모두 충족하는 시스템을 "RESTful"이라고 부릅니다.

핵심은 **'리소스'** 개념입니다. 서버의 모든 데이터는 URI로 식별되는 리소스이며, 클라이언트는 HTTP 표준 메서드로 그 리소스의 표현(Representation)을 주고받습니다. 클라이언트가 보는 것은 리소스 자체가 아닌 특정 형식(JSON, XML, HTML)으로 표현된 리소스의 상태(State)입니다. Transfer는 그 상태를 전송하는 행위를 뜻합니다.

## 6가지 제약조건

Fielding은 다음 여섯 가지 제약조건을 모두 충족해야 RESTful이라고 정의했습니다.

![REST 6가지 제약조건](/assets/posts/spring-rest-principles-constraints.svg)

**Client-Server** 제약은 UI와 데이터 저장소를 분리합니다. 덕분에 서버를 변경해도 클라이언트가 영향을 받지 않고, 클라이언트를 변경해도 서버가 바뀌지 않습니다. 모바일 앱·웹 브라우저·서드파티가 같은 서버를 공유할 수 있는 것도 이 원칙 덕분입니다.

**Stateless** 제약은 서버가 클라이언트의 세션 상태를 저장하지 않는다는 의미입니다. 모든 요청은 처리에 필요한 정보를 자체적으로 포함해야 합니다. 서버 장애 후 다른 서버로 요청이 라우팅되더라도 정상 처리되고, 부하분산이 자연스럽게 가능한 이유가 여기 있습니다. 인증 정보는 세션 대신 JWT 같은 토큰으로 매 요청에 포함합니다.

**Cacheable** 제약은 응답이 캐시 가능 여부를 명시하도록 요구합니다. 캐시 가능한 응답을 클라이언트나 중간 계층이 재사용하면 요청 수가 줄고 응답 속도가 빨라집니다. HTTP의 `Cache-Control`, `ETag`, `Last-Modified` 헤더가 이 제약을 구현하는 수단입니다.

**Uniform Interface**는 REST를 다른 아키텍처와 구별 짓는 핵심 제약입니다. 네 가지 하위 원칙으로 구성됩니다. ① URI로 리소스를 식별한다 ② 표현(JSON/XML)을 통해 리소스를 조작한다 ③ 메시지는 자기 서술적(Self-descriptive)이어야 한다 ④ HATEOAS — 응답에 다음 행동 가능한 링크를 포함한다.

**Layered System**은 클라이언트가 직접 서버와 통신하는지, 프록시·게이트웨이·CDN을 거치는지 알 수 없도록 한다는 의미입니다. 중간 계층을 자유롭게 추가하거나 교체할 수 있어 보안·확장성이 향상됩니다.

**Code on Demand**(선택적)는 서버가 실행 가능한 코드(JavaScript 등)를 클라이언트에 전달해 기능을 동적으로 확장하는 것을 허용합니다. 유일하게 선택적 제약입니다.

## Richardson 성숙도 모델

실제 업무에서 레벨 3까지 완전히 구현하기는 어렵습니다. Richardson Maturity Model은 REST 충족 정도를 Level 0~3으로 나눠 현실적 기준을 제시합니다.

![Richardson 성숙도 모델](/assets/posts/spring-rest-principles-maturity.svg)

대부분의 실무 API는 **Level 2** 수준입니다. 적절한 URI와 HTTP 메서드를 사용하고 상태 코드를 올바르게 반환하면 Level 2로 평가됩니다. **Level 3(HATEOAS)**는 응답 본문에 관련 리소스 링크를 포함하는 방식으로, Spring HATEOAS 라이브러리가 지원하지만 구현 복잡도가 높아 선택적으로 도입합니다.

## URI 설계 원칙

URI는 **리소스를 식별**하는 이름입니다. 행위(동사)가 아니라 리소스(명사)를 표현해야 합니다.

```
# 잘못된 패턴 — 동사를 URI에 넣지 않는다
GET  /getUsers
POST /createOrder
DELETE /deleteProduct/1

# 올바른 패턴 — 명사 + 복수형
GET    /users
POST   /users
DELETE /products/1
```

다음 규칙을 지키면 일관성 있는 URI 체계를 만들 수 있습니다.

1. **명사, 복수형**을 사용합니다: `/users`, `/orders`, `/products`
2. **소문자와 하이픈**을 사용합니다: `/order-items` (밑줄·대문자 금지)
3. **계층 관계**를 경로로 표현합니다: `/users/{id}/orders`
4. **필터·검색**은 쿼리 파라미터로 표현합니다: `/users?role=admin&status=active`
5. CRUD 외 행위는 **명사화**합니다: `POST /orders/{id}/cancel`

## HTTP 메서드의 의미론

HTTP 메서드는 리소스에 수행하는 행위를 표현합니다. 의미를 지켜야 클라이언트와 서버 사이의 계약이 성립됩니다.

```java
// Spring Controller — HTTP 메서드별 매핑 예시
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping          // 컬렉션 조회 (safe, idempotent)
    public List<UserDto> list() { ... }

    @GetMapping("/{id}") // 단건 조회 (safe, idempotent)
    public UserDto get(@PathVariable Long id) { ... }

    @PostMapping         // 생성 (not idempotent → 201 Created)
    public ResponseEntity<UserDto> create(@RequestBody CreateUserRequest req) { ... }

    @PutMapping("/{id}") // 전체 교체 (idempotent)
    public UserDto replace(@PathVariable Long id,
                           @RequestBody ReplaceUserRequest req) { ... }

    @PatchMapping("/{id}") // 부분 수정
    public UserDto update(@PathVariable Long id,
                          @RequestBody UpdateUserRequest req) { ... }

    @DeleteMapping("/{id}") // 삭제 (idempotent → 204 No Content)
    public ResponseEntity<Void> delete(@PathVariable Long id) { ... }
}
```

**멱등성(Idempotent)** 개념이 중요합니다. GET·PUT·DELETE는 같은 요청을 여러 번 보내도 결과가 동일해야 합니다. POST는 매번 새 리소스를 만들므로 멱등하지 않습니다. 네트워크 재시도 전략을 설계할 때 이 차이가 중요합니다.

## Stateless 설계 — 서버에 상태 두지 않기

세션 기반 인증은 REST의 Stateless 제약을 위반합니다. RESTful API에서는 매 요청에 인증 정보를 포함해야 합니다.

```java
// 잘못된 패턴 — 서버에 세션 저장 (Stateless 위반)
// HttpSession에 사용자 ID를 저장하고 다음 요청에서 꺼냄

// 올바른 패턴 — JWT로 자기 완결적 요청
// Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
@GetMapping("/me")
public UserDto getCurrentUser(
        @RequestHeader("Authorization") String bearerToken) {
    // 토큰 검증 후 사용자 정보 반환 — DB나 캐시 없이 토큰 자체로 식별
    String token = bearerToken.replace("Bearer ", "");
    Long userId = jwtProvider.extractUserId(token);
    return userService.findById(userId);
}
```

세션 대신 JWT나 OAuth2 Access Token을 사용하면 서버를 여러 대로 수평 확장할 때 세션 공유 문제가 발생하지 않습니다.

## 표현 형식과 Content Negotiation

REST에서 클라이언트는 원하는 표현 형식을 `Accept` 헤더로 요청하고, 서버는 `Content-Type` 헤더로 실제 형식을 알립니다.

```java
// Spring은 기본으로 JSON, XML 등 콘텐츠 협상 지원
@GetMapping(value = "/users/{id}",
            produces = {MediaType.APPLICATION_JSON_VALUE,
                        MediaType.APPLICATION_XML_VALUE})
public UserDto getUser(@PathVariable Long id) {
    return userService.findById(id);
}
// 요청: Accept: application/xml → XML 응답
// 요청: Accept: application/json → JSON 응답
```

Spring Boot는 기본적으로 `jackson-databind`를 통해 JSON을, `jackson-dataformat-xml`을 추가하면 XML을 직렬화합니다.

## 설계 원칙 요약

REST API를 설계할 때 다음 질문을 자문하면 원칙에서 벗어나지 않을 수 있습니다.

```
1. URI에 동사가 포함되어 있지는 않은가?
2. HTTP 메서드의 의미와 실제 행위가 일치하는가?
3. 서버가 클라이언트 상태를 저장하고 있지는 않은가?
4. 응답에 적절한 Cache-Control 헤더를 설정했는가?
5. 오류가 발생했을 때 의미 있는 HTTP 상태 코드를 반환하는가?
```

Level 2(HTTP Verbs) 수준의 REST만 충족해도 클라이언트·서버 독립성·확장성·캐시 활용이라는 주요 이점을 대부분 얻을 수 있습니다. HATEOAS(Level 3)는 복잡도 대비 이점을 판단해서 도입 여부를 결정하면 됩니다.

다음 글에서는 REST API에서 **HTTP 상태 코드를 언제, 어떻게 반환해야 하는지** 구체적으로 살펴봅니다.

---

**지난 글:** [Spring Boot 트랜잭션 베스트 프랙티스 — @Transactional 실전 가이드](/posts/springboot-transaction-best-practice/)

**다음 글:** [REST API HTTP 상태 코드 — 언제 무엇을 반환해야 하는가](/posts/spring-rest-http-status/)

<br>
읽어주셔서 감사합니다. 😊
