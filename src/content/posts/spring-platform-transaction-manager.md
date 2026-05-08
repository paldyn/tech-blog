---
title: "Spring PlatformTransactionManager 완전 정복: 트랜잭션 추상화와 동기화"
description: "Spring이 JDBC·JPA·JTA에 관계없이 동일한 @Transactional을 사용할 수 있는 이유인 PlatformTransactionManager 인터페이스, TransactionSynchronizationManager의 ThreadLocal 바인딩, TransactionTemplate을 통한 프로그래밍 방식 트랜잭션, 그리고 Spring Boot 자동 구성 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "PlatformTransactionManager", "트랜잭션추상화", "TransactionSynchronizationManager", "TransactionTemplate", "DataSourceTransactionManager", "JpaTransactionManager", "JtaTransactionManager", "@Transactional"]
featured: false
draft: false
---

[지난 글](/posts/spring-connection-pool-hikari/)에서 HikariCP가 Connection을 풀에서 빌려주고 반납받는 방식을 살펴봤습니다. 이번에는 그 Connection에 트랜잭션 경계를 만들고 커밋·롤백을 결정하는 **Spring 트랜잭션 추상화**의 핵심 구조를 알아봅니다. JDBC, JPA, JTA 어느 기술을 써도 `@Transactional` 하나로 동일하게 동작하는 이유가 여기 있습니다.

## 트랜잭션 관리의 두 가지 방식

순수 JDBC로 트랜잭션을 직접 관리하면 아래처럼 됩니다.

```java
// 순수 JDBC 트랜잭션 — 벤더 의존적
Connection conn = dataSource.getConnection();
conn.setAutoCommit(false);
try {
    // ... 비즈니스 로직
    conn.commit();
} catch (Exception e) {
    conn.rollback();
    throw e;
} finally {
    conn.close();
}
```

JPA를 쓰면 `EntityTransaction`으로 같은 작업을 합니다. 두 기술을 혼용하거나 나중에 교체하려면 트랜잭션 관리 코드 전체를 바꿔야 합니다. Spring은 이 문제를 **PlatformTransactionManager 인터페이스**로 해결합니다.

## PlatformTransactionManager 인터페이스

```java
public interface PlatformTransactionManager extends TransactionManager {

    TransactionStatus getTransaction(TransactionDefinition definition)
            throws TransactionException;

    void commit(TransactionStatus status) throws TransactionException;

    void rollback(TransactionStatus status) throws TransactionException;
}
```

세 메서드가 전부입니다. JDBC용, JPA용, JTA용 구현체는 모두 이 인터페이스를 구현합니다. 비즈니스 코드와 `@Transactional` AOP는 구현체를 몰라도 됩니다.

![PlatformTransactionManager 추상화 계층](/assets/posts/spring-platform-transaction-manager-arch.svg)

`TransactionDefinition`에는 전파 수준(propagation), 격리 수준(isolation), 타임아웃, 읽기 전용 여부가 담겨 있습니다. `TransactionStatus`는 현재 트랜잭션 상태를 나타내며 롤백 전용 마킹 등에 사용합니다.

## 구현체와 Spring Boot 자동 구성

| 구현체 | 사용 기술 |
|---|---|
| `DataSourceTransactionManager` | JDBC, JdbcTemplate, MyBatis |
| `JpaTransactionManager` | JPA (Hibernate 포함) |
| `JtaTransactionManager` | 분산 트랜잭션 (JTA) |
| `ReactiveTransactionManager` | WebFlux, R2DBC |

Spring Boot는 클래스패스에 있는 의존성을 보고 자동으로 적절한 구현체를 빈으로 등록합니다.

```java
// JPA가 있으면 JpaTransactionManager가 자동 등록됨
// JDBC만 있으면 DataSourceTransactionManager
// 직접 오버라이드:
@Bean
public PlatformTransactionManager transactionManager(
        DataSource dataSource) {
    return new DataSourceTransactionManager(dataSource);
}
```

JPA와 JDBC를 함께 쓸 때 주의할 점: `JpaTransactionManager`는 JDBC 트랜잭션 동기화도 지원합니다. `JpaTransactionManager` 하나로 JPA와 JdbcTemplate을 같은 트랜잭션 안에서 사용할 수 있습니다.

## TransactionSynchronizationManager — ThreadLocal 바인딩

`@Transactional` 메서드가 시작되면 `TransactionInterceptor`가 `PlatformTransactionManager.getTransaction()`을 호출합니다. 트랜잭션 매니저는 Connection을 획득한 뒤 **`TransactionSynchronizationManager`의 ThreadLocal**에 바인딩합니다.

```java
// 내부 동작 (의사 코드)
// getTransaction() 호출 시:
Connection conn = dataSource.getConnection();
conn.setAutoCommit(false);
TransactionSynchronizationManager.bindResource(dataSource, conn);

// 이후 같은 스레드의 JdbcTemplate.query() 호출 시:
Connection bound = TransactionSynchronizationManager
        .getResource(dataSource);  // 이미 바인딩된 Connection 반환
// → 새 Connection 생성 없이 동일 트랜잭션 사용

// commit() 또는 rollback() 후:
TransactionSynchronizationManager.unbindResource(dataSource);
conn.close();  // 커넥션 풀로 반납
```

