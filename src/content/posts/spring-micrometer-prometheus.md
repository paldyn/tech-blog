---
title: "Micrometer + Prometheus — Spring Boot 메트릭 수집과 시각화"
description: "Micrometer의 벤더 중립 메트릭 파사드 개념을 이해하고, Counter/Gauge/Timer/DistributionSummary를 코드로 구현하며, Prometheus와 Grafana까지 연동하는 전체 관측성 스택을 구성합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Micrometer", "Prometheus", "Grafana", "메트릭", "모니터링", "관측성"]
featured: false
draft: false
---

[지난 글](/posts/spring-custom-healthindicator/)에서 커스텀 HealthIndicator로 애플리케이션의 생존 여부를 확인하는 방법을 살펴봤다. 헬스 체크가 "살아 있는가/죽어 있는가"를 알려준다면, **메트릭(Metrics)**은 "얼마나 잘 동작하고 있는가"를 알려준다. 초당 몇 건의 주문이 처리되는가, 95번째 백분위 API 응답 시간이 얼마인가, JVM 힙 사용률이 몇 퍼센트인가 — 이런 정보가 있어야 성능 병목을 찾고 용량 계획을 세울 수 있다.

## Micrometer란 — "메트릭의 SLF4J"

**Micrometer**는 메트릭 수집을 위한 **벤더 중립 파사드(Vendor-Neutral Facade)**다. SLF4J가 Logback, Log4j, JUL을 하나의 API로 추상화하듯, Micrometer는 Prometheus, Datadog, CloudWatch, InfluxDB를 단일 API로 추상화한다.

Spring Boot 2부터 Micrometer가 기본 내장됐다. `spring-boot-starter-actuator`를 추가하면 JVM, HTTP, DB 연결 풀 메트릭이 자동 수집된다.

```xml
<!-- pom.xml: Prometheus 백엔드 추가 -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

이 의존성 하나로 `/actuator/prometheus` 엔드포인트가 활성화되고, Prometheus 텍스트 포맷으로 메트릭을 노출한다.

![Micrometer 메트릭 파사드 아키텍처](/assets/posts/spring-micrometer-prometheus-architecture.svg)

## 4가지 핵심 메트릭 타입

Micrometer는 4가지 기본 메트릭 타입을 제공한다.

![Micrometer 4가지 메트릭 타입](/assets/posts/spring-micrometer-prometheus-metrics.svg)

### Counter — 단조 증가 카운터

이벤트가 발생할 때마다 1씩 증가하는 값이다. 감소하지 않는다.

```java
@Service
public class OrderService {

    private final Counter orderCreatedCounter;
    private final Counter orderFailedCounter;

    public OrderService(MeterRegistry registry) {
        this.orderCreatedCounter = Counter.builder("orders.created")
                .description("생성된 주문 수")
                .tag("region", "kr")         // 태그로 차원 분리
                .register(registry);
        this.orderFailedCounter = Counter.builder("orders.failed")
                .tag("region", "kr")
                .register(registry);
    }

    public Order createOrder(OrderRequest request) {
        try {
            Order order = processOrder(request);
            orderCreatedCounter.increment();
            return order;
        } catch (Exception e) {
            orderFailedCounter.increment();
            throw e;
        }
    }
}
```

### Gauge — 현재 상태

증가도 감소도 하는 순간 값이다. 큐 크기, 활성 세션 수, 메모리 사용량에 적합하다.

```java
// Gauge는 값을 직접 push하지 않고, 측정 시점에 값을 가져오도록 등록
Gauge.builder("order.queue.size", orderQueue, Queue::size)
     .description("주문 처리 대기 큐 크기")
     .register(registry);

// 또는 AtomicInteger를 사용
AtomicInteger activeConnections = new AtomicInteger(0);
Gauge.builder("db.connections.active", activeConnections, AtomicInteger::get)
     .register(registry);
