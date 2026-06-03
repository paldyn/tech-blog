---
title: "분산 트랜잭션과 Saga 패턴: Choreography vs Orchestration"
description: "MSA에서 ACID 트랜잭션을 대체하는 Saga 패턴의 두 가지 구현 방식(Choreography·Orchestration)을 Spring Boot와 Kafka 기반 실전 코드로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Saga 패턴", "분산 트랜잭션", "MSA", "Choreography", "Orchestration", "Kafka", "보상 트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/spring-cloud-openfeign/)에서 OpenFeign으로 서비스 간 HTTP 통신을 선언형으로 구현했다. MSA에서는 서로 다른 서비스가 협력해 하나의 비즈니스 동작을 완성할 때 **트랜잭션 일관성** 문제가 발생한다. 주문, 결제, 재고, 배송 서비스가 각자 독립 DB를 가질 때 이 네 서비스에 걸친 ACID 트랜잭션은 불가능하다. Saga 패턴이 그 해답이다.

## 왜 분산 트랜잭션이 어려운가

단일 서비스에서는 `@Transactional`이 ACID를 보장한다. 여러 서비스에 걸친 데이터 변경은 각 서비스가 다른 DB를 가지므로, 전통적인 **2PC(2-Phase Commit)** 방식으로 강한 일관성을 맞출 수 있다. 그러나 2PC는 MSA에 맞지 않는다.

- **성능**: 커밋 전까지 모든 참여 서비스가 잠금 보유 → 응답 지연
- **가용성**: 코디네이터 장애 시 전체 트랜잭션 블록
- **자율성**: 각 서비스가 독립적으로 배포/운영되는 MSA 원칙에 위배

대신 **"최종 일관성(Eventual Consistency)"** 을 허용하고, 실패 시 **보상 트랜잭션(Compensating Transaction)** 으로 원상 복구하는 방식이 Saga 패턴이다.

## Saga 패턴의 기본 원리

Saga는 단일 트랜잭션을 여러 서비스의 **로컬 트랜잭션 시퀀스**로 분해한다. 각 로컬 트랜잭션은 자신의 DB에서만 `@Transactional`로 수행하고, 성공하면 다음 단계를 트리거한다. 실패하면 이미 완료된 단계를 역순으로 취소하는 **보상 트랜잭션**을 실행한다.

```
주문 생성 → 결제 처리 → 재고 차감 → 배송 시작
         ↓ 실패 시
배송 취소 ← 재고 복구 ← 결제 환불 ← 주문 취소
```

핵심 특징:
- **원자성 없음**: 어느 한 시점에 부분적으로 완료된 상태가 존재
- **보상 가능**: 모든 로컬 트랜잭션에는 그것을 되돌리는 보상 트랜잭션이 쌍으로 존재
- **최종 일관성**: 시간이 지나면 모든 서비스가 일관된 상태에 도달

![Saga 패턴 개요: Choreography vs Orchestration](/assets/posts/spring-cloud-saga-pattern-overview.svg)

## Choreography 방식

각 서비스가 이벤트를 발행하고 구독하며 다음 서비스를 간접 호출한다. 중앙 조율자 없이 이벤트 체인으로 흐른다.

```java
// OrderService — Saga 시작
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional
    public Order createOrder(OrderRequest request) {
        Order order = orderRepository.save(
            Order.of(request).withStatus(OrderStatus.PAYMENT_PENDING)
        );
        // 결제 서비스에 이벤트 발행
        kafkaTemplate.send("order-created",
            new OrderCreatedEvent(order.getId(), order.getTotalAmount())
        );
        return order;
    }
}
```

```java
// PaymentService — OrderCreated 이벤트 수신 후 처리
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(topics = "order-created", groupId = "payment-group")
    @Transactional
    public void handleOrderCreated(OrderCreatedEvent event) {
        try {
            Payment payment = processPayment(event.orderId(), event.amount());
            paymentRepository.save(payment);
            // 성공 → 재고 서비스에 이벤트 발행
            kafkaTemplate.send("payment-completed",
                new PaymentCompletedEvent(event.orderId(), payment.getId())
            );
        } catch (InsufficientBalanceException e) {
            // 실패 → 주문 취소 이벤트 발행
            kafkaTemplate.send("payment-failed",
                new PaymentFailedEvent(event.orderId(), e.getMessage())
            );
        }
    }
}
```

