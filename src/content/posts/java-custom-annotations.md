---
title: "커스텀 애너테이션 만들기 — @interface로 직접 선언하기"
description: "@interface 키워드로 나만의 애너테이션을 선언하고, 요소(element)와 default, value의 특별 규칙을 정리합니다. 그리고 런타임 리플렉션으로 애너테이션을 읽어 동작을 분기하는 작은 벤치마크 러너를 직접 만들어 봅니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "애너테이션", "커스텀 애너테이션", "리플렉션", "@interface"]
featured: false
draft: false
---

[지난 글](/posts/java-meta-annotations/)에서 `@Retention`과 `@Target` 같은 메타 애너테이션을 정리했습니다. 메타 애너테이션은 "애너테이션을 만들 때 붙이는 규칙"이었죠. 그렇다면 그 규칙이 붙는 대상, 즉 **애너테이션 자체**는 어떻게 직접 만들까요? 스프링의 `@Service`, JUnit의 `@Test`처럼 우리가 쓰는 거의 모든 애너테이션은 누군가가 `@interface` 한 줄로 선언한 결과입니다. 이번 글에서는 직접 선언하는 문법과, 선언한 애너테이션을 런타임에 읽어 실제로 동작을 바꾸는 과정까지 한 번에 살펴봅니다.

## @interface — 애너테이션도 타입이다

애너테이션은 `interface` 앞에 `@`를 붙인 특수한 인터페이스입니다. 컴파일러는 이를 `java.lang.annotation.Annotation`을 상속한 타입으로 변환합니다. 아래는 메서드의 실행 횟수를 표시하는 `@Benchmark` 애너테이션 선언입니다.

```java
import java.lang.annotation.*;
import static java.lang.annotation.RetentionPolicy.RUNTIME;
import static java.lang.annotation.ElementType.METHOD;

@Retention(RUNTIME)
@Target(METHOD)
public @interface Benchmark {
    String value() default "";
    int iterations() default 10;
    Class<?>[] tags() default {};
}
```

선언 위에 메타 애너테이션 `@Retention(RUNTIME)`과 `@Target(METHOD)`을 먼저 붙였습니다. RUNTIME이어야 리플렉션으로 읽을 수 있고, METHOD로 적용 위치를 메서드에 한정했습니다. 그 아래 `value()`, `iterations()`, `tags()`가 이 애너테이션의 **요소(element)** 입니다.

![@interface 선언 구조](/assets/posts/java-custom-annotations-anatomy.svg)

## 요소는 메서드처럼 생겼지만 속성이다

요소는 문법적으로 추상 메서드처럼 보이지만, 실제로는 애너테이션이 가질 수 있는 **속성**을 정의합니다. 몇 가지 규칙이 있습니다.

- 반환형이 곧 속성의 타입입니다. 허용되는 타입은 기본형, `String`, `Class`, 열거형, 다른 애너테이션, 그리고 이들의 배열뿐입니다. 임의의 객체 타입은 쓸 수 없습니다.
- 매개변수를 가질 수 없고 `throws`도 붙일 수 없습니다.
- `default`로 기본값을 주면 사용할 때 그 속성을 생략할 수 있습니다. 기본값이 없으면 사용 시 반드시 값을 지정해야 합니다.

사용하는 쪽은 이렇게 됩니다. 기본값이 있는 속성은 생략하면 됩니다.

```java
public class StringOps {

    @Benchmark(value = "문자열 연결", iterations = 1000)
    public void concat() { /* ... */ }

    @Benchmark   // value="", iterations=10 (기본값)
    public void builder() { /* ... */ }
}
```

## value()의 특별 대우

요소 이름이 `value` 하나뿐이거나, 다른 요소가 모두 기본값을 가져 `value`만 지정하면 되는 경우에는 **이름을 생략**할 수 있습니다. `@SuppressWarnings("unchecked")`가 `@SuppressWarnings(value = "unchecked")`의 줄임인 이유가 이것입니다.

```java
@Benchmark("정렬 성능")   // value = "정렬 성능" 과 동일
public void sort() { /* ... */ }
```

또 배열 요소에 값이 하나뿐이면 중괄호도 생략할 수 있습니다. `tags = "io"`는 `tags = {"io"}`와 같습니다. 이 두 단축 규칙 덕분에 애너테이션이 간결해 보이는 것이죠.

## 리플렉션으로 읽어 동작시키기

애너테이션은 선언만으로는 아무 일도 하지 않습니다. **누군가 읽어서 해석해야** 비로소 의미가 생깁니다. RUNTIME 보존 정책이면 리플렉션 API로 읽을 수 있습니다. 핵심 메서드는 `isAnnotationPresent`와 `getAnnotation`입니다.

![리플렉션으로 애너테이션 읽기](/assets/posts/java-custom-annotations-reflection.svg)

`@Benchmark`가 붙은 메서드만 골라 지정된 횟수만큼 실행하고 평균 시간을 재는 작은 러너를 만들어 보겠습니다.

```java
public static void runAll(Object target) throws Exception {
    for (Method m : target.getClass().getDeclaredMethods()) {
        if (!m.isAnnotationPresent(Benchmark.class)) continue;

        Benchmark b = m.getAnnotation(Benchmark.class);
        String name = b.value().isEmpty() ? m.getName() : b.value();

        long start = System.nanoTime();
        for (int i = 0; i < b.iterations(); i++) {
            m.invoke(target);
        }
        long avg = (System.nanoTime() - start) / b.iterations();
        System.out.printf("%-12s %,d ns/op%n", name, avg);
    }
}
```

`getAnnotation`이 돌려주는 `Benchmark` 객체는 런타임이 만들어 준 동적 프록시입니다. `b.iterations()`를 호출하면 선언에 적은 값(또는 기본값 10)이 그대로 반환됩니다. 즉 애너테이션의 속성은 메서드 호출처럼 접근합니다.

## 정리

`@interface`로 선언하는 커스텀 애너테이션은 그 자체로는 메타데이터에 불과하지만, 리플렉션과 결합하면 강력한 선언적 프로그래밍 도구가 됩니다. 스프링이 `@Transactional` 하나로 트랜잭션을 열고 닫는 것도 결국 이 패턴 — 애너테이션을 읽어 동작을 끼워 넣는 — 의 정교한 확장입니다. 다만 위 러너는 RUNTIME 리플렉션에 의존합니다. 만약 **컴파일 시점에** 애너테이션을 읽어 코드를 생성하거나 검증하고 싶다면 다른 메커니즘이 필요합니다. 다음 글에서 다룰 애너테이션 프로세싱이 바로 그것입니다.

---

**지난 글:** [메타 애너테이션 — @Retention·@Target·@Documented·@Inherited](/posts/java-meta-annotations/)

**다음 글:** [애너테이션 프로세싱 — 컴파일 시점에 코드 읽고 생성하기](/posts/java-annotation-processing/)

<br>
읽어주셔서 감사합니다. 😊
