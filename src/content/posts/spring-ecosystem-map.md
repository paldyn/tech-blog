---
title: "Spring 생태계 맵 — 프로젝트 전체 지형도 한눈에 보기"
description: "Spring Framework, Spring Boot부터 Spring Cloud, Spring Security, Spring Data까지 Spring 생태계 전체 프로젝트를 카테고리별로 정리하고 학습 로드맵을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "Spring Boot", "Spring Cloud", "Spring Security", "Spring Data", "생태계", "로드맵"]
featured: false
draft: false
---

[지난 글](/posts/spring-four-pillars/)에서 IoC, DI, AOP, PSA라는 4대 특성을 살펴봤다. 이제 Spring이 제공하는 프로젝트들이 얼마나 방대한지 전체 지형을 파악할 시간이다. "Spring을 배운다"는 말은 사실 여러 Spring 프로젝트 중 어떤 것을 배우느냐에 따라 의미가 달라진다. 이 지도를 먼저 손에 들고 출발하면, 나중에 낯선 용어를 만나도 어디에 속하는 개념인지 금방 파악할 수 있다.

## Spring 프로젝트 분류

Spring.io에 공개된 프로젝트는 2026년 기준 30개가 넘는다. 실무에서 자주 쓰이는 핵심 프로젝트를 여섯 카테고리로 묶어보면 다음과 같다.

![Spring 생태계 주요 프로젝트](/assets/posts/spring-ecosystem-map-overview.svg)

### 1. 핵심 (Core / Boot)

모든 Spring 애플리케이션의 출발점이다.

