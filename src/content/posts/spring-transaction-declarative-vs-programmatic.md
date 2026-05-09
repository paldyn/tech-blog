---
title: "Spring 선언적 vs 프로그래밍 방식 트랜잭션: @Transactional과 TransactionTemplate 완전 비교"
description: "Spring 트랜잭션 관리의 두 가지 방법인 선언적(@Transactional AOP)과 프로그래밍 방식(TransactionTemplate, PlatformTransactionManager)을 원리부터 실전 선택 기준까지 완전히 비교합니다. 각 방식의 장단점, 자기 호출 함정 우회, 람다·루프·조건부 트랜잭션, 테스트 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "선언적트랜잭션", "프로그래밍방식트랜잭션", "@Transactional", "TransactionTemplate", "PlatformTransactionManager", "AOP프록시", "트랜잭션관리"]
featured: false
draft: false
---

[지난 글](/posts/spring-transaction-isolation/)에서 격리 수준을 살펴봤습니다. 지금까지 `@Transactional`을 당연하게 사용해 왔지만, Spring은 트랜잭션을 관리하는 방법을 두 가지 제공합니다. **선언적 방식**(`@Transactional` AOP)과 **프로그래밍 방식**(`TransactionTemplate`, `PlatformTransactionManager`)입니다. 이 글에서는 두 방식의 내부 원리와 적합한 사용 사례를 비교합니다.

## 선언적 트랜잭션 — @Transactional

`@Transactional`은 Spring AOP 프록시가 메서드 호출을 가로채어 트랜잭션 경계를 자동으로 관리합니다.

```java
@Service
@Transactional(readOnly = true)  // 클래스 레벨 기본값
public class ProductService {

    private final ProductRepository productRepository;

    // 읽기: 클래스 레벨 readOnly=true 상속
    public Product findById(Long id) {
        return productRepository.findById(id).orElseThrow();
    }

    @Transactional  // 쓰기: readOnly=false 오버라이드
    public Product save(Product product) {
        return productRepository.save(product);
    }

    @Transactional(
        propagation = Propagation.REQUIRES_NEW,
        isolation   = Isolation.READ_COMMITTED,
        timeout     = 30,
        rollbackFor = Exception.class
    )
    public void complexOperation(Product product) {
        // 세밀한 속성 조합
    }
}
```

### 동작 원리

Spring은 `@Transactional`이 붙은 빈을 CGLIB 또는 JDK Dynamic Proxy로 감쌉니다. 외부 호출 시 프록시가 `PlatformTransactionManager.getTransaction()`을 호출하고, 메서드 실행 후 결과에 따라 `commit()` 또는 `rollback()`을 호출합니다.

```java
// Spring AOP가 내부적으로 처리하는 로직 (의사 코드)
TransactionStatus status = txManager.getTransaction(txDefinition);
try {
    Object result = method.invoke(target, args);  // 실제 메서드
    txManager.commit(status);
    return result;
} catch (RuntimeException | Error ex) {
    txManager.rollback(status);
    throw ex;
}
```

### 선언적 방식의 한계

- **자기 호출(Self-Invocation)**: 같은 클래스 내에서 `this.method()` 호출 시 프록시를 우회해 `@Transactional`이 무시됩니다.
- **메서드 단위 경계**: 메서드 중간에 트랜잭션을 시작하거나, 루프 안에서 건별로 커밋하는 것이 불가능합니다.
- **조건부 트랜잭션**: "어떤 조건일 때만 TX를 시작"하는 로직을 표현하기 어렵습니다.

## 프로그래밍 방식 — TransactionTemplate

`TransactionTemplate`은 `execute()` 메서드를 통해 명시적으로 트랜잭션 경계를 지정합니다.

![TransactionTemplate 내부 동작 흐름](/assets/posts/spring-transaction-declarative-vs-programmatic-template.svg)

```java
@Service
public class BatchOrderService {

    private final TransactionTemplate txTemplate;
    private final OrderRepository orderRepository;

    public BatchOrderService(PlatformTransactionManager txManager,
                             OrderRepository orderRepository) {
        this.txTemplate = new TransactionTemplate(txManager);
        this.txTemplate.setIsolationLevel(
                TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.orderRepository = orderRepository;
    }

    // 건별 커밋 — @Transactional로는 불가
    public void processBatch(List<Order> orders) {
        for (Order order : orders) {
            txTemplate.execute(status -> {
                orderRepository.save(order);
                return null;  // void 반환 시 null
            });
            // 각 반복마다 별도 커밋
        }
    }
}
```

반환값이 필요한 경우 `execute()`의 반환값을 사용합니다.

