---
title: "ThreadLocal로 스레드별 상태 관리하기"
description: "ThreadLocal의 내부 구조(ThreadLocalMap), 초기값 설정, 사용자 컨텍스트·DB 커넥션 전파 패턴, 스레드 풀에서 메모리 누수를 피하는 remove() 습관, 가상 스레드와의 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "ThreadLocal", "동시성", "스레드", "메모리누수", "컨텍스트전파"]
featured: false
draft: false
---

[지난 글](/posts/java-happens-before/)에서 happens-before 규칙으로 스레드 간 메모리 가시성을 추론하는 방법을 배웠습니다. 이번에는 완전히 다른 접근법인 **ThreadLocal** 을 살펴봅니다. 공유 메모리 접근을 동기화하는 대신, 아예 각 스레드에게 독립적인 사본을 제공해서 경쟁 자체를 없애는 전략입니다.

## ThreadLocal이란?

`ThreadLocal<T>`는 각 스레드가 독립적으로 값을 저장하고 읽는 컨테이너입니다. 동일한 `ThreadLocal` 인스턴스에 대해 `get()`을 호출해도, 스레드마다 서로 다른 값을 반환합니다.

```java
ThreadLocal<String> userId = new ThreadLocal<>();

// 스레드 A
userId.set("alice");
System.out.println(userId.get()); // "alice"

// 스레드 B (동시에 실행)
userId.set("bob");
System.out.println(userId.get()); // "bob"
// 두 스레드는 서로의 값에 간섭하지 않음
```

![ThreadLocal 내부 구조](/assets/posts/java-thread-local-structure.svg)

## 내부 구현: ThreadLocalMap

`ThreadLocal`의 값은 `ThreadLocal` 객체 자체에 저장되지 않습니다. 값은 **`Thread` 객체 안의 `ThreadLocalMap`** 에 저장됩니다. `ThreadLocal` 인스턴스는 이 맵의 **키(key) 역할만** 합니다.

```
Thread 객체
└── ThreadLocalMap (WeakReference 키 사용)
    ├── (ThreadLocal1) → "alice"
    ├── (ThreadLocal2) → Connection@a1b2
    └── ...
```

`WeakReference`로 키를 저장하기 때문에, `ThreadLocal` 인스턴스가 더 이상 강한 참조를 갖지 않으면 키는 GC 대상이 됩니다. 단, 값(value)은 강한 참조로 남아 있어서 키가 GC되어도 값이 남을 수 있습니다. 이것이 메모리 누수의 원인입니다.

## 초기값 설정

```java
// 방법 1: withInitial() - 람다로 초기값 제공
ThreadLocal<List<String>> logs = ThreadLocal.withInitial(ArrayList::new);

// 방법 2: initialValue() 오버라이드
ThreadLocal<SimpleDateFormat> dateFormat = new ThreadLocal<>() {
    @Override
    protected SimpleDateFormat initialValue() {
        return new SimpleDateFormat("yyyy-MM-dd");
    }
};

// 처음 get()하면 initialValue()가 호출됨
List<String> myLogs = logs.get(); // 새 ArrayList 생성
myLogs.add("started");
```

`withInitial()`이 더 간결하므로 대부분의 경우 이것을 사용합니다.

## 실전 사용 패턴

### 패턴 1: 사용자 컨텍스트 전파

웹 프레임워크에서 요청 스레드에 사용자 정보를 바인딩할 때 가장 많이 사용됩니다.

```java
public class SecurityContext {
    private static final ThreadLocal<User> CURRENT_USER = new ThreadLocal<>();

    public static void set(User user) { CURRENT_USER.set(user); }
    public static User get() { return CURRENT_USER.get(); }
    public static void clear() { CURRENT_USER.remove(); }
}

// 필터 또는 인터셉터
public class AuthFilter implements Filter {
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        User user = authenticate(req);
        SecurityContext.set(user);
        try {
            chain.doFilter(req, res);
        } finally {
            SecurityContext.clear(); // 반드시 정리!
        }
    }
}

// 서비스 레이어 - 파라미터 없이 사용자 접근
public class OrderService {
    void placeOrder(Order order) {
        User user = SecurityContext.get(); // 필터가 설정한 사용자
        order.setUserId(user.getId());
        // ...
    }
}
```

### 패턴 2: 스레드별 SimpleDateFormat

`SimpleDateFormat`은 스레드-안전하지 않습니다. `ThreadLocal`로 스레드마다 인스턴스를 두면 동기화 없이 안전하게 사용할 수 있습니다.

