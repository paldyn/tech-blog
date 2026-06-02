---
title: "Spring Cloud Resilience4j: 장애 격리와 Circuit Breaker"
description: "분산 시스템의 연쇄 장애를 막는 Resilience4j의 Circuit Breaker·Retry·TimeLimiter·RateLimiter·Bulkhead를 Spring Boot에서 실전으로 구현합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring Cloud", "Resilience4j", "Circuit Breaker", "Retry", "장애 격리", "MSA", "Bulkhead"]
featured: false
draft: false
---

[지난 글](/posts/spring-cloud-config-server/)에서 Spring Cloud Config Server로 설정을 중앙 관리하는 방법을 다뤘다. 이번 글에서는 MSA에서 가장 자주 발생하는 문제 중 하나인 **연쇄 장애(Cascade Failure)**를 방지하는 Resilience4j를 다룬다.

## 연쇄 장애: MSA의 숨겨진 위협

모놀리스에서는 메서드 호출이 실패하면 그 즉시 예외가 발생하고 처리된다. MSA에서는 다르다. A 서비스가 B 서비스를 HTTP로 호출하는데 B가 느려지면, A의 스레드가 응답을 기다리며 블록된다. 더 많은 요청이 오면 더 많은 스레드가 블록되고, 결국 A의 스레드 풀이 고갈되어 A도 다운된다. B 하나가 느려진 것이 A, C, D 서비스까지 연쇄적으로 다운시킨다.

Netflix가 개발하고 오픈소스로 공개한 **Hystrix**가 이 문제의 첫 해법이었다. 그러나 Hystrix는 2018년 유지 관리가 중단되었고, 현재 Spring Cloud의 권장 대안은 **Resilience4j**다.

## Resilience4j 구성 요소

Resilience4j는 다음 5가지 주요 모듈로 구성된다.

| 모듈 | 역할 |
|---|---|
| CircuitBreaker | 실패율이 임계치를 넘으면 호출 차단, 폴백 반환 |
| Retry | 일시적 실패 시 자동 재시도 |
| TimeLimiter | 응답 시간 초과 시 즉시 중단 |
| RateLimiter | 초당 허용 요청 수 제한 |
| Bulkhead | 동시 호출 수 제한으로 스레드 풀 고갈 방지 |

각 모듈은 독립적으로 사용할 수 있고, 조합해서 사용할 수도 있다.

## 의존성 설정

```xml
<!-- Spring Boot 3.x + Spring Cloud 2023.x -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-resilience4j</artifactId>
</dependency>

<!-- Actuator와 연동하여 메트릭 수집 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- Micrometer Prometheus export (선택) -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

## Circuit Breaker: 3가지 상태

Circuit Breaker의 핵심은 3가지 상태 전이다.

![Circuit Breaker 상태 전이 다이어그램](/assets/posts/spring-cloud-resilience4j-states.svg)

- **CLOSED (닫힘)**: 정상 상태. 요청이 통과하고 실패율을 슬라이딩 윈도우로 집계한다.
- **OPEN (열림)**: 차단 상태. 실패율이 임계치를 넘으면 전환. 모든 요청이 즉시 폴백을 반환한다.
- **HALF_OPEN (반열림)**: 시험 상태. 대기 시간이 지나면 진입. 제한된 요청을 통과시키고 결과에 따라 CLOSED 또는 OPEN으로 전환한다.

## @CircuitBreaker 적용

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final UserServiceClient userClient;

    @CircuitBreaker(name = "userService",
                    fallbackMethod = "defaultUser")
    public UserDto getUser(Long userId) {
        return userClient.findById(userId);
    }

    // 폴백 메서드 — 시그니처는 원본과 같고 Throwable 파라미터 추가
    private UserDto defaultUser(Long userId, Throwable ex) {
        log.warn("user-service unavailable for id={}: {}", userId, ex.getMessage());
        return UserDto.anonymous(userId);
    }
}
```

