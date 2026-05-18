---
title: "Spring Boot H2 콘솔 — 인메모리 DB로 빠른 개발 환경 구성"
description: "Spring Boot 개발 환경에서 H2 인메모리 데이터베이스와 웹 콘솔을 설정하는 방법을 다룹니다. 의존성 추가부터 MySQL 호환 모드, Spring Security 통합, 테스트 격리 전략까지 실용적인 구성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "H2", "InMemoryDatabase", "H2Console", "SpringSecurity", "Testing"]
featured: false
draft: false
---

[지난 글](/posts/springboot-flyway-liquibase/)에서 Flyway와 Liquibase로 DB 스키마를 버전 관리하는 방법을 살펴봤습니다. 개발 초기 단계나 단위 테스트에서는 매번 외부 DB를 띄우는 것이 번거롭습니다. 이때 **H2 인메모리 데이터베이스**가 강력한 대안이 됩니다. 외부 설치 없이 JVM 프로세스 내에서 동작하고, 기동 즉시 사용 가능하며, 브라우저에서 SQL을 직접 실행할 수 있는 웹 콘솔까지 제공합니다.

## H2란

H2는 자바로 작성된 경량 관계형 데이터베이스입니다. **인메모리 모드**(`jdbc:h2:mem:`)와 **파일 모드**(`jdbc:h2:file:`) 두 가지로 실행됩니다. 인메모리 모드는 앱이 종료되면 데이터가 사라지는 대신 디스크 I/O 없이 빠르고 설치가 필요 없습니다.

스프링 부트는 `spring-boot-starter-data-jpa`와 함께 `h2`가 클래스패스에 있으면 자동으로 인메모리 DB를 구성합니다. 추가 설정 없이 바로 사용할 수 있습니다.

## 의존성 추가

```xml
<!-- pom.xml -->
<dependency>
  <groupId>com.h2database</groupId>
  <artifactId>h2</artifactId>
  <scope>runtime</scope>
</dependency>
```

```gradle
// build.gradle
runtimeOnly 'com.h2database:h2'
```

`scope=runtime`(Maven) 또는 `runtimeOnly`(Gradle)로 지정합니다. 컴파일 클래스패스에는 노출하지 않는 것이 원칙입니다.

## 기본 동작 확인

H2 의존성만 추가하면 스프링 부트가 다음을 자동으로 수행합니다.

1. `DataSource` 빈을 `jdbc:h2:mem:<임의UUID>` URL로 생성
2. JPA가 활성화돼 있으면 `spring.jpa.hibernate.ddl-auto=create-drop`으로 동작
3. `spring.h2.console.enabled=true`일 때 `/h2-console` 경로에 웹 UI 노출

```java
// Entity가 있으면 기동 시 CREATE TABLE이 자동 실행됨
@Entity
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String email;
    private String name;
}
```

## 설정 파일 구성

H2 관련 핵심 설정을 정리합니다.

![H2 Console 핵심 설정과 Security 통합](/assets/posts/springboot-h2-console-config.svg)

```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    driver-class-name: org.h2.Driver
    username: sa
    password:
  h2:
    console:
      enabled: true
      path: /h2-console
      settings:
        web-allow-others: false   # 원격 접속 차단
  jpa:
    database-platform: org.hibernate.dialect.H2Dialect
    hibernate:
      ddl-auto: create-drop
    show-sql: true
```

주요 JDBC URL 옵션 설명입니다.

| 옵션 | 의미 |
|------|------|
| `MODE=MySQL` | MySQL 문법 호환 (AUTO_INCREMENT, LIMIT 등) |
| `DB_CLOSE_DELAY=-1` | 마지막 커넥션이 닫혀도 DB 유지 |
| `DB_CLOSE_ON_EXIT=FALSE` | JVM 종료 시 자동 닫기 비활성화 |

## H2 웹 콘솔 사용법

앱을 기동한 뒤 브라우저에서 `http://localhost:8080/h2-console`에 접속합니다.

접속 화면에서 입력할 내용입니다.

```
Driver Class: org.h2.Driver
JDBC URL: jdbc:h2:mem:testdb
User Name: sa
Password: (비워둠)
```

