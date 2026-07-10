---
title: "Java 불변 객체 — Immutable Object 설계와 활용"
description: "불변 객체의 5가지 설계 규칙(final 클래스, final 필드, setter 금지, 방어적 복사), 스레드 안전성과 HashMap 키 안전성, wither 패턴으로 변경된 복사본 반환, 그리고 record를 활용한 간결한 불변 클래스 구현 방법"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "불변 객체", "Immutable", "final", "방어적 복사", "스레드 안전", "record"]
featured: false
draft: false
---

[지난 글](/posts/java-comparable-comparator/)에서 `Comparable`과 `Comparator`로 정렬 기준을 정의하는 방법을 살펴봤다. 이번에는 **불변 객체(Immutable Object)**를 다룬다. 불변 객체는 한 번 생성된 후 상태가 변경되지 않는 객체다. Java에서 가장 중요한 설계 원칙 중 하나이며, `String`, `Integer`, `BigDecimal` 같은 핵심 클래스가 모두 불변이다.

## 불변 객체의 장점

**스레드 안전**: 상태가 변하지 않으니 여러 스레드가 동시에 접근해도 동기화가 필요 없다.

**HashMap/HashSet 키 안전**: 키로 사용 후 값이 바뀌면 `hashCode`가 달라져 찾을 수 없게 된다. 불변이면 이 문제가 없다.

**방어적 복사 불필요**: 공유해도 변경될 수 없으므로 복사 없이 참조를 전달해도 안전하다.

**추론 쉬움**: 어떤 시점에서든 상태가 같으므로 코드 동작을 예측하기 쉽다.

```java
// String은 불변 — 메서드가 새 String을 반환
String s = "hello";
String upper = s.toUpperCase(); // s는 변하지 않음
System.out.println(s);          // "hello"
System.out.println(upper);      // "HELLO"
```

## 불변 클래스 설계 5가지 규칙

```java
// 규칙 1: 클래스를 final로 선언 (서브클래스 차단)
public final class Money {

    // 규칙 2: 모든 필드를 private final로 선언
    private final long amount;
    private final String currency;

    // 규칙 3: setter 없음
    // 규칙 4: 가변 필드가 있다면 생성자에서 방어적 복사
    public Money(long amount, String currency) {
        this.amount   = amount;
        this.currency = Objects.requireNonNull(currency);
    }

    // 접근자
    public long   amount()   { return amount; }
    public String currency() { return currency; }

    // wither 패턴 — 새 객체 반환
    public Money withAmount(long newAmount) {
        return new Money(newAmount, currency);
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Money m)) return false;
        return amount == m.amount && currency.equals(m.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount, currency);
    }
}
```

![불변 클래스 설계 5가지 규칙](/assets/posts/java-immutable-objects-design.svg)

## 방어적 복사 — 가변 필드 처리

`String`은 불변이므로 그대로 저장해도 안전하다. 하지만 `List`, `Set`, `Map`, `Date`, `byte[]` 같은 가변 객체를 필드로 가질 때는 방어적 복사가 필요하다.

```java
public final class Schedule {
    private final List<String> tasks;

    // 생성자: 입력 리스트의 복사본 저장
    public Schedule(List<String> tasks) {
        this.tasks = List.copyOf(tasks); // 불변 복사본
        // 또는: new ArrayList<>(tasks)
    }

    // 접근자: 불변 뷰 또는 복사본 반환
    public List<String> tasks() {
        return tasks; // List.copyOf()는 이미 불변
    }
}

List<String> original = new ArrayList<>(List.of("meeting", "review"));
Schedule s = new Schedule(original);

original.add("lunch"); // 원본 변경
System.out.println(s.tasks()); // [meeting, review] — 영향 없음
```

`List.copyOf()`, `Collections.unmodifiableList()`, `new ArrayList<>(other)` 중 상황에 맞게 선택한다. `List.copyOf()`는 Java 10+에서 사용 가능하고 자체도 불변이다.

## wither 패턴

setter 대신 **wither 메서드**를 제공해 변경된 복사본을 반환한다.

