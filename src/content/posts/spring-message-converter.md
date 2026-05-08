---
title: "Spring HttpMessageConverter: JSON·XML 자동 변환의 핵심 원리"
description: "HttpMessageConverter의 개념과 등록 메커니즘, MappingJackson2HttpMessageConverter의 동작 원리, produces/consumes 설정, 커스텀 컨버터 추가까지 Spring MVC의 메시지 변환 파이프라인을 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "HttpMessageConverter", "MappingJackson2", "ContentNegotiation", "produces", "consumes", "JSON", "직렬화", "역직렬화"]
featured: false
draft: false
---

[지난 글](/posts/spring-static-resources/)에서 정적 리소스 서빙 전략을 살펴봤습니다. 이번에는 API 응답에서 Java 객체가 JSON으로 변환되는 과정, 즉 **HttpMessageConverter** 파이프라인의 내부를 파헤칩니다. 컨트롤러가 `User` 객체를 반환하면 클라이언트는 JSON 문자열을 받습니다. 이 마법 같은 변환을 담당하는 것이 바로 `HttpMessageConverter`입니다.

## HttpMessageConverter란

`HttpMessageConverter<T>`는 HTTP 요청 바디를 Java 객체로 **역직렬화(read)** 하거나, Java 객체를 HTTP 응답 바디로 **직렬화(write)** 하는 전략 인터페이스입니다.

```java
public interface HttpMessageConverter<T> {
    boolean canRead(Class<?> clazz, MediaType mediaType);
    boolean canWrite(Class<?> clazz, MediaType mediaType);
    List<MediaType> getSupportedMediaTypes();
    T read(Class<? extends T> clazz, HttpInputMessage inputMessage) throws IOException;
    void write(T t, MediaType contentType, HttpOutputMessage outputMessage) throws IOException;
}
```

`canRead()` · `canWrite()`는 해당 타입과 미디어 타입 조합을 처리할 수 있는지 판단합니다. Spring은 등록된 컨버터를 우선순위 순으로 순회하며 첫 번째로 `canRead()` 또는 `canWrite()`가 `true`를 반환하는 컨버터를 선택합니다.

![HttpMessageConverter 처리 흐름](/assets/posts/spring-message-converter-flow.svg)

## 기본 등록 컨버터

Spring Boot는 클래스패스에 Jackson이 있으면 다음 컨버터를 자동 등록합니다.

| 컨버터 | 처리 미디어 타입 |
|---|---|
| `ByteArrayHttpMessageConverter` | `application/octet-stream`, `*/*` |
| `StringHttpMessageConverter` | `text/plain`, `text/*`, `*/*` |
| `FormHttpMessageConverter` | `application/x-www-form-urlencoded` |
| `MappingJackson2HttpMessageConverter` | `application/json`, `application/*+json` |
| `MappingJackson2XmlHttpMessageConverter` | `application/xml` (Jackson-Dataformat-XML 필요) |

`MappingJackson2HttpMessageConverter`는 `ObjectMapper`를 사용해 실제 JSON 변환을 수행합니다. Spring Boot AutoConfiguration이 `ObjectMapper` 빈을 생성하고 이 컨버터에 주입하므로, `@JsonProperty`, `@JsonIgnore` 같은 Jackson 어노테이션이 자동으로 동작합니다.

## @RequestBody · @ResponseBody와의 연동

`@RequestBody`가 붙은 파라미터를 만나면 `RequestMappingHandlerAdapter`가 컨버터 체인을 순회합니다.

```java
@PostMapping("/users")
public ResponseEntity<UserResponse> createUser(
        @RequestBody UserRequest request) {   // canRead() 호출
    User saved = userService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED)
                         .body(UserResponse.from(saved)); // canWrite() 호출
}
```

요청 시에는 `Content-Type` 헤더를 기준으로 `canRead()`를 판단하고, 응답 시에는 클라이언트의 `Accept` 헤더와 `produces` 속성을 비교해 `canWrite()`를 판단합니다.

## Content Negotiation: produces와 consumes

`produces`와 `consumes`는 컨버터 선택 범위를 명시적으로 제한합니다.

