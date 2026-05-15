---
title: "JPA 페치 전략 완전 정복 — EAGER vs LAZY"
description: "JPA의 EAGER·LAZY 페치 전략 차이를 완전히 이해합니다. 어노테이션별 기본값, 실무에서 LAZY를 선택해야 하는 이유, 프록시 객체의 동작 원리, LazyInitializationException 발생 원인과 해결법, fetch join·@EntityGraph·@BatchSize를 활용한 최적화 패턴을 코드 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "FetchType", "LAZY", "EAGER", "프록시", "LazyInitializationException", "fetchJoin", "EntityGraph", "BatchSize", "Hibernate"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-relations/)에서 연관 관계 매핑과 연관관계 주인 개념을 다뤘습니다. 이번에는 그 연장선에서 **연관 엔티티를 언제 로딩할지** 결정하는 페치 전략을 다룹니다. `FetchType.EAGER`와 `FetchType.LAZY`의 차이는 JPA 성능 최적화에서 가장 자주 등장하는 주제이며, 잘못 설정하면 수십 배의 쿼리 낭비로 이어질 수 있습니다.

## 페치 전략이란

JPA에서 연관 관계를 조회할 때 두 가지 방식이 있습니다.

- **EAGER(즉시 로딩)**: 엔티티를 조회하는 순간 연관 데이터를 함께 가져옵니다. JOIN이나 추가 SELECT를 즉시 실행합니다.
- **LAZY(지연 로딩)**: 연관 필드를 실제로 사용(접근)하는 시점에 SELECT를 실행합니다. 그 전까지 **프록시 객체**로 자리를 대신합니다.

![JPA 페치 전략 — EAGER vs LAZY](/assets/posts/spring-jpa-fetch-strategy-eager-lazy.svg)

어노테이션마다 기본값이 다릅니다.

| 어노테이션 | 기본 페치 | 실무 권장 |
|---|---|---|
| `@ManyToOne` | **EAGER** | LAZY |
| `@OneToOne` | **EAGER** | LAZY |
| `@OneToMany` | LAZY | LAZY (유지) |
| `@ManyToMany` | LAZY | LAZY (유지) |

`@ManyToOne`과 `@OneToOne`의 기본값이 EAGER인 것이 함정입니다. 이 두 어노테이션은 반드시 `fetch = FetchType.LAZY`를 명시해야 합니다.

## 프록시 객체의 동작 원리

LAZY 로딩에서 JPA는 연관 필드를 **프록시 객체**로 초기화합니다. 프록시는 실제 엔티티를 상속한 가짜 객체로, 처음 필드에 접근하는 순간 SELECT를 실행해 실제 데이터를 채웁니다.

```java
@Transactional
public void example() {
    Order order = orderRepository.findById(1L).orElseThrow();
    // SQL: SELECT * FROM orders WHERE id = 1
    // order.member는 아직 프록시 — DB 조회 없음

    String memberName = order.getMember().getName();
    // 여기서 처음 접근 → SQL: SELECT * FROM member WHERE id = ?
}
```

프록시는 `instanceof` 비교 시 주의가 필요합니다.

```java
// 엔티티 타입 비교는 instanceof 대신 Hibernate.getClass() 사용
if (Hibernate.getClass(order.getMember()) == Member.class) {
    // 초기화 여부와 무관하게 실제 타입 반환
}
```

## LazyInitializationException

LAZY 로딩의 가장 흔한 오류입니다. **트랜잭션이 종료된 후** 프록시를 초기화하려 하면 발생합니다.

```java
// 문제 코드: 트랜잭션 없이 LAZY 접근
public Order findOrder(Long id) {
    return orderRepository.findById(id).orElseThrow();
    // 트랜잭션 종료
}

// 호출하는 곳에서
Order order = findOrder(1L);
String name = order.getMember().getName();
// LazyInitializationException!
// 영속성 컨텍스트가 이미 닫혔기 때문
```

**해결 방법 1 — @Transactional 범위 확장**

```java
@Transactional
public OrderDto findOrderWithMember(Long id) {
    Order order = orderRepository.findById(id).orElseThrow();
    // 트랜잭션 내에서 프록시 초기화
    order.getMember().getName(); // SELECT 실행
    return toDto(order);
}
```

