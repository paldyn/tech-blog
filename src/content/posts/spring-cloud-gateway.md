---
title: "Spring Cloud Gateway: API 진입점 완전 정복"
description: "Spring Cloud Gateway의 Route·Predicate·Filter 개념부터 글로벌 필터, Rate Limiting, Circuit Breaker 통합, 커스텀 필터 작성까지 실전 예제로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring Cloud", "API Gateway", "Route", "Filter", "Predicate", "Rate Limiting", "MSA"]
featured: false
draft: false
---

[지난 글](/posts/spring-cloud-service-discovery/)에서 Eureka 기반의 서비스 디스커버리를 구성하는 방법을 다뤘다. 이번 글에서는 MSA의 단일 진입점인 **API Gateway**를 Spring Cloud Gateway로 구현하는 방법을 살펴본다.

## API Gateway가 필요한 이유

서비스가 10개로 늘어났다고 하자. 클라이언트(브라우저, 모바일 앱)가 각 서비스를 직접 호출하면 다음 문제들이 생긴다.

- **인증 중복**: 모든 서비스마다 JWT 검증 로직을 구현해야 한다.
- **CORS 설정 분산**: 서비스마다 CORS 허용 도메인을 따로 관리해야 한다.
- **클라이언트에 서비스 위치 노출**: 서비스 URL 구조가 바뀌면 클라이언트도 수정해야 한다.
- **Rate Limiting 없음**: 악성 클라이언트가 특정 서비스를 직접 공격할 수 있다.

API Gateway는 모든 외부 요청을 한 곳에서 받아 내부 서비스로 라우팅하면서, 횡단 관심사를 중앙에서 처리한다.

![Spring Cloud Gateway 아키텍처](/assets/posts/spring-cloud-gateway-architecture.svg)

## Spring Cloud Gateway vs Zuul

Spring Cloud 1.x 시대에는 Netflix Zuul 1이 사실상의 표준이었다. 그러나 Zuul 1은 서블릿 기반의 블로킹 I/O 모델로 설계되어 있어 대용량 트래픽에서 스레드 부족이 문제가 된다.

Spring Cloud Gateway는 **Reactor Netty 기반의 비동기·논블로킹** 모델로 구현되었다. 높은 동시성을 더 적은 리소스로 처리할 수 있고, Spring WebFlux와 통합이 자연스럽다.

> Spring Cloud Gateway는 Spring MVC가 아닌 WebFlux 기반이다. 같은 애플리케이션에 Spring MVC와 함께 사용하면 안 된다.

## 핵심 개념: Route, Predicate, Filter

Spring Cloud Gateway의 세 가지 핵심 개념을 이해하면 나머지는 자연스럽게 따라온다.

- **Route**: `id`, `uri`, `predicates`, `filters`로 구성되는 라우팅 규칙의 기본 단위다.
- **Predicate**: 요청이 이 Route에 해당하는지 판단하는 조건이다. `Path`, `Method`, `Header`, `Query`, `Host` 등 다양한 조건을 조합할 수 있다.
- **Filter**: 매칭된 요청에 대해 전처리(Pre)와 후처리(Post)를 수행한다. 헤더 추가·제거, Rate Limit, 인증, 응답 수정 등을 담당한다.

## 의존성과 기본 설정

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
<!-- Eureka와 통합 시 -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

Spring Cloud BOM 버전 관리를 잊지 말아야 한다.

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2023.0.3</version>  <!-- Spring Boot 3.x -->
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

## Route 설정: YAML vs Java DSL

Route는 `application.yml`로 선언하거나, `RouteLocator` 빈으로 Java DSL 방식으로 정의할 수 있다.

![Gateway 라우팅 설정: YAML vs Java DSL](/assets/posts/spring-cloud-gateway-routing.svg)

YAML 방식은 설정이 직관적이고 코드와 분리된다는 장점이 있다. Java DSL 방식은 조건부 로직이나 외부 의존성 주입이 필요할 때 유용하다. 실무에서는 단순한 라우팅은 YAML, 커스텀 로직이 필요한 라우팅만 Java DSL로 혼용하는 경우가 많다.

## 내장 Predicate 활용

