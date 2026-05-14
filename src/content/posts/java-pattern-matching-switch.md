---
title: "Java 패턴 매칭 switch 완전 정리"
description: "Java 21에 정식 도입된 패턴 매칭 switch의 타입 패턴, Guarded Pattern(when 절), null 처리, sealed class 완전성 검사, 그리고 레코드 패턴까지 실전 예제 중심으로 완전히 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "패턴 매칭", "pattern matching", "switch", "when절", "guarded pattern", "sealed class", "record pattern", "타입 패턴", "Java 21"]
featured: false
draft: false
---

[지난 글](/posts/java-switch-expression/)에서 Java 14에 도입된 switch 표현식의 화살표 레이블과 yield를 살펴봤다. 이번에는 그 위에 쌓인 강력한 기능인 **패턴 매칭 switch(Pattern Matching for switch)**를 정리한다. Java 17부터 Preview를 거쳐 **Java 21(JEP 441)**에 정식 도입됐다.

## 패턴 매칭 switch가 필요한 이유

Java에서 타입에 따라 분기하는 코드는 오랫동안 `instanceof + if-else` 체인으로 작성했다. 이 방식은 분기가 늘어날수록 중첩이 깊어지고, 타입 체크와 캐스팅이 분리되어 반복 코드가 생긴다. 패턴 매칭 switch는 이 문제를 switch 표현식 문법 위에서 우아하게 해결한다.

## 타입 패턴(Type Pattern)

가장 기본적인 형태다. `case 타입 변수명` 처럼 쓰면 타입 검사와 바인딩 변수 선언이 한 줄에 이루어진다.

```java
static String describe(Object o) {
    return switch (o) {
        case Integer i -> "정수: " + i;
        case String  s -> "문자열 길이: " + s.length();
        case Double  d -> "실수: " + d;
        default        -> "기타: " + o.getClass().getSimpleName();
    };
}
```

case 안에서 바인딩 변수(`i`, `s`, `d`)는 해당 분기 범위에서만 유효하며, 추가 캐스팅 없이 해당 타입의 멤버에 바로 접근할 수 있다.

![패턴 매칭 switch — 타입 패턴 vs 전통 방식](/assets/posts/java-pattern-matching-switch-types.svg)

## Guarded Pattern — when 절

타입이 일치해도 추가 조건을 걸고 싶을 때 `when` 키워드를 쓴다. 전통 방식으로는 case 안에서 다시 if를 중첩해야 했던 로직을 한 줄로 표현한다.

```java
static String classify(Object o) {
    return switch (o) {
        case Integer i when i > 0  -> "양수 정수";
        case Integer i when i < 0  -> "음수 정수";
        case Integer i             -> "0";
        case String  s when s.isBlank() -> "빈 문자열";
        case String  s             -> "문자열: " + s;
        default                    -> "기타";
    };
}
```

평가 순서는 ① 타입 일치 여부 → ② `when` 조건 평가 → ③ true이면 해당 case 선택, false이면 다음 case로 이동이다. when 절이 없는 case는 타입만 일치하면 매칭된다.

## null 처리

기존 switch는 null을 받으면 `NullPointerException`을 던졌다. 패턴 매칭 switch에서는 `case null`을 명시적으로 추가해 null을 안전하게 처리할 수 있다.

```java
static String safe(Object o) {
    return switch (o) {
        case null      -> "null 값";
        case Integer i -> "정수: " + i;
        case String  s -> "문자열: " + s;
        default        -> "기타";
    };
}
```

`case null`은 항상 다른 타입 패턴보다 먼저 작성하는 것이 권장된다. `case null, default ->` 처럼 null과 default를 한 case에 묶는 것도 가능하다.

## sealed class와 완전성 검사

sealed class 또는 sealed interface를 selector 타입으로 사용하면 컴파일러가 모든 허용된 서브타입을 커버했는지 검사한다. 모든 서브타입을 case에 나열했다면 `default`를 생략할 수 있다.

