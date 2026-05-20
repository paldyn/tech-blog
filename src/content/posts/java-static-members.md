---
title: "Java static 멤버 완전 정복 — 클래스 레벨 필드와 메서드"
description: "Java static 키워드가 메모리와 JVM에서 어떻게 동작하는지, static 필드·메서드·초기화 블록의 생명 주기와 실전 패턴(상수, 팩토리, 싱글톤)을 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "static", "클래스 멤버", "정적 메서드", "싱글톤", "팩토리 메서드", "static 초기화 블록", "메모리 구조"]
featured: false
draft: false
---

[지난 글](/posts/java-method-overloading/)에서 같은 이름의 메서드를 매개변수 목록으로 구분하는 오버로딩을 다뤘다. 이번에는 인스턴스와 완전히 독립된 **클래스 레벨 멤버** 인 `static`을 파헤친다. `static`은 Java에서 가장 자주 쓰이는 키워드 중 하나지만, 메모리 구조와 생명 주기를 오해한 채 남용하면 설계 결함이나 스레드 안전성 문제로 이어진다.

## static이 의미하는 것

`static`을 붙인 멤버는 **클래스 자체에 귀속**된다. 객체(인스턴스)를 생성하지 않아도 클래스 이름으로 바로 접근할 수 있고, 모든 인스턴스가 동일한 복사본 하나를 공유한다.

```java
class Counter {
    static int count = 0;   // 클래스 레벨 — 모든 인스턴스 공유
    String name;             // 인스턴스 레벨 — 객체마다 독립

    Counter(String name) {
        this.name = name;
        count++;             // 생성할 때마다 공유 카운터 증가
    }
}

Counter a = new Counter("A");
Counter b = new Counter("B");
System.out.println(Counter.count); // 2
```

![static 멤버 개념도 — 클래스 레벨 vs 인스턴스 레벨](/assets/posts/java-static-members-concept.svg)

## JVM 메모리와 static의 생명 주기

static 멤버는 **클래스 로딩(Class Loading) 시점에 Method Area(메타스페이스)에 할당**되고 JVM이 종료될 때까지 유지된다. 반면 인스턴스 필드는 `new`가 실행될 때 Heap에 생성되고 GC가 회수할 수 있다.

| 구분 | 할당 위치 | 생성 시점 | 소멸 시점 |
|---|---|---|---|
| static 필드 | Method Area | 클래스 로딩 | JVM 종료 |
| 인스턴스 필드 | Heap | `new` 실행 | GC 수거 |
| 지역 변수 | Stack | 메서드 호출 | 메서드 반환 |

이 차이가 중요한 이유는 **static 필드가 GC 대상이 아니라는 점**이다. 대용량 객체를 static 필드에 보관하면 메모리 누수로 이어질 수 있다.

## static 메서드

static 메서드는 `this` 참조가 없어서 인스턴스 필드나 인스턴스 메서드에 직접 접근하지 못한다.

```java
class MathUtils {
    private static final double PI = 3.141592653589793;

    static double circleArea(double radius) {
        return PI * radius * radius; // static 필드는 접근 가능
    }

    // 컴파일 에러 예시 (주석 처리)
    // static void wrong() {
    //     System.out.println(this.name); // this 사용 불가
    // }
}

double area = MathUtils.circleArea(5.0); // 인스턴스 불필요
```

**언제 static 메서드로 만드는가**: 인스턴스 상태에 전혀 의존하지 않고 입력값만으로 결과를 계산하는 순수 함수적 메서드, 또는 유틸리티 메서드가 적합하다. `Math.abs()`, `Collections.sort()`, `Objects.requireNonNull()` 이 대표적인 예다.

## static 초기화 블록

복잡한 초기화 로직이나 예외 처리가 필요한 경우 선언과 동시에 초기화할 수 없다. 이때 static 초기화 블록을 사용한다.

```java
class DatabaseConfig {
    static final Properties props;

    static {
        props = new Properties();
        try (var in = DatabaseConfig.class
                .getResourceAsStream("/db.properties")) {
            props.load(in);
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
    }
}
```