```

### Timer — 소요 시간 측정

실행 시간과 호출 횟수를 함께 측정한다. Prometheus에서 `_count`, `_sum`, `_bucket` 3가지 메트릭으로 노출된다.

```java
@Service
public class ExternalApiService {

    private final Timer apiTimer;

    public ExternalApiService(MeterRegistry registry) {
        this.apiTimer = Timer.builder("external.api.latency")
                .description("외부 API 응답 시간")
                .tag("api", "payment")
                .publishPercentiles(0.5, 0.95, 0.99)  // 백분위 계산
                .publishPercentileHistogram()           // 히스토그램 활성화
                .register(registry);
    }

    public PaymentResult processPayment(PaymentRequest req) {
        return apiTimer.record(() -> {
            // 이 람다의 실행 시간이 자동 측정됨
            return paymentClient.process(req);
        });
    }
}
```

### DistributionSummary — 크기/양 분포

Timer와 비슷하지만 시간이 아닌 임의 단위의 값을 측정한다.

```java
DistributionSummary.builder("http.request.body.size")
                   .baseUnit("bytes")
                   .publishPercentiles(0.5, 0.95)
                   .register(registry)
                   .record(request.getContentLength());
```

## @Timed — 선언적 Timer

매번 Timer를 직접 주입받지 않고, AOP 기반의 `@Timed` 어노테이션으로 간단하게 적용할 수 있다.

```java
@Configuration
public class TimedConfig {
    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);  // @Timed AOP 활성화
    }
}

@Service
public class ReportService {

    @Timed(
        value = "report.generation",
        description = "보고서 생성 시간",
        percentiles = {0.5, 0.95, 0.99},
        histogram = true
    )
    public Report generateReport(ReportRequest request) {
        // 이 메서드의 실행 시간이 자동으로 Timer에 기록됨
        return buildReport(request);
    }
}
```

## Prometheus 연동 설정

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  metrics:
    tags:
      application: ${spring.application.name}  # 모든 메트릭에 앱명 태그 추가
      environment: ${spring.profiles.active:prod}
    distribution:
      percentiles-histogram:
        http.server.requests: true  # HTTP 요청 히스토그램 활성화
      percentiles:
        http.server.requests: 0.5, 0.95, 0.99
      slo:
        http.server.requests: 50ms, 200ms, 500ms, 1s  # SLO 버킷 설정
```

## Prometheus + Grafana 스택 구성

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: spring-app
    metrics_path: /actuator/prometheus
    static_configs:
      - targets:
          - host.docker.internal:8080
```

Grafana에서 Spring Boot 공식 대시보드(ID: 12900)를 Import하면 JVM, HTTP, DB 커넥션 풀 메트릭이 한 번에 시각화된다.

## 커스텀 메트릭 전략

메트릭이 너무 많으면 오히려 노이즈가 된다. 다음 원칙을 따른다.

1. **비즈니스 핵심 이벤트에만 Counter**: 주문 생성, 결제 성공/실패, 회원 가입
2. **응답 시간이 중요한 메서드에 Timer**: 외부 API 호출, DB 쿼리, 배치 작업
3. **리소스 상태에 Gauge**: 큐 크기, 활성 연결, 캐시 히트율
4. **태그는 카디널리티 낮게**: 무한 값(userId, traceId)을 태그로 쓰면 메모리 폭발

```java
// 잘못된 예: userId를 태그로 → 사용자 수 × 메트릭 수 만큼 메모리 사용
counter.tag("userId", userId.toString()).increment();  // 절대 금지

// 올바른 예: 낮은 카디널리티 태그만
counter.tag("plan", user.getPlanType()).increment();  // "FREE", "PRO", "ENTERPRISE" 3가지
```

---

**지난 글:** [Spring Boot Actuator — 커스텀 HealthIndicator 구현](/posts/spring-custom-healthindicator/)

<br>
읽어주셔서 감사합니다. 😊
