---
title: "Java 다형성 완전 정복 — 업캐스팅과 동적 디스패치"
description: "Java 다형성의 핵심인 업캐스팅, 동적 디스패치, 다운캐스팅, instanceof 패턴 매칭을 예제 중심으로 완전 정복하고 OCP 원칙과의 연결까지 설명한다"
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "다형성", "polymorphism", "업캐스팅", "동적 디스패치", "instanceof", "OOP", "객체지향", "오버라이딩"]
featured: false
draft: false
---

[지난 글](/posts/java-super-keyword/)에서 `super` 키워드로 부모 클래스의 생성자와 메서드에 접근하는 방법을 살펴봤다. `super`를 배우면 자연스럽게 상속의 진짜 힘인 **다형성(Polymorphism)** 으로 이어진다. 다형성은 "하나의 타입으로 여러 형태의 객체를 다룰 수 있는 능력"이다. Java 객체지향의 4대 핵심 원칙 중 하나이며, 설계 유연성의 근간이 된다.

## 다형성이란

`Animal` 타입 변수 하나로 `Dog`, `Cat`, `Bird` 객체를 모두 가리킬 수 있고, `sound()`를 호출했을 때 각 객체가 자신만의 소리를 낸다면 — 이것이 다형성이다. 타입은 하나지만 동작은 다양하다.

![다형성 — 하나의 타입, 다양한 동작](/assets/posts/java-polymorphism-overview.svg)

## 업캐스팅 — 자식을 부모 타입으로

자식 객체를 부모 타입 변수에 대입하는 것을 **업캐스팅(upcasting)** 이라 한다. 자식은 부모의 모든 멤버를 갖고 있으므로 항상 안전하고, 명시적 형변환 없이 자동으로 이루어진다.

```java
Animal a1 = new Dog("Rex");    // Dog → Animal, 자동 변환
Animal a2 = new Cat("Nabi");   // Cat → Animal, 자동 변환
Animal a3 = new Bird("Tweety");
```

업캐스팅 후에는 **선언 타입(`Animal`)이 기준**이므로, `Dog`에만 있는 `fetch()`처럼 부모에 없는 메서드는 컴파일 오류가 난다.

```java
a1.sound();   // OK — Animal에 sound() 있음
a1.fetch();   // 컴파일 오류 — Animal에 fetch() 없음
```

## 동적 디스패치 — 런타임에 결정되는 메서드

업캐스팅된 참조로 오버라이딩된 메서드를 호출하면 **런타임에 실제 객체 타입을 보고** 어떤 메서드를 실행할지 결정한다. 이것이 **동적 디스패치(dynamic dispatch)** 다.

```java
Animal[] animals = {
    new Dog("Rex"),
    new Cat("Nabi"),
    new Bird("Tweety")
};

for (Animal a : animals) {
    a.sound();   // Dog이면 "멍멍!", Cat이면 "야옹!", Bird이면 "짹짹!"
}
```

컴파일러는 `a.sound()`를 `Animal.sound()` 시그니처로만 검증하고, 실제 어떤 구현이 실행될지는 JVM이 런타임에 결정한다. JVM은 내부적으로 **가상 메서드 테이블(vtable)** 을 통해 O(1)으로 메서드를 조회한다.

![동적 디스패치 — 컴파일 vs 런타임](/assets/posts/java-polymorphism-dispatch.svg)

## 다형성이 가져오는 설계 이점

다형성 덕분에 새로운 타입을 추가할 때 **기존 코드를 전혀 수정하지 않아도 된다**. 이것이 OCP(Open-Closed Principle)다.

```java
// 다형성 없이 — if-else 지옥
public void makeSound(Object animal) {
    if (animal instanceof Dog d) {
        System.out.println("멍멍!");
    } else if (animal instanceof Cat c) {
        System.out.println("야옹!");
    }
    // 새 동물 추가 시마다 여기도 수정해야 함
}

// 다형성 활용 — 새 타입 추가 시 기존 코드 변경 없음
public void makeSound(Animal animal) {
    animal.sound();   // 실제 타입이 무엇이든 적절한 sound() 실행
}
```

`makeSound(new Parrot("Polly"))`를 호출해도 `makeSound` 메서드는 수정할 필요가 없다. `Parrot`이 `Animal`을 상속하고 `sound()`를 오버라이딩하기만 하면 된다.

## 다운캐스팅과 instanceof

업캐스팅된 참조를 다시 구체 타입으로 되돌리는 것이 **다운캐스팅(downcasting)** 이다. 실제 타입과 캐스팅 타입이 다르면 런타임에 `ClassCastException`이 발생한다.

