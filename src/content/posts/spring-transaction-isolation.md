---
title: "Spring 트랜잭션 격리 수준(Isolation) 완전 정복: Dirty Read부터 Serializable까지"
description: "Spring @Transactional의 isolation 속성 4가지를 동시성 문제(Dirty Read, Non-Repeatable Read, Phantom Read)와 함께 완전히 이해합니다. MySQL InnoDB MVCC 동작 방식, 격리 수준과 DB 기본값의 관계, 실전에서 격리 수준을 잘못 선택할 때 생기는 버그와 해결책을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "트랜잭션격리", "Isolation", "DirtyRead", "PhantomRead", "NonRepeatableRead", "MVCC", "SERIALIZABLE", "REPEATABLE_READ", "READ_COMMITTED", "@Transactional"]
featured: false
draft: false
---

[지난 글](/posts/spring-transaction-propagation/)에서 트랜잭션 전파 속성을 살펴봤습니다. 이 글에서는 또 다른 핵심 속성인 **격리 수준(Isolation Level)** 을 다룹니다. 격리 수준은 동시에 여러 트랜잭션이 실행될 때 서로 어디까지 격리할지 결정합니다. 너무 낮으면 데이터 불일치가 발생하고, 너무 높으면 성능이 저하됩니다.

## 동시성 문제 3가지

격리 수준을 이해하려면 먼저 트랜잭션 동시 실행 시 발생할 수 있는 세 가지 문제를 알아야 합니다.

### Dirty Read

커밋되지 않은 다른 트랜잭션의 변경을 읽는 현상입니다.

```
TX-A: UPDATE account SET balance = 0 WHERE id = 1  (미커밋)
TX-B: SELECT balance FROM account WHERE id = 1  → 0  (오염된 데이터 읽음)
TX-A: ROLLBACK  → balance 원복
TX-B: 이미 잘못된 0을 바탕으로 비즈니스 로직 수행
```

### Non-Repeatable Read

같은 트랜잭션 안에서 같은 쿼리를 두 번 실행했을 때 결과가 달라지는 현상입니다.

```
TX-A T1: SELECT stock FROM product WHERE id=1  → 100
TX-B   : UPDATE product SET stock=50 WHERE id=1; COMMIT
TX-A T2: SELECT stock FROM product WHERE id=1  → 50 (달라짐!)
```

### Phantom Read

같은 트랜잭션에서 같은 범위 쿼리를 실행했을 때 없던 행이 나타나거나 있던 행이 사라지는 현상입니다.

```
TX-A T1: SELECT COUNT(*) FROM order WHERE user_id=1  → 5
TX-B   : INSERT INTO order (user_id, ...) VALUES (1, ...); COMMIT
TX-A T2: SELECT COUNT(*) FROM order WHERE user_id=1  → 6 (유령 행!)
```

## 격리 수준 4단계

![트랜잭션 격리 수준과 동시성 문제](/assets/posts/spring-transaction-isolation-levels.svg)

### READ_UNCOMMITTED

가장 낮은 격리 수준으로, 세 가지 문제가 모두 발생할 수 있습니다. 실무에서는 거의 사용하지 않습니다.

```java
@Transactional(isolation = Isolation.READ_UNCOMMITTED)
public long countApproximateOrders() {
    // 집계 대시보드 등 약간의 부정확성이 허용되는 경우에만
    return orderRepository.count();
}
```

### READ_COMMITTED

Dirty Read를 방지합니다. 커밋된 데이터만 읽습니다. PostgreSQL·Oracle의 기본값입니다. Non-Repeatable Read와 Phantom Read는 발생할 수 있습니다.

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public OrderSummary getOrderSummary(Long orderId) {
    // 커밋된 데이터만 읽음 — 다른 TX가 커밋하면 다음 조회에 반영
    Order order = orderRepository.findById(orderId).orElseThrow();
    return buildSummary(order);
}
```

대부분의 웹 애플리케이션에 적합한 수준입니다. Spring은 `DEFAULT`를 지정하면 DB 드라이버의 기본 격리 수준을 따르는데, PostgreSQL이라면 결국 `READ_COMMITTED`가 됩니다.

### REPEATABLE_READ

Non-Repeatable Read를 추가로 방지합니다. 같은 TX 안에서 동일 행을 다시 읽으면 항상 같은 결과를 반환합니다. MySQL InnoDB의 기본값입니다.

![Non-Repeatable Read 발생 시나리오](/assets/posts/spring-transaction-isolation-scenario.svg)

MySQL InnoDB는 **MVCC(Multi-Version Concurrency Control)** 를 사용해 Phantom Read도 대부분 방지합니다. 첫 번째 `SELECT` 시점의 스냅샷을 기록하고, 이후 읽기에서 그 스냅샷을 사용합니다.

```java
@Transactional(isolation = Isolation.REPEATABLE_READ)
public void validateAndDeductStock(Long productId, int qty) {
    // T1 시점 재고 확인
    int stock = productRepository.findStockById(productId);

    // 다른 TX가 이 사이에 재고를 변경해도
    // T2 에서도 같은 재고 값을 읽음 (스냅샷)
    if (stock < qty) {
        throw new InsufficientStockException();
    }

    // 단, 실제 차감은 SELECT FOR UPDATE 로 잠금 필요
    productRepository.deductStock(productId, qty);
}
```

### SERIALIZABLE

가장 강한 격리 수준으로, 트랜잭션을 순차 실행한 것과 동일한 결과를 보장합니다. 범위 락(Range Lock)을 걸어 Phantom Read를 완전히 차단합니다. 성능이 크게 저하될 수 있어 금융 결제·재무 처리 등 정합성이 최우선인 경우에만 사용합니다.

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
public void transferMoney(Long fromId, Long toId, BigDecimal amount) {
    Account from = accountRepository.findById(fromId).orElseThrow();
    Account to = accountRepository.findById(toId).orElseThrow();

    if (from.getBalance().compareTo(amount) < 0) {
        throw new InsufficientBalanceException();
    }
    from.deduct(amount);
    to.add(amount);
    // 어떤 동시 TX도 이 결과에 영향 줄 수 없음
}
```

