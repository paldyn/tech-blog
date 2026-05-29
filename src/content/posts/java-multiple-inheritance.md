---
title: "Java 다중 상속 — default 메서드와 다이아몬드 문제 해결"
description: "Java가 클래스 다중 상속을 허용하지 않는 이유, 인터페이스로 다중 상속을 구현하는 방법, Java 8 default 메서드가 일으키는 다이아몬드 충돌, 그리고 세 가지 해결 규칙과 InterfaceName.super 문법을 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "다중 상속", "인터페이스", "default 메서드", "다이아몬드 문제", "인터페이스 충돌", "상속"]
featured: false
draft: false
---

[지난 글](/posts/java-marker-interface/)에서 빈 몸체 인터페이스인 마커 인터페이스를 살펴봤다. 이번에는 인터페이스의 또 다른 핵심 활용, **다중 상속**을 다룬다. Java는 클래스 다중 상속을 허용하지 않지만 인터페이스를 통해 다중 타입 계층을 구성할 수 있다. Java 8에서 `default` 메서드가 추가된 이후에는 다이아몬드 문제가 인터페이스 수준에서도 실제로 발생하게 됐다.

## 클래스 다중 상속이 없는 이유

C++는 클래스 다중 상속을 허용하지만 Java는 처음부터 허용하지 않았다. 가장 큰 이유는 **다이아몬드 문제(Diamond Problem)**다.

```
      A
     / \
    B   C
     \ /
      D
```

`B`와 `C` 모두 `A`를 상속하고 동일한 메서드를 오버라이드했을 때, `D`가 두 클래스를 동시에 상속하면 어느 구현을 사용해야 하는지 모호해진다.

```java
// Java에서 불가능한 코드 — 컴파일 에러
class Animal { void speak() { System.out.println("..."); } }
class Dog    extends Animal { void speak() { System.out.println("Woof"); } }
class Cat    extends Animal { void speak() { System.out.println("Meow"); } }

// 에러: class DogCat cannot extend both Dog and Cat
class DogCat extends Dog, Cat { }  // 불가
```

Java는 이 복잡성을 피하기 위해 클래스는 단일 상속만 허용하는 설계를 선택했다.

## 인터페이스로 다중 타입 구현

클래스 다중 상속은 불가하지만, **인터페이스 다중 구현**은 허용된다. Java 7까지는 인터페이스에 메서드 구현이 없었으므로 다이아몬드 문제가 발생하지 않았다.

```java
interface Flyable  { void fly(); }
interface Swimmable { void swim(); }

class Duck implements Flyable, Swimmable {
    @Override public void fly()  { System.out.println("날다"); }
    @Override public void swim() { System.out.println("수영하다"); }
}
```

여러 인터페이스를 구현하면 그 모든 타입의 서브타입이 된다. `Duck` 인스턴스는 `Flyable`, `Swimmable` 어느 타입 변수에도 할당할 수 있다.

```java
Duck duck = new Duck();
Flyable  f = duck;   // OK
Swimmable s = duck;  // OK

f.fly();   // "날다"
s.swim();  // "수영하다"
```

인터페이스 상속도 다중으로 가능하다.

```java
interface Aquatic extends Flyable, Swimmable {
    void dive();
}

class Albatross implements Aquatic {
    @Override public void fly()  { /* ... */ }
    @Override public void swim() { /* ... */ }
    @Override public void dive() { /* ... */ }
}
```

## Java 8 default 메서드와 새로운 충돌

Java 8에서 `default` 메서드가 도입되면서 인터페이스도 메서드 구현을 가질 수 있게 됐다. 이 순간 다이아몬드 문제가 인터페이스 계층에서도 실제로 발생하기 시작했다.

```java
interface Flyable {
    default void speak() {
        System.out.println("Flyable: 날개 소리");
    }
}

interface Swimmable {
    default void speak() {
        System.out.println("Swimmable: 물소리");
    }
}

// 컴파일 에러: Duck inherits unrelated defaults for speak() from types Flyable and Swimmable
class Duck implements Flyable, Swimmable { }
```

`speak()`가 두 인터페이스 모두에 `default` 구현으로 있으면 `Duck`은 컴파일되지 않는다. 반드시 명시적으로 해결해야 한다.

![다이아몬드 문제와 Java의 해결 우선순위 규칙](/assets/posts/java-multiple-inheritance-diamond.svg)

## 충돌 해결 규칙

