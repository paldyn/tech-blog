---
title: "CompletableFuture 비동기 예외 처리 완전 정복"
description: "exceptionally, handle, whenComplete의 동작 차이, CompletionException 언래핑, 타임아웃 처리, 그리고 비동기 파이프라인에서 예외를 안전하게 다루는 패턴을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "CompletableFuture", "예외처리", "exceptionally", "handle", "whenComplete"]
featured: false
draft: false
---

[지난 글](/posts/java-completable-future-combinators/)에서 `thenCombine`, `allOf`, `anyOf` 등의 조합 연산자를 살펴봤습니다. 비동기 파이프라인에서는 예외가 발생해도 현재 스레드로 전파되지 않기 때문에 일반 `try-catch`로는 잡을 수 없습니다. 이번에는 `CompletableFuture` 파이프라인에서 예외를 안전하게 처리하는 전용 메서드들을 다룹니다.

## 비동기 예외의 특수성

```java
// 예외가 발생해도 현재 스레드에 전파되지 않음!
CompletableFuture.supplyAsync(() -> {
    throw new RuntimeException("네트워크 오류");
});
// 위 줄 이후 아무 일도 없는 것처럼 보임 — 예외는 CF 안에 포착됨
```

`supplyAsync` 안에서 예외가 발생하면 CF는 예외 완료 상태(Exceptionally)가 되고, 다음 `thenApply` 등의 단계는 모두 건너뛰어집니다. `join()`이나 `get()` 호출 시 `CompletionException`(또는 `ExecutionException`)으로 감싸져 던져집니다.

## 세 가지 예외 처리 메서드

![CompletableFuture 예외 처리 메서드 비교](/assets/posts/java-async-exc-methods.svg)

### exceptionally: 예외를 기본값으로 대체

```java
CompletableFuture<String> result = callApiAsync()
    .exceptionally(ex -> {
        log.warn("API 실패, 기본값 사용", ex);
        return "기본값";
    });
```

정상 완료 시에는 원래 값이 그대로 통과합니다. 예외 발생 시에만 `fn(Throwable) → T`가 호출됩니다.

### handle: 정상/예외 통합 처리

```java
CompletableFuture<String> result = callApiAsync()
    .handle((value, ex) -> {
        if (ex != null) {
            log.warn("실패", ex);
            return "기본값";
        }
        return value.toUpperCase();
    });
```

정상이든 예외든 **항상** 호출됩니다. `value`와 `ex` 중 하나는 반드시 `null`입니다. 결과를 다른 타입으로 변환할 수 있어 `exceptionally`보다 유연합니다.

### whenComplete: 부수 효과 전용

```java
callApiAsync()
    .whenComplete((value, ex) -> {
        if (ex != null) metrics.incrementError();
        else metrics.incrementSuccess();
    })
    .thenApply(String::toUpperCase);
```

`handle`과 마찬가지로 항상 호출되지만, **반환 타입이 원본 `T`로 고정**됩니다. 로깅·메트릭 같은 부수 효과에만 사용하고, 예외는 그대로 다음 단계로 전파됩니다.

## 통합 패턴: handle + whenComplete 조합

![handle로 예외와 값 통합 처리](/assets/posts/java-async-exc-code.svg)

```java
var value = CompletableFuture
    .supplyAsync(() -> callApi())
    .handle((v, ex) -> ex != null ? fallback() : v)  // 예외 복구
    .whenComplete((v, e) -> metrics.record(v, e))     // 부수 효과
    .join();
```

## CompletionException 언래핑

`join()`은 예외를 `CompletionException`으로 감쌉니다. 원래 예외를 꺼내려면 `getCause()`를 사용합니다.

```java
try {
    result = cf.join();
} catch (CompletionException e) {
    Throwable cause = e.getCause();
    if (cause instanceof TimeoutException) {
        // 타임아웃 처리
    } else if (cause instanceof IOException) {
        // I/O 오류 처리
    } else {
        throw e;
    }
}
```

`get()` 사용 시에는 `ExecutionException`으로 감싸집니다.

## 타임아웃 처리 (Java 9+)

```java
// orTimeout: 타임아웃 시 TimeoutException으로 예외 완료
CompletableFuture<String> cf = callSlowApiAsync()
    .orTimeout(3, TimeUnit.SECONDS)
    .exceptionally(ex -> "타임아웃 기본값");

// completeOnTimeout: 타임아웃 시 기본값으로 정상 완료
CompletableFuture<String> cf2 = callSlowApiAsync()
    .completeOnTimeout("기본값", 3, TimeUnit.SECONDS);
```

`completeOnTimeout`은 `exceptionally` 없이도 타임아웃 기본값을 설정할 수 있어 더 간결합니다.

## 파이프라인 중간에서 예외 삽입

테스트나 특수 상황에서 의도적으로 예외 완료 CF를 만들 수 있습니다.

```java
CompletableFuture<String> failed =
    CompletableFuture.failedFuture(new RuntimeException("의도된 실패")); // Java 9+

// 또는
CompletableFuture<String> cf = new CompletableFuture<>();
cf.completeExceptionally(new RuntimeException("수동 실패"));
```

## 예외 무시 함정

```java
// 위험: 예외를 조용히 삼킴
cf.exceptionally(ex -> null);

// 안전: 항상 로그
cf.exceptionally(ex -> {
    log.error("처리되지 않은 예외", ex);
    return null;
});
```

파이프라인 끝에서 예외를 처리하지 않으면 `CompletableFuture`가 GC될 때 예외가 조용히 사라집니다. 최소한 로깅 처리를 항상 추가하세요.

---

**지난 글:** [CompletableFuture 조합 연산자 완전 정복](/posts/java-completable-future-combinators/)

**다음 글:** [Virtual Threads: Java 21의 경량 동시성 혁신](/posts/java-virtual-threads/)

<br>
읽어주셔서 감사합니다. 😊
