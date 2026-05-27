---
title: "Spring @Async 예외 처리 완전 정복 — void·Future·CompletableFuture 전략"
description: "@Async 메서드에서 예외가 발생했을 때 void·Future·CompletableFuture 반환 타입별로 어떻게 전파·처리되는지 파악하고, AsyncUncaughtExceptionHandler 커스텀 구현부터 CompletableFuture.exceptionally() 패턴까지 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "@Async", "CompletableFuture", "AsyncUncaughtExceptionHandler", "비동기", "예외처리"]
featured: false
draft: false
---

[지난 글](/posts/spring-scheduled-cron/)에서는 `@Scheduled`로 반복 작업을 예약하는 방법을 살펴봤습니다. 이번에는 같은 비동기 영역에 있지만 성격이 다른 `@Async`의 **예외 처리**에 집중합니다. 비동기 메서드에서 예외가 발생하면 동기 코드처럼 호출자 스택으로 자동 전파되지 않습니다. 이 사실을 모르면 예외가 조용히 사라지고, 로그조차 남지 않아 장애를 뒤늦게 발견하는 상황이 발생합니다.

## 왜 비동기 예외는 다를까

`@Async` 메서드는 호출 스레드와 **다른 스레드**에서 실행됩니다. 호출 스레드는 `asyncMethod()`를 호출한 직후 반환되고, 작업 스레드는 독립적으로 돌아갑니다. 작업 스레드에서 예외가 터져도 호출 스레드는 이미 다음 코드를 실행 중이므로, 예외를 "던져받을" 스택이 존재하지 않습니다.

```java
@Service
public class ReportService {

    @Async
    public void generateReport(Long userId) {
        // 이 예외는 호출자에게 전달되지 않는다
        throw new RuntimeException("PDF 생성 실패");
    }
}

// 호출자
reportService.generateReport(1L);
// 예외 발생 여부를 알 수 없음 — try-catch 무의미
```

동기 호출이었다면 `try-catch`로 잡을 수 있지만, `@Async`가 붙은 순간 그 예외는 **작업 스레드 안에만** 존재합니다.

![@Async 예외 처리 경로 비교](/assets/posts/spring-async-exception-handling-flow.svg)

## 반환 타입별 예외 동작

Spring은 `@Async` 메서드의 반환 타입에 따라 예외를 다르게 처리합니다.

| 반환 타입 | 예외 전파 방식 |
|---|---|
| `void` | 호출자에 전파 없음, `AsyncUncaughtExceptionHandler` 호출 |
| `Future<T>` | `Future.get()` 시 `ExecutionException`으로 래핑 |
| `CompletableFuture<T>` | `completeExceptionally()` 저장, `.get()` / `.exceptionally()` 로 처리 |

### void 반환 — AsyncUncaughtExceptionHandler

`void` 반환 메서드에서 발생한 예외는 `AsyncUncaughtExceptionHandler`에 위임됩니다. Spring이 기본으로 등록하는 `SimpleAsyncUncaughtExceptionHandler`는 **로그만 남기고** 아무것도 하지 않습니다. 경보나 재시도가 필요하다면 직접 구현해야 합니다.

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    private final AlertService alertService;

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) -> {
            log.error("[ASYNC ERROR] method={}, params={}, msg={}",
                    method.getName(), Arrays.toString(params), ex.getMessage(), ex);
            // 알림 발송, DB 기록 등 운영 대응
            alertService.sendAlert(method.getName(), ex);
        };
    }

    @Override
    public Executor getAsyncExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-");
        executor.initialize();
        return executor;
    }
}
```

`AsyncConfigurer`를 구현하면 스레드풀 설정과 예외 핸들러를 한 곳에서 관리할 수 있습니다.

### CompletableFuture 반환 — 호출자 처리 패턴

`CompletableFuture<T>`를 반환하면 작업 스레드에서 발생한 예외가 해당 `CompletableFuture` 안에 저장됩니다. 호출자가 `.get()`을 호출하는 시점에 `ExecutionException`으로 감싸져 던져집니다.

```java
@Service
public class DataService {

