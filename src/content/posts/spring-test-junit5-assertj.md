---
title: "Spring 테스트 — JUnit 5 & AssertJ 완전 정복"
description: "JUnit 5 아키텍처(Jupiter/Vintage/Platform), 핵심 애노테이션, 파라미터 테스트, @Nested 구조화, AssertJ 유창한 단언, 예외 검증, SoftAssertions까지 Spring 테스트의 기초를 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "JUnit5", "AssertJ", "테스트", "@ParameterizedTest", "@Nested", "SoftAssertions", "TDD"]
featured: false
draft: false
---

[지난 글](/posts/spring-event-driven-architecture/)에서 이벤트 기반 아키텍처의 패턴과 구현을 살펴봤습니다. 잘 설계된 시스템도 테스트 없이는 신뢰할 수 없습니다. 이번에는 Spring 테스트의 기반이 되는 **JUnit 5**와 **AssertJ**를 처음부터 깊이 있게 다룹니다.

## JUnit 5 아키텍처

JUnit 5는 단일 JAR가 아니라 **세 모듈**의 조합입니다.

![JUnit 5 아키텍처 & AssertJ 체인](/assets/posts/spring-test-junit5-assertj-structure.svg)

| 모듈 | 역할 |
|---|---|
| **JUnit Platform** | 테스트 실행 인프라. IDE·Maven·Gradle 공통 런처 |
| **JUnit Jupiter** | JUnit 5의 새 프로그래밍 모델과 Extension API |
| **JUnit Vintage** | JUnit 3/4 테스트를 Platform에서 실행하는 엔진 |

`spring-boot-starter-test`가 이 세 모듈을 모두 포함합니다.

## 의존성

```xml
<!-- spring-boot-starter-test가 모두 포함 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-test</artifactId>
  <scope>test</scope>
</dependency>
```

`spring-boot-starter-test`는 JUnit 5, AssertJ, Mockito, Hamcrest, JSONassert, JsonPath를 함께 가져옵니다.

## 핵심 애노테이션

```java
class OrderServiceTest {

    OrderService orderService;

    @BeforeAll               // 클래스 인스턴스화 전 한 번 실행 (static)
    static void init() { /* DB 준비 등 */ }

    @BeforeEach              // 각 @Test 메서드 실행 전
    void setUp() {
        orderService = new OrderService(new FakeOrderRepository());
    }

    @Test
    @DisplayName("주문 생성 — 상태는 CREATED 이어야 한다")
    void createOrder() {
        Order order = orderService.place(new OrderRequest("item-1", 2));
        assertThat(order.getStatus()).isEqualTo("CREATED");
    }

    @Test
    @Disabled("재고 정책 변경 중 — JIRA-1234")
    void disabledTest() { }

    @AfterEach               // 각 @Test 메서드 실행 후
    void tearDown() { }

    @AfterAll                // 모든 테스트 완료 후 한 번 (static)
    static void cleanup() { }
}
```

## @Nested — 시나리오 구조화

```java
@DisplayName("OrderService")
class OrderServiceTest {

    @Nested
    @DisplayName("주문 생성 시")
    class WhenPlacing {

        @Test
        @DisplayName("재고 충분하면 성공")
        void success() { /* ... */ }

        @Test
        @DisplayName("재고 부족이면 StockException")
        void failsWhenOutOfStock() { /* ... */ }
    }

    @Nested
    @DisplayName("주문 취소 시")
    class WhenCancelling {

        @BeforeEach
        void placeFirst() { /* 취소 테스트는 먼저 주문이 있어야 함 */ }

        @Test
        @DisplayName("취소 후 환불 이벤트 발행")
        void refundIssued() { /* ... */ }
    }
}
```

`@Nested`는 중첩 클래스에 각자의 `@BeforeEach` / `@AfterEach`를 갖게 해줍니다. 테스트 결과가 **계층 구조**로 표시돼 어떤 시나리오가 실패했는지 한눈에 파악됩니다.

## @ParameterizedTest

같은 로직을 다양한 입력으로 반복 검증할 때 사용합니다.

![JUnit 5 + AssertJ 실전 코드](/assets/posts/spring-test-junit5-assertj-code.svg)

```java
@ParameterizedTest
@CsvSource({
    "CREATED,   true",
    "CANCELLED, false",
    "COMPLETED, true"
})
void isActive(String status, boolean expected) {
    assertThat(Order.isActive(status)).isEqualTo(expected);
}

// 열거형 소스
@ParameterizedTest
@EnumSource(value = OrderStatus.class, names = {"CREATED", "PROCESSING"})
void activeStatuses(OrderStatus status) {
    assertThat(status.isActive()).isTrue();
}

// 메서드 소스 — 복잡한 객체 파라미터
@ParameterizedTest
@MethodSource("provideOrders")
void validateOrder(Order order, boolean valid) {
    assertThat(orderService.isValid(order)).isEqualTo(valid);
}

static Stream<Arguments> provideOrders() {
    return Stream.of(
        Arguments.of(new Order(1L, null), false),
        Arguments.of(new Order(2L, "item"), true)
    );
}
```

