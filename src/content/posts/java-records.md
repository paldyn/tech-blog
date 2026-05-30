---
title: "Java Record — 불변 데이터 클래스를 한 줄로 선언하기"
description: "Java 16에서 정식 출시된 record 클래스의 문법과 자동 생성 멤버, 컴팩트 생성자로 유효성 검사 추가하는 방법, 인터페이스 구현과 커스텀 메서드 추가, 그리고 record의 제약사항과 활용 패턴을 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "record", "불변 객체", "데이터 클래스", "컴팩트 생성자", "Java 16", "보일러플레이트"]
featured: false
draft: false
---

[지난 글](/posts/java-sealed-classes/)에서 sealed 클래스로 상속 계층을 봉인하는 방법을 살펴봤다. 이번에는 Java 16에서 정식 출시된 **record 클래스**를 다룬다. record는 불변 데이터 운반 객체(DTO, Value Object)를 선언할 때 필요했던 수십 줄의 보일러플레이트 코드를 단 한 줄로 줄여 준다.

## record가 해결하는 문제

전통적인 Java에서 좌표를 표현하는 불변 클래스를 만들려면 필드 선언, 생성자, 접근자, `equals()`, `hashCode()`, `toString()`을 전부 직접 작성해야 했다. 50줄 넘는 코드가 단 두 개의 `int` 값을 담기 위해 필요했다.

```java
// record 한 줄로 위 모든 것을 자동 생성
record Point(int x, int y) { }
```

컴파일러는 `Point(int x, int y)` 생성자, `x()`, `y()` 접근자, `equals()`, `hashCode()`, `toString()`을 자동으로 생성한다.

## 기본 문법

```java
public record Person(String name, int age) { }

// 사용
var p = new Person("Alice", 30);
System.out.println(p.name());     // "Alice"
System.out.println(p.age());      // 30
System.out.println(p);            // Person[name=Alice, age=30]

// equals는 모든 컴포넌트를 비교
var p2 = new Person("Alice", 30);
System.out.println(p.equals(p2)); // true
```

접근자 메서드 이름은 `getName()` 형식이 아니라 컴포넌트 이름 그대로 `name()`, `age()`다. `toString()`은 `Person[name=Alice, age=30]` 형식으로 출력된다.

## 자동 생성 멤버

record 선언 하나로 컴파일러가 생성하는 멤버 목록이다.

```java
record Point(int x, int y) { }
// 자동 생성:
// - public Point(int x, int y)        — 정규 생성자
// - public int x()                    — 컴포넌트 접근자
// - public int y()
// - public boolean equals(Object o)   — 모든 컴포넌트 동등 비교
// - public int hashCode()             — 컴포넌트 기반
// - public String toString()          — Point[x=1, y=2] 형식
```

record는 암묵적으로 `final class`다. 다른 클래스를 `extends`할 수 없고, 다른 클래스가 record를 상속할 수도 없다.

![Record vs 일반 클래스 — 자동 생성 멤버 비교](/assets/posts/java-records-anatomy.svg)

## 컴팩트 생성자

유효성 검사나 정규화 로직이 필요할 때 **컴팩트 생성자(Compact Constructor)**를 사용한다. 파라미터 목록과 `this.x = x` 형태의 할당을 생략하고 검사 로직만 작성한다.

```java
record Range(int min, int max) {
    // 컴팩트 생성자 — 파라미터와 할당 생략
    Range {
        if (min > max) {
            throw new IllegalArgumentException(
                "min(%d) > max(%d)".formatted(min, max));
        }
        // 할당은 컴파일러가 자동으로 처리
    }
}

var r = new Range(1, 10);  // OK
var bad = new Range(10, 1); // IllegalArgumentException
```

컴팩트 생성자 안에서 컴포넌트 값을 수정하면 최종 할당에 반영된다.

