---
title: "Spring 트랜잭션 전파(Propagation) 완전 정복: REQUIRED부터 NESTED까지"
description: "Spring @Transactional의 propagation 속성 7가지를 원리부터 실전 예제까지 완전히 정리합니다. REQUIRED·REQUIRES_NEW·NESTED의 차이, 외부 트랜잭션 중단 메커니즘, 세이브포인트 동작 방식, 그리고 현업에서 전파 속성을 잘못 선택해 발생하는 버그 패턴과 해결책을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "트랜잭션전파", "Propagation", "REQUIRED", "REQUIRES_NEW", "NESTED", "SUPPORTS", "MANDATORY", "NEVER", "NOT_SUPPORTED", "@Transactional"]
featured: false
draft: false
---

[지난 글](/posts/spring-transactional-pitfalls/)에서 `@Transactional`을 잘못 사용할 때 생기는 함정을 살펴봤습니다. 이 글에서는 그 연장선으로 트랜잭션 **전파(Propagation)** 속성을 집중적으로 다룹니다. 전파 속성은 이미 진행 중인 트랜잭션이 있을 때 새 메서드를 호출하면 어떻게 동작할지를 결정합니다. 속성을 잘못 선택하면 데이터 불일치·의도치 않은 롤백·성능 저하 문제가 발생합니다.

## 전파 속성이란

Spring의 `PlatformTransactionManager`는 메서드 진입 시 현재 스레드에 활성 트랜잭션이 있는지 `TransactionSynchronizationManager`(ThreadLocal)를 통해 확인합니다. 전파 속성은 이 확인 결과에 따라 취할 행동을 지정합니다.

```java
@Transactional(propagation = Propagation.REQUIRED) // 기본값
public void myService() { ... }
```

`Propagation` 열거형에 7가지 값이 있으며, 각각 "기존 TX 있을 때"와 "기존 TX 없을 때" 동작이 다릅니다.

![트랜잭션 전파 유형 한눈에 보기](/assets/posts/spring-transaction-propagation-types.svg)

## REQUIRED — 기본값이자 가장 중요한 전파

`REQUIRED`는 기존 트랜잭션이 있으면 참여하고, 없으면 새로 생성합니다. 대부분의 비즈니스 메서드에 적합한 기본값입니다.

```java
@Service
public class OrderService {

    @Transactional  // REQUIRED (기본값)
    public void createOrder(OrderRequest req) {
        Order order = orderRepository.save(new Order(req));
        paymentService.charge(order);   // REQUIRED → 같은 TX 참여
        inventoryService.deduct(order); // REQUIRED → 같은 TX 참여
        // 셋 중 하나라도 예외 → 전체 롤백
    }
}
```

`REQUIRED`로 참여한 내부 메서드가 `RuntimeException`을 던지면 공유 트랜잭션이 **rollback-only** 상태로 마킹됩니다. 외부에서 예외를 catch해도 커밋 시점에 `UnexpectedRollbackException`이 발생합니다. 이것이 [지난 글](/posts/spring-transactional-pitfalls/)에서 다룬 함정 5번이었습니다.

## REQUIRES_NEW — 독립 트랜잭션이 필요할 때

`REQUIRES_NEW`는 항상 새 트랜잭션을 만들고, 외부에 기존 트랜잭션이 있으면 **일시 중단(suspend)** 합니다.

```java
@Service
public class NotificationService {

    // 알림 실패가 주문 TX에 영향을 주면 안 됨
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendOrderConfirmation(Long orderId) {
        Notification n = buildNotification(orderId);
        notificationRepository.save(n);
        smsSender.send(n);  // 실패해도 주문 TX는 유지됨
    }
}
```

![REQUIRED vs REQUIRES_NEW 실행 흐름](/assets/posts/spring-transaction-propagation-requires-new.svg)

**주의 사항**: `REQUIRES_NEW`는 새 커넥션을 획득합니다. 외부 TX가 커넥션을 유지한 채 내부에서 또 새 커넥션을 가져오므로 커넥션 풀이 고갈될 수 있습니다. HikariCP 기본 풀 크기(10)에서 깊이 있는 중첩 호출이 많으면 데드락이 발생하니 주의해야 합니다.

```java
// 위험 패턴: 루프 안에서 REQUIRES_NEW 호출
@Transactional
public void processAll(List<Order> orders) {
    for (Order o : orders) {
        notificationService.sendOrderConfirmation(o.getId());
        // 각 반복마다 새 커넥션 획득 → 풀 소진 위험
    }
}
```

## SUPPORTS — 트랜잭션을 강제하지 않을 때

`SUPPORTS`는 기존 TX가 있으면 참여하고, 없으면 TX 없이 실행합니다. 순수 조회에서 TX 오버헤드를 피하면서도 TX 컨텍스트 안에서 호출될 때는 함께 참여하고 싶을 때 사용합니다.

```java
@Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
public List<Product> findByCriteria(SearchCriteria criteria) {
    // TX 안에서 호출: 기존 TX 참여
    // TX 밖에서 호출: 비TX 실행 (readonly cursor 등 유리)
    return productRepository.findAll(criteria);
}
```

