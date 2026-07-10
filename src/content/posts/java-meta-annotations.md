---
title: "메타 애너테이션 — @Retention·@Target·@Documented·@Inherited"
description: "메타 애너테이션은 애너테이션에 붙는 애너테이션으로, 생존 기간과 적용 위치 같은 규칙을 정합니다. @Retention의 SOURCE/CLASS/RUNTIME, @Target의 적용 대상, @Documented와 @Inherited의 역할을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "애너테이션", "메타 애너테이션", "@Retention", "@Target", "@Inherited"]
featured: false
draft: false
---

[지난 글](/posts/java-built-in-annotations/)에서 `@Override` 같은 내장 애너테이션을 봤습니다. 그리고 그 앞에서 애너테이션을 직접 `@interface`로 선언하는 법도 다뤘죠. 그런데 한 가지 질문이 남아 있었습니다 — 내가 만든 애너테이션을 스프링처럼 **리플렉션으로 읽으려면** 어떻게 해야 할까요? 또 "이 애너테이션은 메서드에만 붙일 수 있다"는 제약은 누가 정할까요? 답은 **메타 애너테이션(meta-annotation)** 입니다. 애너테이션 선언 위에 붙는, 애너테이션을 위한 애너테이션입니다. 이번 글은 가장 중요한 네 가지 — `@Retention`, `@Target`, `@Documented`, `@Inherited` — 를 정리하며 애너테이션 편을 마무리합니다.

## @Retention — 언제까지 살아남는가

가장 중요한 메타 애너테이션입니다. 애너테이션이 컴파일과 실행 과정에서 **어느 단계까지 유지되는지**를 정합니다. 값은 `RetentionPolicy` 열거형의 셋 중 하나입니다.

![SOURCE·CLASS·RUNTIME 세 생존 기간](/assets/posts/java-meta-annotations-retention.svg)

- `SOURCE` — 소스 코드에만 있고, 컴파일되면 사라집니다. `.class` 파일에 남지 않습니다. `@Override`나 Lombok처럼 컴파일 시점에만 쓰이는 애너테이션이 해당합니다.
- `CLASS` — `.class` 파일에는 기록되지만, JVM이 클래스를 로드할 때 메모리에 올리지 않습니다. **기본값**이며, 바이트코드 분석 도구가 주로 씁니다.
- `RUNTIME` — `.class`에 남고, 런타임에 JVM이 메모리에 적재해 **리플렉션으로 읽을 수 있습니다.**

여기서 실무에서 가장 흔히 빠지는 함정이 나옵니다. 직접 만든 애너테이션을 `getAnnotation`으로 읽으려는데 `null`이 나온다면, 십중팔구 `@Retention`을 빠뜨려 기본값 `CLASS`가 적용됐기 때문입니다. 런타임에 읽으려면 **반드시** `@Retention(RetentionPolicy.RUNTIME)`을 명시해야 합니다.

```java
import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)   // 이게 없으면 리플렉션으로 안 읽힌다
public @interface Schedule {
    String cron();
}
```

## @Target — 어디에 붙일 수 있는가

`@Target`은 애너테이션을 **붙일 수 있는 위치**를 제한합니다. 값은 `ElementType` 열거형의 배열입니다.

```java
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface Schedule {
    String cron();
}
```

이렇게 선언하면 `Schedule`은 메서드와 타입(클래스/인터페이스)에만 붙일 수 있고, 필드에 붙이면 **컴파일 에러**가 납니다. 자주 쓰는 `ElementType` 값은 다음과 같습니다.

```text
TYPE             클래스, 인터페이스, enum
METHOD           메서드
FIELD            필드
PARAMETER        메서드 파라미터
CONSTRUCTOR      생성자
LOCAL_VARIABLE   지역 변수
ANNOTATION_TYPE  다른 애너테이션 (메타 애너테이션용)
TYPE_PARAMETER   제네릭 타입 파라미터 (Java 8+)
TYPE_USE         타입이 쓰이는 모든 곳 (Java 8+)
```

