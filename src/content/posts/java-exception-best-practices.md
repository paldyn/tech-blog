---
title: "예외 처리 베스트 프랙티스 — 올바른 예외 설계 원칙"
description: "Java 예외 처리 베스트 프랙티스 — 예외 삼키기 금지, 로그 중복 방지, 흐름 제어에 예외 사용 금지, Checked vs Unchecked 선택 기준, 경계 계층에서만 처리, 예외 메시지 작성법"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "예외처리", "베스트프랙티스", "안티패턴", "예외설계", "Exception"]
featured: false
draft: false
---

[지난 글](/posts/java-runtime-exception-types/)에서 자주 마주치는 RuntimeException의 종류와 방어 방법을 살펴봤다. 이번에는 **예외 처리의 올바른 원칙**을 종합 정리한다. 예외 관련 코드 리뷰에서 반복적으로 지적되는 안티패턴과 그 해결책을 중심으로 다룬다.

## 원칙 1: 예외는 예외적 상황에만 사용한다

예외는 제어 흐름 도구가 아니다. 예외를 던지면 스택 트레이스를 생성하는 비용이 발생한다(JVM은 모든 스택 프레임을 순회해야 한다).

```java
// ❌ 예외로 정상 흐름 제어
try {
    int value = Integer.parseInt(input);
    // ... 정상 처리
} catch (NumberFormatException e) {
    // 숫자가 아닌 경우 → 정상 케이스인데 예외로 분기
    handleNonNumber(input);
}

// ✅ 조건 검사로 흐름 제어
if (input != null && input.matches("-?\\d+")) {
    int value = Integer.parseInt(input);
    // ... 정상 처리
} else {
    handleNonNumber(input);
}
```

예외가 실제로 예외적(exceptional)인 상황인지 판단하는 기준: **정상 실행 경로에서 발생할 수 있는가?** 그렇다면 조건 검사가 맞다.

## 원칙 2: 예외를 삼키지 않는다

빈 `catch` 블록은 버그의 무덤이다.

```java
// ❌ 절대 안 됨
try {
    loadConfiguration();
} catch (IOException e) {
    // 아무것도 안 함 → 설정 로드 실패가 조용히 무시됨
}

// ✅ 최소한 로그 + 재던지기 또는 기본값
try {
    loadConfiguration();
} catch (IOException e) {
    log.warn("설정 파일 로드 실패, 기본값 사용", e);
    useDefaultConfig();
}
```

부득이하게 예외를 무시해야 한다면(예: `close()` 내부에서) 그 이유를 주석으로 명시한다.

## 원칙 3: 로그는 경계에서 한 번만

예외를 로그로 남기고 다시 던지면 동일한 예외가 여러 계층에서 중복 출력된다.

```java
// ❌ 로그 + 재던지기 — 중복 로그 발생
@Service
public class OrderService {
    public Order createOrder(OrderRequest req) {
        try {
            return orderRepository.save(toEntity(req));
        } catch (DataAccessException e) {
            log.error("주문 저장 실패", e); // 1번 로그
            throw new OrderServiceException("주문 생성 오류", e);
        }
    }
}

@RestController
public class OrderController {
    @ExceptionHandler(OrderServiceException.class)
    public ResponseEntity<?> handleError(OrderServiceException e) {
        log.error("주문 오류", e); // 2번 로그 — 같은 예외를 또!
        return ResponseEntity.status(500).body(...);
    }
}

// ✅ 중간 계층은 래핑만, 로그는 최상위 ExceptionHandler에서만
@Service
public class OrderService {
    public Order createOrder(OrderRequest req) {
        try {
            return orderRepository.save(toEntity(req));
        } catch (DataAccessException e) {
            throw new OrderServiceException("주문 생성 오류", e); // 로그 없음
        }
    }
}
```

![예외 처리 의사결정 흐름](/assets/posts/java-exception-best-practices-decision.svg)

## 원칙 4: 추상화 수준에 맞는 예외를 던진다

하위 계층의 기술적 예외가 상위 계층의 비즈니스 코드로 노출되면 안 된다.

