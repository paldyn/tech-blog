---
title: "Spring Boot 분산 추적 — Micrometer Tracing + Zipkin 실전 적용"
description: "마이크로서비스 환경에서 단일 요청을 추적하는 분산 추적의 핵심 개념(TraceId·SpanId)을 이해하고, Micrometer Tracing과 Zipkin을 연동하여 Spring Boot 3.x에서 관측성을 구축하는 방법을 실전 코드로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "분산추적", "Micrometer", "Zipkin", "Jaeger", "TraceId", "SpanId", "관측성"]
featured: false
draft: false
---

[지난 글](/posts/spring-micrometer-prometheus/)에서 Micrometer로 메트릭을 수집하고 Prometheus·Grafana와 연동하는 방법을 살펴봤다. 메트릭이 "시스템 전체가 얼마나 잘 동작하는가"를 알려준다면, **분산 추적(Distributed Tracing)**은 "특정 요청 하나가 여러 서비스를 거치는 과정에서 어디서 얼마나 걸렸는가"를 알려준다. 마이크로서비스 아키텍처에서는 하나의 HTTP 요청이 API Gateway → Order Service → Inventory Service → 결제 서비스로 이어질 수 있는데, 이 흐름 전체를 단일 TraceId로 묶어 추적하는 것이 분산 추적의 핵심이다.

## 핵심 개념: Trace와 Span

분산 추적의 기본 단위는 **Span**이다. Span은 하나의 서비스 안에서 일어나는 하나의 논리적 작업(HTTP 요청 처리, DB 쿼리, 외부 API 호출 등)을 표현한다. 여러 서비스에 걸친 연관된 Span들의 집합이 **Trace**다.

- **TraceId**: 최초 요청이 발생할 때 생성되어 모든 서비스로 전파되는 전역 식별자
- **SpanId**: 각 서비스 내 작업 단위의 식별자
- **ParentSpanId**: 현재 Span을 호출한 상위 Span의 SpanId (root span에는 없음)

![분산 추적 개념 — TraceId/SpanId 계층 구조](/assets/posts/spring-distributed-tracing-concept.svg)

이 계층 구조 덕분에 Zipkin이나 Jaeger 같은 백엔드에서 전체 요청 타임라인을 재구성하고, 어느 서비스에서 병목이 발생했는지 시각적으로 확인할 수 있다.

## 컨텍스트 전파 방식

Span 정보는 서비스 간 HTTP 헤더로 전파된다. 대표적인 전파 형식은 두 가지다.

**W3C Trace Context** (표준):
```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              버전  traceId(32자리)          spanId(16자리)    플래그
```

**B3 Propagation** (Zipkin):
```
X-B3-TraceId: 4bf92f3577b34da6a3ce929d0e0e4736
X-B3-SpanId:  00f067aa0ba902b7
X-B3-Sampled: 1
```

Spring Boot 3.x의 Micrometer Tracing은 기본적으로 W3C Trace Context를 지원하며, Zipkin 연동 시에는 B3도 함께 지원한다.

## Spring Boot 3.x 설정

Spring Boot 2.x까지는 Spring Cloud Sleuth가 분산 추적을 담당했다. **Spring Boot 3.x부터는 Sleuth가 제거**되고 Micrometer Tracing이 공식 대안으로 자리 잡았다.

### 의존성 추가 (Gradle)

```groovy
dependencies {
    // Micrometer Tracing + Brave(Zipkin 클라이언트) 브리지
    implementation 'io.micrometer:micrometer-tracing-bridge-brave'
    // Zipkin 리포터
    implementation 'io.zipkin.reporter2:zipkin-reporter-brave'
    // Actuator (tracing 엔드포인트 활성화)
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
}
```

Maven을 사용한다면:

```xml
<dependencies>
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-tracing-bridge-brave</artifactId>
    </dependency>
    <dependency>
        <groupId>io.zipkin.reporter2</groupId>
        <artifactId>zipkin-reporter-brave</artifactId>
    </dependency>
</dependencies>
```

### application.yml 설정

```yaml
management:
  tracing:
    sampling:
      probability: 1.0   # 개발: 100%, 운영: 0.1(10%) 권장

spring:
  zipkin:
    base-url: http://localhost:9411
    enabled: true

logging:
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%X{traceId}/%X{spanId}] %-5p %logger{36} : %m%n"
```

`sampling.probability`는 어느 비율의 요청을 추적할지 결정한다. 운영 환경에서 `1.0`으로 설정하면 모든 요청이 추적되어 Zipkin 서버에 부하가 생기므로, 트래픽에 따라 `0.1`~`0.5`로 조정한다.

![Micrometer Tracing + Zipkin 설정 코드](/assets/posts/spring-distributed-tracing-setup.svg)

