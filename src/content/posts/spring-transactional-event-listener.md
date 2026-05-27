---
title: "@TransactionalEventListener — 트랜잭션 완료 후 이벤트 처리"
description: "@TransactionalEventListener의 TransactionPhase(BEFORE_COMMIT·AFTER_COMMIT·AFTER_ROLLBACK·AFTER_COMPLETION) 옵션을 비교하고, 커밋 후 이메일 발송·롤백 후 보상 처리 같은 실전 패턴을 코드로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "@TransactionalEventListener", "TransactionPhase", "트랜잭션", "이벤트", "Spring Boot"]
featured: false
draft: false
---

[지난 글](/posts/spring-application-event/)에서는 `ApplicationEvent`와 `@EventListener`로 느슨한 결합을 구현하는 방법을 알아봤습니다. 이번에는 한 단계 더 나아가 **트랜잭션과 이벤트를 연동**하는 `@TransactionalEventListener`를 다룹니다. 일반 `@EventListener`는 이벤트 발행 시점에 즉시 실행되므로, 아직 커밋되지 않은 데이터에 기반한 이메일 발송이나 외부 시스템 호출이 트랜잭션 롤백 후에도 이미 나가 버리는 문제가 생길 수 있습니다.

## 문제 상황 — @EventListener의 한계

주문 저장 후 확인 이메일을 보내는 시나리오를 생각해보겠습니다.

```java
@Transactional
public Order createOrder(OrderRequest req) {
    Order order = orderRepo.save(req.toEntity()); // DB INSERT
    publisher.publishEvent(new OrderCreatedEvent(order.getId(), req.email()));
    // 이 라인에서 예외 발생 → 트랜잭션 롤백 예정
    paymentService.charge(req.payment()); // 예외!
    return order;
}
```

일반 `@EventListener`를 사용하면 이벤트가 발행된 시점(DB INSERT 직후)에 리스너가 실행됩니다. 그 후 `paymentService.charge()`에서 예외가 발생해 트랜잭션이 롤백되더라도 **이메일은 이미 발송된 상태**입니다. 고객은 실패한 주문에 대한 확인 메일을 받게 됩니다.

## @TransactionalEventListener 동작 원리

`@TransactionalEventListener`는 이벤트를 **즉시 처리하지 않고 트랜잭션 동기화 콜백에 등록**합니다. 트랜잭션이 지정된 단계(phase)에 도달했을 때만 리스너를 실행합니다.

```java
@Component
public class OrderMailListener {

    @TransactionalEventListener  // 기본값: AFTER_COMMIT
    public void onOrderCreated(OrderCreatedEvent event) {
        // 트랜잭션이 커밋된 이후에만 실행됨
        // DB에 주문 데이터가 반드시 존재하는 시점
        mailService.sendOrderConfirmation(event.customerEmail(), event.orderId());
    }
}
```

트랜잭션이 없는 컨텍스트에서 이벤트가 발행되면 기본적으로 리스너가 실행되지 않습니다. `fallbackExecution = true`를 추가하면 트랜잭션 없이도 실행할 수 있습니다.

```java
@TransactionalEventListener(fallbackExecution = true)
public void onOrderCreated(OrderCreatedEvent event) { ... }
```

![@TransactionalEventListener 트랜잭션 단계별 실행 시점](/assets/posts/spring-transactional-event-listener-phases.svg)

## TransactionPhase 옵션 비교

### BEFORE_COMMIT — 커밋 직전

트랜잭션이 커밋되기 직전에 **같은 트랜잭션 안에서** 실행됩니다. 리스너 안에서 DB를 쓸 수 있고, 예외가 발생하면 트랜잭션이 롤백됩니다. 감사 로그처럼 비즈니스 로직과 원자적으로 처리해야 하는 작업에 적합합니다.

```java
@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
public void writeAuditLog(OrderCreatedEvent event) {
    auditRepo.save(new AuditLog("ORDER_CREATED", event.orderId()));
    // 이 쓰기가 실패하면 전체 트랜잭션 롤백
}
```

### AFTER_COMMIT — 커밋 완료 후 (기본값)

가장 많이 사용되는 설정입니다. 트랜잭션이 성공적으로 커밋된 후 실행되므로, 리스너 실행 시점에 데이터가 DB에 반드시 존재합니다. **이 시점에는 기존 트랜잭션이 끝난 상태**이므로, 리스너 안에서 DB를 쓰려면 새 트랜잭션을 명시적으로 시작해야 합니다.

