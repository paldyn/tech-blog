---
title: "JPA/Hibernate가 생성하는 SQL 이해하기"
description: "JPA 영속성 컨텍스트의 엔티티 생명주기, Dirty Checking, 쓰기 지연, N+1 문제와 JOIN FETCH 해결, 배치 Insert 최적화까지 Hibernate가 실제로 발행하는 SQL을 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["JPA", "Hibernate", "N+1", "DirtyChecking", "쓰기지연", "영속성컨텍스트", "JPQL"]
featured: false
draft: false
---

[지난 글](/posts/orm-raw-sql-vs-orm/)에서 Raw SQL과 ORM의 트레이드오프를 살펴봤다. 이번에는 Java 진영에서 가장 많이 사용되는 Full ORM인 **JPA(Jakarta Persistence API)**와 그 구현체인 **Hibernate**가 실제로 어떤 SQL을 언제 발행하는지 집중적으로 알아본다. ORM 성능 문제의 대부분은 "어떤 SQL이 발행되는지 모르는 것"에서 비롯된다.

## 영속성 컨텍스트와 엔티티 생명주기

JPA의 핵심 개념은 **영속성 컨텍스트(Persistence Context)**다. `EntityManager`가 관리하는 1차 캐시이며, 여기에 등록된 엔티티를 **Managed(영속) 상태**라고 한다.

![JPA 엔티티 생명주기](/assets/posts/orm-jpa-hibernate-lifecycle.svg)

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();
tx.begin();

// 1. Transient → Managed
Order order = new Order();     // Transient: DB와 무관
em.persist(order);             // Managed: 영속성 컨텍스트 등록, INSERT 예약

// 2. Managed 상태에서 변경
order.setStatus("PAID");       // Dirty로 표시, SQL 없음

// 3. flush 시 SQL 발행
tx.commit();
// → INSERT + UPDATE 순차 발행

em.close();                    // Detached 상태
```

## Dirty Checking — 마법의 이면

Hibernate는 엔티티를 조회할 때 **스냅샷**을 내부에 저장한다. `flush` 시 스냅샷과 현재 상태를 비교해 변경된 필드만 UPDATE SQL을 생성한다. 별도의 `save()` 호출이 필요 없다.

```java
@Transactional
public void pay(Long orderId) {
    Order order = orderRepo.findById(orderId).orElseThrow();
    // SELECT * FROM orders WHERE id = ?  ← 조회 + 스냅샷 저장

    order.setStatus("PAID");
    // SQL 없음 — 변경 사항만 내부 기록

    // 메서드 종료 시 flush → commit
    // UPDATE orders SET status='PAID' WHERE id=?  ← 변경 필드만
}
```

**주의**: 기본적으로 Hibernate는 변경된 필드만이 아니라 모든 컬럼을 UPDATE하도록 SQL을 생성한다. `@DynamicUpdate`를 붙이면 실제 변경된 컬럼만 UPDATE SQL에 포함된다.

## 쓰기 지연 (Write-Behind)

`persist()`나 필드 변경이 일어나도 즉시 SQL이 발행되지 않는다. `flush`(또는 `commit`) 시점에 모아서 발행한다. 이를 **쓰기 지연**이라 한다.

```java
for (int i = 0; i < 1000; i++) {
    em.persist(new Order(...));  // 즉시 SQL 없음 — 큐에 쌓임
    if (i % 50 == 0) {
        em.flush();   // 50개씩 실제 INSERT 발행
        em.clear();   // 1차 캐시 초기화 (메모리 관리)
    }
}
```

배치 처리 시 `flush()` + `clear()` 주기를 조절해 메모리와 성능을 균형 있게 관리한다.

## N+1 문제

가장 흔한 JPA 성능 함정이다. 컬렉션 연관관계를 기본 LAZY 로딩으로 설정하면, 루프 안에서 접근할 때마다 SELECT가 추가로 발행된다.

```java
// N+1 발생: 주문 100건 조회 후 각 주문의 고객 접근
List<Order> orders = orderRepo.findAll();    // SELECT 1번 (100건)
for (Order o : orders) {
    System.out.println(o.getCustomer().getName()); // SELECT 100번 추가!
}
// 총 101번 쿼리 발행
```

**해결 1: JOIN FETCH**

```java
@Query("SELECT o FROM Order o JOIN FETCH o.customer WHERE o.status = :status")
List<Order> findWithCustomer(@Param("status") String status);
// 발행: SELECT o.*, c.* FROM orders o INNER JOIN customers c ON ...
// 1번으로 끝
```

**해결 2: @EntityGraph**

```java
@EntityGraph(attributePaths = {"customer", "items"})
List<Order> findByStatus(String status);
// LEFT OUTER JOIN으로 customer와 items 한 번에 페치
```

**해결 3: @BatchSize**

```java
@BatchSize(size = 100)
@OneToMany(mappedBy = "order")
private List<OrderItem> items;
// 접근 시 IN절로 묶어서 SELECT: WHERE order_id IN (1,2,...,100)
// N번 → N/100번으로 감소
```

![Hibernate SQL 패턴](/assets/posts/orm-jpa-hibernate-sql.svg)

## JPQL vs Criteria API vs 네이티브 쿼리

JPA는 세 가지 쿼리 방식을 제공한다.

```java
// 1. JPQL: 객체 중심 쿼리 언어
TypedQuery<Order> q = em.createQuery(
    "SELECT o FROM Order o WHERE o.amount > :min", Order.class);
q.setParameter("min", new BigDecimal("10000"));

// 2. Criteria API: 타입 안전, 동적 조건에 유리
CriteriaBuilder cb = em.getCriteriaBuilder();
CriteriaQuery<Order> cq = cb.createQuery(Order.class);
Root<Order> root = cq.from(Order.class);
cq.select(root).where(cb.gt(root.get("amount"), 10000));

// 3. 네이티브 쿼리: 복잡한 집계는 Raw SQL
@Query(value = "SELECT region, SUM(amount) FROM orders GROUP BY region",
       nativeQuery = true)
List<Object[]> getRegionSummary();
```

## SQL 로깅 설정

개발 중에는 Hibernate가 실제로 발행하는 SQL을 반드시 확인해야 한다.

```yaml
# application.yml
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql: TRACE   # 파라미터 값 확인

spring:
  jpa:
    properties:
      hibernate:
        format_sql: true          # SQL 들여쓰기
        generate_statistics: true # 통계 (쿼리 수 등)
```

## 정리

JPA/Hibernate를 효과적으로 사용하려면 "내가 작성한 코드가 어떤 SQL을 발행하는가"를 항상 의식해야 한다. Dirty Checking과 쓰기 지연은 편리하지만, N+1 문제처럼 눈에 안 보이는 성능 함정을 만들기도 한다. SQL 로깅을 켜두고 연관 관계 로딩 전략을 명확히 설계하는 것이 JPA 성능 최적화의 출발점이다.

---

**지난 글:** [Raw SQL vs ORM — 언제 무엇을 쓸까](/posts/orm-raw-sql-vs-orm/)

**다음 글:** [MyBatis 동적 SQL — 유연한 쿼리 빌드](/posts/orm-mybatis-dynamic-sql/)

<br>
읽어주셔서 감사합니다. 😊
