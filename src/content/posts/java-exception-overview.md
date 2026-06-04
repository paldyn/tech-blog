---
title: "예외 처리 개요 — Java 예외 계층 구조와 설계 원칙"
description: "Java 예외 처리 완전 정리 — Throwable·Error·Exception 계층 구조, Checked vs Unchecked 예외 차이, 예외 전파 메커니즘, throw와 throws 사용법, 예외 처리 설계 원칙, 예외를 언제 던지고 언제 처리해야 하는지 판단 기준"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "예외처리", "Exception", "Throwable", "RuntimeException", "CheckedException"]
featured: false
draft: false
---

[지난 글](/posts/java-optional-anti-patterns/)에서 Optional 안티패턴을 살펴봤다. 이제 Java 예외 처리 챕터로 넘어간다. **예외(Exception)** 는 Java 프로그램이 실행 중 발생하는 비정상적인 상황을 처리하는 메커니즘이다. 올바른 예외 처리는 버그 추적과 시스템 안정성에 직결된다.

## Java 예외 계층 구조

Java에서 예외와 오류는 모두 `Throwable`에서 시작한다. `Throwable`의 두 직계 자식이 `Error`와 `Exception`이다.

```java
Throwable
├── Error          // 복구 불가능한 JVM 수준 오류
│   ├── OutOfMemoryError
│   ├── StackOverflowError
│   └── AssertionError ...
└── Exception      // 프로그램이 처리 가능한 예외
    ├── IOException (Checked)
    ├── SQLException (Checked)
    └── RuntimeException (Unchecked)
        ├── NullPointerException
        ├── IllegalArgumentException
        ├── IndexOutOfBoundsException
        └── ...
```

![Java 예외 계층 구조](/assets/posts/java-exception-overview-hierarchy.svg)

## Error vs Exception

**Error**: JVM 수준에서 발생하며 일반적으로 복구가 불가능하다. `OutOfMemoryError`, `StackOverflowError`가 대표적이다. 프로그래머가 `catch`로 잡아서 처리하면 안 된다. 시스템 재시작이나 메모리 설정 조정이 해결책이다.

**Exception**: 프로그램 실행 중 발생하지만 적절히 처리하면 복구 가능하다. 파일이 없거나, DB 연결이 실패하거나, 잘못된 입력이 들어오는 경우가 해당한다.

```java
// Error는 catch하지 않는 것이 원칙
// 단, finally에서 자원 해제는 허용
try {
    processHugeFile();
} catch (OutOfMemoryError e) {
    // X — 일반적으로 잡으면 안 됨
    // 시스템 상태 자체가 불안정
}

// Exception은 catch해서 복구 또는 적절히 처리
try {
    user = userService.findUser(id);
} catch (UserNotFoundException e) {
    user = User.createGuest(); // 복구
}
```

## Checked vs Unchecked 예외

Java 예외의 핵심 개념이다.

| 구분 | Checked | Unchecked |
|------|---------|-----------|
| 기반 클래스 | `Exception` (RuntimeException 제외) | `RuntimeException` |
| 컴파일러 강제 | 처리 필수 | 선택 |
| 대표 예외 | `IOException`, `SQLException` | `NullPointerException`, `IllegalArgumentException` |
| 사용 시점 | 외부 시스템과의 연동, 파일/DB | 프로그래밍 오류, 잘못된 입력 |

```java
// Checked: throws 선언 또는 try-catch 필수
void readFile(String path) throws IOException {
    Files.readString(Path.of(path)); // IOException 발생 가능
}

// Unchecked: throws 선언 없이 던질 수 있음
void setAge(int age) {
    if (age < 0) throw new IllegalArgumentException("나이는 음수일 수 없음");
}
```

## throws 선언

메서드가 Checked 예외를 처리하지 않고 호출자에게 전파할 때 `throws`로 선언해야 한다.

```java
// throws: 이 메서드는 IOException을 전파할 수 있음
public String loadConfig(String file) throws IOException {
    return Files.readString(Path.of(file));
}

// 여러 예외 선언
public void connect(String url) throws IOException, SQLException {
    ...
}

// 호출자는 처리하거나 다시 선언해야 함
try {
    String config = loadConfig("app.yml");
} catch (IOException e) {
    log.error("설정 파일 로드 실패", e);
}
```

## 예외 전파 메커니즘

예외가 발생하면 현재 스택 프레임에서 처리되지 않으면 호출자에게 전파되고, 계속 전파되다가 처리되지 않으면 스레드가 종료된다.

![예외 전파와 처리 흐름](/assets/posts/java-exception-overview-flow.svg)

```java
// 예외 전파 체인
void main() {
    try {
        service();
    } catch (Exception e) {
        // repository()에서 던진 예외를 여기서 처리
        System.err.println("오류: " + e.getMessage());
    }
}

void service() {
    repository(); // 예외를 catch하지 않으면 main으로 전파
}

void repository() {
    throw new RuntimeException("DB 연결 실패");
}
```

## 예외 처리 설계 원칙

**언제 던져야 하나**: 메서드가 그 작업을 완수할 수 없고, 호출자가 이 상황을 알아야 할 때 예외를 던진다.

**언제 처리해야 하나**: 의미 있는 복구 행동(기본값 사용, 재시도, 로깅 후 대안 실행)이 가능할 때 처리한다.

```java
// 좋은 예: 의미 있는 복구가 있을 때 처리
public User getUser(long id) {
    try {
        return userRepo.findById(id);
    } catch (DataAccessException e) {
        // DB 연결 실패 → 캐시에서 시도
        return cache.getUser(id);
    }
}

// 나쁜 예: 예외를 삼키기 (silently ignoring)
try {
    doSomething();
} catch (Exception e) {
    // 아무것도 안 함 — 버그 추적 불가능
}

// 나쁜 예: 너무 넓게 잡기
try {
    doSomething();
} catch (Exception e) { // Exception을 잡으면 RuntimeException까지 포함
    log.error("오류", e);
}
```

다음 글에서는 Checked와 Unchecked 예외를 더 깊이 비교하고 언제 어떤 타입을 선택할지 기준을 살펴본다.

---

**지난 글:** [Optional 안티패턴 — 잘못 사용하는 7가지 방법](/posts/java-optional-anti-patterns/)

**다음 글:** [Checked vs Unchecked 예외 — 언제 무엇을 써야 하나](/posts/java-checked-vs-unchecked/)

<br>
읽어주셔서 감사합니다. 😊