```yaml
# application.yml
resilience4j:
  circuit-breaker:
    instances:
      userService:
        sliding-window-type: COUNT_BASED     # 또는 TIME_BASED
        sliding-window-size: 10              # 최근 10번 호출 기준
        minimum-number-of-calls: 5           # 최소 5번 호출 후 집계 시작
        failure-rate-threshold: 50           # 50% 실패 시 OPEN
        slow-call-rate-threshold: 80         # 80% 이상이 느리면 OPEN
        slow-call-duration-threshold: 2s     # 2초 초과 = 느린 호출
        wait-duration-in-open-state: 10s     # OPEN → HALF_OPEN 대기 시간
        permitted-number-of-calls-in-half-open-state: 3
        automatic-transition-from-open-to-half-open-enabled: true
```

## Retry: 일시적 실패 재시도

네트워크 일시 오류, DB 커넥션 타임아웃 등 일시적인 실패에는 재시도가 효과적이다.

```java
@Retry(name = "userService", fallbackMethod = "defaultUser")
public UserDto getUser(Long userId) {
    return userClient.findById(userId);
}
```

```yaml
resilience4j:
  retry:
    instances:
      userService:
        max-attempts: 3                      # 최대 3회 시도 (원본 1회 + 재시도 2회)
        wait-duration: 500ms                 # 재시도 간격
        enable-exponential-backoff: true     # 지수 백오프 (500ms → 1s → 2s)
        exponential-backoff-multiplier: 2
        retry-exceptions:                    # 이 예외만 재시도
          - java.net.ConnectException
          - java.util.concurrent.TimeoutException
        ignore-exceptions:                   # 이 예외는 재시도 안 함
          - com.example.UserNotFoundException
```

재시도와 Circuit Breaker를 함께 쓸 때 주의: Retry가 여러 번 실패하면 Circuit Breaker의 슬라이딩 윈도우에 여러 번 집계되어 더 빨리 OPEN 상태로 전환될 수 있다.

## TimeLimiter: 응답 시간 제한

느린 서비스가 스레드를 오래 붙잡는 것을 방지한다. `CompletableFuture`를 반환하는 메서드에 적용한다.

```java
@CircuitBreaker(name = "userService", fallbackMethod = "defaultUser")
@TimeLimiter(name = "userService")
public CompletableFuture<UserDto> getUserAsync(Long userId) {
    return CompletableFuture.supplyAsync(() ->
        userClient.findById(userId)
    );
}
```

```yaml
resilience4j:
  time-limiter:
    instances:
      userService:
        timeout-duration: 3s              # 3초 초과 시 TimeoutException
        cancel-running-future: true       # 타임아웃 시 CompletableFuture 취소
```

## RateLimiter: 초당 요청 제한

외부 API 호출 제한이나 내부 서비스 보호에 유용하다.

![Resilience4j 어노테이션 조합 예제](/assets/posts/spring-cloud-resilience4j-code.svg)

```java
@RateLimiter(name = "externalApi", fallbackMethod = "rateLimitFallback")
public ProductDto fetchFromExternalApi(String productId) {
    return externalApiClient.getProduct(productId);
}

private ProductDto rateLimitFallback(String productId, Throwable ex) {
    // 캐시에서 반환하거나 기본값 반환
    return productCache.get(productId).orElse(ProductDto.placeholder());
}
```

```yaml
resilience4j:
  rate-limiter:
    instances:
      externalApi:
        limit-for-period: 10             # 갱신 주기당 허용 횟수
        limit-refresh-period: 1s         # 갱신 주기
        timeout-duration: 0s             # 허용 요청을 기다리는 최대 시간
```

## Bulkhead: 동시 실행 제한

특정 서비스 호출이 전체 스레드 풀을 소진하지 않도록 제한한다.

```java
@Bulkhead(name = "userService",
          type = Bulkhead.Type.SEMAPHORE,   // 또는 THREADPOOL
          fallbackMethod = "bulkheadFallback")
public UserDto getUser(Long userId) {
    return userClient.findById(userId);
}
```

