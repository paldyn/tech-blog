---
title: "Spring Cloud: 모놀리스에서 마이크로서비스로 — 언제, 어떻게 전환할까"
description: "모놀리식 아키텍처와 마이크로서비스 아키텍처의 차이를 비교하고, Spring Cloud 생태계(Eureka, Gateway, Resilience4j, OpenFeign)를 활용한 MSA 전환 전략을 실전 예제로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring Cloud", "MSA", "마이크로서비스", "모놀리스", "Eureka", "API Gateway", "Resilience4j"]
featured: false
draft: false
---

[지난 글](/posts/spring-secrets-management/)에서 애플리케이션의 민감 정보를 안전하게 관리하는 방법을 살펴봤다. 이번 글에서는 아키텍처 차원의 더 큰 결정인 모놀리스와 마이크로서비스(MSA) 중 무엇을 선택해야 하는지, 그리고 Spring Cloud 생태계를 활용해 전환하는 방법을 다룬다.

## 모놀리스는 나쁜 것이 아니다

많은 팀이 처음부터 MSA를 도입하려다 불필요한 복잡도에 시달린다. 모놀리스는 초기에 매우 합리적인 선택이다. 단일 코드베이스라서 디버깅이 쉽고, 트랜잭션이 단순하며, 운영할 서버가 하나뿐이다. Netflix, Amazon 같은 거대 기업들도 처음엔 모놀리스였다.

문제는 서비스가 성장할 때 발생한다. 배포 시 전체를 재시작해야 하고, 특정 기능(예: 주문 처리)만 스케일아웃하기가 어렵고, 팀이 커질수록 코드 충돌이 잦아진다.

![모놀리스 vs 마이크로서비스 아키텍처](/assets/posts/spring-cloud-monolith-vs-msa-arch.svg)

## MSA로의 전환 기준

다음 증상이 나타날 때 MSA 전환을 검토한다.

- 배포 한 번에 30분 이상 걸리고 롤백이 두렵다
- 팀이 5명 이상으로 구성된 여러 팀이 같은 코드베이스를 공유한다
- 특정 기능(결제, 검색)의 부하가 나머지와 크게 다르다
- 서비스 일부 장애가 전체 서비스 중단으로 이어진다

반대로 팀이 작고, 도메인이 아직 명확히 분리되지 않았다면 MSA 전환은 시기상조다. "모놀리스 먼저, 그다음 분리"가 현실적인 전략이다.

## Spring Cloud 생태계

MSA를 구성하는 핵심 컴포넌트와 Spring Cloud에서 대응하는 기술은 다음과 같다.

| 역할 | Spring Cloud 기술 |
|---|---|
| 서비스 등록·발견 | Spring Cloud Netflix Eureka |
| API 진입점 | Spring Cloud Gateway |
| 서비스 간 HTTP 호출 | OpenFeign + LoadBalancer |
| 장애 격리 | Resilience4j (Circuit Breaker) |
| 중앙 설정 관리 | Spring Cloud Config Server |
| 분산 추적 | Micrometer + Zipkin |

## Service Discovery: Eureka

MSA에서는 서비스 인스턴스의 IP와 포트가 동적으로 바뀐다. Eureka는 서비스들이 자신의 위치를 등록하고 서로 발견할 수 있게 해주는 레지스트리다.

```java
// Eureka Server
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {}
```

```yaml
# 각 마이크로서비스 application.yml
spring:
  application:
    name: order-service

eureka:
  client:
    service-url:
      defaultZone: http://eureka:8761/eureka
  instance:
    prefer-ip-address: true
```

서비스가 기동하면 자동으로 Eureka에 등록되고, 종료 시 해제된다.

## 서비스 간 통신: OpenFeign

RestTemplate보다 간결한 선언형 HTTP 클라이언트다. 서비스 이름만 지정하면 Eureka에서 주소를 자동으로 조회하고 로드밸런싱까지 처리한다.

```java
@FeignClient(name = "user-service")
public interface UserClient {

    @GetMapping("/users/{id}")
    UserDto findById(@PathVariable Long id);
}

@Service
@RequiredArgsConstructor
public class OrderService {

    private final UserClient userClient;

    public OrderDto createOrder(Long userId, CreateOrderRequest req) {
        UserDto user = userClient.findById(userId);
        // 주문 생성 로직...
    }
}
```

