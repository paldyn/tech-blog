---
title: "Spring Boot @ConfigurationProperties 완전 정복"
description: "Spring Boot의 타입 안전 설정 바인딩 메커니즘인 @ConfigurationProperties를 깊이 이해합니다. @Value와의 차이, 중첩 객체·List·Map·Duration 바인딩, @Validated로 설정값 검증, Relaxed Binding 규칙, Configuration Processor로 IDE 자동완성 활성화, 그리고 테스트에서의 활용 방법까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "ConfigurationProperties", "설정바인딩", "타입안전", "Validated", "RelaxedBinding"]
featured: false
draft: false
---

[지난 글](/posts/springboot-devtools-livereload/)에서 DevTools로 개발 생산성을 높이는 방법을 살펴봤습니다. 이번에는 Spring Boot 설정 체계의 핵심인 **`@ConfigurationProperties`**를 다룹니다. `@Value`에 익숙하다면, `@ConfigurationProperties`가 왜 더 나은 선택인지 이해하게 될 것입니다.

## @Value의 한계

```java
@Component
public class MailService {

    @Value("${mail.host}")
    private String host;

    @Value("${mail.port}")
    private int port;

    @Value("${mail.username}")
    private String username;

    @Value("${mail.password}")
    private String password;

    @Value("${mail.ssl.enabled:false}")
    private boolean sslEnabled;
}
```

이 방식에는 몇 가지 문제가 있습니다. 설정 키가 늘어날수록 필드 선언이 무한정 증가합니다. SpEL 문자열에 오타가 있어도 컴파일 타임에 잡히지 않고 런타임에 실패합니다. `List`나 `Map` 같은 복잡한 타입을 바인딩하기가 불편합니다.

## @ConfigurationProperties 기본 사용

![ConfigurationProperties 개요](/assets/posts/springboot-configuration-properties-concept.svg)

```java
// MailProperties.java
@ConfigurationProperties(prefix = "mail")
public class MailProperties {

    private String host;
    private int port = 25; // 기본값 지정 가능
    private String username;
    private String password;
    private Ssl ssl = new Ssl();

    public static class Ssl {
        private boolean enabled = false;
        private String keyStore;
        // getter/setter ...
    }

    // getter/setter ...
}
```

```properties
# application.properties
mail.host=smtp.example.com
mail.port=587
mail.username=user@example.com
mail.password=secret
mail.ssl.enabled=true
mail.ssl.key-store=classpath:mail.p12
```

`@ConfigurationProperties`를 활성화하려면 `@EnableConfigurationProperties` 또는 `@ConfigurationPropertiesScan`이 필요합니다.

```java
// AppConfig.java 또는 메인 클래스
@SpringBootApplication
@ConfigurationPropertiesScan  // 패키지 내 @ConfigurationProperties 자동 탐색
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

이제 `MailProperties`는 빈으로 등록되어 주입받을 수 있습니다.

```java
@Service
public class MailService {

    private final MailProperties props;

    public MailService(MailProperties props) {
        this.props = props;
    }

    public void send(String to, String subject) {
        // props.getHost(), props.getPort() 사용
    }
}
```

## Java Record로 불변 설정 만들기 (Spring Boot 2.6+)

```java
@ConfigurationProperties(prefix = "app")
public record AppProperties(
    String name,
    Duration timeout,
    RetryProperties retry,
    List<String> allowedOrigins,
    Map<String, String> headers
) {
    public record RetryProperties(
        int max,
        Duration delay
    ) {}
}
```

Record는 생성자 기반 바인딩(Constructor Binding)을 자동으로 사용합니다. setter가 없으므로 설정이 한번 로딩된 후 변경되지 않습니다. 불변 설정을 선호하는 최신 코드 스타일에 적합합니다.

## Relaxed Binding 규칙

Spring Boot는 설정 키를 여러 형식으로 작성해도 동일하게 인식합니다.

```properties
# 다음 네 가지 모두 allowedOrigins 필드에 바인딩됩니다
app.allowedOrigins=http://a.com
app.allowed-origins=http://a.com
app.allowed_origins=http://a.com
APP_ALLOWED_ORIGINS=http://a.com  # 환경변수 (대문자 + 언더스코어)
```

이 규칙을 **Relaxed Binding**이라고 하며, `kebab-case`(권장), `camelCase`, `snake_case`, `UPPER_CASE`를 모두 지원합니다. 환경변수 이름 제약(특수문자 불가)이 있어도 설정을 주입할 수 있어 컨테이너 환경에서 특히 유용합니다.

## 복잡한 타입 바인딩

```properties
# List 바인딩
app.allowed-origins[0]=http://localhost:3000
app.allowed-origins[1]=https://example.com
# 또는 콤마 구분
app.allowed-origins=http://localhost:3000,https://example.com

