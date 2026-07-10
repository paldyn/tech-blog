---
title: "Java 상속 완전 정복 — extends로 코드를 물려받는 법"
description: "Java 상속(inheritance)의 동작 원리와 extends 키워드 사용법, protected 접근 제어자, super() 생성자 체인, IS-A 관계 설계 원칙까지 예제 중심으로 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "상속", "inheritance", "extends", "super", "IS-A", "OOP", "객체지향", "다형성"]
featured: false
draft: false
---

[지난 글](/posts/java-getter-setter/)에서 getter와 setter로 캡슐화를 구현하는 방법을 살펴봤다. 이번에는 객체지향의 또 다른 핵심 기둥인 **상속(Inheritance)** 을 다룬다. 상속을 이해하면 중복 코드를 획기적으로 줄이고, 계층 구조를 통해 더 명확한 설계가 가능해진다.

## 상속이란 무엇인가

상속은 기존 클래스(부모 클래스, 슈퍼클래스)의 필드와 메서드를 새로운 클래스(자식 클래스, 서브클래스)가 물려받는 메커니즘이다. `extends` 키워드 하나로 수십 줄의 코드를 재사용할 수 있다.

```java
// 부모 클래스
public class Animal {
    protected String name;
    protected int age;

    public Animal(String name, int age) {
        this.name = name;
        this.age  = age;
    }

    public String getName() { return name; }

    public void sound() {
        System.out.println("...");
    }
}

// 자식 클래스 — Animal을 상속
public class Dog extends Animal {
    private String breed;

    public Dog(String name, int age, String breed) {
        super(name, age);       // 부모 생성자 호출 (반드시 첫 줄)
        this.breed = breed;
    }

    @Override
    public void sound() {
        System.out.println("멍멍!");
    }

    public void fetch() {
        System.out.println(name + "이(가) 공을 가져왔다!"); // 상속된 필드 사용
    }
}
```

`Dog extends Animal`이라고 선언하는 순간, `Dog`는 `Animal`의 `name`, `age` 필드와 `getName()`, `sound()` 메서드를 자동으로 갖게 된다.

## 계층 구조 시각화

아래는 `Animal`을 부모로 두고 `Dog`와 `Cat`이 각각 상속하는 구조다. 두 자식 클래스는 공통 상태(`name`, `age`)는 부모에서, 고유한 상태와 행동은 스스로 추가한다.

![Java 상속 계층 구조](/assets/posts/java-inheritance-hierarchy.svg)

## IS-A 관계: 상속의 핵심 설계 기준

상속을 사용하기 전에 반드시 자문해야 할 질문이 있다. **"자식은 부모인가?(IS-A)"**

- `Dog is-a Animal` → 자연스럽다 ✓
- `Engine is-a Car` → 어색하다 ✗ (엔진은 자동차가 아니라 자동차의 일부)

IS-A 관계가 성립하지 않는다면 상속 대신 **컴포지션(has-a)** 을 써야 한다. 상속을 무분별하게 사용하면 부모 클래스 변경이 모든 자식에게 영향을 미쳐 유지보수가 어려워진다.

## protected 접근 제어자

부모 클래스의 `private` 필드는 자식 클래스에서도 직접 접근할 수 없다. 자식이 부모 필드를 직접 사용하길 원한다면 `protected`를 써야 한다.

```java
public class Animal {
    protected String name;  // 같은 패키지 + 자식 클래스에서 접근 가능
    private   int    age;   // 자식 클래스에서도 직접 접근 불가
}

public class Dog extends Animal {
    public void introduce() {
        System.out.println(name);         // OK — protected
        // System.out.println(age);       // 컴파일 에러 — private
        System.out.println(getAge());     // OK — getter 사용
    }
}
```

일반적으로는 `private` + getter를 유지하는 쪽이 캡슐화에 더 유리하다. `protected`는 상속 계층 내에서 공유할 이유가 명확할 때만 사용한다.

## super() — 부모 생성자 호출

자식 클래스의 생성자에서는 **첫 번째 줄**에 반드시 `super()`를 호출해야 한다. 명시하지 않으면 컴파일러가 자동으로 `super()`(인수 없는 버전)를 삽입한다. 부모에 기본 생성자가 없다면 컴파일 에러가 발생한다.

```java
public class Cat extends Animal {
    private boolean indoor;

    public Cat(String name, int age, boolean indoor) {
        super(name, age);       // 필수: 부모 Animal(String, int) 호출
        this.indoor = indoor;
    }
}

Cat c = new Cat("나비", 3, true);
System.out.println(c.getName()); // "나비" — 상속된 메서드
```

## 상속 코드 구조 전체 흐름

![상속 코드 구조와 상속 체인](/assets/posts/java-inheritance-code.svg)

`super()`는 부모의 초기화 로직을 재사용하는 핵심이다. 오른쪽 코드에서 볼 수 있듯이 `Dog` 생성자는 `name`과 `age` 초기화를 부모에 위임하고, 자신은 `breed`만 초기화한다.

## 상속 체인과 Object 클래스

Java의 모든 클래스는 명시적 `extends`가 없더라도 `java.lang.Object`를 암묵적으로 상속한다. 따라서 상속 체인은 항상 `Object`에서 끝난다.

```text
Object
  └── Animal
        ├── Dog
        └── Cat
```

`Object`가 제공하는 `toString()`, `equals()`, `hashCode()` 같은 메서드를 모든 Java 객체에서 호출할 수 있는 이유가 바로 이 때문이다.

## 단일 상속과 다중 인터페이스

Java는 **단일 상속**만 지원한다. 클래스는 하나의 부모 클래스만 `extends`할 수 있다. 다중 상속이 필요한 경우에는 인터페이스(`implements`)로 해결한다.

```java
// 불가 — 컴파일 에러
public class Hybrid extends Dog, Cat { }

// 가능 — 인터페이스는 여러 개 구현 가능
public class RobotDog extends Dog implements Chargeable, Trackable { }
```

## 상속 사용 시 주의사항

상속은 강력하지만 남용하면 독이 된다.

- **깊은 상속 계층(4단계 이상)** 은 추적이 어렵고 부모 변경 시 충격이 크다.
- **부모 클래스에 구체 로직을 너무 많이 두면** 자식이 부모 구현에 강하게 결합된다.
- 설계 원칙상 **IS-A가 명확하지 않으면 컴포지션을 선택**한다.
- `final class`로 선언된 클래스는 상속이 불가하다(`String`, `Integer` 등).

---

**지난 글:** [Java getter와 setter 완전 정복 — 올바른 설계와 안티패턴](/posts/java-getter-setter/)

**다음 글:** [Java 메서드 오버라이딩 완전 정복 — @Override와 재정의 규칙](/posts/java-method-overriding/)

<br>
읽어주셔서 감사합니다. 😊
