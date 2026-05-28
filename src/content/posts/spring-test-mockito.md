---
title: "Spring 테스트 — Mockito 완전 정복"
description: "Mockito의 테스트 대역 유형, @Mock/@Spy/@InjectMocks 애노테이션, BDDMockito 스타일, ArgumentCaptor, 예외 스터빙, 검증 횟수 제어까지 Spring 단위 테스트의 핵심을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Mockito", "테스트", "@Mock", "@Spy", "BDDMockito", "ArgumentCaptor", "단위 테스트"]
featured: false
draft: false
---

[지난 글](/posts/spring-test-junit5-assertj/)에서 JUnit 5와 AssertJ의 기반을 다졌습니다. 단위 테스트를 작성하다 보면 실제 DB나 외부 API 없이 협력 객체를 대체할 방법이 필요합니다. 이번에는 Spring 테스트에서 가장 많이 쓰이는 **Mockito** 라이브러리를 깊이 있게 살펴봅니다.

## 테스트 대역(Test Double)이란?

테스트 대역은 실제 의존 객체 대신 테스트에서 사용하는 대체 객체입니다. 종류에 따라 역할이 다릅니다.

![Mockito 핵심 개념 — Mock·Stub·Verify](/assets/posts/spring-test-mockito-concepts.svg)

| 유형 | 목적 | Mockito 해당 |
|---|---|---|
| **Dummy** | 매개변수 채우기용, 실제로 사용 안 함 | `mock()` 후 사용 안 함 |
| **Stub** | 정해진 값 반환 | `given().willReturn()` |
| **Mock** | 호출 여부·횟수 검증 | `then().should()` |
| **Spy** | 실제 구현 + 일부 스터빙 | `@Spy` |
| **Fake** | 실제로 동작하는 간단한 구현체 | 직접 작성 (인메모리 Repository) |

## 기본 설정

```java
// JUnit 5 + Mockito 연동
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    OrderRepository orderRepo;      // 인터페이스/클래스 목 생성

    @Mock
    StockService stockService;

    @InjectMocks
    OrderService orderService;      // @Mock 필드를 생성자/필드 주입

    // 또는 프로그래매틱 생성
    OrderRepository repo = Mockito.mock(OrderRepository.class);
}
```

`@InjectMocks`는 `@Mock`이 붙은 필드를 생성자 주입 → 세터 주입 → 필드 주입 순서로 시도합니다.

## BDDMockito — Given-When-Then 스타일

```java
import static org.mockito.BDDMockito.*;

@Test
void findOrderSuccess() {
    // Given — 스터빙
    Order order = new Order(1L, "CREATED");
    given(orderRepo.findById(1L))
        .willReturn(Optional.of(order));

    // When — 실행
    Order result = orderService.find(1L);

    // Then — 결과 검증
    assertThat(result.getId()).isEqualTo(1L);

    // Then — 협력 객체 호출 검증
    then(orderRepo).should().findById(1L);
    then(orderRepo).shouldHaveNoMoreInteractions();
}
```

`BDDMockito`는 `Mockito`와 기능은 같지만 `given()` / `then()` 메서드명이 Given-When-Then 구조와 맞아 가독성이 높습니다.

## 스터빙 심화

![Mockito 실전 패턴](/assets/posts/spring-test-mockito-code.svg)

### 연속 반환값

```java
// 첫 번째 호출은 값 반환, 두 번째는 예외
given(stockService.check("item-1"))
    .willReturn(true)
    .willReturn(false)
    .willThrow(new StockException());
```

### 동적 스터빙 (Answer)

```java
given(orderRepo.save(any(Order.class)))
    .willAnswer(invocation -> {
        Order o = invocation.getArgument(0);
        o.setId(System.currentTimeMillis());  // 저장 후 ID 설정 시뮬레이션
        return o;
    });
```

### 예외 스터빙

```java
// 반환값 있는 메서드
given(orderRepo.findById(-1L))
    .willThrow(new OrderNotFoundException(-1L));

// void 메서드
willDoNothing().given(emailService).send(anyString());

// void 메서드 예외
willThrow(new MailException()).given(emailService).send(any());
```

## Argument Matchers

스터빙과 검증에서 구체적인 값 대신 조건으로 매칭합니다.

```java
// any() 계열 — 타입 무관 매칭
given(repo.findByStatus(any()))          .willReturn(List.of());
given(repo.findById(anyLong()))          .willReturn(Optional.empty());
given(repo.findByName(anyString()))      .willReturn(null);

// eq() — 정확한 값 매칭
given(repo.findById(eq(1L))).willReturn(Optional.of(order));

// 커스텀 조건
given(repo.findByAmount(
    argThat(amt -> amt.compareTo(BigDecimal.ZERO) > 0)))
    .willReturn(List.of(order));
```

