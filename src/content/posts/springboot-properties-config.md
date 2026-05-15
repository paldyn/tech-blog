---
title: "Spring Boot 설정 외부화 완전 정복 — application.properties와 application.yml"
description: "Spring Boot의 외부화 설정(Externalized Configuration) 메커니즘을 완전히 이해합니다. application.properties와 application.yml의 구조 비교, 7단계 우선순위 규칙, @Value와 @ConfigurationProperties 차이, 설정 값 타입 변환, 중첩 구조 바인딩, 설정 메타데이터 자동 완성까지 실무 중심으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "ExternalizedConfiguration", "application.yml", "application.properties", "ConfigurationProperties", "Value", "우선순위", "설정관리"]
featured: false
draft: false
---

[지난 글](/posts/springboot-application-annotation/)에서 `@SpringBootApplication`이 컴포넌트 스캔, 자동 구성, 스프링 설정을 어떻게 하나로 묶는지 살펴봤습니다. 이번에는 그 애플리케이션이 실행될 때 **어디서 설정 값을 읽어오는가** — Spring Boot의 외부화 설정 메커니즘을 파헤칩니다.

## 외부화 설정이란

하드코딩된 값을 코드에서 분리해 **환경마다 다른 값을 코드 변경 없이 주입**할 수 있는 메커니즘입니다. 개발 환경에서는 H2 인메모리 DB를, 운영 환경에서는 MySQL을 바라보게 하려면 코드가 아니라 **설정 파일이나 환경 변수**가 바뀌어야 합니다.

Spring Boot는 17가지 이상의 설정 소스를 지원하며, 각 소스 사이의 **우선순위**가 엄격하게 정해져 있습니다.

## 7단계 우선순위 한눈에 보기

![Spring Boot 외부화 설정 우선순위](/assets/posts/springboot-properties-config-concept.svg)

실무에서 가장 자주 쓰이는 소스를 우선순위 순으로 정리하면 위와 같습니다. **위에 있는 설정이 아래 설정을 덮어씁니다.**

- **커맨드라인 인수**: 배포 스크립트나 컨테이너 `CMD`에서 `--key=value` 형식으로 전달합니다. 가장 높은 우선순위이므로 임시 오버라이드에 유용합니다.
- **OS 환경 변수**: 쿠버네티스 `env`, Docker `-e`, 시스템 환경 변수를 통해 주입합니다. `spring.datasource.url`은 `SPRING_DATASOURCE_URL`로 매핑됩니다.
- **외부 config/ 디렉터리**: JAR와 같은 위치의 `config/application.yml`. 운영 서버에서 설정 파일만 교체하는 방식으로 사용합니다.
- **classpath application.yml**: JAR 내부에 번들된 기본 설정. 소스 코드와 함께 관리합니다.

## application.properties vs application.yml

![application.properties vs application.yml 코드 비교](/assets/posts/springboot-properties-config-code.svg)

두 형식은 **완전히 동일한 표현력**을 가집니다. Spring Boot는 두 형식을 동시에 지원하며 서로 섞어 쓸 수도 있습니다(단, 동일 키가 있으면 우선순위에 따라 결정됩니다).

```yaml
# application.yml — 계층 구조를 시각적으로 표현
spring:
  datasource:
    url: jdbc:h2:mem:testdb
    username: sa
    driver-class-name: org.h2.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

server:
  port: 8080
```

```properties
# application.properties — 플랫한 키-값 구조
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.username=sa
spring.datasource.driver-class-name=org.h2.Driver
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
server.port=8080
```

실무에서는 **yml을 선호**합니다. 중첩 구조에서 같은 프리픽스를 반복하지 않아도 되고, 리스트 표현이 직관적이기 때문입니다. 단, YAML은 들여쓰기 오류가 런타임까지 발견되지 않을 수 있으므로 IDE의 YAML 린터를 활성화하는 것을 권장합니다.

## @Value로 단일 값 주입

`@Value("${프로퍼티키}")` 표현식으로 설정 값을 빈에 직접 주입합니다.

```java
@Component
public class MailService {

    @Value("${mail.sender}")
    private String sender;

    @Value("${mail.max-retry:3}")  // 기본값 지정
    private int maxRetry;

    @Value("${mail.recipients}")   // 콤마 구분 리스트 → List<String>
    private List<String> recipients;
}
```