ThreadLocal 바인딩 덕분에 `@Transactional` 서비스에서 호출하는 여러 리포지터리가 명시적으로 Connection을 전달하지 않아도 같은 트랜잭션에 참여합니다.

## @Transactional 내부 동작 흐름

```java
// 선언적 방식 — 가장 많이 쓰는 방식
@Service
public class OrderService {

    @Transactional                    // AOP 프록시가 트랜잭션 경계 생성
    public void placeOrder(Order order) {
        orderRepository.save(order);      // 같은 Connection 사용
        inventoryRepository.decrease(order.getItems()); // 같은 Connection
        // 메서드 정상 종료 → commit()
        // RuntimeException 발생 → rollback()
    }
}
```

AOP 프록시는 `@Transactional` 속성을 `TransactionDefinition`으로 변환해 `getTransaction()`에 전달합니다. 메서드가 성공적으로 반환되면 `commit()`, `RuntimeException`이 전파되면 `rollback()`을 호출합니다.

## 프로그래밍 방식: TransactionTemplate

루프 안에서 건별로 트랜잭션을 끊거나, 조건에 따라 롤백 여부를 결정해야 할 때는 `TransactionTemplate`이 더 유연합니다.

![프로그래밍 방식 트랜잭션 — TransactionTemplate](/assets/posts/spring-platform-transaction-manager-sync.svg)

```java
@Configuration
public class TxConfig {

    @Bean
    public TransactionTemplate transactionTemplate(
            PlatformTransactionManager txManager) {
        TransactionTemplate template = new TransactionTemplate(txManager);
        template.setIsolationLevel(
                TransactionDefinition.ISOLATION_READ_COMMITTED);
        template.setTimeout(10);  // 초
        return template;
    }
}
```

```java
// 배치 처리 — 건별 독립 트랜잭션
public void processBatch(List<Item> items) {
    for (Item item : items) {
        transactionTemplate.executeWithoutResult(status -> {
            try {
                process(item);
            } catch (RecoverableException e) {
                status.setRollbackOnly();
                log.warn("item {} skipped: {}", item.getId(), e.getMessage());
            }
        });
        // 이 루프 반복마다 독립적인 TX 커밋 or 롤백
    }
}
```

`TransactionTemplate`은 내부적으로 `PlatformTransactionManager`를 직접 호출하므로 `@Transactional`과 동일한 트랜잭션 의미론을 가집니다.

## TransactionDefinition — 트랜잭션 속성 직접 설정

```java
// DefaultTransactionDefinition으로 속성 직접 지정
DefaultTransactionDefinition def = new DefaultTransactionDefinition();
def.setPropagationBehavior(
        TransactionDefinition.PROPAGATION_REQUIRES_NEW);
def.setIsolationLevel(
        TransactionDefinition.ISOLATION_REPEATABLE_READ);
def.setTimeout(30);
def.setReadOnly(false);

TransactionStatus status = txManager.getTransaction(def);
try {
    // ... 작업
    txManager.commit(status);
} catch (Exception e) {
    txManager.rollback(status);
    throw e;
}
```

`@Transactional`의 모든 속성은 `TransactionDefinition` 상수로 매핑됩니다. 선언적 방식이 불가능한 인프라 레이어 코드에서 사용합니다.

## 읽기 전용 트랜잭션 최적화

```java
@Transactional(readOnly = true)
public List<ProductDto> findAll() {
    return productRepository.findAll().stream()
            .map(ProductDto::from)
            .toList();
}
```

`readOnly = true`는 `TransactionDefinition`의 `isReadOnly()`를 `true`로 설정합니다. JPA 환경에서는 **Hibernate의 1차 캐시 더티 체킹을 비활성화**해 메모리와 CPU를 절약합니다. JDBC 드라이버·DB에 따라 추가 최적화(예: MySQL 레플리카 라우팅)도 가능합니다.

## 정리

- `PlatformTransactionManager` 인터페이스 덕분에 JDBC·JPA·JTA 교체 시 비즈니스 코드 변경 불필요
- `TransactionSynchronizationManager`가 ThreadLocal로 Connection을 바인딩해 같은 스레드의 모든 DB 호출이 동일 트랜잭션에 참여
- Spring Boot는 클래스패스 기반으로 적절한 구현체를 자동 등록
- 선언적 `@Transactional`이 기본; 루프 내 개별 TX·조건부 롤백은 `TransactionTemplate` 활용
- `readOnly = true`로 JPA 더티 체킹 비활성화 → 조회 전용 메서드 성능 향상

---

**지난 글:** [Spring HikariCP 커넥션 풀 완전 정복: 원리·설정·모니터링](/posts/spring-connection-pool-hikari/)

**다음 글:** [Spring @Transactional 함정 완전 정복: 자기 호출·롤백 규칙·체크 예외](/posts/spring-transactional-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
