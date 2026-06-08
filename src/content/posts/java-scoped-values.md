---
title: "ScopedValue: 가상 스레드 시대의 컨텍스트 전파"
description: "Java 21에서 finalized된 ScopedValue API를 소개합니다. ThreadLocal과 비교해 불변성·자동 해제·가상 스레드 친화성에서 어떻게 다른지, where/run 패턴과 중첩 바인딩, StructuredTaskScope와의 통합을 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "ScopedValue", "가상스레드", "Java21", "컨텍스트전파", "ThreadLocal"]
featured: false
draft: false
---

[지난 글](/posts/java-thread-local/)에서 ThreadLocal로 스레드별 상태를 관리하는 방법과, 스레드 풀에서 `remove()`를 빠뜨리면 메모리 누수가 생긴다는 점을 살펴봤습니다. Java 21은 이 문제를 근본적으로 해결하는 **ScopedValue** API를 정식(finalized)으로 도입했습니다. 특히 수백만 개를 가볍게 생성하는 가상 스레드 환경에서 `ThreadLocal`의 한계를 뛰어넘기 위해 설계되었습니다.

## ScopedValue의 핵심 개념

`ScopedValue`는 세 가지 핵심 특성으로 `ThreadLocal`과 구별됩니다.

1. **불변(Immutable)**: 한 번 바인딩된 값은 스코프 내에서 변경할 수 없음
2. **자동 해제**: `run()` 또는 `call()` 블록이 끝나면 자동으로 해제
3. **가상 스레드 최적화**: JVM이 내부적으로 ThreadLocalMap보다 효율적인 방식으로 구현

![ScopedValue 사용 패턴](/assets/posts/java-scoped-values-usage.svg)

## 기본 사용법

```java
import java.lang.ScopedValue;

// 1. 상수로 선언 (static final 권장)
static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();

// 2. 바인딩하고 실행
void handleRequest(String requestId) {
    ScopedValue.where(REQUEST_ID, requestId)
               .run(() -> {
                   // 이 블록 안에서만 REQUEST_ID를 읽을 수 있음
                   processRequest();
               });
    // run() 종료 → REQUEST_ID 자동 해제
}

// 3. 어디서든 get()으로 읽기
void processRequest() {
    String id = REQUEST_ID.get(); // "req-abc-123"
    log.info("Processing {}", id);
    callDownstream();
}

void callDownstream() {
    // 호출 체인 어디서든 접근 가능
    String id = REQUEST_ID.get();
}
```

값이 바인딩되지 않은 상태에서 `get()`을 호출하면 `NoSuchElementException`이 발생합니다. `orElse()`나 `isBound()`로 안전하게 처리할 수 있습니다.

```java
String id = REQUEST_ID.isBound() ? REQUEST_ID.get() : "unknown";
// 또는
String id = REQUEST_ID.orElse("unknown");
```

## ThreadLocal과 상세 비교

![ScopedValue vs ThreadLocal 비교](/assets/posts/java-scoped-values-vs-threadlocal.svg)

```java
// ThreadLocal 방식
static final ThreadLocal<User> USER_TL = new ThreadLocal<>();

void serve(User user) {
    USER_TL.set(user);
    try {
        doWork();
    } finally {
        USER_TL.remove(); // 잊으면 누수!
    }
}

// ScopedValue 방식
static final ScopedValue<User> USER_SV = ScopedValue.newInstance();

void serve(User user) {
    ScopedValue.where(USER_SV, user)
               .run(this::doWork); // 자동 해제, remove() 불필요
}
```

## 중첩 바인딩

`ScopedValue`는 스코프를 중첩할 수 있습니다. 내부 스코프에서 같은 키에 새 값을 바인딩하면, 내부 스코프가 끝날 때 이전 값이 자동으로 복원됩니다.

```java
static final ScopedValue<String> ROLE = ScopedValue.newInstance();

void demo() {
    ScopedValue.where(ROLE, "user").run(() -> {
        System.out.println(ROLE.get()); // "user"

        // 내부 스코프: 일시적으로 admin으로 승격
        ScopedValue.where(ROLE, "admin").run(() -> {
            System.out.println(ROLE.get()); // "admin"
        });

        System.out.println(ROLE.get()); // "user" 복원됨
    });
}
```