    @Async
    public CompletableFuture<String> fetchData(Long id) {
        try {
            String result = externalApi.call(id);
            return CompletableFuture.completedFuture(result);
        } catch (Exception e) {
            // 호출자에게 예외를 전달한다
            return CompletableFuture.failedFuture(e);
        }
    }
}
```

호출자 쪽에서는 두 가지 방식으로 처리할 수 있습니다.

```java
// 방법 A: 동기적으로 결과 수신 (블로킹)
try {
    String result = dataService.fetchData(42L).get(5, TimeUnit.SECONDS);
} catch (ExecutionException e) {
    log.error("데이터 조회 실패: {}", e.getCause().getMessage());
} catch (TimeoutException e) {
    log.error("타임아웃 초과");
}

// 방법 B: 비동기 콜백 (논블로킹)
dataService.fetchData(42L)
    .exceptionally(ex -> {
        log.error("복구 처리: {}", ex.getMessage());
        return "fallback-value";
    })
    .thenAccept(result -> processResult(result));
```

방법 B는 호출 스레드를 블로킹하지 않으므로 응답성이 중요한 환경에 적합합니다.

![@Async 예외 처리 설정 코드](/assets/posts/spring-async-exception-handling-handler.svg)

## ThreadPoolTaskExecutor와 예외

스레드풀 자체에서 처리되지 않은 예외가 발생할 경우, `ThreadPoolTaskExecutor`의 `setRejectedExecutionHandler`와 `UncaughtExceptionHandler`를 조합해 방어할 수 있습니다.

```java
executor.setRejectedExecutionHandler((runnable, pool) ->
    log.error("큐 포화로 작업 거부: {}", runnable));

// 스레드 생성 팩토리에서 미처리 예외 후크 등록
executor.setThreadFactory(r -> {
    Thread t = new Thread(r);
    t.setUncaughtExceptionHandler((thread, ex) ->
        log.error("미처리 예외 — thread={}: {}", thread.getName(), ex.getMessage()));
    return t;
});
```

`@Async` 메서드가 `void`를 반환하면서 내부 `try-catch`도 없는 경우, 이 훅이 최후 방어선이 됩니다.

## 자주 저지르는 실수

**① `try-catch` 없이 void 반환을 믿는다**

`void` 반환 `@Async` 메서드에 `AsyncUncaughtExceptionHandler` 없이 그냥 두면 예외가 무음으로 삼켜집니다. 프로덕션에서 "왜 작업이 안 됐지?" 하고 오래 헤매는 원인이 됩니다.

**② CompletableFuture를 반환하면서 결과를 무시한다**

```java
// 나쁜 예 — 반환값을 버림
asyncService.fetchData(1L); // CompletableFuture 무시
```

`CompletableFuture`를 반환했지만 참조를 버리면 예외 정보도 함께 사라집니다. 반드시 `.thenAccept()` / `.exceptionally()` / `.get()` 중 하나로 처리해야 합니다.

**③ `@Async`를 같은 클래스 내에서 호출한다**

Spring의 AOP 프록시는 외부 호출에만 동작합니다. 같은 클래스 내에서 `this.asyncMethod()`를 호출하면 `@Async`가 적용되지 않고 동기로 실행됩니다.

```java
@Service
public class OrderService {

    // 이렇게 하면 @Async 동작하지 않는다
    public void process() {
        this.sendNotification(); // 같은 빈 내부 self-call
    }

    @Async
    public void sendNotification() { ... }
}
```

별도 빈(`NotificationService`)으로 분리하거나 `ApplicationContext`에서 빈을 직접 꺼내는 방식으로 해결합니다.

## 선택 기준 요약

- **fire-and-forget + 운영 감시 필요** → `void` + `AsyncUncaughtExceptionHandler` 커스텀 구현
- **결과 또는 예외를 호출자가 처리** → `CompletableFuture<T>` 반환 + `.exceptionally()` 체인
- **타임아웃 제어 + 블로킹 허용** → `CompletableFuture.get(timeout, unit)` + `try-catch`

`@Async` 비동기 처리에서 예외는 눈에 보이지 않는 함정입니다. 반환 타입을 의식적으로 선택하고, `void` 메서드에는 항상 `AsyncUncaughtExceptionHandler`를 붙이는 습관이 안정적인 서비스 운영의 시작점입니다.

---

**지난 글:** [Spring 스케줄링 — @Scheduled와 Cron 표현식 완전 정복](/posts/spring-scheduled-cron/)

**다음 글:** [Spring ApplicationEvent — 이벤트 기반 느슨한 결합 구현](/posts/spring-application-event/)

<br>
읽어주셔서 감사합니다. 😊
