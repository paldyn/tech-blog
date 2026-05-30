---
title: "Java Record 패턴 — 중첩 구조 분해와 패턴 매칭"
description: "Java 21에서 정식 출시된 record 패턴의 문법, instanceof와 switch에서 record 컴포넌트를 즉시 분해 바인딩하는 방법, 중첩 record 패턴, var 타입 추론, when 가드 절을 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "record pattern", "패턴 매칭", "instanceof", "switch expression", "중첩 패턴", "Java 21"]
featured: false
draft: false
---

[지난 글](/posts/java-records/)에서 record 클래스의 선언과 자동 생성 멤버, 컴팩트 생성자를 살펴봤다. 이번에는 Java 21에서 정식 출시된 **record 패턴(record pattern)**을 다룬다. record 패턴은 `instanceof`와 `switch`에서 record의 컴포넌트를 즉시 분해(deconstruct)해 바인딩하는 기능이다.

## record 패턴이란

Java 16에서 `instanceof` 타입 패턴이 도입됐다. 타입 체크와 변수 바인딩을 동시에 할 수 있게 됐지만, record의 내부 컴포넌트를 꺼내려면 여전히 별도 접근자 호출이 필요했다.

```java
// Java 16: 타입 패턴만 있을 때
if (obj instanceof Point p) {
    int x = p.x();  // 접근자 호출 필요
    int y = p.y();
    System.out.println(x + ", " + y);
}

// Java 21: record 패턴 — 컴포넌트 즉시 바인딩
if (obj instanceof Point(int x, int y)) {
    System.out.println(x + ", " + y);  // x, y 바로 사용
}
```

record 패턴은 타입 매칭과 컴포넌트 분해를 한 식으로 처리한다.

## 기본 문법

```java
record Point(int x, int y) { }

Object obj = new Point(3, 4);

// instanceof + record 패턴
if (obj instanceof Point(int x, int y)) {
    double distance = Math.sqrt(x * x + y * y);
    System.out.println("거리: " + distance);
}
```

`Point(int x, int y)` 패턴이 매칭되면 `x`, `y`가 해당 블록 스코프에서 사용 가능한 변수로 선언된다. null이면 매칭되지 않는다.

## 중첩 record 패턴

record 안에 다른 record가 있을 때, 패턴을 중첩해 한 번에 깊숙이 분해할 수 있다.

```java
record Point(int x, int y) { }
record Line(Point start, Point end) { }

Object shape = new Line(new Point(0, 0), new Point(3, 4));

// 중첩 record 패턴 — Line 안의 Point까지 한 번에 분해
if (shape instanceof Line(Point(int x1, int y1), Point(int x2, int y2))) {
    double dx = x2 - x1;
    double dy = y2 - y1;
    System.out.println("길이: " + Math.hypot(dx, dy));  // 5.0
}
```

중첩 깊이에 제한이 없다. `Line` 전체를 변수로 받지 않고 내부 `int` 값에 직접 이름을 붙인다.

![Record 패턴 — instanceof와 중첩 분해 비교](/assets/posts/java-record-patterns-deconstruct.svg)

## switch 표현식에서 record 패턴

`switch` 표현식에서도 record 패턴을 케이스로 사용한다.

```java
sealed interface Shape permits Circle, Rectangle { }
record Circle(double radius)          implements Shape { }
record Rectangle(double width, double height) implements Shape { }

double area(Shape s) {
    return switch (s) {
        case Circle(var r)       -> Math.PI * r * r;
        case Rectangle(var w, var h) -> w * h;
    };
}
```

`var`를 사용하면 타입을 명시하지 않아도 된다. sealed 인터페이스와 함께 쓰면 컴파일러가 완전성을 검사해 빠진 케이스를 컴파일 에러로 잡는다.

## var 타입 추론

record 패턴에서 `var`를 사용하면 컴파일러가 컴포넌트 타입을 추론한다.

