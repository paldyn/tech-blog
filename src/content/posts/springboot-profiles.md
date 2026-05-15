---
title: "Spring Boot Profiles 완전 정복 — 환경별 설정 분리와 @Profile 활용"
description: "Spring Boot Profiles로 개발·테스트·운영 환경 설정을 깔끔하게 분리하는 방법을 완전히 이해합니다. application-{profile}.yml 파일 구조, 단일 yml 내 문서 구분자(---) 활용, 프로파일 그룹, @Profile 애노테이션으로 빈 조건부 등록, 테스트에서 @ActiveProfiles 사용, 그리고 실무에서 자주 빠지는 함정까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "Profiles", "환경분리", "Profile", "ActiveProfiles", "application.yml", "ConfigurationProperties", "배포환경"]
featured: false
draft: false
---

[지난 글](/posts/springboot-properties-config/)에서 `application.yml`의 구조와 `@ConfigurationProperties`를 통한 타입 안전 바인딩을 살펴봤습니다. 이번에는 "개발 환경에서는 H2, 운영 환경에서는 MySQL을 써야 한다"는 식의 **환경 분리 문제**를 Spring Boot Profiles로 우아하게 해결하는 방법을 다룹니다.

## 왜 Profiles인가

코드에 `if (isProduction)` 같은 분기를 넣는 순간 그 코드는 테스트하기 어려워지고, 설정이 흩어지며, 나중에 새 환경(staging, canary)이 추가될 때마다 코드를 고쳐야 합니다. Spring Boot Profiles는 이 문제를 **코드와 설정의 완전한 분리**로 해결합니다.

활성 프로파일에 따라 로딩되는 설정 파일과 등록되는 빈이 달라집니다. 코드는 바뀌지 않고, 환경 변수 하나로 애플리케이션의 동작이 완전히 달라집니다.

## 프로파일 전용 설정 파일

![Spring Boot Profiles 환경별 설정 분리 구조](/assets/posts/springboot-profiles-concept.svg)

가장 기본적인 방법은 `application-{profile}.yml` 파일을 만드는 것입니다.

```
src/main/resources/
├── application.yml          ← 공통 기본 설정 (모든 환경에 항상 로딩)
├── application-dev.yml      ← dev 프로파일 활성 시 추가 로딩
├── application-test.yml     ← test 프로파일 활성 시 추가 로딩
└── application-prod.yml     ← prod 프로파일 활성 시 추가 로딩
```

`application.yml`이 먼저 로딩된 뒤, 활성 프로파일에 해당하는 파일이 로딩됩니다. 프로파일 전용 파일의 값이 공통 파일을 **덮어씁니다**.

```yaml
# application.yml — 공통 설정
spring:
  jpa:
    show-sql: false    # 기본: SQL 미출력
  mail:
    host: localhost

server:
  port: 8080
```

```yaml
# application-dev.yml — dev 환경 오버라이드
spring:
  datasource:
    url: jdbc:h2:mem:devdb
    driver-class-name: org.h2.Driver
  jpa:
    show-sql: true    # dev에서는 SQL 출력
    hibernate:
      ddl-auto: create-drop
```

```yaml
# application-prod.yml — 운영 환경 오버라이드
spring:
  datasource:
    url: jdbc:mysql://${DB_HOST}/proddb
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate   # 운영에서는 스키마 자동 변경 금지
```

## 단일 yml 파일에서 문서 구분자 활용

파일이 많아지는 것이 싫다면 `application.yml` 하나에 `---`으로 문서를 구분하는 방법도 있습니다.

```yaml
# 공통 설정 (첫 번째 문서)
spring:
  profiles:
    active: dev   # 로컬 기본값

---
# prod 프로파일 전용 설정
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: jdbc:mysql://${DB_HOST}/proddb

---
# dev 프로파일 전용 설정
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:h2:mem:devdb
```

단일 파일 방식은 설정이 단순할 때 편리하지만, 설정이 복잡해지면 가독성이 떨어집니다. 실무에서는 프로파일 수가 늘어날수록 **분리 파일** 방식이 관리하기 쉽습니다.

## 프로파일 활성화 방법

```bash
# 1. 커맨드라인 인수 (가장 높은 우선순위)
java -jar app.jar --spring.profiles.active=prod

# 2. JVM 시스템 속성
java -Dspring.profiles.active=prod -jar app.jar

# 3. OS 환경 변수 (쿠버네티스 / Docker에서 주로 사용)
export SPRING_PROFILES_ACTIVE=prod

# 4. application.yml 기본값 (로컬 개발 편의)
# spring.profiles.active: dev
```

