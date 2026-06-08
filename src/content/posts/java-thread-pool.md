---
title: "스레드 풀 완전 분석: ThreadPoolExecutor 내부 동작"
description: "ThreadPoolExecutor의 작업 수락 흐름(코어 → 큐 → 최대 스레드 → 거부), 다섯 가지 파라미터 의미, 큐 유형 선택, 스레드 풀 크기 결정 공식(CPU/IO 집약), 모니터링 방법을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "ThreadPoolExecutor", "스레드풀", "동시성", "corePoolSize", "workQueue"]
featured: false
draft: false
---

[지난 글](/posts/java-executor-overview/)에서 Executor 프레임워크의 전체 구조와 인터페이스 계층을 살펴봤습니다. 이번에는 그 중심에 있는 **ThreadPoolExecutor**의 내부 동작을 깊이 파헤칩니다. 이 클래스의 동작 방식을 이해하면 스레드 풀 크기를 어떻게 설정해야 하는지, 왜 큐가 중요한지, 그리고 포화 상태를 어떻게 다뤄야 하는지 명확해집니다.

## 작업 수락 흐름

`ThreadPoolExecutor`에 작업이 제출되면 다음 순서로 처리됩니다.

![ThreadPoolExecutor 내부 동작](/assets/posts/java-thread-pool-internals.svg)

1. **코어 스레드 여유 있음?** → 즉시 코어 스레드에서 실행
2. **큐 여유 있음?** → 작업을 큐에 넣고 대기
3. **최대 스레드 수 미만?** → 임시 스레드 생성 후 실행
4. **모두 꽉 참** → Reject Policy 적용

이 순서가 직관에 반하는 부분이 있습니다. "큐가 가득 찬 후에 새 스레드를 만든다"는 점입니다. `LinkedBlockingQueue`(무제한)를 사용하면 큐가 절대 꽉 차지 않으므로 `maximumPoolSize`는 사실상 의미가 없어집니다. `Executors.newFixedThreadPool()`이 내부적으로 무제한 큐를 사용하므로 이 함정에 빠지기 쉽습니다.

## 다섯 가지 핵심 파라미터

```java
new ThreadPoolExecutor(
    int corePoolSize,          // 항상 유지할 스레드 수
    int maximumPoolSize,       // 최대 허용 스레드 수
    long keepAliveTime,        // 유휴 임시 스레드 수명
    TimeUnit unit,             // keepAliveTime 단위
    BlockingQueue<Runnable> workQueue  // 대기 큐
);
```

### corePoolSize vs maximumPoolSize

- **corePoolSize**: 풀이 초기화된 후 항상 유지되는 스레드 수. 유휴 상태여도 제거되지 않음(기본값)
- **maximumPoolSize**: 큐가 가득 찼을 때 추가로 생성 가능한 최대 스레드 수
- `allowCoreThreadTimeOut(true)` 설정 시 코어 스레드도 `keepAliveTime` 후 제거 가능

```java
// 코어 스레드도 타임아웃 적용 (유휴 기간이 길어질 때 리소스 절약)
executor.allowCoreThreadTimeOut(true);
```

### workQueue 종류 선택

| 큐 유형 | 동작 | 용도 |
|---------|------|------|
| `LinkedBlockingQueue()` | 무제한 대기 | 부하 변동이 크고 처리량이 중요할 때 |
| `LinkedBlockingQueue(N)` | 최대 N개 대기 | 백프레셔 필요 시 |
| `SynchronousQueue` | 큐 없음, 바로 스레드 필요 | newCachedThreadPool |
| `ArrayBlockingQueue(N)` | 고정 크기 | 명시적 상한 설정 |
| `PriorityBlockingQueue` | 우선순위 순 | 우선순위 기반 처리 |

`SynchronousQueue`는 큐 용량이 0이므로 작업을 받는 즉시 스레드가 없으면 새 스레드를 생성합니다. `newCachedThreadPool()`이 이 방식을 사용합니다.

## 스레드 풀 크기 결정

![스레드 풀 크기 결정 공식](/assets/posts/java-thread-pool-sizing.svg)

### CPU 집약 작업

계산, 암호화, 이미지 처리처럼 CPU를 많이 사용하는 작업에는 코어 수 + 1이 경험칙입니다.

```java
int cpus = Runtime.getRuntime().availableProcessors();
int poolSize = cpus + 1; // 4코어 시스템 → 5
```

+1은 페이지 폴트나 OS 컨텍스트 스위칭으로 한 스레드가 잠깐 멈출 때 즉시 대체할 스레드를 준비하기 위함입니다. 코어 수보다 훨씬 많은 스레드를 두면 컨텍스트 스위칭 오버헤드가 성능을 떨어뜨립니다.