```java
private static final ThreadLocal<SimpleDateFormat> DATE_FORMAT =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"));

public String formatDate(Date date) {
    return DATE_FORMAT.get().format(date); // 각 스레드의 인스턴스 사용
}
```

단, Java 8 이후의 `DateTimeFormatter`는 불변(immutable)이므로 `ThreadLocal` 없이도 안전합니다.

### 패턴 3: DB 트랜잭션 커넥션 바인딩

```java
public class TransactionManager {
    private static final ThreadLocal<Connection> CONNECTION = new ThreadLocal<>();

    public static Connection getConnection() {
        Connection conn = CONNECTION.get();
        if (conn == null) {
            conn = dataSource.getConnection();
            conn.setAutoCommit(false);
            CONNECTION.set(conn);
        }
        return conn;
    }

    public static void commit() {
        try {
            getConnection().commit();
        } finally {
            cleanup();
        }
    }

    private static void cleanup() {
        Connection conn = CONNECTION.get();
        if (conn != null) {
            try { conn.close(); } catch (SQLException e) { /* log */ }
        }
        CONNECTION.remove(); // 반드시 제거
    }
}
```

## 주의사항: 스레드 풀과 메모리 누수

![ThreadLocal 위험 패턴과 해결](/assets/posts/java-thread-local-pitfalls.svg)

스레드 풀의 스레드는 재사용됩니다. `ThreadLocal.remove()`를 호출하지 않으면 이전 요청의 값이 다음 요청에 남아 있게 됩니다. 이는 두 가지 문제를 일으킵니다.

1. **메모리 누수**: 이전 요청 객체가 GC되지 않음
2. **보안 문제**: 이전 요청의 사용자 정보가 다른 요청에 노출될 수 있음

```java
// 잘못된 패턴
void handleRequest(User user) {
    ctx.set(user);
    process(); // remove() 없으면 이 스레드를 재사용하는 다음 요청에 user 남음
}

// 올바른 패턴
void handleRequest(User user) {
    ctx.set(user);
    try {
        process();
    } finally {
        ctx.remove(); // 예외가 발생해도 반드시 제거
    }
}
```

## InheritableThreadLocal: 자식 스레드에 값 전달

`InheritableThreadLocal`은 부모 스레드에서 `set()`한 값을 자식 스레드가 자동으로 상속합니다.

```java
InheritableThreadLocal<String> traceId = new InheritableThreadLocal<>();
traceId.set("req-123");

Thread child = new Thread(() -> {
    System.out.println(traceId.get()); // "req-123" 출력 (부모로부터 상속)
});
child.start();
```

단, 스레드 풀에서는 스레드 생성이 재사용 스레드가 아닌 최초 생성 시 한 번만 발생하기 때문에 `InheritableThreadLocal`이 제대로 동작하지 않을 수 있습니다. 이 경우 `TransmittableThreadLocal` 같은 서드파티 라이브러리가 필요합니다.

## 가상 스레드(Virtual Thread)와 ThreadLocal

Java 21의 가상 스레드는 경량이라 수백만 개를 생성할 수 있습니다. 가상 스레드마다 `ThreadLocal` 값을 보유하면 메모리 소비가 늘어날 수 있습니다. Java 21에서 도입된 `ScopedValue`가 이 문제를 해결하기 위한 대안입니다(다음 글에서 다룹니다).

```java
// 가상 스레드에서 ThreadLocal 사용 시 주의
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> {
        heavyObject.set(new LargeObject()); // 100만 가상 스레드라면?
        process();
        heavyObject.remove(); // 더욱 중요해짐
    });
}
```

## 정리

| 상황 | 권장 |
|------|------|
| 요청별 사용자 컨텍스트 전파 | `ThreadLocal` + `finally { remove() }` |
| 스레드 안전하지 않은 객체 재사용 | `ThreadLocal.withInitial()` |
| 부모 → 자식 스레드 전달 | `InheritableThreadLocal` |
| 가상 스레드 컨텍스트 전파 | `ScopedValue` (Java 21+) |

`ThreadLocal`의 핵심 규칙은 단 하나입니다. **스레드 풀을 사용한다면 반드시 `finally` 블록에서 `remove()`를 호출하라.** 이 규칙만 지키면 `ThreadLocal`은 매우 유용하고 효율적인 도구입니다.

---

**지난 글:** [happens-before 규칙 완전 정복](/posts/java-happens-before/)

**다음 글:** [ScopedValue: 가상 스레드 시대의 컨텍스트 전파](/posts/java-scoped-values/)

<br>
읽어주셔서 감사합니다. 😊