```java
// OrderService — 결제 실패 이벤트 수신 → 보상
@KafkaListener(topics = "payment-failed", groupId = "order-group")
@Transactional
public void handlePaymentFailed(PaymentFailedEvent event) {
    Order order = orderRepository.findById(event.orderId()).orElseThrow();
    order.cancel();
    orderRepository.save(order);
}
```

Choreography 방식은 서비스 간 결합도가 낮고 구현이 단순하다. 단점은 전체 흐름을 한눈에 파악하기 어렵고, 서비스 수가 늘어날수록 이벤트 체인이 복잡해진다.

## Orchestration 방식

별도의 Saga Orchestrator가 전체 흐름을 관리하고 각 서비스에 명령을 전송한다. 서비스는 명령을 받아 실행하고 결과만 응답한다.

```java
// SagaState — Saga 진행 상태 추적
@Entity
@Table(name = "order_saga")
public class OrderSagaState {

    @Id
    private Long orderId;

    @Enumerated(EnumType.STRING)
    private SagaStep currentStep;

    @Enumerated(EnumType.STRING)
    private SagaStatus status;  // IN_PROGRESS, COMPLETED, COMPENSATING, FAILED

    private String failureReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

```java
@Service
@RequiredArgsConstructor
public class OrderSagaOrchestrator {

    private final OrderSagaRepository sagaRepository;
    private final PaymentServiceClient paymentClient;
    private final StockServiceClient stockClient;
    private final DeliveryServiceClient deliveryClient;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional
    public void startSaga(Long orderId, OrderRequest request) {
        OrderSagaState saga = OrderSagaState.builder()
            .orderId(orderId)
            .currentStep(SagaStep.PAYMENT_PENDING)
            .status(SagaStatus.IN_PROGRESS)
            .build();
        sagaRepository.save(saga);

        // 첫 단계: 결제 요청
        kafkaTemplate.send("payment-command",
            new ReservePaymentCommand(orderId, request.getTotalAmount())
        );
    }

    @KafkaListener(topics = "payment-result", groupId = "saga-orchestrator")
    @Transactional
    public void handlePaymentResult(PaymentResultEvent event) {
        OrderSagaState saga = sagaRepository.findByOrderId(event.orderId());
        if (event.success()) {
            saga.setCurrentStep(SagaStep.STOCK_PENDING);
            sagaRepository.save(saga);
            // 다음 단계: 재고 예약
            kafkaTemplate.send("stock-command",
                new ReserveStockCommand(event.orderId())
            );
        } else {
            startCompensation(saga, "Payment failed: " + event.reason());
        }
    }

    @KafkaListener(topics = "stock-result", groupId = "saga-orchestrator")
    @Transactional
    public void handleStockResult(StockResultEvent event) {
        OrderSagaState saga = sagaRepository.findByOrderId(event.orderId());
        if (event.success()) {
            saga.setCurrentStep(SagaStep.DELIVERY_PENDING);
            sagaRepository.save(saga);
            kafkaTemplate.send("delivery-command",
                new StartDeliveryCommand(event.orderId())
            );
        } else {
            startCompensation(saga, "Stock reservation failed");
        }
    }

    private void startCompensation(OrderSagaState saga, String reason) {
        saga.setStatus(SagaStatus.COMPENSATING);
        saga.setFailureReason(reason);
        sagaRepository.save(saga);

        // 역순으로 보상 명령 전송
        switch (saga.getCurrentStep()) {
            case DELIVERY_PENDING -> kafkaTemplate.send("delivery-cancel-command",
                new CancelDeliveryCommand(saga.getOrderId()));
            case STOCK_PENDING -> compensatePayment(saga.getOrderId());
            case PAYMENT_PENDING -> markFailed(saga);
        }
    }
}
```

![Saga Orchestrator 구현 패턴](/assets/posts/spring-cloud-saga-pattern-code.svg)

## 멱등성(Idempotency) 보장

Kafka 메시지는 **at-least-once** 전달을 보장한다. 즉, 네트워크 장애로 같은 이벤트가 두 번 처리될 수 있다. 보상 트랜잭션이 두 번 실행되면 이중 환불이 발생한다. 멱등성을 반드시 구현해야 한다.

```java
@Entity
@Table(name = "processed_messages",
    uniqueConstraints = @UniqueConstraint(columnNames = "message_id"))
