---
title: "Java 인터페이스 static 메서드 — 팩토리와 유틸리티 설계"
description: "Java 8 인터페이스 static 메서드의 도입 배경, 상속 불가 규칙, 팩토리 메서드 패턴, 유틸리티 클래스 대체, JDK 활용 사례, Java 9 private static까지 실전 설계 관점에서 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "interface static method", "인터페이스", "Java 8", "팩토리 메서드", "유틸리티", "설계 패턴", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/java-default-methods/)에서 `default` 메서드가 하위 호환성 문제를 해결하기 위해 인터페이스에 기본 구현을 허용하는 방식을 살펴봤다. Java 8은 같은 버전에서 또 다른 변화를 가져왔다. 인터페이스에 `static` 메서드를 선언할 수 있게 된 것이다. `default` 메서드와 달리 `static` 메서드는 구현 클래스나 자식 인터페이스에 **상속되지 않는다**. 이 작은 차이 하나가 `static` 메서드를 완전히 다른 용도로 만든다.

## 왜 인터페이스에 static 메서드가 필요했나

Java 8 이전에는 인터페이스와 관련된 유틸리티 메서드나 팩토리 메서드를 어디에 두어야 할지 명확한 정답이 없었다. 관행적으로 두 가지 방법이 사용됐다.

**방법 1 — 동반 유틸리티 클래스**: `Collection` → `Collections`, `Path` → `Paths`처럼 인터페이스와 별도의 유틸리티 클래스를 만들었다. 이름 규칙으로 관계를 암시했지만, 두 타입이 별도 파일로 분리되어 응집도가 낮았다.

```java
// Java 7 이전 — 인터페이스 관련 팩토리가 다른 클래스에
Path path = Paths.get("/home/user/data.txt");  // Path 인터페이스, Paths 유틸리티
List<String> list = Collections.unmodifiableList(new ArrayList<>());
```

**방법 2 — 추상 클래스에 함께**: 인터페이스 대신 추상 클래스를 써서 유틸리티 메서드를 `static`으로 포함했다. 그러나 단일 상속 제한 때문에 유연성이 떨어졌다.

Java 8에서 인터페이스에 `static` 메서드가 허용되면서 **타입과 팩토리/유틸리티를 한 곳에 응집**할 수 있게 됐다. `List.of()`, `Map.of()`, `Comparator.naturalOrder()` 같은 현대적 API가 이 방식으로 설계되었다.

## 선언과 호출 규칙

인터페이스의 `static` 메서드는 일반 클래스의 `static` 메서드처럼 선언하되, **반드시 인터페이스 이름으로 호출**해야 한다.

```java
public interface MathOp {
    int apply(int a, int b);

    // static 팩토리 메서드 — 기본 연산자 제공
    static MathOp add()      { return (a, b) -> a + b; }
    static MathOp subtract() { return (a, b) -> a - b; }
    static MathOp multiply() { return (a, b) -> a * b; }

    // static 유틸리티 메서드
    static int applyAll(int initial, int value, MathOp... ops) {
        int result = initial;
        for (MathOp op : ops) {
            result = op.apply(result, value);
        }
        return result;
    }
}

// ✓ 올바른 호출 — 인터페이스 이름으로
MathOp adder = MathOp.add();
System.out.println(adder.apply(3, 4));  // 7

// static 유틸리티 호출
int result = MathOp.applyAll(10, 3, MathOp.add(), MathOp.multiply());
System.out.println(result);  // (10+3)*3 = 39
```

## 상속 불가 — default와의 결정적 차이

`default` 메서드는 구현 클래스가 상속받지만, `static` 메서드는 절대 상속되지 않는다. 구현 클래스의 이름으로 호출하려 하면 컴파일 오류가 난다.

![인터페이스 메서드 타입 비교](/assets/posts/java-static-methods-interface-comparison.svg)

