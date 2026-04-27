---
title: "스프링 생태계 지도 — Framework, Boot, Data, Security, Cloud"
description: "스프링은 하나의 프레임워크가 아니라 수십 개의 프로젝트 생태계다. 각 프로젝트의 역할, 서로의 관계, 어떤 상황에서 무엇을 선택해야 하는지 한눈에 정리한다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["spring", "spring-boot", "spring-data", "spring-security", "spring-cloud", "ecosystem"]
featured: false
draft: false
---

[이전 글](/posts/spring-four-pillars)에서 IoC, DI, AOP, PSA라는 네 가지 핵심 원칙을 살펴봤다. 이번에는 시야를 넓혀보자. "스프링을 배운다"고 했을 때, 그 스프링은 정확히 무엇을 가리키는 걸까?

결론부터 말하면, **스프링은 단일 프레임워크가 아니다**. spring.io에는 현재 수십 개의 프로젝트가 등록돼 있다. 이 글에서는 가장 중요한 다섯 축 — Spring Framework, Spring Boot, Spring Data, Spring Security, Spring Cloud — 을 지도처럼 펼쳐보겠다.

![스프링 생태계 지도](/assets/posts/spring-ecosystem-map-diagram.svg)

## Spring Framework — 모든 것의 기반

**Spring Framework**는 생태계 전체의 토대다. 나머지 모든 스프링 프로젝트는 이 위에서 동작한다.

핵심 구성요소는 크게 세 레이어다.

```
spring-core        : 기본 유틸리티, 타입 변환, SpEL
spring-beans       : BeanFactory, 의존성 주입
spring-context     : ApplicationContext, 이벤트, 국제화
spring-web         : MVC, WebFlux, REST
spring-tx          : 트랜잭션 추상화
spring-jdbc        : JdbcTemplate, DataSource 지원
spring-test        : MockMvc, @SpringRunner 등
```

Spring Framework 6.x(Boot 3.x에 포함)는 **Jakarta EE 9+** 기반으로 전환됐다. `javax.*` 패키지가 모두 `jakarta.*`로 바뀐 것이 가장 큰 변화다. 최소 JDK 17 이상이 필요하며, 이 시리즈는 Spring Boot 3.x + JDK 21을 기준으로 작성된다.

Spring Framework를 직접 사용하는 경우는 오늘날 드물다. 레거시 시스템 통합이나 특수한 경량 배포를 제외하면 거의 모든 새 프로젝트는 Spring Boot를 통해 접근한다.

## Spring Boot — 생산성의 혁명

**Spring Boot**는 "스프링 개발자를 위한 스프링"이라고 할 수 있다. 스프링 프레임워크를 직접 사용할 때의 번거로운 설정과 의존성 관리를 자동화한다.

Spring Boot가 해결하는 네 가지 문제:

### 1. Auto-Configuration

`spring-boot-starter-web`을 의존성에 추가하는 순간, 스프링 부트는 자동으로 `DispatcherServlet`을 등록하고, Jackson을 JSON 직렬화기로 설정하고, 내장 톰캣을 구성한다.

```java
// 이것만으로 완전한 REST API 서버가 구동된다
@SpringBootApplication
public class ShopApplication {
    public static void main(String[] args) {
        SpringApplication.run(ShopApplication.class, args);
    }
}
```

수백 줄의 XML 설정이 사라진다.

### 2. Starter 의존성

스타터는 관련된 의존성을 묶어놓은 메타 패키지다.

```xml
<!-- 이 한 줄로 Spring MVC + Jackson + Tomcat이 모두 들어온다 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

버전 충돌 걱정도 없다. `spring-boot-starter-parent` 또는 BOM이 버전을 통합 관리한다.

### 3. 임베디드 서버

WAR 파일로 WAS에 배포하던 방식 대신, 실행 가능한 **Executable JAR** 하나로 패키징한다.

```bash
# 빌드
./gradlew bootJar

# 실행 — Tomcat이 jar 안에 내장되어 있음
java -jar shop-0.0.1-SNAPSHOT.jar
```

컨테이너(Docker) 환경과 궁합이 완벽하다.

### 4. Actuator

운영에 필요한 모니터링 엔드포인트를 자동으로 제공한다.

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, env
```

`/actuator/health`, `/actuator/metrics` 같은 엔드포인트가 자동으로 활성화된다.

## Spring Data — 데이터 액세스의 통일

**Spring Data**는 다양한 데이터 저장소(JPA, MongoDB, Redis, Elasticsearch 등)에 대한 일관된 접근 방식을 제공한다.

핵심은 **리포지토리 추상화**다.

