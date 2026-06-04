---
title: "try-catch-finally — 예외 처리 구문 완전 분석"
description: "Java try-catch-finally 완전 분석 — try·catch·finally 실행 순서, 다중 catch와 예외 순서, finally 항상 실행 보장, finally에서 return 금지, try-with-resources로 자원 자동 해제, suppressed exception, AutoCloseable 구현 방법"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "try-catch", "finally", "try-with-resources", "AutoCloseable", "예외처리"]
featured: false
draft: false
---

[지난 글](/posts/java-checked-vs-unchecked/)에서 Checked와 Unchecked 예외의 차이와 선택 기준을 살펴봤다. 이번에는 **`try-catch-finally` 구문의 실행 메커니즘**을 정확히 이해하고, Java 7에서 도입된 `try-with-resources`까지 다룬다.

## try-catch-finally 기본 구조

```java
try {
    // 예외가 발생할 수 있는 코드
    String data = readFile("config.txt");
    process(data);
} catch (FileNotFoundException e) {
    // FileNotFoundException 발생 시 처리
    log.warn("설정 파일 없음, 기본값 사용");
} catch (IOException e) {
    // 다른 IO 예외 처리
    log.error("파일 읽기 실패", e);
} finally {
    // 예외 여부와 무관하게 항상 실행
    cleanup();
}
```

`try` 블록에서 예외가 발생하면 나머지 `try` 코드를 건너뛰고 해당 `catch`로 이동한다. `finally`는 **항상** 실행된다.

![try-catch-finally 실행 흐름](/assets/posts/java-try-catch-finally-flow.svg)

## catch 순서 — 자식 클래스를 먼저

```java
// 올바른 순서: 구체적인 예외 먼저
try {
    riskyOp();
} catch (FileNotFoundException e) { // IOException의 하위 클래스 — 먼저
    log.warn("파일 없음");
} catch (IOException e) {           // 더 일반적인 예외 — 나중에
    log.error("IO 오류", e);
}

// 잘못된 순서: 컴파일 오류
try {
    riskyOp();
} catch (IOException e) {           // FileNotFoundException을 이미 잡음
} catch (FileNotFoundException e) { // 컴파일 오류: Exception already caught
}
```

## finally 실행 보장과 주의사항

`finally`는 `try` 블록이 `return`으로 빠져나가도, 예외가 전파되어도 실행된다. 단, `System.exit()` 호출이나 JVM 강제 종료 시에는 실행되지 않을 수 있다.

```java
// return이 있어도 finally 실행
String test() {
    try {
        return "try";
    } finally {
        System.out.println("finally 실행"); // 출력됨
        // 실제 반환값은 "try" — finally의 출력 후 return
    }
}

// ⚠ finally에서 return은 절대 금지
String dangerous() {
    try {
        throw new RuntimeException("원래 예외");
    } finally {
        return "finally return"; // 예외가 사라짐! 버그의 온상
    }
}
```

`finally`에서 `return`을 쓰면 `try`에서 발생한 예외가 사라진다. 예외 정보가 완전히 묻혀 디버깅이 불가능해진다.

## 다중 catch — Java 7 multi-catch

```java
// Java 7+ multi-catch: 같은 처리 로직이라면 한 줄로
try {
    connect(url);
} catch (IOException | SQLException e) {
    log.error("연결 실패", e);
    throw new AppException("서비스 연결 실패", e);
}
// 주의: multi-catch에서 e는 effectively final — 재할당 불가
```

## try-with-resources (Java 7+)

`Closeable` 또는 `AutoCloseable`을 구현한 자원은 `try-with-resources`로 자동 해제한다.

![try-with-resources — 자원 자동 해제](/assets/posts/java-try-catch-finally-twr.svg)

```java
// 파일 읽기 — 자동으로 close()
try (BufferedReader br = new BufferedReader(new FileReader(path))) {
    return br.readLine();
} catch (IOException e) {
    throw new FileReadException(path, e);
}

// 여러 자원 — 선언 역순으로 닫힘
try (Connection conn = dataSource.getConnection();
     PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setLong(1, id);
    return ps.executeQuery();
} // ps.close() → conn.close() 순서로 자동 실행
```

`try-with-resources`는 `try-finally`보다 우월하다. 자원 해제를 잊을 수 없고, 예외 발생 시 `close()`에서 또 예외가 발생해도 원래 예외가 보존된다(`getSuppressed()`로 확인 가능).

## Suppressed Exception

`try-with-resources`는 `close()`에서 예외가 발생해도 원래 예외를 보존한다.

```java
try (Resource r = new Resource()) {
    throw new RuntimeException("본 예외");
    // close()에서도 RuntimeException 발생
} catch (RuntimeException e) {
    System.out.println(e.getMessage()); // "본 예외"
    System.out.println(e.getSuppressed()[0].getMessage()); // close() 예외
}
```

## 커스텀 AutoCloseable 구현

자체 자원을 관리하는 클래스는 `AutoCloseable`을 구현하면 `try-with-resources`에서 사용할 수 있다.

```java
public class DatabaseConnection implements AutoCloseable {
    private final Connection conn;

    public DatabaseConnection(String url) throws SQLException {
        this.conn = DriverManager.getConnection(url);
    }

    public void execute(String sql) throws SQLException {
        conn.createStatement().execute(sql);
    }

    @Override
    public void close() throws SQLException {
        if (conn != null && !conn.isClosed()) {
            conn.close();
        }
    }
}

// 사용
try (var db = new DatabaseConnection(url)) {
    db.execute("INSERT INTO ...");
} // 자동으로 close() 호출
```

## 예외 처리 체크리스트

- `catch (Exception e) {}` 처럼 예외를 삼키지 않는다
- `e.getMessage()`만 로깅하지 말고 `e` (스택 트레이스 포함)를 로깅한다
- `finally`에서 `return`이나 `throw`를 쓰지 않는다
- 자원을 사용하면 `try-with-resources`를 쓴다
- 예외를 래핑할 때 원인(cause)을 반드시 전달한다

---

**지난 글:** [Checked vs Unchecked 예외 — 언제 무엇을 써야 하나](/posts/java-checked-vs-unchecked/)

<br>
읽어주셔서 감사합니다. 😊
