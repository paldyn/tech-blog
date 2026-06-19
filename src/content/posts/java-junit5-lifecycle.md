---
title: "JUnit 5 생명주기 — 테스트의 준비와 정리"
description: "테스트는 서로 독립적이어야 합니다. @BeforeEach·@AfterEach로 매 테스트를 준비·정리하고 @BeforeAll·@AfterAll로 비싼 자원을 공유하는 방법, 그리고 테스트 인스턴스 생명주기까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "JUnit", "테스트", "생명주기", "단위 테스트"]
featured: false
draft: false
---

[지난 글](/posts/java-junit5-basics/)에서 JUnit 5의 구조와 `@Test`로 테스트를 작성하는 기본을 익혔습니다. 그런데 실제 테스트는 단순히 메서드 하나로 끝나지 않습니다. 데이터베이스를 연결하거나, 테스트용 객체를 준비하거나, 끝난 뒤 임시 파일을 지우는 등 **준비(setup)와 정리(teardown)** 가 필요합니다. 무엇보다 각 테스트는 서로의 결과에 영향을 주지 않도록 **독립적**이어야 합니다. JUnit 5는 이를 위한 생명주기 어노테이션을 제공합니다.

## 네 가지 생명주기 어노테이션

![JUnit 5 테스트 생명주기 — BeforeAll, BeforeEach, Test, AfterEach, AfterAll 순서](/assets/posts/java-junit5-lifecycle-order.svg)

JUnit 5에는 테스트 전후에 실행되는 네 가지 어노테이션이 있습니다.

- **`@BeforeAll`**: 클래스의 모든 테스트가 시작되기 전에 **딱 한 번** 실행됩니다. `static` 메서드여야 합니다.
- **`@BeforeEach`**: **각 테스트 메서드 직전마다** 실행됩니다.
- **`@AfterEach`**: **각 테스트 메서드 직후마다** 실행됩니다.
- **`@AfterAll`**: 모든 테스트가 끝난 뒤 **딱 한 번** 실행됩니다. `static` 메서드여야 합니다.

실행 순서는 `@BeforeAll → (@BeforeEach → @Test → @AfterEach) 반복 → @AfterAll` 입니다. 괄호 안의 묶음이 테스트 메서드 개수만큼 반복됩니다.

## 코드로 보기

![생명주기 메서드 — BeforeAll, BeforeEach, Test, AfterAll 예제](/assets/posts/java-junit5-lifecycle-code.svg)

데이터베이스를 쓰는 테스트를 예로 들어 봅시다. 연결은 비싸니 한 번만 맺고, 데이터는 매 테스트마다 초기화합니다.

```java
class OrderServiceTest {

    static Database db;

    @BeforeAll
    static void initDb() {
        db = Database.connect();   // 모든 테스트 전 한 번
    }

    @BeforeEach
    void clean() {
        db.truncate();             // 매 테스트 전 데이터 초기화
    }

    @Test
    void placesOrder() {
        // db는 항상 빈 상태에서 시작
    }

    @AfterAll
    static void close() {
        db.disconnect();           // 모든 테스트 후 한 번
    }
}
```

이렇게 하면 연결처럼 비싼 자원은 `@BeforeAll`로 한 번만 만들어 공유하고, 테스트 간 상태 오염을 막는 초기화는 `@BeforeEach`로 매번 수행합니다. 덕분에 각 테스트는 깨끗한 상태에서 독립적으로 실행됩니다.

## 왜 static이어야 할까 — 테스트 인스턴스 생명주기

`@BeforeAll`과 `@AfterAll`이 `static`이어야 하는 이유는 JUnit 5의 **기본 테스트 인스턴스 생명주기** 때문입니다. JUnit 5는 기본적으로 **테스트 메서드마다 클래스를 새로 인스턴스화**합니다(`PER_METHOD`). 즉 테스트가 세 개면 객체가 세 개 만들어집니다.

이는 테스트 간 필드 상태를 공유하지 않게 해 독립성을 보장하는 의도적인 설계입니다. 하지만 그렇기 때문에 "모든 테스트에 한 번"인 `@BeforeAll`은 특정 인스턴스에 속할 수 없어 `static`이어야 합니다.

만약 인스턴스를 하나만 만들고 싶다면 클래스에 `@TestInstance(Lifecycle.PER_CLASS)`를 붙이면 됩니다. 이 경우 `@BeforeAll`을 `static` 없이 인스턴스 메서드로 쓸 수 있습니다.

```java
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ReportTest {

    @BeforeAll
    void setup() {   // static 없이도 가능
        // ...
    }
}
```

다만 `PER_CLASS`는 테스트 간 필드 상태가 공유되므로, 상태를 잘못 관리하면 테스트가 서로 간섭할 수 있어 주의가 필요합니다.

## @Nested로 생명주기 구조화

복잡한 테스트는 `@Nested`로 내부 클래스를 만들어 맥락별로 묶을 수 있습니다. 이때 각 중첩 클래스는 자신만의 `@BeforeEach`를 가질 수 있고, 바깥 클래스의 `@BeforeEach`도 함께 적용됩니다.

```java
class StackTest {

    @BeforeEach
    void createStack() { /* 빈 스택 준비 */ }

    @Nested
    class WhenNotEmpty {

        @BeforeEach
        void pushAnElement() { /* 원소 하나 push */ }

        @Test
        void popReturnsLastPushed() { /* ... */ }
    }
}
```

바깥의 `createStack`이 먼저, 안쪽의 `pushAnElement`가 그 다음 실행되어 "비어 있지 않은 스택"이라는 맥락을 자연스럽게 구성합니다.

## 정리

JUnit 5의 생명주기 어노테이션은 테스트의 준비와 정리를 명확히 분리해, 각 테스트가 독립적으로 실행되도록 돕습니다. 비싼 자원은 `@BeforeAll`/`@AfterAll`로 한 번만, 상태 초기화는 `@BeforeEach`/`@AfterEach`로 매번 처리하는 것이 기본 패턴입니다. 기본 인스턴스 생명주기가 `PER_METHOD`라는 점을 이해하면 `static` 요구사항도 자연스럽게 받아들여집니다. 다음 글에서는 같은 테스트를 여러 입력값으로 반복 실행하는 파라미터화 테스트를 다루겠습니다.

---

**지난 글:** [JUnit 5 입문 — 현대 자바 테스트의 표준](/posts/java-junit5-basics/)

**다음 글:** [JUnit 5 파라미터화 테스트 — 하나의 테스트, 여러 입력](/posts/java-junit5-parameterized/)

<br>
읽어주셔서 감사합니다. 😊