`@Value`는 SpEL(Spring Expression Language)을 지원하므로 `${key}` 외에도 `#{T(java.lang.Math).PI}` 같은 표현식을 쓸 수 있습니다. 하지만 여러 관련 설정을 한 번에 바인딩해야 할 때는 `@ConfigurationProperties`가 더 적합합니다.

## @ConfigurationProperties — 타입 안전 설정 바인딩

여러 설정 키를 **하나의 POJO에 묶어** 타입 안전하게 사용하는 방법입니다.

```yaml
# application.yml
mail:
  sender: noreply@example.com
  max-retry: 3
  timeout-ms: 5000
  recipients:
    - admin@example.com
    - ops@example.com
```

```java
@ConfigurationProperties(prefix = "mail")
@Component   // 또는 @EnableConfigurationProperties(MailProperties.class)
public class MailProperties {

    private String sender;
    private int maxRetry;
    private long timeoutMs;
    private List<String> recipients = new ArrayList<>();

    // Getter / Setter (Lombok @Data 사용 가능)
}
```

Spring Boot는 **Relaxed Binding**을 적용합니다. `timeoutMs`, `timeout-ms`, `TIMEOUT_MS`, `timeout_ms` 모두 동일한 필드에 바인딩됩니다. `@Value`는 정확한 키 이름만 허용하는 것과 대조적입니다.

`@ConfigurationProperties`의 추가 장점:
- **JSR-303 검증** 적용 가능 (`@Validated` + `@NotNull`, `@Min` 등)
- IDE 자동완성 지원 (spring-boot-configuration-processor 의존성 추가 시)
- 단위 테스트에서 `@BindFromProperties`로 독립 테스트 가능

## 설정 처리기(Configuration Processor) 추가

```groovy
// build.gradle
dependencies {
    annotationProcessor 'org.springframework.boot:spring-boot-configuration-processor'
}
```

이 의존성을 추가하면 빌드 시 `META-INF/spring-configuration-metadata.json`이 생성됩니다. IntelliJ IDEA가 이 파일을 읽어 `application.yml`에서 자동 완성과 타입 정보, Javadoc을 제공합니다.

## 설정 값 검증

```java
@ConfigurationProperties(prefix = "server.pool")
@Validated
@Component
public class PoolProperties {

    @NotBlank
    private String host;

    @Min(1) @Max(65535)
    private int port;

    @Positive
    private int maxPoolSize;
}
```

애플리케이션 기동 시 잘못된 설정 값이 있으면 `BindValidationException`을 던지고 즉시 실패합니다. **빠른 실패(Fail Fast)** 원칙에 따라 잘못된 설정으로 운영 환경에 배포되는 상황을 막아줍니다.

## 설정 값 암호화 주의사항

`application.yml`에 패스워드를 평문으로 넣지 않습니다. 실무에서는 다음 방법을 사용합니다.

- **환경 변수 주입**: `${DB_PASSWORD}` — 쿠버네티스 Secret, Vault, AWS Secrets Manager를 통해 주입
- **Jasypt**: `ENC(암호화된값)` 형식으로 저장, 키는 환경 변수로 분리
- **Spring Cloud Config Server**: 중앙 집중식 설정 서버에서 암호화된 값 조회

```yaml
# 올바른 패턴 — 실제 비밀번호는 환경 변수에서 주입
spring:
  datasource:
    password: ${DB_PASSWORD}
```

## 정리

- properties와 yml은 완전히 동일한 표현력 — yml이 가독성 면에서 우세
- 우선순위: 커맨드라인 > OS 환경 변수 > 외부 파일 > classpath 내부 파일
- 단일 값: `@Value`, 관련 설정 묶음: `@ConfigurationProperties`
- Relaxed Binding으로 `camelCase`, `kebab-case`, `UPPER_SNAKE` 모두 허용
- `@Validated`로 기동 시 검증 — 잘못된 설정이 운영 환경까지 도달하는 것을 방지
- 패스워드 등 민감 정보는 환경 변수나 비밀 관리 도구로 주입

---

**지난 글:** [@SpringBootApplication 완전 정복](/posts/springboot-application-annotation/)

**다음 글:** [Spring Boot Profiles 완전 정복](/posts/springboot-profiles/)

<br>
읽어주셔서 감사합니다. 😊
