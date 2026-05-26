---
title: "Java 인터페이스 완전 정복 — 계약과 다중 구현"
description: "Java 인터페이스의 계약 정의, abstract/default/static/private 메서드, 다중 구현, 인터페이스 상속, default 메서드 충돌 해결, 함수형 인터페이스까지 예제 중심으로 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "인터페이스", "interface", "default method", "static method", "다중 구현", "OOP", "객체지향", "함수형 인터페이스"]
featured: false
draft: false
---

[지난 글](/posts/java-abstract-class/)에서 추상 클래스가 "공통 상태와 로직을 가진 미완성 설계도"라는 것을 살펴봤다. 추상 클래스는 강력하지만 한 가지 근본적인 한계가 있다. Java는 **단일 상속(single inheritance)** 만 허용하기 때문에 하나의 클래스가 두 개 이상의 추상 클래스를 동시에 상속할 수 없다. 이 한계를 넘는 것이 바로 **인터페이스(Interface)** 다. 인터페이스는 "할 수 있는 일(capability)"을 순수하게 선언하는 계약서다. 클래스는 이 계약서를 몇 장이든 동시에 이행할 수 있다.

## 인터페이스란

인터페이스는 메서드의 시그니처(이름, 매개변수, 반환 타입)와 상수를 선언하는 타입이다. 구현 클래스는 `implements` 키워드로 인터페이스를 선언하고, 인터페이스에 정의된 추상 메서드를 모두 구현해야 한다.

```java
public interface Printable {
    // 추상 메서드 — public abstract가 암묵적으로 붙음
    void print();
}

public class Document implements Printable {
    @Override
    public void print() {
        System.out.println("문서를 인쇄합니다.");
    }
}

// 인터페이스 타입으로 다형성 활용
Printable p = new Document();
p.print();  // → 문서를 인쇄합니다.
```

추상 클래스와 달리 인터페이스는 인스턴스 필드(상태)를 가질 수 없다. "이 클래스가 무엇을 **할 수 있는가**"에만 집중하는 순수한 계약이다.

## 인터페이스 멤버 종류

Java 버전이 올라가면서 인터페이스에 허용되는 멤버가 점점 늘어났다.

| 멤버 종류 | 추가 버전 | 설명 |
|-----------|-----------|------|
| `abstract` 메서드 | Java 1 | 선언만, 구현 클래스가 반드시 구현 |
| 상수 (`public static final`) | Java 1 | 인스턴스 필드 대신 상수만 허용 |
| `default` 메서드 | Java 8 | 기본 구현 제공, 클래스에서 선택적 재정의 |
| `static` 메서드 | Java 8 | 인터페이스 타입으로 호출, 상속 안 됨 |
| `private` 메서드 | Java 9 | default/static 간 코드 공유용 내부 헬퍼 |

![인터페이스 구조 — 추상·default·static·private 메서드 공존](/assets/posts/java-interface-overview.svg)

## 추상 메서드와 상수

인터페이스에서 추상 메서드는 `public abstract`가 암묵적으로 붙는다. 상수는 `public static final`이 암묵적이다.

```java
public interface Shape {
    // public static final 암묵적 — 변수 재할당 불가
    double PI = 3.14159265;

    // public abstract 암묵적 — 구현 클래스가 반드시 구현
    double area();
    double perimeter();
    String describe();
}
```

`PI = 3.14`처럼 상수에 암묵적으로 붙는 `final`과 `static` 덕분에 인터페이스 상수는 구현 클래스가 재정의하거나 인스턴스별로 다른 값을 가질 수 없다. 보통 `Math.PI`처럼 클래스 상수를 쓰는 것이 더 일반적이며, 인터페이스 상수는 남용하면 "상수 인터페이스 안티패턴"이 되므로 주의해야 한다.

## Java 8 — default 메서드

