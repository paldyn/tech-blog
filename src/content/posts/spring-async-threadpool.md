---
title: "Spring 비동기 스레드풀 — @Async와 ThreadPoolTaskExecutor 완전 정복"
description: "@Async 동작 원리, ThreadPoolTaskExecutor 설정 튜닝, CompletableFuture 반환, SecurityContext 전파, self-invocation 함정까지 Spring 비동기 처리의 모든 것을 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "@Async", "ThreadPoolTaskExecutor", "CompletableFuture", "비동기", "스레드풀"]
featured: false
draft: false
---

[지난 글](/posts/spring-http-cache-headers/)에서는 HTTP 계층의 캐시 헤더를 다뤘다. 이번 글에서는 서버 내부의 비동기 처리 메커니즘인 **`@Async`와 스레드풀**을 집중적으로 살펴본다.

## 왜 비동기 처리가 필요한가

Spring MVC는 기본적으로 요청당 스레드 하나를 할당하는 동기 처리 모델이다. 이메일 전송, 이미지 리사이징, 외부 API 호출처럼 시간이 오래 걸리는 작업을 요청 스레드에서 직접 수행하면 그 스레드가 블로킹되어 동시 처리 능력이 떨어진다. `@Async`를 사용하면 이런 작업을 별도의 스레드풀에서 비동기로 실행해 요청 스레드를 빠르게 해방할 수 있다.

![Spring @Async 비동기 실행 흐름](/assets/posts/spring-async-threadpool-flow.svg)

## @Async 기본 설정

`@EnableAsync`를 설정 클래스에 추가하면 `@Async` 어노테이션이 활성화된다.

```java
@Configuration
@EnableAsync
public class AppConfig {
}
```

이후 비동기로 실행할 메서드에 `@Async`를 붙인다.

```java
@Service
public class NotificationService {

    @Async
    public void sendPushNotification(Long userId, String message) {
        // 오래 걸리는 외부 API 호출
        pushApiClient.send(userId, message);
    }
}
```

호출자는 `sendPushNotification()`을 호출하면 즉시 반환된다. 실제 실행은 Spring이 관리하는 스레드풀의 워커 스레드에서 이루어진다.

## 기본 스레드풀의 문제

`@EnableAsync`만 선언하면 Spring은 `SimpleAsyncTaskExecutor`를 기본으로 사용한다. 이 실행기는 **요청마다 새 스레드를 생성**해 스레드를 재사용하지 않는다. 트래픽이 높을 때 스레드가 무한히 생성되어 OOM이 발생할 수 있다. 반드시 `ThreadPoolTaskExecutor`를 명시적으로 설정해야 한다.

## ThreadPoolTaskExecutor 설정

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);       // 항상 유지하는 최소 스레드 수
        executor.setMaxPoolSize(50);        // 최대 스레드 수
        executor.setQueueCapacity(100);     // 대기 큐 용량
        executor.setKeepAliveSeconds(60);   // 유휴 스레드 유지 시간
        executor.setThreadNamePrefix("async-task-");
        executor.setRejectedExecutionHandler(
            new ThreadPoolExecutor.CallerRunsPolicy()); // 큐 초과 시 정책
        executor.initialize();
        return executor;
    }
}
```

![ThreadPoolTaskExecutor 설정 코드](/assets/posts/spring-async-threadpool-config.svg)

### 스레드풀 동작 순서

1. 코어 스레드(`corePoolSize`)가 모두 사용 중 → 작업을 큐에 적재
2. 큐가 가득 참(`queueCapacity` 초과) → 최대 스레드(`maxPoolSize`)까지 스레드 추가 생성
3. 최대 스레드도 가득 참 → `RejectedExecutionHandler` 정책 실행

### 거부 정책 선택

| 정책 | 동작 |
|---|---|
| `AbortPolicy` (기본) | `RejectedExecutionException` 발생 |
| `CallerRunsPolicy` | 호출자 스레드가 직접 실행 (자연스러운 배압) |
| `DiscardPolicy` | 조용히 작업 버림 |
| `DiscardOldestPolicy` | 큐 가장 오래된 작업 버리고 새 작업 삽입 |

일반적으로 배압이 필요한 서비스에는 `CallerRunsPolicy`가 실용적이다. 호출자 스레드가 직접 작업을 처리하므로 자연스럽게 요청 속도를 늦춘다.

## 스레드풀 크기 산정

### CPU 바운드 작업

```
적정 스레드 수 = CPU 코어 수 + 1
```

CPU 계산이 주인 작업은 코어 수 이상의 스레드를 만들어도 컨텍스트 전환 비용만 증가한다.

### I/O 바운드 작업

```
적정 스레드 수 = CPU 코어 수 × (1 + I/O 대기시간 / CPU 연산시간)
```

외부 API 호출, DB 쿼리처럼 I/O 대기가 긴 작업은 스레드가 대기하는 동안 다른 스레드가 CPU를 사용할 수 있으므로 더 많은 스레드를 둔다. 경험적으로 I/O 비율이 90% 이상이면 코어 수의 10배 정도를 시작점으로 삼는다.

## CompletableFuture로 결과 반환

작업 완료 후 결과가 필요하면 반환 타입을 `CompletableFuture<T>`로 선언한다.

```java
@Async
public CompletableFuture<SalesReport> generateReport(
        Long storeId, LocalDate from, LocalDate to) {
    SalesReport report = analyticsService.compute(storeId, from, to);
    return CompletableFuture.completedFuture(report);
}
```

호출자에서 비동기 결과를 합성할 수 있다.

```java
CompletableFuture<SalesReport> salesFuture  = reportService.generateReport(1L, ...);
CompletableFuture<TrafficData>  trafficFuture = analyticsService.getTraffic(1L, ...);

