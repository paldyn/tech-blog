---
title: "Spring 예외 처리 완전 정복: @ExceptionHandler, @ControllerAdvice, RFC 7807"
description: "HandlerExceptionResolver 처리 체인의 동작 원리, @ExceptionHandler로 예외별 응답 매핑, @RestControllerAdvice로 전역 핸들러 구성, @ResponseStatus 단순 매핑, Spring 6의 ProblemDetail(RFC 7807)까지 Spring MVC 예외 처리 전략을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "@ExceptionHandler", "@ControllerAdvice", "@RestControllerAdvice", "RFC7807", "ProblemDetail", "예외처리", "HandlerExceptionResolver", "@ResponseStatus"]
featured: false
draft: false
---

[지난 글](/posts/spring-validation-basics/)에서 Bean Validation으로 입력값을 검증하는 방법을 살펴봤습니다. 검증 실패 시 `MethodArgumentNotValidException`이 발생한다고 언급했는데, 이번에는 그 예외를 포함해 API에서 발생하는 모든 예외를 일관되게 처리하는 전략을 깊이 다룹니다.

## Spring의 예외 처리 메커니즘

`DispatcherServlet`은 컨트롤러나 그 이하 레이어에서 예외가 발생하면 이를 잡아 **HandlerExceptionResolver** 체인에 위임합니다. Spring MVC는 세 가지 기본 Resolver를 등록 순서대로 시도합니다.

1. **ExceptionHandlerExceptionResolver** — `@ExceptionHandler` 탐색 (가장 먼저)
2. **ResponseStatusExceptionResolver** — `@ResponseStatus`가 붙은 예외 처리
3. **DefaultHandlerExceptionResolver** — 내장 MVC 예외 처리 (405, 406 등)

모든 Resolver가 처리하지 못하면 예외는 서블릿 컨테이너까지 올라가 일반적으로 500 응답이 됩니다.

![Spring MVC 예외 처리 파이프라인](/assets/posts/spring-exception-handler-flow.svg)

## @ExceptionHandler — 예외별 핸들러

컨트롤러 내에 `@ExceptionHandler` 메서드를 선언하면 해당 컨트롤러에서 발생한 특정 예외를 가로챕니다.

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping("/{id}")
    public UserDto getUser(@PathVariable Long id) {
        return userService.findById(id);   // NotFoundException 발생 가능
    }

    // 이 컨트롤러에서 발생한 NotFoundException만 처리
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            NotFoundException ex, HttpServletRequest request) {
        ErrorResponse body = ErrorResponse.of(404, ex.getMessage(),
                                              request.getRequestURI());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }
}
```

핸들러 메서드 파라미터로 예외 객체, `HttpServletRequest`, `WebRequest`, `Model` 등을 받을 수 있습니다. 반환 타입도 `ResponseEntity`, `String`(뷰 이름), `void` 등 유연하게 선택합니다.

## @RestControllerAdvice — 전역 예외 핸들러

컨트롤러마다 `@ExceptionHandler`를 반복하면 중복이 발생합니다. `@RestControllerAdvice`(= `@ControllerAdvice` + `@ResponseBody`)를 사용하면 **모든 컨트롤러**에 적용되는 전역 핸들러를 한 곳에 모을 수 있습니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 검증 실패 (컨트롤러 @RequestBody)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex) {
        List<FieldError> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fe -> new FieldError(
                        fe.getField(), fe.getDefaultMessage()))
                .toList();
        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.validation(errors));
    }

    // 리소스 없음
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            NotFoundException ex) {
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of(404, ex.getMessage()));
    }

    // 잡히지 않은 모든 예외 (최후 안전망)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(
            Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity
                .internalServerError()
                .body(ErrorResponse.of(500, "서버 내부 오류가 발생했습니다"));
    }
}
```

처리 우선순위: **컨트롤러 자체 @ExceptionHandler** → **@ControllerAdvice** 순으로 탐색합니다. 같은 `@ControllerAdvice` 내에서는 예외 타입이 더 구체적인 핸들러가 우선합니다.

## @ResponseStatus — 간단한 상태 코드 매핑

별도 핸들러 없이 예외 클래스에 `@ResponseStatus`를 붙이는 방법도 있습니다.

```java
@ResponseStatus(value = HttpStatus.NOT_FOUND,
                reason = "요청한 리소스를 찾을 수 없습니다")
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
```

이 방식은 `ResponseStatusExceptionResolver`가 처리합니다. 장점은 선언이 간단하다는 것이고, 단점은 `reason` 속성으로 지정한 메시지가 응답 body가 아닌 Servlet 컨테이너의 오류 페이지에 출력되어 REST API에서는 기대한 JSON 응답이 나오지 않을 수 있습니다.

