---
title: "이벤트 기반 아키텍처 — Spring으로 구현하는 EDA 패턴"
description: "Pub/Sub, Event Sourcing, Saga 패턴의 개념과 Spring ApplicationEvent, @EventListener, @TransactionalEventListener, Outbox 패턴을 활용한 실전 구현 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "EDA", "이벤트 기반 아키텍처", "ApplicationEvent", "@EventListener", "Outbox 패턴", "Saga"]
featured: false
draft: false
---

[지난 글](/posts/spring-rabbitmq-amqp/)에서 RabbitMQ를 통해 서비스 간 메시지를 주고받는 방법을 살펴봤습니다. 이번에는 한 걸음 더 나아가 **이벤트 기반 아키텍처(Event-Driven Architecture, EDA)**의 핵심 패턴과 Spring 생태계에서 이를 구현하는 방법을 정리합니다.

## EDA란 무엇인가?

EDA는 시스템 컴포넌트 간 상호작용을 **이벤트의 생성과 소비**로 표현하는 아키텍처 스타일입니다. 동기 API 호출(Request/Response) 대신 이벤트를 발행하고 구독하는 방식으로 컴포넌트 간 **결합도를 낮추고** 독립적인 확장을 가능하게 합니다.

이벤트는 **과거에 발생한 사실**입니다. `createOrder()`는 명령(Command)이고, `OrderCreated`는 이벤트입니다. 이 차이가 EDA 설계의 출발점입니다.

## EDA 핵심 패턴 3가지

![이벤트 기반 아키텍처(EDA) 핵심 패턴](/assets/posts/spring-event-driven-architecture-patterns.svg)

### 1. Pub/Sub (발행-구독)

발행자는 이벤트를 브로커에 발행하고, 구독자는 관심 있는 이벤트만 수신합니다. 발행자는 구독자가 몇 개인지, 어떻게 처리하는지 알 필요가 없습니다. Kafka나 RabbitMQ가 대표적인 브로커입니다.

### 2. Event Sourcing

상태(state)를 직접 저장하는 대신, **상태를 변경한 이벤트 시퀀스**를 저장합니다. 현재 상태는 이벤트를 순서대로 재생(replay)해 재구성합니다. 전체 변경 이력이 자동으로 감사 로그가 되며, 특정 시점의 상태로 되돌아갈 수 있습니다.

### 3. Saga 패턴

분산 트랜잭션 대신, 각 서비스가 로컬 트랜잭션을 수행하고 결과 이벤트를 발행해 다음 단계를 트리거합니다. 실패 시에는 역방향 **보상 트랜잭션(compensating transaction)** 이벤트를 발행합니다. Choreography 방식(이벤트로 조율)과 Orchestration 방식(중앙 Saga 오케스트레이터)이 있습니다.

## Spring ApplicationEvent — 프로세스 내 이벤트

Spring은 별도 브로커 없이 같은 JVM 안에서 이벤트를 주고받는 `ApplicationEvent` 메커니즘을 제공합니다.

![Spring EDA 구현 — 이벤트 발행·처리·아웃박스](/assets/posts/spring-event-driven-architecture-code.svg)

### 이벤트 정의

```java
// Spring 4.2 이후: ApplicationEvent 상속 불필요
public record OrderCreatedEvent(Long orderId, String status) {}
```

Java record를 사용하면 이벤트가 불변(immutable) 값 객체가 됩니다.

### 이벤트 발행

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepo;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Order placeOrder(OrderRequest request) {
        Order order = orderRepo.save(Order.from(request));
        eventPublisher.publishEvent(
            new OrderCreatedEvent(order.getId(), "CREATED")
        );
        return order;
    }
}
```

`ApplicationEventPublisher`를 주입받아 `publishEvent()`를 호출합니다. 기본적으로 **동기·같은 스레드**에서 리스너가 호출됩니다.

### 이벤트 수신

```java
@Component
public class NotificationHandler {

    // 동기 처리 — 발행자와 같은 트랜잭션 안에서 실행
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        sendSmsNotification(event.orderId());
    }

    // 비동기 처리 — 별도 스레드에서 실행
    @Async
    @EventListener
    public void onOrderCreatedAsync(OrderCreatedEvent event) {
        sendEmailNotification(event.orderId());
    }
}
```

`@Async`를 붙이면 별도 스레드 풀에서 비동기로 처리됩니다. `@EnableAsync`가 설정 클래스에 있어야 합니다.

## @TransactionalEventListener — 커밋 이후 안전하게

일반 `@EventListener`는 트랜잭션 도중 호출되므로, 리스너에서 외부 시스템(메시지 브로커 등)에 발행했는데 트랜잭션이 롤백되면 이미 발행된 이벤트를 되돌릴 수 없습니다.

```java
@Component
public class MessageBrokerRelay {

    private final KafkaTemplate<String, OrderCreatedEvent> kafka;

