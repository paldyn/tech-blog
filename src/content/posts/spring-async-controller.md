---
title: "Spring MVC 비동기 컨트롤러 완전 정복: Callable·DeferredResult·SseEmitter"
description: "서블릿 3.0 비동기 처리 기반 위에서 Callable, DeferredResult, ResponseBodyEmitter, SseEmitter를 활용한 Spring MVC 비동기 요청 처리 방식과 스레드 모델, WebAsyncTask 타임아웃 처리, 실전 패턴(롱폴링, SSE)을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "비동기컨트롤러", "Callable", "DeferredResult", "SseEmitter", "WebAsyncTask", "StreamingResponseBody", "롱폴링", "비동기처리"]
featured: false
draft: false
---

[지난 글](/posts/spring-cors-config/)에서 Cross-Origin 요청을 허용하는 CORS 설정을 살펴봤습니다. 이번에는 요청을 처리하는 스레드 모델을 바꾸는 Spring MVC 비동기 컨트롤러를 다룹니다. 비동기 처리는 응답 시간이 긴 요청(외부 API 호출, 대용량 파일 생성)이 HTTP 스레드 풀을 점유하지 않도록 해 서버 처리량을 높이는 핵심 기법입니다.

## 왜 비동기 컨트롤러가 필요한가

Tomcat의 기본 HTTP 스레드 풀은 일반적으로 200개입니다. 하나의 요청이 외부 API 결과를 기다리는 데 3초가 걸린다면, 동시에 200개 이상의 요청이 들어오면 모든 스레드가 대기 상태로 묶여 이후 요청은 처리 자체를 시작하지 못합니다.

서블릿 3.0부터 도입된 비동기 처리는 HTTP 스레드가 요청을 받자마자 반환되고, 실제 작업이 완료되면 다른 스레드가 응답을 완성합니다. HTTP 스레드 풀은 다시 새 요청을 받을 수 있게 되어 처리량이 크게 늘어납니다.

## 비동기 설정 활성화

Spring Boot를 사용한다면 기본적으로 비동기 컨트롤러가 활성화되어 있습니다. Spring MVC XML 설정을 사용한다면 `<mvc:annotation-driven>` 또는 `@EnableWebMvc`가 필요합니다.

비동기 작업을 실행할 스레드 풀은 `AsyncTaskExecutor`로 지정합니다.

```java
@Configuration
@EnableWebMvc
public class AsyncConfig implements WebMvcConfigurer {

    @Bean("asyncTaskExecutor")
    public TaskExecutor asyncTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-worker-");
        executor.initialize();
        return executor;
    }

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setTaskExecutor(asyncTaskExecutor());
        configurer.setDefaultTimeout(30_000); // 기본 타임아웃 30초
    }
}
```

## Callable\<T\>

가장 단순한 비동기 방식입니다. 컨트롤러에서 `Callable<T>`를 반환하면 Spring이 설정된 `TaskExecutor`(워커 스레드 풀)에서 람다를 실행합니다.

```java
@GetMapping("/reports/generate")
public Callable<ReportDto> generateReport(
        @RequestParam String type) {
    // HTTP 스레드: 즉시 Callable 반환 (스레드 반환)
    return () -> {
        // 워커 스레드: 실제 작업 수행
        return reportService.generate(type); // 처리 시간이 긴 작업
    };
}
```

![Spring MVC 비동기 요청 처리 모델](/assets/posts/spring-async-controller-flow.svg)

### 타임아웃 설정: WebAsyncTask

`Callable`만으로는 요청별 타임아웃을 지정할 수 없습니다. `WebAsyncTask`로 래핑하면 타임아웃과 타임아웃 핸들러를 지정할 수 있습니다.

```java
@GetMapping("/reports/v2")
public WebAsyncTask<ReportDto> generateWithTimeout(
        @RequestParam String type) {
    Callable<ReportDto> task = () -> reportService.generate(type);

    WebAsyncTask<ReportDto> asyncTask = new WebAsyncTask<>(5_000L, task);

    asyncTask.onTimeout(() -> {
        log.warn("보고서 생성 타임아웃: type={}", type);
        throw new ServiceUnavailableException("보고서 생성 시간 초과");
    });

    asyncTask.onCompletion(() ->
            log.info("보고서 생성 완료: type={}", type));

    return asyncTask;
}
```

