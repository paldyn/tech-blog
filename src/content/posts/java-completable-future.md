---
title: "CompletableFuture 기초와 비동기 파이프라인"
description: "Java 8에서 도입된 CompletableFuture의 생성 방법, 상태 전이, 콜백 체이닝(thenApply/thenCompose/thenAccept), 동기 vs 비동기 변형, 그리고 get()과 join()의 차이를 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "CompletableFuture", "비동기", "파이프라인", "thenApply", "thenCompose"]
featured: false
draft: false
---

[지난 글](/posts/java-recursive-task/)에서 `RecursiveTask`와 `RecursiveAction`으로 Fork/Join 태스크를 구현하는 방법을 살펴봤습니다. Fork/Join은 CPU 바운드 분할 정복에 특화됐지만, 실제 서비스에서 더 자주 만나는 시나리오는 여러 비동기 I/O 작업을 조합해 하나의 결과를 만드는 것입니다. Java 8에서 도입된 **`CompletableFuture`**는 이런 복잡한 비동기 조합을 콜백 체이닝으로 우아하게 표현하게 해 줍니다.

## CompletableFuture란

`java.util.concurrent.CompletableFuture<T>`는 `Future<T>`와 `CompletionStage<T>`를 모두 구현합니다.

- `Future<T>`: 비동기 작업의 결과 핸들 (Java 5)
- `CompletionStage<T>`: 완료 시 콜백/변환을 체이닝할 수 있는 단계 인터페이스

`Future`는 결과를 `get()`으로만 꺼낼 수 있어 콜백이 불가능했습니다. `CompletableFuture`는 완료 시 자동 실행되는 콜백 파이프라인을 구성할 수 있어 **논블로킹 비동기 흐름**을 표현합니다.

## 생성 방법

```java
// 1. supplyAsync: 값을 반환하는 비동기 작업
CompletableFuture<String> cf1 =
    CompletableFuture.supplyAsync(() -> fetchData());

// 2. runAsync: void 비동기 작업
CompletableFuture<Void> cf2 =
    CompletableFuture.runAsync(() -> sendEmail());

// 3. completedFuture: 이미 완료된 결과로 생성
CompletableFuture<String> cf3 =
    CompletableFuture.completedFuture("즉시 완료");

// 4. 직접 제어용 (수동 complete)
CompletableFuture<String> cf4 = new CompletableFuture<>();
// 나중에: cf4.complete("result");
```

`supplyAsync`와 `runAsync`의 기본 실행 스레드는 `ForkJoinPool.commonPool()`입니다. 두 번째 인자로 `Executor`를 넘기면 별도 스레드 풀을 사용합니다.

## 상태 전이

![CompletableFuture 상태 전이](/assets/posts/java-completable-future-states.svg)

`CompletableFuture`는 세 가지 완료 상태로 전이되며, 한 번 완료되면 상태가 바뀌지 않습니다.

## 콜백 파이프라인

![CompletableFuture 비동기 파이프라인](/assets/posts/java-completable-future-pipeline.svg)

```java
CompletableFuture.supplyAsync(() -> fetchUser(userId))   // CF<User>
    .thenApply(User::getName)                            // CF<String>
    .thenCompose(name -> fetchOrdersAsync(name))         // CF<List<Order>>
    .thenAccept(orders -> render(orders))                // CF<Void>
    .exceptionally(ex -> {
        log.error("오류", ex); return null;
    });
```

각 단계는 이전 단계가 완료되면 자동으로 실행됩니다. 스레드를 블로킹하지 않아도 됩니다.

## 핵심 콜백 메서드

| 메서드 | 입력 | 출력 | 용도 |
|---|---|---|---|
| `thenApply(fn)` | T | U | 값 변환 |
| `thenCompose(fn)` | T | CF\<U\> | 중첩 CF 플래트닝 |
| `thenAccept(fn)` | T | void | 결과 소비 |
| `thenRun(fn)` | (없음) | void | 완료 후 실행 |
| `thenCombine(cf2, fn)` | T, U | V | 두 결과 결합 |

`thenApply` vs `thenCompose`: `thenApply`는 동기 변환, `thenCompose`는 비동기 함수(CF를 반환)를 받아 중첩을 방지합니다.

```java
// thenApply는 CF<CF<String>>이 되어버림 (비추)
CompletableFuture<CompletableFuture<String>> bad =
    cf.thenApply(t -> fetchAsync(t));

// thenCompose는 CF<String>으로 플래트닝 (권장)
CompletableFuture<String> good =
    cf.thenCompose(t -> fetchAsync(t));
```

## 동기 vs 비동기 변형

모든 `then*` 메서드에는 `Async` 접미사 버전이 있습니다.

```java
cf.thenApply(fn)           // 완료 스레드(또는 현재 스레드)에서 실행
cf.thenApplyAsync(fn)      // commonPool에서 실행
cf.thenApplyAsync(fn, ex)  // 지정 Executor에서 실행
```

CPU 가벼운 변환은 `thenApply`(컨텍스트 스위치 없음), I/O 작업이나 오래 걸리는 작업은 `thenApplyAsync`를 씁니다.

## get() vs join()

```java
// get() — 체크 예외 (InterruptedException, ExecutionException)
try {
    String result = cf.get();
    String result2 = cf.get(5, TimeUnit.SECONDS); // 타임아웃
} catch (InterruptedException | ExecutionException e) { ... }

// join() — 언체크 예외 (CompletionException)
String result = cf.join(); // 파이프라인 내부에서 자주 사용
```

`join()`은 파이프라인 안(`thenApply` 람다 등)에서 다른 CF를 기다릴 때 코드가 간결해서 선호됩니다. `get()`은 외부에서 타임아웃을 걸어야 할 때 사용합니다.

## 수동 완료

```java
CompletableFuture<String> cf = new CompletableFuture<>();

// 비동기 이벤트(콜백, 이벤트 루프 등)에서 직접 완료
eventBus.on("data", event -> cf.complete(event.data()));
eventBus.on("error", err -> cf.completeExceptionally(err.cause()));

String result = cf.join(); // 이벤트 올 때까지 대기
```

이 패턴은 레거시 콜백 API를 `CompletableFuture`로 래핑할 때 유용합니다.

---

**지난 글:** [RecursiveTask와 RecursiveAction 완전 정복](/posts/java-recursive-task/)

**다음 글:** [CompletableFuture 조합 연산자 완전 정복](/posts/java-completable-future-combinators/)

<br>
읽어주셔서 감사합니다. 😊
