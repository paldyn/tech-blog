---
title: "JUnit 5 파라미터화 테스트 — 하나의 테스트, 여러 입력"
description: "같은 검증을 여러 입력값으로 반복할 때 테스트를 복사하지 마세요. @ParameterizedTest와 @ValueSource·@CsvSource·@MethodSource로 입력만 바꿔 가며 한 메서드로 다양한 케이스를 검증하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "JUnit", "테스트", "파라미터화", "단위 테스트"]
featured: false
draft: false
---

[지난 글](/posts/java-junit5-lifecycle/)에서 테스트의 준비와 정리를 담당하는 생명주기 어노테이션을 살펴봤습니다. 테스트를 작성하다 보면 같은 로직을 입력값만 바꿔 여러 번 검증하고 싶을 때가 많습니다. 짝수 판별을 2, 4, 6, 8로 확인하거나, 덧셈을 여러 조합으로 검증하는 식입니다. 이때 테스트 메서드를 복사·붙여넣기 하는 대신, JUnit 5의 **파라미터화 테스트**를 쓰면 입력만 바꿔 가며 한 메서드를 반복 실행할 수 있습니다.

## 파라미터화 테스트의 개념

![파라미터화 테스트 — 하나의 메서드를 여러 입력으로 반복 실행](/assets/posts/java-junit5-parameterized-concept.svg)

`@ParameterizedTest`로 표시한 메서드는 **입력 소스가 제공하는 값마다 한 번씩** 실행됩니다. 입력이 네 개면 테스트가 네 번 돌고, 리포트에도 각각 별개의 테스트로 카운트됩니다. 덕분에 어느 입력에서 실패했는지가 명확하게 드러납니다.

핵심은 `@Test` 대신 `@ParameterizedTest`를 쓰고, **입력을 제공하는 소스 어노테이션을 하나 이상 붙인다**는 점입니다. 의존성은 `junit-jupiter`에 포함되어 있어 별도 추가가 필요 없습니다.

## @ValueSource — 단일 값 목록

![소스 종류별 작성법 — @ValueSource와 @CsvSource](/assets/posts/java-junit5-parameterized-code.svg)

가장 간단한 소스는 `@ValueSource`입니다. `int`, `String` 등 하나의 값 배열을 제공합니다.

```java
@ParameterizedTest
@ValueSource(ints = {2, 4, 6, 8})
void isEven(int n) {
    assertTrue(n % 2 == 0);
}
```

이 테스트는 `n`이 2, 4, 6, 8일 때 각각 실행됩니다. 문자열 검증도 마찬가지입니다.

```java
@ParameterizedTest
@ValueSource(strings = {"racecar", "level", "noon"})
void isPalindrome(String word) {
    assertTrue(StringUtils.isPalindrome(word));
}
```

## @CsvSource — 여러 인자를 함께

입력과 기대값처럼 **여러 인자가 필요한 경우** `@CsvSource`를 씁니다. 각 문자열이 한 번의 테스트 실행이며, 콤마로 인자를 나눕니다.

```java
@ParameterizedTest
@CsvSource({"2,3,5", "10,20,30", "-1,1,0"})
void add(int a, int b, int sum) {
    assertEquals(sum, calc.add(a, b));
}
```

`"2,3,5"`는 `add(2, 3)`의 결과가 `5`인지 검증합니다. 값에 공백이나 콤마가 포함된다면 따옴표로 감싸거나 구분자를 바꿀 수 있고, 비어 있는 값은 `@EmptySource`나 CSV의 빈 칸 처리로 다룹니다.

## @MethodSource — 복잡한 객체 입력

원시값이나 문자열로 표현하기 어려운 입력은 `@MethodSource`로 제공합니다. 인자들을 만들어 주는 **정적 팩토리 메서드**를 가리키며, `Stream<Arguments>`를 반환합니다.

```java
@ParameterizedTest
@MethodSource("provideOrders")
void totalPrice(Order order, int expected) {
    assertEquals(expected, order.totalPrice());
}

static Stream<Arguments> provideOrders() {
    return Stream.of(
        Arguments.of(new Order("A", 2, 1000), 2000),
        Arguments.of(new Order("B", 0, 5000), 0)
    );
}
```

`Arguments.of(...)`로 인자 묶음을 만들고, 테스트 메서드의 시그니처와 순서·타입을 맞춥니다. 객체를 직접 만들어 넘길 수 있어 가장 표현력이 높은 소스입니다.

## @EnumSource와 표시 이름

열거형의 모든 상수를 입력으로 쓰고 싶다면 `@EnumSource`가 편리합니다.

```java
@ParameterizedTest
@EnumSource(Season.class)
void allSeasonsHaveName(Season season) {
    assertNotNull(season.getKoreanName());
}
```

각 실행의 리포트 이름은 `name` 속성으로 다듬을 수 있습니다. `{0}`, `{1}`은 순서대로 인자값으로 치환됩니다.

```java
@ParameterizedTest(name = "{0} + {1} = {2}")
@CsvSource({"2,3,5"})
void add(int a, int b, int sum) { /* ... */ }
```

이렇게 하면 리포트에 `2 + 3 = 5`처럼 읽기 좋은 이름이 표시되어, 실패한 케이스를 한눈에 파악할 수 있습니다.

## 정리

파라미터화 테스트는 같은 검증 로직을 입력만 바꿔 반복할 때 코드 중복을 없애 주는 강력한 도구입니다. 단순한 값은 `@ValueSource`, 여러 인자는 `@CsvSource`, 복잡한 객체는 `@MethodSource`, 열거형은 `@EnumSource`로 입력을 제공합니다. 각 입력이 독립된 테스트로 카운트되므로 경계값과 다양한 케이스를 빠짐없이 검증하면서도 어디서 실패했는지 명확히 알 수 있습니다. 다음 글부터는 협력 객체를 가짜로 대체하는 Mockito의 세계로 들어갑니다.

---

**지난 글:** [JUnit 5 생명주기 — 테스트의 준비와 정리](/posts/java-junit5-lifecycle/)

**다음 글:** [Mockito 입문 — 테스트 더블의 세계](/posts/java-mockito-basics/)

<br>
읽어주셔서 감사합니다. 😊
