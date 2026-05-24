---
title: "Java 메서드 오버라이딩 완전 정복 — @Override와 재정의 규칙"
description: "Java 메서드 오버라이딩의 5가지 규칙, @Override 애노테이션의 역할, 동적 디스패치 원리, super 메서드 호출 패턴, 오버로딩과의 차이점을 예제 중심으로 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "오버라이딩", "overriding", "@Override", "다형성", "동적 디스패치", "super", "OOP", "객체지향"]
featured: false
draft: false
---

[지난 글](/posts/java-inheritance/)에서 `extends`로 부모 클래스를 상속하는 방법을 살펴봤다. 상속을 배우고 나면 곧바로 마주치는 개념이 **메서드 오버라이딩(Method Overriding)** 이다. 오버라이딩은 자식 클래스가 부모에서 물려받은 메서드를 자신에게 맞게 **재정의**하는 것이다. 이것이 Java 다형성의 실제 구현 메커니즘이다.

## 오버라이딩이란

부모 클래스의 `sound()` 메서드가 `"..."`을 출력한다고 하자. `Dog`는 `"멍멍!"`, `Cat`은 `"야옹!"`을 출력해야 한다. 오버라이딩을 사용하면 각 자식 클래스가 동일한 메서드 이름 아래 자신만의 행동을 정의할 수 있다.

```java
public class Animal {
    public void sound() {
        System.out.println("...");
    }
}

public class Dog extends Animal {
    @Override
    public void sound() {           // 부모 메서드를 재정의
        System.out.println("멍멍!");
    }
}

public class Cat extends Animal {
    @Override
    public void sound() {
        System.out.println("야옹!");
    }
}
```

`@Override`는 생략 가능하지만 **반드시 붙여야** 한다. 이 애노테이션이 없으면 시그니처를 잘못 적어도 컴파일러가 오버라이딩 실패를 알려주지 못하고, 의도와 다른 새 메서드가 그냥 추가된다.

## 오버라이딩 5가지 규칙

![메서드 오버라이딩 규칙](/assets/posts/java-method-overriding-rules.svg)

규칙을 코드로 확인해 보자.

```java
public class Parent {
    protected Number compute() throws IOException { return 0; }
}

public class Child extends Parent {
    // ① 메서드 이름·파라미터 동일
    // ② 반환 타입은 공변(Number의 서브타입 Integer)
    // ③ 접근 제어자 완화 (protected → public)
    // ④ 예외는 더 좁게 (IOException → FileNotFoundException)
    @Override
    public Integer compute() throws FileNotFoundException { return 1; }
}
```

한 가지 더: `static` 메서드는 오버라이딩이 아니라 **메서드 히딩(method hiding)** 이다. 참조 타입이 부모면 부모 버전이 불리고, 자식이면 자식 버전이 불린다. 동적 디스패치가 적용되지 않는다.

```java
public class Base {
    public static void greet() { System.out.println("Base"); }
}
public class Sub extends Base {
    public static void greet() { System.out.println("Sub"); }
}

Base b = new Sub();
b.greet(); // "Base" — static은 참조 타입 기준
```

## 동적 디스패치 — 다형성의 엔진

오버라이딩의 진가는 **부모 타입 참조 변수**에 자식 객체를 담을 때 드러난다.

```java
Animal a1 = new Dog("바둑", 3);
Animal a2 = new Cat("나비", 2);

a1.sound(); // "멍멍!" — 런타임에 Dog.sound() 호출
a2.sound(); // "야옹!" — 런타임에 Cat.sound() 호출

List<Animal> animals = List.of(a1, a2);
animals.forEach(Animal::sound); // 각각 다른 메서드 실행
```

컴파일러는 `a1`을 `Animal` 타입으로 보고 `Animal.sound()`를 호출하는 바이트코드를 생성한다. 하지만 JVM은 **실행 시점에 실제 객체 타입**(`Dog`)을 보고 `Dog.sound()`를 실행한다. 이것이 **동적 메서드 디스패치(Dynamic Method Dispatch)** 다.

![동적 디스패치 — 런타임 다형성의 핵심](/assets/posts/java-method-overriding-polymorphism.svg)

