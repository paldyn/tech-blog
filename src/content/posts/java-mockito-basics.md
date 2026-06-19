---
title: "Mockito 입문 — 테스트 더블의 세계"
description: "단위 테스트는 협력 객체를 가짜로 대체해 대상만 격리해야 합니다. Mockito의 Mock·Stub·Spy 개념, @Mock과 @InjectMocks, when().thenReturn()과 verify()로 외부 의존성 없이 테스트하는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Mockito", "테스트", "Mock", "단위 테스트"]
featured: false
draft: false
---

[지난 글](/posts/java-junit5-parameterized/)에서 하나의 테스트를 여러 입력으로 반복하는 파라미터화 테스트를 살펴봤습니다. 그런데 실제 서비스 코드를 테스트하다 보면 곧 벽에 부딪힙니다. `OrderService`를 테스트하려는데 그 안에서 결제 게이트웨이를 호출하고, 결제는 실제 외부 시스템에 연결됩니다. 테스트마다 진짜 결제를 할 수는 없습니다. 이때 협력 객체를 **가짜로 대체**해 테스트 대상만 격리하는 도구가 **Mockito**입니다.

## 테스트 더블이란

테스트에서 진짜 객체를 대신하는 가짜 객체를 통틀어 **테스트 더블(Test Double)** 이라고 부릅니다. 영화의 스턴트 대역(double)에서 따온 말입니다. 대표적인 종류는 다음과 같습니다.

- **Stub(스텁)**: 미리 정해진 값을 반환하도록 준비된 객체. "이 메서드를 부르면 이 값을 줘라"를 설정합니다.
- **Mock(목)**: 스텁의 능력에 더해, **어떤 호출이 일어났는지 검증**할 수 있는 객체.
- **Spy(스파이)**: 진짜 객체를 감싸 일부 메서드만 가짜로 바꾸고 나머지는 실제로 실행하는 객체.

Mockito는 이 세 가지를 모두 만들 수 있는 라이브러리이며, 실무에서는 Mock을 가장 자주 씁니다.

## 왜 Mock을 쓰는가

![Mock으로 협력 객체 대체 — SUT를 외부 의존성에서 격리](/assets/posts/java-mockito-basics-concept.svg)

테스트 대상을 **SUT(System Under Test)** 라고 합니다. `OrderService`가 SUT라면, 그것이 의존하는 `PaymentGateway`는 협력 객체입니다. 이 협력 객체를 Mock으로 바꾸면 여러 이점이 생깁니다.

- **빠르고 결정적**: 네트워크·DB·외부 결제 없이 메모리 안에서 즉시 동작합니다.
- **격리**: SUT의 로직만 검증할 수 있어, 실패 원인이 SUT인지 의존성인지 헷갈리지 않습니다.
- **재현 어려운 상황 시뮬레이션**: "결제 실패", "타임아웃 예외" 같은 상황을 Mock으로 자유롭게 만들 수 있습니다.

## 의존성과 설정

Gradle에 Mockito와 JUnit 5 통합 모듈을 추가합니다.

```kotlin
dependencies {
    testImplementation("org.mockito:mockito-core:5.11.0")
    testImplementation("org.mockito:mockito-junit-jupiter:5.11.0")
}
```

`mockito-junit-jupiter`가 제공하는 `MockitoExtension`을 클래스에 붙이면 `@Mock` 같은 어노테이션이 활성화됩니다.

## 기본 흐름: Mock → Stub → 실행 → Verify

![Mockito 기본 흐름 — @Mock, when, verify](/assets/posts/java-mockito-basics-code.svg)

Mockito 테스트는 보통 네 단계로 흐릅니다. Mock 생성, 스터빙, 실행, 검증입니다.

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock PaymentGateway gateway;          // 가짜 협력 객체
    @InjectMocks OrderService service;     // gateway가 주입된 SUT

    @Test
    void placesOrder() {
        // 1. 스터빙 — 호출 시 반환값 지정
        when(gateway.pay(1000)).thenReturn(true);

        // 2. 실행
        service.place(1000);

        // 3. 검증 — 의도한 호출이 일어났는가
        verify(gateway).pay(1000);
    }
}
```

`@Mock`은 가짜 객체를 만들고, `@InjectMocks`는 그 Mock을 생성자나 필드를 통해 SUT에 자동으로 주입합니다. 이 두 어노테이션 덕분에 직접 객체를 조립하는 보일러플레이트가 사라집니다.

## 스터빙: when().thenReturn()

`when(...).thenReturn(...)`은 "이 메서드가 이 인자로 호출되면 이 값을 반환하라"고 정의합니다.

```java
when(repository.findById(1L)).thenReturn(Optional.of(user));
when(clock.now()).thenReturn(fixedTime);
```

예외를 던지게 하려면 `thenThrow`를 씁니다. 재현하기 어려운 실패 경로를 손쉽게 테스트할 수 있습니다.

```java
when(gateway.pay(anyInt()))
    .thenThrow(new PaymentException("한도 초과"));
```

스터빙하지 않은 메서드는 Mockito가 기본값(객체는 `null`, `int`는 `0`, `boolean`은 `false`)을 반환합니다.

## 검증: verify()

`verify()`는 Mock의 특정 메서드가 **호출되었는지**를 확인합니다. 반환값이 없는 메서드(`void`)를 검증할 때 특히 유용합니다.

```java
verify(gateway).pay(1000);              // 정확히 1번 호출됐는지
verify(emailSender, never()).send(any()); // 한 번도 호출 안 됐는지
verify(repository, times(2)).save(any());  // 2번 호출됐는지
```

상태가 아니라 **상호작용(행위)** 을 검증한다는 점에서, 값을 확인하는 `assertEquals`와는 다른 종류의 검증입니다. 결제가 정확히 한 번 일어났는지처럼 "무엇이 호출되었는가"가 중요한 시나리오에서 빛을 발합니다.

## 정리

Mockito는 협력 객체를 테스트 더블로 대체해 SUT만 격리해 검증하게 해 주는 라이브러리입니다. `@Mock`으로 가짜 객체를 만들고 `@InjectMocks`로 SUT에 주입한 뒤, `when().thenReturn()`으로 동작을 정의하고 `verify()`로 상호작용을 검증하는 흐름이 기본입니다. 외부 시스템 없이 빠르고 결정적인 테스트를 작성할 수 있다는 것이 가장 큰 가치입니다. 다음 글에서는 인자 매칭, 응답 시퀀스, `ArgumentCaptor` 같은 스터빙과 검증의 심화 기법을 다루겠습니다.

---

**지난 글:** [JUnit 5 파라미터화 테스트 — 하나의 테스트, 여러 입력](/posts/java-junit5-parameterized/)

**다음 글:** [Mockito 스터빙과 검증 심화](/posts/java-mockito-mocking/)

<br>
읽어주셔서 감사합니다. 😊