```java
// ❌ 기술 예외가 비즈니스 계층까지 노출
public interface UserRepository {
    User findById(long id) throws SQLException; // SQL 예외가 인터페이스에
}

// ✅ 도메인 예외로 래핑
public interface UserRepository {
    User findById(long id); // 구현체에서 내부적으로 처리

    // 또는
    Optional<User> findById(long id); // null 대신 Optional
}

// 구현체에서 래핑
class JdbcUserRepository implements UserRepository {
    @Override
    public User findById(long id) {
        try {
            return jdbc.queryForObject(...);
        } catch (EmptyResultDataAccessException e) {
            throw new UserNotFoundException(id, e);
        } catch (DataAccessException e) {
            throw new DataAccessAppException("사용자 조회 실패", e);
        }
    }
}
```

## 원칙 5: 예외 메시지에 충분한 컨텍스트를 포함한다

```java
// ❌ 컨텍스트 없는 메시지
throw new IllegalArgumentException("Invalid value");

// ✅ 어떤 값이 왜 잘못됐는지 명시
throw new IllegalArgumentException(
    "나이는 0~150 사이여야 합니다. 입력값: " + age);

// ✅ 식별자 포함
throw new UserNotFoundException(
    "사용자를 찾을 수 없습니다. userId=" + userId + ", email=" + email);
```

예외 메시지는 디버거 없이 로그만으로 문제를 파악할 수 있을 만큼 상세해야 한다.

## 원칙 6: Checked vs Unchecked 일관성

API 전체에서 일관된 선택을 한다. 현대 Java 개발(Spring, JPA 등)에서는 대부분 Unchecked를 선호한다.

```java
// ✅ 일관성 있는 Unchecked 예외
public class UserService {
    public User getUser(long id) {
        // throws 선언 없음 — 내부에서 RuntimeException 하위로 처리
        return userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id));
    }
}
```

Checked 예외는 **호출자가 반드시 복구 로직을 제공해야** 하는 경우에만 사용한다. 예: `FileNotFoundException`(파일 없으면 다른 경로 시도).

## 원칙 7: finally 블록에서 예외를 던지지 않는다

```java
// ❌ finally에서 예외 → try 블록 예외가 소실됨
try {
    process();
} finally {
    connection.close(); // close()가 예외를 던지면 process()의 예외가 사라짐
}

// ✅ try-with-resources 사용 (Suppressed Exception으로 보존)
try (Connection conn = ...) {
    process();
}
// 또는 finally 내부에서 예외 처리
try {
    process();
} finally {
    try { connection.close(); } catch (Exception e) { log.warn("close 실패", e); }
}
```

## 원칙 8: 성능에 민감한 경우 스택 트레이스 생성 억제

```java
// writableStackTrace=false → fillInStackTrace() 건너뜀
public class ValidationException extends RuntimeException {
    public ValidationException(String message) {
        super(message, null, true, false);
    }
}
```

스택 트레이스 생성은 성능 비용이 크다. **비즈니스 흐름 제어**를 위해 예외를 대량으로 생성하는 경우(Optional로 대체하는 것이 더 나은 상황)에만 고려한다.

![예외 처리 안티패턴 vs 올바른 패턴](/assets/posts/java-exception-best-practices-antipatterns.svg)

## 체크리스트

| 항목 | 확인 |
|------|------|
| 빈 catch 블록 없음 | ✓ |
| cause 항상 전달 | ✓ |
| 로그는 최상위에서만 | ✓ |
| 예외로 정상 흐름 제어 안 함 | ✓ |
| 예외 메시지에 컨텍스트 포함 | ✓ |
| 추상화 수준 맞는 예외 타입 | ✓ |
| try-with-resources 사용 | ✓ |
| finally에서 예외 던지지 않음 | ✓ |

이 원칙들을 꾸준히 적용하면 예외가 **문제를 숨기는 블랙홀**이 아니라 **시스템의 상태를 정확히 전달하는 신호**로 작동하는 코드베이스를 만들 수 있다.

---

**지난 글:** [RuntimeException 종류 — 주요 비검사 예외 완전 정리](/posts/java-runtime-exception-types/)

**다음 글:** [Java IO 개요 — 입출력 스트림 구조 이해하기](/posts/java-io-overview/)

<br>
읽어주셔서 감사합니다. 😊
