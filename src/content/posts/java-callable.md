---
title: "Callable: 결과와 예외를 반환하는 작업 단위"
description: "java.util.concurrent.Callable 인터페이스를 Runnable과 비교하고, checked 예외 전파 방식, ExecutorService와의 통합, 람다 표현식으로 간결하게 작성하는 방법, 그리고 자주 사용하는 패턴을 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "Callable", "Runnable", "비동기", "동시성", "Future", "ExecutorService"]
featured: false
draft: false
---

[지난 글](/posts/java-future/)에서 비동기 작업의 결과를 추적하는 `Future`를 살펴봤습니다. `Future`를 반환받으려면 `ExecutorService.submit()`에 `Callable`을 전달해야 합니다. 이번에는 **Callable** 인터페이스 자체를 깊이 이해하고, `Runnable`과의 차이, checked 예외 처리, 실전 패턴을 정리합니다.

## Callable 인터페이스

`Callable`은 Java 5에서 `java.util.concurrent` 패키지와 함께 도입되었습니다.

```java
@FunctionalInterface
public interface Callable<V> {
    V call() throws Exception;
}
```

단 하나의 추상 메서드 `call()`을 가지므로 함수형 인터페이스입니다. `Runnable.run()`과 두 가지가 다릅니다.

1. **반환 타입 `V`**: 작업 결과를 타입 안전하게 반환
2. **`throws Exception`**: checked 예외를 호출자에게 전파 가능

![Runnable vs Callable 비교](/assets/posts/java-callable-vs-runnable.svg)

## 람다로 간결하게 작성

`Callable`은 함수형 인터페이스이므로 람다 표현식을 쓸 수 있습니다.

```java
// 클래스 방식 (구식)
Callable<String> task = new Callable<String>() {
    @Override
    public String call() throws Exception {
        return "result";
    }
};

// 람다 방식
Callable<String> task = () -> "result";

// 예외를 던지는 경우도 간결하게
Callable<String> ioTask = () -> {
    try (InputStream is = Files.newInputStream(path)) {
        return new String(is.readAllBytes());
    }
};
```

`Runnable`은 `void run()`이라 반환이 없어서 람다 본문이 표현식이 아닌 문(statement)이어야 하지만, `Callable`은 `() -> 값` 형태의 표현식 람다가 가능합니다.

## ExecutorService와 통합

```java
ExecutorService executor = Executors.newFixedThreadPool(4);

// 단일 Callable 제출
Future<Integer> future = executor.submit(() -> computeExpensiveValue());

// 여러 Callable 제출
List<Callable<String>> tasks = List.of(
    () -> fetchFromServiceA(),
    () -> fetchFromServiceB(),
    () -> fetchFromServiceC()
);

// invokeAll: 모두 완료 대기
List<Future<String>> results = executor.invokeAll(tasks);

// invokeAny: 가장 빠른 하나만
String fastest = executor.invokeAny(tasks);
```

## checked 예외 전파

`Callable`의 핵심 장점 중 하나는 **checked 예외를 자연스럽게 전파**할 수 있다는 점입니다.

![Callable 활용 패턴](/assets/posts/java-callable-patterns.svg)

```java
// Runnable: checked 예외를 직접 던질 수 없음
Runnable r = () -> {
    try {
        Files.readAllBytes(path); // IOException (checked)
    } catch (IOException e) {
        throw new RuntimeException(e); // 래핑 필요
    }
};

// Callable: checked 예외를 그대로 전파 가능
Callable<byte[]> c = () -> Files.readAllBytes(path); // IOException 허용

// 예외는 Future.get()에서 ExecutionException으로 래핑되어 전파
Future<byte[]> f = executor.submit(c);
try {
    byte[] content = f.get();
} catch (ExecutionException e) {
    if (e.getCause() instanceof IOException ioe) {
        handleIoError(ioe);
    }
}
```

`e.getCause()`로 원인 예외를 꺼낼 수 있으므로, 예외 정보가 손실되지 않습니다.

## Callable 직접 실행

`Callable`은 `Runnable`과 달리 `Thread`에 직접 전달할 수 없습니다. 실행하려면 다음 방법 중 하나를 사용합니다.

