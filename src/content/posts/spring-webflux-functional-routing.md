---
title: "함수형 엔드포인트: RouterFunction과 HandlerFunction"
description: "어노테이션 @Controller 대신 람다·함수형 스타일로 HTTP 엔드포인트를 정의하는 RouterFunction과 HandlerFunction의 사용법, 중첩 라우팅, ServerRequest/ServerResponse 처리, 필터 적용, 그리고 테스트 방법을 실전 코드로 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["RouterFunction", "HandlerFunction", "함수형 라우팅", "Spring WebFlux", "ServerRequest", "ServerResponse", "중첩 라우팅"]
featured: false
draft: false
---

[지난 글](/posts/spring-webflux-r2dbc/)에서 논블로킹 DB 접근을 위한 R2DBC를 살펴봤다. Spring WebFlux는 두 가지 프로그래밍 모델을 제공한다. 하나는 우리가 익숙한 어노테이션 기반 `@Controller`이고, 다른 하나는 이번 글에서 다루는 **함수형 엔드포인트(Functional Endpoints)** 방식이다. 함수형 방식은 라우팅 로직을 코드로 명확히 표현하고, 테스트와 조합이 더 쉽다는 장점이 있다.

## 핵심 구성요소

함수형 엔드포인트는 세 개의 인터페이스로 구성된다.

- `RouterFunction<ServerResponse>`: 요청을 어떤 핸들러로 보낼지 결정하는 라우팅 테이블
- `HandlerFunction<ServerResponse>`: 실제 요청을 처리하고 응답을 생성하는 함수
- `RequestPredicate`: 메서드, 경로, 헤더 등 요청 매칭 조건

`RouterFunction`이 `RequestPredicate`와 일치하는 요청을 `HandlerFunction`으로 위임하는 구조다.

![함수형 라우팅 구조](/assets/posts/spring-webflux-functional-routing-structure.svg)

## 기본 라우터와 핸들러

`RouterFunctions.route()`로 라우터를 빌드하고, 핸들러는 별도 컴포넌트로 분리하는 것이 일반적인 패턴이다.

```java
@Configuration
public class UserRouter {

    @Bean
    public RouterFunction<ServerResponse> userRoutes(UserHandler handler) {
        return RouterFunctions.route()
            .GET("/api/users",     handler::findAll)
            .GET("/api/users/{id}", handler::findById)
            .POST("/api/users",    handler::create)
            .PUT("/api/users/{id}", handler::update)
            .DELETE("/api/users/{id}", handler::delete)
            .build();
    }
}
```

핸들러는 `@Component`로 등록된 일반 스프링 빈이다. `ServerRequest`를 받아 `Mono<ServerResponse>`를 반환한다.

![RouterFunction &amp; HandlerFunction 코드](/assets/posts/spring-webflux-functional-routing-code.svg)

## ServerRequest에서 데이터 추출

`ServerRequest`는 요청의 모든 정보에 접근하는 단일 진입점이다.

```java
@Component
@RequiredArgsConstructor
public class UserHandler {

    private final UserService userService;

    public Mono<ServerResponse> create(ServerRequest req) {
        return req.bodyToMono(CreateUserRequest.class)         // body 역직렬화
            .switchIfEmpty(Mono.error(new BadRequestException("body required")))
            .flatMap(userService::create)
            .flatMap(created -> ServerResponse
                .created(URI.create("/api/users/" + created.id()))
                .bodyValue(created));
    }

    public Mono<ServerResponse> findAll(ServerRequest req) {
        // 쿼리 파라미터 추출
        Optional<String> nameOpt = req.queryParam("name");
        int page = Integer.parseInt(req.queryParam("page").orElse("0"));
        int size = Integer.parseInt(req.queryParam("size").orElse("20"));

        Flux<User> users = nameOpt
            .map(name -> userService.findByNameLike(name, page, size))
            .orElseGet(() -> userService.findAll(page, size));

        return ServerResponse.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body(users, User.class);
    }
}
```

## 중첩 라우팅 (nest)

`nest()`로 공통 경로 접두어나 공통 조건(헤더 등)을 그룹화할 수 있다. 여러 리소스의 라우터를 모듈별로 정의하고 최상위에서 조합하는 방식이 유지보수에 유리하다.