# Map 바인딩
app.headers.X-Custom-Header=value1
app.headers.X-Another-Header=value2

# Duration 바인딩 (ISO 8601 또는 Spring 표기법)
app.timeout=30s     # 30초
app.cache-ttl=PT2H  # 2시간 (ISO 8601)
app.delay=500ms     # 500밀리초

# DataSize 바인딩
app.max-upload-size=10MB
app.buffer-size=8KB
```

`Duration`, `DataSize` 바인딩은 `@Value`로는 처리하기 까다롭지만 `@ConfigurationProperties`에서는 기본으로 지원합니다.

## @Validated로 설정값 검증

![검증 및 메타데이터](/assets/posts/springboot-configuration-properties-validation.svg)

잘못된 설정값이 들어왔을 때 애플리케이션이 조용히 실행되는 것보다 **시작 단계에서 실패**하는 편이 훨씬 안전합니다.

```java
@ConfigurationProperties(prefix = "mail")
@Validated
public class MailProperties {

    @NotEmpty(message = "SMTP 호스트는 필수입니다")
    private String host;

    @Min(value = 1, message = "포트는 1 이상이어야 합니다")
    @Max(value = 65535, message = "포트는 65535 이하여야 합니다")
    private int port;

    @NotNull
    @Valid  // 중첩 객체 검증 활성화
    private Ssl ssl = new Ssl();

    public static class Ssl {
        @Pattern(regexp = ".*\\.p12$", message = "PKCS12 형식만 지원합니다")
        private String keyStore;
        // ...
    }
    // getter/setter ...
}
```

검증에 실패하면 애플리케이션 시작이 즉시 중단되고 어떤 필드가 왜 실패했는지 상세한 메시지가 출력됩니다.

```
Binding to target org.springframework.boot.context.properties.bind.BindException:
  Failed to bind properties under 'mail' to ...MailProperties:
    Property: mail.port
    Value: 70000
    Reason: 포트는 65535 이하여야 합니다
```

`spring-boot-starter-validation` 의존성이 있어야 Bean Validation이 동작합니다.

```kotlin
// build.gradle.kts
implementation("org.springframework.boot:spring-boot-starter-validation")
```

## IDE 자동완성: Configuration Processor

`spring-boot-configuration-processor`를 추가하면 `@ConfigurationProperties` 클래스를 분석해 `META-INF/spring-configuration-metadata.json`을 자동 생성합니다. IntelliJ IDEA와 VS Code가 이 파일을 읽어 `application.properties`에서 자동완성과 문서 힌트를 제공합니다.

```kotlin
// build.gradle.kts
annotationProcessor(
    "org.springframework.boot:spring-boot-configuration-processor"
)
```

Javadoc을 작성하면 IDE 힌트에도 표시됩니다.

```java
/**
 * 메일 서버 SMTP 호스트 주소.
 * 기본값: smtp.example.com
 */
private String host;
```

## 테스트에서 @ConfigurationProperties 사용

```java
@SpringBootTest(properties = {
    "mail.host=test-smtp.example.com",
    "mail.port=25"
})
class MailServiceTest {

    @Autowired
    private MailProperties props;

    @Test
    void hostShouldBeInjected() {
        assertThat(props.getHost()).isEqualTo("test-smtp.example.com");
    }
}
```

특정 `@ConfigurationProperties` 클래스만 로딩하는 슬라이스 테스트도 가능합니다.

```java
@ExtendWith(SpringExtension.class)
@EnableConfigurationProperties(MailProperties.class)
@TestPropertySource(properties = {
    "mail.host=smtp.test.com",
    "mail.port=587"
})
class MailPropertiesTest {

    @Autowired
    private MailProperties props;

    @Test
    void portShouldBeValidated() {
        assertThat(props.getPort()).isEqualTo(587);
    }
}
```

## 정리

`@ConfigurationProperties`는 설정을 코드로 다루는 방식을 한 단계 끌어올립니다. 설정 그룹을 타입이 있는 객체로 묶고, 컴파일 타임에 오류를 잡으며, `@Validated`로 시작 시 검증합니다. Configuration Processor를 추가하면 IDE 자동완성까지 완성됩니다. 프로젝트에 설정 항목이 3개 이상이라면 `@Value` 대신 `@ConfigurationProperties`를 쓰는 것을 강하게 권장합니다.

---

**지난 글:** [Spring Boot DevTools & LiveReload로 개발 생산성 높이기](/posts/springboot-devtools-livereload/)

<br>
읽어주셔서 감사합니다. 😊