```java
sealed interface Shape permits Circle, Rect, Triangle {}
record Circle(double r)              implements Shape {}
record Rect(double w, double h)      implements Shape {}
record Triangle(double b, double h)  implements Shape {}

static double area(Shape s) {
    return switch (s) {
        case Circle   c -> Math.PI * c.r() * c.r();
        case Rect     r -> r.w() * r.h();
        case Triangle t -> t.b() * t.h() / 2;
        // default 없음 — Circle, Rect, Triangle 3개가 전부이므로
    };
}
```

나중에 `sealed interface`에 새 서브타입이 추가되면 이 switch를 갱신하지 않은 코드는 **컴파일 에러**가 난다. 런타임이 아닌 컴파일 시점에 누락을 잡는다는 점이 큰 장점이다.

![Guarded Pattern과 sealed class 완전성 검사](/assets/posts/java-pattern-matching-switch-guarded.svg)

## 레코드 패턴(Record Pattern)

Java 21(JEP 440)에서 레코드 패턴도 함께 정식 도입됐다. switch에서 레코드의 컴포넌트를 곧바로 분해(deconstruct)해 바인딩 변수로 쓸 수 있다.

```java
record Point(int x, int y) {}

static String describe(Object o) {
    return switch (o) {
        case Point(int x, int y) when x == y  -> "대각선 점 (" + x + ")";
        case Point(int x, int y) when x == 0  -> "Y축 위 점 y=" + y;
        case Point(int x, int y)              -> "점 (" + x + ", " + y + ")";
        default                               -> "기타";
    };
}
```

레코드 패턴은 중첩도 지원한다. `case Wrapper(Point(int x, int y))` 처럼 감싸진 레코드 내부까지 한 번에 분해할 수 있다.

## 패턴 매칭 switch와 enum

기존 enum switch도 패턴 매칭 문법으로 쓸 수 있다. sealed interface를 구현한 enum이라면 완전성 검사도 동작한다.

```java
enum Status { OPEN, CLOSED, PENDING }

static String label(Status s) {
    return switch (s) {
        case OPEN    -> "영업 중";
        case CLOSED  -> "영업 종료";
        case PENDING -> "대기 중";
    };
}
```

모든 enum 상수를 나열하면 `default` 없이도 컴파일된다. enum에 상수가 추가되면 컴파일 에러로 누락을 즉시 알 수 있다.

## 주의 사항

**도달 불가 패턴(dominance)**: 더 구체적인 패턴이 더 일반적인 패턴보다 뒤에 오면 컴파일 에러가 난다. 예를 들어 `case Integer i` 뒤에 `case Integer i when i > 0`을 쓰면 두 번째 case는 절대 도달할 수 없으므로 오류다.

```java
// 컴파일 에러 — case Integer i가 모든 Integer를 가로챔
case Integer i        -> "정수";
case Integer i when i > 0 -> "양수"; // ERROR: 도달 불가
```

**올바른 순서**: 좁은 조건(guarded)을 먼저, 넓은 조건을 나중에 배치한다.

```java
// 올바른 순서
case Integer i when i > 0 -> "양수";
case Integer i            -> "0 또는 음수";
```

## 정리

패턴 매칭 switch는 타입 검사·캐스팅·분기를 하나의 case 구문으로 통합하고, `when` 절로 추가 조건을 인라인으로 표현한다. sealed class와 결합하면 컴파일 타임 완전성 검사가 보장되고, 레코드 패턴으로는 구조 분해까지 한 줄에 가능하다. Java 21부터는 `if-else instanceof` 체인보다 패턴 매칭 switch를 우선 고려하는 것이 좋다. 다음 글에서는 배열의 기초부터 다차원 배열까지 살펴본다.

---

**지난 글:** [Java switch 표현식 완전 정리](/posts/java-switch-expression/)

**다음 글:** [Java 배열 기초 완전 정리](/posts/java-arrays-basics/)

<br>
읽어주셔서 감사합니다. 😊
