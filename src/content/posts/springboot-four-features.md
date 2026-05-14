---
title: "Spring Boot 4가지 핵심 특징 완전 정복 — Auto-Configuration · Embedded Server · Starter · Actuator"
description: "Spring Boot가 Spring보다 편리한 이유인 4가지 핵심 특징을 완전히 이해합니다. 클래스패스 기반 Auto-Configuration 동작 원리와 @Conditional 조건 평가, 내장 Tomcat/Jetty로 단독 실행 가능한 Embedded Server, 버전 충돌 없는 Starter Dependencies 구조, 운영 환경을 위한 Actuator와 외부화 설정까지 실무 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "AutoConfiguration", "EmbeddedServer", "Starter", "Actuator", "Conditional", "Tomcat", "SpringBoot핵심"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-auditing/)에서 Spring Data JPA Auditing으로 엔티티의 생성·수정 시각과 작성자를 자동으로 기록하는 방법을 살펴봤습니다. 이번 글부터는 **Spring Boot** 파트를 시작합니다. Spring Boot가 왜 등장했고, 어떤 네 가지 특징이 개발 경험을 바꿨는지 구조적으로 이해합니다.

## Spring의 불편함과 Spring Boot의 등장

Spring Framework는 강력하지만 설정이 방대합니다. 웹 애플리케이션 하나를 실행하려면 `DispatcherServlet` 등록, `ViewResolver` Bean 선언, `DataSource` 설정, 트랜잭션 매니저 설정, WAS(Tomcat)에 WAR 배포 등 수십 줄의 설정이 필요합니다. 프로젝트마다 이 설정을 반복하는 것은 비효율적이었습니다.

2014년 출시된 Spring Boot는 **"Convention over Configuration"** 원칙으로 이 문제를 해결했습니다. 표준적인 설정은 자동으로 처리하고, 개발자는 비즈니스 로직에만 집중하게 해줍니다. 이를 가능하게 하는 네 가지 핵심 특징을 살펴봅니다.

![Spring Boot 4가지 핵심 특징](/assets/posts/springboot-four-features-concept.svg)

## ① Auto-Configuration — 클래스패스 기반 자동 설정

Auto-Configuration은 Spring Boot의 가장 혁신적인 특징입니다. **클래스패스에 있는 라이브러리를 감지해 필요한 Bean을 자동으로 등록**합니다.

예를 들어 `spring-boot-starter-data-jpa`를 의존성에 추가하면 Spring Boot는 다음 작업을 자동으로 수행합니다.

- `DataSource` Bean 생성 (application.properties의 spring.datasource.* 값 사용)
- `EntityManagerFactory` 생성
- `PlatformTransactionManager` 생성
- Spring Data JPA Repository 스캔 활성화

