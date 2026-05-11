---
title: "JPA N+1 문제 완전 정복 — 원인과 해결 전략"
description: "JPA N+1 문제가 무엇인지, 왜 발생하는지, 어떻게 해결하는지 완전히 이해합니다. LAZY 로딩과 컬렉션 순회가 결합될 때 발생하는 N+1 패턴, fetch join·@EntityGraph·@BatchSize 세 가지 해결책의 원리와 선택 기준, 페이징 시 주의사항, 쿼리 로그로 N+1을 탐지하는 방법을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "N+1", "fetchJoin", "EntityGraph", "BatchSize", "LAZY", "Hibernate", "성능최적화", "쿼리최적화"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-fetch-strategy/)에서 EAGER·LAZY 페치 전략을 다루며 LAZY를 기본으로 쓸 것을 권장했습니다. 그런데 LAZY 로딩을 잘못 사용하면 **N+1 문제**라는 심각한 성능 함정에 빠집니다. N+1은 JPA 성능 문제 원인 1위로 꼽히며, 원인을 모르면 운영 환경에서 수백 배의 쿼리 폭발을 경험할 수 있습니다.

## N+1 문제란

1건의 쿼리로 N개의 결과를 가져온 뒤, 각 결과마다 1번씩 추가 쿼리가 실행되어 총 **1 + N번** 쿼리가 발생하는 현상입니다.

예를 들어 회원 100명을 조회한 뒤 각 회원의 주문 목록을 출력하면, 회원 조회 1번 + 주문 조회 100번 = 101번 쿼리가 실행됩니다.

![N+1 문제 발생 원인](/assets/posts/spring-jpa-n-plus-one-problem.svg)

## N+1 발생 패턴

### 패턴 1: LAZY 컬렉션 순회

가장 흔한 패턴입니다.

```java
// Member.orders @OneToMany(LAZY) 가정
@Transactional
public void printOrderCounts() {
    List<Member> members = memberRepository.findAll();
    // SQL 1번: SELECT * FROM member

    for (Member member : members) {
        int count = member.getOrders().size();
        // 여기서 member마다 SQL 1번
        // SQL: SELECT * FROM orders WHERE member_id = ?
        System.out.println(member.getName() + ": " + count);
    }
    // member 100명 → 총 101번 SQL
}
```

### 패턴 2: EAGER도 안전하지 않다

EAGER 설정이라도 `findAll()`처럼 JPQL로 조회하면 N+1이 발생합니다. JPA가 JPQL을 그대로 실행한 뒤 연관 관계를 별도 쿼리로 채우기 때문입니다.

```java
@Entity
public class Order {
    // EAGER지만 JPQL findAll()이면 N+1 동일하게 발생
    @ManyToOne(fetch = FetchType.EAGER)
    private Member member;
}
```

EAGER를 사용한다고 N+1이 해결되지 않습니다. 오히려 더 예측하기 어려워집니다.

## 해결책 1 — JPQL fetch join (권장)

JPQL에서 `JOIN FETCH`를 사용하면 한 번의 JOIN 쿼리로 연관 데이터를 함께 로딩합니다.

```java
// Repository
@Query("SELECT m FROM Member m JOIN FETCH m.orders")
List<Member> findAllWithOrders();

// 생성 SQL
// SELECT m.*, o.* FROM member m
// INNER JOIN orders o ON m.id = o.member_id
```

여러 연관 관계를 함께 로딩할 때:

```java
@Query("""
    SELECT DISTINCT o
    FROM Order o
    JOIN FETCH o.member
    JOIN FETCH o.delivery
    """)
List<Order> findAllWithMemberAndDelivery();
// DISTINCT: 컬렉션 조인 시 중복 제거 필요
```

### fetch join 시 페이징 주의

컬렉션(1:N)에 fetch join을 쓰면서 동시에 페이징(`LIMIT/OFFSET`)을 적용하면 Hibernate가 **모든 데이터를 메모리에 올려서 페이징**합니다. 이는 `HHH90003004` 경고와 함께 OutOfMemoryError 위험이 있습니다.

```java
// ⚠ 위험: 컬렉션 fetch join + 페이징
@Query("SELECT m FROM Member m JOIN FETCH m.orders")
Page<Member> findAllWithOrders(Pageable pageable);
// 경고: HHH90003004 — applying in-memory pagination
```

**페이징 + 컬렉션 로딩** 조합에서는 `@BatchSize` 또는 `default_batch_fetch_size`를 사용합니다.

## 해결책 2 — @EntityGraph

Spring Data JPA에서 JPQL 없이 fetch join 효과를 냅니다.

