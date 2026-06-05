---
title: "커스텀 예외 — 도메인에 맞는 예외 클래스 설계"
description: "Java 커스텀 예외 설계 완전 가이드 — RuntimeException vs Exception 선택 기준, ErrorCode enum 패턴, 도메인 루트 예외 계층 구조, 생성자 4종 구현, 직렬화 serialVersionUID"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "커스텀 예외", "RuntimeException", "예외설계", "ErrorCode", "도메인예외"]
featured: false
draft: false
---

[지난 글](/posts/java-multi-catch/)에서 `catch (A | B e)` 구문으로 여러 예외를 한 번에 처리하는 방법을 살펴봤다. 이번에는 **도메인에 맞는 커스텀 예외 클래스**를 올바르게 설계하는 방법을 다룬다.

## 커스텀 예외가 필요한 이유

`IllegalArgumentException`이나 `RuntimeException("메시지")`를 직접 던지는 코드는 간단하지만 문제가 있다. 예외 타입만으로 **무엇이 잘못됐는지** 알 수 없고, 오류 코드·HTTP 상태 코드를 일관성 있게 매핑하기 어렵다. 커스텀 예외 계층을 잘 설계하면 예외 타입 자체가 도메인 언어가 된다.

## Checked vs Unchecked — 어떤 것을 상속할까

| 기준 | `Exception` 상속 (Checked) | `RuntimeException` 상속 (Unchecked) |
|------|---------------------------|--------------------------------------|
| 호출자가 예외 처리 강제 | O | X |
| 복구 가능성 | 높음 (IO, 네트워크 등) | 낮음 (프로그래밍 오류, 비즈니스 규칙) |
| API 유연성 | 낮음 (throws 선언 필요) | 높음 |
| 현대 프레임워크 방향 | Spring 등은 Unchecked 선호 | ← |

도메인 예외 대부분은 `RuntimeException`을 상속하는 Unchecked 예외로 만드는 것이 현대적 관행이다. 복구 전략이 명확한 경우(예: 파일 없음 → 재시도)에만 Checked를 고려한다.

## 생성자 4종 — 표준 패턴

```java
public class AppException extends RuntimeException {

    // 1. 메시지만
    public AppException(String message) {
        super(message);
    }

    // 2. 메시지 + 원인 예외 (예외 체이닝 필수)
    public AppException(String message, Throwable cause) {
        super(message, cause);
    }

    // 3. 원인 예외만 (메시지는 cause.toString()으로 자동)
    public AppException(Throwable cause) {
        super(cause);
    }

    // 4. 직렬화 지원용
    protected AppException(String message, Throwable cause,
                           boolean enableSuppression,
                           boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }

    // 직렬화 고유 식별자 (선언 필수)
    private static final long serialVersionUID = 1L;
}
```

생성자 4종을 모두 제공하지 않으면 서브클래스에서 원인 예외를 전달할 방법이 막힌다.

## ErrorCode enum + 루트 예외 패턴

실무에서 가장 많이 쓰이는 패턴은 `ErrorCode` enum과 루트 예외를 결합하는 방식이다.

```java
public enum ErrorCode {
    INVALID_INPUT(400, "잘못된 입력값입니다"),
    NOT_FOUND(404, "요청한 리소스를 찾을 수 없습니다"),
    DUPLICATE_RESOURCE(409, "이미 존재하는 리소스입니다"),
    INTERNAL_ERROR(500, "내부 오류가 발생했습니다");

    public final int httpStatus;
    public final String defaultMessage;

    ErrorCode(int httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }
}
```

```java
public class AppException extends RuntimeException {
    private final ErrorCode errorCode;

    public AppException(ErrorCode errorCode) {
        super(errorCode.defaultMessage);
        this.errorCode = errorCode;
    }

    public AppException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.defaultMessage, cause);
        this.errorCode = errorCode;
    }

    public AppException(ErrorCode errorCode, String detail) {
        super(detail); // 상세 메시지 오버라이드
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() { return errorCode; }

    private static final long serialVersionUID = 1L;
}
```

![커스텀 예외 클래스 계층 설계](/assets/posts/java-custom-exception-hierarchy.svg)

## 도메인별 구체적 예외

루트 예외를 상속해 도메인 언어로 예외 이름을 짓는다.

```java
// 유저 도메인
public class UserNotFoundException extends AppException {
    private final long userId;

    public UserNotFoundException(long userId) {
        super(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다. id=" + userId);
        this.userId = userId;
    }

    public long getUserId() { return userId; }

    private static final long serialVersionUID = 1L;
}

// 주문 도메인
public class InsufficientStockException extends AppException {
    private final String productId;
    private final int required;
    private final int available;

    public InsufficientStockException(String productId, int required, int available) {
        super(ErrorCode.INVALID_INPUT,
              "재고 부족: productId=%s, 필요=%d, 가용=%d".formatted(productId, required, available));
        this.productId = productId;
        this.required = required;
        this.available = available;
    }

    private static final long serialVersionUID = 1L;
}
```

예외 클래스에 **관련 데이터를 필드로** 보관하면 로그와 오류 응답에서 활용할 수 있다.

![커스텀 예외 구현 패턴](/assets/posts/java-custom-exception-pattern.svg)

## Spring 환경에서의 통합

Spring의 `@ExceptionHandler` 또는 `@RestControllerAdvice`와 결합하면 `ErrorCode`의 HTTP 상태 코드가 자동으로 응답에 반영된다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handleAppException(AppException e) {
        ErrorCode code = e.getErrorCode();
        return ResponseEntity
            .status(code.httpStatus)
            .body(new ErrorResponse(code.name(), e.getMessage()));
    }
}
```

예외 클래스 이름과 `ErrorCode` 하나만 보면 HTTP 응답이 어떻게 될지 즉시 알 수 있다.

## 흔한 실수들

```java
// ❌ 정보 없는 예외
throw new RuntimeException("오류"); // 무슨 오류인지 모름

// ❌ 예외 체이닝 누락
try {
    db.query(sql);
} catch (SQLException e) {
    throw new DataAccessException("DB 오류"); // cause 누락 → 원인 스택트레이스 소실
}

// ✅ 원인 예외 보존
throw new DataAccessException("DB 오류", e); // cause 전달

// ❌ serialVersionUID 누락
// 직렬화 도구(로깅 시스템, RMI 등)에서 경고 발생

// ❌ 생성자에서 비즈니스 로직 실행
public OrderException(Order o) {
    super("...");
    o.cancel(); // 생성자에서 부작용 → 예외가 잡히지 않을 때 상태 오염
}
```

커스텀 예외 클래스는 단순한 데이터 컨테이너여야 한다. 생성자에서는 필드 초기화와 메시지 구성만 한다.

---

**지난 글:** [multi-catch — 여러 예외를 한 번에 처리하기](/posts/java-multi-catch/)

**다음 글:** [예외 체이닝 — 원인 예외를 보존하는 방법](/posts/java-exception-chaining/)

<br>
읽어주셔서 감사합니다. 😊