Spring Cloud Gateway에는 다양한 내장 Predicate가 제공된다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: versioned-route
          uri: lb://api-service
          predicates:
            - Path=/v2/api/**             # 경로 패턴
            - Method=GET,POST             # HTTP 메서드
            - Header=X-Client-Id, .+      # 헤더 존재 확인 (정규식)
            - Query=region, KR            # 쿼리 파라미터
            - After=2026-01-01T00:00:00+09:00[Asia/Seoul]  # 특정 시간 이후
```

`Path` Predicate에서 `{segment}` 패턴 변수를 사용하면 URI 변수를 Filter에서 참조할 수 있다.

```yaml
predicates:
  - Path=/api/{version}/users/**
filters:
  - SetPath=/users/{version}/**   # {version} 변수 재사용
```

## 내장 Filter 활용

```yaml
filters:
  - AddRequestHeader=X-Request-Id, {id}  # 헤더 추가
  - AddResponseHeader=X-Response-Time, {responseTime}
  - RemoveRequestHeader=Cookie           # 헤더 제거
  - StripPrefix=1                        # /api/users → /users (앞 1세그먼트 제거)
  - PrefixPath=/v1                       # /users → /v1/users (앞에 붙이기)
  - RewritePath=/api/(?<segment>.*), /$\{segment}  # 경로 재작성 (정규식)
  - RequestRateLimiter                   # Rate Limiting
  - CircuitBreaker                       # Circuit Breaker 통합
  - Retry=3                              # 재시도 횟수
```

## 커스텀 필터 작성

특정 Route에만 적용되는 커스텀 필터는 `GatewayFilter`를 구현한다.

```java
@Component
public class RequestLoggingFilter
        implements GatewayFilter, Ordered {

    @Override
    public Mono<Void> filter(
            ServerWebExchange exchange,
            GatewayFilterChain chain) {

        String path = exchange.getRequest().getPath().value();
        long start = System.currentTimeMillis();

        return chain.filter(exchange).doFinally(signal -> {
            long elapsed = System.currentTimeMillis() - start;
            log.info("path={} elapsed={}ms signal={}", path, elapsed, signal);
        });
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
```

```java
// RouteLocator에 필터 적용
@Bean
public RouteLocator routes(RouteLocatorBuilder builder,
                           RequestLoggingFilter loggingFilter) {
    return builder.routes()
        .route("user-route", r -> r
            .path("/api/users/**")
            .filters(f -> f.filter(loggingFilter))
            .uri("lb://user-service"))
        .build();
}
```

## 글로벌 필터

모든 Route에 적용되는 필터는 `GlobalFilter`를 구현한다. 인증 처리에 자주 쓰인다.

```java
@Component
@RequiredArgsConstructor
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private static final List<String> PUBLIC_PATHS =
        List.of("/api/auth/", "/actuator/");

    private final JwtTokenProvider jwtProvider;

    @Override
    public Mono<Void> filter(
            ServerWebExchange exchange,
            GatewayFilterChain chain) {

        String path = exchange.getRequest().getPath().value();

        // 공개 경로는 통과
        boolean isPublic = PUBLIC_PATHS.stream()
            .anyMatch(path::startsWith);
        if (isPublic) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest()
            .getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(7);
        if (!jwtProvider.validate(token)) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        // 유효한 토큰의 사용자 정보를 하위 서비스로 전달
        String userId = jwtProvider.getUserId(token);
        ServerWebExchange mutated = exchange.mutate()
            .request(r -> r.header("X-User-Id", userId))
            .build();

        return chain.filter(mutated);
    }

    @Override
    public int getOrder() {
        return -100;  // 낮을수록 먼저 실행
    }
}
```

## Rate Limiting

Redis 기반의 토큰 버킷 알고리즘으로 Rate Limiting을 구현할 수 있다.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
</dependency>
```

```java
@Configuration
public class RateLimitConfig {

    @Bean
    public KeyResolver userKeyResolver() {
        // 사용자 ID 기준으로 Rate Limit 적용
        return exchange -> Mono.justOrEmpty(
            exchange.getRequest().getHeaders().getFirst("X-User-Id"))
            .defaultIfEmpty("anonymous");
    }
}
```

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: order-route
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenish-rate: 10   # 초당 10개
                redis-rate-limiter.burst-capacity: 20   # 최대 버스트 20개
                key-resolver: "#{@userKeyResolver}"
```

Rate Limit 초과 시 HTTP 429 Too Many Requests 응답이 반환된다.

## Circuit Breaker 통합

Resilience4j와 통합해 하위 서비스 장애를 격리한다.

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-reactor-resilience4j</artifactId>
</dependency>
```

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-route
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          filters:
            - name: CircuitBreaker
              args:
                name: userServiceCB
                fallbackUri: forward:/fallback/users

resilience4j:
  circuit-breaker:
    instances:
      userServiceCB:
        sliding-window-size: 10
        failure-rate-threshold: 50
        wait-duration-in-open-state: 10s
```

폴백 컨트롤러를 추가해 Circuit Breaker가 열렸을 때의 응답을 정의한다.

```java
@RestController
public class FallbackController {

    @GetMapping("/fallback/users")
    public ResponseEntity<Map<String, String>> usersFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "message", "사용자 서비스를 일시적으로 이용할 수 없습니다.",
                "code", "SERVICE_UNAVAILABLE"
            ));
    }
}
```

## CORS 설정

Gateway에서 CORS를 중앙 관리하면 각 서비스에서 CORS 설정을 중복해서 할 필요가 없다.

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        corsConfigurations:
          '[/**]':
            allowedOriginPatterns:
              - "https://*.paldyn.com"
              - "http://localhost:[*]"
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - OPTIONS
            allowedHeaders: "*"
            allowCredentials: true
            maxAge: 3600
```

## 실무 체크리스트

- **타임아웃 설정**: 연결 타임아웃과 응답 타임아웃을 명시해 느린 서비스가 Gateway 스레드를 잡지 않도록 한다.
- **Actuator 엔드포인트 보호**: `/actuator/gateway/routes`는 라우팅 규칙이 노출되므로 내부망 또는 보안 설정으로 제한한다.
- **로드밸런서 캐시**: 기본적으로 서비스 목록은 캐시된다. 빠른 인스턴스 감지가 필요하면 캐시 TTL을 조정한다.
- **웹소켓 지원**: WebSocket 프로토콜도 `uri: ws://` 또는 `uri: wss://` 형식으로 라우팅 가능하다.

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        connect-timeout: 2000  # ms
        response-timeout: 5s
```

API Gateway를 잘 구성하면 각 마이크로서비스는 비즈니스 로직에만 집중하고, 인증·CORS·Rate Limit·모니터링 같은 공통 관심사는 Gateway 한 곳에서 일관되게 처리할 수 있다.

---

**지난 글:** [Spring Cloud 서비스 디스커버리: Eureka 완전 정복](/posts/spring-cloud-service-discovery/)

**다음 글:** [Spring Cloud Config Server: 중앙화된 설정 관리](/posts/spring-cloud-config-server/)

<br>
읽어주셔서 감사합니다. 😊