Java 언어 명세는 default 메서드 충돌 해결을 위해 세 가지 우선순위 규칙을 정한다.

### 규칙 1: 클래스 > 인터페이스

클래스(또는 상위 클래스)에 같은 시그니처의 메서드가 있으면 인터페이스의 `default`를 항상 이긴다.

```java
class Base {
    public void speak() {
        System.out.println("Base 클래스");
    }
}

interface Flyable {
    default void speak() {
        System.out.println("Flyable default");
    }
}

// Base.speak()이 선택됨 — 클래스가 인터페이스보다 우선
class Duck extends Base implements Flyable { }

new Duck().speak(); // "Base 클래스"
```

클래스 메서드가 추상이거나 존재하지 않을 때만 인터페이스의 `default`를 고려한다.

### 규칙 2: 더 구체적인 인터페이스가 상위 인터페이스보다 우선

인터페이스들이 계층 관계에 있을 때, 더 하위(구체적인) 인터페이스가 우선된다.

```java
interface Animal {
    default void speak() {
        System.out.println("Animal default");
    }
}

interface Bird extends Animal {
    @Override
    default void speak() {
        System.out.println("Bird default");
    }
}

// Bird가 Animal보다 더 구체적이므로 Bird.speak() 선택
class Sparrow implements Bird, Animal { }

new Sparrow().speak(); // "Bird default"
```

`Bird`가 `Animal`의 `speak()`를 오버라이드했으므로 `Sparrow`는 추가 재정의 없이 컴파일되고 `Bird`의 구현이 선택된다.

### 규칙 3: 동순위 충돌은 명시적 재정의 필수

규칙 1, 2로 해결되지 않는 충돌(계층 관계가 없는 두 인터페이스 모두 같은 시그니처의 `default` 보유)은 반드시 구현 클래스에서 재정의해야 한다.

```java
// Flyable과 Swimmable은 계층 관계 없음 — 동순위 충돌
class Duck implements Flyable, Swimmable {

    @Override
    public void speak() {
        // 선택지 1: 특정 인터페이스의 default 호출
        Flyable.super.speak();
    }
}
```

`InterfaceName.super.method()` 문법이 핵심이다. 이를 통해 어느 인터페이스의 구현을 사용할지 명확하게 지정한다.

## InterfaceName.super 문법 상세

![다중 상속 충돌 해결 세 가지 코드 패턴](/assets/posts/java-multiple-inheritance-resolution.svg)

`InterfaceName.super.method()`는 오직 인터페이스 default 메서드를 명시적으로 호출할 때만 사용 가능하다. 세 가지 재정의 패턴이 있다.

**패턴 1: 하나를 선택**

```java
class Duck implements Flyable, Swimmable {
    @Override
    public void speak() {
        Flyable.super.speak();  // Flyable의 default 사용
    }
}
```

**패턴 2: 양쪽 모두 호출**

```java
class Duck implements Flyable, Swimmable {
    @Override
    public void speak() {
        Flyable.super.speak();
        Swimmable.super.speak();
    }
}
```

**패턴 3: 완전히 새로운 구현**

```java
class Duck implements Flyable, Swimmable {
    @Override
    public void speak() {
        System.out.println("Quack!");  // 인터페이스 default 무시
    }
}
```

세 패턴 중 어느 것이든 명시적 `@Override`와 함께 컴파일 에러를 해결할 수 있다.

## 실전 시나리오

### 믹스인 패턴

인터페이스 다중 구현의 대표 용도는 **믹스인(Mixin)**이다. 여러 기능을 독립적인 인터페이스로 분리해 조합한다.

```java
interface Loggable {
    default void log(String msg) {
        System.out.println("[" + getClass().getSimpleName() + "] " + msg);
    }
}

interface Cacheable {
    default String cacheKey() {
        return getClass().getName() + "#" + hashCode();
    }
}

interface Auditable {
    default void audit(String action) {
        // 감사 로그 기록
    }
}

// 세 기능을 모두 갖춘 서비스
class OrderService implements Loggable, Cacheable, Auditable {

    public void createOrder(Order order) {
        log("주문 생성: " + order.id());   // Loggable
        audit("CREATE");                    // Auditable
        // 비즈니스 로직...
    }
}
```

각 인터페이스는 독립적이므로 충돌이 없다. `log`, `cacheKey`, `audit` 시그니처가 겹치지 않으면 `@Override` 없이도 컴파일된다.