Java 8 이전에는 인터페이스에 새 메서드를 추가하면 이를 구현하는 모든 클래스가 컴파일 오류가 났다. 이 문제를 해결하기 위해 `default` 메서드가 도입됐다. `default` 메서드는 인터페이스 안에 기본 구현을 포함하고, 구현 클래스가 선택적으로 재정의할 수 있다.

```java
public interface Collection<E> {
    boolean add(E element);
    int size();

    // Java 8+ default 메서드 — 기존 구현 클래스를 깨지 않고 새 기능 추가
    default boolean isEmpty() {
        return size() == 0;
    }

    default void forEach(Consumer<? super E> action) {
        for (E element : this) {
            action.accept(element);
        }
    }
}
```

`isEmpty()`와 `forEach()`는 기존에 `Collection`을 구현하던 수천 개의 클래스에 기본 동작을 제공하면서 하위 호환성을 유지했다.

직접 작성하는 `default` 메서드 예시:

```java
public interface Validator<T> {
    boolean validate(T value);

    // 유효하지 않을 때 예외를 던지는 기본 동작 제공
    default void validateOrThrow(T value) {
        if (!validate(value)) {
            throw new IllegalArgumentException("유효하지 않은 값: " + value);
        }
    }

    // 두 검증 조건을 AND로 합성
    default Validator<T> and(Validator<T> other) {
        return value -> this.validate(value) && other.validate(value);
    }
}

// 사용
Validator<String> notBlank = s -> s != null && !s.isBlank();
Validator<String> maxLength = s -> s.length() <= 50;
Validator<String> combined = notBlank.and(maxLength);

combined.validateOrThrow("안녕하세요");  // OK
combined.validateOrThrow("");             // IllegalArgumentException
```

구현 클래스에서 `default` 메서드를 재정의하고 싶으면 일반 메서드 오버라이딩과 동일하게 `@Override`를 붙여 구현하면 된다.

## Java 8 — static 메서드

인터페이스의 `static` 메서드는 팩토리 메서드나 유틸리티를 인터페이스 타입과 함께 묶어두는 데 유용하다. 구현 클래스나 자식 인터페이스에 상속되지 않으므로 **인터페이스 타입.메서드명()** 형식으로만 호출한다.

```java
public interface Comparator<T> {
    int compare(T o1, T o2);

    // 자연 순서 Comparator를 생성하는 팩토리
    static <T extends Comparable<? super T>> Comparator<T> naturalOrder() {
        return (a, b) -> a.compareTo(b);
    }

    // 역순 Comparator
    static <T extends Comparable<? super T>> Comparator<T> reverseOrder() {
        return (a, b) -> b.compareTo(a);
    }
}

// 호출
Comparator<String> asc  = Comparator.naturalOrder();
Comparator<String> desc = Comparator.reverseOrder();
```

`List.of()`, `Map.of()`, `Set.of()` 모두 컬렉션 인터페이스의 `static` 메서드다. 관련 팩토리 메서드를 타입 옆에 두어 응집도를 높이는 것이 `static` 메서드의 주요 용도다.

## Java 9 — private 메서드

`default` 메서드가 여럿 생기면 공통 로직이 중복될 수 있다. Java 9에서는 인터페이스 내부에서만 쓰는 `private` 메서드를 허용해 이 문제를 해결했다.

```java
public interface Logger {
    void log(String message);

    default void info(String message) {
        log(format("INFO", message));
    }

    default void warn(String message) {
        log(format("WARN", message));
    }

    default void error(String message) {
        log(format("ERROR", message));
    }

    // private — default 메서드 내부 공통 로직, 외부 노출 없음
    private String format(String level, String message) {
        return "[" + level + "] " + message;
    }
}
```

`private` 메서드는 인터페이스 외부에서 보이지 않고 구현 클래스로 상속되지도 않는다. `static` 메서드에도 `private`을 붙일 수 있다 (`private static`).

## 다중 구현 — 인터페이스의 핵심 강점

클래스는 최대 하나의 클래스만 상속할 수 있지만, **인터페이스는 개수 제한 없이 구현**할 수 있다. 이를 통해 클래스에 여러 역할을 동시에 부여할 수 있다.

