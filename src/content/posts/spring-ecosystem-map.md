---
title: "Spring 생태계 지도 — 프로젝트 전체 구조 한눈에 보기"
description: "Spring Framework, Spring Boot, Spring Data, Spring Security, Spring Cloud 등 Spring 생태계 전체 프로젝트를 역할과 관계에 따라 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "Spring Boot", "Spring Data", "Spring Security", "Spring Cloud", "생태계"]
featured: false
draft: false
---

[지난 글](/posts/spring-four-pillars/)에서 Spring의 4대 핵심 특징인 IoC, DI, AOP, PSA를 코드 수준에서 살펴봤습니다. 이번 글에서는 시야를 넓혀 Spring Framework를 중심으로 성장한 생태계 전체를 살펴봅니다. "Spring"이라는 이름이 붙은 프로젝트가 무수히 많은데, 무엇이 무엇이고 어떤 관계인지 파악하는 것이 시리즈를 효과적으로 학습하는 출발점입니다.

## Spring vs Spring Boot vs Spring 생태계

"Spring을 배운다"고 할 때 대화 상대에 따라 의미가 달라집니다.

- **Spring Framework**: IoC 컨테이너, AOP, Data Access, Web MVC, WebFlux를 포함한 핵심 라이브러리
- **Spring Boot**: Spring Framework 위에 자동 설정과 내장 서버를 추가해 즉시 실행 가능한 애플리케이션 개발을 가능하게 하는 도구
- **Spring 생태계(Ecosystem)**: Spring Framework를 기반으로 한 Data, Security, Cloud, Batch, Integration, AI 등의 프로젝트 전체

실무에서는 대부분 Spring Boot를 진입점으로 삼아 필요한 생태계 프로젝트를 `starter` 의존성으로 추가합니다.

![Spring 생태계 전체 지도](/assets/posts/spring-ecosystem-map-overview.svg)

## 주요 프로젝트 소개

### Spring Framework (Core)

모든 것의 기반입니다. 다음 모듈로 구성됩니다.

```
spring-core          → IoC, 리소스 추상화
spring-beans         → BeanFactory, 빈 정의
spring-context       → ApplicationContext, 이벤트, 스케줄링
spring-aop           → AOP 프레임워크
spring-web           → 웹 기반 공통 (HttpMessage, 필터)
spring-webmvc        → Dispatcher Servlet 기반 MVC
spring-webflux       → Reactor 기반 리액티브 웹
spring-jdbc          → JdbcTemplate
spring-tx            → 트랜잭션 관리
spring-orm           → JPA, Hibernate 통합
spring-test          → 테스트 지원
```

### Spring Boot

Spring Boot는 세 가지 핵심 기능을 제공합니다.

```properties
# application.properties — Spring Boot가 자동으로 처리하는 것들
spring.datasource.url=jdbc:mysql://localhost:3306/mydb
spring.datasource.username=root
spring.datasource.password=secret
spring.jpa.show-sql=true
```

프로퍼티 몇 줄로 DataSource 빈이 자동 생성되고, HikariCP 커넥션 풀이 설정되고, JPA EntityManagerFactory가 초기화됩니다. 이것이 **자동 설정(Auto-configuration)** 의 힘입니다.

**내장 서버**: Tomcat, Jetty, Undertow를 jar 파일 안에 포함해 `java -jar app.jar` 한 줄로 실행합니다.

**Starter**: `spring-boot-starter-web` 하나를 추가하면 Spring MVC, Jackson, Tomcat, Validation 등 웹 개발에 필요한 의존성이 모두 따라옵니다.

### Spring Data

데이터 접근 기술별로 Repository 추상화를 제공합니다.

```java
// Spring Data JPA — 구현 코드 없이 인터페이스만으로 완성
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByCategory(String category);
    Optional<Product> findBySkuCode(String skuCode);
}
```

`JpaRepository`를 상속하는 인터페이스를 선언하면 Spring Data가 런타임에 구현체를 자동 생성합니다. `findByCategory` 메서드 이름만으로 `WHERE category = ?` 쿼리가 만들어집니다.

주요 모듈: `spring-data-jpa`, `spring-data-redis`, `spring-data-mongodb`, `spring-data-jdbc`, `spring-data-elasticsearch`

### Spring Security

인증(Authentication)과 인가(Authorization) 전담 프레임워크입니다.

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }
}
```

Servlet Filter 체인 위에서 동작하며, OAuth2/OIDC, JWT, 세션 기반 인증 등을 지원합니다.

### Spring Cloud

MSA(마이크로서비스 아키텍처) 구축에 필요한 패턴을 제공합니다.

```yaml
# application.yml — Spring Cloud Gateway 라우팅 예
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://ORDER-SERVICE
          predicates:
            - Path=/orders/**
```

주요 모듈: `spring-cloud-gateway`(API 게이트웨이), `spring-cloud-config`(중앙 설정), `spring-cloud-netflix`(Eureka 서비스 디스커버리), `spring-cloud-openfeign`(선언적 HTTP 클라이언트), `spring-cloud-circuit-breaker`(Resilience4j 통합)

### 그 외 주요 프로젝트

| 프로젝트 | 역할 |
|---|---|
| Spring Batch | 대용량 배치 처리, Job/Step/ItemReader/Writer |
| Spring Integration | EIP 패턴, 메시지 파이프라인, 시스템 통합 |
| Spring WebFlux | Reactor 기반 논블로킹 리액티브 웹 |
| Spring AI | LLM API 통합, RAG, 임베딩, 벡터 스토어 |
| Spring Shell | CLI 애플리케이션 개발 |

## 레이어 스택으로 보기

![Spring Boot 레이어 스택](/assets/posts/spring-ecosystem-map-boot-stack.svg)

실무 프로젝트는 이 스택 위에서 동작합니다. JVM이 가장 아래에 있고, 그 위에 Spring Framework Core가 IoC/DI 기반을 제공하며, 각 Spring 프로젝트들이 도메인별 기능을 추가하고, Spring Boot Starter가 이들을 편리하게 묶어주며, 개발자가 작성하는 POJO 비즈니스 코드가 최상단에 위치합니다.

## 이 시리즈에서 다루는 범위

이 시리즈는 다음 순서로 진행됩니다.

1. **기초**: Spring Core — IoC, DI, Bean, AOP
2. **Web**: Spring MVC — DispatcherServlet, Controller, REST API
3. **Data**: JPA, Spring Data JPA, 트랜잭션
4. **Boot**: Spring Boot 자동 설정, 프로퍼티, 프로필
5. **Security**: 인증/인가, JWT, OAuth2
6. **심화**: 캐시, 비동기, 이벤트, 테스트, 운영
7. **Cloud & Reactive**: Spring Cloud, WebFlux
8. **Modern**: Jakarta EE 마이그레이션, GraalVM, 가상 스레드

---

**지난 글:** [Spring 4대 핵심 특징 — IoC·DI·AOP·PSA 완전 해부](/posts/spring-four-pillars/)

**다음 글:** [Spring의 역사 — 버전별 진화와 철학의 변화](/posts/spring-history/)

<br>
읽어주셔서 감사합니다. 😊