```java
record Person(String name, int age) { }

if (obj instanceof Person(var name, var age)) {
    // name: String, age: int 로 추론됨
    System.out.println(name.toUpperCase() + " / " + age);
}
```

모든 컴포넌트가 `var`이면 간결해지지만, 타입이 명확해야 할 때는 명시적 타입이 더 가독성이 좋다.

## when 가드 절

`switch`에서 패턴 매칭 후 추가 조건을 `when` 절로 붙일 수 있다.

```java
String classify(Shape s) {
    return switch (s) {
        case Circle(var r) when r > 100 -> "대형 원";
        case Circle(var r) when r > 10  -> "중형 원";
        case Circle(var r)              -> "소형 원";
        case Rectangle(var w, var h) when w == h -> "정사각형";
        case Rectangle(var w, var h)    -> "직사각형";
    };
}
```

동일한 패턴 타입에 `when` 조건을 달리해 여러 케이스를 정의할 수 있다. 케이스는 위에서 아래로 순서대로 매칭된다.

![Switch + Record 패턴 + Guarded Pattern](/assets/posts/java-record-patterns-switch.svg)

## 제네릭 record 패턴

제네릭 record도 패턴 매칭에서 사용할 수 있다.

```java
record Box<T>(T value) { }

Object obj = new Box<>("hello");

if (obj instanceof Box<String>(var s)) {
    System.out.println(s.toUpperCase());  // "HELLO"
}
```

힙 오염(heap pollution) 가능성이 있는 unchecked 케이스에서는 컴파일 경고가 발생할 수 있다.

## 실전 활용: JSON 트리 순회

sealed interface + record + 패턴 매칭 조합은 AST나 트리 구조 처리에 매우 적합하다.

```java
sealed interface Json
    permits Json.Num, Json.Str, Json.Arr, Json.Obj { }

record Num(double value)           implements Json { }
record Str(String value)           implements Json { }
record Arr(List<Json> items)       implements Json { }
record Obj(Map<String, Json> fields) implements Json { }

String render(Json node) {
    return switch (node) {
        case Num(var v) -> String.valueOf(v);
        case Str(var s) -> "\"" + s + "\"";
        case Arr(var items) ->
            "[" + items.stream().map(this::render)
                  .collect(java.util.stream.Collectors.joining(",")) + "]";
        case Obj(var fields) ->
            "{" + fields.entrySet().stream()
                  .map(e -> "\"" + e.getKey() + "\":" + render(e.getValue()))
                  .collect(java.util.stream.Collectors.joining(",")) + "}";
    };
}
```

재귀 호출과 패턴 매칭을 결합해 방문자 패턴 없이 트리를 순회한다.

## 패턴 매칭과 null

record 패턴은 `null`에 매칭되지 않는다. `null` 케이스를 별도로 처리해야 한다.

```java
switch (shape) {
    case null              -> System.out.println("null");
    case Circle(var r)     -> System.out.println("원, r=" + r);
    case Rectangle(var w, var h) -> System.out.println("사각형");
}
```

Java 21 이후 `switch`에서 `case null`을 명시적으로 쓸 수 있다.

## 지원 버전 정리

| 버전 | 기능 |
|---|---|
| Java 16 | `instanceof` 타입 패턴 정식 출시 |
| Java 17 | sealed 클래스 정식 출시 |
| Java 21 | record 패턴, switch 패턴 매칭 정식 출시 |

record 패턴은 sealed 클래스, switch 표현식과 함께 Java의 함수형 데이터 모델링 능력을 크게 높였다. 다음 글에서는 모든 Java 클래스의 최상위 조상인 **Object 클래스**를 다룬다. `equals`, `hashCode`, `toString` 등 핵심 메서드의 계약과 오버라이드 규칙을 살펴볼 것이다.

---

**지난 글:** [Java Record — 불변 데이터 클래스를 한 줄로 선언하기](/posts/java-records/)

**다음 글:** [Java Object 클래스 — 모든 클래스의 공통 조상](/posts/java-object-class/)

<br>
읽어주셔서 감사합니다. 😊