- **Spring Framework**: IoC 컨테이너, DI, AOP, 이벤트 시스템, 테스트 지원을 포함한 최상위 프레임워크. 다른 모든 프로젝트가 이 위에서 동작한다.
- **Spring Boot**: `spring-boot-starter-*` 형태의 스타터와 자동 설정(Auto-configuration)으로 설정 시간을 대폭 줄여준다. 내장 Tomcat/Undertow 덕분에 JAR 하나만 실행하면 된다.
- **Spring Initializr**: [start.spring.io](https://start.spring.io)를 통해 프로젝트 뼈대(build.gradle, pom.xml, 기본 클래스)를 웹에서 바로 생성한다.

### 2. 웹 (Web)

HTTP 요청을 처리하는 서버 계층이다.

- **Spring MVC**: 전통적인 서블릿 기반 MVC 프레임워크. `@Controller`, `@RestController`, `@RequestMapping`으로 요청을 매핑한다.
- **Spring WebFlux**: 리액티브 프로그래밍 모델. `Mono`/`Flux`를 사용해 논블로킹 I/O를 처리한다. 고동시성 환경에서 유리하다.
- **Spring REST Docs**: MockMvc/WebTestClient 테스트 코드로부터 API 문서를 자동 생성한다. Swagger보다 정확성이 높다.
- **Spring GraphQL**: GraphQL 스키마와 Spring의 데이터 접근 계층을 연결한다.

### 3. 데이터 (Data)

데이터베이스와의 상호작용을 추상화한다.

- **Spring Data JPA**: JPA(Jakarta Persistence API) 위에서 `JpaRepository` 인터페이스만 선언하면 CRUD, 페이징, 정렬 구현체를 자동으로 제공한다.
- **Spring Data Redis**: Lettuce/Jedis 기반 Redis 클라이언트 추상화. 캐시, 세션, Pub/Sub에 활용한다.
- **Spring Data MongoDB**: MongoDB 문서 저장소에 대해 JPA와 유사한 리포지토리 패턴을 제공한다.
- **Spring Data REST**: `JpaRepository`를 자동으로 HTTP REST 엔드포인트로 노출한다(HAL 형식).

### 4. 보안 (Security)

인증·인가의 전담 프레임워크다.

- **Spring Security**: 폼 로그인, HTTP Basic, 필터 체인 기반 아키텍처로 인증(Authentication)과 인가(Authorization)를 처리한다.
- **Spring OAuth2 Client**: OAuth2·OIDC 프로토콜로 소셜 로그인(Google, GitHub 등)을 구현한다.
- **Spring Authorization Server**: OAuth2 인가 서버를 직접 구축할 때 사용한다.
- **Spring Session**: HTTP 세션을 Redis나 JDBC 등 외부 저장소로 분리해 수평 확장을 지원한다.

### 5. 클라우드 (Cloud)

마이크로서비스 아키텍처(MSA) 구축을 위한 도구다.

- **Spring Cloud Gateway**: API 게이트웨이. 요청 라우팅, 로드 밸런싱, 필터링을 한 곳에서 담당한다.
- **Spring Cloud Config**: Git/파일 시스템 기반 중앙 설정 서버. 모든 서비스의 설정을 한 저장소에서 관리한다.
- **Spring Cloud Netflix Eureka**: 서비스 디스커버리. 각 마이크로서비스가 서로를 이름으로 찾을 수 있게 한다.
- **Spring Cloud Resilience4j**: 서킷 브레이커, Rate Limiter, Retry 패턴으로 서비스 간 장애 전파를 차단한다.
- **Spring Cloud OpenFeign**: HTTP 클라이언트를 인터페이스 선언만으로 구현한다.

### 6. 운영·통합 (Ops / Integration)

운영 환경과 비동기 메시지 처리를 담당한다.

- **Spring Boot Actuator**: `/actuator/health`, `/actuator/metrics` 등 운영 엔드포인트를 노출한다. Prometheus 연동으로 모니터링 체계를 완성한다.
- **Spring Batch**: CSV·DB를 처리하는 대용량 배치 잡을 Job→Step→ItemReader/Processor/Writer 구조로 구현한다.
- **Spring Integration**: 파일, DB, 메시지 브로커 간 데이터 흐름을 파이프라인 방식으로 연결한다.
- **Spring for Apache Kafka / Spring AMQP**: Kafka 및 RabbitMQ와의 메시지 생산·소비를 추상화한다.

## 학습 로드맵

![Spring 학습 로드맵](/assets/posts/spring-ecosystem-map-roadmap.svg)

이 시리즈는 위 로드맵의 1번(Spring Core)부터 시작해 순서대로 진행한다. 각 단계를 건너뛰면 다음 단계의 "왜 이렇게 동작하는가"를 이해하기 어렵다. 특히 Spring Boot를 먼저 배우고 Spring Core를 나중에 공부하는 역순은 "왜 자동 설정이 이렇게 동작하는지"를 이해하지 못하는 블랙박스 개발로 이어질 수 있다.

## Spring Framework와 Spring Boot의 관계 다시 보기

생태계를 이해하는 데 가장 많이 혼란스러운 부분이 이 둘의 관계다.

```text
[Spring Framework]
  ↑
[Spring Boot]  ← 자동 설정 + 스타터 + 내장 서버 추가
  ↑
[Spring MVC / Spring Data / Spring Security / ...]  ← Spring Boot 스타터로 통합
```

Spring Boot는 Spring Framework를 *포함*한다. `spring-boot-starter-web`을 추가하면 Spring MVC, Jackson, Tomcat이 함께 설치된다. 즉 Spring Boot 앱을 만들 때 내부에서는 Spring Framework의 `ApplicationContext`가 돌아가고, Spring MVC의 `DispatcherServlet`이 요청을 처리하며, Spring Data의 `JpaRepository`가 DB를 다룬다.

```java
// Spring Boot 진입점 — 모든 Spring 프로젝트가 여기서 시작
@SpringBootApplication
public class BlogApplication {
    public static void main(String[] args) {
        SpringApplication.run(BlogApplication.class, args);
        // 위 한 줄이 ApplicationContext 생성, Bean 스캔,
        // DispatcherServlet 등록, 내장 Tomcat 시작을 모두 처리
    }
}
```

이 한 줄 뒤에서 일어나는 일들이 이 시리즈에서 하나씩 해부할 내용이다.

## 버전 관리: Spring BOM 활용

Spring 프로젝트들은 서로 의존성이 얽혀 있어 버전을 개별 관리하면 충돌이 발생한다. Spring Boot는 **BOM(Bill of Materials)**을 통해 호환성이 검증된 버전 조합을 제공한다.

```groovy
// build.gradle — Spring Boot BOM이 모든 Spring 프로젝트 버전을 관리
plugins {
    id 'org.springframework.boot' version '3.4.1'
    id 'io.spring.dependency-management' version '1.1.7'
}

dependencies {
    // 버전 번호 없이 선언 — BOM이 올바른 버전을 자동 선택
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-security'
}
```

`spring-boot-starter-parent`(Maven) 또는 `io.spring.dependency-management`(Gradle)를 사용하면 Spring 팀이 검증한 의존성 조합을 그대로 사용할 수 있다.

## 어떤 프로젝트부터 배워야 할까

실무 목적별 권장 시작점을 정리하면 다음과 같다.

| 목표 | 최소 필요 프로젝트 |
|---|---|
| REST API 서버 | Spring Boot + Spring MVC + Spring Data JPA |
| 인증 포함 API | 위 + Spring Security |
| 마이크로서비스 | 위 + Spring Cloud Gateway + Spring Cloud Config |
| 배치 처리 | Spring Boot + Spring Batch + Spring Data |
| 이벤트 기반 | Spring Boot + Spring Kafka/AMQP |

다음 글에서는 실제 개발 환경을 구성하는 시간이다. JDK 선택부터 IDE 설정, Maven과 Gradle 기초까지 첫 Spring 프로젝트를 띄우기 위한 모든 준비를 다룬다.

---

**지난 글:** [Spring의 4대 특성 — IoC·DI·AOP·PSA](/posts/spring-four-pillars/)

**다음 글:** [Spring 역사 — 탄생부터 Spring 6까지](/posts/spring-history/)

<br>
읽어주셔서 감사합니다. 😊
