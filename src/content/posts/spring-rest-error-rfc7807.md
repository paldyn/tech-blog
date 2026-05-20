---
title: "REST API 오류 응답 표준화 — RFC 7807 Problem Details"
description: "RFC 7807 Problem Details 포맷을 Spring Boot 3에서 구현하는 방법을 다룹니다. 표준화 이전의 문제점, RFC 7807 표준 필드(type·title·status·detail·instance), Spring 6의 ProblemDetail 클래스 사용법, @RestControllerAdvice 전역 핸들러 구현, 커스텀 확장 필드 추가, 실무 적용 팁을 단계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "REST", "RFC7807", "ProblemDetails", "오류응답", "예외처리", "RestControllerAdvice", "Spring6", "표준화"]
featured: false
draft: false
---

[지난 글](/posts/spring-rest-versioning/)에서 버전 관리 전략을 살펴봤습니다. 클라이언트가 새 버전에 적응하는 것만큼 중요한 것이 오류가 발생했을 때 클라이언트가 예측 가능한 응답을 받는 일입니다. REST API에서 오류 응답 형식은 팀마다, 프로젝트마다 제각각이어서 프론트엔드·파트너사·모바일 개발자들이 각 API마다 별도 파싱 로직을 작성해야 하는 문제가 오랫동안 이어져 왔습니다. **RFC 7807 Problem Details**는 HTTP API 오류 응답을 위한 IETF 표준 포맷으로, Spring 6 / Boot 3부터는 이 표준을 `ProblemDetail` 클래스로 기본 지원합니다. 이 글에서는 표준화 배경부터 Spring에서의 구현 방법까지 단계적으로 정리합니다.

## 표준화 이전의 문제점

오류 응답 포맷이 팀마다 다르면 다음과 같은 상황이 반복됩니다.

```json
// 팀 A
{ "message": "User not found", "code": 1004 }

// 팀 B
{ "error": "NOT_FOUND", "status": 404, "msg": "no user" }

// 팀 C
{ "errorCode": "E404", "description": "존재하지 않는 사용자" }
```

클라이언트는 각 팀·서비스에 맞는 파싱 로직을 별도로 작성해야 합니다. 오류 유형이 무엇인지(`code`, `errorCode` 중 어느 것?), 상세 설명이 어느 필드에 있는지(`message`, `msg`, `description` 중?), 이 오류가 어느 리소스에 대한 것인지 알 방법이 없습니다.

## RFC 7807 Problem Details

IETF RFC 7807(2016)은 HTTP API 오류 응답을 위한 표준 포맷을 정의합니다. 2023년 RFC 9457로 갱신됐지만 Spring 생태계에서는 여전히 "RFC 7807 Problem Details"라는 이름으로 불립니다. Content-Type은 `application/problem+json`입니다.

![RFC 7807 전후 비교](/assets/posts/spring-rest-error-rfc7807-format.svg)

### 표준 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `type` | URI | 선택 | 오류 유형 문서 URI. 없으면 `about:blank` |
| `title` | string | 선택 | 오류 유형의 짧은 요약. `type`이 같으면 항상 동일 |
| `status` | integer | 선택 | HTTP 상태 코드 (HTTP 헤더와 동일) |
| `detail` | string | 선택 | 이번 특정 요청에 대한 구체적인 설명 |
| `instance` | URI | 선택 | 오류가 발생한 특정 URI 경로 |

이 5개 필드 외에 도메인별 추가 필드를 자유롭게 붙일 수 있습니다. `errors`, `traceId`, `timestamp` 같은 필드가 대표적입니다.

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Failed",
  "status": 422,
  "detail": "입력 데이터 검증에 실패했습니다.",
  "instance": "/api/orders",
  "errors": [
    { "field": "quantity", "message": "1 이상이어야 합니다" },
    { "field": "productId", "message": "필수 값입니다" }
  ],
  "traceId": "550e8400-e29b-41d4"
}
```

## Spring 6 / Boot 3 내장 지원

Spring 6.0부터 `org.springframework.http.ProblemDetail` 클래스가 추가됐습니다. Spring MVC는 기본적으로 일부 내장 예외(`MethodArgumentNotValidException`, `HttpRequestMethodNotSupportedException` 등)를 Problem Details 형식으로 변환할 수 있습니다. Boot 3에서 활성화하려면 다음 한 줄만 추가합니다.

```yaml
# application.yml
spring:
  mvc:
    problemdetails:
      enabled: true
```

이 설정을 켜면 Spring MVC가 처리하는 기본 예외들이 자동으로 `application/problem+json` 형식으로 응답합니다.

## ProblemDetail 클래스 사용법

`ProblemDetail`은 5개 표준 필드를 담는 간단한 클래스입니다. 정적 팩토리 메서드로 쉽게 생성할 수 있습니다.

```java
// 상태 코드만 지정
ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);

// 상태 코드 + 상세 설명
ProblemDetail pd = ProblemDetail
    .forStatusAndDetail(HttpStatus.NOT_FOUND, "User id=42 not found");

// 추가 필드 설정
pd.setType(URI.create("https://api.example.com/errors/not-found"));
pd.setTitle("Resource Not Found");
pd.setInstance(URI.create("/api/users/42"));

