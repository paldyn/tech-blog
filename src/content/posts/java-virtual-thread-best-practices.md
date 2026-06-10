---
title: "Virtual Thread 운영 모범 사례"
description: "Java Virtual Thread를 프로덕션 환경에서 안전하게 활용하기 위한 DO/DON'T 패턴, 기존 코드 마이그레이션 전략, Spring Boot·Tomcat 등 프레임워크 통합 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "Virtual Threads", "Best Practices", "Spring Boot", "마이그레이션", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-virtual-thread-pinning/)에서 Virtual Thread의 Pinning 문제와 탐지·해결 방법을 살펴봤습니다. 이제 Virtual Thread를 실제 프로젝트에 적용할 때 어떤 패턴을 따르고 어떤 안티패턴을 피해야 하는지, 마이그레이션 절차와 주요 프레임워크 통합 방법을 정리합니다.

## Virtual Thread가 효과적인 상황

Virtual Thread는 만능 해결책이 아닙니다. **I/O-bound** 워크로드에서 극적인 효과를 발휘하고, **CPU-bound** 워크로드에서는 이점이 없습니다.

| 워크로드 | Virtual Thread | Platform Thread Pool |
|---|---|---|
| HTTP 요청 처리 | ✅ 수백만 동시 처리 | ❌ 스레드 수 제한 |
| DB 쿼리 | ✅ 블로킹 중 carrier 해방 | ❌ 스레드 점유 |
| 파일 I/O | ✅ NIO 연동 | - |
| 이미지/동영상 처리 | ❌ CPU 포화 | ✅ ForkJoinPool 적합 |
| 암호화/해시 | ❌ CPU-bound | ✅ 병렬 스트림 적합 |

## 권장 패턴 (DO)

![Virtual Thread 운영 모범 사례](/assets/posts/java-virtual-thread-best-practices-dos.svg)

### 1. Thread-per-request 패턴

요청마다 새로운 Virtual Thread를 생성하는 방식이 가장 자연스럽고 효율적입니다.

```java
ExecutorService executor =
    Executors.newVirtualThreadPerTaskExecutor();

try (executor) {
    for (Request req : requests) {
        executor.submit(() -> process(req));
    }
}
```

`newVirtualThreadPerTaskExecutor()`는 태스크마다 새 Virtual Thread를 생성합니다. Platform Thread Pool과 달리 스레드를 재사용하지 않으며, 생성 비용이 매우 낮으므로 이 방식이 오히려 더 효율적입니다.

### 2. Blocking I/O를 그대로 사용

기존 동기(blocking) I/O 코드를 수정 없이 그대로 사용합니다. Virtual Thread 위에서 실행되면 블로킹 시 자동으로 unmount되어 Carrier Thread가 해방됩니다.

```java
Thread.ofVirtual().start(() -> {
    // 아래 모두 Virtual Thread에서 blocking 그대로 사용
    String body = new String(
        url.openStream().readAllBytes()
    );
    try (var conn = dataSource.getConnection();
         var stmt = conn.prepareStatement(SQL)) {
        stmt.setString(1, body);
        stmt.executeUpdate();
    }
});
```

### 3. Semaphore로 동시 요청 수 제한

Virtual Thread는 손쉽게 수백만 개를 생성할 수 있지만, 백엔드 DB 연결 풀이나 외부 API는 한계가 있습니다. `Semaphore`로 동시 접속 수를 제한하면 됩니다.

```java
Semaphore dbGate = new Semaphore(100); // DB 풀 크기

void queryWithLimit(String sql) throws Exception {
    dbGate.acquire(); // 허용 수 초과 시 Virtual Thread PARK
    try {
        executeQuery(sql);
    } finally {
        dbGate.release();
    }
}
```

`Semaphore.acquire()`는 내부적으로 `LockSupport.park()`를 사용하므로 Virtual Thread가 정상적으로 unmount됩니다.

### 4. ScopedValue로 컨텍스트 전달

요청 컨텍스트(사용자 ID, 트레이스 ID 등)를 전달할 때 `ThreadLocal` 대신 `ScopedValue`를 사용합니다.

```java
static final ScopedValue<RequestContext> CONTEXT =
    ScopedValue.newInstance();

void handleRequest(Request req) {
    var ctx = new RequestContext(req.userId(), req.traceId());

    ScopedValue.where(CONTEXT, ctx).run(() -> {
        // 이 범위 내 어디서든 CONTEXT.get()으로 접근
        processRequest();
        logAudit();
    });
    // 범위 벗어나면 자동 해제
}
```

