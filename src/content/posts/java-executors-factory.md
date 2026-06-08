---
title: "Executors 팩토리 메서드 완전 정리"
description: "Executors 클래스의 팩토리 메서드 5종(Fixed/Cached/Single/Scheduled/VirtualThread)의 내부 구현, 장단점, 실운영 함정을 비교하고 각 메서드 선택 기준을 명확히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Executors", "스레드풀", "동시성", "가상스레드", "ThreadPoolExecutor"]
featured: false
draft: false
---

[지난 글](/posts/java-thread-pool/)에서 `ThreadPoolExecutor`의 작업 수락 흐름과 파라미터를 자세히 살펴봤습니다. 이번에는 `ThreadPoolExecutor`를 편리하게 생성하는 **Executors 팩토리 메서드**를 하나씩 분석합니다. 편리하지만 잘못 선택하면 OOM이나 성능 저하로 이어지므로, 각 메서드의 내부 구현과 함정을 명확히 이해해야 합니다.

## 팩토리 메서드 한눈에 보기

![Executors 팩토리 메서드 비교](/assets/posts/java-executors-factory-types.svg)

## newFixedThreadPool(int nThreads)

```java
public static ExecutorService newFixedThreadPool(int nThreads) {
    return new ThreadPoolExecutor(
        nThreads, nThreads,          // core = max = n
        0L, TimeUnit.MILLISECONDS,   // keepAlive 없음
        new LinkedBlockingQueue<>()  // 무제한 큐!
    );
}
```

**용도**: 동시에 실행되는 작업 수를 제한해야 할 때.  
**함정**: 내부적으로 `new LinkedBlockingQueue<>()`(용량 제한 없음)를 사용합니다. 처리 속도보다 제출 속도가 빠르면 큐가 무한히 커져 OOM이 발생할 수 있습니다.

```java
// 안전한 대안: 유계 큐 + 거부 정책
int n = Runtime.getRuntime().availableProcessors();
ExecutorService safe = new ThreadPoolExecutor(
    n, n,
    0L, TimeUnit.MILLISECONDS,
    new LinkedBlockingQueue<>(1000),   // 상한 지정
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

## newCachedThreadPool()

```java
public static ExecutorService newCachedThreadPool() {
    return new ThreadPoolExecutor(
        0, Integer.MAX_VALUE,         // core=0, max=무제한!
        60L, TimeUnit.SECONDS,
        new SynchronousQueue<>()
    );
}
```

`SynchronousQueue`는 버퍼가 없어서 작업이 들어오면 즉시 스레드가 필요합니다. 사용 가능한 스레드가 없으면 새 스레드를 생성하고, 60초 유휴 상태면 제거합니다.

**용도**: 수명이 짧고 수가 많은 비동기 작업, 적당한 부하의 서버.  
**함정**: 부하 급증 시 스레드가 무제한 생성됩니다. 스레드 생성 속도가 처리 속도보다 빠르면 시스템이 스레드로 가득 찹니다.

```java
// newCachedThreadPool이 맞는 상황
// - 요청당 처리 시간이 10ms 미만
// - 요청 수가 예측 가능하고 폭발적이지 않음

// 피해야 하는 상황
// - DB 쿼리처럼 응답 시간이 수백ms인 작업
// - 갑작스러운 트래픽 폭증 가능성이 있는 환경
```

## newSingleThreadExecutor()

```java
public static ExecutorService newSingleThreadExecutor() {
    return new FinalizableDelegatedExecutorService(
        new ThreadPoolExecutor(
            1, 1,
            0L, TimeUnit.MILLISECONDS,
            new LinkedBlockingQueue<>()  // 무제한 큐
        )
    );
}
```

**용도**: 작업 순서가 중요하거나 직렬화가 필요할 때.  
**특이점**: `FinalizableDelegatedExecutorService`로 래핑되어 있어서 반환된 `ExecutorService`를 `ThreadPoolExecutor`로 캐스팅할 수 없습니다. 이는 외부에서 풀 크기를 변경하지 못하도록 의도적으로 막은 것입니다. 또한 스레드가 비정상 종료되면 새 스레드를 자동으로 생성해 순서를 유지합니다.

```java
ExecutorService single = Executors.newSingleThreadExecutor();