```java
public Long createAndGetId(OrderRequest req) {
    return txTemplate.execute(status -> {
        Order order = orderRepository.save(new Order(req));
        return order.getId();  // TX 안에서 생성된 ID 반환
    });
}
```

수동 롤백이 필요하면 `TransactionStatus.setRollbackOnly()`를 호출합니다.

```java
public void createWithConditionalRollback(Order order) {
    txTemplate.execute(status -> {
        orderRepository.save(order);

        if (!externalValidator.validate(order)) {
            status.setRollbackOnly();  // 예외 없이 롤백 강제
        }
        return null;
    });
}
```

## 프로그래밍 방식 — PlatformTransactionManager 직접 사용

가장 저수준의 방식으로, `TransactionTemplate`이 제공하지 못하는 세밀한 제어가 필요할 때 사용합니다.

```java
@Service
public class LowLevelTxService {

    private final PlatformTransactionManager txManager;

    public void customControl() {
        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(
                TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        def.setIsolationLevel(
                TransactionDefinition.ISOLATION_SERIALIZABLE);
        def.setTimeout(10);

        TransactionStatus status = txManager.getTransaction(def);
        try {
            // 비즈니스 로직
            performWork();
            txManager.commit(status);
        } catch (Exception e) {
            txManager.rollback(status);
            throw e;
        }
    }
}
```

이 방식은 코드가 장황하고 오류 가능성이 높으므로, 대부분의 경우 `TransactionTemplate`을 권장합니다.

## 두 방식 비교

![선언적 vs 프로그래밍 방식 트랜잭션 비교](/assets/posts/spring-transaction-declarative-vs-programmatic-compare.svg)

## 자기 호출 문제를 프로그래밍 방식으로 해결

`@Transactional`의 자기 호출 문제는 `TransactionTemplate`으로 우회할 수 있습니다.

```java
@Service
public class OrderService {

    private final TransactionTemplate txTemplate;

    // 자기 호출이 필요한 경우
    public void createAndNotify(Order order) {
        // 외부에서 호출하든, 내부에서 호출하든 TX 경계 명확
        Long orderId = txTemplate.execute(status -> {
            orderRepository.save(order);
            return order.getId();
        });
        // 알림은 TX 외부에서
        notificationService.sendConfirmation(orderId);
    }
}
```

## 언제 어느 방식을 선택할까

```
선택 기준

@Transactional 선택:
  - 대부분의 서비스 메서드 (80~90% 케이스)
  - readOnly=true 읽기 전용 최적화
  - 명확한 메서드 경계로 TX 범위 표현 가능

TransactionTemplate 선택:
  - 루프 안에서 건별 커밋 (배치 처리)
  - 조건부 트랜잭션 ("if A then TX")
  - 자기 호출 우회
  - 람다·콜백 기반 API 개발 시
  - Spring 컨텍스트 없는 환경 (테스트 유틸, CLI)

PlatformTransactionManager 직접 선택:
  - TransactionTemplate 이상의 세밀한 제어가 필요한 경우
  - 프레임워크 내부 코드 작성 시
```

## 테스트에서의 트랜잭션

`@Transactional`이 붙은 테스트 메서드는 테스트 종료 후 자동으로 롤백됩니다. 프로그래밍 방식에서는 이 편의를 사용하려면 `TestTransaction` 유틸을 활용합니다.

```java
@SpringBootTest
@Transactional  // 테스트 완료 후 자동 롤백
class OrderServiceTest {

    @Autowired
    private OrderService orderService;

    @Test
    void createOrder_shouldSaveToDb() {
        Order order = orderService.createOrder(new OrderRequest("item1", 2));
        assertThat(order.getId()).isNotNull();
        // 테스트 종료 후 롤백 → DB 상태 복원
    }
}
```

## 정리

- **선언적 `@Transactional`** — 대부분의 비즈니스 메서드에 적합. AOP 프록시 기반으로 자기 호출·`private` 메서드에는 동작 안 함
- **`TransactionTemplate`** — 루프·조건부·자기 호출 등 선언적으로 표현하기 어려운 경우에 사용
- **`PlatformTransactionManager` 직접** — 프레임워크 수준의 세밀한 제어가 필요할 때만
- 두 방식을 혼용하는 것도 가능하며, 동일한 `PlatformTransactionManager` 위에서 동작하므로 TX 전파는 일관성 있게 작동함

---

**지난 글:** [Spring 트랜잭션 격리 수준(Isolation) 완전 정복: Dirty Read부터 Serializable까지](/posts/spring-transaction-isolation/)

**다음 글:** [Spring JPA와 ORM 개념 정복: 패러다임 불일치와 JPA가 해결하는 방법](/posts/spring-jpa-orm-intro/)

<br>
읽어주셔서 감사합니다. 😊
