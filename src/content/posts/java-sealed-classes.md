---
title: "Java Sealed 클래스 — permits로 상속 계층 봉인하기"
description: "Java 17에서 정식 도입된 sealed 클래스와 인터페이스의 문법, permits 키워드로 허용 구현체를 지정하는 방법, final·sealed·non-sealed 세 가지 하위 타입 제약, 그리고 패턴 매칭 switch와의 조합으로 얻는 완전성 검사를 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "sealed class", "permits", "패턴 매칭", "switch expression", "대수적 타입", "Java 17"]
featured: false
draft: false
---

[지난 글](/posts/java-multiple-inheritance/)에서 인터페이스 다중 상속과 default 메서드 충돌 해결 규칙을 살펴봤다. 이번에는 Java 17에서 정식 출시된 **sealed 클래스**를 다룬다. sealed는 상속 계층을 명시적으로 봉인(seal)하는 기능으로, 어떤 클래스가 이 타입을 구현·상속할 수 있는지를 소스 코드에 직접 선언한다.

## sealed가 필요한 이유

전통적인 Java 타입 계층에는 두 가지 극단이 있었다. `public class`는 누구나 상속할 수 있어 완전히 열려 있고, `final class`는 아무도 상속할 수 없어 완전히 닫혀 있다. 이 사이에 "허가된 특정 클래스들만 상속"이라는 중간 지점이 없었다.

```java
// 전통 방식: 열린 계층 — 누구나 추가 가능
public abstract class Shape { }           // 외부에서도 extends 가능
public class Circle    extends Shape { }
public class Rectangle extends Shape { }
// 제3자가 Star, Pentagon 등 무한히 추가 가능
```

도메인 모델, 대수적 데이터 타입(ADT), 상태 머신 등에서는 가능한 타입 집합이 컴파일 타임에 확정되길 원한다. 이때 sealed가 정확히 그 역할을 한다.

## sealed 선언 문법

```java
public sealed interface Shape
    permits Circle, Rectangle, Triangle { }

public record Circle(double radius) implements Shape { }
public record Rectangle(double width, double height) implements Shape { }
public non-sealed class Triangle implements Shape {
    // 외부에서 자유롭게 상속 가능
}
```

`sealed` 키워드 뒤에 `permits` 절로 허용할 직속 하위 타입을 나열한다. 나열된 타입 외에는 컴파일 타임에 구현이 거부된다.

## 하위 타입의 세 가지 의무

permits에 등장한 각 클래스는 반드시 세 가지 중 하나를 선택해야 한다.

```java
// 1. final — 더 이상 확장 불가
public final class Circle implements Shape { }

// 2. sealed — 한 단계 더 봉인 (자신도 permits 필요)
public sealed class Rectangle implements Shape
    permits SpecialRect { }
public final class SpecialRect extends Rectangle { }

// 3. non-sealed — 제한 해제, 누구나 상속 가능
public non-sealed class Triangle implements Shape { }
public class IsoscelesTri extends Triangle { }  // OK
```

`sealed` 하위 타입 자체도 `sealed`를 선택할 수 있어, 계층을 단계적으로 봉인할 수 있다.

![Sealed Class 계층 구조 — permits와 세 가지 하위 타입 제약](/assets/posts/java-sealed-classes-hierarchy.svg)

## 같은 패키지/모듈 규칙

permits에 나열된 모든 클래스는 반드시 sealed 클래스와 **같은 패키지**(unnamed module) 또는 **같은 모듈**(named module) 안에 있어야 한다.

```java
package com.example.shapes;

// OK: 같은 패키지 안
public sealed class Shape permits Circle, Rectangle { }
public final class Circle    extends Shape { }
public final class Rectangle extends Shape { }

// 컴파일 에러: 다른 패키지
// package com.other;
// public final class Oval extends Shape { }  // 불가
```

같은 파일에 여러 클래스를 선언할 수도 있다. 이 경우 permits 절 자체를 생략할 수 있다.

```java
// Shape.java 하나의 파일 안
public sealed class Shape permits Circle, Rectangle { }
final class Circle    extends Shape { }
final class Rectangle extends Shape { }
```

## 패턴 매칭 switch와의 결합

sealed의 진정한 힘은 패턴 매칭 `switch` (Java 21)와 만날 때 발휘된다. 컴파일러는 sealed 계층의 모든 타입이 처리됐는지 **완전성(exhaustiveness)**을 정적으로 검사한다.