타임아웃 발생 시 `onTimeout` 람다가 HTTP 스레드에서 실행됩니다. 예외를 던지거나 대체 응답 객체를 반환할 수 있습니다.

## DeferredResult\<T\>

`Callable`은 Spring이 관리하는 스레드 풀에서 실행됩니다. 반면 `DeferredResult`는 **임의의 스레드**에서 결과를 설정할 수 있어 훨씬 유연합니다. Kafka 소비자 스레드, 이벤트 리스너, 스케줄러 등이 완성된 결과를 `DeferredResult`에 설정(setResult)하면 응답이 클라이언트에 전송됩니다.

![비동기 컨트롤러 구현 패턴](/assets/posts/spring-async-controller-code.svg)

```java
// 롱폴링 패턴: 잡이 완료될 때까지 커넥션 유지
@GetMapping("/jobs/{id}/result")
public DeferredResult<JobResultDto> pollJobResult(
        @PathVariable String id) {

    // 5초 타임아웃, 타임아웃 시 빈 결과 반환
    DeferredResult<JobResultDto> deferred =
            new DeferredResult<>(5_000L, JobResultDto.pending());

    // 잡 완료 이벤트를 기다리도록 등록
    jobRegistry.register(id, deferred);

    // 이미 완료된 잡이면 즉시 설정
    jobRepository.findCompleted(id)
            .ifPresent(deferred::setResult);

    return deferred;
}
```

잡이 완료되면 다른 스레드(예: Kafka 소비자)에서 `deferred.setResult(result)`를 호출합니다.

```java
@KafkaListener(topics = "job-completed")
public void onJobCompleted(JobCompletedEvent event) {
    DeferredResult<JobResultDto> deferred =
            jobRegistry.remove(event.getJobId());
    if (deferred != null) {
        deferred.setResult(JobResultDto.from(event));
    }
}
```

### 에러 처리

```java
deferred.onError(ex -> log.error("작업 실패", ex));
deferred.onCompletion(() -> jobRegistry.remove(id)); // 정리 로직

// 에러 응답 설정
if (somethingWentWrong) {
    deferred.setErrorResult(
            new ResponseEntity<>(ErrorResponse.of(500, "처리 실패"),
                                 HttpStatus.INTERNAL_SERVER_ERROR));
}
```

## ResponseBodyEmitter: 점진적 스트리밍

결과를 여러 조각으로 나눠 클라이언트에 순차적으로 전송합니다. AI 생성 텍스트나 진행 상황 스트리밍에 활용됩니다.

```java
@GetMapping(value = "/stream/data",
            produces = MediaType.APPLICATION_NDJSON_VALUE)
public ResponseBodyEmitter streamData() {
    ResponseBodyEmitter emitter = new ResponseBodyEmitter(60_000L);

    taskExecutor.execute(() -> {
        try {
            List<DataItem> items = dataService.getAllItems();
            for (DataItem item : items) {
                emitter.send(item, MediaType.APPLICATION_JSON);
                // 클라이언트가 처리할 시간을 줌
            }
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    });

    return emitter;
}
```

## SseEmitter: Server-Sent Events

단방향 서버→클라이언트 이벤트 스트림입니다. 알림, 실시간 대시보드 갱신, 진행률 표시 등에 적합합니다.

```java
@GetMapping(value = "/events/notifications",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter subscribeNotifications(
        @RequestParam String userId) {

    SseEmitter emitter = new SseEmitter(Long.MAX_VALUE); // 무제한 유지

    // 연결 끊김, 완료, 타임아웃 시 구독 해제
    emitter.onCompletion(() -> sseService.remove(userId));
    emitter.onTimeout(() -> sseService.remove(userId));
    emitter.onError(ex -> sseService.remove(userId));

    sseService.register(userId, emitter);

    // 연결 직후 초기 이벤트 전송 (503 방지)
    try {
        emitter.send(SseEmitter.event()
                .name("connect")
                .data("connected"));
    } catch (IOException e) {
        emitter.completeWithError(e);
    }

    return emitter;
}
```