⚠️ 한 메서드 호출에서 매처와 리터럴을 혼용할 수 없습니다. 모두 매처로 사용하거나 모두 리터럴로 사용해야 합니다.

```java
// ❌ 혼용 금지
given(service.find(1L, anyString()))…

// ✅ 모두 eq()로 통일
given(service.find(eq(1L), anyString()))…
```

## 검증 (Verify)

```java
// 정확히 1번 호출 (기본)
then(orderRepo).should().save(any(Order.class));

// 횟수 지정
then(orderRepo).should(times(2)).findById(anyLong());
then(emailService).should(never()).send(any());
then(stockService).should(atLeastOnce()).check(anyString());

// 순서 검증
InOrder inOrder = inOrder(stockService, orderRepo);
inOrder.verify(stockService).check("item-1");
inOrder.verify(orderRepo).save(any());

// 미검증 상호작용 없음 확인
then(orderRepo).shouldHaveNoMoreInteractions();
```

## ArgumentCaptor — 넘겨진 인수 캡처

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository orderRepo;
    @Captor ArgumentCaptor<Order> orderCaptor;

    @Test
    void capturesOrderOnSave() {
        orderService.place(new OrderRequest("item-1", 2));

        then(orderRepo).should().save(orderCaptor.capture());

        Order captured = orderCaptor.getValue();
        assertThat(captured.getStatus()).isEqualTo("CREATED");
        assertThat(captured.getItemCode()).isEqualTo("item-1");
    }
}
```

`ArgumentCaptor`는 mock에 전달된 실제 인수를 캡처해 단언할 수 있습니다. 특히 내부에서 새로 생성한 객체를 검증할 때 유용합니다.

## @Spy — 실제 구현 + 부분 스터빙

```java
@ExtendWith(MockitoExtension.class)
class OrderValidatorTest {

    @Spy
    OrderValidator validator = new OrderValidator();  // 실제 구현체

    @Test
    void partialStub() {
        // 일부 메서드만 스터빙 — 나머지는 실제 실행
        doReturn(true).when(validator).isSpecialCase(any());

        boolean result = validator.validate(new Order(1L, "CREATED"));

        assertThat(result).isTrue();
        // isSpecialCase()는 스터빙된 값, validate() 나머지 로직은 실제 실행
    }
}
```

`@Spy`는 실제 구현이 있는 클래스에 사용합니다. 인터페이스나 추상 클래스는 `@Mock`을 사용하세요.

## Mock 리셋과 재사용

```java
@BeforeEach
void resetMocks() {
    // 불필요한 경우가 많음 — @ExtendWith(MockitoExtension.class)가
    // 메서드마다 @Mock을 재생성하기 때문
    Mockito.reset(orderRepo);
}
```

`@ExtendWith(MockitoExtension.class)`를 사용하면 각 `@Test`마다 `@Mock`이 새로 초기화됩니다. `reset()`은 하나의 mock을 테스트 안에서 재사용할 때만 필요합니다.

## 정적 메서드 모킹 (Mockito 3.4+)

```java
@Test
void mockStaticMethod() {
    try (MockedStatic<UUID> uuidMock = mockStatic(UUID.class)) {
        UUID fixed = UUID.fromString("00000000-0000-0000-0000-000000000001");
        uuidMock.when(UUID::randomUUID).thenReturn(fixed);

        String id = orderService.generateId();

        assertThat(id).isEqualTo(fixed.toString());
    }
}
```

`MockedStatic`은 try-with-resources로 자동 해제해야 합니다. 정적 메서드 모킹은 테스트를 복잡하게 만들므로, 가능하면 의존성을 주입 가능한 방식으로 설계하는 것이 낫습니다.

## 흔한 실수와 해결

| 실수 | 원인 | 해결 |
|---|---|---|
| `UnnecessaryStubbingException` | given()으로 스터빙했지만 테스트에서 사용 안 함 | 불필요한 스터빙 제거 또는 `@MockitoSettings(strictness = LENIENT)` |
| `WrongTypeOfReturnValue` | willReturn() 타입 불일치 | 반환 타입 확인 |
| `NullPointerException` in `@InjectMocks` | 생성자에 주입 안 된 필드 | `@Mock` 추가 또는 직접 생성자 주입 |
| 스터빙 무시 | `final` 클래스/메서드 | `mockito-extensions` 설정으로 inline mock 활성화 |

---

**지난 글:** [Spring 테스트 — JUnit 5 & AssertJ 완전 정복](/posts/spring-test-junit5-assertj/)

<br>
읽어주셔서 감사합니다. 😊