```java
public interface MemberRepository extends JpaRepository<Member, Long> {

    // 기본 findAll에 orders 즉시 로딩 추가
    @EntityGraph(attributePaths = {"orders"})
    @Override
    List<Member> findAll();

    // 메서드 쿼리와 함께 사용
    @EntityGraph(attributePaths = {"orders", "orders.items"})
    List<Member> findByName(String name);
}
```

`@EntityGraph`는 내부적으로 `LEFT OUTER JOIN FETCH`를 생성합니다. `JOIN FETCH`(INNER JOIN)와 달리 연관 데이터가 없는 행도 포함됩니다.

```java
// 생성 SQL
// SELECT DISTINCT m.*, o.*
// FROM member m
// LEFT OUTER JOIN orders o ON m.id = o.member_id
```

## 해결책 3 — @BatchSize

컬렉션 LAZY 로딩 시 `IN (?, ?, …)` 쿼리로 묶어서 실행합니다. N+1을 완전히 제거하지는 않지만 1 + N번에서 **1 + (N/size)번** 수준으로 줄입니다.

```java
@Entity
public class Member {

    @BatchSize(size = 100)
    @OneToMany(mappedBy = "member")
    private List<Order> orders = new ArrayList<>();
}
```

전역 설정으로 모든 컬렉션에 적용하는 방법이 더 편합니다.

```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 100
```

이 설정만으로 `@OneToMany`, `@ManyToMany` 컬렉션의 N+1을 대폭 줄일 수 있습니다.

![N+1 해결 전략 비교](/assets/posts/spring-jpa-n-plus-one-solution.svg)

## 해결책 4 — DTO 직접 조회

연관 엔티티가 필요 없고 특정 필드만 필요하다면 DTO로 바로 조회하면 불필요한 로딩 자체를 없앨 수 있습니다.

```java
@Query("""
    SELECT new com.example.dto.MemberOrderCountDto(
        m.id, m.name, COUNT(o.id))
    FROM Member m
    LEFT JOIN m.orders o
    GROUP BY m.id, m.name
    """)
List<MemberOrderCountDto> findMemberOrderCounts();
// 단 1번의 집계 쿼리로 필요한 데이터만 조회
```

DTO 조회는 영속성 컨텍스트 관리 대상이 아니므로 변경 감지가 필요 없는 읽기 전용 조회에 적합합니다.

## N+1 탐지 방법

### 방법 1: Hibernate SQL 로그

```yaml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql.BasicBinder: TRACE
```

### 방법 2: p6spy 라이브러리

실제 파라미터 값까지 출력하고 실행 시간도 측정합니다. 개발 환경에서 N+1 감지에 효과적입니다.

```groovy
// build.gradle
implementation 'com.github.gavlyukovskiy:p6spy-spring-boot-starter:1.9.0'
```

### 방법 3: Spring Boot Actuator + Metrics

`spring-boot-starter-actuator` + Micrometer로 SQL 실행 횟수를 모니터링합니다. 운영 환경에서 비정상적인 쿼리 증가를 감지할 수 있습니다.

## 해결책 선택 기준 정리

```java
// ① 일반 단건/다건 조회 → fetch join (JPQL) 또는 @EntityGraph
// ② 페이징 + To-Many 컬렉션 → @BatchSize (default_batch_fetch_size)
// ③ 집계/읽기 전용 → DTO 직접 조회

// 실무 조합 권장
// - application.yml: default_batch_fetch_size: 100  (기본값 설정)
// - 성능이 중요한 API: @Query + JOIN FETCH  (정밀 제어)
// - 단순 목록: @EntityGraph  (코드 간결)
```

## 정리

- N+1은 **1 + N번 SQL**이 실행되는 성능 문제 — LAZY + 컬렉션 순회에서 발생
- EAGER 설정으로도 JPQL 조회 시 N+1 동일하게 발생
- **fetch join**: 가장 강력하지만 컬렉션 + 페이징 동시 사용 시 메모리 페이징 위험
- **@EntityGraph**: fetch join의 어노테이션 버전, LEFT OUTER JOIN 사용
- **@BatchSize** / `default_batch_fetch_size`: 페이징과 호환되는 컬렉션 최적화
- 읽기 전용 조회는 **DTO 직접 조회**로 불필요한 엔티티 로딩 자체를 제거

---

**지난 글:** [JPA 페치 전략 완전 정복 — EAGER vs LAZY](/posts/spring-jpa-fetch-strategy/)

**다음 글:** [JPA Cascade와 orphanRemoval 완전 정복](/posts/spring-jpa-cascade-orphan/)

<br>
읽어주셔서 감사합니다. 😊