```java
public interface Printable {
    void print();

    static Printable of(String content) {
        return () -> System.out.println(content);
    }
}

public class Document implements Printable {
    @Override
    public void print() { System.out.println("문서"); }
}

// ✓ 인터페이스 이름으로 — 정상
Printable p = Printable.of("안녕");
p.print();  // 안녕

// ✗ 컴파일 오류 — 구현 클래스로 static 메서드 호출 불가
// Printable p2 = Document.of("안녕");  // ERROR: of() not found in Document

// ✗ 런타임에서도 안 됨 — 인스턴스 없어도 다형성 없음
// Document doc = new Document();
// doc.of("안녕");  // ERROR: static method not inherited
```

이 "상속 불가" 규칙은 의도적인 설계다. 팩토리·유틸리티 메서드는 구현 클래스가 아닌 **인터페이스 타입**을 통해 접근해야 한다는 것을 API 레벨에서 강제한다. 구현 클래스 이름이 코드에 등장하면 의존성이 생긴다. `Printable.of(...)`은 구현 클래스를 숨기지만 `Document.of(...)`는 노출한다.

## 팩토리 메서드 패턴 — static의 핵심 용도

인터페이스 `static` 메서드의 가장 강력한 활용은 **팩토리 메서드 패턴**이다. 인터페이스 타입을 반환하되 내부에서 어떤 구현 클래스를 생성하는지 감출 수 있다.

![인터페이스 static 팩토리 메서드 패턴](/assets/posts/java-static-methods-interface-factory.svg)

```java
public interface Shape {
    double area();
    double perimeter();

    // 팩토리 메서드 — 구현 클래스 이름 노출 없이 인스턴스 생성
    static Shape circle(double radius) {
        if (radius <= 0) throw new IllegalArgumentException("반지름 > 0");
        return new Circle(radius);
    }

    static Shape rectangle(double width, double height) {
        if (width <= 0 || height <= 0)
            throw new IllegalArgumentException("가로/세로 > 0");
        return new Rectangle(width, height);
    }

    static Shape square(double side) {
        return rectangle(side, side);  // 다른 팩토리 재사용
    }
}

// 구현 클래스는 같은 파일(package-private)에 숨겨도 됨
class Circle implements Shape {
    private final double r;
    Circle(double r) { this.r = r; }

    @Override public double area()      { return Math.PI * r * r; }
    @Override public double perimeter() { return 2 * Math.PI * r; }
}

class Rectangle implements Shape {
    private final double w, h;
    Rectangle(double w, double h) { this.w = w; this.h = h; }

    @Override public double area()      { return w * h; }
    @Override public double perimeter() { return 2 * (w + h); }
}
```

사용하는 쪽 코드는 구현 클래스를 전혀 알 필요가 없다.

```java
Shape c = Shape.circle(5.0);
Shape r = Shape.rectangle(3.0, 4.0);
Shape s = Shape.square(7.0);

System.out.printf("원 넓이: %.2f%n",    c.area());  // 78.54
System.out.printf("사각형 둘레: %.2f%n", r.perimeter());  // 14.00
System.out.printf("정사각형 넓이: %.2f%n", s.area());  // 49.00
```

이것이 **타입 기반 설계(interface-centric design)** 의 정석이다. `Shape.circle(5.0)`은 미래에 `Circle` 구현을 완전히 교체해도 호출 코드를 바꿀 필요가 없다.

## 표준 라이브러리 — JDK의 대표 사례

Java 8 이후 JDK는 인터페이스 `static` 메서드를 적극 활용한다.

