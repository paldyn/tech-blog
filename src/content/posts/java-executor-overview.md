---
title: "ExecutorService와 Executor 프레임워크 개요"
description: "java.util.concurrent Executor 프레임워크의 인터페이스 계층(Executor → ExecutorService → ThreadPoolExecutor), ExecutorService 생명주기, submit/invoke 차이, 올바른 종료 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "ExecutorService", "Executor", "스레드풀", "동시성", "java.util.concurrent"]
featured: false
draft: false
---

[지난 글](/posts/java-scoped-values/)에서 가상 스레드 환경에 맞는 컨텍스트 전파 방법으로 ScopedValue를 살펴봤습니다. 이번에는 멀티스레드 작업 실행의 핵심 기반인 **Executor 프레임워크**를 전체 관점에서 정리합니다. `Thread`를 직접 생성하고 관리하는 방식에서 벗어나, 작업 제출과 스레드 관리를 분리하는 이 프레임워크를 이해하면 안정적이고 확장 가능한 동시성 코드를 작성할 수 있습니다.

## 왜 Executor 프레임워크인가?

`new Thread(task).start()`를 반복하면 스레드 생성 비용(수 ms)이 누적되고, 동시 실행 스레드 수를 제어할 방법이 없습니다.

```java
// 안티패턴: 요청마다 스레드 생성
for (Request req : requests) {
    new Thread(() -> handle(req)).start(); // 1만 요청 → 1만 스레드?
}
```

Executor 프레임워크는 **스레드 풀을 재사용**하고, **작업 큐를 통해 동시성 수준을 제어**하며, **작업 결과(Future)를 추적**하는 세 가지 문제를 한 번에 해결합니다.

![Executor 프레임워크 인터페이스 계층](/assets/posts/java-executor-overview-hierarchy.svg)

## 인터페이스 계층

### Executor

가장 단순한 인터페이스로, 메서드 하나만 있습니다.

```java
public interface Executor {
    void execute(Runnable command);
}
```

작업을 어디서, 어떻게 실행할지는 구현체가 결정합니다. 동일 스레드에서 즉시 실행할 수도 있고, 풀에서 실행할 수도 있습니다.

### ExecutorService

`Executor`를 확장해 여러 기능을 추가합니다.

```java
// 주요 메서드
Future<T> submit(Callable<T> task);      // 결과 추적
Future<?> submit(Runnable task);         // 결과 없음
List<Future<T>> invokeAll(Collection<Callable<T>> tasks); // 모두 완료 대기
T invokeAny(Collection<Callable<T>> tasks);               // 하나라도 완료 대기
void shutdown();
List<Runnable> shutdownNow();
boolean awaitTermination(long timeout, TimeUnit unit);
```

### ScheduledExecutorService

지연 실행과 주기 실행을 추가합니다.

```java
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

// 5초 후 한 번 실행
scheduler.schedule(() -> doWork(), 5, TimeUnit.SECONDS);

// 10초 후 시작, 이후 매 30초마다 실행
scheduler.scheduleAtFixedRate(() -> poll(), 10, 30, TimeUnit.SECONDS);

// 이전 실행 완료 후 15초 지연 후 재실행
scheduler.scheduleWithFixedDelay(() -> sync(), 0, 15, TimeUnit.SECONDS);
```

## ExecutorService 생명주기

![ExecutorService 생명주기](/assets/posts/java-executor-overview-lifecycle.svg)

```java
ExecutorService executor = Executors.newFixedThreadPool(4);

// 작업 제출
executor.submit(() -> doWork());

// 종료 요청 (새 작업 거부, 기존 작업은 완료)
executor.shutdown();

try {
    // 최대 60초 대기
    if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
        // 60초 안에 안 끝나면 강제 종료
        executor.shutdownNow();
    }
} catch (InterruptedException e) {
    executor.shutdownNow();
    Thread.currentThread().interrupt();
}
```

JDK 19+ 에서는 `AutoCloseable`을 구현하므로 try-with-resources를 사용할 수 있습니다.

```java
// Java 19+ close() = shutdown() + awaitTermination()
try (ExecutorService executor = Executors.newFixedThreadPool(4)) {
    executor.submit(task1);
    executor.submit(task2);
} // try 블록 종료 시 자동으로 graceful shutdown
```

## execute vs submit

