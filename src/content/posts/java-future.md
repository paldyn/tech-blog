---
title: "Future와 FutureTask: 비동기 결과 추적"
description: "java.util.concurrent.Future의 상태 기계(PENDING/DONE/CANCELLED/FAILED), get()·cancel()·isDone() 메서드, FutureTask 내부 구조, 예외 처리 패턴, CompletableFuture로의 전환 시점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Future", "FutureTask", "비동기", "동시성", "ExecutorService", "Callable"]
featured: false
draft: false
---

[지난 글](/posts/java-executors-factory/)에서 Executors 팩토리 메서드를 각각 분석했습니다. `executor.submit(task)`를 호출하면 `Future`가 반환됩니다. 이번에는 이 **Future** 가 무엇이고 어떻게 사용하는지, 그리고 그 구현체인 **FutureTask**가 어떻게 동작하는지 살펴봅니다.

## Future란?

`Future<V>`는 아직 완료되지 않은 비동기 작업의 결과를 나타내는 핸들입니다. 작업 제출과 결과 수집을 분리해서 그 사이에 다른 일을 할 수 있게 해줍니다.

```java
ExecutorService executor = Executors.newFixedThreadPool(4);

// 즉시 반환, 작업은 백그라운드에서 실행 중
Future<String> future = executor.submit(() -> {
    Thread.sleep(2000);
    return fetchFromRemote();
});

// 그 사이에 다른 일 처리
doOtherWork();

// 필요한 시점에 결과 수집 (완료까지 블로킹)
String result = future.get();
```

![Future 상태와 get() 동작](/assets/posts/java-future-states.svg)

## Future 인터페이스 메서드

```java
public interface Future<V> {
    // 결과가 완료될 때까지 블로킹
    V get() throws InterruptedException, ExecutionException;

    // 최대 timeout까지만 대기, 초과 시 TimeoutException
    V get(long timeout, TimeUnit unit)
        throws InterruptedException, ExecutionException, TimeoutException;

    // 취소 시도. mayInterruptIfRunning=true면 실행 중 스레드 interrupt
    boolean cancel(boolean mayInterruptIfRunning);

    // 취소됐는지 확인
    boolean isCancelled();

    // 완료(정상/예외/취소 모두) 여부
    boolean isDone();
}
```

## get() 호출 시 주의사항

```java
Future<Integer> future = executor.submit(heavyTask);

// 위험: 완료될 때까지 영원히 블로킹
// 작업이 행(hang) 상태면 호출자도 영원히 블로킹
int result = future.get(); // ❌ 타임아웃 없음

// 안전: 타임아웃 지정
try {
    int result = future.get(5, TimeUnit.SECONDS); // ✅
    process(result);
} catch (TimeoutException e) {
    future.cancel(true); // 취소 요청
    log.warn("Task timed out, cancelled");
} catch (ExecutionException e) {
    // 작업에서 던진 예외가 ExecutionException으로 래핑됨
    Throwable cause = e.getCause();
    log.error("Task failed: {}", cause.getMessage(), cause);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt(); // 인터럽트 상태 복원
    future.cancel(true);
}
```

`get()`의 세 가지 checked exception을 모두 처리해야 한다는 점이 번거롭습니다. `CompletableFuture`는 이 부분을 개선합니다.

## cancel(boolean mayInterruptIfRunning)

```java
// 실행 전이면 큐에서 제거
// 실행 중이면 mayInterruptIfRunning에 따라 처리
future.cancel(false); // 실행 전만 취소, 이미 실행 중이면 중단 시도 안 함
future.cancel(true);  // 실행 중인 스레드에도 interrupt 신호 전송

// 단, interrupt를 무시하는 코드는 취소되지 않음
// Thread.sleep(), blocking I/O는 InterruptedException으로 취소됨
// synchronized 블록 내에서는 interrupt 무시됨
```

## FutureTask: Future + Runnable

`FutureTask`는 `Runnable`과 `Future<V>`를 동시에 구현합니다. `executor.submit(callable)`을 호출하면 내부적으로 `FutureTask`가 생성됩니다.

![FutureTask 구조와 활용](/assets/posts/java-future-futuretask.svg)

### 직접 생성하는 이유

`FutureTask`를 직접 생성하면 `done()` 메서드를 오버라이드해서 작업 완료 후 콜백을 추가할 수 있습니다.

```java
FutureTask<Integer> task = new FutureTask<>(() -> compute()) {
    @Override
    protected void done() {
        try {
            if (!isCancelled()) {
                onSuccess(get());
            }
        } catch (ExecutionException e) {
            onFailure(e.getCause());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
};

executor.submit(task); // FutureTask는 Runnable이므로 submit 가능
// 또는
new Thread(task).start();
```

## 여러 Future 처리 패턴

### 패턴 1: invokeAll로 모두 완료 대기

```java
List<Callable<String>> tasks = buildTasks();
// 모두 완료될 때까지 대기 (타임아웃 버전도 있음)
List<Future<String>> futures = executor.invokeAll(tasks);

List<String> results = new ArrayList<>();
for (Future<String> f : futures) {
    try {
        results.add(f.get()); // 이미 완료된 상태
    } catch (ExecutionException e) {
        log.error("Task failed", e.getCause());
    }
}
```

### 패턴 2: 가장 빠른 결과만 사용

```java
// invokeAny: 하나라도 성공하면 즉시 반환, 나머지 취소
String fastest = executor.invokeAny(tasks);
```

### 패턴 3: 완료 순서대로 처리

```java
// ExecutorCompletionService: 완료 순서대로 꺼낼 수 있음
ExecutorCompletionService<String> ecs =
    new ExecutorCompletionService<>(executor);

for (Callable<String> task : tasks) {
    ecs.submit(task);
}

for (int i = 0; i < tasks.size(); i++) {
    Future<String> f = ecs.take(); // 완료된 것부터 꺼냄
    process(f.get());
}
```

`ExecutorCompletionService`는 작업 완료 순서와 제출 순서가 다를 때 유용합니다. 내부적으로 완료된 Future를 `LinkedBlockingQueue`에 넣어줍니다.

## Future의 한계와 CompletableFuture

`Future`에는 세 가지 단점이 있습니다.

1. **콜백 없음**: 완료 시 알림을 받으려면 직접 폴링하거나 `FutureTask.done()` 오버라이드 필요
2. **체이닝 없음**: `future1.thenApply(f2).thenAccept(f3)` 같은 파이프라인 불가
3. **조합 어려움**: 여러 Future를 하나로 합치거나 첫 완료를 감지하기 어려움

```java
// Future로 체이닝을 구현하면 이렇게 된다
Future<String> f1 = executor.submit(() -> fetchUser());
String user = f1.get(); // 블로킹
Future<String> f2 = executor.submit(() -> fetchOrders(user));
String orders = f2.get(); // 다시 블로킹
// 비동기의 장점이 없어짐

// CompletableFuture로 비동기 체이닝
CompletableFuture.supplyAsync(() -> fetchUser())
    .thenApplyAsync(user -> fetchOrders(user))
    .thenAccept(orders -> display(orders));
```

`Future`는 단순하고 이해하기 쉽다는 장점이 있습니다. 단일 비동기 작업의 결과를 기다리는 용도에는 충분합니다. 여러 작업을 체이닝하거나 비동기 파이프라인이 필요하면 `CompletableFuture`로 전환하세요.

---

**지난 글:** [Executors 팩토리 메서드 완전 정리](/posts/java-executors-factory/)

**다음 글:** [Callable: 결과와 예외를 반환하는 작업 단위](/posts/java-callable/)

<br>
읽어주셔서 감사합니다. 😊