```java
// ─── List (Java 9+) ───────────────────────────────────────────
List<String> empty  = List.of();                    // 불변 빈 리스트
List<String> names  = List.of("Alice", "Bob");      // 불변 리스트
List<String> copy   = List.copyOf(mutableList);     // 불변 복사본

// ─── Map (Java 9+) ────────────────────────────────────────────
Map<String, Integer> scores = Map.of(
    "Alice", 95,
    "Bob",   88
);
Map<String, Integer> map2 = Map.ofEntries(
    Map.entry("key1", 1),
    Map.entry("key2", 2)
);

// ─── Comparator (Java 8) ──────────────────────────────────────
Comparator<String> asc  = Comparator.naturalOrder();
Comparator<String> desc = Comparator.reverseOrder();

Comparator<Person> byAge  = Comparator.comparing(Person::getAge);
Comparator<Person> byName = Comparator.comparing(Person::getName,
                                                  Comparator.naturalOrder());

// ─── Stream (Java 9+) ─────────────────────────────────────────
Stream<String> empty2 = Stream.empty();
Stream<String> ofOne  = Stream.of("only one");
Stream<Integer> gen   = Stream.iterate(0, n -> n + 2).limit(5); // 0,2,4,6,8

// ─── Optional ─────────────────────────────────────────────────
Optional<String> opt1 = Optional.of("value");
Optional<String> opt2 = Optional.empty();
Optional<String> opt3 = Optional.ofNullable(maybeNull);
```

`List.of()`, `Map.of()`, `Stream.of()`, `Optional.of()` — 모두 인터페이스(또는 추상 클래스)에 정의된 `static` 팩토리 메서드다. 내부에서 어떤 구현체를 반환하는지 API 사용자는 알 필요가 없다.

## 유틸리티 클래스 대 인터페이스 static 메서드

기존 유틸리티 클래스 패턴(`Collections`, `Arrays`, `Files`)과 인터페이스 `static` 메서드 패턴을 비교하면 각각의 적합한 상황이 명확해진다.

| 기준 | 유틸리티 클래스 | 인터페이스 static 메서드 |
|------|---------------|------------------------|
| 관련 타입과 응집 | 분리 (`Arrays` vs `Array`) | 같은 타입에 응집 |
| 확장 가능성 | 상속으로 추가 어려움 | 하위 인터페이스로 재정의 불가 |
| 인스턴스화 방지 | `private` 생성자 필요 | 구조적으로 불가 |
| 여러 타입 조합 | 적합 (`Collections.sort`) | 단일 인터페이스에 한정 |
| 팩토리 메서드 | 어색 (`ListUtils.emptyList()`) | 자연스러움 (`List.of()`) |

**판단 기준**: 메서드가 특정 인터페이스와 **강하게 결합**된 팩토리·유틸리티라면 인터페이스 `static` 메서드가 적합하다. 여러 타입을 조합하는 유틸리티(`Collections.sort`처럼 `List`와 `Comparator` 모두 사용)라면 별도 유틸리티 클래스가 더 자연스럽다.

## 인터페이스 계층에서의 static — 하위 인터페이스에서 재정의 불가

`static` 메서드는 하위 인터페이스에서 **재정의(override)되지 않는다**. 같은 이름의 `static` 메서드를 하위 인터페이스에 선언하면 이는 재정의가 아닌 **별개의 메서드**(hiding)다.

```java
public interface Animal {
    static String category() { return "동물"; }
}

public interface Dog extends Animal {
    // ✗ 재정의 아님 — Animal.category()와 별개의 메서드
    static String category() { return "개과"; }
}

System.out.println(Animal.category());  // 동물
System.out.println(Dog.category());     // 개과 — 별개 메서드

// 하위 인터페이스 타입으로도 부모 static 호출 불가
// Dog.Animal.category() — 문법 오류
```

이 동작은 자바 `static` 메서드가 다형성(polymorphism)에 참여하지 않는다는 일반 규칙과 일치한다. 인터페이스의 `static` 메서드는 항상 **정적 디스패치(static dispatch)** — 컴파일 타임에 어떤 메서드를 호출할지 결정된다.

## Java 9 — private static 메서드

Java 9에서 인터페이스에 `private` 메서드와 `private static` 메서드가 추가됐다. 여러 `static` 메서드가 공통 헬퍼 로직을 공유할 때 유용하다.