```java
// execute: Runnable만, 예외 삼킴
executor.execute(() -> {
    throw new RuntimeException("오류"); // UncaughtExceptionHandler로만 감지
});

// submit: Runnable/Callable, Future로 예외 추적
Future<?> future = executor.submit(() -> {
    throw new RuntimeException("오류");
});
try {
    future.get(); // ExecutionException 발생 → 원인 예외 접근 가능
} catch (ExecutionException e) {
    Throwable cause = e.getCause(); // 원래 RuntimeException
}
```

비동기 작업의 예외를 처리해야 한다면 반드시 `submit()`을 사용하고 `Future.get()`으로 확인해야 합니다. `execute()`로 제출된 작업의 예외는 기본적으로 무시됩니다.

## invokeAll / invokeAny

```java
List<Callable<String>> tasks = List.of(
    () -> fetchFromA(),
    () -> fetchFromB(),
    () -> fetchFromC()
);

// 모두 완료될 때까지 블로킹
List<Future<String>> results = executor.invokeAll(tasks);
for (Future<String> r : results) {
    System.out.println(r.get()); // 이미 완료된 상태
}

// 가장 먼저 완료된 하나의 결과만 반환
String fastest = executor.invokeAny(tasks);
```

`invokeAll()`은 타임아웃 버전도 있어서 `invokeAll(tasks, 10, TimeUnit.SECONDS)` 처럼 사용할 수 있습니다. 타임아웃 내에 완료되지 않은 작업은 취소됩니다.

## Executors 팩토리 메서드

```java
// 고정 크기 스레드 풀
ExecutorService fixed = Executors.newFixedThreadPool(8);

// 필요에 따라 스레드를 생성/재사용, 60초 미사용 시 제거
ExecutorService cached = Executors.newCachedThreadPool();

// 단일 스레드 (순서 보장)
ExecutorService single = Executors.newSingleThreadExecutor();

// 스케줄링 가능
ScheduledExecutorService sched = Executors.newScheduledThreadPool(2);

// Java 21: 작업당 가상 스레드 하나
ExecutorService virtual = Executors.newVirtualThreadPerTaskExecutor();
```

`newCachedThreadPool()`은 부하가 낮을 때 효율적이지만, 갑작스러운 부하 급증 시 스레드가 무제한 생성될 수 있어 주의가 필요합니다.

## ThreadPoolExecutor 직접 생성

세밀한 제어가 필요하면 `Executors` 대신 `ThreadPoolExecutor`를 직접 생성합니다.

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    4,                      // corePoolSize: 항상 유지할 스레드 수
    8,                      // maximumPoolSize: 최대 스레드 수
    60L, TimeUnit.SECONDS,  // keepAliveTime: 유휴 스레드 제거 시간
    new LinkedBlockingQueue<>(100), // workQueue: 작업 대기열
    new ThreadFactory() {   // threadFactory: 스레드 이름 지정 등
        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "worker-" + counter.getAndIncrement());
            t.setDaemon(false);
            return t;
        }
    },
    new ThreadPoolExecutor.CallerRunsPolicy() // 포화 정책
);
```

포화 정책(RejectedExecutionHandler)은 큐와 최대 스레드 수가 모두 꽉 찼을 때의 동작을 결정합니다.

| 정책 | 동작 |
|------|------|
| `AbortPolicy` (기본) | `RejectedExecutionException` throw |
| `CallerRunsPolicy` | 제출자 스레드가 직접 실행 |
| `DiscardPolicy` | 조용히 버림 |
| `DiscardOldestPolicy` | 큐 가장 오래된 작업 버리고 재시도 |

## 정리

| 클래스/인터페이스 | 용도 |
|-----------------|------|
| `Executor` | 가장 단순한 실행 추상화 |
| `ExecutorService` | 생명주기 + Future |
| `ScheduledExecutorService` | 지연/주기 실행 |
| `ThreadPoolExecutor` | 세밀한 풀 제어 |
| `ForkJoinPool` | 분할정복, work-stealing |
| `Executors` | 팩토리 메서드 |

Executor 프레임워크는 Java 동시성 프로그래밍의 기반입니다. 다음 글에서는 스레드 풀의 내부 동작과 크기 조정 전략을 더 깊이 살펴봅니다.

---

**지난 글:** [ScopedValue: 가상 스레드 시대의 컨텍스트 전파](/posts/java-scoped-values/)

**다음 글:** [스레드 풀 완전 분석: ThreadPoolExecutor 내부 동작](/posts/java-thread-pool/)

<br>
읽어주셔서 감사합니다. 😊
