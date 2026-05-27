---
title: "Spring ApplicationEvent — 이벤트 기반 느슨한 결합 구현"
description: "Spring의 이벤트 발행·구독 메커니즘인 ApplicationEvent와 @EventListener를 사용해 서비스 간 결합도를 낮추는 방법을 설명합니다. POJO 이벤트 설계, 발행자 구현, 리스너 등록, 순서 제어, 비동기 처리까지 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "ApplicationEvent", "@EventListener", "이벤트", "느슨한결합", "Spring Boot"]
featured: false
draft: false
---

[지난 글](/posts/spring-async-exception-handling/)에서는 `@Async` 메서드의 예외 처리 전략을 살펴봤습니다. 이번에는 Spring의 **이벤트(Event) 발행·구독 메커니즘**으로 넘어갑니다. 이벤트 기반 설계는 서비스 간 직접 의존을 제거하고, 같은 도메인 동작에 여러 부가 기능(이메일 발송, 통계 기록, 캐시 무효화 등)을 독립적으로 붙이는 가장 깔끔한 방법 중 하나입니다.

## 이벤트 메커니즘이 필요한 이유

주문 생성 서비스를 예로 들어보겠습니다. 주문이 생성될 때 다음 작업이 필요합니다.

- 확인 이메일 발송
- 재고 차감
- 통계 서비스에 기록
- 쿠폰 사용 처리

직접 호출 방식은 `OrderService`가 `MailService`, `InventoryService`, `StatsService`, `CouponService`를 모두 주입받아 순서대로 호출해야 합니다. 의존 관계가 4개 추가되고, 새로운 후처리가 생길 때마다 `OrderService`를 수정해야 합니다.

```java
// 결합도 높은 직접 호출 — OrderService가 너무 많이 안다
public Order createOrder(OrderRequest req) {
    Order order = orderRepo.save(req.toEntity());
    mailService.sendConfirmation(order);       // 직접 호출
    inventoryService.deduct(order);            // 직접 호출
    statsService.record(order);                // 직접 호출
    couponService.markUsed(req.couponCode());  // 직접 호출
    return order;
}
```

이벤트 방식에서는 `OrderService`가 "주문이 생성됐다"는 사실만 알리고, 후처리는 각 리스너가 알아서 합니다.

## ApplicationEvent와 ApplicationEventPublisher

Spring은 `ApplicationContext` 자체가 이벤트 버스 역할을 합니다. 핵심 구성 요소는 세 가지입니다.

- **이벤트 객체**: 발생한 사실을 담은 데이터 클래스
- **발행자**: `ApplicationEventPublisher.publishEvent()` 호출
- **리스너**: `@EventListener` 또는 `ApplicationListener<T>` 구현

Spring 4.2부터는 `ApplicationEvent`를 상속하지 않아도 **일반 POJO**를 이벤트로 사용할 수 있습니다. `record` 클래스로 정의하면 불변성도 자동으로 확보됩니다.

```java
// 이벤트 객체 — record로 불변 설계
public record OrderCreatedEvent(Long orderId, String customerEmail, LocalDateTime createdAt) {}

// 발행자 — ApplicationEventPublisher 주입
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepo;
    private final ApplicationEventPublisher publisher;

    @Transactional
    public Order createOrder(OrderRequest req) {
        Order order = orderRepo.save(req.toEntity());
        // 트랜잭션 커밋 이전 발행 (동기 리스너는 같은 트랜잭션 안)
        publisher.publishEvent(new OrderCreatedEvent(
                order.getId(), req.email(), order.getCreatedAt()));
        return order;
    }
}
```

![ Spring ApplicationEvent 흐름](/assets/posts/spring-application-event-flow.svg)

## @EventListener 리스너 등록

리스너는 `@Component` 빈의 메서드에 `@EventListener`를 붙이면 됩니다. 메서드 파라미터 타입이 처리할 이벤트 타입으로 인식됩니다.

```java
@Component
@RequiredArgsConstructor
public class OrderEventListeners {

    private final MailService mailService;
    private final StatsService statsService;

    @EventListener
    @Order(1)
    public void sendConfirmationEmail(OrderCreatedEvent event) {
        mailService.sendOrderConfirmation(event.customerEmail(), event.orderId());
    }

    @EventListener
    @Order(2)
    public void recordOrderStats(OrderCreatedEvent event) {
        statsService.incrementDailyCount(event.createdAt().toLocalDate());
    }
}
```

`@Order`는 같은 이벤트를 처리하는 리스너 간의 실행 순서를 제어합니다. 값이 낮을수록 먼저 실행됩니다.

## 비동기 리스너

기본적으로 모든 리스너는 **발행 스레드와 동일한 스레드**에서 동기 실행됩니다. 리스너가 느린 작업(외부 API 호출, 대용량 데이터 처리 등)을 수행한다면 발행자의 성능에 영향을 줍니다. `@Async`를 추가하면 별도 스레드풀에서 처리됩니다.