```java
public interface Connection {
    static Connection open(String host, int port) {
        validate(host, port);  // private static 공유
        return new SocketConnection(host, port);
    }

    static Connection openSecure(String host, int port) {
        validate(host, port);  // 중복 없이 재사용
        return new TlsConnection(host, port);
    }

    // private static — 외부 노출 없는 내부 헬퍼
    private static void validate(String host, int port) {
        if (host == null || host.isBlank())
            throw new IllegalArgumentException("host는 필수");
        if (port < 1 || port > 65535)
            throw new IllegalArgumentException("port: 1~65535");
    }
}
```

`private static` 메서드는 인터페이스 외부에서 보이지 않는다. `Connection.validate(...)`를 직접 호출하는 것은 불가능하며, 오직 같은 인터페이스 내부의 `static` 메서드에서만 사용할 수 있다. `default` 메서드를 위한 `private` 인스턴스 메서드와 구별된다는 점에 주의하자.

## 실전 설계 지침

인터페이스에 `static` 메서드를 추가할 때 체크해야 할 사항들이다.

**1. 반환 타입은 인터페이스 자신(또는 관련 인터페이스)**

```java
// ✓ 좋은 예 — 인터페이스 자신을 반환
static Cache<K, V> newConcurrentCache() { ... }

// ✗ 나쁜 예 — 구현 클래스를 반환타입으로 노출
static ConcurrentHashMapCache<K, V> newCache() { ... }
```

**2. 입력 유효성 검사는 팩토리 안에서**

```java
static Range of(int start, int end) {
    if (start > end)
        throw new IllegalArgumentException("start(" + start + ") > end(" + end + ")");
    return new RangeImpl(start, end);
}
```

**3. 네이밍 컨벤션**

| 용도 | 컨벤션 | 예시 |
|------|--------|------|
| 일반 팩토리 | `of(...)` | `List.of()`, `Optional.of()` |
| 빈 인스턴스 | `empty()` | `Stream.empty()`, `Optional.empty()` |
| 복사 팩토리 | `copyOf(...)` | `List.copyOf()` |
| 캐시/싱글턴 | `getInstance()` | (레거시 패턴) |
| 자연 순서 | `naturalOrder()` | `Comparator.naturalOrder()` |
| 변환 | `from(...)` | `Instant.from(temporal)` |

**4. `static` vs `default` 선택**

- 인스턴스 없이 호출 가능한 팩토리/유틸리티 → `static`
- 구현 클래스가 선택적으로 재정의 가능한 기본 동작 → `default`
- 구현 클래스의 추상 메서드를 호출하는 공통 로직 → `default`

## 정리

인터페이스 `static` 메서드는 "인터페이스 타입과 강하게 결합된 팩토리와 유틸리티를 같은 타입 안에 응집"하는 도구다.

| 개념 | 설명 |
|------|------|
| 상속 불가 | 구현 클래스·하위 인터페이스에 상속 안 됨 |
| 호출 방법 | `인터페이스명.메서드()` — 클래스 이름 불가 |
| 주요 용도 | 팩토리 메서드, 유틸리티 메서드 |
| 구현 클래스 은닉 | 반환 타입을 인터페이스로 — 구현 노출 불필요 |
| Java 9 확장 | `private static` — 내부 공유 헬퍼 |
| JDK 사례 | `List.of()`, `Map.of()`, `Comparator.naturalOrder()` |

`default` 메서드가 "인스턴스를 통한 다형적 확장"에 집중한다면, `static` 메서드는 "타입을 통한 팩토리와 유틸리티 응집"에 집중한다. 두 도구를 목적에 맞게 구분해서 사용하면 인터페이스 기반 API의 응집도와 사용성을 크게 높일 수 있다.

---

**지난 글:** [Java default 메서드 완전 정복 — 인터페이스의 진화](/posts/java-default-methods/)

**다음 글:** [Java 인터페이스 private 메서드 — 내부 헬퍼 캡슐화](/posts/java-private-methods-interface/)

<br>
읽어주셔서 감사합니다. 😊
