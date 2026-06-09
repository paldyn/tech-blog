---
title: "Virtual Thread 생성과 관리 심화"
description: "Thread.ofVirtual(), startVirtualThread(), newVirtualThreadPerTaskExecutor(), ThreadFactory 네 가지 생성 방법, 생명주기 상태 전이, 이름 지정, 취소 처리, 그리고 모니터링 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Virtual Threads", "Thread.ofVirtual", "Executor", "ThreadFactory", "Java21"]
featured: false
draft: false
---

[지난 글](/posts/java-platform-vs-virtual/)에서 플랫폼 스레드와 Virtual Thread의 핵심 차이와 Pinning 문제를 살펴봤습니다. 이번에는 Virtual Thread를 실제로 생성하고 관리하는 네 가지 API와 생명주기, 취소, 모니터링 방법을 구체적으로 다룹니다.

## 네 가지 생성 방법

![Virtual Thread 생성 API 전체 정리](/assets/posts/java-virtual-thread-creation-api.svg)

### 1. Thread.ofVirtual().start()

빌더 패턴으로 이름 등 옵션을 설정한 뒤 바로 시작합니다.

```java
Thread vt = Thread.ofVirtual()
    .name("request-handler", 1)   // "request-handler-1", "request-handler-2" ...
    .start(() -> handleRequest());
vt.join(); // 완료 대기
```

`unstarted()`를 사용하면 나중에 `start()`를 호출할 수 있습니다.

```java
Thread vt = Thread.ofVirtual().name("lazy").unstarted(task);
// ... 원하는 시점에
vt.start();
```

### 2. Thread.startVirtualThread()

한 줄로 Virtual Thread를 시작하는 가장 간결한 방법입니다.

```java
Thread vt = Thread.startVirtualThread(() -> process(data));
vt.join(Duration.ofSeconds(5)); // 최대 5초 대기
```

### 3. Executors.newVirtualThreadPerTaskExecutor() — 권장

작업마다 새 Virtual Thread를 생성하는 `ExecutorService`입니다. `AutoCloseable`을 구현하므로 `try-with-resources`와 잘 맞습니다.

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> futures = urls.stream()
        .map(url -> executor.submit(() -> fetch(url)))
        .toList();
    for (var f : futures) {
        System.out.println(f.get());
    }
} // close() = 모든 VT 완료 후 종료
```

`close()`는 `shutdown()` + `awaitTermination()`을 내부적으로 호출합니다. 실행 중인 모든 Virtual Thread가 완료될 때까지 블로킹됩니다.

### 4. ThreadFactory

기존 `Executor` 프레임워크나 라이브러리에 Virtual Thread 팩토리를 주입할 때 사용합니다.

```java
ThreadFactory vtFactory = Thread.ofVirtual()
    .name("pool-vt-", 0)
    .factory();

// 기존 ThreadPoolExecutor에 주입
ExecutorService executor = new ThreadPoolExecutor(
    0, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS,
    new SynchronousQueue<>(), vtFactory
);
```

## 생명주기와 상태 전이

![Virtual Thread 생명주기](/assets/posts/java-virtual-thread-creation-lifecycle.svg)

Virtual Thread의 상태는 플랫폼 스레드와 같은 `Thread.State` 열거형을 사용하지만 내부 의미가 다릅니다.

```java
Thread vt = Thread.ofVirtual().unstarted(() -> {
    try {
        Thread.sleep(Duration.ofSeconds(1)); // TIMED_WAITING
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});
System.out.println(vt.getState()); // NEW
vt.start();
// 짧은 시간 후:
System.out.println(vt.getState()); // TIMED_WAITING (parked)
```

## 취소와 인터럽트

Virtual Thread도 플랫폼 스레드와 동일하게 `interrupt()`로 취소합니다.

```java
Thread vt = Thread.ofVirtual().start(() -> {
    try {
        while (!Thread.currentThread().isInterrupted()) {
            String line = reader.readLine(); // 블로킹 I/O
            process(line);
        }
    } catch (IOException | InterruptedException e) {
        // 정리 작업
    }
});

// 나중에 취소
vt.interrupt();
vt.join();
```

블로킹 I/O 중에 `interrupt()`하면 `InterruptedException`이 발생합니다. 취소 패턴은 플랫폼 스레드와 완전히 동일합니다.

## 이름 지정과 디버깅

```java
// 카운터 기반 이름 (순차 번호 자동 증가)
Thread.Builder.OfVirtual builder =
    Thread.ofVirtual().name("req-", 1);
for (int i = 0; i < 3; i++) {
    builder.start(() -> handle()); // req-1, req-2, req-3
}
```

JVM 플래그로 Virtual Thread 생성/완료 이벤트를 JFR(Java Flight Recorder)로 수집할 수 있습니다.

```bash
java -XX:+FlightRecorder \
     -Xlog:jvmti+vthread*=info \
     -jar app.jar
```

## 스레드 수 제한 패턴

작업 수가 매우 많고 외부 리소스에 과부하를 주지 않으려면 세마포어로 동시 실행 수를 제한합니다.

```java
Semaphore semaphore = new Semaphore(100); // 최대 100개 동시 DB 연결

try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (String url : millionsOfUrls) {
        executor.submit(() -> {
            semaphore.acquire();
            try {
                return dbQuery(url);
            } finally {
                semaphore.release();
            }
        });
    }
}
```

Virtual Thread 자체는 제한 없이 생성하되, 외부 리소스 접근은 세마포어로 조율하는 패턴입니다. Virtual Thread를 풀링하는 것보다 이 방식이 더 권장됩니다.

## 모니터링

```java
// 현재 스레드가 Virtual Thread인지 확인
boolean isVirtual = Thread.currentThread().isVirtual();

// JConsole/VisualVM: "Threads" 탭에서 VT는 표시되지 않음
// jstack: Virtual Thread 포함 덤프 가능
// Java 21 JFR: VirtualThreadStart, VirtualThreadEnd 이벤트
```

`jstack -l <pid>`에서 Virtual Thread는 별도 섹션에 표시됩니다. 수백만 개가 있을 경우 `jstack` 출력이 매우 커질 수 있으니 주의하세요.

---

**지난 글:** [플랫폼 스레드 vs Virtual Thread 심층 비교](/posts/java-platform-vs-virtual/)

**다음 글:** [Structured Concurrency로 안전한 비동기 구조 만들기](/posts/java-structured-concurrency/)

<br>
읽어주셔서 감사합니다. 😊
