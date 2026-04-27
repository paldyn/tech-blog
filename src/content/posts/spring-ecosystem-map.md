---
title: "스프링 생태계 지도 — Framework, Boot, Data, Security, Cloud"
description: "spring.io의 주요 프로젝트들을 한눈에 파악하고, 각각의 역할과 관계를 명확히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["spring", "spring-boot", "spring-data", "spring-security", "spring-cloud"]
featured: false
draft: false
---

[지난 글](/posts/spring-four-pillars/)에서 IoC, DI, AOP, PSA라는 스프링의 네 가지 핵심 원칙을 살펴봤습니다. 이 원칙들이 실제로 어떤 프로젝트들 안에 녹아 있는지, 스프링 생태계 전체를 지도처럼 조망해 보겠습니다. "스프링"이라는 단어는 하나이지만 실제로는 수십 개의 독립 프로젝트를 가리킵니다.

## "스프링"은 하나가 아니다

처음 스프링을 공부하면 혼란스러운 게 있습니다. Spring Framework, Spring Boot, Spring Data, Spring Security, Spring Cloud — 이게 다 뭐가 다른 걸까요?

**spring.io**에 접속하면 수십 개의 스프링 프로젝트가 나옵니다. 이 프로젝트들은 각각 독립적으로 버전이 관리되고, 서로 조합해서 사용합니다. 큰 그림을 먼저 잡아두지 않으면 문서를 볼 때마다 어느 프로젝트의 이야기인지 헷갈립니다.

## 생태계의 토대 — Spring Framework

**Spring Framework**는 모든 스프링 프로젝트의 기반입니다. 앞서 설명한 IoC 컨테이너, DI, AOP가 여기에 들어 있습니다. Spring Boot도, Spring Data도, Spring Security도 내부적으로는 Spring Framework 위에 얹혀 있습니다.

주요 모듈을 살펴보면:

| 모듈 | 역할 |
|------|------|
| `spring-core` | IoC 컨테이너, BeanFactory |
| `spring-context` | ApplicationContext, 이벤트, 리소스 |
| `spring-webmvc` | DispatcherServlet, @Controller |
| `spring-webflux` | 리액티브 웹(Reactor 기반) |
| `spring-jdbc` | JdbcTemplate, 트랜잭션 |
| `spring-test` | 테스트 지원 (@SpringRunner 등) |
| `spring-aop` | AOP 프록시 구현 |

실무에서 Spring Framework를 직접 의존성에 추가할 일은 드뭅니다. 대신 **Spring Boot를 통해 간접적으로 포함**됩니다.

![스프링 생태계 지도](/assets/posts/spring-ecosystem-map-projects.svg)

## Spring Boot — 실무의 시작점

**Spring Boot**가 등장한 2014년 이전까지는 스프링 프로젝트를 시작하기 위해 XML 설정 수십 줄과 의존성 충돌 해결, 톰캣 설치·설정 같은 준비 작업을 해야 했습니다. Spring Boot는 이 모든 의식적인 준비 작업을 없앴습니다.

Spring Boot가 해결하는 핵심 네 가지:

1. **Auto-Configuration**: 클래스패스에 라이브러리가 있으면 자동으로 설정
2. **Starter**: 관련 의존성을 묶은 편의 패키지
3. **Embedded Server**: 톰캣이 JAR 안에 포함 (배포가 `java -jar app.jar` 한 줄)
4. **Actuator**: 헬스체크, 메트릭 등 운영 정보 엔드포인트 자동 제공

```yaml
# application.yml — Spring Boot가 이 한 줄로 DataSource를 자동 구성
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: user
    password: pass
  jpa:
    hibernate:
      ddl-auto: validate
```

이 YAML만 있으면 Spring Boot는 HikariCP 커넥션 풀, JPA EntityManagerFactory, 트랜잭션 매니저를 모두 자동으로 세팅합니다. 개발자가 직접 빈으로 등록하지 않아도 됩니다.

![Spring Boot 스타터 구조](/assets/posts/spring-ecosystem-map-boot-structure.svg)

## Spring Data — 데이터 접근 통합

**Spring Data**는 다양한 데이터 저장소(RDB, NoSQL, Cache 등)에 대한 일관된 추상화를 제공합니다. 핵심 아이디어는 반복적인 데이터 접근 코드를 없애는 것입니다.

```java
// Spring Data JPA — 인터페이스 선언만으로 CRUD + 페이징 완성
public interface ProductRepository
        extends JpaRepository<Product, Long> {

    // 메서드 이름으로 쿼리 자동 생성
    List<Product> findByNameContaining(String keyword);

    // 가격 범위 조회
    List<Product> findByPriceBetween(int min, int max);

    // 카테고리별 최신순 페이징
    Page<Product> findByCategoryOrderByCreatedAtDesc(
        String category, Pageable pageable);
}
```

구현체를 직접 작성하지 않아도 스프링이 런타임에 프록시 구현체를 만들어줍니다. Spring Data가 지원하는 저장소:

