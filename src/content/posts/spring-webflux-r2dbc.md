---
title: "R2DBC: 리액티브 관계형 DB 접근"
description: "블로킹 JDBC를 대체하는 R2DBC의 개념과 Spring Data R2DBC로 구현하는 엔티티 매핑, 리포지토리, 리액티브 트랜잭션, 커스텀 쿼리, 그리고 JPA와의 차이점을 실전 코드로 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["R2DBC", "Spring Data R2DBC", "리액티브 DB", "논블로킹 DB", "JDBC 대체", "ReactiveCrudRepository", "리액티브 트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/spring-webflux-webclient/)에서 외부 HTTP 호출을 위한 WebClient를 살펴봤다. 이번 글은 데이터베이스 접근 계층의 논블로킹화를 위한 **R2DBC(Reactive Relational Database Connectivity)**를 다룬다. WebFlux 스택에서 JDBC/JPA를 그대로 사용하면 이벤트 루프 스레드가 블로킹되어 성능이 무너진다. R2DBC는 이 문제를 해결하는 관계형 DB용 비동기 드라이버 스펙이다.

## R2DBC가 필요한 이유

Spring WebFlux 앱에서 블로킹 JDBC를 호출하면 어떤 일이 발생하는지 이해하는 것이 출발점이다. Netty 이벤트 루프는 소수의 스레드로 동작하므로, 그 중 하나가 DB 응답을 기다리며 블로킹되면 다른 모든 요청 처리가 지연된다.

```
// 이벤트 루프에서 JDBC 직접 호출 시 (절대 하면 안 됨)
Thread: event-loop-0 → DB 쿼리 발송 → 응답 대기(블로킹) → 이 스레드로 처리 불가
→ event-loop-1, 2 ... 도 동일한 상황 → 전체 처리량 붕괴
```

R2DBC는 JDBC와 동일한 관계형 DB를 대상으로 하되, 드라이버 수준부터 완전히 비동기·논블로킹으로 설계된 스펙이다.

![JDBC vs R2DBC 아키텍처](/assets/posts/spring-webflux-r2dbc-architecture.svg)

## 의존성 설정

Spring Boot에서 R2DBC를 사용하려면 R2DBC 스타터와 드라이버를 추가한다.

```xml
<!-- build.gradle (Kotlin DSL) -->
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-r2dbc")
    implementation("io.asyncer:r2dbc-mysql:1.1.0")    // MySQL
    // 혹은 PostgreSQL:
    // implementation("org.postgresql:r2dbc-postgresql:1.0.4.RELEASE")

    runtimeOnly("com.h2database:h2")                 // 테스트용
    implementation("io.r2dbc:r2dbc-h2")              // H2 R2DBC 드라이버
}
```

```yaml
# application.yml
spring:
  r2dbc:
    url: r2dbc:mysql://localhost:3306/mydb
    username: user
    password: secret
    pool:
      initial-size: 5
      max-size: 20
  sql:
    init:
      mode: always          # schema.sql, data.sql 자동 실행
```

## 엔티티와 리포지토리

R2DBC 엔티티는 JPA 엔티티와 유사하지만 몇 가지 중요한 차이가 있다. 연관 관계 매핑(`@OneToMany` 등)이 없고, 지연 로딩이 없으며, 레코드(record) 클래스도 사용 가능하다.

![Spring Data R2DBC 핵심 코드](/assets/posts/spring-webflux-r2dbc-code.svg)

리포지토리는 `ReactiveCrudRepository` 또는 `ReactiveSortingRepository`를 상속한다. 메서드 이름 기반 쿼리 생성도 지원한다.

```java
public interface OrderRepository extends ReactiveCrudRepository<Order, Long> {

    // 메서드 이름 → 쿼리 자동 생성
    Flux<Order> findByUserId(Long userId);
    Flux<Order> findByStatusAndCreatedAtAfter(OrderStatus status, LocalDateTime after);
    Mono<Long> countByStatus(OrderStatus status);

    // 커스텀 쿼리
    @Query("SELECT * FROM orders WHERE user_id = :userId ORDER BY created_at DESC LIMIT :limit")
    Flux<Order> findRecentByUserId(@Param("userId") Long userId, @Param("limit") int limit);

    // 수정 쿼리
    @Modifying
    @Query("UPDATE orders SET status = :status WHERE id = :id")
    Mono<Integer> updateStatus(@Param("id") Long id, @Param("status") OrderStatus status);
}
```

## 리액티브 트랜잭션

