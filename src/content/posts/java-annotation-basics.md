---
title: "애너테이션 기초 — 코드에 메타데이터 붙이기"
description: "애너테이션은 코드의 동작을 바꾸지 않고 정보(메타데이터)만 덧붙이는 장치입니다. @interface로 직접 선언하는 법, 요소(element)와 기본값, 그리고 그 정보를 누가 어떻게 읽는지를 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "애너테이션", "Annotation", "메타데이터", "@interface"]
featured: false
draft: false
---

[지난 글](/posts/java-method-handles/)에서 MethodHandle을 다루며 코드를 런타임에 들여다보고 호출하는 도구들을 마무리했습니다. 그런데 스프링의 `@Service`, JPA의 `@Entity`, JUnit의 `@Test` 같은 `@`로 시작하는 표시들은 도대체 무엇일까요? 이들은 코드의 동작을 직접 바꾸지 않습니다. 대신 "이 클래스는 서비스다", "이 메서드는 테스트다" 같은 **정보를 코드에 덧붙입니다.** 그 정보를 프레임워크가 리플렉션으로 읽어 행동을 결정합니다. 이것이 **애너테이션(annotation)** 입니다. 이번 글은 애너테이션이 무엇이고 직접 어떻게 만드는지, 그 기초를 정리합니다.

## 애너테이션은 스스로 아무 일도 하지 않는다

가장 먼저 깨야 할 오해가 있습니다. 애너테이션 자체에는 어떤 로직도 들어 있지 않습니다. `@Entity`를 붙인다고 해서 그 자리에서 무슨 코드가 실행되는 게 아닙니다. 애너테이션은 코드에 붙는 **태그**일 뿐이고, 그 태그를 읽고 의미를 부여하는 것은 전적으로 다른 코드(컴파일러, 프레임워크, 리플렉션)입니다.

![애너테이션은 메타데이터일 뿐, 읽는 코드가 의미를 준다](/assets/posts/java-annotation-basics-concept.svg)

이 분리를 이해하는 것이 핵심입니다. `@Test`를 붙인 메서드가 테스트로 실행되는 이유는, JUnit이 클래스를 스캔하다가 `@Test`가 붙은 메서드를 찾아 호출하기 때문입니다. 애너테이션은 "여기를 보라"는 표지판이고, 실제 행동은 그 표지판을 읽는 쪽이 합니다.

## 직접 선언하기 — @interface

애너테이션은 `@interface` 키워드로 선언합니다. 일반 인터페이스와 비슷해 보이지만 `@`가 앞에 붙습니다.

![@interface로 애너테이션을 선언하고 요소를 정의](/assets/posts/java-annotation-basics-declare.svg)

```java
public @interface Schedule {
    String cron();                // 필수 요소
    int retries() default 3;      // 기본값이 있는 요소
}
```

애너테이션 안에 선언하는 메서드 모양의 멤버를 **요소(element)** 라고 부릅니다. 위 `Schedule`은 `cron`과 `retries` 두 요소를 갖습니다. `default`로 기본값을 주면, 사용할 때 그 요소를 생략할 수 있습니다.

사용하는 쪽은 이렇게 값을 채웁니다.

```java
@Schedule(cron = "0 0 * * *")        // retries는 기본값 3
void nightlyJob() { ... }

@Schedule(cron = "*/5 * * * *", retries = 5)
void frequentJob() { ... }
```

## 요소 타입의 제약과 단축 문법

애너테이션 요소에 아무 타입이나 쓸 수는 없습니다. 컴파일 시점에 상수로 확정되어야 하므로, 허용되는 타입이 제한적입니다.

```text
허용되는 요소 타입:
  • 기본형 (int, long, boolean ...)
  • String
  • Class  (예: Class<?> handler())
  • enum
  • 다른 애너테이션
  • 위 타입들의 배열
```

객체나 임의의 컬렉션은 쓸 수 없습니다. 또 유용한 단축 문법이 둘 있습니다.

```java
// 1) value라는 이름의 요소는 이름을 생략할 수 있다
public @interface Role { String value(); }
@Role("ADMIN")          // @Role(value = "ADMIN")과 동일

// 2) 배열 요소에 값이 하나면 중괄호를 생략할 수 있다
public @interface Roles { String[] value(); }
@Roles("ADMIN")         // @Roles({"ADMIN"})과 동일
```

`value`라는 이름은 특별해서, 그 요소만 채울 때 `value =`를 생략하고 바로 값을 적을 수 있습니다. 우리가 `@SuppressWarnings("unchecked")`를 짧게 쓰는 이유가 이것입니다.

## 누가 읽는가 — 세 부류의 소비자

선언한 애너테이션은 결국 누군가 읽어야 의미가 생깁니다. 소비자는 크게 셋입니다.

```java
// 리플렉션으로 런타임에 읽기 (가장 흔한 방식)
Method m = job.getClass().getMethod("nightlyJob");
if (m.isAnnotationPresent(Schedule.class)) {
    Schedule s = m.getAnnotation(Schedule.class);
    System.out.println(s.cron());     // "0 0 * * *"
    System.out.println(s.retries());  // 3 (기본값)
}
```

- **컴파일러** — `@Override`, `@Deprecated`처럼 컴파일 단계에서 검사·경고에 쓰입니다.
- **리플렉션** — 위 예처럼 런타임에 `getAnnotation`으로 읽어 행동을 결정합니다. 스프링·JPA·JUnit이 이 방식입니다.
- **애너테이션 처리기(annotation processor)** — 컴파일 시점에 애너테이션을 읽어 새 코드를 생성합니다(Lombok, MapStruct 등).

다만 모든 애너테이션이 런타임까지 살아남는 것은 아닙니다. 어떤 것은 컴파일 후 사라지고, 어떤 것은 `.class`에 남으며, 어떤 것만 런타임 리플렉션으로 읽힙니다. 이 "생존 기간"과 "붙일 수 있는 위치"를 결정하는 것이 메타 애너테이션인데, 그 이야기는 두 글 뒤에서 다룹니다. 그 전에 다음 글에서 자바가 기본 제공하는 내장 애너테이션부터 살펴봅니다.

## 정리

- 애너테이션은 코드의 동작을 바꾸지 않고 **정보(메타데이터)만 덧붙이는** 태그이며, 의미는 그것을 읽는 코드가 부여한다.
- `@interface`로 선언하고, 내부의 메서드 모양 멤버를 **요소(element)** 라 부른다. `default`로 기본값을 줄 수 있다.
- 요소 타입은 기본형·String·Class·enum·애너테이션과 그 배열로 제한된다.
- `value` 요소는 이름을 생략할 수 있고, 배열 값이 하나면 중괄호를 생략할 수 있다.
- 소비자는 컴파일러, 리플렉션(런타임), 애너테이션 처리기(컴파일 시점) 세 부류다.
- 애너테이션의 생존 기간과 적용 위치는 메타 애너테이션이 결정하며, 이는 이후 글에서 다룬다.

---

**지난 글:** [MethodHandles — 리플렉션보다 빠른 메서드 핸들](/posts/java-method-handles/)

**다음 글:** [내장 애너테이션 — @Override·@Deprecated·@SuppressWarnings](/posts/java-built-in-annotations/)

<br>
읽어주셔서 감사합니다. 😊
