---
title: "예외 체이닝 — 원인 예외를 보존하는 방법"
description: "Java 예외 체이닝 완전 분석 — cause 전달의 중요성, initCause() vs 생성자, getCause() 체인 탐색, 계층형 아키텍처에서의 예외 래핑 패턴, 근본 원인 추적"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "예외체이닝", "getCause", "initCause", "예외래핑", "스택트레이스"]
featured: false
draft: false
---

[지난 글](/posts/java-custom-exception/)에서 도메인에 맞는 커스텀 예외 계층을 설계하는 방법을 살펴봤다. 이번에는 **예외 체이닝(Exception Chaining)**을 다룬다. 하위 계층에서 발생한 원인 예외를 소실 없이 상위 계층으로 전달하는 핵심 기법이다.

## 예외 체이닝이란

계층형 아키텍처(Repository → Service → Controller)에서는 하위 계층의 예외를 상위 계층의 예외로 **래핑**해 던진다. 이때 원래 예외(cause)를 함께 전달하는 것이 예외 체이닝이다.

```java
// Repository 계층
try {
    jdbcTemplate.query(sql, rowMapper);
} catch (DataAccessException e) {
    throw new OrderRepositoryException("주문 조회 실패", e); // ← cause 전달
}

// Service 계층
try {
    orderRepository.findById(id);
} catch (OrderRepositoryException e) {
    throw new OrderServiceException("주문 서비스 오류", e); // ← cause 전달
}
```

예외 체이닝이 없으면 로그에는 `OrderServiceException: 주문 서비스 오류`만 남고 실제 원인인 `DataAccessException`이나 `SQLException`은 완전히 사라진다.

## cause를 전달하는 방법

### 1. 생성자에 cause 전달 (권장)

```java
// Throwable의 생성자 — Java 1.4부터
throw new AppException("메시지", e);           // String + Throwable
throw new AppException(e);                     // Throwable만
```

커스텀 예외 클래스가 `super(message, cause)` 생성자를 제공해야 한다.

### 2. initCause() — 레거시 방식

```java
// cause 전달 생성자가 없는 레거시 예외 클래스일 때
AppException ex = new AppException("메시지");
ex.initCause(e);
throw ex;
```

`initCause()`는 한 번만 호출 가능하다. 이미 cause가 설정된 예외에 다시 호출하면 `IllegalStateException`이 발생한다.

```java
// 내부적으로는 동일
Throwable cause = exception.getCause();
```

![예외 체이닝 전파 흐름](/assets/posts/java-exception-chaining-flow.svg)

## getCause()로 원인 체인 탐색

예외가 여러 계층을 거쳐 래핑되면 `getCause()`를 반복 호출해 근본 원인까지 내려갈 수 있다.

```java
try {
    orderService.processOrder(orderId);
} catch (OrderServiceException e) {
    // 체인 탐색
    Throwable cause = e;
    while (cause.getCause() != null) {
        cause = cause.getCause();
    }
    System.out.println("근본 원인: " + cause.getClass().getName());
    // 출력: 근본 원인: java.sql.SQLException
}
```

스택 트레이스 출력 시 `Caused by:` 섹션이 바로 이 체인을 보여준다.

```text
OrderServiceException: 주문 서비스 오류
    at OrderServiceImpl.processOrder(...)
Caused by: OrderRepositoryException: 주문 조회 실패
    at OrderRepositoryImpl.findById(...)
Caused by: java.sql.SQLException: connection refused
    at ...
```

![예외 체이닝 올바른 구현 vs 잘못된 구현](/assets/posts/java-exception-chaining-code.svg)

## 계층형 아키텍처에서의 실전 패턴

```java
// 인프라 계층 예외를 도메인 예외로 래핑
@Repository
public class UserRepositoryImpl implements UserRepository {

    @Override
    public User findById(long id) {
        try {
            return jdbc.queryForObject(
                "SELECT * FROM users WHERE id = ?",
                userRowMapper, id);
        } catch (EmptyResultDataAccessException e) {
            // 데이터 없음 → 도메인 예외로 변환, cause 보존
            throw new UserNotFoundException(id, e);
        } catch (DataAccessException e) {
            // 기술적 예외 → 래핑
            throw new DataAccessAppException("사용자 조회 실패", e);
        }
    }
}
```

핵심 원칙:
- **기술 예외를 도메인 예외로 변환**할 때는 항상 cause를 전달한다.
- 예외를 **re-throw**할 때(`throw e`)는 cause 전달이 필요 없다. 이미 체인이 유지된다.
- 예외를 **새로 생성**해서 던질 때만 cause 전달이 필요하다.

## 스택 트레이스 제어

성능이 극히 중요한 환경에서는 스택 트레이스 생성을 억제할 수 있다.

```java
public class FastException extends RuntimeException {

    // writableStackTrace=false → fillInStackTrace() 생략 (성능 이점)
    public FastException(String message) {
        super(message, null, true, false);
    }
}
```

단, 스택 트레이스가 없으면 디버깅이 매우 어려워진다. **비즈니스 흐름 제어 목적**으로 예외를 사용하는 특수한 경우에만 고려한다.

## 흔한 실수 — 예외 삼키기

```java
// ❌ 예외를 잡고 아무것도 안 함 (삼키기)
try {
    riskyOperation();
} catch (Exception e) {
    // 빈 catch — 예외가 완전히 소실됨
}

// ❌ 로그만 남기고 다시 던짐 — 로그가 두 번 찍힘
try {
    riskyOperation();
} catch (Exception e) {
    log.error("오류", e);
    throw e; // 상위에서도 같은 예외를 로그로 남기면 중복
}

// ✅ 래핑하거나 완전히 처리하거나 둘 중 하나
try {
    riskyOperation();
} catch (Exception e) {
    throw new AppException("작업 실패", e); // 래핑 후 전파
}
```

예외를 잡으면 **완전히 처리**하거나 **래핑 후 재전파** 중 하나여야 한다. 로그만 남기고 다시 던지면 동일 예외가 여러 계층에서 중복 로깅된다.

---

**지난 글:** [커스텀 예외 — 도메인에 맞는 예외 클래스 설계](/posts/java-custom-exception/)

**다음 글:** [RuntimeException 종류 — 주요 비검사 예외 완전 정리](/posts/java-runtime-exception-types/)

<br>
읽어주셔서 감사합니다. 😊
