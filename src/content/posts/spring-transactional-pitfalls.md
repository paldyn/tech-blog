---
title: "Spring @Transactional 함정 완전 정복: 자기 호출·롤백 규칙·체크 예외"
description: "현업에서 가장 자주 마주치는 @Transactional 버그를 집중 해부합니다. AOP 프록시 자기 호출 문제와 해결책, 체크 예외가 롤백되지 않는 이유, private 메서드 적용 불가, try-catch로 예외를 삼킬 때 커밋되는 원리, 그리고 UnexpectedRollbackException까지 원인과 해법을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "@Transactional", "자기호출", "롤백규칙", "체크예외", "SelfInvocation", "CGLIB", "AOP프록시", "UnexpectedRollbackException", "트랜잭션함정"]
featured: false
draft: false
---

[지난 글](/posts/spring-platform-transaction-manager/)에서 `PlatformTransactionManager`가 트랜잭션 경계를 어떻게 만드는지 살펴봤습니다. `@Transactional`은 편리하지만 내부 동작 방식을 모르면 데이터가 예상과 다르게 커밋되거나 롤백되는 버그가 잦습니다. 이 글에서는 현업에서 가장 많이 발생하는 함정 다섯 가지를 원리부터 해결책까지 정리합니다.

## 함정 1: 자기 호출(Self-Invocation)

Spring의 `@Transactional`은 AOP 프록시로 동작합니다. 외부에서 빈을 호출하면 프록시를 경유하지만, 같은 클래스 안에서 `this.method()`를 호출하면 프록시를 **우회**합니다.

![자기 호출 문제와 해결책](/assets/posts/spring-transactional-pitfalls-selfcall.svg)

```java
@Service
public class OrderService {

    // 외부에서 호출 → 프록시 경유 → @Transactional 적용됨
    public void createOrder(Order order) {
        validate(order);
        save(order);     // this.save() — 프록시 우회! TX 없음
    }

    @Transactional
    public void save(Order order) {
        orderRepository.save(order);
    }
}
```

`createOrder`를 외부에서 호출하면 `save`의 `@Transactional`은 완전히 무시됩니다. `save`에서 예외가 발생해도 롤백되지 않습니다.

**해결책 1 — 클래스 분리 (권장)**

```java
@Service
public class OrderFacade {

    private final OrderSaveService saveService;

    public void createOrder(Order order) {
        validate(order);
        saveService.save(order);  // 다른 빈 → 프록시 경유 ✓
    }
}

@Service
public class OrderSaveService {

    @Transactional
    public void save(Order order) {
        orderRepository.save(order);
    }
}
```

**해결책 2 — ApplicationContext 자기 주입 (비권장, 테스트 어려움)**

```java
@Service
public class OrderService implements ApplicationContextAware {

    private OrderService self;  // 자기 자신의 프록시

    @Override
    public void setApplicationContext(ApplicationContext ctx) {
        self = ctx.getBean(OrderService.class);
    }

    public void createOrder(Order order) {
        self.save(order);  // 프록시 경유 ✓
    }

    @Transactional
    public void save(Order order) { ... }
}
```

## 함정 2: 체크 예외는 롤백되지 않는다

Spring은 `RuntimeException`(언체크 예외)과 `Error`만 기본으로 롤백합니다. `IOException`, `SQLException` 같은 **체크 예외는 기본적으로 커밋**합니다.

![롤백 규칙 & 주요 함정 정리](/assets/posts/spring-transactional-pitfalls-rollback.svg)

```java
@Transactional
public void transferFile(Long id) throws IOException {
    dbService.markInProgress(id);     // DB 저장 — OK
    fileService.copyFile(id);         // IOException 발생!
    dbService.markComplete(id);       // 실행 안 됨
    // IOException은 체크 예외 → 기본 동작: 커밋!
    // markInProgress()가 커밋된다 → 데이터 불일치
}
```

**해결책 — rollbackFor 명시**

```java
@Transactional(rollbackFor = Exception.class)
public void transferFile(Long id) throws IOException {
    dbService.markInProgress(id);
    fileService.copyFile(id);         // IOException → 이제 롤백됨
}
```

또는 체크 예외를 런타임 예외로 감싸는 방법도 흔히 사용합니다.

```java
@Transactional
public void transferFile(Long id) {
    try {
        fileService.copyFile(id);
    } catch (IOException e) {
        throw new FileTransferException("파일 이동 실패", e);
        // FileTransferException이 RuntimeException이면 롤백됨
    }
}
```

## 함정 3: private 메서드에 @Transactional 적용 불가

CGLIB 프록시는 서브클래스를 만들어 메서드를 오버라이드합니다. `private` 메서드는 오버라이드할 수 없어 AOP가 적용되지 않습니다.

```java
@Service
public class PaymentService {

    // private 메서드 — @Transactional이 완전히 무시됨
    @Transactional
    private void recordPayment(Payment payment) {
        paymentRepository.save(payment);
        // 트랜잭션 없이 실행됨
    }
}
```

`@Transactional`을 `private` 메서드에 선언해도 컴파일 오류나 경고가 없어 발견하기 어렵습니다. IDE의 "Transactional method 'x' is private" 경고를 반드시 활성화하세요.