```java
public interface Printable  { void print(); }
public interface Saveable   { void save(String path); }
public interface Shareable  { void share(String url); }

// 세 가지 역할을 동시에 수행하는 Document 클래스
public class Document implements Printable, Saveable, Shareable {
    private final String content;

    public Document(String content) {
        this.content = content;
    }

    @Override
    public void print() {
        System.out.println("인쇄: " + content);
    }

    @Override
    public void save(String path) {
        // 파일 저장 로직
        System.out.println(path + "에 저장");
    }

    @Override
    public void share(String url) {
        System.out.println(url + "로 공유");
    }
}
```

`Document` 객체는 `Printable`, `Saveable`, `Shareable` 세 가지 타입으로 모두 취급될 수 있다.

```java
Document doc = new Document("Java 완전 정복");

Printable  printer = doc;   // OK
Saveable   saver   = doc;   // OK
Shareable  sharer  = doc;   // OK

printer.print();
saver.save("/docs/java.md");
sharer.share("https://paldyn.com/posts/java-interface/");
```

![인터페이스 다중 구현 — 클래스 하나, 역할 셋](/assets/posts/java-interface-multiple.svg)

## 인터페이스 상속

인터페이스도 다른 인터페이스를 상속할 수 있다. `extends` 키워드를 사용하며, **여러 인터페이스를 동시에 상속**할 수 있다.

```java
public interface Readable {
    String read();
}

public interface Writable {
    void write(String content);
}

// 두 인터페이스를 동시에 상속
public interface ReadWritable extends Readable, Writable {
    // Readable의 read()와 Writable의 write()를 모두 계약
    void flush();  // 추가 메서드
}

// ReadWritable을 구현하면 세 메서드 모두 구현해야 함
public class FileStream implements ReadWritable {
    @Override
    public String read()           { return "파일 데이터"; }
    @Override
    public void write(String c)    { /* 파일에 쓰기 */ }
    @Override
    public void flush()            { /* 버퍼 비우기 */ }
}
```

## default 메서드 충돌과 해결

서로 다른 두 인터페이스가 같은 이름의 `default` 메서드를 가지고 있을 때 클래스가 두 인터페이스를 모두 구현하면 **충돌(conflict)** 이 발생한다. Java 컴파일러는 이 경우 오류를 내고 구현 클래스에서 명시적으로 해결하도록 강제한다.

```java
public interface A {
    default String hello() { return "A의 hello"; }
}

public interface B {
    default String hello() { return "B의 hello"; }
}

// 충돌! — 컴파일 오류, 어떤 hello()를 써야 할지 모호
public class C implements A, B {
    // 반드시 명시적으로 재정의해야 함
    @Override
    public String hello() {
        // super 참조로 특정 인터페이스의 default 메서드 호출 가능
        return A.super.hello() + " + " + B.super.hello();
    }
}
```

`인터페이스명.super.메서드명()` 구문으로 특정 인터페이스의 `default` 구현을 명시적으로 호출할 수 있다. 충돌 해결 우선순위:

1. **클래스가 직접 재정의** — 항상 우선
2. **더 구체적인 인터페이스의 default** — 자식 인터페이스의 `default`가 부모보다 우선
3. **여전히 모호하면 컴파일 오류** — 개발자가 명시적으로 해결해야 함

## 함수형 인터페이스

추상 메서드가 **정확히 하나**인 인터페이스를 **함수형 인터페이스(Functional Interface)** 라 한다. `@FunctionalInterface` 애너테이션으로 선언하면 컴파일러가 추상 메서드가 1개인지 검사해준다.

```java
@FunctionalInterface
public interface Transformer<T, R> {
    R transform(T input);

    // default와 static은 추상 메서드 수에 포함 안 됨
    default Transformer<T, R> andLog() {
        return input -> {
            R result = transform(input);
            System.out.println(input + " → " + result);
            return result;
        };
    }
}

// 람다 표현식으로 구현 가능
Transformer<String, Integer> lengthOf = String::length;
System.out.println(lengthOf.transform("Java"));  // → 4
```