```java
@TransactionalEventListener  // AFTER_COMMIT이 기본값
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void sendConfirmationEmail(OrderCreatedEvent event) {
    mailService.send(event.customerEmail());
    outboxRepo.markSent(event.orderId()); // 새 트랜잭션에서 실행
}
```

### AFTER_ROLLBACK — 롤백 완료 후

트랜잭션이 롤백된 경우에만 실행됩니다. 보상 처리, 실패 기록, 운영 알림에 활용합니다. 마찬가지로 기존 트랜잭션은 이미 끝났으므로, DB를 쓰려면 `REQUIRES_NEW`가 필요합니다.

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void handleOrderFailure(OrderCreatedEvent event) {
    failureRepo.save(new OrderFailure(event.orderId(), LocalDateTime.now()));
    alertService.notifyOps("주문 처리 실패: " + event.orderId());
}
```

### AFTER_COMPLETION — 커밋·롤백 공통

트랜잭션 결과와 무관하게 항상 실행됩니다. 임시 파일 삭제, 분산 락 해제, 연결 풀 반환 같은 정리 작업에 사용합니다.

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMPLETION)
public void cleanupTempFiles(OrderCreatedEvent event) {
    tempFileManager.cleanup(event.orderId());
}
```

![@TransactionalEventListener 실전 코드](/assets/posts/spring-transactional-event-listener-code.svg)

## 자주 겪는 함정

### ① AFTER_COMMIT 리스너에서 트랜잭션 없이 DB 쓰기

```java
@TransactionalEventListener  // AFTER_COMMIT
public void onCommit(OrderCreatedEvent event) {
    // 트랜잭션이 없으므로 JPA flush 시 예외 발생
    // No EntityManager with actual transaction available
    outboxRepo.save(new OutboxMessage(event));  // ✗
}
```

`AFTER_COMMIT`은 기존 트랜잭션 이후 단계이므로 활성 트랜잭션이 없습니다. `@Transactional(propagation = REQUIRES_NEW)`를 추가해야 합니다.

### ② @Async와 함께 사용 시 트랜잭션 단계 보장 여부

`@Async` + `@TransactionalEventListener`를 조합하면 이벤트가 트랜잭션 완료 후 비동기 스레드에서 실행됩니다. 이 경우 `fallbackExecution` 동작과 트랜잭션 전파에 주의해야 합니다. 비동기 리스너는 별도 스레드이므로 원래 트랜잭션에 참여할 수 없습니다.

### ③ 트랜잭션 없는 컨텍스트에서 발행된 이벤트 누락

트랜잭션 밖에서 `publishEvent()`를 호출하면 `@TransactionalEventListener`는 기본적으로 **무시**됩니다. 이 경우 `fallbackExecution = true` 설정이 필요하거나, 설계를 재검토해야 합니다.

## @EventListener vs @TransactionalEventListener 선택 기준

| 상황 | 권장 |
|---|---|
| 외부 이메일·SMS 발송 | `@TransactionalEventListener` (AFTER_COMMIT) |
| 다른 서비스 HTTP 호출 | `@TransactionalEventListener` (AFTER_COMMIT) |
| 같은 트랜잭션 내 감사 기록 | `@TransactionalEventListener` (BEFORE_COMMIT) |
| 트랜잭션과 무관한 캐시 무효화 | `@EventListener` |
| 내부 애플리케이션 이벤트 (non-DB) | `@EventListener` |
| 실패 시 보상 처리 | `@TransactionalEventListener` (AFTER_ROLLBACK) |

`@TransactionalEventListener`는 "DB가 확정된 후에만 외부 세계에 알린다"는 원칙을 코드로 표현하는 가장 명확한 방법입니다. 특히 마이크로서비스 환경에서 분산 트랜잭션 없이 최종 일관성을 구현하는 Outbox 패턴의 기반이 되기도 합니다.

---

**지난 글:** [Spring ApplicationEvent — 이벤트 기반 느슨한 결합 구현](/posts/spring-application-event/)

**다음 글:** [Spring Kafka 기초 — 메시지 발행과 소비](/posts/spring-kafka-basics/)

<br>
읽어주셔서 감사합니다. 😊