Spring Data R2DBC는 `@Transactional`을 지원한다. 단, 리액티브 컨텍스트에서 동작해야 하므로 Reactor 컨텍스트가 전파되는 상태여야 한다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepo;
    private final InventoryRepository inventoryRepo;

    @Transactional
    public Mono<Order> placeOrder(PlaceOrderRequest req) {
        return inventoryRepo.findById(req.productId())
            .switchIfEmpty(Mono.error(new ProductNotFoundException()))
            .flatMap(inventory -> {
                if (inventory.stock() < req.quantity()) {
                    return Mono.error(new InsufficientStockException());
                }
                // 재고 차감 + 주문 생성이 하나의 트랜잭션으로 처리
                return inventoryRepo.save(inventory.deduct(req.quantity()))
                    .then(orderRepo.save(Order.from(req)));
            });
    }
}
```

리액티브 트랜잭션은 Reactor 컨텍스트를 통해 전파되므로, `flatMap` 체인 안에서도 같은 트랜잭션이 유지된다. `then()`은 선행 연산 결과를 버리고 다음 Mono를 실행할 때 사용한다.

## DatabaseClient: 하위 수준 접근

`Spring Data R2DBC`의 `DatabaseClient`는 `JdbcTemplate`에 해당하는 하위 수준 API다.

```java
@Component
@RequiredArgsConstructor
public class UserDao {

    private final DatabaseClient db;

    public Flux<User> searchByNameLike(String pattern) {
        return db.sql("SELECT * FROM users WHERE username LIKE :pattern")
            .bind("pattern", "%" + pattern + "%")
            .map((row, meta) -> new User(
                row.get("id", Long.class),
                row.get("user_name", String.class),
                row.get("email", String.class)
            ))
            .all();
    }

    public Mono<Long> insertAndGetId(User user) {
        return db.sql("INSERT INTO users (user_name, email) VALUES (:name, :email)")
            .bind("name", user.username())
            .bind("email", user.email())
            .filter(s -> s.returnGeneratedValues("id"))
            .map(row -> row.get("id", Long.class))
            .one();
    }
}
```

## JPA와의 비교

R2DBC와 JPA/Hibernate를 선택할 때 알아두어야 할 핵심 차이점이 있다.

| 항목 | JPA (JDBC) | Spring Data R2DBC |
|------|-----------|------------------|
| I/O 모델 | 블로킹 | 논블로킹 |
| 연관 관계 | `@OneToMany`, Lazy 로딩 지원 | 연관 관계 없음 (직접 쿼리) |
| 1차 캐시 | 있음 (영속성 컨텍스트) | 없음 |
| 지연 로딩 | 지원 | 없음 (Fetch 전략 수동) |
| 복잡한 쿼리 | JPQL, QueryDSL | `@Query`, DatabaseClient |
| 트랜잭션 | `@Transactional` (스레드 로컬) | `@Transactional` (리액티브 컨텍스트) |

연관 관계가 없다는 것은 단점처럼 보이지만, N+1 문제가 원천적으로 없다는 장점이기도 하다. 조인이 필요한 경우 `@Query`로 직접 SQL을 작성한다.

```java
// 조인 쿼리 예: 주문 + 사용자 정보 함께 조회
@Query("""
    SELECT o.id, o.total_amount, u.username
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.status = :status
    """)
Flux<OrderSummary> findWithUserByStatus(@Param("status") OrderStatus status);
```

## 테스트

R2DBC 리포지토리는 `@DataR2dbcTest`로 슬라이스 테스트할 수 있다.

```java
@DataR2dbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserRepositoryTest {

    @Autowired
    UserRepository userRepository;

    @Test
    void findByEmail_returnsMatchingUsers() {
        User user = new User(null, "alice", "alice@example.com");

        StepVerifier.create(
            userRepository.save(user)
                .thenMany(userRepository.findByEmail("alice@example.com"))
        )
        .assertNext(u -> {
            assertThat(u.username()).isEqualTo("alice");
            assertThat(u.id()).isNotNull();
        })
        .verifyComplete();
    }
}
```

WebFlux 앱에서 완전한 논블로킹 스택을 구성하려면 WebClient(외부 HTTP) + R2DBC(관계형 DB) + Spring Security Reactive(보안)를 함께 사용한다. 다음 글에서는 WebFlux의 또 다른 특성인 함수형 라우팅을 살펴본다.

---

**지난 글:** [WebClient: 비동기 HTTP 클라이언트 완전 가이드](/posts/spring-webflux-webclient/)

**다음 글:** [함수형 엔드포인트: RouterFunction과 HandlerFunction](/posts/spring-webflux-functional-routing/)

<br>
읽어주셔서 감사합니다. 😊