JDBC URL은 `application.yml`의 `spring.datasource.url`과 **정확히 일치**해야 합니다. URL이 다르면 다른 인메모리 인스턴스에 연결되어 아무 테이블도 보이지 않습니다.

## Spring Security와 충돌 해결

`spring-boot-starter-security`가 추가돼 있으면 `/h2-console`이 차단됩니다. H2 콘솔은 iframe 기반 UI라 추가 이슈도 있습니다.

```java
// 개발 환경 전용 Security 설정
@Profile("dev")
@Configuration
public class H2SecurityConfig {

    @Bean
    @Order(1)
    public SecurityFilterChain h2ConsoleFilterChain(
            HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/h2-console/**")
            .authorizeHttpRequests(auth ->
                auth.anyRequest().permitAll())
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers
                .frameOptions(frame -> frame.disable()))
            .build();
    }
}
```

`@Profile("dev")`로 감싸면 prod 환경에서는 이 빈 자체가 생성되지 않으므로 안전합니다.

## 초기 데이터 설정

### schema.sql + data.sql

`src/main/resources/`에 파일을 두면 기동 시 자동 실행됩니다.

```sql
-- schema.sql (테이블 정의)
CREATE TABLE IF NOT EXISTS category (
    id   INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);
```

```sql
-- data.sql (초기 데이터)
INSERT INTO category (id, name) VALUES (1, 'ELECTRONICS');
INSERT INTO category (id, name) VALUES (2, 'CLOTHING');
```

스프링 부트 2.5 이후로 JPA DDL 자동 실행 이후에 `data.sql`이 실행됩니다. 순서를 명확히 하려면 다음 설정을 추가합니다.

```yaml
spring:
  jpa:
    defer-datasource-initialization: true
```

### @Sql 어노테이션으로 테스트별 데이터 제어

```java
@SpringBootTest
@Sql(scripts = "/sql/test-users.sql",
     executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/sql/cleanup.sql",
     executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class UserServiceTest {

    @Autowired
    private UserService userService;

    @Test
    void 사용자_목록_조회() {
        List<User> users = userService.findAll();
        assertThat(users).hasSize(3);
    }
}
```

## H2 콘솔 동작 구조

![H2 인메모리 DB 동작 구조](/assets/posts/springboot-h2-console-concept.svg)

H2는 JVM 내부에서 동작하므로 별도 프로세스 간 통신이 없고, 같은 JVM 내의 여러 커넥션이 동일한 인메모리 DB를 공유합니다. 앱 코드와 웹 콘솔이 같은 DB를 보는 이유입니다.

## 파일 모드 H2 (데이터 영속)

인메모리 모드 대신 파일에 저장하면 재기동 후에도 데이터가 유지됩니다.

```yaml
spring:
  datasource:
    url: jdbc:h2:file:./data/testdb;MODE=MySQL
```

로컬 개발에서 외부 MySQL을 실행하지 않고도 어느 정도의 영속성을 유지하고 싶을 때 사용합니다. `.gitignore`에 `data/` 디렉터리를 추가하는 것을 잊지 마세요.

## 프로파일 전략 정리

H2는 개발·테스트에만 사용하고, 실제 운영 환경에서는 MySQL·PostgreSQL 등 실제 RDBMS를 사용합니다. 프로파일로 분리하는 것이 핵심입니다.

```yaml
# application.yml (기본 — prod용)
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  h2:
    console:
      enabled: false
```

```yaml
# application-dev.yml (개발용)
spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=MySQL;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
  h2:
    console:
      enabled: true
```

`./gradlew bootRun --args='--spring.profiles.active=dev'`로 기동하면 H2가 활성화됩니다. IDE에서는 Run Configuration의 VM options에 `-Dspring.profiles.active=dev`를 추가합니다.

---

**지난 글:** [Spring Boot Flyway & Liquibase — DB 마이그레이션 자동화](/posts/springboot-flyway-liquibase/)

**다음 글:** [Spring Boot 쿼리 로깅 — SQL·파라미터·성능 측정](/posts/springboot-query-logging/)

<br>
읽어주셔서 감사합니다. 😊
