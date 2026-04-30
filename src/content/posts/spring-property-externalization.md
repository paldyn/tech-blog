---
title: "Spring Property 외부화: @Value부터 Environment까지"
description: "Spring에서 설정 값을 코드 밖으로 꺼내는 방법을 다룹니다. @Value의 ${...}와 #{...} 문법, @PropertySource, Environment API, 그리고 PropertySource 우선순위 체계를 예제 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "PropertySource", "Value", "Environment", "Configuration"]
featured: false
draft: false
---

[지난 글](/posts/spring-bean-postprocessor/)에서는 BeanPostProcessor가 빈 생명주기에 어떻게 끼어드는지 살펴봤습니다. 이번에는 실무에서 매일 마주치는 주제인 **설정 값 외부화**입니다. 데이터베이스 URL, 포트 번호, API 키 같은 값이 소스 코드에 하드코딩되어 있으면 환경마다 빌드를 다시 해야 합니다. Spring은 이 문제를 `PropertySource`라는 추상 계층으로 해결합니다.

## 왜 외부화가 필요한가

```java
// 나쁜 예: 코드에 박혀 있는 설정값
@Service
public class MailService {
    private static final String HOST = "smtp.gmail.com";
    private static final int PORT = 587;
}
```

개발·스테이징·운영 환경이 다른 서버를 써야 할 때, 위 코드는 환경마다 다른 JAR를 빌드해야 합니다. 한 번 빌드해서 여러 환경에 배포하려면 값을 코드 밖으로 꺼내야 합니다.

## PropertySource 우선순위 체계

![Property Source 우선순위 계층](/assets/posts/spring-property-externalization-layers.svg)

Spring은 여러 소스에서 프로퍼티를 읽어 하나의 `Environment` 객체에 합칩니다. 동일한 키가 여러 소스에 있으면 **우선순위가 높은 쪽이 이깁니다**.

```
JVM -D 인수 > OS 환경 변수 > @PropertySource > application.properties > 코드 내 기본값
```

이 구조를 이해하면 운영 서버에서 환경 변수를 바꾸는 것만으로 설정 값을 오버라이드할 수 있습니다.

## @PropertySource로 파일 로드

```java
@Configuration
@PropertySource("classpath:mail.properties")
@PropertySource("classpath:db.properties")
public class InfraConfig {
    // PropertySourcesPlaceholderConfigurer 필요 시 @Bean으로 등록
}
```

`mail.properties`:
```properties
mail.host=smtp.example.com
mail.port=587
mail.auth=true
```

`@PropertySource`에 지정한 파일은 `classpath:` 외에도 `file:` 프로토콜을 쓸 수 있습니다. Spring Boot에서는 `application.properties` / `application.yml`이 자동으로 로드되므로 일반적으로 `@PropertySource`가 필요 없습니다. 순수 Spring을 사용하는 경우에만 명시적으로 등록합니다.

## @Value로 주입

![](/assets/posts/spring-property-externalization-value.svg)

`@Value`는 `${...}` 프로퍼티 치환과 `#{...}` SpEL 표현식을 모두 지원합니다.

```java
@Component
public class AppSettings {

    @Value("${app.name}")
    private String appName;

    @Value("${app.timeout:30}")
    private int timeout;             // 키 없으면 30 사용

    @Value("${app.admins:}")
    private List<String> admins;     // 빈 문자열 → 빈 List

    @Value("#{T(java.time.ZoneId).of('Asia/Seoul')}")
    private java.time.ZoneId zoneId; // SpEL로 객체 생성
}
```

### ${...} — 프로퍼티 치환

```
${key}          // 필수 키, 없으면 BeanCreationException
${key:default}  // 키 없을 때 default 값 사용
${key:}         // 키 없을 때 빈 문자열 사용
```

쉼표로 구분된 값을 `List<String>`으로 바로 받을 수 있습니다.

```properties
# application.properties
app.allowed-ips=192.168.1.1,10.0.0.1,127.0.0.1
```

```java
@Value("${app.allowed-ips}")
private List<String> allowedIps;
```

Spring의 `ConversionService`가 문자열을 `List`, `Set`, `int[]` 등으로 자동 변환합니다.

### #{...} — SpEL 표현식

SpEL은 다른 빈을 참조하거나 메서드를 호출하는 등 복잡한 표현이 가능합니다.

```java
// 다른 빈의 프로퍼티 참조
@Value("#{appProperties.maxRetry + 1}")
private int effectiveMaxRetry;

// 시스템 프로퍼티 직접 조회
@Value("#{systemProperties['java.version']}")
private String javaVersion;

// 조건 표현식
@Value("#{${app.timeout:30} > 60 ? 60 : ${app.timeout:30}}")
private int cappedTimeout;
```