```java
double area(Shape s) {
    return switch (s) {
        case Circle c    -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.width() * r.height();
        case Triangle t  -> 0.5 * t.base() * t.height();
        // Triangle이 non-sealed이므로 default 또는 명시적 처리 필요
    };
}
```

`Circle`, `Rectangle`만 처리하고 `Triangle`을 빠뜨리면 컴파일 에러가 발생한다. `default` 없이도 sealed 계층이 완전히 커버됐을 때만 컴파일이 통과한다.

![Sealed 클래스 선언과 패턴 매칭 switch 코드 예시](/assets/posts/java-sealed-classes-switch.svg)

## sealed interface

클래스뿐 아니라 인터페이스도 sealed로 선언할 수 있다. record와 조합하면 간결한 대수적 데이터 타입이 된다.

```java
public sealed interface JsonValue
    permits JsonNull, JsonBool, JsonNumber, JsonString, JsonArray, JsonObject { }

public record JsonNull()              implements JsonValue { }
public record JsonBool(boolean value) implements JsonValue { }
public record JsonNumber(double value) implements JsonValue { }
public record JsonString(String value) implements JsonValue { }
// JsonArray, JsonObject도 record나 final class로 구현
```

JSON 파서 등에서 `JsonValue`를 switch할 때 모든 타입이 처리됐는지 컴파일러가 보장한다.

## abstract sealed 클래스

sealed와 abstract를 함께 사용해 공통 구현을 올릴 수 있다.

```java
public abstract sealed class Vehicle
    permits Car, Truck, Motorcycle {
    protected final String licensePlate;
    protected Vehicle(String plate) { this.licensePlate = plate; }
    abstract int maxPassengers();
}

public final class Car extends Vehicle {
    public Car(String plate) { super(plate); }
    @Override public int maxPassengers() { return 5; }
}
```

추상 sealed 클래스는 공통 필드와 템플릿 메서드를 제공하면서도 허용 구현체를 제한한다.

## 리플렉션으로 permits 목록 조회

런타임에 `getPermittedSubclasses()` 메서드로 허용된 하위 타입 목록을 확인할 수 있다.

```java
Class<?> shapeClass = Shape.class;
if (shapeClass.isSealed()) {
    Class<?>[] permitted = shapeClass.getPermittedSubclasses();
    for (Class<?> sub : permitted) {
        System.out.println(sub.getSimpleName());
        // Circle, Rectangle, Triangle 출력
    }
}
```

프레임워크나 직렬화 라이브러리에서 sealed 타입의 하위 타입을 자동 등록할 때 유용하다.

## 상속 제약 규칙 정리

| 하위 타입 선택지 | 추가 상속 가능? | 설명 |
|---|---|---|
| `final` | 불가 | 완전 봉인, 리프 노드 |
| `sealed` | permits에 나열된 것만 | 계층 중간 단계 |
| `non-sealed` | 누구나 가능 | 열린 확장 허용 |

## 실전 활용 시나리오

**상태 머신 모델링**: 결제 상태를 `sealed`로 닫으면 switch에서 누락된 상태가 컴파일 에러로 잡힌다.

```java
public sealed interface PaymentStatus
    permits Pending, Authorized, Captured, Refunded, Failed { }
```

**도메인 이벤트**: CQRS/이벤트소싱에서 이벤트 타입을 sealed로 한정하면 이벤트 핸들러의 완전성을 컴파일 타임에 보장한다.

**AST 노드**: 컴파일러나 인터프리터를 만들 때 표현식 노드를 sealed interface로 정의하면 방문자 패턴 없이 패턴 매칭으로 간결하게 처리한다.

sealed 클래스는 단순한 접근 제한 그 이상이다. 코드 가독성, 컴파일 타임 안전성, 패턴 매칭 완전성 검사를 동시에 제공한다. 다음 글에서는 Java 16에서 정식 출시된 **record 클래스**를 다룬다. 불변 데이터 운반 객체를 한 줄로 선언하는 방법을 살펴볼 것이다.

---

**지난 글:** [Java 다중 상속 — default 메서드와 다이아몬드 문제 해결](/posts/java-multiple-inheritance/)

**다음 글:** [Java Record — 불변 데이터 클래스를 한 줄로 선언하기](/posts/java-records/)

<br>
읽어주셔서 감사합니다. 😊