## AssertJ — 유창한 단언

AssertJ는 `assertThat()`에서 시작해 체이닝으로 표현력 있는 단언을 작성합니다.

### 기본 단언

```java
// String
assertThat(result.getMessage())
    .isNotNull()
    .startsWith("Order")
    .contains("created")
    .hasSize(20);

// 숫자
assertThat(order.getAmount())
    .isPositive()
    .isGreaterThan(BigDecimal.ZERO)
    .isLessThan(new BigDecimal("100000"));

// Collection
assertThat(orders)
    .hasSize(3)
    .extracting(Order::getStatus)
    .containsExactlyInAnyOrder("CREATED", "PROCESSING", "COMPLETED");
```

### 예외 검증

```java
// assertThatThrownBy (가장 선호)
assertThatThrownBy(() -> orderService.find(-1L))
    .isInstanceOf(OrderNotFoundException.class)
    .hasMessageContaining("not found")
    .hasFieldOrPropertyWithValue("orderId", -1L);

// assertThatExceptionOfType (타입 명시)
assertThatExceptionOfType(OrderNotFoundException.class)
    .isThrownBy(() -> orderService.find(-1L))
    .withMessageContaining("not found");

// 예외 안 던짐 검증
assertThatNoException().isThrownBy(() -> orderService.find(1L));
```

### 객체 비교

```java
// usingRecursiveComparison — equals 불필요
assertThat(actual)
    .usingRecursiveComparison()
    .ignoringFields("id", "createdAt")  // 자동 생성 필드 제외
    .isEqualTo(expected);

// extracting — 특정 필드만 비교
assertThat(actual)
    .extracting("status", "amount")
    .containsExactly("CREATED", new BigDecimal("9900"));
```

### SoftAssertions — 모아서 보고

```java
@Test
void orderDetail() {
    Order order = orderService.find(1L);

    // 첫 번째 실패에서 멈추지 않고 모든 단언 평가
    SoftAssertions.assertSoftly(softly -> {
        softly.assertThat(order.getId()).isEqualTo(1L);
        softly.assertThat(order.getStatus()).isEqualTo("CREATED");
        softly.assertThat(order.getItems()).hasSize(2);
        softly.assertThat(order.getTotalAmount()).isPositive();
    });
}
```

실패한 단언이 여러 개일 때 첫 번째만 보여주는 일반 `assertThat`과 달리, `SoftAssertions`는 **모든 실패를 한 번에 리포트**합니다.

## 테스트 라이프사이클 인스턴스

```java
// JUnit 5 기본: 메서드마다 새 인스턴스 생성
@TestInstance(TestInstance.Lifecycle.PER_METHOD)  // 기본값

// 클래스 인스턴스 공유 — @BeforeAll/@AfterAll static 불필요
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SharedStateTest {

    Order sharedOrder;

    @BeforeAll
    void initShared() {  // static 불필요
        sharedOrder = new Order(1L, "item");
    }
}
```

## 조건부 실행

```java
@Test
@EnabledOnOs(OS.MAC)
void macOnly() { }

@Test
@EnabledIfEnvironmentVariable(named = "CI", matches = "true")
void ciOnly() { }

@Test
@EnabledIfSystemProperty(named = "spring.profiles.active", matches = "test")
void profileTest() { }
```

## 테스트 순서 제어

```java
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class OrderedTest {

    @Test @Order(1)
    void first() { }

    @Test @Order(2)
    void second() { }
}
```

단위 테스트는 가능한 한 **순서에 의존하지 않도록** 설계해야 합니다. `@Order`는 통합 테스트처럼 순서가 중요한 경우에만 사용하세요.

## 실전 단위 테스트 구조

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("OrderService 단위 테스트")
class OrderServiceUnitTest {

    @Mock OrderRepository orderRepo;
    @Mock StockService stockService;
    @InjectMocks OrderService orderService;

    @Nested
    @DisplayName("placeOrder()")
    class PlaceOrder {

        @Test
        @DisplayName("재고 있으면 주문 저장 후 CREATED 반환")
        void success() {
            // Given
            given(stockService.check("item-1", 2)).willReturn(true);
            given(orderRepo.save(any())).willAnswer(inv -> inv.getArgument(0));

            // When
            Order result = orderService.place(new OrderRequest("item-1", 2));

            // Then
            assertThat(result.getStatus()).isEqualTo("CREATED");
            then(orderRepo).should().save(any(Order.class));
        }
    }
}
```

Given-When-Then 구조와 `@Nested`를 조합하면 테스트 의도가 명확해지고 유지보수가 쉬워집니다.

---

**지난 글:** [이벤트 기반 아키텍처 — Spring으로 구현하는 EDA 패턴](/posts/spring-event-driven-architecture/)

**다음 글:** [Spring 테스트 — Mockito 완전 정복](/posts/spring-test-mockito/)

<br>
읽어주셔서 감사합니다. 😊