```java
@GetMapping(
    value = "/reports/{id}",
    produces = {MediaType.APPLICATION_JSON_VALUE,
                MediaType.APPLICATION_XML_VALUE}
)
public ReportDto getReport(@PathVariable Long id) {
    return reportService.findById(id);
}

@PostMapping(
    value = "/upload",
    consumes = MediaType.MULTIPART_FORM_DATA_VALUE
)
public ResponseEntity<Void> upload(
        @RequestPart MultipartFile file) {
    // ...
    return ResponseEntity.ok().build();
}
```

클라이언트가 `Accept: application/xml`을 보내면 Spring은 `produces` 목록에서 일치 여부를 확인합니다. 지원하지 않는 미디어 타입이 요청되면 **406 Not Acceptable**을 반환합니다. `produces`를 생략하면 모든 컨버터가 후보가 됩니다.

## 커스텀 컨버터 추가

YAML, Protobuf, CSV 등 표준 컨버터가 처리하지 못하는 형식은 직접 구현해 등록합니다.

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void extendMessageConverters(
            List<HttpMessageConverter<?>> converters) {
        // 기존 컨버터 유지, 0번 위치에 최우선 등록
        converters.add(0, new CsvHttpMessageConverter());
    }
}
```

`configureMessageConverters()`를 오버라이드하면 Boot가 자동 등록한 컨버터가 **사라집니다**. 기존 컨버터를 유지하면서 추가만 하려면 반드시 `extendMessageConverters()`를 사용해야 합니다.

커스텀 컨버터 골격은 다음과 같습니다.

```java
public class CsvHttpMessageConverter
        extends AbstractHttpMessageConverter<List<String[]>> {

    public CsvHttpMessageConverter() {
        super(new MediaType("text", "csv"));
    }

    @Override
    protected boolean supports(Class<?> clazz) {
        return List.class.isAssignableFrom(clazz);
    }

    @Override
    protected List<String[]> readInternal(
            Class<? extends List<String[]>> clazz,
            HttpInputMessage inputMessage) throws IOException {
        // CSV 파싱 로직
        return parseCsv(inputMessage.getBody());
    }

    @Override
    protected void writeInternal(
            List<String[]> rows,
            HttpOutputMessage outputMessage) throws IOException {
        // CSV 직렬화 로직
        writeCsv(rows, outputMessage.getBody());
    }
}
```

![MessageConverter 실전 설정 패턴](/assets/posts/spring-message-converter-code.svg)

## ObjectMapper 커스터마이징

`MappingJackson2HttpMessageConverter`가 사용하는 `ObjectMapper`를 커스터마이징하면 전역 직렬화 동작을 변경할 수 있습니다.

```java
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer customizer() {
        return builder -> builder
            .featuresToDisable(
                SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .featuresToEnable(
                MapperFeature.DEFAULT_VIEW_INCLUSION)
            .modules(new JavaTimeModule())
            .timeZone(TimeZone.getTimeZone("Asia/Seoul"));
    }
}
```

`Jackson2ObjectMapperBuilderCustomizer`는 Boot AutoConfiguration이 생성하는 `ObjectMapper`에 적용됩니다. 직접 `ObjectMapper` 빈을 선언하면 AutoConfiguration이 물러나므로 주의합니다.

## 디버깅 팁

변환 과정에서 문제가 생기면 다음 로그 레벨을 올려 어떤 컨버터가 선택됐는지 확인합니다.

```yaml
logging:
  level:
    org.springframework.web.servlet.mvc.method: TRACE
    org.springframework.http.converter: DEBUG
```

`canRead()` · `canWrite()` 판단 과정과 최종 선택된 컨버터가 로그에 출력됩니다.

## 정리

- `HttpMessageConverter`는 HTTP 바디 ↔ Java 객체 변환의 전략 인터페이스
- Boot + Jackson 조합에서 `MappingJackson2HttpMessageConverter`는 자동 등록
- `canRead()` · `canWrite()`로 컨버터를 순차 선택하며, 첫 매칭 컨버터 사용
- `produces` / `consumes`로 허용 미디어 타입을 명시하면 406 오류를 예방
- 커스텀 컨버터는 `extendMessageConverters()`로 등록해야 기존 컨버터를 보존

---

**다음 글:** [Spring @RestController 완전 정복: @Controller와 차이, ResponseEntity 활용법](/posts/spring-restcontroller/)

<br>
읽어주셔서 감사합니다. 😊
