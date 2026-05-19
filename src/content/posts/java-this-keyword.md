---
title: "Java this 키워드 완전 정복 — 인스턴스 자기 참조"
description: "Java this 키워드의 세 가지 용법을 완전 정복한다. 필드/매개변수 구별, 현재 객체 참조 반환(메서드 체이닝), this()를 통한 생성자 위임까지 원리부터 활용 패턴까지 설명한다"
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "this", "this()", "메서드 체이닝", "생성자 위임", "인스턴스 참조", "빌더 패턴"]
featured: false
draft: false
---

[지난 글](/posts/java-constructors/)에서 생성자의 모든 것을 다뤘는데, 코드 곳곳에 `this`가 등장했다. 이번 글에서는 `this`가 정확히 무엇이며, 어떤 세 가지 상황에서 어떻게 활용하는지 원리부터 파헤친다.

## this가 가리키는 것

`this`는 **현재 인스턴스의 참조(주소)** 를 담은 숨겨진 변수다. 컴파일러는 모든 인스턴스 메서드(생성자 포함)에 암묵적으로 `this`를 첫 번째 매개변수로 전달한다. 개발자 눈에는 보이지 않지만 바이트코드 레벨에서는 항상 존재한다.

```java
class Counter {
    int count;

    void increment() {
        // 컴파일러가 변환하면: void increment(Counter this) { this.count++; }
        count++; // 암묵적으로 this.count++
    }
}

Counter c = new Counter();
c.increment(); // 내부에서 this = c (힙 주소 0x4A2F 등)
```

`c.increment()`를 호출하면 JVM은 `c`가 가리키는 객체의 주소를 `this`로 전달한다. `this`는 그 객체를 향하는 포인터라고 이해하면 된다.

## 용법 1 — 필드와 매개변수 이름 충돌 해결

생성자나 setter에서 매개변수 이름을 필드 이름과 동일하게 쓸 때 `this.필드명`으로 인스턴스 필드임을 명시한다.

```java
class Member {
    String name;
    int    age;

    Member(String name, int age) {
        this.name = name; // this.name → 인스턴스 필드, name → 매개변수
        this.age  = age;
    }

    void setName(String name) {
        this.name = name; // setter에서도 동일 패턴
    }
}
```

`this`를 생략하면 양쪽 모두 매개변수를 참조하게 되어 필드가 초기화되지 않는다. IntelliJ 같은 IDE는 이 경우를 경고로 표시하지만, 컴파일 오류는 나지 않으므로 런타임 버그로 이어질 수 있다.

```java
// 잘못된 예 — 필드가 초기화되지 않음
Member(String name) {
    name = name; // name(매개변수) = name(매개변수) — 필드 unchanged
}
```

![this 키워드의 3가지 용법](/assets/posts/java-this-keyword-usages.svg)

## 용법 2 — 현재 객체 참조 반환 (메서드 체이닝)

메서드에서 `return this`를 반환하면 **같은 객체에 대한 참조**를 돌려준다. 이 덕분에 점(`.`)으로 메서드를 연속 호출하는 **메서드 체이닝**이 가능하다.

```java
class QueryBuilder {
    private String table;
    private String condition;
    private int    limit;

    QueryBuilder from(String table) {
        this.table = table;
        return this; // 자기 자신을 반환 → 체이닝 가능
    }

    QueryBuilder where(String condition) {
        this.condition = condition;
        return this;
    }

    QueryBuilder limit(int limit) {
        this.limit = limit;
        return this;
    }

    String build() {
        return "SELECT * FROM " + table
             + " WHERE " + condition
             + " LIMIT " + limit;
    }
}

// 메서드 체이닝 사용
String sql = new QueryBuilder()
    .from("users")
    .where("age > 18")
    .limit(10)
    .build();
```

`return this` 패턴은 **빌더 패턴(Builder Pattern)** 의 핵심이기도 하다. `Lombok`의 `@Builder`, `StringBuilder`, `Stream.Builder` 등 Java 표준 API 곳곳에서 이 패턴을 볼 수 있다.

