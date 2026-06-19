---
title: "Mockito 스터빙과 검증 심화"
description: "기본을 넘어선 Mockito의 진짜 힘은 인자 매처, 연속 응답, ArgumentCaptor, BDD 스타일에 있습니다. any·eq 매처 규칙과 흔한 함정, 그리고 전달된 인자를 붙잡아 검증하는 기법까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Mockito", "테스트", "ArgumentCaptor", "단위 테스트"]
featured: false
draft: false
---

[지난 글](/posts/java-mockito-basics/)에서 Mockito의 기본 흐름인 Mock 생성, 스터빙, 검증을 익혔습니다. 실무에서 테스트를 작성하다 보면 "정확한 인자가 아니라 아무 값이든 매칭하고 싶다", "호출할 때마다 다른 값을 반환하게 하고 싶다", "SUT가 내부에서 만든 객체를 검사하고 싶다" 같은 요구가 생깁니다. 이번 글에서는 이런 상황을 다루는 Mockito의 심화 기법을 살펴봅니다.

## 인자 매처(Argument Matchers)

![스터빙·검증 심화 — 매처, 연속 반환, ArgumentCaptor](/assets/posts/java-mockito-mocking-code.svg)

스터빙할 때 정확한 값 대신 "조건"으로 매칭하려면 인자 매처를 씁니다.

```java
when(repo.findById(anyLong())).thenReturn(Optional.of(user));
when(sender.send(eq("kim"), anyString())).thenReturn(true);
```

자주 쓰는 매처는 `any()`, `anyLong()`, `anyString()`, `eq(값)`, `argThat(조건)` 등입니다. 검증에서도 똑같이 쓸 수 있습니다.

```java
verify(repo).deleteById(anyLong());
verify(sender).send(argThat(name -> name.startsWith("k")), any());
```

## 매처의 핵심 규칙 — 섞어 쓰지 말 것

매처에는 반드시 지켜야 하는 규칙이 하나 있습니다. **한 메서드 호출에서 매처를 하나라도 쓰면, 모든 인자를 매처로 써야 합니다.** 실제값과 매처를 섞으면 `InvalidUseOfMatchersException`이 발생합니다.

```java
// 잘못된 코드 — 실제값 "kim"과 매처 anyString() 혼용
when(sender.send("kim", anyString())).thenReturn(true);

// 올바른 코드 — 실제값을 eq()로 감싼다
when(sender.send(eq("kim"), anyString())).thenReturn(true);
```

이 함정은 매우 흔하므로, 매처를 하나라도 쓰는 순간 나머지 실제값을 `eq()`로 감싸는 습관을 들이는 것이 좋습니다.

## 연속 호출에 다른 값 반환하기

같은 메서드가 여러 번 호출될 때 매번 다른 값을 반환하게 하려면 `thenReturn`에 값을 나열하거나 체이닝합니다.

```java
when(seq.next()).thenReturn(1, 2, 3);
// 또는
when(seq.next())
    .thenReturn(1)
    .thenThrow(new NoSuchElementException());
```

첫 호출은 1, 두 번째는 2, 세 번째는 3을 반환합니다. 마지막 값 이후의 추가 호출은 마지막 값을 계속 반환합니다. 반복자나 재시도 로직처럼 호출 순서에 따라 동작이 달라지는 코드를 테스트할 때 유용합니다.

## ArgumentCaptor — 전달된 인자를 붙잡기

![ArgumentCaptor의 작동 — Mock에 전달된 인자를 붙잡아 검증](/assets/posts/java-mockito-mocking-captor.svg)

가장 강력한 기법 중 하나가 `ArgumentCaptor`입니다. SUT가 **내부에서 객체를 만들어 Mock에 넘길 때**, 그 객체의 필드를 검증하고 싶을 때 씁니다.

예를 들어 `signup()`이 내부에서 `User`를 생성해 `repository.save(user)`를 호출한다고 합시다. 이 `user`는 테스트에서 직접 만든 것이 아니므로 검증하기 까다롭습니다. Captor로 붙잡으면 됩니다.

```java
@Test
void signup_savesUserWithName() {
    service.signup("kim", "kim@test.com");

    var captor = ArgumentCaptor.forClass(User.class);
    verify(repository).save(captor.capture());

    User saved = captor.getValue();
    assertEquals("kim", saved.getName());
    assertEquals("kim@test.com", saved.getEmail());
}
```

`captor.capture()`를 `verify` 안에 넣으면 Mock에 전달된 실제 인자가 Captor에 저장되고, `getValue()`로 꺼내 필드를 검증할 수 있습니다. 단순한 인자 매칭이라면 `eq()`/`any()`로 충분하니, Captor는 **내부에서 생성된 객체의 속성을 확인할 때**로 용도를 한정하는 것이 좋습니다.

## BDD 스타일 — given/when/then

Mockito는 행위 주도 개발(BDD) 스타일의 별칭도 제공합니다. `BDDMockito`를 쓰면 `when` 대신 `given`, `verify` 대신 `then`을 쓸 수 있어 테스트가 더 읽기 좋아집니다.

```java
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@Test
void placesOrder() {
    given(gateway.pay(1000)).willReturn(true);   // 준비

    service.place(1000);                          // 실행

    then(gateway).should().pay(1000);             // 검증
}
```

기능은 기존 API와 동일하지만, `given-when-then` 구조가 코드에 그대로 드러나 테스트의 의도를 명확히 전달합니다.

## void 메서드 스터빙

`void` 메서드는 `when().thenReturn()`을 쓸 수 없습니다(반환값이 없으니까요). 예외를 던지게 하려면 `doThrow().when()` 형태를 씁니다.

```java
doThrow(new IllegalStateException())
    .when(repository).deleteById(99L);
```

이 `doXxx().when()` 형태는 `doReturn`, `doNothing`, `doAnswer` 등으로 확장되며, 특히 `doNothing`은 Spy의 특정 메서드 실행을 막을 때 유용합니다.

## 정리

Mockito의 심화 기능은 현실의 까다로운 테스트 시나리오를 깔끔하게 풀어 줍니다. 인자 매처로 유연하게 매칭하되 실제값과 섞을 때는 `eq()`로 감싸야 하고, 연속 응답으로 호출 순서별 동작을, `ArgumentCaptor`로 내부 생성 객체를 검증할 수 있습니다. BDD 스타일과 `doThrow` 같은 보조 API까지 익히면 거의 모든 상호작용을 표현할 수 있습니다. 다음 글에서는 단언을 한층 읽기 좋게 만들어 주는 AssertJ를 다루겠습니다.

---

**지난 글:** [Mockito 입문 — 테스트 더블의 세계](/posts/java-mockito-basics/)

**다음 글:** [AssertJ — 유창한 단언의 기술](/posts/java-assertj/)

<br>
읽어주셔서 감사합니다. 😊