```yaml
resilience4j:
  bulkhead:
    instances:
      userService:
        max-concurrent-calls: 10          # 동시 실행 최대 10개
        max-wait-duration: 0ms            # 허용 자리를 기다리는 시간 (0=즉시 거절)
```

`THREADPOOL` 타입은 별도의 스레드 풀에서 실행되므로 `CompletableFuture`를 반환해야 한다.

## 어노테이션 조합 순서

여러 어노테이션을 함께 사용할 때는 적용 순서가 중요하다. Spring AOP는 바깥쪽 어노테이션이 먼저 적용된다.

```
@Bulkhead → @CircuitBreaker → @RateLimiter → @TimeLimiter → @Retry → 실제 메서드 호출
```

일반적으로 권장하는 조합과 순서는 다음과 같다.

```java
@Bulkhead(name = "userService", fallbackMethod = "bulkheadFallback")
@CircuitBreaker(name = "userService", fallbackMethod = "circuitFallback")
@TimeLimiter(name = "userService")
@Retry(name = "userService")
public CompletableFuture<UserDto> getUser(Long userId) {
    return CompletableFuture.supplyAsync(() ->
        userClient.findById(userId)
    );
}

// 각 모듈에 맞는 폴백 메서드들
private CompletableFuture<UserDto> circuitFallback(Long id, Throwable e) {
    return CompletableFuture.completedFuture(UserDto.empty(id));
}

private CompletableFuture<UserDto> bulkheadFallback(Long id, Throwable e) {
    return CompletableFuture.completedFuture(UserDto.empty(id));
}
```

## 메트릭 모니터링

Resilience4j는 Micrometer를 통해 Circuit Breaker 상태, 호출 횟수, 실패율 등을 메트릭으로 노출한다.

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, metrics, prometheus, circuitbreakers
  health:
    circuitbreakers:
      enabled: true
  metrics:
    distribution:
      percentiles-histogram:
        resilience4j.circuitbreaker.calls: true
```

Actuator 엔드포인트로 현재 상태를 확인할 수 있다.

```bash
# Circuit Breaker 상태 확인
curl http://localhost:8081/actuator/circuitbreakers

# 응답 예시
{
  "circuitBreakers": {
    "userService": {
      "failureRate": "23.08%",
      "slowCallRate": "0.0%",
      "state": "CLOSED",
      "bufferedCalls": 13,
      "failedCalls": 3
    }
  }
}
```

Prometheus + Grafana와 연동하면 Circuit Breaker 상태 변화를 실시간으로 시각화하고 알람을 설정할 수 있다.

## 실무 체크리스트

**폴백 전략 설계**: 폴백은 단순히 에러를 숨기는 게 아니라 실제로 유용한 응답을 제공해야 한다. 캐시 데이터, 기본값, 부분 응답 등을 활용한다.

**임계치 설정**: `minimum-number-of-calls`를 충분히 설정하지 않으면 초기에 몇 번의 실패만으로 Circuit Breaker가 열린다. 운영 트래픽 패턴을 분석해서 설정한다.

**타임아웃 일관성**: 타임아웃 설정은 `TimeLimiter` > HTTP 클라이언트 타임아웃 > Circuit Breaker `slowCallDurationThreshold` 순으로 일관성 있게 설정해야 한다.

**OpenFeign 통합**: Feign 클라이언트와 함께 쓸 때는 `feign.circuitbreaker.enabled: true`로 설정하면 FeignClient에 Circuit Breaker가 자동 적용된다.

```yaml
feign:
  circuitbreaker:
    enabled: true
    alphanumeric-ids:
      enabled: true
```

Resilience4j는 MSA에서 장애가 전파되지 않도록 각 서비스 호출 지점에 방화벽을 세우는 도구다. Circuit Breaker 하나만 제대로 적용해도 단일 서비스 장애가 전체 시스템을 다운시키는 최악의 상황을 막을 수 있다.

---

**지난 글:** [Spring Cloud Config Server: 중앙화된 설정 관리](/posts/spring-cloud-config-server/)

<br>
읽어주셔서 감사합니다. 😊
