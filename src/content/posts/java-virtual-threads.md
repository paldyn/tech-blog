---
title: "Virtual Threads: Java 21의 경량 동시성 혁신"
description: "Java 21에서 정식 출시된 Virtual Threads(JEP 444)의 동작 원리, mount/unmount 메커니즘, I/O 블로킹 처리 방식, 그리고 기존 플랫폼 스레드 모델과의 핵심 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "Virtual Threads", "Java21", "Project Loom", "경량 스레드", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-async-exception-handling/)에서 `CompletableFuture` 비동기 파이프라인의 예외 처리를 다뤘습니다. `CompletableFuture`는 강력하지만 콜백 체인 코드가 복잡해지는 단점이 있습니다. Java 21에서 정식 출시된 **Virtual Threads**(JEP 444, Project Loom)는 이 문제를 완전히 다른 방식으로 접근합니다. 동기 스타일 코드를 그대로 유지하면서도 수백만 개의 동시 작업을 처리할 수 있는 경량 스레드 모델입니다.

## 플랫폼 스레드의 한계

기존 Java 스레드(`Thread`)는 OS 스레드와 1:1로 매핑됩니다. OS 스레드는 다음 두 가지 이유로 수를 늘리기 어렵습니다.

1. **생성 비용**: 스레드 하나당 스택 메모리 512KB~1MB 할당
2. **블로킹 낭비**: I/O 대기 중에도 OS 스레드를 점유해 CPU는 유휴 상태

동시에 1만 개의 HTTP 요청을 처리하려면 1만 개의 스레드가 필요하고, 이는 메모리와 컨텍스트 스위치 비용으로 현실적이지 않습니다.

## Virtual Thread란

`Virtual Thread`는 JVM이 관리하는 경량 스레드입니다.

- **캐리어 스레드(Carrier Thread)**: Virtual Thread가 실제로 실행되는 OS 스레드. `ForkJoinPool` 기반이며 CPU 코어 수에 비례.
- **Mount/Unmount**: Virtual Thread가 실행될 때 캐리어에 마운트, I/O 블로킹 시 언마운트하여 캐리어를 반환.

![Virtual Threads 아키텍처](/assets/posts/java-virtual-threads-overview.svg)

Virtual Thread가 `Thread.sleep()`, `InputStream.read()`, `Socket.connect()` 같은 블로킹 작업을 만나면 JVM이 자동으로 언마운트합니다. 해당 Virtual Thread는 힙에 보관(parked 상태)되고, 캐리어 스레드는 즉시 다른 Virtual Thread를 실행합니다. 블로킹이 해제되면 사용 가능한 캐리어에 다시 마운트됩니다.

## Virtual Thread 생성

```java
// 1. Thread.ofVirtual() (Java 21)
Thread vt = Thread.ofVirtual()
    .name("my-vt")
    .start(() -> System.out.println("Hello VT!"));
vt.join();

// 2. Thread.startVirtualThread (단순 시작)
Thread.startVirtualThread(() -> doWork());

// 3. Executor (권장 — 리소스 관리 포함)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> handleRequest());
}
```

## 1만 개 동시 작업 처리

![Virtual Thread 생성 및 활용 코드](/assets/posts/java-virtual-threads-code.svg)

```java
// 플랫폼 스레드 풀로는 불가능하거나 매우 느린 규모
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i ->
        executor.submit(() -> {
            Thread.sleep(Duration.ofMillis(100)); // 블로킹 I/O 시뮬레이션
            process(i);
        })
    );
} // close() = 모든 Virtual Thread 완료 대기
```

`newVirtualThreadPerTaskExecutor()`는 작업마다 새 Virtual Thread를 생성합니다. 플랫폼 스레드와 달리 생성 비용이 거의 없으므로 풀링이 필요 없습니다.

## 스택 크기와 메모리

| | 플랫폼 스레드 | Virtual Thread |
|---|---|---|
| 초기 스택 | ~512KB | ~수백 바이트 |
| 최대 스택 | 고정 | 동적 확장 |
| 블로킹 시 메모리 | OS 스레드 전체 점유 | 힙에 연속 스택 저장 |
| 10만 개 생성 | ~50GB 불가 | ~수십 MB 가능 |

## 동기 코드 그대로 사용

Virtual Thread의 가장 큰 장점은 **기존 블로킹 코드를 수정하지 않아도** 된다는 것입니다.

```java
// 기존 동기 JDBC/HTTP 코드를 Virtual Thread Executor로만 실행
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> futures = urls.stream()
        .map(url -> executor.submit(() -> {
            // 기존 동기 HTTP 클라이언트 사용 — 수정 없음
            return httpClient.get(url); // 블로킹이지만 VT가 처리
        }))
        .toList();
    // 결과 수집
    for (var f : futures) System.out.println(f.get());
}
```

`CompletableFuture`의 콜백 체이닝이나 리액티브 프로그래밍 없이도 동일한 처리량을 얻을 수 있습니다.

## 주의사항

**스레드 로컬**: Virtual Thread도 `ThreadLocal`을 사용할 수 있지만, 수백만 개가 생성되면 `ThreadLocal` 값이 메모리를 많이 차지합니다. Java 21의 `ScopedValue`(JEP 446)가 대안입니다.

**풀링 금지**: `Executors.newVirtualThreadPerTaskExecutor()`를 사용하고, Virtual Thread를 직접 풀링하지 마세요. 생성 비용이 매우 낮으므로 불필요합니다.

**Pinning(피닝)**: `synchronized` 블록이나 `Object.wait()` 사용 시 Virtual Thread가 캐리어에 고정(pinned)될 수 있습니다. `ReentrantLock` 사용을 권장합니다.

---

**지난 글:** [CompletableFuture 비동기 예외 처리 완전 정복](/posts/java-async-exception-handling/)

**다음 글:** [플랫폼 스레드 vs Virtual Thread 심층 비교](/posts/java-platform-vs-virtual/)

<br>
읽어주셔서 감사합니다. 😊