`@Target`을 생략하면 어디에나 붙일 수 있지만, 의도를 명확히 하고 오용을 막기 위해 적절히 제한하는 것이 좋습니다. 특히 `TYPE_USE`는 자바 8에서 추가되어, `@NonNull String` 같은 타입 자체에 대한 애너테이션을 가능하게 했습니다.

## @Documented — 문서에 드러낼 것인가

`@Documented`는 단순합니다. 이 애너테이션을 붙이면, Javadoc 같은 API 문서 생성 도구가 그 애너테이션을 **문서에 포함**시킵니다.

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ApiVersion {
    String value();
}
```

기본적으로 애너테이션은 생성 문서에 나타나지 않습니다. 하지만 `@ApiVersion("2.0")`처럼 그 자체가 API 계약의 일부인 애너테이션이라면, 문서를 읽는 사람도 볼 수 있어야 합니다. 그럴 때 `@Documented`를 붙입니다. 동작에는 영향이 없고, 순전히 문서화 관점의 표시입니다.

## @Inherited — 하위 클래스로 상속되는가

`@Inherited`는 클래스에 붙은 애너테이션이 **하위 클래스에도 상속되도록** 만듭니다. 기본적으로 애너테이션은 상속되지 않습니다.

```java
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Auditable {}

@Auditable
class BaseEntity {}

class User extends BaseEntity {}   // @Auditable이 없어도...

// User.class.isAnnotationPresent(Auditable.class) == true
```

`@Inherited` 덕분에 `User`에 직접 `@Auditable`을 붙이지 않아도, 리플렉션으로 조회하면 상속받은 것으로 인식됩니다. 단 두 가지 제약이 있습니다. 첫째, **클래스 애너테이션에만** 효과가 있습니다 — 메서드나 필드에 붙은 애너테이션은 `@Inherited`가 있어도 상속되지 않습니다. 둘째, 인터페이스 구현으로는 전파되지 않고 클래스 상속(`extends`)만 따릅니다.

![@Retention·@Target·@Documented·@Inherited 정리](/assets/posts/java-meta-annotations-four.svg)

## 전형적인 커스텀 애너테이션 선언

이 넷을 조합하면, 실무에서 보는 전형적인 커스텀 애너테이션 선언이 완성됩니다.

```java
import java.lang.annotation.*;

@Documented
@Retention(RetentionPolicy.RUNTIME)   // 리플렉션으로 읽는다
@Target(ElementType.METHOD)            // 메서드에만
public @interface Retry {
    int maxAttempts() default 3;
    long backoffMs() default 1000;
}
```

이렇게 선언해 두면, AOP나 인터셉터가 런타임에 `@Retry`가 붙은 메서드를 찾아 재시도 로직을 두를 수 있습니다. 앞의 글들에서 본 리플렉션과 동적 프록시가, 바로 이런 애너테이션을 읽어 동작하는 것입니다 — 애너테이션·리플렉션·프록시가 하나의 그림으로 이어집니다.

## 정리

- 메타 애너테이션은 애너테이션 선언에 붙어 그 **규칙**을 정하는, 애너테이션을 위한 애너테이션이다.
- `@Retention`은 생존 기간(SOURCE/CLASS/RUNTIME)을 정하며, **리플렉션으로 읽으려면 반드시 RUNTIME**이어야 한다(기본값 CLASS는 런타임에 안 보임).
- `@Target`은 적용 위치(TYPE/METHOD/FIELD 등)를 제한하며, 어긋난 위치에 붙이면 컴파일 에러가 난다.
- `@Documented`는 애너테이션을 생성 문서(Javadoc)에 노출시키는 표시로, 동작에는 영향이 없다.
- `@Inherited`는 **클래스** 애너테이션을 하위 클래스로 상속시키며, 메서드·필드나 인터페이스 구현에는 효과가 없다.
- 이 넷을 조합한 커스텀 애너테이션을 리플렉션·동적 프록시가 읽어 동작하면서, 메타프로그래밍의 그림이 완성된다.

---

**지난 글:** [내장 애너테이션 — @Override·@Deprecated·@SuppressWarnings](/posts/java-built-in-annotations/)

**다음 글:** [커스텀 애너테이션 만들기 — @interface로 직접 선언하기](/posts/java-custom-annotations/)

<br>
읽어주셔서 감사합니다. 😊
