---
title: "Jackson 심층 분석 — JSON 직렬화·역직렬화 완전 정복"
description: "Spring Boot에서 Jackson ObjectMapper를 깊이 이해하고 제어하는 방법을 다룹니다. 직렬화·역직렬화 파이프라인, 주요 어노테이션(@JsonProperty, @JsonIgnore, @JsonFormat, @JsonInclude), 날짜 타입 처리(LocalDate·Instant), 다형성 처리(@JsonTypeInfo), 커스텀 Serializer/Deserializer 구현, ObjectMapper 전역 설정 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Jackson", "JSON", "직렬화", "역직렬화", "ObjectMapper", "JsonProperty", "JsonIgnore", "다형성", "커스텀직렬화"]
featured: false
draft: false
---

[지난 글](/posts/spring-rest-restdocs/)에서 API 문서화 전략을 살펴봤습니다. REST API에서 문서만큼 중요한 것이 요청·응답 본문의 JSON 변환입니다. Spring Boot는 **Jackson**을 기본 JSON 라이브러리로 사용합니다. `@RestController`가 반환하는 객체가 JSON이 되고, 요청 본문 JSON이 파라미터 객체로 바인딩되는 모든 과정에 Jackson의 `ObjectMapper`가 동작합니다. Jackson의 동작 원리를 정확히 이해하면 예상치 못한 직렬화 결과나 역직렬화 오류를 빠르게 해결하고, 원하는 JSON 형태를 정확하게 제어할 수 있습니다.

## Jackson ObjectMapper 동작 파이프라인

![Jackson ObjectMapper 직렬화 흐름](/assets/posts/spring-jackson-deepdive-overview.svg)

`ObjectMapper`는 Java 객체와 JSON 텍스트 사이의 변환 허브입니다. 직렬화 시에는 `JsonGenerator`로 토큰을 써내려가고, 역직렬화 시에는 `JsonParser`로 토큰을 읽어 Java 객체의 필드에 값을 채웁니다. 내부적으로 `SerializerProvider`, `DeserializationContext`, `TypeFactory`, `InjectableValues` 등의 컴포넌트가 협력합니다.

Spring Boot는 `JacksonAutoConfiguration`으로 `ObjectMapper` Bean을 자동 구성합니다. `Jackson2ObjectMapperBuilderCustomizer` Bean을 등록하면 이 전역 `ObjectMapper`의 설정을 커스터마이징할 수 있습니다.

## 핵심 어노테이션

### @JsonProperty — 필드 이름 매핑

Java 필드명과 JSON 키 이름을 다르게 매핑합니다.

```java
public record UserResponse(
    @JsonProperty("user_id") Long id,
    @JsonProperty("email_address") String email
) {}
```

결과:
```json
{ "user_id": 1, "email_address": "user@example.com" }
```

클래스 레벨에서 전체 전략을 지정하려면 `@JsonNaming`을 사용합니다.

```java
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record UserResponse(Long userId, String emailAddress) {}
// → { "user_id": 1, "email_address": "..." }
```

### @JsonIgnore — 필드 제외

직렬화·역직렬화 모두에서 해당 필드를 무시합니다.

```java
public class UserEntity {
    private Long id;
    private String email;

    @JsonIgnore
    private String password;  // 절대 JSON에 포함하면 안 되는 필드
}
```

여러 필드를 한 번에 제외하려면 클래스 레벨에서 `@JsonIgnoreProperties`를 사용합니다.

```java
@JsonIgnoreProperties({"password", "salt", "internalStatus"})
public class UserEntity { ... }
```

역직렬화 시 모르는 필드를 무시하려면:

```java
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserRequest { ... }
```

### @JsonInclude — null/빈 값 제외

null 필드를 JSON에 포함하지 않으려면 `@JsonInclude`를 사용합니다.

```java
@JsonInclude(JsonInclude.Include.NON_NULL)
public record UserResponse(
    Long id,
    String email,
    String phoneNumber  // null이면 JSON에서 생략됨
) {}
```

주요 Include 전략:

| 전략 | 설명 |
|---|---|
| `NON_NULL` | null 값 제외 |
| `NON_EMPTY` | null·빈 문자열·빈 컬렉션 제외 |
| `NON_ABSENT` | null·Optional.empty() 제외 |
| `ALWAYS` | 항상 포함 (기본값) |

### @JsonFormat — 날짜·숫자 포맷

날짜/시간 타입의 출력 형식을 지정합니다.

```java
public record OrderResponse(
    Long id,

    @JsonFormat(shape = JsonFormat.Shape.STRING,
                pattern = "yyyy-MM-dd HH:mm:ss",
                timezone = "Asia/Seoul")
    LocalDateTime createdAt,

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    BigDecimal amount  // 숫자를 문자열로 직렬화 (JavaScript number 정밀도 문제 방지)
) {}
```

## 날짜 타입 처리

Jackson은 기본적으로 `LocalDate`, `LocalDateTime`, `Instant` 등 Java 8 날짜 타입을 타임스탬프 숫자로 직렬화합니다. `jackson-datatype-jsr310` 모듈을 등록하면 ISO 8601 문자열로 처리합니다.

```java
// ObjectMapper에 Java 8 날짜 모듈 등록
objectMapper.registerModule(new JavaTimeModule());
objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
```

Spring Boot는 클래스패스에 `jackson-datatype-jsr310`이 있으면 자동으로 등록합니다. `application.yml`에서 제어할 수 있습니다.

