---
title: "Checked vs Unchecked 예외 — 언제 무엇을 써야 하나"
description: "Java Checked vs Unchecked 예외 완전 비교 — 컴파일러 강제 처리 차이, 복구 가능성 기준으로 선택하는 방법, Checked를 Unchecked로 래핑하는 패턴, Spring이 Unchecked를 선호하는 이유, 람다에서 Checked 예외 처리 문제"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "CheckedException", "UncheckedException", "RuntimeException", "예외설계", "IOException"]
featured: false
draft: false
---

[지난 글](/posts/java-exception-overview/)에서 Java 예외 계층 구조를 살펴봤다. 이번에는 **Checked vs Unchecked 예외의 차이**와 실무에서 어떤 것을 선택해야 하는지 깊이 다룬다.

## 핵심 차이: 컴파일러 강제

Checked 예외는 컴파일러가 처리를 강제한다. `catch`로 잡거나 `throws`로 선언하지 않으면 **컴파일 오류**가 발생한다.

```java
// Checked — 컴파일러가 강제
void readFile(String path) {
    Files.readString(Path.of(path)); // 컴파일 오류!
    // "Unhandled exception: java.io.IOException"
}

// 해결 1: catch
void readFile(String path) {
    try {
        Files.readString(Path.of(path));
    } catch (IOException e) {
        log.error("파일 읽기 실패", e);
    }
}

// 해결 2: throws 선언
void readFile(String path) throws IOException {
    Files.readString(Path.of(path));
}
```

Unchecked 예외는 아무런 선언 없이 어디서든 던질 수 있다.

```java
// Unchecked — 선언 없이 던질 수 있음
void validate(String input) {
    if (input == null || input.isBlank()) {
        throw new IllegalArgumentException("입력값이 비어 있음");
    }
}
```

![Checked vs Unchecked 핵심 비교](/assets/posts/java-checked-vs-unchecked-compare.svg)

## 언제 어떤 것을 쓰나

![Checked vs Unchecked 선택 결정 트리](/assets/posts/java-checked-vs-unchecked-decision.svg)

**Checked를 써야 하는 경우**: 호출자가 예외를 합리적으로 처리(복구)할 수 있을 때. 파일이 없으면 다른 경로 시도, 네트워크 실패 시 재시도, DB 오류 시 롤백이 그 예다.

**Unchecked를 써야 하는 경우**: 프로그래밍 오류이거나, 호출자가 이 예외를 예측하고 처리하는 것이 불합리할 때. `null` 포인터, 배열 범위 초과, 잘못된 인수는 버그를 수정해야지 `catch`로 감추면 안 된다.

```java
// 도서관 파일 읽기 — 복구 가능 → Checked
class BookRepository {
    Book load(String isbn) throws BookNotFoundException {
        Path path = bookDir.resolve(isbn + ".json");
        if (!Files.exists(path)) throw new BookNotFoundException(isbn);
        return parse(Files.readString(path));
    }
}

// 입력 검증 — 프로그래밍 오류 → Unchecked
class OrderService {
    Order createOrder(String productId, int quantity) {
        if (productId == null) throw new IllegalArgumentException("productId는 필수");
        if (quantity <= 0) throw new IllegalArgumentException("수량은 1 이상");
        ...
    }
}
```

## Spring이 Unchecked를 선호하는 이유

Spring Framework는 대부분의 예외를 `RuntimeException` 기반으로 설계한다. `DataAccessException`, `HttpClientErrorException` 등이 모두 Unchecked다.

```java
// Spring DataAccessException — Unchecked
// JDBC SQLException(Checked)를 래핑한 Unchecked
public interface UserRepository {
    User findById(long id); // throws 선언 없음
    // 내부적으로 DataAccessException(Unchecked)를 던질 수 있음
}
```

이유는 두 가지다. 첫째, **API 오염 방지** — `throws SQLException`을 모든 메서드 시그니처에 전파하면 인터페이스가 구현 세부 사항에 오염된다. 둘째, **AOP 트랜잭션 처리** — Spring `@Transactional`은 기본적으로 Unchecked 예외에만 롤백을 적용한다.

## 람다에서 Checked 예외 문제

Checked 예외는 람다/Stream 파이프라인에서 불편하다.

```java
// 컴파일 오류: Function은 Checked 예외를 던지지 못함
List<String> contents = paths.stream()
    .map(p -> Files.readString(p)) // IOException — 컴파일 오류!
    .collect(Collectors.toList());

// 해결 1: try-catch로 감싸기 (장황함)
List<String> contents = paths.stream()
    .map(p -> {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            throw new RuntimeException(e); // Unchecked로 래핑
        }
    })
    .collect(Collectors.toList());

// 해결 2: 헬퍼 메서드로 래핑
static <T, R> Function<T, R> wrap(CheckedFunction<T, R> fn) {
    return t -> {
        try { return fn.apply(t); }
        catch (Exception e) { throw new RuntimeException(e); }
    };
}

List<String> contents = paths.stream()
    .map(wrap(Files::readString))
    .collect(Collectors.toList());
```

이 불편함이 현대 Java에서 Checked 예외 사용이 줄어드는 또 다른 이유다.

## Checked를 Unchecked로 래핑하는 패턴

레이어 경계에서 Checked를 Unchecked로 변환하는 것은 일반적인 패턴이다.

```java
// Repository에서 Checked → Service로 Unchecked 전달
public class UserRepository {
    public User findById(long id) {
        try {
            return jdbcTemplate.queryForObject(SQL, User.class, id);
        } catch (EmptyResultDataAccessException e) {
            throw new UserNotFoundException("User not found: " + id, e);
            // UserNotFoundException extends RuntimeException
        }
    }
}

// 커스텀 Unchecked 예외 — 원인(cause)을 보존
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message, Throwable cause) {
        super(message, cause); // cause 보존 중요!
    }
}
```

예외를 래핑할 때 반드시 원인(cause)을 생성자에 전달한다. 그래야 스택 트레이스에 원인이 남아 디버깅이 가능하다. 원인을 버리는 것은 정보를 잃는 것이다.

---

**지난 글:** [예외 처리 개요 — Java 예외 계층 구조와 설계 원칙](/posts/java-exception-overview/)

**다음 글:** [try-catch-finally — 예외 처리 구문 완전 분석](/posts/java-try-catch-finally/)

<br>
읽어주셔서 감사합니다. 😊
