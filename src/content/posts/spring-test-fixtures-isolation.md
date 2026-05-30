---
title: "Spring 테스트 — 픽스처 격리 전략 완전 정복"
description: "@Transactional/@Rollback, @Sql/@SqlConfig, @DirtiesContext, Testcontainers를 조합해 테스트 픽스처 격리를 설계하는 방법을 실전 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "테스트", "@Rollback", "@Sql", "@DirtiesContext", "픽스처격리", "테스트격리"]
featured: false
draft: false
---

[지난 글](/posts/spring-test-testcontainers/)에서 Testcontainers로 실제 Docker DB를 테스트에 활용하는 방법을 살펴봤다. Testcontainers는 완벽한 환경 재현을 제공하지만 실행 속도가 느리다. 모든 테스트에 적용하기보다는 **테스트 유형에 맞는 격리 전략을 선택**하는 것이 중요하다. 이번 글에서는 Spring이 제공하는 네 가지 픽스처 격리 도구를 비교하고, 실전에서 어떻게 조합하는지 알아본다.

## 왜 픽스처 격리가 중요한가

테스트가 DB 상태를 오염시키면 다른 테스트가 실패한다. 특히 `@SpringBootTest`로 통합 테스트를 작성할 때 `INSERT`된 데이터가 다음 테스트로 넘어가면 순서에 따라 결과가 달라진다. **픽스처(Fixture)**란 테스트가 실행되기 전에 준비해야 하는 데이터나 상태를 말하며, 격리란 각 테스트가 이 픽스처를 독립적으로 다루는 것을 의미한다.

![테스트 격리 전략 비교](/assets/posts/spring-test-fixtures-isolation-strategies.svg)

## ① @Transactional + @Rollback — 가장 빠른 격리

Spring 테스트에서 가장 쉬운 격리 방법은 테스트 클래스에 `@Transactional`을 붙이는 것이다. 각 테스트 메서드가 트랜잭션 안에서 실행되고, **테스트 완료 후 자동으로 롤백**된다.

```java
@DataJpaTest  // 자동으로 @Transactional 포함
class UserRepositoryTest {

    @Autowired
    UserRepository userRepository;

    @Test
    void 유저_저장_후_조회() {
        // given
        User user = new User("alice@example.com", "Alice");
        userRepository.save(user);

        // when
        Optional<User> found = userRepository.findByEmail("alice@example.com");

        // then
        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("Alice");
    }
    // 테스트 종료 후 INSERT 자동 롤백 — DB 오염 없음
}
```

`@DataJpaTest`는 기본적으로 `@Transactional`을 포함한다. `@SpringBootTest`에서 수동으로 롤백 동작을 제어하려면:

```java
@SpringBootTest
@Transactional
class OrderServiceTest {

    @Test
    @Rollback(false)  // 이 테스트만 롤백 안 함 (데이터 확인용)
    void 주문_생성_데이터_확인() {
        // ...
    }

    @Test  // 기본: 롤백됨
    void 주문_생성_비즈니스_로직() {
        // ...
    }
}
```

**주의사항**: `@Transactional` 격리는 JPA Lazy Loading 테스트 시 예상치 못한 동작을 일으킬 수 있다. 트랜잭션이 테스트 메서드 전체를 감싸므로 실제 서비스 코드의 트랜잭션 경계와 다를 수 있다.

## ② @Sql — 세밀한 픽스처 제어

`@Sql`은 테스트 전후에 SQL 스크립트를 실행해 픽스처를 제어한다. 복잡한 초기 데이터 세팅이 필요하거나, 특정 상태를 정확히 재현해야 할 때 유용하다.

```java
@SpringBootTest
@Sql(
    scripts = {"/sql/schema.sql", "/sql/fixture-orders.sql"},
    executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD
)
@Sql(
    scripts = "/sql/cleanup.sql",
    executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD
)
class OrderIntegrationTest {

    @Test
    void 주문_취소_시_재고_복구() {
        // given: fixture-orders.sql에서 주문 데이터 삽입됨
        // ...
    }
}
```

