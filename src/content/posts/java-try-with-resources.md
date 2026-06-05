---
title: "try-with-resources — 자원 자동 해제의 모든 것"
description: "Java try-with-resources 완전 분석 — AutoCloseable 구현 방법, Suppressed Exception 처리, 다중 자원 역순 close, Java 9 effectively final 변수 지원, 구식 finally 패턴과 비교"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "try-with-resources", "AutoCloseable", "Suppressed Exception", "자원관리", "예외처리"]
featured: false
draft: false
---

[지난 글](/posts/java-try-catch-finally/)에서 `try-catch-finally` 구문의 실행 흐름과 `finally` 블록의 특성을 살펴봤다. 이번에는 Java 7에서 도입된 **`try-with-resources`** 구문을 깊이 파고들어, 자원이 어떻게 자동으로 해제되는지, 예외가 동시에 발생하면 어떻게 처리되는지 이해한다.

## try-with-resources가 등장한 배경

파일, 소켓, 데이터베이스 커넥션 같은 외부 자원은 사용 후 반드시 `close()`를 호출해야 한다. Java 7 이전에는 `finally` 블록에서 직접 닫았는데, 이 방식에는 심각한 문제가 있었다.

```java
// Java 7 이전 — 자원 누수 위험
InputStream in = null;
try {
    in = new FileInputStream("data.txt");
    in.read();
} catch (IOException e) {
    e.printStackTrace();
} finally {
    if (in != null) {
        try {
            in.close(); // close()도 IOException 던질 수 있음
        } catch (IOException e) {
            e.printStackTrace(); // try 블록 예외는 소실!
        }
    }
}
```

`finally`에서 `close()`가 예외를 던지면 `try` 블록에서 발생한 **원래 예외가 완전히 소실**된다. 디버깅이 극도로 어려워지는 치명적 결함이다.

## try-with-resources 기본 구조

```java
try (Resource r = new Resource()) {
    r.doSomething();
} catch (Exception e) {
    e.printStackTrace();
}
// finally 블록 없이도 r.close() 자동 호출
```

소괄호 안에 선언한 자원은 `try` 블록이 종료되는 순간 — 정상 종료든 예외 발생이든 — 컴파일러가 생성한 `finally` 블록에서 `close()`가 자동 호출된다.

![try-with-resources 동작 메커니즘](/assets/posts/java-try-with-resources-mechanism.svg)

## AutoCloseable 인터페이스

`try-with-resources`를 사용하려면 자원 클래스가 `AutoCloseable`을 구현해야 한다.

```java
@FunctionalInterface
public interface AutoCloseable {
    void close() throws Exception;
}

// IO 클래스가 구현하는 Closeable은 AutoCloseable의 하위 타입
public interface Closeable extends AutoCloseable {
    void close() throws IOException; // 더 구체적인 예외
}
```

커스텀 자원 클래스를 만들 때는 다음 원칙을 따른다.

```java
public class DatabaseConnection implements AutoCloseable {
    private final Connection conn;

    public DatabaseConnection(String url) throws SQLException {
        this.conn = DriverManager.getConnection(url);
    }

    public ResultSet query(String sql) throws SQLException {
        return conn.createStatement().executeQuery(sql);
    }

    @Override
    public void close() throws SQLException {
        if (conn != null && !conn.isClosed()) {
            conn.close();
        }
    }
}

// 사용
try (DatabaseConnection db = new DatabaseConnection("jdbc:h2:mem:")) {
    ResultSet rs = db.query("SELECT 1");
    // 블록 종료 시 db.close() 자동 호출
}
```

## 다중 자원 선언과 역순 close

세미콜론으로 구분해 여러 자원을 한 번에 선언할 수 있다.

```java
try (
    InputStream in  = new FileInputStream("input.txt");
    OutputStream out = new FileOutputStream("output.txt")
) {
    in.transferTo(out);
}
// close 순서: out.close() → in.close() (선언 역순)
```

**선언 순서의 역순**으로 `close()`가 호출된다. 이는 먼저 열린 자원이 나중에 닫히는 스택 방식으로, 의존 관계가 있는 자원(예: 스트림 위에 버퍼 래퍼)을 안전하게 처리한다.

## Suppressed Exception — 예외 소실 문제의 해결

`try` 블록과 `close()` 양쪽에서 동시에 예외가 발생하면 어떻게 될까?

```java
class BrokenResource implements AutoCloseable {
    public void use() throws Exception {
        throw new Exception("use() 예외");
    }

    @Override
    public void close() throws Exception {
        throw new Exception("close() 예외");
    }
}

try (BrokenResource r = new BrokenResource()) {
    r.use();
} catch (Exception e) {
    System.out.println("Primary: " + e.getMessage()); // use() 예외
    for (Throwable s : e.getSuppressed()) {
        System.out.println("Suppressed: " + s.getMessage()); // close() 예외
    }
}
```

`try-with-resources`는 `close()` 예외를 **Suppressed Exception**으로 원래 예외에 첨부한다. 정보가 소실되지 않으면서 `try` 블록의 예외가 주 예외로 전파된다.

![Suppressed Exception 처리 원리](/assets/posts/java-try-with-resources-suppressed.svg)

## Java 9: effectively final 변수 지원

Java 9부터는 이미 선언된 변수를 `try` 괄호 안에서 재선언 없이 사용할 수 있다.

```java
// Java 7~8: 반드시 괄호 안에서 선언
InputStream in = createStream();
try (InputStream in2 = in) { // 중복 변수 선언 필요
    in2.read();
}

// Java 9+: effectively final 변수 직접 참조
InputStream in = createStream();
try (in) { // in이 effectively final이면 OK
    in.read();
}
```

단, 변수가 `final`이거나 effectively final(재할당 없음)이어야 한다.

## try-with-resources와 상속

`AutoCloseable`을 구현하는 상위 클래스를 상속할 때는 `close()`를 반드시 재정의하고 `super.close()`를 호출해야 자원이 올바르게 해제된다.

```java
public class BufferedDatabaseConnection extends DatabaseConnection {
    private final PreparedStatement cachedStmt;

    public BufferedDatabaseConnection(String url) throws SQLException {
        super(url);
        this.cachedStmt = /* ... */;
    }

    @Override
    public void close() throws SQLException {
        try {
            cachedStmt.close();
        } finally {
            super.close(); // 상위 자원도 반드시 해제
        }
    }
}
```

## 정리 — try-with-resources 체크리스트

| 항목 | 설명 |
|------|------|
| `AutoCloseable` 구현 | `try` 괄호 안에 선언하려면 필수 |
| close 호출 보장 | 정상/예외 모든 경로에서 자동 호출 |
| 역순 close | 다중 자원은 선언 반대 순서로 닫힘 |
| Suppressed Exception | 예외 소실 없이 `getSuppressed()`로 조회 |
| effectively final (Java 9+) | 재선언 없이 기존 변수 직접 참조 가능 |

자원 관리가 필요한 코드에서는 `finally` 블록 대신 `try-with-resources`를 항상 우선 선택한다. 예외 소실 버그를 원천 차단하고 코드를 훨씬 간결하게 만든다.

---

**지난 글:** [try-catch-finally — 예외 처리 구문 완전 분석](/posts/java-try-catch-finally/)

**다음 글:** [multi-catch — 여러 예외를 한 번에 처리하기](/posts/java-multi-catch/)

<br>
읽어주셔서 감사합니다. 😊