public class ProcessedMessage {
    @Id
    @GeneratedValue
    private Long id;
    private String messageId;
    private LocalDateTime processedAt;
}
```

```java
@KafkaListener(topics = "payment-command")
@Transactional
public void handlePaymentCommand(
        ReservePaymentCommand cmd,
        @Header(KafkaHeaders.MESSAGE_KEY) String messageKey) {

    // 중복 처리 방지
    if (processedMessageRepository.existsByMessageId(messageKey)) {
        log.warn("Duplicate message ignored: {}", messageKey);
        return;
    }

    processPaymentAndPublishResult(cmd);
    processedMessageRepository.save(new ProcessedMessage(messageKey));
}
```

## Outbox 패턴으로 트랜잭션-메시지 원자성 보장

서비스 로직과 카프카 발행을 같은 로컬 트랜잭션에 묶을 수 없다. DB는 커밋됐는데 카프카 발행이 실패하면 Saga가 진행되지 않는다. **Outbox 패턴**으로 이를 해결한다.

```java
// 트랜잭션 내에서 Outbox 테이블에 이벤트 저장
@Transactional
public Order createOrder(OrderRequest request) {
    Order order = orderRepository.save(Order.of(request));

    // Kafka 직접 발행 대신 Outbox에 저장
    OutboxEvent event = OutboxEvent.builder()
        .aggregateId(order.getId().toString())
        .aggregateType("Order")
        .eventType("OrderCreated")
        .payload(objectMapper.writeValueAsString(
            new OrderCreatedEvent(order.getId(), order.getTotalAmount())
        ))
        .build();
    outboxRepository.save(event);

    return order;
}
```

```java
// 별도 Polling Publisher가 Outbox를 읽어 Kafka에 발행
@Scheduled(fixedDelay = 1000)
@Transactional
public void publishOutboxEvents() {
    List<OutboxEvent> events = outboxRepository.findByPublishedFalse();
    for (OutboxEvent event : events) {
        kafkaTemplate.send(event.getEventType().toLowerCase(), event.getPayload());
        event.markPublished();
        outboxRepository.save(event);
    }
}
```

Debezium CDC(Change Data Capture)를 사용하면 Polling Publisher 없이 DB 변경 로그에서 자동으로 이벤트를 발행할 수 있다.

## Choreography vs Orchestration 선택 기준

**Choreography를 선택하는 경우**:
- 서비스 수가 적고 (3~4개) 흐름이 단순
- 이벤트 주도 아키텍처를 이미 사용
- 서비스 간 결합도를 최소화하는 것이 최우선

**Orchestration을 선택하는 경우**:
- 흐름이 복잡하고 분기(branch)가 많음
- 전체 Saga 상태를 모니터링해야 함
- 비즈니스 로직 변경이 잦아 유지보수성이 중요
- 디버깅과 장애 복구가 중요한 환경

실무에서는 단순 플로우는 Choreography로 시작하고, 복잡도가 높아질수록 Orchestration으로 전환하는 패턴을 많이 사용한다.

## Axon Framework 소개

Saga 패턴 전용 Java 프레임워크로 **Axon Framework**가 있다. Saga 상태 관리, 이벤트 소싱, 멱등성을 프레임워크 레벨에서 처리해준다.

```groovy
implementation 'org.axonframework:axon-spring-boot-starter:4.9.3'
```

```java
@Saga
public class OrderSaga {

    @Autowired
    private transient CommandGateway commandGateway;

    @StartSaga
    @SagaEventHandler(associationProperty = "orderId")
    public void on(OrderCreatedEvent event) {
        SagaLifecycle.associateWith("paymentId", event.getOrderId());
        commandGateway.send(new ReservePaymentCommand(event.getOrderId(), event.getAmount()));
    }

    @SagaEventHandler(associationProperty = "orderId")
    public void on(PaymentReservedEvent event) {
        commandGateway.send(new ReserveStockCommand(event.getOrderId()));
    }

    @EndSaga
    @SagaEventHandler(associationProperty = "orderId")
    public void on(OrderCompletedEvent event) {
        // Saga 완료
    }
}
```

복잡한 Saga를 직접 구현하는 비용을 크게 줄여주지만, 프레임워크 의존성이 강해지는 트레이드오프가 있다.

---

**지난 글:** [Spring Cloud OpenFeign: 선언형 HTTP 클라이언트 완전 정복](/posts/spring-cloud-openfeign/)

**다음 글:** [Spring WebFlux와 리액티브 프로그래밍 개념](/posts/spring-webflux-reactive-concept/)

<br>
읽어주셔서 감사합니다. 😊