// 커스텀 확장 필드 (도메인별 추가 데이터)
pd.setProperty("traceId", UUID.randomUUID().toString());
pd.setProperty("timestamp", Instant.now());
```

## @RestControllerAdvice 전역 핸들러 구현

모든 컨트롤러에서 발생하는 예외를 한 곳에서 처리하려면 `@RestControllerAdvice`를 사용합니다.

![Spring 6 ProblemDetail 구현 코드](/assets/posts/spring-rest-error-rfc7807-code.svg)

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 리소스 없음
    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(NotFoundException ex,
                                        HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail
                .forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setType(URI.create("https://api.example.com/errors/not-found"));
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("traceId", MDC.get("traceId")); // 로그 연계
        return pd;
    }

    // 입력 검증 실패 (@Valid 오류)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail pd = ProblemDetail
                .forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "입력 검증 실패");
        pd.setType(URI.create("https://api.example.com/errors/validation"));

        List<Map<String, String>> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fe -> Map.of(
                        "field", fe.getField(),
                        "message", fe.getDefaultMessage()))
                .toList();
        pd.setProperty("errors", errors);
        return pd;
    }

    // 서버 내부 오류 (상세 정보 노출 최소화)
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "서버 내부 오류가 발생했습니다.");
    }
}
```

`@ExceptionHandler` 메서드가 `ProblemDetail`을 반환하면 Spring MVC가 자동으로 `Content-Type: application/problem+json`을 설정합니다.

## 예외 클래스 설계

응용 계층 예외는 간단하게 유지합니다. 오류 메시지는 예외 생성 시점에 결정되어 핸들러에서 `getMessage()`로 꺼내 씁니다.

```java
public class NotFoundException extends RuntimeException {
    public NotFoundException(String resourceType, Object id) {
        super(resourceType + " with id=" + id + " not found");
    }
}

public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
```

컨트롤러에서는 예외를 던지기만 하면 됩니다.

```java
@GetMapping("/users/{id}")
public UserResponse getUser(@PathVariable Long id) {
    return userRepository.findById(id)
            .map(UserResponse::from)
            .orElseThrow(() -> new NotFoundException("User", id));
}
```

## ResponseEntityExceptionHandler 활용

Spring 자체 예외(`HttpMessageNotReadableException`, `MissingServletRequestParameterException` 등)도 Problem Details로 통일하려면 `ResponseEntityExceptionHandler`를 상속합니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    // 부모 클래스가 Spring 내부 예외를 ProblemDetail로 자동 변환
    // 커스텀 예외만 추가로 처리

    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(NotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, ex.getMessage());
    }
}
```

`ResponseEntityExceptionHandler`는 Spring MVC 예외 약 20종을 Problem Details로 변환하는 로직을 미리 구현해두고 있습니다.

## 커스텀 type URI 설계

`type` 필드에 넣는 URI는 실제로 접근 가능한 오류 문서 URL이 이상적입니다. 현실적으로는 다음 전략 중 하나를 택합니다.

```
# 실제 문서 URL (이상적)
https://api.example.com/docs/errors/not-found

# 의미만 있는 URN (실용적)
urn:problem-type:not-found

# 경로 기반 (가장 간단)
/errors/not-found
```

가장 중요한 것은 같은 오류 유형에는 항상 같은 `type` URI를 사용하는 것입니다. 클라이언트가 `type` 값으로 오류 처리 로직을 분기할 수 있어야 합니다.

## 실무 체크리스트

**반드시 지켜야 할 것:**
- HTTP 상태 코드와 `status` 필드를 일치시킬 것 (클라이언트 혼선 방지)
- 500 오류에서 스택 트레이스·내부 구조 노출 금지 (보안)
- `detail` 메시지는 최종 사용자가 읽을 수 있는 수준으로 작성

**추가하면 좋은 것:**
- `traceId` (분산 추적 연계, Zipkin/Jaeger 등)
- `timestamp` (오류 발생 시각)
- `errors` 배열 (유효성 검증 오류 목록)

**클라이언트에게 알리기:**
API 문서(OpenAPI)에 `application/problem+json` 미디어 타입을 오류 응답으로 명시하면 클라이언트 개발자가 파싱 로직을 표준에 맞게 작성할 수 있습니다.

```yaml
# OpenAPI 스펙 예시
responses:
  '404':
    description: 리소스 없음
    content:
      application/problem+json:
        schema:
          $ref: '#/components/schemas/ProblemDetail'
```

## 정리

RFC 7807 Problem Details는 오류 응답을 표준화해 클라이언트와 서버 간의 계약을 명확히 합니다. Spring 6 / Boot 3의 `ProblemDetail` 클래스 덕분에 별도 의존성 없이 표준을 따를 수 있습니다. 핵심은 `@RestControllerAdvice`에서 예외를 한 곳에서 처리하고, 도메인별 확장 필드로 필요한 컨텍스트를 추가하며, 500 오류에서는 내부 정보를 노출하지 않는 것입니다.

---

**지난 글:** [REST API 버전 관리 — URI·헤더·Content-Type 전략 비교](/posts/spring-rest-versioning/)

**다음 글:** [OpenAPI 3.0 & Swagger UI로 REST API 문서화](/posts/spring-rest-openapi-swagger/)

<br>
읽어주셔서 감사합니다. 😊