```java
public final class Config {
    private final String host;
    private final int port;
    private final boolean ssl;

    public Config(String host, int port, boolean ssl) {
        this.host = host;
        this.port = port;
        this.ssl  = ssl;
    }

    public Config withHost(String newHost) { return new Config(newHost, port, ssl); }
    public Config withPort(int newPort)    { return new Config(host, newPort, ssl); }
    public Config withSsl(boolean ssl)     { return new Config(host, port, ssl); }

    public String  host() { return host; }
    public int     port() { return port; }
    public boolean ssl()  { return ssl; }
}

// 체이닝으로 여러 값을 한 번에 변경
Config config = new Config("localhost", 8080, false)
    .withHost("prod.example.com")
    .withPort(443)
    .withSsl(true);
```

![완전한 불변 클래스 구현 예시](/assets/posts/java-immutable-objects-example.svg)

## record로 불변 클래스 간결하게

Java 16+ record는 불변 클래스를 한 줄로 선언한다. 가변 컬렉션 방어적 복사만 컴팩트 생성자로 처리하면 된다.

```java
record Schedule(String name, List<String> tasks) {
    Schedule {
        tasks = List.copyOf(tasks); // 방어적 복사
    }

    // wither 메서드
    public Schedule withName(String newName) {
        return new Schedule(newName, tasks);
    }
}

var s1 = new Schedule("Sprint 1", List.of("coding", "review"));
var s2 = s1.withName("Sprint 2");

System.out.println(s1.name()); // Sprint 1
System.out.println(s2.name()); // Sprint 2
```

## 스레드 안전성

불변 객체는 `synchronized` 없이 스레드 간 공유할 수 있다.

```java
// 불변 객체는 공유 안전
final Money USD_100 = new Money(100, "USD");

// 여러 스레드가 동시에 사용해도 OK
ExecutorService pool = Executors.newFixedThreadPool(4);
for (int i = 0; i < 100; i++) {
    pool.submit(() -> {
        System.out.println(USD_100.amount()); // 동기화 불필요
    });
}
```

## 부분 불변 — 가변 + 불변 조합

모든 객체를 불변으로 만들 수는 없다. 성능이 중요한 경우(StringBuilder처럼 많은 변경이 필요한 경우), 빌더 패턴을 사용해 가변 빌더로 구성한 뒤 마지막에 불변 객체를 만든다.

```java
// 빌더 패턴 — 가변 빌더 + 불변 결과
var config = Config.builder()
    .host("prod.example.com")
    .port(443)
    .ssl(true)
    .build(); // build()에서 불변 Config 반환
```

## JDK 불변 컬렉션

Java 9+에서 `List.of()`, `Set.of()`, `Map.of()`로 불변 컬렉션을 만들 수 있다.

```java
List<String> list = List.of("a", "b", "c");  // 불변
Set<Integer> set  = Set.of(1, 2, 3);          // 불변
Map<String, Integer> map = Map.of("one", 1, "two", 2); // 불변

list.add("d");   // UnsupportedOperationException
set.remove(1);   // UnsupportedOperationException
```

`Collections.unmodifiableList()`는 원본 리스트의 변경이 뷰에도 반영되는 반면, `List.copyOf()`는 스냅샷 복사본이라 완전히 독립적이다.

불변 객체는 현대 Java 설계의 핵심이다. 가능한 한 불변으로 만들되, 불변으로 만들 수 없을 때만 가변성을 허용하는 것이 올바른 접근이다. 이번 시리즈 배치에서 살펴본 sealed 클래스, records, Object 메서드들은 모두 불변 도메인 모델 설계를 향한 Java의 진화를 보여준다. 다음 배치에서는 **제네릭(Generics)** 시리즈로 이어진다.

---

**지난 글:** [Java Comparable과 Comparator — 자연 순서와 커스텀 정렬](/posts/java-comparable-comparator/)

**다음 글:** [Java 제네릭 완전 정복 — 타입 매개변수의 기초](/posts/java-generics-basics/)

<br>
읽어주셔서 감사합니다. 😊
