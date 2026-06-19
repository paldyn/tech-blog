---
title: "JUnit 5 입문 — 현대 자바 테스트의 표준"
description: "JUnit 5는 자바 단위 테스트의 사실상 표준입니다. Platform·Jupiter·Vintage 세 모듈 구조, @Test와 Assertions의 기본 사용법, @DisplayName과 assertThrows까지 JUnit 5의 시작을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "JUnit", "테스트", "단위 테스트", "TDD"]
featured: false
draft: false
---

[지난 글](/posts/java-bom/)에서 BOM으로 의존성 버전을 관리하는 방법을 다뤘습니다. 빌드와 의존성 관리를 익혔으니 이제 그 코드가 제대로 동작하는지 검증할 차례입니다. 자바 생태계에서 단위 테스트의 사실상 표준은 **JUnit**이며, 현재 권장 버전은 **JUnit 5**입니다. JUnit 4와 구조부터 다르게 재설계된 JUnit 5는 람다 친화적인 단언, 풍부한 확장 모델, 그리고 모듈화된 아키텍처를 제공합니다.

## JUnit 5의 세 가지 모듈

![JUnit 5 아키텍처 — Platform, Jupiter, Vintage](/assets/posts/java-junit5-basics-architecture.svg)

JUnit 4가 하나의 jar였던 것과 달리, JUnit 5는 세 개의 하위 프로젝트로 구성됩니다.

- **JUnit Platform**: 테스트를 발견하고 실행하는 공통 기반입니다. `TestEngine`이라는 API를 정의하며, IDE·Gradle·Maven이 이 위에서 테스트를 구동합니다.
- **JUnit Jupiter**: JUnit 5의 새 프로그래밍 모델입니다. 우리가 작성하는 `@Test`, `Assertions`, 확장(Extension) API가 모두 여기에 있습니다.
- **JUnit Vintage**: 기존 JUnit 3·4 테스트를 JUnit Platform 위에서 그대로 실행하게 해 주는 호환 엔진입니다.

정리하면 **JUnit 5 = Platform + Jupiter + Vintage** 입니다. 새 테스트는 Jupiter로 작성하고, 레거시 테스트는 Vintage로 함께 굴릴 수 있어 점진적 마이그레이션이 가능합니다.

## 의존성 추가

Gradle에서는 JUnit Jupiter 의존성을 추가하고 테스트 태스크가 JUnit Platform을 쓰도록 설정합니다.

```kotlin
dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
}

tasks.test {
    useJUnitPlatform()   // JUnit Platform으로 테스트 실행
}
```

`junit-jupiter`는 API와 엔진을 함께 가져오는 묶음 아티팩트라 이 한 줄이면 충분합니다. `useJUnitPlatform()`을 빠뜨리면 테스트가 발견되지 않으니 주의하세요.

## 첫 번째 테스트

![첫 JUnit 5 테스트 — @Test, assertEquals, @DisplayName](/assets/posts/java-junit5-basics-test.svg)

간단한 `Calculator`의 덧셈을 테스트해 봅시다.

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.assertEquals;

class CalculatorTest {

    @Test
    @DisplayName("2 + 3 은 5다")
    void add_returnsSum() {
        Calculator calc = new Calculator();
        int result = calc.add(2, 3);
        assertEquals(5, result);   // (기대값, 실제값)
    }
}
```

몇 가지 짚어 볼 점이 있습니다. 테스트 클래스와 메서드에 `public`을 붙이지 않아도 됩니다. JUnit 5는 package-private 가시성으로 충분합니다. `@DisplayName`을 쓰면 테스트 리포트에 사람이 읽기 좋은 이름이 표시되어, 한글로 의도를 명확히 적을 수 있습니다.

## 핵심 단언(Assertions)

`org.junit.jupiter.api.Assertions`의 정적 메서드들이 검증을 담당합니다. 자주 쓰는 것들입니다.

```java
assertEquals(expected, actual);     // 값이 같은지
assertTrue(condition);              // 참인지
assertNull(value);                  // null 인지
assertSame(obj1, obj2);             // 같은 참조인지
assertArrayEquals(arr1, arr2);      // 배열이 같은지
```

JUnit 5의 단언은 항상 **기대값을 먼저, 실제값을 나중에** 받는 순서를 따릅니다. 이 순서를 뒤집으면 테스트 실패 메시지의 "expected/actual"이 거꾸로 나와 디버깅이 헷갈리니 습관을 들여 두는 것이 좋습니다.

## 예외 검증과 묶음 단언

JUnit 5는 람다를 적극 활용합니다. 예외가 발생하는지 검증할 때는 `assertThrows`를 씁니다.

```java
@Test
void divideByZero_throws() {
    Calculator calc = new Calculator();
    assertThrows(ArithmeticException.class,
                 () -> calc.divide(1, 0));
}
```

여러 단언을 한 번에 평가하고 싶다면 `assertAll`을 씁니다. 일반적인 단언은 첫 실패에서 멈추지만, `assertAll`은 모든 단언을 실행한 뒤 실패한 것을 한꺼번에 보고합니다.

```java
@Test
void point_hasCorrectCoordinates() {
    Point p = new Point(1, 2);
    assertAll("좌표 검증",
        () -> assertEquals(1, p.getX()),
        () -> assertEquals(2, p.getY())
    );
}
```

## 정리

JUnit 5는 Platform·Jupiter·Vintage 세 모듈로 재설계된 현대 자바 테스트의 표준입니다. `junit-jupiter` 의존성과 `useJUnitPlatform()` 설정으로 시작하고, `@Test`로 테스트 메서드를 표시하며, `Assertions`의 정적 메서드로 결과를 검증합니다. `@DisplayName`으로 의도를 드러내고 `assertThrows`·`assertAll` 같은 람다 기반 단언으로 표현력을 높일 수 있습니다. 다음 글에서는 테스트의 준비와 정리를 담당하는 생명주기 어노테이션을 자세히 살펴보겠습니다.

---

**지난 글:** [BOM — 의존성 버전 한 곳에서 관리하기](/posts/java-bom/)

**다음 글:** [JUnit 5 생명주기 — 테스트의 준비와 정리](/posts/java-junit5-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