// 두 비동기 작업이 모두 완료되길 기다렸다가 합침
CompletableFuture.allOf(salesFuture, trafficFuture).join();

SalesReport  sales   = salesFuture.get();
TrafficData  traffic = trafficFuture.get();
```

## 여러 Executor 선택적 사용

작업 종류에 따라 다른 스레드풀을 사용하려면 `@Async("빈이름")`으로 지정한다.

```java
@Async("mailExecutor")
public void sendMail(String address) { ... }

@Async("reportExecutor")
public CompletableFuture<Report> buildReport(Long id) { ... }
```

```java
@Bean("mailExecutor")
public Executor mailExecutor() {
    ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(5);
    ex.setMaxPoolSize(20);
    ex.setQueueCapacity(50);
    ex.setThreadNamePrefix("mail-");
    ex.initialize();
    return ex;
}

@Bean("reportExecutor")
public Executor reportExecutor() {
    ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(2);
    ex.setMaxPoolSize(5);
    ex.setQueueCapacity(10);
    ex.setThreadNamePrefix("report-");
    ex.initialize();
    return ex;
}
```

## SecurityContext 전파

`@Async` 메서드는 새 스레드에서 실행되므로 기본적으로 `SecurityContextHolder`의 컨텍스트가 전파되지 않는다. Spring Security가 필요한 비동기 메서드에는 `DelegatingSecurityContextAsyncTaskExecutor`로 감싸야 한다.

```java
@Bean
public Executor taskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(10);
    executor.setMaxPoolSize(50);
    executor.setQueueCapacity(100);
    executor.initialize();

    // SecurityContext를 비동기 스레드로 전파
    return new DelegatingSecurityContextAsyncTaskExecutor(executor);
}
```

## Self-Invocation 함정

가장 많이 겪는 실수는 **같은 빈의 메서드에서 `@Async` 메서드를 직접 호출**하는 것이다. Spring `@Async`는 AOP 프록시 기반이므로 프록시를 거치지 않는 내부 호출에서는 비동기가 동작하지 않는다.

```java
@Service
public class ReportService {

    public void process(Long id) {
        generateReport(id);  // ❌ self-invocation: @Async 무시됨
    }

    @Async
    public CompletableFuture<Report> generateReport(Long id) { ... }
}
```

해결 방법은 두 가지다.

```java
// 방법 1: 다른 빈에서 호출
@Service
public class ProcessService {
    @Autowired
    private ReportService reportService;

    public void process(Long id) {
        reportService.generateReport(id);  // ✅ 프록시 경유
    }
}

// 방법 2: ApplicationContext로 self-proxy 참조
@Service
public class ReportService implements ApplicationContextAware {
    private ApplicationContext context;

    public void process(Long id) {
        context.getBean(ReportService.class).generateReport(id);  // ✅
    }

    @Async
    public CompletableFuture<Report> generateReport(Long id) { ... }
}
```

## 예외 처리

`void` 반환 타입의 `@Async` 메서드에서 발생한 예외는 호출자에게 전파되지 않는다. `AsyncUncaughtExceptionHandler`를 등록해 예외를 처리해야 한다.

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public AsyncUncaughtExceptionHandler
            getAsyncUncaughtExceptionHandler() {
        return (throwable, method, params) -> {
            log.error("Async error in {}: {}",
                      method.getName(), throwable.getMessage(), throwable);
        };
    }
}
```

`CompletableFuture` 반환 타입이면 `future.exceptionally()` 또는 `future.handle()`로 예외를 처리한다.

## 정리

`@Async`의 핵심은 **프록시 기반 AOP**라는 사실이다. 이 하나를 기억하면 self-invocation 함정, SecurityContext 미전파 문제, `@Transactional`과의 상호작용까지 모두 논리적으로 이해할 수 있다. 스레드풀은 반드시 `ThreadPoolTaskExecutor`를 명시적으로 설정하고, 작업 성격(CPU/I/O 바운드)에 맞게 크기를 조정해야 한다.

---

**지난 글:** [Spring HTTP 캐시 헤더 — Cache-Control과 ETag 완전 정복](/posts/spring-http-cache-headers/)

**다음 글:** [Spring 스케줄링 — @Scheduled와 Cron 표현식 완전 정복](/posts/spring-scheduled-cron/)

<br>
읽어주셔서 감사합니다. 😊