`ThreadLocal`로 이 패턴을 구현하려면 이전 값을 직접 저장하고 복원해야 하는데, 예외 상황에서 실수가 잦습니다.

## 여러 값을 한번에 바인딩

```java
static final ScopedValue<User> USER = ScopedValue.newInstance();
static final ScopedValue<String> TRACE_ID = ScopedValue.newInstance();

void handleRequest(User user, String traceId) {
    ScopedValue.where(USER, user)
               .where(TRACE_ID, traceId)
               .run(() -> {
                   // 두 값 모두 접근 가능
                   User u = USER.get();
                   String tid = TRACE_ID.get();
               });
}
```

## StructuredTaskScope와 통합

`ScopedValue`는 Java 21의 `StructuredTaskScope`와 자연스럽게 통합됩니다. 부모 스코프에서 바인딩된 값은 자식 태스크에서도 그대로 읽힙니다.

```java
static final ScopedValue<User> USER = ScopedValue.newInstance();

void parallelProcess(User user) throws Exception {
    ScopedValue.where(USER, user).run(() -> {
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            var f1 = scope.fork(() -> {
                return fetchOrders(USER.get()); // 부모의 USER 값 접근
            });
            var f2 = scope.fork(() -> {
                return fetchProfile(USER.get()); // 동일
            });

            scope.join().throwIfFailed();
            process(f1.get(), f2.get());
        }
    });
}
```

`ThreadLocal` + `InheritableThreadLocal`로 이 패턴을 구현하면 스레드 풀 재사용으로 인한 문제가 생기지만, `ScopedValue`는 이 문제가 없습니다.

## call()로 값 반환

`run()`이 `void`라면 `call()`을 사용해 결과를 반환할 수 있습니다.

```java
String result = ScopedValue.where(USER, currentUser)
                            .call(() -> {
                                return processAndReturn(); // 값 반환
                            });
```

## 가상 스레드에서 ScopedValue 권장 이유

가상 스레드는 수백만 개까지 생성할 수 있습니다. `ThreadLocal`은 스레드마다 `ThreadLocalMap`을 하나씩 보유하는데, 이 맵이 대형 객체 참조를 포함하면 메모리 사용량이 급격히 늘어납니다.

```java
// 가상 스레드 환경에서
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    // 요청당 가상 스레드 생성 (수천~수만)
    for (Request req : requests) {
        executor.submit(() -> {
            // ThreadLocal이라면 스레드마다 Map 생성
            // ScopedValue는 JVM 레벨 최적화로 훨씬 경량
            ScopedValue.where(REQUEST, req).run(this::handle);
        });
    }
}
```

JVM은 `ScopedValue`의 바인딩 체인을 스택 프레임에 유사하게 관리하므로, 가상 스레드의 경량 스택과 잘 맞습니다.

## ThreadLocal에서 마이그레이션

모든 `ThreadLocal`을 즉시 교체할 필요는 없습니다. 다음 조건이 겹칠 때 마이그레이션을 고려하세요.

- 가상 스레드를 대규모로 사용 중
- 값 변경이 필요하지 않음
- `remove()` 누락 버그로 고생하고 있음

```java
// Before
static final ThreadLocal<Ctx> CTX = new ThreadLocal<>();
CTX.set(ctx);
try { work(); } finally { CTX.remove(); }

// After
static final ScopedValue<Ctx> CTX = ScopedValue.newInstance();
ScopedValue.where(CTX, ctx).run(this::work);
```

## 정리

`ScopedValue`는 불변·자동 해제·가상 스레드 친화성이라는 세 가지 개선으로 `ThreadLocal`의 단점을 해결합니다. 새 코드에서 단순한 컨텍스트 전파를 구현한다면 `ScopedValue`가 기본 선택입니다. 값 변경이 필요하거나 Java 21 미만을 지원해야 한다면 `ThreadLocal`을 계속 사용하세요.

---

**지난 글:** [ThreadLocal로 스레드별 상태 관리하기](/posts/java-thread-local/)

**다음 글:** [ExecutorService와 Executor 프레임워크 개요](/posts/java-executor-overview/)

<br>
읽어주셔서 감사합니다. 😊