REST API에서는 `@ResponseStatus`보다 `@ExceptionHandler`를 통한 명시적 처리를 권장합니다.

## Spring 6 / Boot 3: ProblemDetail (RFC 7807)

Spring 6부터 `ProblemDetail` 클래스가 추가되어 [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) 형식의 오류 응답을 표준에 맞게 생성할 수 있습니다.

```java
@RestControllerAdvice
public class ProblemDetailExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(
            NotFoundException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail
                .forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setType(URI.create("https://example.com/errors/not-found"));
        pd.setTitle("리소스를 찾을 수 없음");
        pd.setInstance(URI.create(request.getRequestURI()));
        pd.setProperty("timestamp", Instant.now());  // 커스텀 필드
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(
            MethodArgumentNotValidException ex) {
        ProblemDetail pd = ex.getBody();   // 이미 ProblemDetail 포함
        pd.setTitle("입력값 검증 실패");
        List<String> errors = ex.getBindingResult().getFieldErrors()
                .stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .toList();
        pd.setProperty("errors", errors);
        return pd;
    }
}
```

![GlobalExceptionHandler 구현 패턴](/assets/posts/spring-exception-handler-code.svg)

응답 `Content-Type`은 `application/problem+json`으로 자동 설정되며, 구조는 다음과 같습니다.

```json
{
  "type": "https://example.com/errors/not-found",
  "title": "리소스를 찾을 수 없음",
  "status": 404,
  "detail": "User 42를 찾을 수 없습니다",
  "instance": "/api/users/42",
  "timestamp": "2026-05-06T00:00:00Z"
}
```

Boot 3에서는 `application.properties`에 `spring.mvc.problemdetails.enabled=true`를 설정하면 내장 MVC 예외도 자동으로 `ProblemDetail` 형식으로 반환됩니다.

## 검증 오류 응답 구조화

`MethodArgumentNotValidException`에서 필드별 오류 정보를 추출하는 패턴입니다.

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<ErrorResponse> handleValidation(
        MethodArgumentNotValidException ex) {
    Map<String, String> fieldErrors = new LinkedHashMap<>();

    ex.getBindingResult().getFieldErrors()
      .forEach(fe ->
          fieldErrors.put(fe.getField(), fe.getDefaultMessage())
      );

    ErrorResponse body = ErrorResponse.builder()
            .status(400)
            .message("입력값 검증에 실패했습니다")
            .errors(fieldErrors)
            .build();

    return ResponseEntity.badRequest().body(body);
}
```

응답 예시:
```json
{
  "status": 400,
  "message": "입력값 검증에 실패했습니다",
  "errors": {
    "email": "올바른 이메일 형식이 아닙니다",
    "name": "이름은 2~50자여야 합니다"
  }
}
```

## 예외 계층 설계 원칙

도메인별 예외 계층을 설계하면 `@ExceptionHandler` 코드가 단순해집니다.

```java
// 기반 예외
public abstract class AppException extends RuntimeException {
    private final HttpStatus status;
    public AppException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }
    public HttpStatus getStatus() { return status; }
}

// 도메인 예외
public class NotFoundException extends AppException {
    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}

public class ConflictException extends AppException {
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}

// 핸들러 — AppException 하나로 모든 도메인 예외 처리
@ExceptionHandler(AppException.class)
public ResponseEntity<ErrorResponse> handleApp(AppException ex) {
    return ResponseEntity
            .status(ex.getStatus())
            .body(ErrorResponse.of(ex.getStatus().value(), ex.getMessage()));
}
```

## 정리

- `HandlerExceptionResolver` 체인: ExceptionHandler → ResponseStatus → Default 순
- `@ExceptionHandler`는 컨트롤러 범위, `@RestControllerAdvice`는 전역 범위 적용
- REST API에서는 `@ResponseStatus`보다 명시적 핸들러 작성을 권장
- Spring 6 / Boot 3에서는 `ProblemDetail`(RFC 7807)로 표준 오류 응답 구성
- 도메인 예외 계층을 설계하면 핸들러 코드가 단순해지고 확장이 쉬워짐

---

**지난 글:** [Spring Validation: @Valid, @Validated, Bean Validation 완전 정복](/posts/spring-validation-basics/)

**다음 글:** [Spring 인터셉터 vs 필터: 차이점과 실전 활용법](/posts/spring-interceptor-vs-filter/)

<br>
읽어주셔서 감사합니다. 😊