```java
record Name(String first, String last) {
    Name {
        // 정규화: 양쪽 공백 제거
        first = first.strip();
        last  = last.strip();
    }
}
```

## 커스텀 메서드와 인터페이스 구현

record 안에 인스턴스 메서드와 static 멤버를 자유롭게 추가할 수 있다.

```java
record Money(long amount, String currency) implements Comparable<Money> {

    // static factory method
    public static Money of(long amount, String currency) {
        return new Money(amount, currency);
    }

    // 인스턴스 메서드
    public Money add(Money other) {
        if (!currency.equals(other.currency))
            throw new IllegalArgumentException("통화 불일치");
        return new Money(amount + other.amount, currency);
    }

    @Override
    public int compareTo(Money other) {
        return Long.compare(this.amount, other.amount);
    }
}
```

인스턴스 필드는 추가할 수 없지만 `static final` 상수는 가능하다.

```java
record Celsius(double value) {
    static final double ABSOLUTE_ZERO = -273.15;

    public Fahrenheit toFahrenheit() {
        return new Fahrenheit(value * 9.0 / 5.0 + 32);
    }
}
record Fahrenheit(double value) { }
```

![Record 고급 기능 — 컴팩트 생성자와 커스텀 메서드](/assets/posts/java-records-features.svg)

## 접근자 오버라이드

자동 생성된 접근자 메서드를 재정의할 수 있다. 시그니처는 동일하게 유지해야 한다.

```java
record Temperature(double celsius) {
    // 접근자 재정의 — 반올림해서 반환
    @Override
    public double celsius() {
        return Math.round(celsius * 10.0) / 10.0;
    }
}
```

## 제네릭 record

record도 타입 파라미터를 가질 수 있다.

```java
record Pair<A, B>(A first, B second) {
    public <C> Pair<B, C> mapSecond(java.util.function.Function<B, C> f) {
        return new Pair<>(second, f.apply(second));
    }
}

var p = new Pair<>("hello", 42);
System.out.println(p.first());  // "hello"
System.out.println(p.second()); // 42
```

## 활용 패턴

**API 응답 DTO**: 외부 API에서 받은 JSON을 매핑할 때 record를 사용하면 역직렬화 후 값 변경을 방지한다.

```java
record UserResponse(long id, String username, String email) { }
```

**메서드 다중 반환값 모사**: Java는 다중 반환을 지원하지 않으므로 record로 대신한다.

```java
record ParseResult(int value, int nextIndex) { }

ParseResult parseInt(String s, int from) {
    // 파싱 로직
    return new ParseResult(42, from + 2);
}
```

**Value Object**: 도메인 모델의 값 객체를 record로 표현하면 equals/hashCode가 의미 있는 값 동등성으로 자동 구현된다.

```java
record CustomerId(UUID value) {
    public static CustomerId generate() {
        return new CustomerId(UUID.randomUUID());
    }
}
```

## record의 제약사항

| 제약 | 설명 |
|---|---|
| 상속 불가 | 암묵적 `final class`, 다른 클래스 extends 불가 |
| 인스턴스 필드 추가 불가 | 컴포넌트만 필드로 허용 |
| `native` 메서드 불가 | 네이티브 메서드 선언 금지 |
| 가변성 없음 | 컴포넌트는 `private final`, setter 없음 |

sealed 인터페이스와 record를 함께 쓰면 불변 대수적 데이터 타입을 간결하게 정의할 수 있다. 다음 글에서는 Java 21에서 추가된 **record 패턴(record pattern)**을 다룬다. 중첩 record 구조를 패턴 매칭으로 분해하는 방법을 살펴볼 것이다.

---

**지난 글:** [Java Sealed 클래스 — permits로 상속 계층 봉인하기](/posts/java-sealed-classes/)

**다음 글:** [Java Record 패턴 — 중첩 구조 분해와 패턴 매칭](/posts/java-record-patterns/)

<br>
읽어주셔서 감사합니다. 😊