### I/O 집약 작업

DB 쿼리, HTTP 요청, 파일 읽기처럼 I/O 대기가 많은 작업에는 스레드를 더 많이 둘 수 있습니다.

```
poolSize = N × (1 + W/C)
N: CPU 코어 수
W: 평균 I/O 대기 시간
C: 평균 CPU 처리 시간
```

W/C = 10이면(예: DB 응답 100ms, CPU 처리 10ms), `4 × (1 + 10) = 44`가 됩니다. 단, 이 공식은 이론적 상한이며 실제로는 부하 테스트를 통해 조정해야 합니다.

## 포화 정책(RejectedExecutionHandler)

```java
// AbortPolicy (기본): 예외 throw
executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());

// CallerRunsPolicy: 제출자 스레드가 직접 실행 (백프레셔 효과)
executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());

// DiscardPolicy: 조용히 버림 (데이터 손실 위험)
executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardPolicy());

// 커스텀: 메트릭 기록 + 대기 후 재시도
executor.setRejectedExecutionHandler((task, pool) -> {
    metrics.increment("task.rejected");
    if (!pool.isShutdown()) {
        try {
            pool.getQueue().put(task); // 큐 공간이 생길 때까지 블로킹
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
});
```

`CallerRunsPolicy`는 제출하는 스레드가 직접 작업을 실행하므로 자연스럽게 속도를 조절하는 백프레셔 효과가 있습니다. 단, 제출자가 HTTP 요청 핸들러라면 해당 요청이 지연되는 단점이 있습니다.

## 스레드 팩토리: 이름과 데몬 설정

```java
import java.util.concurrent.atomic.AtomicInteger;

ThreadFactory namedFactory = new ThreadFactory() {
    private final AtomicInteger count = new AtomicInteger(0);

    @Override
    public Thread newThread(Runnable r) {
        Thread t = new Thread(r);
        t.setName("order-processor-" + count.getAndIncrement());
        t.setDaemon(false); // 데몬이 아니면 JVM 종료 시 대기
        t.setUncaughtExceptionHandler((thread, ex) -> {
            log.error("Uncaught exception in {}", thread.getName(), ex);
        });
        return t;
    }
};
```

스레드 이름을 설정하면 `jstack`, 프로파일러, 로그에서 어떤 풀의 스레드인지 즉시 식별할 수 있습니다. 실운영 코드에서는 필수입니다.

## 모니터링

```java
ThreadPoolExecutor executor = (ThreadPoolExecutor) Executors.newFixedThreadPool(4);

// 주요 메트릭
executor.getPoolSize();          // 현재 스레드 수
executor.getActiveCount();       // 작업 중인 스레드 수
executor.getCompletedTaskCount(); // 완료된 작업 수
executor.getTaskCount();         // 제출된 전체 작업 수
executor.getQueue().size();      // 대기 중인 작업 수
executor.getQueue().remainingCapacity(); // 큐 여유 공간

// 로그 예시
log.info("Pool: {}/{}, Queue: {}, Completed: {}",
    executor.getActiveCount(),
    executor.getPoolSize(),
    executor.getQueue().size(),
    executor.getCompletedTaskCount());
```

`getQueue().size()`가 지속적으로 증가한다면 소비자(스레드 수)가 생산자(작업 제출)를 따라가지 못하는 신호입니다. 스레드 수를 늘리거나 작업 처리를 최적화해야 합니다.

## 실운영 권장 설정

```java
// 실운영에서는 Executors 팩토리보다 직접 설정 권장
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    Runtime.getRuntime().availableProcessors(),
    Runtime.getRuntime().availableProcessors() * 2,
    30L, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(1000),  // 유계 큐로 메모리 보호
    new NamedThreadFactory("api-worker"),
    new ThreadPoolExecutor.CallerRunsPolicy() // 포화 시 백프레셔
);
executor.allowCoreThreadTimeOut(true); // 유휴 시 코어 스레드도 회수
```

무제한 큐(`new LinkedBlockingQueue()`)는 OOM 위험이 있으므로 유계 큐를 사용하고, 포화 정책을 명시적으로 설정하는 것이 좋습니다.

---

**지난 글:** [ExecutorService와 Executor 프레임워크 개요](/posts/java-executor-overview/)

**다음 글:** [Executors 팩토리 메서드 완전 정리](/posts/java-executors-factory/)

<br>
읽어주셔서 감사합니다. 😊