SQL 스크립트는 `src/test/resources/sql/` 디렉터리에 위치한다.

```sql
-- src/test/resources/sql/fixture-orders.sql
INSERT INTO users (id, email, name) VALUES (1, 'alice@test.com', 'Alice');
INSERT INTO products (id, name, stock) VALUES (1, 'Widget', 100);
INSERT INTO orders (id, user_id, product_id, quantity) VALUES (1, 1, 1, 5);
```

`@SqlConfig`로 스크립트 실행 설정을 세밀하게 조정할 수 있다.

```java
@Sql(
    scripts = "/sql/fixture.sql",
    config = @SqlConfig(
        encoding = "UTF-8",
        transactionMode = ISOLATED,   // 별도 트랜잭션에서 실행
        errorMode = FAIL_ON_ERROR
    )
)
```

![테스트 픽스처 격리 패턴 코드](/assets/posts/spring-test-fixtures-isolation-code.svg)

## ③ @DirtiesContext — 컨텍스트 재생성 (최후 수단)

`@DirtiesContext`는 테스트 실행 후 Spring ApplicationContext를 파괴하고 다음 테스트를 위해 새로 생성한다. 컨텍스트 재사용이 테스트 간 간섭을 일으킬 때 사용한다.

```java
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class StatefulServiceTest {

    @Test
    void 싱글톤_빈_상태_변경() {
        // 이 테스트가 ApplicationContext의 싱글톤 상태를 변경
        // → 다음 테스트를 위해 컨텍스트 재생성
    }
}
```

`@DirtiesContext`는 강력하지만 **매우 느리다**. 컨텍스트를 새로 생성하는 데 수 초가 걸리기 때문에, 여러 테스트에 적용하면 전체 테스트 실행 시간이 크게 늘어난다. 다음 모드 중 필요한 최소 범위를 선택한다.

| classMode | 설명 |
|---|---|
| `BEFORE_CLASS` | 클래스 시작 전 재생성 |
| `AFTER_CLASS` | 클래스 완료 후 재생성 (기본값) |
| `BEFORE_EACH_TEST_METHOD` | 각 메서드 시작 전 |
| `AFTER_EACH_TEST_METHOD` | 각 메서드 완료 후 |

## ④ 실전 권장 조합

계층별로 다른 격리 전략을 조합하면 속도와 격리 품질을 균형 있게 맞출 수 있다.

```
단위 테스트 (빠름, 격리 필요 없음)
  → @ExtendWith(MockitoExtension.class)
  → Spring 컨텍스트 없음, 순수 Mock

Repository 테스트 (H2 인메모리)
  → @DataJpaTest
  → @Transactional (자동 롤백) 활용

Service 통합 테스트 (실제 DB)
  → @SpringBootTest + Testcontainers
  → @Sql로 픽스처 주입 + AFTER_EACH cleanup

Controller 테스트
  → @WebMvcTest + MockMvc
  → Service 계층은 @MockBean
```

```java
// 권장: 계층별 테스트 슬라이스 활용
@WebMvcTest(UserController.class)
class UserControllerTest {
    @MockBean UserService userService;  // Service는 Mock

    @Test
    void 유저_목록_조회() throws Exception {
        given(userService.findAll()).willReturn(List.of(new UserDto("Alice")));

        mockMvc.perform(get("/api/users"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$[0].name").value("Alice"));
    }
}
```

테스트 피라미드 원칙을 지키면 된다. 단위 테스트가 가장 많고, Repository 테스트가 그 다음, 통합 테스트가 가장 적게 유지한다. `@DirtiesContext`는 정말 불가피한 경우에만 사용한다.

---

**지난 글:** [Spring 테스트 — Testcontainers로 실제 DB 테스트 완전 정복](/posts/spring-test-testcontainers/)

**다음 글:** [Spring Boot Actuator — 운영 모니터링 엔드포인트 완전 정복](/posts/spring-actuator-endpoints/)

<br>
읽어주셔서 감사합니다. 😊