`@FeignClient(name = "user-service")`의 `name`이 Eureka에 등록된 서비스 이름과 일치하면 된다.

## Circuit Breaker: Resilience4j

분산 시스템에서 연쇄 장애(Cascade Failure)는 큰 위험이다. A 서비스가 B 서비스를 호출하는데 B가 느려지면, A의 스레드 풀이 고갈되어 A도 다운된다. Circuit Breaker는 호출 실패율이 임계치를 넘으면 회로를 열어(Open) 즉시 폴백을 반환하고, B 서비스를 보호한다.

```java
@CircuitBreaker(name = "userService", fallbackMethod = "getUserFallback")
@TimeLimiter(name = "userService")
public CompletableFuture<UserDto> getUser(Long userId) {
    return CompletableFuture.supplyAsync(() ->
        userClient.findById(userId)
    );
}

private CompletableFuture<UserDto> getUserFallback(Long userId, Throwable t) {
    log.warn("user-service unavailable for user {}: {}", userId, t.getMessage());
    return CompletableFuture.completedFuture(UserDto.anonymous(userId));
}
```

```yaml
# application.yml
resilience4j:
  circuit-breaker:
    instances:
      userService:
        sliding-window-size: 10
        failure-rate-threshold: 50      # 50% 실패 시 Open
        wait-duration-in-open-state: 10s
        permitted-number-of-calls-in-half-open-state: 3
```

## Strangler Fig 패턴: 점진적 전환

기존 모놀리스를 한 번에 마이그레이션하는 것은 매우 위험하다. Strangler Fig 패턴은 모놀리스를 유지하면서 기능 단위로 하나씩 새 서비스로 분리하는 방법이다.

![Strangler Fig 패턴으로 점진적 MSA 전환](/assets/posts/spring-cloud-monolith-vs-msa-migration.svg)

### 1단계: API Gateway 도입

모놀리스 앞에 Spring Cloud Gateway를 두고, 모든 트래픽을 Gateway를 통해 라우팅한다. 아직 백엔드는 모놀리스 그대로다.

```yaml
# API Gateway application.yml
spring:
  cloud:
    gateway:
      routes:
        - id: monolith
          uri: http://monolith:8080
          predicates:
            - Path=/**
```

### 2단계: 첫 번째 서비스 분리

가장 변경 빈도가 높거나 독립적인 기능을 먼저 분리한다. Gateway 라우팅 규칙을 추가해서 해당 경로만 새 서비스로 보낸다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service      # Eureka 서비스명
          predicates:
            - Path=/api/users/**
        - id: monolith
          uri: http://monolith:8080
          predicates:
            - Path=/**                # 나머지는 여전히 모놀리스
```

### 3단계: 반복

같은 방식으로 하나씩 분리하면서 모놀리스를 점점 줄인다. 마지막 기능이 분리되면 모놀리스는 사라진다.

## MSA의 비용

MSA로 전환하면 얻는 것도 있지만 치러야 할 비용도 있다.

- **분산 트랜잭션**: 여러 서비스에 걸친 트랜잭션은 `@Transactional`만으로 처리할 수 없다. Saga 패턴이 필요하다.
- **네트워크 지연**: 서비스 간 호출이 인프라 안에서 HTTP로 이루어지므로 레이턴시가 추가된다.
- **운영 복잡도**: 서비스가 10개면 10개의 로그, 메트릭, 배포 파이프라인을 관리해야 한다.
- **데이터 일관성**: 서비스마다 DB가 분리되어 조인이 불가능하고, 최종 일관성(Eventual Consistency)을 받아들여야 한다.

이 비용을 감수할 만큼 규모와 팀이 성장했을 때 MSA가 가치를 발휘한다. "MSA가 더 현대적"이라는 이유만으로 전환하면 불필요한 복잡도만 늘어난다.

---

**지난 글:** [Spring Boot 시크릿 관리](/posts/spring-secrets-management/)

**다음 글:** [Spring Cloud Service Discovery: Eureka 완전 정복](/posts/spring-cloud-service-discovery/)

<br>
읽어주셔서 감사합니다. 😊