**운영 환경에서는 반드시 외부에서 주입**해야 합니다. `application.yml`에 `spring.profiles.active: prod`를 하드코딩하면 개발자가 실수로 운영 설정으로 로컬 테스트를 할 수 있습니다.

## @Profile로 빈 조건부 등록

![@Profile 애노테이션과 프로파일 전용 yml 코드 예시](/assets/posts/springboot-profiles-code.svg)

설정 값뿐만 아니라 **빈 자체를 프로파일별로 다르게 등록**할 수 있습니다.

```java
public interface MailService {
    void send(String to, String subject, String body);
}

@Profile("prod")
@Service
public class SmtpMailService implements MailService {
    // 실제 SMTP 서버로 메일 전송
    @Override
    public void send(String to, String subject, String body) {
        // JavaMailSender 사용
    }
}

@Profile({"dev", "test"})
@Service
public class StubMailService implements MailService {
    @Override
    public void send(String to, String subject, String body) {
        log.info("[STUB] 메일 전송: to={}, subject={}", to, subject);
        // 실제로 전송하지 않음
    }
}
```

이 패턴을 사용하면 테스트에서 실제 메일 서버 없이도 전체 플로우를 검증할 수 있습니다. 결제 모듈, 문자 발송, 외부 API 호출 등 부수 효과가 있는 컴포넌트에 적용합니다.

## 프로파일 그룹

Spring Boot 2.4부터 여러 프로파일을 **논리적으로 묶는** 프로파일 그룹을 지원합니다.

```yaml
spring:
  profiles:
    group:
      dev: local, dev-db, mock-external
      prod: prod-db, monitoring, sentry
```

`--spring.profiles.active=dev` 하나로 `local`, `dev-db`, `mock-external` 세 프로파일이 동시에 활성화됩니다. 복잡한 환경 구성을 한 줄로 표현할 수 있습니다.

## 테스트에서 프로파일 지정

```java
@SpringBootTest
@ActiveProfiles("test")
class OrderServiceIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Test
    void 주문생성_성공() {
        // test 프로파일 — StubMailService 사용, 실제 메일 미발송
        Order order = orderService.createOrder(new OrderRequest(...));
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
    }
}
```

`@ActiveProfiles`를 사용하면 테스트 클래스 단위로 프로파일을 지정할 수 있습니다. `@TestPropertySource`와 함께 사용하면 특정 테스트 케이스만을 위한 설정 오버라이드도 가능합니다.

## 실무 주의사항

**함정 1: 운영 프로파일 기본값**

```yaml
# 절대 금지
spring:
  profiles:
    active: prod
```

`application.yml`에 `prod`를 기본값으로 넣으면, 개발자가 프로파일 없이 실행할 때 운영 DB에 연결됩니다. 로컬 기본값은 항상 `dev`나 `local`이어야 합니다.

**함정 2: 프로파일 전용 파일에 공통 설정 넣기**

`application-prod.yml`에 `server.port=8080`처럼 모든 환경에서 동일한 설정을 중복으로 넣으면 나중에 값이 달라져 혼란이 생깁니다. 공통 설정은 `application.yml`에만 두세요.

**함정 3: `!prod` 부정 표현**

```java
@Profile("!prod")   // prod가 아닌 모든 환경
@Bean
public DataSource mockDataSource() { ... }
```

부정 프로파일은 새 환경(staging)이 추가될 때 자동으로 포함됩니다. `dev`와 `test`만 원했는데 예상치 못한 환경에서도 목(mock) 빈이 활성화될 수 있으니 신중하게 사용해야 합니다.

## 정리

- `application-{profile}.yml` 파일로 환경별 설정 분리, 공통은 `application.yml`에
- 운영 환경 프로파일은 반드시 외부 주입 — yml에 `prod` 기본값 절대 금지
- `@Profile`로 빈 자체를 조건부 등록 — 부수 효과 컴포넌트(메일, 결제)에 효과적
- 프로파일 그룹으로 여러 프로파일 묶음 관리
- 테스트에서는 `@ActiveProfiles("test")`로 격리된 환경 구성

---

**지난 글:** [Spring Boot 설정 외부화 완전 정복](/posts/springboot-properties-config/)

**다음 글:** [Spring Boot Auto-Configuration 동작 원리 완전 정복](/posts/springboot-autoconfiguration/)

<br>
읽어주셔서 감사합니다. 😊