```java
@Bean
public RouterFunction<ServerResponse> apiRoutes(
    UserHandler userHandler,
    OrderHandler orderHandler
) {
    return RouterFunctions.route()
        .nest(path("/api/v1"), apiRouter ->
            apiRouter
                .nest(path("/users"),  userRouter(userHandler))
                .nest(path("/orders"), orderRouter(orderHandler))
        )
        .build();
}

private RouterFunction<ServerResponse> userRouter(UserHandler h) {
    return RouterFunctions.route()
        .GET("",      h::findAll)    // /api/v1/users
        .GET("/{id}", h::findById)   // /api/v1/users/{id}
        .POST("",     h::create)     // /api/v1/users
        .build();
}
```

## RouterFunction에 필터 적용

어노테이션 방식의 `HandlerInterceptor` 대신 `filter()`로 라우터 범위의 공통 처리를 적용한다.

```java
@Bean
public RouterFunction<ServerResponse> securedRoutes(UserHandler handler) {
    return RouterFunctions.route()
        .GET("/api/admin/users", handler::findAll)
        .build()
        .filter((request, next) -> {
            // 인증 확인 필터
            String auth = request.headers().firstHeader(HttpHeaders.AUTHORIZATION);
            if (auth == null || !auth.startsWith("Bearer ")) {
                return ServerResponse.status(HttpStatus.UNAUTHORIZED).build();
            }
            return next.handle(request);
        });
}
```

`filter()`는 체인 형태로 여러 개를 이을 수 있다. `before()`와 `after()`는 요청 전/후에 실행되는 단방향 훅이다.

## 어노테이션 방식과의 비교

두 방식의 차이는 라우팅 정의 위치와 테스트 방법에 있다.

```java
// 어노테이션 방식: 라우팅이 @RequestMapping에 분산
@RestController
@RequestMapping("/api/users")
public class UserController {
    @GetMapping("/{id}")
    public Mono<User> findById(@PathVariable Long id) { ... }
}

// 함수형 방식: 라우팅이 RouterFunction에 집중
RouterFunctions.route()
    .GET("/api/users/{id}", handler::findById)
    .build();
```

함수형 방식의 장점은 라우팅 트리가 코드에서 명확히 보인다는 것이다. 또한 `RouterFunction`을 일반 Java 객체로 다룰 수 있어 조합과 테스트가 간편하다.

| 항목 | 어노테이션 | 함수형 |
|------|-----------|--------|
| 라우팅 정의 | `@RequestMapping` 분산 | `RouterFunction` 집중 |
| 요청 매개변수 | `@PathVariable`, `@RequestBody` | `req.pathVariable()`, `req.bodyToMono()` |
| 필터/인터셉터 | `HandlerInterceptor` | `filter()` |
| 테스트 | `WebTestClient` | `WebTestClient` 또는 직접 테스트 |
| 학습 곡선 | 낮음 | 중간 |

## RouterFunction 직접 테스트

함수형 라우터는 서버 없이도 단위 테스트가 가능하다.

```java
class UserRouterTest {

    @Test
    void findById_returns200() {
        UserService service = mock(UserService.class);
        given(service.findById(1L)).willReturn(Mono.just(new User(1L, "alice")));

        UserHandler handler = new UserHandler(service);
        RouterFunction<ServerResponse> router = new UserRouter().userRoutes(handler);

        WebTestClient client = WebTestClient
            .bindToRouterFunction(router)
            .build();

        client.get()
            .uri("/api/users/1")
            .exchange()
            .expectStatus().isOk()
            .expectBody(User.class)
            .value(u -> assertThat(u.name()).isEqualTo("alice"));
    }
}
```

`WebTestClient.bindToRouterFunction()`은 서버를 띄우지 않고 `RouterFunction`을 직접 테스트한다. 이 방식은 스프링 컨텍스트 로딩 없이도 동작해 테스트 속도가 매우 빠르다.

## 두 방식 혼용

어노테이션 방식과 함수형 방식을 같은 프로젝트에 혼용할 수 있다. 기존 코드를 점진적으로 함수형으로 마이그레이션하거나, 간단한 CRUD는 어노테이션으로, 복잡한 라우팅 조합이 필요한 부분만 함수형으로 작성하는 전략도 유효하다.

Spring WebFlux 시리즈는 이번 글로 마무리된다. 리액티브 개념에서 시작해 Mono/Flux, MVC vs WebFlux 선택, WebClient, R2DBC, 함수형 라우팅까지 WebFlux의 핵심을 모두 다뤘다. 다음 편에서는 Spring의 현대화 주제인 Jakarta EE 마이그레이션을 살펴본다.

---

**지난 글:** [R2DBC: 리액티브 관계형 DB 접근](/posts/spring-webflux-r2dbc/)

<br>
읽어주셔서 감사합니다. 😊