- **Spring Data JPA** — RDB + JPA/Hibernate
- **Spring Data MongoDB** — MongoDB
- **Spring Data Redis** — Redis 캐시
- **Spring Data R2DBC** — 리액티브 JDBC
- **Spring Data Elasticsearch** — 검색 엔진

## Spring Security — 보안 전담

**Spring Security**는 인증(Authentication)과 인가(Authorization)를 담당하는 프레임워크입니다. 보안은 애플리케이션 전반에 걸쳐 있는 횡단 관심사이므로, AOP와 서블릿 필터 체인 기반으로 구현됩니다.

```java
// Spring Boot 3.x — SecurityFilterChain 기반 설정
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http)
            throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(Customizer.withDefaults())
            .build();
    }
}
```

Spring Security는 폼 로그인, HTTP Basic, OAuth 2.0/OIDC, JWT, SAML 등 거의 모든 인증 방식을 지원합니다. 또한 CSRF, CORS, 세션 고정 공격 방어 같은 보안 기본기도 기본 설정으로 제공합니다.

## Spring Cloud — 마이크로서비스

**Spring Cloud**는 클라우드 환경, 특히 마이크로서비스 아키텍처를 위한 도구 모음입니다. Netflix OSS 컴포넌트들을 스프링스럽게 통합한 것이 시작이었고, 지금은 독자적인 구현체들도 있습니다.

주요 컴포넌트:

| 프로젝트 | 역할 |
|----------|------|
| Spring Cloud Gateway | API 게이트웨이, 라우팅 |
| Spring Cloud Config | 중앙 집중 설정 서버 |
| Spring Cloud Netflix Eureka | 서비스 디스커버리 |
| OpenFeign | 선언적 HTTP 클라이언트 |
| Resilience4j | 서킷 브레이커, 재시도, 벌크헤드 |

```yaml
# Spring Cloud Gateway 라우팅 설정
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://ORDER-SERVICE
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=2
```

## 기타 주요 프로젝트

- **Spring Batch**: 대용량 배치 처리 (Job/Step/Chunk 기반)
- **Spring Integration**: 엔터프라이즈 통합 패턴 (메시지 파이프라인)
- **Spring AMQP**: RabbitMQ 통합
- **Spring Kafka**: Apache Kafka 통합
- **Spring AI**: LLM(ChatGPT, Claude 등) 통합 (2024년~ 활발히 개발 중)

## 버전 호환성 — 무엇을 함께 쓸 수 있나

이 프로젝트들은 각각 독립적으로 버전이 올라가므로 호환성 확인이 중요합니다. Spring Boot의 BOM(Bill of Materials)이 이를 해결합니다.

```gradle
// build.gradle — Spring Boot BOM이 모든 버전을 관리
plugins {
    id 'org.springframework.boot' version '3.3.0'
    id 'io.spring.dependency-management' version '1.1.4'
    id 'java'
}

dependencies {
    // 버전 번호 없이 선언 — BOM이 호환되는 버전을 자동 결정
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.cloud:spring-cloud-starter-gateway'
}

// Spring Cloud는 별도 BOM 추가 필요
dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:2023.0.0"
    }
}
```

Spring Boot 3.x는 Spring Framework 6.x를 사용하며, Jakarta EE 9+ 네임스페이스(`jakarta.*`)를 기반으로 합니다. JDK 17이 최소 요구 버전입니다.

## 어디서 시작해야 할까

실무 애플리케이션을 만든다면 일반적인 순서는 이렇습니다.

```
1단계: Spring Boot + spring-boot-starter-web
       → 기본 REST API 서버

2단계: + spring-boot-starter-data-jpa + DB 드라이버
       → 데이터베이스 연동

3단계: + spring-boot-starter-security
       → 인증·인가

4단계 (필요시): + Spring Cloud 컴포넌트들
               → 마이크로서비스 아키텍처
```

이 시리즈도 같은 순서를 따릅니다. Chapter 3~8은 Spring Framework 코어와 데이터 접근을, Chapter 9~11은 Spring Boot를, Chapter 14는 Spring Security를, Chapter 20은 Spring Cloud를 다룹니다.

## 정리

스프링 생태계는 한 덩어리가 아니라 명확한 관심사로 분리된 프로젝트들의 집합입니다. Spring Framework가 기반을 제공하고, Spring Boot가 시작을 쉽게 하며, Spring Data·Security·Cloud가 각 도메인의 복잡함을 추상화합니다. 다음 글에서는 이 생태계가 어떤 역사적 과정을 거쳐 현재에 이르렀는지 살펴봅니다.

---

**지난 글:** [스프링의 4대 핵심 — IoC, DI, AOP, PSA](/posts/spring-four-pillars/)

**다음 글:** [스프링의 역사 — 1.x XML 시대부터 6.x까지](/posts/spring-history/)

<br>
읽어주셔서 감사합니다. 😊