`ThreadLocal`은 Virtual Thread 수만큼 복사본이 생겨 메모리가 폭발할 수 있습니다. `ScopedValue`는 불변이고 범위 한정으로 동작해 훨씬 안전합니다.

## 안티패턴 (DON'T)

### 1. Virtual Thread Pool 생성 금지

```java
// ❌ Virtual Thread를 Pool에 가두는 것은 안티패턴
ExecutorService vtPool = Executors.newFixedThreadPool(
    200,
    Thread.ofVirtual().factory() // VT factory 사용
);

// ✅ 올바른 방식
ExecutorService vtPool =
    Executors.newVirtualThreadPerTaskExecutor();
```

Virtual Thread는 생성 비용이 매우 낮으므로 Pool을 만들어 재사용할 필요가 없습니다. 고정 크기 Pool은 오히려 처리량을 제한합니다.

### 2. CPU-bound 작업에 Virtual Thread 사용 금지

```java
// ❌ CPU-bound 작업 — VT 이점 없음
Thread.ofVirtual().start(() -> {
    encryptLargeFile(data); // CPU 100% 사용, unmount 불가
});

// ✅ CPU-bound는 ForkJoinPool 사용
ForkJoinPool.commonPool().submit(() ->
    encryptLargeFile(data)
);
```

CPU를 계속 사용하는 작업은 blocking이 없어 unmount가 발생하지 않으므로 Virtual Thread의 이점을 전혀 얻지 못합니다.

### 3. ThreadLocal 과도 사용 주의

```java
// ⚠️ 주의 — 수백만 VT에서 각각 ThreadLocal 복사본 생성
static ThreadLocal<LargeObject> local =
    new ThreadLocal<>();

// ✅ 대안 1: ScopedValue
// ✅ 대안 2: 메서드 파라미터로 직접 전달
// ✅ 대안 3: 꼭 필요하면 ThreadLocal 유지하되 초기화 즉시 제거
//   => local.remove() 반드시 호출
```

## 기존 코드 마이그레이션

![기존 코드 Virtual Thread 마이그레이션](/assets/posts/java-virtual-thread-best-practices-migration.svg)

마이그레이션은 세 단계로 진행합니다.

**① ExecutorService 교체**

기존 고정 크기 스레드 풀을 `newVirtualThreadPerTaskExecutor()`로 교체합니다. 대부분의 코드는 이 변경만으로도 동작합니다.

**② Pinning 탐지**

`-Djdk.tracePinnedThreads=full` 플래그를 켠 후 부하 테스트를 수행합니다. Pinning이 발생하는 코드 경로를 찾아냅니다.

**③ synchronized 교체 또는 Java 23+ 업그레이드**

탐지된 Pinning 지점의 `synchronized`를 `ReentrantLock`으로 교체하거나, Java 23+로 업그레이드합니다.

## 프레임워크 통합

**Spring Boot 3.2+**

```properties
# application.properties
spring.threads.virtual.enabled=true
```

이 설정 하나로 Tomcat, `@Async`, `@Scheduled` 등이 모두 Virtual Thread로 전환됩니다.

**수동 설정 (Spring Boot)**

```java
@Bean
public TomcatProtocolHandlerCustomizer<?> tomcatVirtualThreads() {
    return handler ->
        handler.setExecutor(
            Executors.newVirtualThreadPerTaskExecutor()
        );
}
```

**Tomcat 10.1+ 독립 설정**

```java
connector.getProtocolHandler()
         .setExecutor(
             Executors.newVirtualThreadPerTaskExecutor()
         );
```

## 성능 측정 포인트

Virtual Thread 도입 후 다음 지표를 모니터링합니다.

- **처리량(TPS)**: 동일 하드웨어에서 증가 여부
- **p99 응답 시간**: 극단값이 줄어드는지 확인
- **Carrier Thread Pinning 횟수**: JFR `jdk.VirtualThreadPinned` 이벤트 수
- **OS 스레드 수**: Platform Thread 수가 줄었는지 (`jcmd <pid> Thread.print` 활용)
- **힙 메모리**: `ThreadLocal` 남용 시 메모리 증가 여부

Virtual Thread는 이미 Spring Boot, Quarkus, Micronaut 등 주요 프레임워크에서 지원하며, Java 21+ LTS 환경에서 즉시 적용 가능합니다. 점진적으로 적용하면서 위 지표를 모니터링하는 것이 안전한 도입 전략입니다.

---

**지난 글:** [Virtual Thread Pinning 심화 분석과 해결 전략](/posts/java-virtual-thread-pinning/)

**다음 글:** [Java 8 핵심 기능 총정리](/posts/java-8-features-recap/)

<br>
읽어주셔서 감사합니다. 😊
