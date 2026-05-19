---
title: "Java 생성자 완전 정복 — 기본·매개변수·오버로딩·체이닝"
description: "Java 생성자의 모든 것을 파헤친다. 기본 생성자, 매개변수 생성자, 생성자 오버로딩, this() 체이닝의 원리와 설계 원칙을 예제 중심으로 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "생성자", "Constructor", "this()", "생성자 오버로딩", "생성자 체이닝", "기본 생성자", "객체 초기화"]
featured: false
draft: false
---

[지난 글](/posts/java-fields-methods/)에서 클래스를 구성하는 필드와 메서드를 살펴봤다. 이번 글에서는 세 번째 구성 요소인 **생성자(Constructor)** 를 완전히 파헤친다. 생성자는 객체가 태어나는 순간 딱 한 번 실행되는 특수 블록으로, 올바른 초기 상태를 보장하는 역할을 한다. 기본 생성자부터 오버로딩, `this()` 체이닝까지 단계별로 정리한다.

## 생성자란 무엇인가

생성자는 클래스 이름과 동일한 이름을 가지며 **반환 타입이 없는** 특수 메서드다. `new` 키워드로 객체를 생성할 때 JVM이 자동으로 호출한다.

```java
class Car {
    String model;
    int year;

    // 생성자 — 반환 타입 없음, 클래스명과 동일
    Car(String model, int year) {
        this.model = model;
        this.year  = year;
    }
}

// 사용
Car c = new Car("Tesla Model 3", 2024);
System.out.println(c.model); // Tesla Model 3
```

메서드와 가장 큰 차이는 **반환 타입 선언이 없다**는 점이다. `void`조차 쓰지 않는다. 실수로 `void`를 붙이면 생성자가 아닌 일반 메서드로 취급돼 컴파일은 되지만 객체 생성 시 호출되지 않는다.

## 기본 생성자 — 컴파일러가 선물하는 생성자

클래스에 생성자를 하나도 선언하지 않으면 컴파일러가 **기본 생성자(default constructor)** 를 자동으로 삽입한다.

```java
class Point {
    int x;
    int y;
    // 생성자 없음 → 컴파일러가 Point() {} 자동 추가
}

Point p = new Point(); // OK
System.out.println(p.x); // 0 (기본값)
System.out.println(p.y); // 0
```

기본 생성자는 매개변수가 없고 본문이 비어 있다. 필드는 타입별 기본값(`int` → 0, `String` → `null`, `boolean` → `false`)으로 초기화된다.

> ⚠️ **주의**: 매개변수 생성자를 하나라도 명시하면 컴파일러는 기본 생성자를 **자동 추가하지 않는다**. 이후 `new Point()`를 호출하면 컴파일 에러가 난다. 필요하다면 `Point() {}`를 직접 추가해야 한다.

## 매개변수 생성자 — 초기값을 받아 필드 설정

객체 생성 시점에 필드 값을 외부에서 주입하고 싶을 때 사용한다.

```java
class Person {
    String name;
    int    age;
    String email;

    Person(String name, int age, String email) {
        this.name  = name;
        this.age   = age;
        this.email = email;
    }
}

Person p = new Person("Alice", 30, "alice@example.com");
```

`this.name = name;` 처럼 `this.필드명`을 쓰는 이유는 매개변수 이름과 필드 이름이 같을 때 **필드를 가리키기 위해서**다. `this`가 없으면 양쪽 모두 매개변수를 참조하게 된다. `this` 키워드에 대한 자세한 내용은 다음 글에서 다룬다.

## 생성자 오버로딩 — 다양한 방식으로 객체 생성

같은 클래스에 매개변수 개수·타입이 다른 생성자를 여러 개 선언하는 것을 **생성자 오버로딩**이라 한다.

```java
class Member {
    String name;
    int    age;
    String email;

    Member(String name) {
        this.name = name;
    }

    Member(String name, int age) {
        this.name = name;
        this.age  = age;
    }

    Member(String name, int age, String email) {
        this.name  = name;
        this.age   = age;
        this.email = email;
    }
}
```