    // 트랜잭션 커밋 완료 후 실행 (기본값)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void afterCommit(OrderCreatedEvent event) {
        kafka.send("order.created", event);
    }

    // 트랜잭션 롤백 시 실행
    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void afterRollback(OrderCreatedEvent event) {
        log.warn("Order transaction rolled back: {}", event.orderId());
    }
}
```

`AFTER_COMMIT`은 DB 커밋이 성공한 경우에만 리스너를 실행합니다. 단, `@TransactionalEventListener`는 **활성 트랜잭션이 없으면 기본적으로 무시**됩니다. `fallbackExecution = true`를 설정하면 트랜잭션 밖에서도 실행됩니다.

## Outbox 패턴 — At-Least-Once 보장

`@TransactionalEventListener`도 커밋 후 JVM 장애가 나면 이벤트가 유실됩니다. 100% 안전한 방법은 **Outbox 패턴**입니다.

### Outbox 테이블 설계

```sql
CREATE TABLE outbox_event (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    aggregate_type VARCHAR(50),
    aggregate_id   VARCHAR(100),
    event_type     VARCHAR(100),
    payload        JSON,
    published      BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 비즈니스 로직과 Outbox를 같은 트랜잭션에 저장

```java
@Transactional
public Order placeOrder(OrderRequest request) {
    Order order = orderRepo.save(Order.from(request));

    // 같은 트랜잭션 — 원자적 저장
    outboxRepo.save(OutboxEvent.of(
        "Order", order.getId(), "OrderCreated",
        objectMapper.writeValueAsString(new OrderCreatedEvent(order.getId(), "CREATED"))
    ));

    return order;
}
```

### 폴링 릴레이어

```java
@Component
@RequiredArgsConstructor
public class OutboxEventRelay {

    private final OutboxEventRepository outboxRepo;
    private final KafkaTemplate<String, String> kafka;

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void relay() {
        outboxRepo.findTop100ByPublishedFalseOrderByCreatedAtAsc()
            .forEach(event -> {
                kafka.send(event.getEventType(), event.getPayload());
                event.markPublished();
            });
    }
}
```

Outbox 패턴은 DB와 메시지 브로커 간 **원자성을 2PC 없이 달성**합니다. Debezium 같은 CDC(Change Data Capture) 도구를 사용하면 폴링 없이 DB 변경 로그에서 직접 이벤트를 추출할 수도 있습니다.

## 이벤트 설계 지침

```java
// 좋은 이벤트 이름 — 과거형, 도메인 언어
OrderCreatedEvent     // ✅
UserRegisteredEvent   // ✅

// 나쁜 이벤트 이름 — 명령형, 기술적
CreateOrderEvent      // ❌
SendEmailRequest      // ❌

// 이벤트 페이로드 — 최소한의 데이터 vs 풍부한 데이터
// Thin event: ID만 포함, 소비자가 조회
record OrderCreatedEvent(Long orderId) {}

// Rich event: 소비자에게 필요한 데이터 포함, 조회 불필요
record OrderCreatedEvent(Long orderId, String customerEmail,
                         BigDecimal amount, String status) {}
```

Thin event는 DB 부하를 분산시키지만 소비자가 추가 조회를 해야 합니다. Rich event는 소비자 독립성이 높지만 페이로드가 커집니다. 서비스 간 경계에서는 Rich event가 일반적으로 유리합니다.

## 멱등성(Idempotency) 처리

At-Least-Once 보장 환경에서는 같은 이벤트가 중복 도착할 수 있습니다.

```java
@EventListener
@Transactional
public void onOrderCreated(OrderCreatedEvent event) {
    // 처리 여부 확인
    if (processedEventRepo.existsByEventId(event.eventId())) {
        return;  // 중복 수신 — 무시
    }

    doProcess(event);
    processedEventRepo.save(new ProcessedEvent(event.eventId()));
}
```

이벤트에 고유 `eventId`를 부여하고, 소비자가 이미 처리한 ID를 기록해 중복 처리를 방지합니다.

## 조합 전략

| 상황 | 추천 방법 |
|---|---|
| 같은 JVM, 트랜잭션 연동 | `@TransactionalEventListener` |
| 서비스 간 느슨한 결합 | Kafka / RabbitMQ + Outbox |
| 복잡한 라우팅, 브로드캐스트 | RabbitMQ fanout/topic exchange |
| 이벤트 리플레이, 감사 | Kafka (로그 보존) |
| 분산 트랜잭션 | Saga 패턴 (Choreography) |

---

**지난 글:** [Spring RabbitMQ — AMQP 메시지 발행·소비·오류 처리](/posts/spring-rabbitmq-amqp/)

**다음 글:** [Spring 테스트 — JUnit 5 & AssertJ 완전 정복](/posts/spring-test-junit5-assertj/)

<br>
읽어주셔서 감사합니다. 😊