## Environment API 직접 사용

`@Value`는 빈 생성 시점에 한 번만 주입됩니다. 런타임에 동적으로 설정 값을 읽어야 하거나, 키 존재 여부를 검사해야 할 때는 `Environment`를 직접 주입합니다.

```java
@Service
public class FeatureGate {

    private final Environment env;

    public FeatureGate(Environment env) {
        this.env = env;
    }

    public boolean isEnabled(String feature) {
        return env.getProperty(
            "feature." + feature, Boolean.class, false);
    }

    public int getMaxConnections() {
        String key = "db.pool.max";
        if (!env.containsProperty(key)) {
            throw new IllegalStateException(key + " 프로퍼티 누락");
        }
        return env.getRequiredProperty(key, Integer.class);
    }
}
```

`env.getProperty(key, type, default)` 형태는 타입 변환과 기본값을 한 번에 처리합니다.

## PropertySourcesPlaceholderConfigurer

순수 Spring XML이나 `@Configuration`에서 `${...}` 치환이 동작하려면 이 빈이 필요합니다.

```java
@Configuration
@PropertySource("classpath:app.properties")
public class AppConfig {

    // static 메서드로 선언해야 다른 빈보다 먼저 로드됨
    @Bean
    public static PropertySourcesPlaceholderConfigurer pspc() {
        return new PropertySourcesPlaceholderConfigurer();
    }
}
```

Spring Boot는 `PropertySourcesPlaceholderConfigurer`를 자동 구성합니다. 하지만 순수 Spring 애플리케이션에서는 이 빈을 직접 등록하지 않으면 `@Value("${...}")` 가 문자열 그대로 주입되는 당황스러운 현상이 발생합니다.

## 활성 프로파일과 프로퍼티

프로파일별로 다른 설정 파일을 자동으로 로드할 수 있습니다.

```java
@Configuration
@Profile("prod")
@PropertySource("classpath:prod.properties")
public class ProdConfig { }

@Configuration
@Profile("dev")
@PropertySource("classpath:dev.properties")
public class DevConfig { }
```

Spring Boot에서는 `application-{profile}.properties` 네이밍 컨벤션을 쓰면 파일이 자동 로드됩니다.

```properties
# application-dev.properties
mail.host=localhost
mail.port=1025   # MailHog 포트

# application-prod.properties
mail.host=smtp.sendgrid.net
mail.port=587
```

## 커스텀 PropertySource 등록

데이터베이스나 외부 설정 서버에서 값을 읽어야 한다면 `PropertySource`를 직접 구현합니다.

```java
public class DbPropertySource
        extends PropertySource<DataSource> {

    public DbPropertySource(DataSource ds) {
        super("database", ds);
    }

    @Override
    public Object getProperty(String name) {
        // DB에서 name 키로 설정 조회
        return queryConfig(getSource(), name);
    }
}
```

등록은 `ApplicationContextInitializer`나 `EnvironmentPostProcessor`에서 수행합니다.

## @Value의 함정

- **static 필드 불가**: `static @Value` 필드는 주입되지 않습니다. 인스턴스 필드 또는 생성자 파라미터를 사용하세요.
- **BPP 내 @Value**: BPP 빈은 일찍 초기화되어 `@Value` 주입이 보장되지 않습니다.
- **테스트 시 주의**: `@SpringBootTest`가 없으면 `@Value` 주입 없이 null이 됩니다. `@TestPropertySource`로 테스트용 프로퍼티를 지정합니다.

```java
@SpringBootTest
@TestPropertySource(properties = {"mail.host=localhost", "mail.port=1025"})
class MailServiceTest {
    // ...
}
```

## 핵심 정리

- **우선순위**: JVM -D > OS 환경 변수 > `@PropertySource` > `application.properties` > `@Value` 기본값
- **${...}**: PropertySource에서 값을 찾아 치환. 없으면 예외
- **#{...}**: SpEL 표현식. 다른 빈·메서드 참조 가능
- **Environment API**: 런타임 동적 조회, 타입 안전 조회
- **Spring Boot**: `application.properties` 자동 로드, PSPC 자동 구성

---

**지난 글:** [BeanPostProcessor: Spring 확장 포인트의 핵심](/posts/spring-bean-postprocessor/)

**다음 글:** [Spring AOP 개념: 횡단 관심사를 분리하는 방법](/posts/spring-aop-concept/)

<br>
읽어주셔서 감사합니다. 😊
