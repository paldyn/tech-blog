---
title: "JPQL과 Native Query 완전 정복 — JPA 쿼리 언어 심층 가이드"
description: "JPA의 JPQL(Java Persistence Query Language)과 Native SQL Query를 완전히 이해합니다. JPQL의 문법과 특징, 엔티티 기반 쿼리 작성법, 프로젝션·JOIN FETCH·집계 함수, TypedQuery를 사용한 페이징, DTO 생성자 표현식, Native Query와의 차이를 코드 예제와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "JPQL", "NativeQuery", "TypedQuery", "Hibernate", "쿼리", "프로젝션"]
featured: false
draft: false
---

[지난 글](/posts/spring-data-jpa-repository/)에서 Spring Data JPA Repository 계층 구조와 쿼리 메서드를 살펴봤습니다. 이번에는 더 복잡한 쿼리가 필요할 때 사용하는 **JPQL**과 **Native SQL**을 깊이 다룹니다.

## JPQL이란

JPQL(Java Persistence Query Language)은 JPA가 제공하는 **객체 지향 쿼리 언어**입니다. SQL과 문법이 유사하지만, 테이블·컬럼 대신 **엔티티 클래스명**과 **필드명**을 사용합니다.

```java
// SQL: 테이블과 컬럼을 직접 참조
SELECT u.user_name, u.email FROM tbl_user u WHERE u.user_status = 'ACTIVE';

// JPQL: 엔티티 클래스명과 필드명을 참조
String jpql = "SELECT u FROM User u WHERE u.status = 'ACTIVE'";
List<User> users = em.createQuery(jpql, User.class).getResultList();
```

JPQL의 핵심 특징: Hibernate는 JPQL을 실행 시점에 각 DB에 맞는 SQL로 변환합니다. 따라서 **DB를 교체해도 쿼리를 수정할 필요가 없습니다** (이식성).

![JPQL vs SQL 핵심 차이](/assets/posts/spring-jpa-jpql-native-comparison.svg)

## TypedQuery — 타입 안전한 쿼리

`em.createQuery()`는 두 가지 방식으로 사용할 수 있습니다.

```java
@PersistenceContext
private EntityManager em;

// Query (타입 없음) — getResultList() 반환 타입이 List<Object>
Query query = em.createQuery("SELECT u FROM User u");

// TypedQuery (타입 지정) — 안전한 타입 처리 (권장)
TypedQuery<User> typedQuery =
        em.createQuery("SELECT u FROM User u", User.class);
List<User> users = typedQuery.getResultList();

// 단건 조회 — 결과가 없으면 NoResultException, 둘 이상이면 NonUniqueResultException
User user = em.createQuery("SELECT u FROM User u WHERE u.id = :id", User.class)
              .setParameter("id", 1L)
              .getSingleResult();
```

Spring Data JPA의 `@Query`를 사용하면 내부적으로 TypedQuery가 사용되므로, EntityManager를 직접 다루지 않아도 됩니다.

## 파라미터 바인딩

JPQL은 두 가지 방식의 파라미터 바인딩을 지원합니다.

```java
// 이름 기반 파라미터 (:name) — 권장
TypedQuery<User> q = em.createQuery(
        "SELECT u FROM User u WHERE u.name = :name AND u.age >= :minAge",
        User.class);
q.setParameter("name", "홍길동");
q.setParameter("minAge", 20);

// 위치 기반 파라미터 (?1, ?2) — 순서 실수 유발 가능, 비권장
TypedQuery<User> q2 = em.createQuery(
        "SELECT u FROM User u WHERE u.name = ?1 AND u.age >= ?2",
        User.class);
q2.setParameter(1, "홍길동");
q2.setParameter(2, 20);
```

이름 기반 파라미터를 사용하면 쿼리 문자열이 변경되어도 파라미터 순서에 영향을 받지 않습니다.

## 프로젝션 — 필요한 데이터만 조회

### 엔티티 프로젝션

가장 단순한 형태로, 엔티티 전체를 조회합니다. 반환된 엔티티는 영속성 컨텍스트에서 관리됩니다.

```java
List<User> users = em.createQuery("SELECT u FROM User u", User.class)
                     .getResultList();
```

### 스칼라 프로젝션

특정 필드만 조회합니다. 반환 타입이 `Object[]`여서 사용이 번거롭습니다.

```java
List<Object[]> results = em.createQuery(
        "SELECT u.name, u.email FROM User u").getResultList();
for (Object[] row : results) {
    String name = (String) row[0];
    String email = (String) row[1];
}
```

### DTO 생성자 표현식 (권장)

`new` 키워드로 DTO 생성자를 직접 호출합니다. 타입이 안전하고 패키지명을 포함해야 합니다.

```java
// DTO 클래스 (record 또는 class)
public record UserSummaryDto(String name, String email) {}

// DTO 생성자 표현식 — 패키지 전체 경로 필요
List<UserSummaryDto> result = em.createQuery(
        "SELECT new com.example.dto.UserSummaryDto(u.name, u.email) "
        + "FROM User u WHERE u.status = :status",
        UserSummaryDto.class)
        .setParameter("status", "ACTIVE")
        .getResultList();
```

Spring Data JPA의 `@Query`와 함께 사용할 때도 동일한 방식입니다.

## JOIN과 JOIN FETCH