```java
// 방법 1: ExecutorService.submit()
Future<Integer> f = executor.submit(callable);

// 방법 2: FutureTask로 래핑
FutureTask<Integer> task = new FutureTask<>(callable);
new Thread(task).start();
Integer result = task.get();

// 방법 3: call() 직접 호출 (테스트/단일 스레드 시)
try {
    Integer result = callable.call();
} catch (Exception e) {
    handleError(e);
}
```

## 실전: 병렬 API 호출

```java
class UserDashboard {
    private final ExecutorService executor = Executors.newFixedThreadPool(4);

    DashboardData load(String userId) throws InterruptedException {
        // 세 가지 데이터를 병렬로 조회
        List<Callable<Object>> tasks = List.of(
            () -> userService.getProfile(userId),
            () -> orderService.getOrders(userId),
            () -> notificationService.getUnread(userId)
        );

        List<Future<Object>> futures = executor.invokeAll(tasks,
            10, TimeUnit.SECONDS); // 10초 타임아웃

        UserProfile profile = null;
        List<Order> orders = null;
        int unreadCount = 0;

        try {
            profile = (UserProfile) futures.get(0).get();
        } catch (ExecutionException e) {
            log.warn("Profile load failed", e.getCause());
        }

        try {
            orders = (List<Order>) futures.get(1).get();
        } catch (ExecutionException e) {
            orders = Collections.emptyList();
        }

        try {
            unreadCount = (int) futures.get(2).get();
        } catch (ExecutionException e) {
            unreadCount = -1; // 실패 표시
        }

        return new DashboardData(profile, orders, unreadCount);
    }
}
```

각 API 호출이 독립적이라면 이처럼 병렬로 실행하고 개별 실패를 독립적으로 처리할 수 있습니다.

## Callable을 Runnable로 변환

`Executors` 유틸리티 클래스는 `Callable`을 `Runnable`로 변환하는 메서드를 제공합니다.

```java
Callable<Integer> callable = () -> compute();

// 결과를 무시하는 Runnable로 변환
Runnable r = Executors.callable(callable)::run; // 직접 변환은 없지만
// 또는 FutureTask로 래핑
FutureTask<Integer> task = new FutureTask<>(callable);
```

반대로 `Runnable`을 결과가 있는 `Callable`로 변환하려면 `Executors.callable(Runnable, T result)` 를 사용합니다.

```java
Runnable runnable = () -> doWork();
Callable<String> callable = Executors.callable(runnable, "done");
// callable.call() → "done" 반환 (runnable 실행 후)
```

## 언제 Callable을 쓸까?

```
비동기 작업에서:
├── 결과값이 필요하다 → Callable<T>
├── checked 예외가 발생한다 → Callable<T>
├── 타임아웃이 필요하다 → Callable<T> + Future.get(timeout)
└── 결과가 필요 없고 예외도 없다 → Runnable
```

현대 Java 코드에서는 `Callable`보다 `CompletableFuture`를 더 많이 사용하는 추세입니다. 하지만 `invokeAll`/`invokeAny`처럼 `ExecutorService`의 배치 제출 메서드를 사용하거나, 코드베이스가 `Future` 기반이라면 `Callable`이 여전히 가장 명확한 선택입니다.

## 정리

| | Runnable | Callable<V> |
|--|---------|------------|
| 반환값 | 없음 | V |
| checked 예외 | 불가 | 가능 |
| 제출 메서드 | execute(), submit() | submit() |
| Thread 직접 사용 | 가능 | 불가 (FutureTask 필요) |
| 도입 버전 | Java 1.0 | Java 5 |

결과가 필요하거나 checked 예외가 발생하는 비동기 작업이라면 `Callable`을 선택하세요. 나머지 경우에는 더 단순한 `Runnable`이 적합합니다.

---

**지난 글:** [Future와 FutureTask: 비동기 결과 추적](/posts/java-future/)

**다음 글:** [CompletionService: 완료 순서대로 결과 처리하기](/posts/java-completion-service/)

<br>
읽어주셔서 감사합니다. 😊
