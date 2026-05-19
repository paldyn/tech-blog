---
title: "REST API HTTP 상태 코드 — 언제 무엇을 반환해야 하는가"
description: "REST API에서 HTTP 상태 코드를 올바르게 사용하는 방법을 다룹니다. 2xx/3xx/4xx/5xx 각 코드의 의미, 200 vs 201 vs 204, 400 vs 422, 401 vs 403 혼동 사례, Spring ResponseEntity와 @ExceptionHandler로 구현하는 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "REST", "HTTP", "StatusCode", "ResponseEntity", "ExceptionHandler", "API설계", "400", "404", "500"]
featured: false
draft: false
---

[지난 글](/posts/spring-rest-principles/)에서 REST의 6가지 제약조건과 Richardson 성숙도 모델을 살펴봤습니다. REST 설계 원칙 중 **HTTP 상태 코드의 올바른 사용**은 Uniform Interface 제약의 핵심입니다. 상태 코드는 클라이언트가 서버의 의도를 해석하는 공용어입니다. `200 OK`를 남발하고 본문에 `"success": false`를 담는 패턴은 REST의 Self-descriptive Message 원칙을 위반하며, 클라이언트 코드를 복잡하게 만듭니다. 이 글에서는 각 상태 코드 그룹의 의미와 실무에서 자주 혼동하는 코드들을 구체적으로 비교하고, Spring에서 구현하는 방법을 정리합니다.

## HTTP 상태 코드 분류

상태 코드는 첫 자리 숫자로 5개 클래스로 분류됩니다.

![HTTP 상태 코드 분류](/assets/posts/spring-rest-http-status-codes.svg)

각 클래스의 의미를 명확히 이해하면 올바른 코드를 선택하는 데 흔들리지 않습니다. **2xx**는 요청 성공, **3xx**는 추가 동작 필요(리다이렉션), **4xx**는 클라이언트 잘못, **5xx**는 서버 잘못입니다. 클라이언트 코드가 재시도를 할지, 오류를 표시할지, 캐시를 사용할지는 이 분류에 따라 결정됩니다.

## 2xx 성공 코드 — 미묘한 차이

### 200 OK vs 201 Created

`200 OK`는 범용 성공입니다. 조회(GET), 전체 수정(PUT), 부분 수정(PATCH) 등에 사용합니다. 반면 `201 Created`는 **새 리소스 생성 성공(POST)** 전용입니다. `Location` 헤더에 생성된 리소스의 URI를 포함하는 것이 관례입니다.

```java
// ✓ 생성 성공 — 201 + Location 헤더
@PostMapping("/users")
public ResponseEntity<UserDto> createUser(@RequestBody @Valid CreateUserRequest req) {
    UserDto created = userService.create(req);
    URI location = URI.create("/users/" + created.getId());
    return ResponseEntity
            .created(location)   // 201 Created + Location: /users/42
            .body(created);
}

// ✓ 조회 성공 — 200
@GetMapping("/users/{id}")
public UserDto getUser(@PathVariable Long id) {
    // @ResponseStatus(200) 기본값 — 반환 타입이 있으면 200이 자동 적용
    return userService.findById(id);
}
```

Spring의 `ResponseEntity.created(uri)` 빌더는 `Location` 헤더 설정과 201 상태 코드를 한 번에 처리합니다.

### 204 No Content

삭제(DELETE)나 폼 제출처럼 응답 본문이 필요 없는 경우에 사용합니다. 200에 빈 본문을 반환하는 것보다 명시적이며, 클라이언트가 불필요한 파싱을 시도하지 않습니다.

```java
@DeleteMapping("/users/{id}")
public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
    userService.delete(id);
    return ResponseEntity.noContent().build();  // 204
}
```

## 4xx 클라이언트 오류 — 자주 혼동하는 코드

![Spring에서 상태 코드 반환하기](/assets/posts/spring-rest-http-status-spring.svg)

### 400 vs 422 — 입력 오류의 두 단계

`400 Bad Request`는 **요청 자체의 형식 문제**입니다. JSON 파싱 실패, 필수 필드 누락, 타입 오류 등이 해당합니다. Spring의 `@Valid`가 실패하면 `MethodArgumentNotValidException`이 발생하는데, 이때 400을 반환하는 것이 일반적입니다.

`422 Unprocessable Entity`는 **형식은 맞지만 비즈니스 규칙 위반**입니다. 만료된 날짜, 재고 부족 주문, 이미 취소된 주문 취소 시도 등이 해당합니다. 400과 422를 구분하면 클라이언트가 재시도 여부를 판단하는 데 도움이 됩니다.

```java
// 400 — 형식 오류
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<ErrorResponse> handleValidation(
        MethodArgumentNotValidException ex) {
    List<String> errors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();
    return ResponseEntity.badRequest()
            .body(new ErrorResponse("VALIDATION_FAILED", errors));
}

// 422 — 비즈니스 규칙 위반
@ExceptionHandler(BusinessRuleViolationException.class)
public ResponseEntity<ErrorResponse> handleBusinessRule(
        BusinessRuleViolationException ex) {
    return ResponseEntity
            .unprocessableEntity()              // 422
            .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
}
```

### 401 vs 403 — 인증과 인가 구분

`401 Unauthorized`는 이름과 달리 **인증(Authentication) 실패**입니다. 헤더에 토큰이 없거나, 토큰이 만료됐거나, 서명이 위조된 경우입니다. 클라이언트에게 "로그인하세요"를 의미합니다.

