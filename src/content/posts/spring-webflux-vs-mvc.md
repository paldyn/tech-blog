---
title: "Spring MVC vs WebFlux: 언제 무엇을 선택해야 하는가"
description: "Spring MVC의 Thread-Per-Request 모델과 Spring WebFlux의 Event Loop 모델을 내부 구조, 성능 특성, 코드 스타일, 생태계 측면에서 비교하고 실제 프로젝트에서의 선택 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring MVC", "Spring WebFlux", "Thread-Per-Request", "Event Loop", "논블로킹", "선택 기준", "성능 비교"]
featured: false
draft: false
---

[지난 글](/posts/spring-webflux-reactor-mono-flux/)에서 Project Reactor의 `Mono`와 `Flux`를 깊이 살펴봤다. 이번 글에서는 Spring이 제공하는 두 가지 웹 스택인 **Spring MVC**와 **Spring WebFlux**를 실질적인 선택 기준과 함께 비교한다. 둘 다 같은 `@Controller`/`@RestController` 어노테이션을 지원하지만, 내부 동작 원리는 근본적으로 다르다.

## 두 모델의 핵심 차이

Spring MVC는 서블릿 스펙 위에서 동작하는 **Thread-Per-Request** 모델이다. 요청이 들어오면 스레드 풀에서 하나의 스레드를 꺼내 응답을 보낼 때까지 점유한다. 데이터베이스 쿼리나 외부 API 호출 동안 해당 스레드는 결과를 기다리며 블로킹된다.

Spring WebFlux는 Reactor의 Event Loop 위에서 동작하는 **논블로킹** 모델이다. 소수의 스레드(보통 CPU 코어 수)가 수많은 요청을 이벤트 기반으로 처리하며, I/O 대기 중에도 스레드가 다른 요청을 처리할 수 있다.

![Spring MVC vs WebFlux 비교](/assets/posts/spring-webflux-vs-mvc-comparison.svg)

## 스레드 모델 비교

Spring MVC 애플리케이션의 스레드 동작은 직관적이다. 요청이 들어오면 톰캣이 스레드 풀(기본 200개)에서 스레드를 할당하고, 처리가 완료될 때까지 그 스레드는 해당 요청에 묶여 있다.

```java
// Spring MVC: 동기·블로킹 코드
@RestController
public class OrderController {

    @GetMapping("/orders/{id}")
    public Order getOrder(@PathVariable Long id) {
        // 이 라인에서 스레드가 DB 응답을 기다리며 블로킹
        Order order = orderRepository.findById(id).orElseThrow();
        // 이 라인에서도 블로킹
        Payment payment = paymentClient.getPayment(order.getPaymentId());
        return order.withPayment(payment);
    }
}
```

같은 로직을 WebFlux로 작성하면 반환 타입이 `Mono<Order>`로 바뀐다. 이 파이프라인이 실행되는 동안 스레드는 블로킹되지 않는다.

```java
// Spring WebFlux: 비동기·논블로킹 코드
@RestController
public class OrderController {

    @GetMapping("/orders/{id}")
    public Mono<Order> getOrder(@PathVariable Long id) {
        return orderRepository.findById(id)           // R2DBC: 논블로킹 DB 조회
            .switchIfEmpty(Mono.error(new NotFoundException()))
            .flatMap(order ->
                paymentClient.getPayment(order.getPaymentId())  // WebClient: 논블로킹 HTTP
                    .map(order::withPayment)
            );
    }
}
```

## 성능 특성

두 모델의 성능 차이는 워크로드 유형에 따라 달라진다.

**CPU 집약형 작업**: Spring MVC가 우세하거나 동등하다. 스레드 수가 충분하다면 논블로킹의 이점이 없고, 오히려 리액티브 오버헤드가 발생한다.

**I/O 집약형 작업 (고동시성)**: Spring WebFlux가 압도적으로 유리하다. 스레드 풀 크기에 관계없이 수만 개의 동시 연결을 적은 메모리로 처리할 수 있다.

```
동시 요청 10,000개, 각 50ms DB 지연 시 비교:

Spring MVC (200 threads):
  처리량: ~200 req/s (스레드 수가 병목)
  스레드당 메모리: ~1MB × 200 = 200MB

Spring WebFlux (8 event-loop threads):
  처리량: ~10,000 req/s
  스레드당 메모리: ~1MB × 8 = 8MB
```

## 코드 스타일과 러닝 커브