## Spring에서 격리 수준 지정하기

```java
// 방법 1: @Transactional isolation 속성
@Transactional(isolation = Isolation.READ_COMMITTED)
public List<Order> findRecentOrders(Long userId) { ... }

// 방법 2: DEFAULT — DB 드라이버 기본값 사용 (권장)
@Transactional(isolation = Isolation.DEFAULT)
public void processOrder(Order order) { ... }

// 방법 3: TransactionTemplate (프로그래밍 방식)
public void manualControl() {
    DefaultTransactionDefinition def = new DefaultTransactionDefinition();
    def.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    TransactionStatus status = txManager.getTransaction(def);
    try {
        // 비즈니스 로직
        txManager.commit(status);
    } catch (Exception e) {
        txManager.rollback(status);
    }
}
```

## 격리 수준과 DB 기본값

Spring의 `Isolation.DEFAULT`는 JDBC 드라이버에 격리 수준을 위임합니다.

| DB | 기본 격리 수준 | 비고 |
|---|---|---|
| MySQL InnoDB | REPEATABLE_READ | MVCC로 Phantom 대부분 방지 |
| PostgreSQL | READ_COMMITTED | 높은 동시성 |
| Oracle | READ_COMMITTED | - |
| H2 | READ_COMMITTED | 테스트 기본 |
| SQL Server | READ_COMMITTED | 기본 |

대부분의 경우 `Isolation.DEFAULT`로 DB의 기본값을 사용하되, 특별히 강한 정합성이 필요한 메서드에만 명시적으로 높은 격리 수준을 지정하는 것이 좋습니다.

## SELECT FOR UPDATE — 비관적 잠금

격리 수준과 함께 자주 사용하는 패턴이 비관적 잠금입니다. `REPEATABLE_READ`이어도 MVCC 스냅샷 읽기는 **현재 잠금을 고려하지 않으므로**, 실제 충돌을 막으려면 `SELECT FOR UPDATE`로 행 잠금을 획득해야 합니다.

```java
// JPA Repository 비관적 잠금
public interface ProductRepository extends JpaRepository<Product, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);
}

// 서비스에서 사용
@Transactional
public void deductStock(Long productId, int qty) {
    // SELECT ... FOR UPDATE — 다른 TX는 잠금 해제까지 대기
    Product product = productRepository.findByIdForUpdate(productId)
            .orElseThrow();
    product.deduct(qty);
}
```

## 실전 격리 수준 선택 가이드

```
격리 수준 선택 결정 트리

1. 약간의 불일치 허용? (통계 대시보드 등)
   → READ_UNCOMMITTED (거의 안 씀) 또는 READ_COMMITTED

2. 일반 웹 API (조회, 주문, 결제)
   → DEFAULT (DB 기본값) — 대부분의 경우

3. 같은 TX에서 같은 데이터를 여러 번 읽어야 함?
   → REPEATABLE_READ

4. 범위 쿼리 결과가 TX 내내 불변이어야 함?
   → SERIALIZABLE (성능 저하 감수)

5. 재고·좌석·쿠폰 등 선착순 차감?
   → REPEATABLE_READ + SELECT FOR UPDATE
```

## 정리

- 격리 수준은 낮을수록 성능 좋고, 높을수록 정합성 강함
- `READ_COMMITTED` — Dirty Read 방지, 웹 앱 기본으로 적합
- `REPEATABLE_READ` — Non-Repeatable Read 방지, MySQL InnoDB 기본값
- `SERIALIZABLE` — 완전 직렬화, 금융 결제에 사용
- MySQL InnoDB는 MVCC로 `REPEATABLE_READ`에서도 Phantom Read 대부분 방지
- 동시 차감 로직은 격리 수준과 무관하게 `SELECT FOR UPDATE` 필요

---

**지난 글:** [Spring 트랜잭션 전파(Propagation) 완전 정복: REQUIRED부터 NESTED까지](/posts/spring-transaction-propagation/)

**다음 글:** [Spring 선언적 vs 프로그래밍 방식 트랜잭션: @Transactional과 TransactionTemplate 완전 비교](/posts/spring-transaction-declarative-vs-programmatic/)

<br>
읽어주셔서 감사합니다. 😊