```java
// JPA 기반 리포지토리 — 구현 코드 없음
public interface OrderRepository extends JpaRepository<Order, Long> {

    // 메서드 이름만으로 쿼리 생성
    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);

    // JPQL로 직접 작성도 가능
    @Query("SELECT o FROM Order o WHERE o.totalAmount > :minAmount")
    List<Order> findExpensiveOrders(@Param("minAmount") BigDecimal minAmount);
}
```

메서드 이름을 파싱해 쿼리를 자동 생성한다. `findByCustomerIdAndStatus`는 `WHERE customer_id = ? AND status = ?`로 변환된다.

MongoDB로 바꿔도 동일한 인터페이스를 사용한다. 데이터 저장소가 바뀌어도 리포지토리 인터페이스는 거의 변경이 없다.

### Spring Data 서브 프로젝트

| 서브 프로젝트 | 대상 저장소 |
|---|---|
| Spring Data JPA | JPA (Hibernate) |
| Spring Data JDBC | 순수 JDBC |
| Spring Data MongoDB | MongoDB |
| Spring Data Redis | Redis |
| Spring Data Elasticsearch | Elasticsearch |
| Spring Data R2DBC | 리액티브 관계형 DB |

## Spring Security — 보안의 표준

**Spring Security**는 인증(Authentication)과 인가(Authorization)를 담당한다. 필터 체인 기반으로 동작하며, 스프링 애플리케이션에서 사실상 표준 보안 프레임워크다.

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

Spring Boot Auto-Configuration과 결합하면 `spring-boot-starter-security`를 추가하는 것만으로 기본 폼 로그인 + CSRF 보호가 활성화된다.

OAuth 2.0, JWT, OIDC, 세션 관리, 메서드 수준 보안 등 현대 애플리케이션에 필요한 모든 보안 기능을 제공한다.

## Spring Cloud — 마이크로서비스 인프라

**Spring Cloud**는 마이크로서비스 아키텍처 구성에 필요한 패턴들을 구현체로 제공한다.

![프로젝트 선택 가이드](/assets/posts/spring-ecosystem-map-selection-guide.svg)

주요 컴포넌트:

```yaml
# Spring Cloud 컴포넌트 구성 예시
# Config Server — 중앙 집중식 설정 관리
spring:
  cloud:
    config:
      uri: http://config-server:8888

# Eureka — 서비스 디스커버리
eureka:
  client:
    service-url:
      defaultZone: http://eureka:8761/eureka/
```

```java
// OpenFeign — 선언적 HTTP 클라이언트
@FeignClient(name = "payment-service")
public interface PaymentClient {

    @PostMapping("/api/payments")
    PaymentResult charge(@RequestBody PaymentRequest request);
}
```

Spring Cloud는 마이크로서비스 환경에서만 필요하다. 서비스 수가 적다면 Spring Boot만으로 충분하다.

## 그 외 주목할 프로젝트

**Spring Batch**: 대용량 배치 처리. Job, Step, ItemReader/Writer/Processor 추상화로 ETL 파이프라인을 구성한다.

**Spring Integration**: 기업 통합 패턴(EIP) 구현. 메시지 기반 시스템 통합에 사용한다.

**Spring AI**: LLM(대규모 언어 모델) 연동 추상화. OpenAI, Anthropic Claude 등 다양한 AI 프로바이더를 일관된 API로 사용한다.

**Spring Authorization Server**: OAuth 2.0 인가 서버 구현. Keycloak 대신 자체 인가 서버를 구축할 때 사용한다.

## 어떤 조합을 선택할 것인가

신규 프로젝트라면 거의 항상 이 조합으로 시작한다.

```gradle
// build.gradle (Kotlin DSL)
dependencies {
    // 웹 API
    implementation("org.springframework.boot:spring-boot-starter-web")

    // 데이터베이스 (JPA)
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")

    // 보안
    implementation("org.springframework.boot:spring-boot-starter-security")

    // 운영 모니터링
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // 테스트
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

서비스가 성장하고 마이크로서비스 분리가 필요해지면 Spring Cloud를 점진적으로 도입한다. 배치 작업이 생기면 Spring Batch를, 복잡한 메시징 통합이 필요해지면 Spring Integration이나 Spring Kafka를 추가한다.

생태계는 넓지만 출발점은 단순하다. **Spring Boot + Web + Data JPA + Security** 이 네 가지가 대부분의 웹 애플리케이션을 완성시킨다.

---

**지난 글:** [스프링의 4대 핵심 — IoC, DI, AOP, PSA](/posts/spring-four-pillars/)

**다음 글:** [스프링의 역사 — 1.x XML 시대부터 6.x까지](/posts/spring-history/)

<br>
읽어주셔서 감사합니다. 😊