**해결 방법 2 — fetch join**

가장 권장하는 방법입니다. 필요한 연관 데이터를 한 번의 JOIN 쿼리로 가져옵니다.

```java
@Query("SELECT o FROM Order o JOIN FETCH o.member WHERE o.id = :id")
Optional<Order> findByIdWithMember(@Param("id") Long id);
```

**해결 방법 3 — @EntityGraph**

```java
@EntityGraph(attributePaths = {"member", "items"})
@Query("SELECT o FROM Order o WHERE o.id = :id")
Optional<Order> findByIdWithGraph(@Param("id") Long id);
```

## 실무 페치 전략 설정

```java
@Entity
public class Order {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 기본 EAGER → 반드시 LAZY로 변경
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    // @OneToOne도 기본 EAGER → LAZY 명시
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_id")
    private Delivery delivery;

    // @OneToMany는 기본 LAZY — fetch 속성 생략 가능
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
}
```

## fetch join vs @EntityGraph 선택 기준

두 방식 모두 LAZY 연관을 한 번의 쿼리로 로딩합니다. 차이점은 아래와 같습니다.

| | fetch join (JPQL) | @EntityGraph |
|---|---|---|
| 작성 위치 | `@Query` 내 JPQL | 메서드 어노테이션 |
| 복잡한 조건 | 자유롭게 가능 | 제한적 |
| 동일 경로 재사용 | 매번 작성 필요 | 여러 메서드에 선언 |
| 가독성 | JPQL 이해 필요 | 직관적 |

실무에서는 fetch join을 주로 사용하고, 간단한 조회에서 코드 중복을 줄이고 싶을 때 @EntityGraph를 선택합니다.

## @BatchSize로 컬렉션 최적화

`@OneToMany` 컬렉션을 LAZY로 두고 여러 부모를 조회하면 N+1 문제가 생깁니다. fetch join을 쓸 수 없는 상황(페이징 등)에서는 `@BatchSize`가 대안입니다.

```java
@Entity
public class Member {

    @BatchSize(size = 100)
    @OneToMany(mappedBy = "member")
    private List<Order> orders = new ArrayList<>();
}
```

`@BatchSize(size = 100)`을 설정하면 Hibernate가 `IN (?, ?, ...)` 형태로 최대 100개씩 묶어서 조회합니다. 전역 설정은 `application.yml`에서 할 수 있습니다.

```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 100
```

![페치 전략 코드 패턴](/assets/posts/spring-jpa-fetch-strategy-code.svg)

## open-in-view 설정

Spring Boot의 `spring.jpa.open-in-view` 기본값은 `true`입니다. 이 설정은 HTTP 요청 전체에 걸쳐 영속성 컨텍스트를 열어두어, 뷰 레이어에서도 LAZY 로딩을 허용합니다. 편리하지만 **트랜잭션 밖에서 DB 쿼리가 실행**되어 커넥션 점유 시간이 길어지는 단점이 있습니다.

```yaml
# 실무 권장: false로 설정
spring:
  jpa:
    open-in-view: false
```

`false`로 설정하면 서비스 계층의 `@Transactional` 범위를 명확히 관리해야 합니다. 대신 커넥션 풀을 더 효율적으로 사용할 수 있습니다.

## 정리

- `@ManyToOne`, `@OneToOne`의 기본 페치는 `EAGER` — 반드시 `FetchType.LAZY`로 변경
- LAZY는 프록시 객체를 사용 — 트랜잭션 밖에서 접근 시 `LazyInitializationException`
- 연관 데이터가 필요하면 **fetch join** 또는 **@EntityGraph**로 한 번에 로딩
- 컬렉션 다건 조회 시 `@BatchSize` 또는 전역 `default_batch_fetch_size` 설정
- `open-in-view=false`로 트랜잭션 범위를 명확히 관리

---

**지난 글:** [Spring JPA 연관 관계 매핑 완전 정복](/posts/spring-jpa-relations/)

**다음 글:** [JPA N+1 문제 완전 정복 — 원인과 해결 전략](/posts/spring-jpa-n-plus-one/)

<br>
읽어주셔서 감사합니다. 😊