JVM은 클래스마다 **가상 메서드 테이블(vtable)** 을 유지하여 각 메서드의 실제 구현 주소를 저장한다. JIT 컴파일러는 단일 타입으로 수렴하는 호출 지점을 감지해 인라인으로 최적화하므로 성능 비용은 사실상 없다.

## super로 부모 메서드 활용

재정의할 때 부모의 로직을 완전히 버리지 않고 **위에 레이어를 추가**하고 싶다면 `super.메서드명()`을 사용한다.

```java
public class Animal {
    public void sound() {
        System.out.println("[Animal] 소리를 냅니다");
    }
}

public class Dog extends Animal {
    @Override
    public void sound() {
        super.sound();                      // 부모 로직 먼저 실행
        System.out.println("[Dog] 멍멍!");  // 자식 로직 추가
    }
}

// 실행 결과:
// [Animal] 소리를 냅니다
// [Dog] 멍멍!
```

이 패턴은 로깅, 트랜잭션 처리, 사전·사후 검증 등에서 자주 쓰인다. 단, `super` 호출 위치(처음·끝·중간)에 따라 의미가 달라지므로 설계 의도를 명확히 해야 한다.

## 오버라이딩 vs 오버로딩

두 개념을 혼동하는 경우가 많다. 핵심 차이는 다음과 같다.

```java
public class Printer {
    // 오버로딩 — 같은 이름, 다른 시그니처, 같은 클래스
    public void print(String s)  { System.out.println(s); }
    public void print(int n)     { System.out.println(n); }
}

public class ColorPrinter extends Printer {
    // 오버라이딩 — 부모와 동일한 시그니처, 자식 클래스에서 재정의
    @Override
    public void print(String s)  { System.out.println("[COLOR] " + s); }
}
```

| 구분 | 오버로딩(Overloading) | 오버라이딩(Overriding) |
|------|----------------------|----------------------|
| 위치 | 같은 클래스 내 | 부모-자식 클래스 사이 |
| 시그니처 | 달라야 함 | 동일해야 함 |
| 결정 시점 | 컴파일 타임 | 런타임 |
| 관계 | 무관 | IS-A 상속 필요 |

## 실전에서의 오버라이딩 패턴

### 추상 메서드 구현

`abstract` 메서드는 구현이 없으므로 자식이 반드시 오버라이딩해야 한다. 이것이 **강제 계약** 패턴이다.

```java
public abstract class Shape {
    public abstract double area(); // 구현 없음 — 자식이 반드시 구현
}

public class Circle extends Shape {
    private double radius;
    public Circle(double r) { this.radius = r; }

    @Override
    public double area() { return Math.PI * radius * radius; }
}
```

### 템플릿 메서드 패턴

부모가 알고리즘 뼈대를 정의하고, 세부 단계를 자식이 오버라이딩으로 채운다.

```java
public abstract class DataProcessor {
    // 뼈대 — final로 재정의 금지
    public final void process() {
        readData();
        processData(); // 자식이 재정의
        writeResult();
    }

    protected abstract void processData();

    private void readData()    { System.out.println("읽기"); }
    private void writeResult() { System.out.println("쓰기"); }
}
```

## 오버라이딩 시 자주 하는 실수

`@Override` 없이 오타를 낸 경우가 가장 흔하다. 컴파일러가 새 메서드로 인식해 오버라이딩이 전혀 일어나지 않는다.

```java
public class Dog extends Animal {
    // @Override 빠진 채 오타: sound → soound
    public void soound() {        // 오버라이딩 실패! 새 메서드 추가됨
        System.out.println("멍멍!");
    }
}

Animal a = new Dog("바둑", 3);
a.sound(); // "..." — Dog의 소리가 아닌 Animal 기본 구현 실행
```

`@Override`를 붙였다면 컴파일러가 즉시 에러를 발생시켜 이런 실수를 방지해 준다.

---

**지난 글:** [Java 상속 완전 정복 — extends로 코드를 물려받는 법](/posts/java-inheritance/)

**다음 글:** [Java super 키워드 완전 정복 — 부모 클래스 접근과 생성자 체인](/posts/java-super-keyword/)

<br>
읽어주셔서 감사합니다. 😊