```java
// 이것만 추가해도 DataSource, EntityManager, Transaction 모두 자동 구성
@SpringBootApplication
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

### 동작 원리

![Auto-Configuration 동작 흐름](/assets/posts/springboot-four-features-autoconfigure.svg)

Spring Boot 3.x에서는 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 파일에 150개 이상의 자동 설정 클래스가 목록으로 등재되어 있습니다. 애플리케이션 기동 시 이 목록을 읽어 각 클래스의 `@Conditional` 조건을 평가하고, 조건을 충족하는 클래스의 Bean만 등록합니다.

```java
// Spring Boot 내부 DataSourceAutoConfiguration 일부 (단순화)
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean   // 개발자가 직접 DataSource Bean을 만들면 이 Bean은 등록되지 않음
    public DataSource dataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }
}
```

`@ConditionalOnMissingBean`이 핵심입니다. **개발자가 동일 타입의 Bean을 직접 선언하면 Auto-Configuration Bean은 등록되지 않습니다.** 이를 통해 자동 설정을 오버라이드할 수 있습니다.

어떤 Auto-Configuration이 적용되었는지 확인하려면 애플리케이션 기동 시 `--debug` 플래그를 추가합니다.

```bash
java -jar myapp.jar --debug
# → CONDITIONS EVALUATION REPORT 출력
# Positive matches: 자동 설정된 항목
# Negative matches: 조건 미충족으로 제외된 항목
```

## ② Embedded Server — 내장 서버로 단독 실행

전통적인 Spring MVC 애플리케이션은 WAR 파일을 만들어 외부 Tomcat이나 JBoss에 배포해야 했습니다. Spring Boot는 **Tomcat, Jetty, Undertow를 JAR 내부에 내장**해 독립 실행 가능한 파일을 만듭니다.

```bash
# 단 두 명령으로 배포 가능
./gradlew bootJar
java -jar build/libs/myapp-0.0.1-SNAPSHOT.jar
```

서버 종류는 의존성으로 교체합니다.

```gradle
// build.gradle — Tomcat 제거 후 Undertow 사용
dependencies {
    implementation('org.springframework.boot:spring-boot-starter-web') {
        exclude group: 'org.springframework.boot', module: 'spring-boot-starter-tomcat'
    }
    implementation 'org.springframework.boot:spring-boot-starter-undertow'
}
```

서버 포트와 기본 설정도 `application.properties` 한 줄로 변경합니다.

```properties
server.port=8080
server.tomcat.threads.max=200
server.tomcat.accept-count=100
server.connection-timeout=20s
```

컨테이너(Docker)와 클라우드 환경에서 내장 서버는 특히 중요합니다. 컨테이너는 하나의 프로세스를 실행하는 단위인데, `java -jar` 명령 하나로 WAS까지 포함된 애플리케이션이 기동되므로 컨테이너 이미지를 단순하게 만들 수 있습니다.

## ③ Starter Dependencies — 검증된 의존성 묶음

Spring 애플리케이션은 수십 개의 라이브러리가 필요합니다. 각 라이브러리의 버전이 맞지 않으면 런타임 오류가 발생합니다. Spring Boot Starter는 **함께 사용하면 잘 동작하는 의존성 묶음을 하나의 이름으로 제공**합니다.

```gradle
// spring-boot-starter-web 하나가 다음을 포함
// spring-webmvc, spring-web, spring-core, jackson, tomcat, ...
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    runtimeOnly    'com.h2database:h2'
}
```

버전 번호를 직접 명시하지 않아도 됩니다. `spring-boot-dependencies` BOM(Bill of Materials)이 각 Spring Boot 버전에서 테스트된 라이브러리 버전을 관리합니다.

주요 Starter 목록:

| Starter | 포함 내용 |
|---|---|
| `starter-web` | Spring MVC, Tomcat, Jackson |
| `starter-data-jpa` | Hibernate, Spring Data JPA, JDBC |
| `starter-security` | Spring Security |
| `starter-test` | JUnit 5, Mockito, AssertJ, MockMvc |
| `starter-actuator` | Actuator 엔드포인트 |
| `starter-cache` | Spring Cache Abstraction |

## ④ Production-Ready — 운영 환경 지원

Spring Boot는 코드 작성만큼 **운영 환경 지원**을 중요하게 다룹니다. `spring-boot-starter-actuator`를 추가하면 운영에 필요한 엔드포인트가 자동으로 활성화됩니다.

```properties
# application.properties
management.endpoints.web.exposure.include=health,info,metrics,env
management.endpoint.health.show-details=always
```

```bash
GET /actuator/health
# → {"status":"UP","components":{"db":{"status":"UP"},...}}

GET /actuator/metrics/jvm.memory.used
# → {"name":"jvm.memory.used","measurements":[{"statistic":"VALUE","value":...}]}

GET /actuator/env
# → 현재 활성화된 프로파일, 프로퍼티 소스 전체 목록
```

외부화 설정과 프로파일도 Production-Ready 특징의 일부입니다.

```yaml
# application.yml
spring:
  profiles:
    active: dev  # dev / staging / prod 환경 전환

---
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${DB_URL}          # 환경 변수에서 주입
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
```

환경 변수, JVM 시스템 프로퍼티, YAML 파일, 명령행 인수 등 다양한 소스를 **우선순위에 따라 병합**합니다. 명령행 인수가 YAML보다 우선순위가 높으므로 배포 시 동적으로 값을 덮어쓸 수 있습니다.

## 네 가지 특징의 시너지

네 가지 특징은 독립적이지 않고 서로 연결됩니다. Starter를 추가하면 Auto-Configuration이 자동으로 Bean을 등록하고, Embedded Server가 애플리케이션을 독립 실행 가능하게 만들며, Actuator가 운영 중 상태를 외부로 노출합니다.

```
[개발자] → Starter 추가
     ↓
[Auto-Configuration] → 필요한 Bean 자동 등록
     ↓
[Embedded Server] → 단독 실행 가능한 JAR 생성
     ↓
[Actuator] → 운영 환경에서 상태·메트릭·설정 노출
```

이 흐름 덕분에 Spring Boot 프로젝트는 **의존성 추가 → 설정 최소화 → 즉시 실행**이라는 빠른 개발 사이클을 가집니다.

## 정리

- **Auto-Configuration**: 클래스패스 분석 → @Conditional 평가 → Bean 자동 등록. `@ConditionalOnMissingBean`으로 오버라이드 가능
- **Embedded Server**: Tomcat/Jetty/Undertow 내장, `java -jar`로 단독 실행. Docker 친화적
- **Starter Dependencies**: `spring-boot-starter-*` 의존성 묶음, BOM으로 버전 충돌 방지
- **Production-Ready**: Actuator 엔드포인트, 외부화 설정, 프로파일 전환

---

**지난 글:** [Spring Data JPA Auditing 완전 정복](/posts/spring-jpa-auditing/)

**다음 글:** [Spring Initializr 완전 정복](/posts/springboot-initializr/)

<br>
읽어주셔서 감사합니다. 😊