Spring MVC의 동기 스타일은 순차적으로 읽히며 디버깅이 직관적이다. 스택 트레이스가 요청의 전체 흐름을 보여준다.

WebFlux의 리액티브 스타일은 초반 러닝 커브가 가파르다. `flatMap`과 `map`의 차이, `Scheduler` 선택, 에러 핸들링 체인을 이해하는 데 시간이 필요하다. 스택 트레이스는 이벤트 루프 내부를 가리켜 디버깅이 어렵다.

```java
// WebFlux 에러 처리: 체인 중간에 명시적으로
return orderRepository.findById(id)
    .switchIfEmpty(Mono.error(new OrderNotFoundException(id)))
    .flatMap(order -> paymentClient.getPayment(order.getPaymentId()))
    .onErrorMap(WebClientException.class,
        ex -> new PaymentServiceException("결제 서비스 응답 실패", ex))
    .timeout(Duration.ofSeconds(5))
    .onErrorReturn(TimeoutException.class, Order.empty());
```

## 의존성과 생태계

WebFlux를 선택하면 기술 스택 전체가 논블로킹이어야 한다. 블로킹 라이브러리를 이벤트 루프 스레드에서 직접 호출하면 전체 처리량이 무너진다.

| 계층 | Spring MVC | Spring WebFlux |
|------|-----------|---------------|
| HTTP 서버 | Tomcat (서블릿) | Netty (이벤트 루프) |
| DB 접근 | JDBC / JPA | R2DBC / Reactive Mongo |
| HTTP 클라이언트 | RestTemplate | WebClient |
| 테스트 | MockMvc | WebTestClient |
| 캐시 | Spring Cache | Reactive Redis |

## 선택 기준

두 스택 중 하나를 선택할 때 고려할 기준을 정리하면 다음과 같다.

![MVC vs WebFlux 선택 가이드](/assets/posts/spring-webflux-vs-mvc-decision.svg)

**Spring MVC를 선택해야 할 때:**
- 팀이 리액티브 프로그래밍에 익숙하지 않을 때
- 블로킹 라이브러리(JDBC, Hibernate, 레거시 SDK)를 피할 수 없을 때
- 복잡한 비즈니스 로직과 트랜잭션이 중심인 CRUD 애플리케이션
- 빠른 개발과 유지보수 가능성을 우선시할 때

**Spring WebFlux를 선택해야 할 때:**
- API 게이트웨이, 프록시, 스트리밍 서비스처럼 고동시성 I/O 처리가 핵심일 때
- 팀이 Reactor/RxJava 경험이 있거나 학습에 충분한 시간이 있을 때
- 서버 비용과 메모리 효율이 중요한 환경
- 마이크로서비스 간 논블로킹 통신 파이프라인을 구축할 때

## 혼용의 위험

가장 흔한 실수는 WebFlux 애플리케이션에서 블로킹 코드를 섞는 것이다. `Mono.fromCallable(() -> blockingDao.find(id))` 같은 코드를 이벤트 루프 스레드에서 실행하면 해당 스레드가 블로킹되어 다른 수천 개의 요청을 처리할 수 없게 된다.

```java
// 잘못된 패턴: 이벤트 루프에서 블로킹 JDBC 직접 호출
return Mono.just(jdbcRepository.findById(id));  // 절대 금지

// 올바른 패턴: 별도 스케줄러로 격리
return Mono.fromCallable(() -> jdbcRepository.findById(id))
           .subscribeOn(Schedulers.boundedElastic());  // 블로킹 I/O용 스레드 풀
```

불가피하게 블로킹 코드가 필요하다면 `Schedulers.boundedElastic()`을 사용해 이벤트 루프 스레드와 격리해야 한다. 하지만 이 경우에는 WebFlux의 이점이 크게 줄어들므로 MVC를 재고하는 편이 낫다.

두 스택 모두 완전히 지원되는 선택지이며, "WebFlux가 항상 더 좋다"는 것은 사실이 아니다. 요구사항과 팀 역량을 기반으로 선택하는 것이 올바른 접근이다.

---

**지난 글:** [Reactor Mono·Flux 완전 정복: 오퍼레이터와 실전 패턴](/posts/spring-webflux-reactor-mono-flux/)

**다음 글:** [WebClient: 비동기 HTTP 클라이언트 완전 가이드](/posts/spring-webflux-webclient/)

<br>
읽어주셔서 감사합니다. 😊