`java.util.function` 패키지의 `Function<T,R>`, `Predicate<T>`, `Consumer<T>`, `Supplier<T>` 등이 모두 함수형 인터페이스다. 람다와 메서드 참조는 함수형 인터페이스를 구현한 것으로 취급되며, 자세한 내용은 이후 람다·스트림 시리즈에서 다룬다.

## 인터페이스 설계 원칙

**인터페이스 분리 원칙(ISP — Interface Segregation Principle)**: 하나의 거대한 인터페이스보다 작고 응집된 여러 인터페이스가 낫다.

```java
// ✗ 뚱뚱한 인터페이스 — 구현 클래스가 불필요한 메서드까지 구현해야 함
public interface MultifunctionDevice {
    void print();
    void scan();
    void fax();
    void copy();
}

// ✓ 분리된 인터페이스 — 필요한 것만 구현
public interface Printer  { void print(); }
public interface Scanner  { void scan(); }
public interface FaxMachine { void fax(); }
public interface Copier   { void copy(); }

// 간단한 프린터는 Printer만 구현
public class SimplePrinter implements Printer {
    @Override public void print() { /* 인쇄 */ }
}

// 복합기는 필요한 것을 모두 구현
public class AllInOne implements Printer, Scanner, Copier {
    @Override public void print() { /* 인쇄 */ }
    @Override public void scan()  { /* 스캔 */ }
    @Override public void copy()  { /* 복사 */ }
}
```

## 인터페이스 vs 추상 클래스 선택 기준

| 선택 기준 | 인터페이스 | 추상 클래스 |
|-----------|------------|-------------|
| 다중 구현 필요 | ✓ 가능 | ✗ 단일 상속만 |
| 인스턴스 필드 필요 | ✗ 불가 | ✓ 가능 |
| 공통 생성자 로직 | ✗ 불가 | ✓ 가능 |
| IS-A 관계 표현 | 부적합 | 적합 |
| CAN-DO 역할 계약 | 적합 | 부적합 |
| Java 진화 (기능 추가) | default 메서드 | 구체 메서드 |

**실전 판단 기준**: 상태(필드)가 필요하거나 "~이다(IS-A)" 관계면 추상 클래스. 순수한 행동 계약이나 여러 역할을 동시에 부여해야 하면 인터페이스.

현대 Java에서는 `default` 메서드 덕분에 인터페이스가 추상 클래스의 역할 상당 부분을 대체할 수 있다. 실제로 Java 표준 라이브러리도 새 API를 추상 클래스보다 인터페이스 + `default` 메서드 조합으로 설계하는 경우가 늘었다.

## 정리

인터페이스는 Java 객체지향 설계의 핵심 도구다.

| 개념 | 설명 |
|------|------|
| `interface` | 순수 계약 타입 — 상태 없음, 다중 구현 가능 |
| `abstract` 메서드 | 구현 클래스가 반드시 구현 (암묵적 `public abstract`) |
| `default` 메서드 | 기본 구현 제공 — 하위 호환성 유지, 선택적 재정의 |
| `static` 메서드 | 팩토리·유틸리티 — 인터페이스명으로만 호출 |
| `private` 메서드 | 내부 헬퍼 — Java 9+, 외부 노출 없음 |
| 다중 구현 | 클래스 하나에 여러 인터페이스 역할 부여 |
| 충돌 해결 | `A.super.method()` 구문으로 명시적 선택 |

인터페이스는 "무엇을 할 수 있는가"에 집중하고, 추상 클래스는 "무엇인가"와 "공통 구현은 무엇인가"에 집중한다. 두 도구를 상황에 맞게 조합하는 것이 Java 설계의 핵심이다.

---

**지난 글:** [Java 추상 클래스 완전 정복 — abstract와 설계 계약](/posts/java-abstract-class/)

<br>
읽어주셔서 감사합니다. 😊
