---
title: "Structured Concurrency로 안전한 비동기 구조 만들기"
description: "Java 21에서 도입된 Structured Concurrency(JEP 453)의 핵심 원칙, StructuredTaskScope의 ShutdownOnFailure와 ShutdownOnSuccess 정책, 취소 전파, 그리고 기존 비동기 패턴과의 비교를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "Structured Concurrency", "StructuredTaskScope", "Virtual Threads", "Java21", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-virtual-thread-creation/)에서 Virtual Thread를 생성하고 관리하는 다양한 API를 살펴봤습니다. Virtual Thread는 수백만 개의 동시 작업을 처리할 수 있게 해 주지만, 여러 서브태스크를 안전하게 관리하려면 취소 전파, 예외 수집, 리소스 정리를 직접 구현해야 하는 번거로움이 있습니다. **Structured Concurrency**(JEP 453, Java 21 Preview)는 이 문제를 구조적으로 해결합니다.

## Structured Concurrency란

"구조적 동시성"은 **동시 실행의 수명이 코드 구조(범위)를 벗어나지 않는다**는 원칙입니다. `try` 블록처럼 열고 닫는 명확한 경계가 있으며, 범위 안에서 생성된 모든 서브태스크는 범위가 닫힐 때 반드시 완료되거나 취소됩니다.

구조적 동시성의 세 원칙:
1. **경계**: 자식 태스크는 부모 범위 밖으로 나갈 수 없습니다.
2. **완전성**: 부모 범위 종료 시 모든 자식이 완료됩니다.
3. **에러 전파**: 자식의 예외가 부모에 자동으로 전파됩니다.

## StructuredTaskScope

`java.util.concurrent.StructuredTaskScope`가 핵심 클래스입니다. `AutoCloseable`을 구현하므로 `try-with-resources`로 사용합니다.

![Structured Concurrency 계층 구조](/assets/posts/java-structured-concurrency-overview.svg)

```java
// 기본 패턴
try (var scope = new StructuredTaskScope<String>()) {
    var t1 = scope.fork(() -> fetchUser(id));
    var t2 = scope.fork(() -> fetchOrders(id));
    scope.join(); // 모두 완료될 때까지 대기
    // t1.get(), t2.get() 사용
}
```

`fork()`는 새 Virtual Thread에서 `Callable`을 실행하고 `Subtask<T>` 핸들을 반환합니다. `join()` 이후에만 `Subtask.get()`으로 결과를 꺼낼 수 있습니다.

## ShutdownOnFailure: 하나 실패 시 전체 취소

![ShutdownOnFailure 패턴 코드](/assets/posts/java-structured-concurrency-code.svg)

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var userTask  = scope.fork(() -> fetchUser(id));
    var orderTask = scope.fork(() -> fetchOrders(id));
    scope.join();
    scope.throwIfFailed(); // 실패한 태스크가 있으면 ExecutionException
    return new Dashboard(userTask.get(), orderTask.get());
}
```

`userTask` 또는 `orderTask` 중 하나가 예외를 던지면 `scope.shutdown()`이 즉시 호출되어 나머지 태스크가 인터럽트됩니다. `throwIfFailed()`는 첫 번째 예외를 `ExecutionException`으로 포장해 던집니다.

## ShutdownOnSuccess: 첫 번째 성공 시 종료

```java
try (var scope = new StructuredTaskScope.ShutdownOnSuccess<String>()) {
    scope.fork(() -> queryPrimary(id));   // 빠른 서버
    scope.fork(() -> queryReplica(id));   // 느린 서버
    scope.join();
    String result = scope.result(); // 가장 먼저 성공한 결과
    return result;
}
```

여러 서버에 같은 요청을 보내고 가장 먼저 성공한 응답을 사용하는 헤징(Hedging) 패턴입니다. `result()`는 성공 결과를 반환하거나, 모두 실패한 경우 `ExecutionException`을 던집니다.

## 취소 전파 구조

```
handleRequest()  ←── scope.join() 블로킹 중
   ├── fetchUser()  ← 실패! → scope.shutdown() 호출
   └── fetchOrders() ← 자동 인터럽트
```

`ShutdownOnFailure` 정책에서 한 서브태스크가 실패하면:
1. 범위가 `shutdown` 상태로 전환
2. 다른 서브태스크에 `interrupt` 신호 전송
3. `join()`이 반환되고 부모가 계속 실행
4. `throwIfFailed()`에서 예외 발생

## 기존 CompletableFuture 방식과 비교

```java
// CompletableFuture — 취소 전파를 수동으로 구현해야 함
var cf1 = CompletableFuture.supplyAsync(() -> fetchUser(id));
var cf2 = CompletableFuture.supplyAsync(() -> fetchOrders(id));
CompletableFuture.allOf(cf1, cf2)
    .exceptionally(ex -> {
        cf1.cancel(true); cf2.cancel(true); // 수동 취소
        throw new CompletionException(ex);
    })
    .join();

// Structured Concurrency — 취소 자동, 코드 간결
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var u = scope.fork(() -> fetchUser(id));
    var o = scope.fork(() -> fetchOrders(id));
    scope.join().throwIfFailed();
    return new Dashboard(u.get(), o.get());
}
```

## 타임아웃 적용

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var task = scope.fork(() -> slowExternalCall());
    scope.joinUntil(Instant.now().plusSeconds(3)); // 3초 제한
    scope.throwIfFailed(ex -> new TimeoutException("외부 API 타임아웃"));
    return task.get();
}
```

`joinUntil(Instant)`는 지정 시간까지 기다리다 타임아웃 시 범위를 shutdown합니다.

## 관찰성(Observability) 향상

Structured Concurrency를 사용하면 스레드 덤프에서 서브태스크 트리가 계층 구조로 표시됩니다.

```
Thread[#12, request-handler]: handleRequest(id=42)
  └── VT[#13]: fetchUser(id=42)
  └── VT[#14]: fetchOrders(id=42) — 완료 대기 중
```

JFR 이벤트도 부모-자식 관계를 추적합니다. 복잡한 비동기 흐름에서 어느 태스크가 어느 컨텍스트에서 실행 중인지 한눈에 파악할 수 있습니다.

> **현재 상태 (2025년 기준)**: Structured Concurrency는 Java 21~23에서 Preview, Java 24에서도 Preview 유지 중입니다. `--enable-preview` 플래그가 필요합니다. 정식 출시는 Java 25+에서 예정되어 있습니다.

---

**지난 글:** [Virtual Thread 생성과 관리 심화](/posts/java-virtual-thread-creation/)

**다음 글:** [Virtual Thread Pinning 심화 분석](/posts/java-virtual-thread-pinning/)

<br>
읽어주셔서 감사합니다. 😊