```java
// 해결: public으로 변경하거나 내부 로직을 public 메서드로 추출
@Transactional
public void recordPayment(Payment payment) {  // public ✓
    paymentRepository.save(payment);
}
```

## 함정 4: try-catch로 예외를 삼키면 커밋된다

AOP 어드바이스는 메서드 밖으로 **전파되는 예외**를 감지해 롤백을 결정합니다. 내부에서 예외를 catch하고 삼키면 어드바이스에 예외가 도달하지 않아 커밋됩니다.

```java
@Transactional
public void processPayment(Payment payment) {
    try {
        paymentGateway.charge(payment);   // 외부 API 오류
        paymentRepository.save(payment);
    } catch (Exception e) {
        log.error("결제 실패", e);
        // 예외를 삼킴 — 메서드는 정상 반환 → 커밋!
        // paymentRepository.save()가 커밋될 수 있음
    }
}
```

**해결책 — 수동 롤백 마킹 또는 예외 재던지기**

```java
@Transactional
public void processPayment(Payment payment) {
    try {
        paymentGateway.charge(payment);
        paymentRepository.save(payment);
    } catch (Exception e) {
        log.error("결제 실패", e);
        TransactionAspectSupport.currentTransactionStatus()
                .setRollbackOnly();  // 명시적 롤백 마킹
    }
}

// 또는: 예외를 재던지기 (더 명확)
@Transactional
public void processPayment(Payment payment) {
    try {
        paymentGateway.charge(payment);
    } catch (PaymentGatewayException e) {
        throw new PaymentFailedException("결제 실패", e);  // 재던지기
    }
    paymentRepository.save(payment);
}
```

## 함정 5: UnexpectedRollbackException — 내부 트랜잭션의 롤백 마킹

중첩된 트랜잭션에서 내부 메서드가 `setRollbackOnly()`를 호출하거나 예외를 받으면, 외부 메서드가 정상 반환해도 `UnexpectedRollbackException`이 발생합니다.

```java
@Service
public class OrderService {

    @Transactional
    public void placeOrder(Order order) {
        try {
            notificationService.notify(order);  // 내부에서 예외 롤백 마킹
        } catch (Exception e) {
            // 예외를 잡았는데도...
        }
        orderRepository.save(order);
        // commit() 시점에 UnexpectedRollbackException 발생!
        // 이미 트랜잭션이 rollback-only로 마킹되어 있음
    }

    @Transactional  // REQUIRED — 같은 트랜잭션 참여
    public void notify(Order order) {
        throw new RuntimeException("알림 실패");  // TX를 rollback-only로 마킹
    }
}
```

**해결책 — REQUIRES_NEW로 분리**

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void notify(Order order) {
    // 새 트랜잭션에서 실행 — 실패해도 외부 TX에 영향 없음
    smsClient.send(order);
}
```

또는 알림 실패가 주문 실패로 이어지지 않아야 한다면, 알림을 트랜잭션 커밋 후 이벤트로 발행하는 설계가 더 견고합니다.

## 함정 6: @Transactional과 스레드 경계

`TransactionSynchronizationManager`는 ThreadLocal을 사용합니다. `@Transactional` 메서드 안에서 새 스레드를 생성하면 트랜잭션 컨텍스트가 전달되지 않습니다.

```java
@Transactional
public void processAsync(List<Item> items) {
    items.parallelStream().forEach(item -> {
        // 새 스레드 — 트랜잭션 없음!
        itemRepository.save(item);  // 각각 독립적으로 커밋
    });
}
```

병렬 처리가 필요하면 트랜잭션 경계를 스레드 단위로 재설계하거나, `@Async` + `@Transactional`을 분리된 메서드에 적용해야 합니다.

## 함정 진단 체크리스트

| 증상 | 의심 원인 |
|---|---|
| `@Transactional`이 동작하지 않음 | 자기 호출, private 메서드 |
| 예외 후 데이터가 커밋됨 | 체크 예외, try-catch 삼킴 |
| `UnexpectedRollbackException` | 내부 TX rollback-only 마킹 후 외부 commit |
| 멀티스레드에서 TX 없음 | ThreadLocal 경계 초과 |
| 테스트 환경에서만 됨 | 실제 환경에서 프록시 미적용 (cglib 설정) |

## 정리

- `@Transactional`은 AOP 프록시 기반 — 동일 클래스 내 `this.method()` 호출 시 무효
- 체크 예외는 기본 커밋 — 롤백하려면 `rollbackFor` 명시 또는 런타임 예외로 감싸기
- `private` 메서드에 `@Transactional`은 CGLIB 한계로 무효
- try-catch로 예외를 삼키면 AOP가 감지 못해 커밋 — `setRollbackOnly()` 또는 재던지기
- 중첩 TX에서 내부 롤백 마킹 → `UnexpectedRollbackException` — `REQUIRES_NEW`로 분리 검토

---

**지난 글:** [Spring PlatformTransactionManager 완전 정복: 트랜잭션 추상화와 동기화](/posts/spring-platform-transaction-manager/)

**다음 글:** [Spring 트랜잭션 전파(Propagation) 완전 정복: REQUIRED부터 NESTED까지](/posts/spring-transaction-propagation/)

<br>
읽어주셔서 감사합니다. 😊