```java
Animal a = new Dog("Rex");

// 전통 방식 — instanceof 확인 후 명시적 캐스팅
if (a instanceof Dog) {
    Dog dog = (Dog) a;   // 명시적 캐스팅 필요
    dog.fetch();
}

// 패턴 매칭 instanceof (Java 16+) — 더 간결하고 안전
if (a instanceof Dog dog) {
    dog.fetch();   // 조건 만족 시 dog는 Dog 타입으로 바로 사용
}
```

Java 21에서는 `switch` 표현식에서도 패턴 매칭을 지원한다.

```java
// switch 패턴 매칭 (Java 21)
String result = switch (a) {
    case Dog d  -> d.getName() + ": 멍멍!";
    case Cat c  -> c.getName() + ": 야옹!";
    case Bird b -> b.getName() + ": 짹짹!";
    default     -> "알 수 없는 동물";
};
```

## 정적 메서드는 다형성의 대상이 아니다

동적 디스패치는 **인스턴스 메서드**에만 적용된다. 정적 메서드는 컴파일 타임 선언 타입에 따라 결정된다.

```java
public class Animal {
    public static String type() { return "동물"; }
    public String sound()       { return "..."; }
}

public class Dog extends Animal {
    public static String type() { return "개"; }   // 오버라이딩이 아닌 숨김(hiding)
    @Override
    public String sound()       { return "멍멍!"; }
}

Animal a = new Dog("Rex");
System.out.println(a.type());   // → "동물" (정적: 선언 타입 기준)
System.out.println(a.sound());  // → "멍멍!" (인스턴스: 실제 타입 기준)
```

정적 메서드는 재정의가 아닌 **메서드 숨김(method hiding)** 이 일어나므로, 다형성의 혜택을 받지 못한다.

## 필드도 다형성 대상이 아니다

메서드와 달리 **필드**는 런타임 타입이 아닌 선언 타입 기준으로 접근된다.

```java
public class Animal { public String type = "동물"; }
public class Dog extends Animal { public String type = "개"; }

Animal a = new Dog("Rex");
System.out.println(a.type);   // → "동물" (선언 타입 Animal의 필드)
```

필드를 직접 노출하는 대신 getter를 사용하면 이 혼란을 피할 수 있다. getter는 인스턴스 메서드이므로 다형성이 적용된다.

## 다형성 + 인터페이스

다형성의 진가는 인터페이스와 함께 더욱 빛난다. 구체 클래스가 아닌 인터페이스 타입으로 프로그래밍하면 결합도를 낮출 수 있다.

```java
public interface Printable {
    void print();
}

public class Document implements Printable {
    @Override
    public void print() { System.out.println("문서 인쇄"); }
}

public class Image implements Printable {
    @Override
    public void print() { System.out.println("이미지 인쇄"); }
}

// Printable 인터페이스 타입으로 다형성 활용
List<Printable> items = List.of(new Document(), new Image());
items.forEach(Printable::print);
```

인터페이스 기반 다형성은 클래스 계층과 무관하게 "할 수 있는 일"을 기준으로 객체를 다룰 수 있게 한다. Spring의 DI(Dependency Injection), 컬렉션 프레임워크, 람다 표현식 모두 이 원리 위에 서 있다.

## 정리

다형성은 Java OOP의 핵심이다.

| 개념 | 설명 |
|------|------|
| 업캐스팅 | 자식 → 부모 타입으로 자동 변환 |
| 동적 디스패치 | 런타임에 실제 타입의 오버라이딩 메서드 실행 |
| 다운캐스팅 | 부모 → 자식 타입으로 명시적 변환, ClassCastException 위험 |
| instanceof | 타입 확인 후 안전하게 캐스팅 (Java 16+ 패턴 매칭) |
| 정적 멤버 | 선언 타입 기준 — 다형성 적용 안 됨 |

다형성을 제대로 활용하면 새로운 타입이 추가되어도 기존 코드를 건드리지 않아도 되는 확장 가능한 설계를 만들 수 있다. 다음 글에서는 다형성 설계의 토대가 되는 **추상 클래스**를 살펴본다.

---

**지난 글:** [Java super 키워드 완전 정복 — 생성자 체이닝과 부모 멤버 접근](/posts/java-super-keyword/)

**다음 글:** [Java 추상 클래스 완전 정복 — abstract와 설계 계약](/posts/java-abstract-class/)

<br>
읽어주셔서 감사합니다. 😊
