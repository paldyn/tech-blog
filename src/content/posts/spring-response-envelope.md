---
title: "API 응답 봉투 패턴 — 일관된 응답 구조 설계"
description: "Spring REST API에서 모든 응답을 하나의 ApiResponse<T> 래퍼로 감싸는 응답 봉투 패턴을 다룹니다. 성공·오류 응답 구조 설계, 정적 팩터리 메서드 구현, ResponseBodyAdvice를 활용한 전역 적용, 그리고 RFC 7807 Problem Details와의 비교까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "ResponseEnvelope", "ApiResponse", "REST", "응답구조", "래퍼패턴", "ResponseBodyAdvice", "글로벌응답"]
featured: false
draft: false
---

[지난 글](/posts/spring-custom-validator/)에서 커스텀 제약 어노테이션을 만들어 비즈니스 규칙을 검증하는 방법을 살펴봤습니다. 입력 데이터를 꼼꼼히 검증하더라도, 그 결과를 클라이언트에 전달하는 **응답 형식**이 엔드포인트마다 제각각이라면 프론트엔드 개발자는 매번 다른 구조를 파싱해야 합니다. 응답 봉투 패턴(Response Envelope Pattern)은 모든 API 응답을 하나의 일관된 구조로 감싸서 이 문제를 해결합니다.

## 왜 봉투 패턴인가

봉투 패턴 없이 REST API를 설계하면 각 엔드포인트가 반환하는 JSON 형태가 다를 수 있습니다. 어떤 엔드포인트는 바로 배열을, 어떤 엔드포인트는 단일 객체를, 오류 시에는 또 다른 구조를 반환합니다. 클라이언트는 각 엔드포인트의 문서를 따로 확인해야 하고, 공통 오류 처리 코드를 재사용하기도 어렵습니다.

봉투 패턴을 적용하면 **성공이든 오류든 항상 동일한 바깥 구조**를 갖습니다.

![API 응답 봉투 구조](/assets/posts/spring-response-envelope-structure.svg)

`success` 필드로 성공·실패를 즉시 판단하고, `code`로 세부 분류, `message`로 인간 친화적 설명, `data`에 실제 페이로드를 담습니다. 오류 시 `data`는 `null`입니다.

## ApiResponse 클래스 구현

```java
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class ApiResponse<T> {

    private final boolean success;
    private final String  code;
    private final String  message;
    private final T       data;

    // 성공 응답 팩터리
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "200", "성공", data);
    }

    public static ApiResponse<Void> ok() {
        return new ApiResponse<>(true, "200", "성공", null);
    }

    // 오류 응답 팩터리
    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, code, message, null);
    }
}
```

`@RequiredArgsConstructor`가 `final` 필드를 받는 생성자를 만들지만, 외부에서 직접 생성하는 것을 막으려면 생성자를 `private`으로 선언하고 정적 팩터리 메서드만 노출합니다. 이렇게 하면 `ApiResponse.ok(data)`, `ApiResponse.error("E404", "사용자 없음")` 같이 **의도가 명확한 호출 지점**을 강제할 수 있습니다.