```java
@Async
@EventListener
public void sendSlackAlert(OrderCreatedEvent event) {
    slackClient.notify("새 주문: " + event.orderId()); // 느린 외부 호출
}
```

단, `@Async` 리스너는 발행자의 트랜잭션과 **분리**됩니다. 트랜잭션 커밋 후 실행을 보장하고 싶다면 `@TransactionalEventListener`를 사용해야 합니다(다음 글에서 다룹니다).

![ApplicationEvent 구현 패턴](/assets/posts/spring-application-event-code.svg)

## 리스너 조건부 실행 — condition 속성

`@EventListener`의 `condition` 속성으로 SpEL(Spring Expression Language)을 사용해 특정 조건에서만 리스너를 실행할 수 있습니다.

```java
// orderId가 100 이상인 주문만 처리
@EventListener(condition = "#event.orderId >= 100")
public void processLargeOrder(OrderCreatedEvent event) {
    premiumService.process(event.orderId());
}

// 특정 환경에서만 실행
@EventListener(condition = "@environment.acceptsProfiles('prod')")
public void sendProdAlert(OrderCreatedEvent event) {
    alertService.notifyOpsTeam(event);
}
```

## ApplicationEventMulticaster 커스터마이징

Spring이 기본으로 사용하는 `SimpleApplicationEventMulticaster`는 단일 스레드 동기 방식입니다. 전역적으로 비동기 처리가 필요하다면 빈을 재정의해 `TaskExecutor`를 주입합니다.

```java
@Configuration
public class EventConfig {

    @Bean(name = "applicationEventMulticaster")
    public ApplicationEventMulticaster asyncEventMulticaster() {
        var multicaster = new SimpleApplicationEventMulticaster();
        multicaster.setTaskExecutor(new SimpleAsyncTaskExecutor("event-"));
        // 리스너 예외가 발생해도 다른 리스너는 계속 실행
        multicaster.setErrorHandler(TaskUtils.LOG_AND_SUPPRESS_ERROR_HANDLER);
        return multicaster;
    }
}
```

전역 비동기 멀티캐스터를 사용하면 모든 이벤트가 비동기로 처리되므로, 트랜잭션 연동이 필요한 리스너는 `@TransactionalEventListener`로 명시적으로 관리해야 합니다.

## 이벤트 반환값으로 새 이벤트 발행

리스너 메서드가 반환값을 갖는 경우, Spring은 그 반환값을 새로운 이벤트로 자동 발행합니다. 이벤트 체인을 구성할 때 유용합니다.

```java
@EventListener
public ShipmentCreatedEvent onOrderCreated(OrderCreatedEvent event) {
    Shipment shipment = shipmentService.prepare(event.orderId());
    // 반환값이 새 이벤트로 자동 발행됨
    return new ShipmentCreatedEvent(shipment.getId(), event.customerEmail());
}
```

## 내장 Spring 이벤트 활용

Spring 자체도 컨텍스트 생명주기 이벤트를 발행합니다. 애플리케이션 초기화 완료 시 캐시 워밍, 연결 초기화 등에 활용할 수 있습니다.

```java
@EventListener(ApplicationReadyEvent.class)
public void onApplicationReady() {
    // 서버가 완전히 기동된 후 실행
    cacheWarmupService.warmup();
    log.info("애플리케이션 기동 완료, 캐시 워밍 시작");
}

@EventListener(ContextClosedEvent.class)
public void onContextClosed() {
    // 종료 전 정리 작업
    connectionPool.shutdown();
}
```

`@EventListener(ApplicationStartedEvent.class)`, `ApplicationReadyEvent`, `ContextRefreshedEvent` 등 다양한 생명주기 이벤트가 제공됩니다.

## 설계 지침

- **이벤트는 불변**으로 설계한다. `record`가 가장 간결하다.
- **이벤트 이름은 과거형**으로 짓는다(`OrderCreatedEvent`, `PaymentCompletedEvent`). 이미 발생한 사실을 표현하기 때문이다.
- **한 이벤트에 너무 많은 데이터**를 담지 않는다. 리스너가 필요한 데이터만 포함시킨다.
- **트랜잭션 연동이 필요한 리스너**는 `@EventListener` 대신 `@TransactionalEventListener`를 사용한다.
- 비동기 리스너에는 항상 `AsyncUncaughtExceptionHandler`를 구성해 예외를 잡는다.

---

**지난 글:** [Spring @Async 예외 처리 완전 정복](/posts/spring-async-exception-handling/)

**다음 글:** [@TransactionalEventListener — 트랜잭션 완료 후 이벤트 처리](/posts/spring-transactional-event-listener/)

<br>
읽어주셔서 감사합니다. 😊