![JPQL 주요 문법 패턴](/assets/posts/spring-jpa-jpql-native-syntax.svg)

### 일반 JOIN

연관 엔티티를 조건에는 사용하지만 함께 로딩하지 않습니다.

```java
// User만 조회하되, orders 조건으로 필터링
List<User> users = em.createQuery(
        "SELECT u FROM User u JOIN u.orders o WHERE o.amount > :amount",
        User.class)
        .setParameter("amount", 10000)
        .getResultList();
```

### JOIN FETCH — N+1 해결

연관 엔티티를 **한 번의 쿼리로 함께 로딩**합니다. 지연 로딩(LAZY)으로 설정된 연관관계도 즉시 로드합니다.

```java
// User와 orders를 한 번의 JOIN 쿼리로 모두 로딩
List<User> users = em.createQuery(
        "SELECT u FROM User u JOIN FETCH u.orders WHERE u.status = :status",
        User.class)
        .setParameter("status", "ACTIVE")
        .getResultList();
// → User 조회 후 orders 개별 조회(N+1) 없이 한 방에 처리
```

`JOIN FETCH`는 N+1 문제를 해결하는 가장 일반적인 방법입니다. 단, 컬렉션에 대한 `JOIN FETCH`는 페이징(`setFirstResult`/`setMaxResults`)과 함께 사용하면 경고가 발생합니다.

## 집계 함수와 GROUP BY

```java
// GROUP BY + HAVING
TypedQuery<Object[]> q = em.createQuery(
        "SELECT u.status, COUNT(u), AVG(u.age) "
        + "FROM User u "
        + "GROUP BY u.status "
        + "HAVING COUNT(u) > 10",
        Object[].class);

List<Object[]> stats = q.getResultList();
for (Object[] row : stats) {
    String status = (String) row[0];
    Long count    = (Long) row[1];
    Double avgAge = (Double) row[2];
}
```

## 페이징

JPQL은 DB에 독립적인 페이징을 지원합니다. `setFirstResult`(offset)와 `setMaxResults`(limit)를 사용합니다.

```java
int page = 0;   // 0-based
int size = 10;

List<User> users = em.createQuery(
        "SELECT u FROM User u ORDER BY u.createdAt DESC",
        User.class)
        .setFirstResult(page * size)   // OFFSET
        .setMaxResults(size)           // LIMIT
        .getResultList();
```

Spring Data JPA의 `Pageable`을 사용하면 이 과정이 자동화됩니다. 직접 `TypedQuery`를 사용할 때만 이 방식이 필요합니다.

## Native Query

JPQL로 해결하기 어려운 경우(DB 전용 함수, 힌트, 복잡한 통계 쿼리 등)에는 Native SQL을 사용합니다.

```java
// 순수 EntityManager 사용 시
List<Object[]> result = em.createNativeQuery(
        "SELECT u.id, u.user_name, COUNT(o.order_id) "
        + "FROM tbl_user u "
        + "LEFT JOIN tbl_order o ON u.id = o.user_id "
        + "GROUP BY u.id, u.user_name")
        .getResultList();

// Spring Data JPA @Query 사용 시 (편리)
@Query(value = "SELECT * FROM tbl_user WHERE user_status = :status "
             + "ORDER BY created_at DESC LIMIT :limit",
       nativeQuery = true)
List<User> findTopActiveUsers(
        @Param("status") String status,
        @Param("limit") int limit);
```

Native Query 결과를 엔티티로 자동 매핑하려면 결과 컬럼명이 엔티티의 `@Column(name=...)` 값과 일치해야 합니다. 불일치하면 `@SqlResultSetMapping`을 사용합니다.

## JPQL vs Native SQL 선택 기준

```java
// 1. 표준적인 비즈니스 쿼리 → JPQL
@Query("SELECT u FROM User u WHERE u.role = :role AND u.active = true")
List<User> findActiveByRole(@Param("role") String role);

// 2. 동적 쿼리 (조건 개수가 유동적) → QueryDSL (다음 글)
// String 연결로 동적 JPQL 작성은 오류 발생 쉬움

// 3. DB 전용 기능 필요 → Native SQL
@Query(value = "SELECT * FROM users USE INDEX(idx_created_at) "
             + "WHERE created_at > NOW() - INTERVAL :days DAY",
       nativeQuery = true)
List<User> findRecentUsers(@Param("days") int days);
```

## 정리

- JPQL은 **엔티티 클래스명**과 **필드명** 기반의 객체 지향 쿼리
- `TypedQuery<T>`를 사용하면 타입 안전하게 결과를 처리
- 파라미터 바인딩은 이름 기반 `:param` 권장
- DTO 조회: `new 패키지.ClassName(u.field1, u.field2)` 생성자 표현식
- `JOIN FETCH`: 지연 로딩 연관관계를 한 쿼리로 함께 로딩 → N+1 해결
- Native SQL: DB 전용 기능이 필요할 때만 사용 (`nativeQuery = true`)
- 복잡한 동적 쿼리는 QueryDSL로 처리하는 것이 실무 표준

---

**지난 글:** [Spring Data JPA Repository 완전 정복](/posts/spring-data-jpa-repository/)

**다음 글:** [QueryDSL 완전 정복](/posts/spring-jpa-querydsl/)

<br>
읽어주셔서 감사합니다. 😊