// 이 작업들은 반드시 제출 순서대로 실행됨
single.submit(() -> step1());
single.submit(() -> step2()); // step1 완료 후 실행
single.submit(() -> step3()); // step2 완료 후 실행
```

## newScheduledThreadPool(int corePoolSize)

```java
public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize) {
    return new ScheduledThreadPoolExecutor(corePoolSize);
}
```

**용도**: 지연 실행, 주기 실행.

```java
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

// 한 번만 지연 실행
scheduler.schedule(() -> sendReminder(), 1, TimeUnit.HOURS);

// 주기 실행 (이전 시작 기준)
ScheduledFuture<?> periodicTask = scheduler.scheduleAtFixedRate(
    () -> syncData(),
    0,    // 초기 지연
    10,   // 주기
    TimeUnit.SECONDS
);

// 주기 실행 (이전 완료 기준)
scheduler.scheduleWithFixedDelay(
    () -> cleanup(),
    5,   // 초기 지연
    30,  // 완료 후 다음 실행까지 지연
    TimeUnit.SECONDS
);
```

**중요**: `scheduleAtFixedRate()`와 `scheduleWithFixedDelay()` 모두 **작업이 예외를 던지면 이후 실행이 조용히 중단됩니다.** 반드시 예외를 처리해야 합니다.

```java
// 안전한 주기 작업 패턴
scheduler.scheduleAtFixedRate(() -> {
    try {
        doWork();
    } catch (Exception e) {
        log.error("Scheduled task failed", e);
        // 예외를 삼켜서 이후 실행이 계속되도록 함
    }
}, 0, 10, TimeUnit.SECONDS);
```

## newVirtualThreadPerTaskExecutor() (Java 21+)

```java
public static ExecutorService newVirtualThreadPerTaskExecutor() {
    // 작업마다 새 가상 스레드를 생성
    return ThreadPerTaskExecutor.create(
        Thread.ofVirtual().factory()
    );
}
```

![플랫폼 스레드 풀 vs 가상 스레드](/assets/posts/java-executors-factory-virtual.svg)

**용도**: I/O 집약 작업에서 최대 처리량.  
**동작**: 작업마다 가상 스레드 하나를 생성합니다. 가상 스레드는 경량(초기 수 KB)이므로 수백만 개를 생성해도 부담이 없습니다. I/O 대기 시 캐리어(플랫폼) 스레드를 반납하므로 적은 수의 OS 스레드로 높은 동시성을 달성합니다.

```java
// Java 21+ 권장 패턴: try-with-resources
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i ->
        executor.submit(() -> {
            fetchFromDatabase(i); // I/O 집약
        })
    );
} // 모든 가상 스레드 완료 후 자동 종료
```

**주의**: CPU 집약 작업(암호화, 이미지 처리 등)에는 오히려 성능이 나빠질 수 있습니다. 가상 스레드는 `synchronized` 블록이나 native 메서드에서 캐리어 스레드에 "고정(pin)"되어 효율이 떨어집니다.

## 팩토리 메서드 선택 가이드

```java
// Q1: 가상 스레드를 사용할 수 있나? (Java 21+)
// + I/O 집약 작업인가?
if (java21 && ioIntensive) {
    return Executors.newVirtualThreadPerTaskExecutor();
}

// Q2: 작업 순서 보장이 필요한가?
if (needOrdering) {
    return Executors.newSingleThreadExecutor();
}

// Q3: 지연/주기 실행이 필요한가?
if (scheduling) {
    return Executors.newScheduledThreadPool(n);
}

// Q4: 수명이 매우 짧은 작업인가?
if (veryShortTasks && predictableLoad) {
    return Executors.newCachedThreadPool();
}

// Q5: 기본 선택
return new ThreadPoolExecutor(coreN, maxN, keepAlive, unit,
    new LinkedBlockingQueue<>(bound), factory, handler);
```

실운영에서는 팩토리 메서드보다 `ThreadPoolExecutor` 직접 생성이 더 안전합니다. 팩토리 메서드는 무제한 큐나 무제한 스레드를 숨기고 있어서 예측 불가능한 문제가 생길 수 있습니다. 팩토리 메서드는 프로토타이핑이나 테스트 코드에서 사용하고, 프로덕션 코드에는 파라미터를 명시적으로 설정하는 것을 권장합니다.

---

**지난 글:** [스레드 풀 완전 분석: ThreadPoolExecutor 내부 동작](/posts/java-thread-pool/)

**다음 글:** [Future와 FutureTask: 비동기 결과 추적](/posts/java-future/)

<br>
읽어주셔서 감사합니다. 😊