## 컨트롤러에 적용

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public ApiResponse<UserDto> getUser(@PathVariable Long id) {
        return ApiResponse.ok(userService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserDto> createUser(@Valid @RequestBody UserRequest request) {
        return ApiResponse.ok(userService.create(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        userService.delete(id);
        return ApiResponse.ok();
    }
}
```

리스트 조회도 동일합니다. `ApiResponse<List<UserDto>>`처럼 제네릭에 컬렉션을 넣으면 됩니다.

## 오류 응답 연동 — @ExceptionHandler

`@ControllerAdvice`와 결합하면 예외를 가로채 봉투 형식으로 변환할 수 있습니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNotFound(EntityNotFoundException ex) {
        return ApiResponse.error("E404", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<List<String>> handleValidation(
            MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();
        return ApiResponse.error("E400", "입력값 오류", errors);
        // error() 오버로드로 data도 포함 가능
    }
}
```

검증 오류 시에는 어느 필드가 왜 틀렸는지 알아야 하므로, `data`에 오류 목록을 포함하는 오버로드 메서드를 추가하면 클라이언트 UX가 훨씬 좋아집니다.

```java
// 오버로드 — 오류 데이터 포함
public static <T> ApiResponse<T> error(String code, String message, T data) {
    return new ApiResponse<>(false, code, message, data);
}
```

## ResponseBodyAdvice로 전역 자동 래핑

모든 컨트롤러 반환값을 자동으로 `ApiResponse`로 감싸고 싶다면 `ResponseBodyAdvice`를 사용합니다. 단, 이미 `ApiResponse` 타입이거나 `ResponseEntity`로 반환하는 경우를 제외해야 합니다.

```java
@RestControllerAdvice
public class ResponseWrapAdvice
        implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter returnType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        // 이미 ApiResponse이면 래핑 건너뜀
        return !ApiResponse.class.isAssignableFrom(
                returnType.getParameterType());
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType,
                                  MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        return ApiResponse.ok(body);
    }
}
```

전역 자동 래핑은 편리하지만 **Swagger UI, Actuator 엔드포인트, 파일 다운로드** 등에서 의도치 않게 래핑이 적용될 수 있습니다. `supports()` 메서드에서 경로나 패키지 기반 예외 처리를 꼼꼼하게 해줘야 합니다.

## 구현과 사용 패턴 요약

![ApiResponse 구현 코드](/assets/posts/spring-response-envelope-code.svg)

## RFC 7807 Problem Details와의 비교

Spring 6 / Boot 3부터는 RFC 7807 표준을 구현한 `ProblemDetail`이 내장됩니다. 커스텀 `ApiResponse`와 달리 표준을 따르므로 API 소비자가 별도 문서 없이도 오류 구조를 이해할 수 있습니다.

```java
// Spring 6+ ProblemDetail 예시
@ExceptionHandler(EntityNotFoundException.class)
public ProblemDetail handleNotFound(EntityNotFoundException ex) {
    ProblemDetail detail = ProblemDetail.forStatusAndDetail(
        HttpStatus.NOT_FOUND, ex.getMessage());
    detail.setTitle("Resource Not Found");
    detail.setProperty("errorCode", "E404");
    return detail;
}
```

**선택 기준**

| 구분 | 커스텀 ApiResponse | RFC 7807 ProblemDetail |
|---|---|---|
| 성공 응답 래핑 | ✓ | ✗ |
| 오류 표준화 | 자체 기준 | 국제 표준 |
| Spring Boot 버전 | 제한 없음 | 3.x 권장 |
| 클라이언트 범용성 | 낮음 | 높음 |

기존 레거시 API와의 호환이 중요하거나 성공 응답까지 일관된 구조가 필요한 경우에는 커스텀 `ApiResponse`가 유리합니다. 새로 시작하는 공개 API라면 RFC 7807 표준을 따르는 것이 장기적으로 유지보수성이 높습니다.

## 페이지네이션 응답

목록 API에서는 총 건수와 페이지 정보를 함께 반환해야 합니다. 별도의 `PagedResponse<T>` 래퍼를 만들거나, `data` 필드에 페이지 메타데이터를 포함하는 구조를 씁니다.

```java
@Getter
@RequiredArgsConstructor
public class PagedResponse<T> {
    private final List<T>  content;
    private final long     totalElements;
    private final int      totalPages;
    private final int      currentPage;
    private final int      size;

    public static <T> PagedResponse<T> of(Page<T> page) {
        return new PagedResponse<>(
            page.getContent(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.getNumber(),
            page.getSize()
        );
    }
}

// 컨트롤러
@GetMapping
public ApiResponse<PagedResponse<UserDto>> listUsers(Pageable pageable) {
    return ApiResponse.ok(PagedResponse.of(userService.findAll(pageable)));
}
```

---

**지난 글:** [Custom Validator — 커스텀 제약 어노테이션 만들기](/posts/spring-custom-validator/)

**다음 글:** [Spring Security 아키텍처](/posts/spring-security-architecture/)

<br>
읽어주셔서 감사합니다. 😊
