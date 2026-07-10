---
title: "AssertJ — 유창한 단언의 기술"
description: "JUnit의 기본 단언은 표현력에 한계가 있습니다. AssertJ의 assertThat 체이닝으로 대상을 먼저 읽고, 문자열·컬렉션·예외·객체를 풍부하게 검증하며, 실패 메시지까지 명확해지는 유창한 단언을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "AssertJ", "테스트", "단언", "단위 테스트"]
featured: false
draft: false
---

[지난 글](/posts/java-mockito-mocking/)에서 Mockito의 스터빙과 검증 심화 기법을 살펴봤습니다. Mock으로 상호작용을 검증하는 한편, 테스트의 또 다른 축은 결과값을 확인하는 **단언(assertion)** 입니다. JUnit의 기본 `assertEquals`, `assertTrue`도 동작하지만, 복잡한 객체나 컬렉션을 검증할 때는 금세 장황하고 읽기 어려워집니다. 이 문제를 우아하게 푸는 라이브러리가 **AssertJ**입니다.

## JUnit 단언의 한계

![JUnit 단언 vs AssertJ — 읽는 순서와 표현력의 차이](/assets/posts/java-assertj-compare.svg)

JUnit의 단언은 두 가지 불편함이 있습니다. 첫째, **기대값을 먼저** 쓰는 순서가 자연어와 반대라 헷갈립니다. 둘째, 검증 종류마다 `assertEquals`, `assertTrue`, `assertNull`처럼 메서드명이 달라 무엇을 쓸지 매번 떠올려야 합니다.

```java
assertEquals(5, list.size());
assertTrue(list.contains("kim"));
```

AssertJ는 **대상을 먼저** 쓰고 점(`.`)으로 단언을 이어 가는 방식을 택합니다.

```java
assertThat(list)
    .hasSize(5)
    .contains("kim")
    .doesNotContain("lee");
```

"list는 크기가 5이고, kim을 포함하며, lee를 포함하지 않는다"처럼 영어 문장 그대로 읽힙니다. 게다가 `assertThat(list).`까지 입력하면 IDE가 가능한 단언을 모두 자동완성으로 보여 주므로, 어떤 단언이 있는지 외울 필요가 없습니다.

## 의존성과 진입점

Gradle에 AssertJ를 추가합니다. Spring Boot 스타터 테스트에는 이미 포함되어 있습니다.

```kotlin
dependencies {
    testImplementation("org.assertj:assertj-core:3.25.3")
}
```

모든 단언은 `org.assertj.core.api.Assertions.assertThat`이라는 하나의 진입점에서 시작합니다. 정적 임포트해 두면 `assertThat(...)`으로 바로 쓸 수 있습니다.

```java
import static org.assertj.core.api.Assertions.assertThat;
```

## 타입별 풍부한 단언

![타입별 풍부한 단언 — 문자열, 컬렉션, 예외, 객체](/assets/posts/java-assertj-types.svg)

AssertJ는 대상 타입에 맞는 전용 단언을 제공합니다. `assertThat`에 무엇을 넘기느냐에 따라 사용할 수 있는 메서드가 달라집니다.

**문자열**은 부분 일치, 시작·끝, 대소문자 무시 등을 체이닝합니다.

```java
assertThat(name)
    .startsWith("k")
    .contains("im")
    .isEqualToIgnoringCase("KIM");
```

**컬렉션**은 AssertJ의 진가가 가장 잘 드러나는 영역입니다. 순서 보장, 부분 포함, 필드 추출까지 가능합니다.

```java
assertThat(users)
    .hasSize(2)
    .extracting("name")
    .containsExactly("kim", "lee");
```

`extracting`은 각 원소에서 특정 필드만 뽑아 새 단언 대상으로 만듭니다. 객체 리스트를 검증할 때 일일이 반복문을 도는 대신 한 줄로 끝낼 수 있습니다.

## 예외 검증

AssertJ는 예외도 유창하게 검증합니다. `assertThatThrownBy`로 예외를 잡고, 타입과 메시지를 이어서 확인합니다.

```java
assertThatThrownBy(() -> service.run())
    .isInstanceOf(IllegalStateException.class)
    .hasMessageContaining("초기화되지 않음");
```

특정 예외 타입을 강조하고 싶다면 `assertThatExceptionOfType`이나 `assertThatIllegalArgumentException` 같은 전용 진입점도 있습니다. 예외의 타입, 메시지, 원인(cause)을 한 체인에서 모두 검증할 수 있다는 점이 JUnit의 `assertThrows`보다 표현력이 높습니다.

## 객체와 필드 비교

객체를 검증할 때는 `extracting`으로 필드를 뽑거나, 두 객체를 필드 단위로 통째로 비교할 수 있습니다.

```java
assertThat(user)
    .extracting(User::getName, User::getAge)
    .containsExactly("kim", 20);

// equals를 재정의하지 않아도 필드 값으로 비교
assertThat(actual)
    .usingRecursiveComparison()
    .isEqualTo(expected);
```

`usingRecursiveComparison()`은 `equals` 구현 없이도 모든 필드를 재귀적으로 비교합니다. DTO나 엔티티의 모든 필드가 기대대로인지 확인할 때 매우 유용합니다.

## SoftAssertions — 모든 실패 모으기

기본 단언은 첫 실패에서 멈추지만, `SoftAssertions`를 쓰면 여러 단언을 모두 평가한 뒤 실패한 것을 한꺼번에 보고합니다. JUnit의 `assertAll`과 비슷하지만 AssertJ의 풍부한 단언을 그대로 쓸 수 있습니다.

```java
SoftAssertions softly = new SoftAssertions();
softly.assertThat(user.getName()).isEqualTo("kim");
softly.assertThat(user.getAge()).isEqualTo(20);
softly.assertAll();   // 여기서 모든 실패를 한 번에 보고
```

## 정리

AssertJ는 `assertThat`을 진입점으로 대상을 먼저 읽고 단언을 체이닝하는 유창한 방식으로, JUnit 기본 단언의 장황함과 헷갈리는 인자 순서를 해결합니다. 문자열·컬렉션·예외·객체마다 타입에 맞는 풍부한 단언을 제공하고, `extracting`·`usingRecursiveComparison`·`SoftAssertions`로 복잡한 검증도 간결하게 표현합니다. IDE 자동완성과 명확한 실패 메시지까지 더해져, 한번 익히면 다시 기본 단언으로 돌아가기 어려울 만큼 편리합니다. 이로써 빌드 도구와 테스트 도구를 아우르는 이번 묶음을 마무리합니다.

---

**지난 글:** [Mockito 스터빙과 검증 심화](/posts/java-mockito-mocking/)

**다음 글:** [Testcontainers — 진짜 의존성으로 통합 테스트하기](/posts/java-testcontainers/)

<br>
읽어주셔서 감사합니다. 😊