## MANDATORY — 반드시 TX 안에서 호출해야 할 때

`MANDATORY`는 기존 TX가 없으면 `IllegalTransactionStateException`을 던집니다. 내부 로직 자체로는 TX를 생성하지 않고, 반드시 외부에서 TX를 열어야 하는 서비스 레이어 내부 메서드에 방어적으로 사용합니다.

```java
@Transactional(propagation = Propagation.MANDATORY)
public void deductInventory(Long productId, int qty) {
    // 반드시 주문 TX 안에서만 호출 가능
    // 직접 호출 시 → IllegalTransactionStateException
    Inventory inv = inventoryRepository.findById(productId).orElseThrow();
    inv.deduct(qty);
}
```

## NEVER — TX가 있으면 예외를 던질 때

`NEVER`는 `MANDATORY`의 반대입니다. 기존 TX가 있으면 예외를 던지고, 없으면 비TX로 실행합니다. 외부 시스템 HTTP 호출 등 트랜잭션을 열어 두면 위험한 로직에 사용합니다.

```java
@Transactional(propagation = Propagation.NEVER)
public String callExternalPaymentGateway(PaymentRequest req) {
    // TX를 유지한 채 외부 API를 장시간 호출하면
    // DB 커넥션이 점유되므로 NEVER로 방어
    return httpClient.post(GATEWAY_URL, req);
}
```

## NOT_SUPPORTED — 외부 TX를 중단하고 비TX 실행

`NOT_SUPPORTED`는 기존 TX가 있으면 일시 중단하고 비TX로 실행합니다. `REQUIRES_NEW`가 새 TX를 열고 실행하는 반면, `NOT_SUPPORTED`는 TX 없이 실행합니다.

```java
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public void generateReport(Long reportId) {
    // 대용량 배치 읽기 — TX 없이 커서 스트리밍
    // 외부 TX도 방해하지 않음
    reportWriter.write(reportId);
}
```

## NESTED — 세이브포인트 기반 중첩

`NESTED`는 기존 TX가 있으면 **세이브포인트(SAVEPOINT)** 를 만들고 실행합니다. 내부에서 예외가 발생해 롤백하면 세이브포인트까지만 되돌리고, 외부 TX는 계속 진행할 수 있습니다.

```java
@Transactional(propagation = Propagation.NESTED)
public void saveAuditLog(AuditEvent event) {
    auditRepository.save(event);
    // 실패해도 세이브포인트까지만 롤백
    // 외부 주문 TX는 유지됨
}
```

```java
@Transactional
public void createOrderWithAudit(Order order) {
    orderRepository.save(order);
    try {
        auditService.saveAuditLog(new AuditEvent(order)); // NESTED
    } catch (Exception e) {
        // 감사 로그 실패 → 세이브포인트 롤백
        // 주문은 그대로 유지
        log.warn("감사 로그 저장 실패", e);
    }
    // 주문 TX는 계속 진행됨
}
```

**제약**: `NESTED`는 JDBC `DataSourceTransactionManager`와 `savepoint`를 지원하는 DB에서만 동작합니다. JPA `JpaTransactionManager`는 기본적으로 지원하지 않습니다.

## 전파 속성 선택 가이드

```
상황별 전파 속성 선택

1. 비즈니스 로직 (기본)          → REQUIRED
2. 독립 커밋이 필요한 로직       → REQUIRES_NEW
   (알림, 감사 로그, 포인트 적립)
3. 외부 TX 참여 선택적 조회      → SUPPORTS
4. 반드시 TX 안에서만 호출       → MANDATORY
5. 절대 TX 없이 실행해야 함      → NEVER / NOT_SUPPORTED
6. 세이브포인트 기반 부분 롤백   → NESTED (JDBC only)
```

## REQUIRES_NEW vs NESTED 비교

| 항목 | REQUIRES_NEW | NESTED |
|---|---|---|
| 새 커넥션 | 필요 | 불필요 (같은 커넥션) |
| 독립 커밋 | 가능 | 불가 (외부 커밋 종속) |
| 외부 롤백 시 내부 | 유지됨 | 함께 롤백 |
| 내부 롤백 시 외부 | 영향 없음 | 세이브포인트까지만 |
| JPA 지원 | 가능 | 제한적 |

## 정리

- `REQUIRED` — 기본값, 대부분의 비즈니스 메서드
- `REQUIRES_NEW` — 독립 커밋이 필요한 알림·로그 처리 (커넥션 고갈 주의)
- `NESTED` — 세이브포인트 부분 롤백 (JDBC only)
- `MANDATORY` — 방어적 TX 강제
- `NEVER` / `NOT_SUPPORTED` — 외부 API 호출·배치 스트리밍

---

**지난 글:** [Spring @Transactional 함정 완전 정복: 자기 호출·롤백 규칙·체크 예외](/posts/spring-transactional-pitfalls/)

**다음 글:** [Spring 트랜잭션 격리 수준(Isolation) 완전 정복: 팬텀 리드부터 직렬화까지](/posts/spring-transaction-isolation/)

<br>
읽어주셔서 감사합니다. 😊