![return this — 메서드 체이닝 패턴](/assets/posts/java-this-keyword-chaining.svg)

## 용법 3 — this()로 생성자 위임

`this(인수)`는 **같은 클래스의 다른 생성자**를 호출한다. 생성자 오버로딩에서 중복 초기화 코드를 한 곳으로 모을 때 사용한다.

```java
class Product {
    String name;
    int    price;
    String category;

    Product(String name) {
        this(name, 0); // ① name, price=0 생성자에 위임 — 반드시 첫 줄
    }

    Product(String name, int price) {
        this(name, price, "기타"); // ② 3-인수 생성자에 위임 — 반드시 첫 줄
    }

    Product(String name, int price, String category) { // ③ 실제 초기화
        this.name     = name;
        this.price    = price;
        this.category = category;
    }
}
```

`this()` 호출에는 두 가지 엄격한 제약이 있다.

- **반드시 생성자 본문의 첫 번째 문장**이어야 한다.
- **한 생성자에서 한 번만** 사용 가능하다.

두 규칙을 어기면 컴파일 오류가 발생한다.

## static 맥락에서 this는 사용 불가

`static` 메서드나 `static` 초기화 블록에서는 `this`를 쓸 수 없다. 정적 멤버는 인스턴스 없이 클래스 레벨에서 호출되므로, 가리킬 "현재 인스턴스"가 존재하지 않는다.

```java
class Util {
    static int count = 0;

    static void reset() {
        count = 0;    // OK — 정적 필드 직접 참조
        // this.count = 0; // 컴파일 에러: 'this' cannot be used in a static context
    }
}
```

## 람다 내부의 this — 익명 클래스와 다르다

람다 내부에서 `this`는 **람다를 감싸는 클래스의 인스턴스**를 참조한다. 이것이 익명 클래스와의 핵심 차이다.

```java
class Printer {
    String name = "Printer";

    Runnable getLambda() {
        return () -> System.out.println(this.name); // this → Printer 인스턴스
    }

    Runnable getAnonymous() {
        return new Runnable() {
            String name = "Anonymous";

            @Override
            public void run() {
                System.out.println(this.name); // this → 익명 클래스 인스턴스
            }
        };
    }
}

Printer p = new Printer();
p.getLambda().run();    // "Printer"
p.getAnonymous().run(); // "Anonymous"
```

람다는 새로운 스코프를 만들지 않고 둘러싼 클래스의 `this`를 그대로 캡처한다.

## 주요 활용 패턴 정리

```java
class FluentPerson {
    private String name;
    private int    age;

    // ① 필드 초기화 — this.필드 = 매개변수
    FluentPerson(String name, int age) {
        this.name = name;
        this.age  = age;
    }

    // ② 생성자 위임 — this()
    FluentPerson(String name) {
        this(name, 0); // age 기본값 0
    }

    // ③ 메서드 체이닝 — return this
    FluentPerson withAge(int age) {
        this.age = age;
        return this;
    }

    @Override
    public String toString() {
        return name + "(" + age + ")";
    }
}

// 세 가지 용법이 모두 조화
var p = new FluentPerson("Alice").withAge(30);
System.out.println(p); // Alice(30)
```

| 용법 | 형식 | 주목적 |
|---|---|---|
| 필드 구별 | `this.필드명` | 이름 충돌 해결 |
| 현재 객체 반환 | `return this` | 메서드 체이닝·빌더 |
| 생성자 위임 | `this(인수)` | 오버로딩 중복 제거 |

---

**지난 글:** [Java 생성자 완전 정복 — 기본·매개변수·오버로딩·체이닝](/posts/java-constructors/)

**다음 글:** [Java 메서드 오버로딩 — 같은 이름, 다른 매개변수](/posts/java-method-overloading/)

<br>
읽어주셔서 감사합니다. 😊