`403 Forbidden`은 **인가(Authorization) 실패**입니다. 인증은 됐지만 해당 리소스에 접근할 권한이 없는 경우입니다. 클라이언트에게 "권한이 없습니다"를 의미합니다. 보안 관점에서 리소스 존재 여부를 숨기고 싶다면 404를 반환하는 전략도 있습니다.

```java
// Spring Security가 자동으로 처리하지만
// 직접 핸들링이 필요한 경우
@ExceptionHandler(AuthenticationException.class)
public ResponseEntity<ErrorResponse> handleAuth(AuthenticationException ex) {
    return ResponseEntity
            .status(HttpStatus.UNAUTHORIZED)    // 401
            .header("WWW-Authenticate", "Bearer")
            .body(new ErrorResponse("AUTH_REQUIRED", "인증이 필요합니다"));
}

@ExceptionHandler(AccessDeniedException.class)
public ResponseEntity<ErrorResponse> handleAccess(AccessDeniedException ex) {
    return ResponseEntity
            .status(HttpStatus.FORBIDDEN)       // 403
            .body(new ErrorResponse("ACCESS_DENIED", "접근 권한이 없습니다"));
}
```

### 404 vs 410 — 임시 vs 영구 삭제

`404 Not Found`는 리소스가 없거나 현재 존재하지 않는 경우입니다. `410 Gone`은 **영구적으로 삭제된** 리소스에 사용합니다. 검색 엔진에서 URL을 제거하거나 클라이언트에게 재시도하지 말라는 신호를 줄 때 유용합니다.

### 409 Conflict — 상태 충돌

중복 생성(이미 존재하는 이메일), 낙관적 잠금 실패, 동시 수정 충돌 등에 사용합니다. 클라이언트에게 현재 리소스 상태를 먼저 확인한 후 재시도하라는 신호입니다.

```java
// 이미 존재하는 이메일로 가입 시도
@ExceptionHandler(DuplicateEmailException.class)
public ResponseEntity<ErrorResponse> handleDuplicateEmail(
        DuplicateEmailException ex) {
    return ResponseEntity
            .status(HttpStatus.CONFLICT)        // 409
            .body(new ErrorResponse("EMAIL_DUPLICATE",
                    "이미 사용 중인 이메일입니다: " + ex.getEmail()));
}
```

## 5xx 서버 오류 — 클라이언트는 잘못 없음

`5xx`는 서버 내부 문제입니다. 클라이언트는 잘못이 없으므로 **오류 메시지에 스택 트레이스나 내부 구현 정보를 노출해서는 안 됩니다**.

```java
// ✗ 절대 금지 — 스택 트레이스 노출
{
  "error": "NullPointerException at UserService.java:142...",
  "stackTrace": "com.example..."
}

// ✓ 올바른 패턴 — 내부 정보 숨기기
{
  "code": "INTERNAL_ERROR",
  "message": "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  "traceId": "abc-123-xyz"   // 로그 추적용 ID만 노출
}
```

서버 로그에는 자세한 예외를 기록하고, 응답에는 `traceId`만 포함해 운영팀이 추적할 수 있게 합니다.

```java
@ExceptionHandler(Exception.class)
public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex,
        HttpServletRequest request) {
    String traceId = UUID.randomUUID().toString().substring(0, 8);
    log.error("[{}] 처리되지 않은 예외: {}", traceId, ex.getMessage(), ex);
    return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)   // 500
            .body(new ErrorResponse("INTERNAL_ERROR",
                    "오류가 발생했습니다", traceId));
}
```

## 흔한 안티패턴

| 안티패턴 | 문제 | 올바른 방법 |
|---|---|---|
| 항상 200 반환, 본문에 성공/실패 플래그 | HTTP 의미 무시, 클라이언트 복잡도 증가 | 상황에 맞는 4xx/5xx 사용 |
| 모든 오류를 500으로 반환 | 클라이언트가 자기 잘못인지 모름 | 클라이언트 오류는 4xx |
| DELETE 성공 시 200 + 빈 body | 의도 불명확 | 204 No Content |
| POST 성공 시 200 반환 | 생성임을 클라이언트가 모름 | 201 Created + Location |
| 401/403 구분 없이 사용 | 인증/인가 구분 불가 | 인증 실패→401, 권한 없음→403 |

## @ResponseStatus로 간편하게

단순한 경우에는 `@ResponseStatus`로 예외와 코드를 매핑할 수 있습니다.

```java
@ResponseStatus(HttpStatus.NOT_FOUND)  // 이 예외 발생 시 자동으로 404
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(Long id) {
        super("사용자를 찾을 수 없습니다: " + id);
    }
}

// Controller에서 별도 처리 불필요
@GetMapping("/users/{id}")
public UserDto getUser(@PathVariable Long id) {
    return userService.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id)); // → 404
}
```

다만 `@ResponseStatus`는 응답 본문 커스터마이징이 어렵기 때문에, 구조화된 오류 응답이 필요하다면 `@ExceptionHandler`를 사용합니다.

다음 글에서는 실제 API에서 자주 필요한 **페이징·필터·정렬**을 Spring Data의 `Pageable`로 구현하는 방법을 다룹니다.

---

**지난 글:** [REST API 설계 원칙 — URI·메서드·표현의 일관성](/posts/spring-rest-principles/)

**다음 글:** [Spring REST API 페이징·필터·정렬 — Pageable과 Page 완전 가이드](/posts/spring-rest-paging-filter-sort/)

<br>
읽어주셔서 감사합니다. 😊