다른 곳에서 이벤트를 보낼 때:

```java
@Service
public class NotificationService {

    private final ConcurrentHashMap<String, SseEmitter> emitters =
            new ConcurrentHashMap<>();

    public void send(String userId, NotificationDto notification) {
        SseEmitter emitter = emitters.get(userId);
        if (emitter == null) return;

        try {
            emitter.send(SseEmitter.event()
                    .name("notification")
                    .id(String.valueOf(notification.getId()))
                    .data(notification, MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitters.remove(userId);
            emitter.completeWithError(e);
        }
    }
}
```

## 비동기 처리 방식 비교

| 방식 | 실행 스레드 | 사용 시나리오 |
|---|---|---|
| `Callable<T>` | Spring 관리 워커 스레드 | CPU 집약 작업, 단순 비동기 실행 |
| `WebAsyncTask<T>` | Spring 관리 워커 스레드 + 타임아웃/콜백 | Callable에 타임아웃이 필요한 경우 |
| `DeferredResult<T>` | 임의의 스레드 (Kafka, 이벤트 리스너 등) | 롱폴링, 외부 이벤트 기반 응답 |
| `ResponseBodyEmitter` | 임의의 스레드 | 점진적 데이터 스트리밍 (NDJSON 등) |
| `SseEmitter` | 임의의 스레드 | Server-Sent Events 알림 스트림 |
| `StreamingResponseBody` | 요청 스레드 or 비동기 스레드 | 대용량 파일 스트리밍 |

## 주의사항

**인터셉터**: `AsyncHandlerInterceptor`를 구현해 `afterConcurrentHandlingStarted()`에서 비동기 요청에 대한 처리를 분리합니다. 일반 `HandlerInterceptor`의 `postHandle`은 비동기 요청에서 실행 타이밍이 달라 예상과 다를 수 있습니다.

**ThreadLocal 값**: 비동기 스레드로 전환되면 HTTP 스레드의 `ThreadLocal`(SecurityContext, MDC 등)이 복사되지 않습니다. `DelegatingSecurityContextTaskExecutor`나 MDC의 `put()` 호출로 명시적으로 전달해야 합니다.

**Connection 관리**: `DeferredResult`나 `SseEmitter`는 클라이언트와 커넥션을 유지합니다. 로드 밸런서의 idle connection 타임아웃보다 짧게 설정하거나, 주기적으로 heartbeat를 전송해 커넥션이 끊기지 않도록 합니다.

**@Async와의 차이**: `@Async`는 서비스 레이어에서 메서드를 비동기로 실행하고 `CompletableFuture`를 반환합니다. MVC 비동기 컨트롤러(`Callable`, `DeferredResult`)와 결합하면 HTTP 스레드와 서비스 스레드를 모두 분리할 수 있지만, 복잡도가 올라가므로 필요성을 신중히 판단합니다.

## 정리

- 비동기 컨트롤러는 HTTP 스레드를 빠르게 반환해 서버 처리량을 높인다
- `Callable<T>`는 Spring 관리 스레드 풀에서 단순 비동기 실행, `WebAsyncTask`로 타임아웃을 추가한다
- `DeferredResult<T>`는 Kafka·이벤트 리스너 등 임의의 스레드에서 결과를 설정하는 롱폴링 패턴에 적합하다
- `SseEmitter`는 단방향 서버 푸시 알림·실시간 대시보드에 활용한다
- ThreadLocal 전파와 커넥션 타임아웃은 반드시 확인해야 할 주의사항이다

---

**지난 글:** [Spring CORS 설정 완전 정복: @CrossOrigin부터 Security 연동까지](/posts/spring-cors-config/)

**다음 글:** [Spring JdbcTemplate 완전 정복: SQL 실행부터 결과 매핑까지](/posts/spring-jdbc-template/)

<br>
읽어주셔서 감사합니다. 😊