세 생성자가 각각 초기화 코드를 갖는다. 이렇게 두면 동작하지만, 나중에 `name` 필드의 초기화 로직이 바뀌면 세 군데를 모두 수정해야 한다는 문제가 생긴다. `this()` 체이닝으로 해결할 수 있다.

![생성자 종류와 실행 흐름](/assets/posts/java-constructors-types.svg)

## this() — 같은 클래스의 다른 생성자 호출

`this(인수, ...)` 형식으로 같은 클래스 안의 다른 생성자를 호출할 수 있다. 이것이 **생성자 체이닝(constructor chaining)** 이다.

```java
class Member {
    String name;
    int    age;
    String email;

    // 1개 인수 → 2개 생성자에 위임
    Member(String name) {
        this(name, 0);          // ← this() 호출, 반드시 첫 줄
    }

    // 2개 인수 → 3개 생성자에 위임
    Member(String name, int age) {
        this(name, age, "");    // ← this() 호출, 반드시 첫 줄
    }

    // 실제 초기화 담당
    Member(String name, int age, String email) {
        this.name  = name;
        this.age   = age;
        this.email = email;
    }
}
```

`this()` 호출에는 두 가지 제약이 있다.

1. **반드시 생성자 본문의 첫 번째 줄**이어야 한다.
2. **한 생성자에서 한 번만** 호출 가능하다.

![생성자 오버로딩과 this() 체이닝](/assets/posts/java-constructors-overloading.svg)

초기화 로직이 가장 매개변수가 많은 생성자 한 곳에만 집중되므로, 변경이 발생해도 그곳만 수정하면 된다.

## 생성자가 실행되는 순서

`new` 키워드가 실행될 때 내부적으로 다음 순서가 진행된다.

```
① 힙에 메모리 공간 확보
② 모든 필드를 타입 기본값으로 초기화
③ 인스턴스 초기화 블록({ ... }) 실행 (있다면)
④ 생성자 본문 실행
⑤ 완성된 객체의 참조(주소)를 변수에 반환
```

필드 선언부에 직접 값을 할당하는 경우(`int age = 20;`)도 ②와 ④ 사이에 처리된다.

## 접근 제어자와 생성자

생성자에도 접근 제어자를 붙일 수 있다. `private` 생성자는 외부에서 직접 `new`를 호출하지 못하게 막는다.

```java
class Singleton {
    private static final Singleton INSTANCE = new Singleton();

    private Singleton() {}   // 외부 new 차단

    public static Singleton getInstance() {
        return INSTANCE;
    }
}
```

싱글턴 패턴, 팩토리 메서드 패턴, 유틸리티 클래스(인스턴스화 불필요) 등에서 자주 사용한다.

## 레코드의 컴팩트 생성자

Java 16에서 정식 도입된 `record`는 모든 필드를 매개변수로 받는 **정규 생성자(canonical constructor)** 를 자동으로 생성한다. 유효성 검사만 필요할 때는 컴팩트 생성자를 사용할 수 있다.

```java
record Range(int min, int max) {
    Range {                              // 컴팩트 생성자 — 매개변수 목록 생략
        if (min > max)
            throw new IllegalArgumentException("min > max");
    }
}

var r = new Range(1, 10);  // OK
var bad = new Range(5, 3); // IllegalArgumentException
```

컴팩트 생성자는 매개변수 목록을 생략하며, JVM이 나머지 필드 대입을 자동으로 처리한다.

## 설계 원칙 요약

| 상황 | 권장 방법 |
|---|---|
| 필수 필드만 있을 때 | 단일 매개변수 생성자 |
| 선택 필드가 많을 때 | 빌더 패턴 (`Builder`) |
| 오버로딩 중복 제거 | `this()` 체이닝으로 위임 |
| 불변 객체 | 생성자에서 모든 필드 초기화, setter 제거 |
| 외부 생성 차단 | `private` 생성자 + 정적 팩토리 메서드 |

---

**지난 글:** [Java 필드와 메서드 — 객체의 상태와 행동 정의](/posts/java-fields-methods/)

**다음 글:** [Java this 키워드 완전 정복 — 인스턴스 자기 참조](/posts/java-this-keyword/)

<br>
읽어주셔서 감사합니다. 😊