static 초기화 블록은 **클래스가 처음 로딩될 때 딱 한 번** 실행된다. 여러 개를 선언하면 소스 코드 순서대로 실행된다.

## 실전 패턴

![static 실전 패턴 — 상수, 팩토리, 싱글톤](/assets/posts/java-static-members-patterns.svg)

### 상수 정의

```java
class HttpStatus {
    static final int OK          = 200;
    static final int NOT_FOUND   = 404;
    static final int SERVER_ERROR = 500;
}
```

`static final` 조합은 컴파일 상수(Compile-time Constant)가 된다. 원시 타입이나 `String` 리터럴로 초기화한 `static final` 필드는 컴파일러가 사용 지점에 값을 인라인한다.

### 팩토리 메서드

생성자를 숨기고 static 팩토리 메서드를 통해 객체를 반환하면 반환 타입을 유연하게 제어할 수 있다.

```java
class Duration {
    private final long seconds;

    private Duration(long seconds) { this.seconds = seconds; }

    static Duration ofSeconds(long s)  { return new Duration(s); }
    static Duration ofMinutes(long m)  { return new Duration(m * 60); }
    static Duration ofHours(long h)    { return new Duration(h * 3600); }
}

Duration d = Duration.ofMinutes(90);
```

`java.time.Duration`, `List.of()`, `Optional.of()` 등 JDK 자체도 이 패턴을 광범위하게 사용한다.

### 싱글톤 (Initialization-on-demand Holder)

단순 `null` 체크 싱글톤은 멀티스레드 환경에서 안전하지 않다. **Holder 클래스 방식**이 스레드 안전하면서도 지연 초기화를 달성하는 관용 패턴이다.

```java
class AppConfig {
    private AppConfig() { }

    private static class Holder {
        static final AppConfig INSTANCE = new AppConfig();
    }

    static AppConfig getInstance() {
        return Holder.INSTANCE;
    }
}
```

`Holder` 클래스는 `getInstance()`가 처음 호출될 때 로딩되고, 클래스 로딩은 JVM이 보장하는 단일 실행이므로 `synchronized` 없이도 스레드 안전하다.

## 자주 하는 실수

### static 문맥에서 인스턴스 멤버 접근

```java
class Bad {
    int value = 10;

    static void display() {
        // System.out.println(value); // 컴파일 에러: non-static field in static context
    }
}
```

### 인스턴스 변수로 static 메서드 호출

```java
Counter c = new Counter("test");
c.count;         // 컴파일은 되지만 경고: Counter.count로 써야 의도 명확
Counter.count;   // 권장
```

인스턴스 변수로 static 멤버에 접근하면 IDE가 경고를 낸다. static 멤버는 항상 클래스 이름으로 참조해야 가독성과 의도가 명확해진다.

### 가변 static 필드와 스레드 안전성

```java
class Registry {
    static List<String> items = new ArrayList<>(); // 위험: 여러 스레드에서 동시 수정 가능
}
```

가변 static 필드는 모든 스레드가 공유하므로 동기화가 없으면 경쟁 조건(Race Condition)이 발생한다. 불변 컬렉션(`List.of()`)을 쓰거나, `ConcurrentHashMap` 같은 스레드 안전한 컬렉션으로 대체해야 한다.

## 상속과 static 메서드

static 메서드는 **오버라이딩이 아닌 숨기기(Hiding)** 가 적용된다.

```java
class Parent {
    static void greet() { System.out.println("Parent"); }
}

class Child extends Parent {
    static void greet() { System.out.println("Child"); } // 오버라이딩 아님
}

Parent p = new Child();
p.greet();          // "Parent" — 참조 타입 기준 (정적 바인딩)
Child.greet();      // "Child"
```

다형성이 필요한 메서드를 static으로 선언하면 이 함정에 빠진다. static 메서드를 오버라이딩할 수 없다는 점을 항상 기억해야 한다.

---

**지난 글:** [Java 메서드 오버로딩 완전 정복 — 같은 이름, 다른 시그니처](/posts/java-method-overloading/)

**다음 글:** [Java final 키워드 완전 정복 — 불변 변수·메서드·클래스](/posts/java-final-keyword/)

<br>
읽어주셔서 감사합니다. 😊