## 로그에서 TraceId 확인

설정만 마치면 `logback`이 출력하는 모든 로그에 `traceId`와 `spanId`가 자동으로 삽입된다. Micrometer Tracing이 MDC(Mapped Diagnostic Context)에 값을 주입하기 때문이다.

```
2026-05-31 10:23:14 [4bf92f3577b34da6/00f067aa0ba902b7] INFO  c.e.OrderController : 주문 생성 요청
2026-05-31 10:23:14 [4bf92f3577b34da6/a3ce929d0e0e4736] INFO  c.e.OrderService    : 재고 확인 중
2026-05-31 10:23:14 [4bf92f3577b34da6/a3ce929d0e0e4736] INFO  c.e.InventoryClient : HTTP GET /inventory/101
```

세 줄의 traceId가 동일한 `4bf92f3577b34da6`이므로, 이 로그들이 모두 같은 요청에서 발생했음을 즉시 알 수 있다. 장애 발생 시 Kibana나 CloudWatch에서 `traceId`로 필터링하면 관련된 로그 전체를 한 번에 추릴 수 있다.

## RestTemplate / WebClient 자동 전파

`RestTemplate`이나 `WebClient`를 사용해 다른 서비스를 호출할 때, Micrometer Tracing은 헤더 전파를 자동으로 처리한다. 단, `RestTemplate`은 반드시 스프링 빈으로 등록해야 인터셉터가 적용된다.

```java
@Configuration
public class TracingConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        // 빈으로 등록 시 Micrometer Tracing 인터셉터 자동 적용
        return builder.build();
    }
}
```

`WebClient`는 `WebClient.Builder` 빈을 주입받아 사용하면 자동으로 추적 컨텍스트가 전파된다.

```java
@Service
public class InventoryClient {

    private final WebClient webClient;

    public InventoryClient(WebClient.Builder builder) {
        this.webClient = builder
            .baseUrl("http://inventory-service")
            .build();
    }

    public Mono<Integer> getStock(Long productId) {
        return webClient.get()
            .uri("/inventory/{id}", productId)
            .retrieve()
            .bodyToMono(Integer.class);
    }
}
```

## 커스텀 Span 생성

자동 추적 외에도, 중요한 비즈니스 로직에 커스텀 Span을 추가해 세밀한 추적을 구현할 수 있다.

```java
@Service
public class PaymentService {

    private final Tracer tracer;

    public PaymentService(Tracer tracer) {
        this.tracer = tracer;
    }

    public PaymentResult processPayment(Order order) {
        Span span = tracer.nextSpan().name("payment.process").start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            span.tag("order.id", String.valueOf(order.getId()));
            // 결제 로직 실행
            return doPayment(order);
        } catch (Exception e) {
            span.error(e);
            throw e;
        } finally {
            span.end();
        }
    }
}
```

`span.tag()`로 비즈니스 메타데이터를, `span.error()`로 예외 정보를 Span에 붙일 수 있다. Zipkin UI에서 이 정보를 확인하면 "어떤 주문 ID를 처리하다가 어떤 예외가 발생했는지"를 바로 알 수 있다.

## Zipkin 서버 로컬 실행

```bash
# Docker로 Zipkin 서버 실행
docker run -d -p 9411:9411 openzipkin/zipkin

# 브라우저에서 확인
# http://localhost:9411
```

Zipkin UI에서 서비스명, 시간 범위, 최소 duration으로 Trace를 검색할 수 있고, 선택한 Trace의 타임라인 뷰에서 각 Span이 얼마나 걸렸는지 한눈에 확인할 수 있다.

## 운영 환경 고려사항

분산 추적을 운영에 적용할 때 유의할 점이 있다.

- **Sampling Rate**: 트래픽이 많을수록 낮게 설정. 초당 1000 req라면 10% 샘플링만 해도 충분한 데이터를 얻는다
- **Zipkin 서버 가용성**: Zipkin이 다운되어도 애플리케이션은 정상 동작해야 한다. `spring.zipkin.enabled=false` 로 동적 비활성화가 가능하다
- **민감 정보 태그 주의**: `span.tag()`에 사용자 개인정보나 인증 토큰을 넣지 않는다
- **비동기 경계**: `@Async` 메서드 경계에서는 `Tracer.currentSpan()`을 명시적으로 전달해야 한다

---

**지난 글:** [Micrometer + Prometheus — Spring Boot 메트릭 수집과 시각화](/posts/spring-micrometer-prometheus/)

**다음 글:** [Spring Boot Graceful Shutdown — 안전한 서버 종료 전략](/posts/spring-graceful-shutdown/)

<br>
읽어주셔서 감사합니다. 😊