### 충돌 방지를 위한 인터페이스 설계

여러 인터페이스를 혼합할 때 default 메서드 이름이 겹치면 충돌이 생긴다. 설계 시 공통 로직을 상위 인터페이스에 두고 하위 인터페이스가 extends하도록 구성하면 규칙 2가 자동으로 해결해 준다.

```java
interface Creature {
    default void breathe() {
        System.out.println("숨쉬다");
    }
}

interface LandCreature extends Creature { }  // breathe() 상속, 재정의 없음
interface WaterCreature extends Creature {
    @Override
    default void breathe() {
        System.out.println("아가미로 숨쉬다");
    }
}

// WaterCreature가 더 구체적 → 규칙 2로 자동 해결, 컴파일 OK
class Amphibian implements LandCreature, WaterCreature { }

new Amphibian().breathe(); // "아가미로 숨쉬다"
```

## 인터페이스 상속 체인

인터페이스 자체도 여러 인터페이스를 동시에 상속할 수 있다.

```java
interface A { default void hello() { System.out.println("A"); } }
interface B extends A { }  // hello() 재정의 없음
interface C extends A {
    @Override
    default void hello() { System.out.println("C"); }
}

// B는 A에서 hello() 그대로, C는 재정의했으므로 C 우선
class D implements B, C { }

new D().hello(); // "C" — 더 구체적인 C가 선택
```

`B`가 `hello()`를 재정의하지 않았으므로 `B`의 `hello()`는 여전히 `A`에서 온 것이다. `C`는 명시적으로 재정의했으므로 더 구체적이고, `D`에서 자동으로 `C`의 구현이 선택된다.

## 추상 클래스 + 인터페이스 조합

클래스 단일 상속과 인터페이스 다중 구현을 조합하면 상당히 유연한 계층 구조를 만들 수 있다.

```java
abstract class Vehicle {
    protected final String id;
    Vehicle(String id) { this.id = id; }
    abstract void move();
}

interface Electric {
    default void charge() {
        System.out.println("충전 중");
    }
}

interface Autonomous {
    default void autoSteer() {
        System.out.println("자율 주행 중");
    }
}

class TeslaModel3 extends Vehicle implements Electric, Autonomous {
    TeslaModel3(String id) { super(id); }

    @Override
    public void move() {
        System.out.println(id + " 이동");
    }
    // charge()와 autoSteer()는 default 그대로 사용
}
```

`extends`는 하나만 가능하지만 `implements`는 제한 없이 추가할 수 있다. 이 패턴이 Java에서 다중 상속이 필요한 대부분의 케이스를 해결한다.

## 주의 사항과 설계 원칙

**default 메서드는 남용하지 말 것**: 인터페이스는 원래 계약(contract) 정의가 목적이다. `default`를 남용하면 인터페이스가 추상 클래스처럼 동작하기 시작해 책임이 불명확해진다. 공통 구현이 많다면 추상 클래스로 리팩터링을 고려하라.

**인터페이스 분리 원칙(ISP)**: 하나의 거대한 인터페이스보다 작고 명확한 인터페이스 여러 개가 낫다. 각 클라이언트가 실제로 사용하는 메서드만 포함한 인터페이스를 제공해야 불필요한 의존성을 줄일 수 있다.

**충돌 가능성 문서화**: 라이브러리 인터페이스에 `default` 메서드를 추가할 때는 기존 코드에서 충돌이 발생할 수 있다. 특히 두 개 이상의 인터페이스를 조합해 사용하는 클라이언트에게 컴파일 에러가 발생한다. API 설계 시 충돌 가능성을 명시하는 것이 좋다.

인터페이스를 통한 다중 상속과 `default` 메서드 충돌 해결은 Java의 타입 시스템을 이해하는 데 핵심적인 개념이다. 다음 글에서는 이 인터페이스 계층 설계의 또 다른 축인 **sealed 클래스**를 다룬다. `sealed`와 `permits`로 상속 계층을 명시적으로 봉인하는 방법을 살펴볼 것이다.

---

**지난 글:** [Java 마커 인터페이스 — 빈 몸체로 타입을 마킹하는 설계 패턴](/posts/java-marker-interface/)

**다음 글:** [Java Sealed 클래스 — permits로 상속 계층 봉인하기](/posts/java-sealed-classes/)

<br>
읽어주셔서 감사합니다. 😊