```yaml
spring:
  jackson:
    serialization:
      write-dates-as-timestamps: false  # ISO 8601 형식으로 출력
    time-zone: Asia/Seoul
    date-format: "yyyy-MM-dd HH:mm:ss"
```

## @JsonInclude 전역 설정

모든 DTO에 `@JsonInclude(NON_NULL)`을 붙이는 대신 전역으로 설정합니다.

```yaml
spring:
  jackson:
    default-property-inclusion: non_null
```

또는 Java 설정:

```java
@Bean
public Jackson2ObjectMapperBuilderCustomizer customizer() {
    return builder -> builder
            .serializationInclusion(JsonInclude.Include.NON_NULL);
}
```

## @JsonCreator와 역직렬화 생성자

불변 객체나 생성자 파라미터가 있는 클래스의 역직렬화에는 `@JsonCreator`를 사용합니다.

```java
public class Money {
    private final long amount;
    private final String currency;

    @JsonCreator
    public Money(
            @JsonProperty("amount") long amount,
            @JsonProperty("currency") String currency) {
        this.amount = amount;
        this.currency = currency;
    }
}
```

Record 타입은 기본적으로 컴팩트 생성자를 통해 역직렬화됩니다. `@JsonProperty`를 파라미터에 붙여 JSON 키를 매핑합니다.

## 다형성 처리 — @JsonTypeInfo와 @JsonSubTypes

상속 계층이 있는 객체를 JSON으로 주고받을 때 타입 정보를 포함시킵니다.

```java
@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
)
@JsonSubTypes({
    @JsonSubTypes.Type(value = CreditCard.class, name = "credit"),
    @JsonSubTypes.Type(value = BankTransfer.class, name = "bank")
})
public abstract class Payment { ... }
```

직렬화 결과:
```json
{ "type": "credit", "cardNumber": "1234-5678", "expiryDate": "2028-12" }
```

역직렬화 시 `"type"` 필드 값으로 적절한 하위 클래스를 선택합니다.

## 커스텀 Serializer / Deserializer

![Jackson 커스텀 직렬화 코드](/assets/posts/spring-jackson-deepdive-code.svg)

표준 어노테이션으로 해결되지 않을 때 `JsonSerializer`/`JsonDeserializer`를 직접 구현합니다.

```java
// 커스텀 Deserializer — "KRW 10,000" 문자열을 Money 객체로
public class MoneyDeserializer extends JsonDeserializer<Money> {

    @Override
    public Money deserialize(JsonParser p, DeserializationContext ctx)
            throws IOException {
        String raw = p.getText();  // "KRW 10000"
        String[] parts = raw.split(" ");
        return new Money(Long.parseLong(parts[1]), parts[0]);
    }
}

// 필드에 적용
public record PriceRequest(
    @JsonSerialize(using = MoneySerializer.class)
    @JsonDeserialize(using = MoneyDeserializer.class)
    Money price
) {}
```

## ObjectMapper 전역 설정

```java
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer customizer() {
        return builder -> builder
                // Java 8 날짜 → ISO 8601 문자열
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                // 전역 네이밍 전략: camelCase → snake_case
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                // null 필드 제외
                .serializationInclusion(JsonInclude.Include.NON_NULL)
                // 알 수 없는 필드 무시
                .featuresToDisable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                // 커스텀 시리얼라이저 등록
                .serializerByType(Money.class, new MoneySerializer())
                .deserializerByType(Money.class, new MoneyDeserializer());
    }
}
```

`Jackson2ObjectMapperBuilderCustomizer`는 Spring Boot가 관리하는 전역 `ObjectMapper`를 건드리므로 모든 `@RestController`의 JSON 처리에 영향을 미칩니다.

## ObjectMapper 인스턴스 직접 사용 시 주의사항

`ObjectMapper`는 스레드 세이프합니다. 단, `configure()`, `registerModule()` 같은 설정 변경 메서드는 스레드 세이프하지 않습니다. Bean으로 등록된 `ObjectMapper`를 공유해서 읽기 전용으로 사용해야 합니다.

```java
@Component
public class JsonUtils {

    private final ObjectMapper objectMapper;

    public JsonUtils(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;  // Spring이 주입하는 공유 인스턴스
    }

    public String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("JSON 변환 실패", e);
        }
    }

    public <T> T fromJson(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("JSON 파싱 실패", e);
        }
    }
}
```

## 정리

Jackson은 단순한 JSON 변환 도구가 아니라 타입 시스템, 다형성, 커스텀 변환 로직을 모두 지원하는 강력한 데이터 매핑 프레임워크입니다. 실무에서 자주 쓰는 패턴은 `@JsonProperty`로 네이밍 전략을 정하고, `@JsonIgnore`와 `@JsonInclude(NON_NULL)`로 응답 크기를 줄이며, 날짜 타입은 `WRITE_DATES_AS_TIMESTAMPS=false`로 ISO 8601 형식을 쓰는 것입니다. 복잡한 타입은 커스텀 Serializer/Deserializer로 완전히 제어합니다. `ObjectMapper` 전역 설정은 `Jackson2ObjectMapperBuilderCustomizer` Bean 하나로 일관되게 관리하는 것이 유지보수에 유리합니다.

---

**지난 글:** [Spring REST Docs — 테스트 기반 API 문서 자동화](/posts/spring-rest-restdocs/)

<br>
읽어주셔서 감사합니다. 😊
