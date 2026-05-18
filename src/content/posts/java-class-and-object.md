---
title: "Java 클래스와 객체 — 설계도와 실체의 세계"
description: "Java 객체지향의 핵심인 클래스와 객체 개념을 코드와 메모리 구조로 완전히 이해한다. 클래스 선언, new 키워드, 참조 변수, 힙·스택 메모리까지 한 번에 정복"
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "클래스", "객체", "인스턴스", "OOP", "new 키워드", "참조 변수", "힙 메모리"]
featured: false
draft: false
---

[지난 글](/posts/java-text-block/)에서 여러 줄 문자열을 깔끔하게 다루는 Text Block을 살펴봤다. 이번 글부터는 Java의 본령인 **객체지향 프로그래밍(OOP)** 을 본격적으로 파고든다. 첫 시작은 모든 Java 코드의 뼈대를 이루는 **클래스(Class)** 와 **객체(Object)** 다. 이 두 개념을 제대로 이해하면 상속, 다형성, 인터페이스 같은 나머지 OOP 원칙들이 자연스럽게 따라온다.

## 클래스란 무엇인가 — 설계도

현실 세계에 빗대어 생각해보자. 자동차를 만들기 전에 설계도가 있어야 한다. 설계도에는 "엔진 배기량이 얼마", "문이 몇 개", "최고 속도가 얼마"처럼 자동차가 가질 **속성**과 "시동 걸기", "가속하기", "제동하기" 같은 **기능**이 정의된다. 설계도 자체는 실물 자동차가 아니다. 설계도를 바탕으로 공장에서 찍어낸 각각의 자동차가 비로소 실물이다.

Java에서 **클래스**는 이 설계도다. 클래스는 객체가 어떤 데이터를 갖고, 어떤 동작을 할 수 있는지를 기술한다. 클래스 선언은 메모리를 차지하지 않는다. 설계도가 서류 위의 그림일 뿐이듯이.

```java
// 클래스 선언 — 설계도를 그린다
public class Dog {
    // 필드: 객체의 상태(데이터)
    String name;
    int age;

    // 생성자: 객체를 초기화하는 특수 메서드
    Dog(String name, int age) {
        this.name = name;
        this.age  = age;
    }

    // 메서드: 객체의 행동(기능)
    void bark() {
        System.out.println(name + ": 왈왈!");
    }
}
```

클래스 선언 자체만으로는 아무것도 실행되지 않는다. 메모리에 올라가는 것은 클래스의 메타정보(클래스 로더가 메서드 영역에 올림) 뿐이고, 실제 데이터를 담을 공간은 아직 없다.

## 객체란 무엇인가 — 설계도로 만든 실체

설계도(클래스)를 바탕으로 실제 메모리 공간을 할당받아 만들어진 실체를 **객체(Object)** 또는 **인스턴스(Instance)** 라고 한다.

```java
Dog d1 = new Dog("Rex", 3);  // Dog 클래스의 객체 생성
Dog d2 = new Dog("Max", 5);  // 또 다른 객체 생성
```

`d1`과 `d2`는 같은 `Dog` 클래스로 만들어졌지만 **서로 다른 메모리 공간**을 차지하는 독립된 객체다. `d1.name`을 바꿔도 `d2.name`은 변하지 않는다. 한 공장의 설계도로 찍어낸 두 자동차가 별개의 실물이듯이.

![클래스 구조 분해](/assets/posts/java-class-and-object-structure.svg)

## 클래스 선언 문법 완전 분석

```java
[접근 제어자] class [클래스명] [extends 부모클래스] [implements 인터페이스...] {
    // 멤버: 필드, 생성자, 메서드
}
```

- **접근 제어자**: `public`이면 어디서든 접근 가능. 생략하면 같은 패키지 내에서만 접근 가능 (package-private).
- **클래스명**: 관례상 UpperCamelCase. `Dog`, `UserAccount`, `HttpClient` 처럼.
- **extends**: 단 하나의 부모 클래스만 상속 가능 (단일 상속).
- **implements**: 여러 인터페이스를 쉼표로 구분해 구현 가능.

### 최상위 클래스와 중첩 클래스

`.java` 파일 하나에는 `public` 클래스가 하나만 올 수 있고, 파일 이름은 그 클래스 이름과 일치해야 한다. 단, `public`이 아닌 클래스는 같은 파일 안에 여러 개 선언할 수 있다.

```java
// Dog.java
public class Dog {          // 최상위 public 클래스 → 파일명과 동일
    // ...
}

class DogUtil {             // public 아닌 보조 클래스 → 같은 파일 가능
    // ...
}
```

## `new` 키워드와 객체 생성 과정

`new` 키워드가 실행되면 JVM은 다음 단계를 수행한다.

1. **힙(Heap) 메모리 할당**: 필드를 저장할 공간을 힙에 확보한다.
2. **기본값 초기화**: 정수형 `0`, 참조형 `null`, 불리언 `false` 등으로 초기화.
3. **생성자 실행**: 우리가 작성한 생성자 코드로 필드를 원하는 값으로 설정.
4. **참조 반환**: 힙에 생성된 객체의 메모리 주소(참조값)를 반환.

반환된 참조값은 스택(Stack)의 지역변수(참조 변수)에 저장된다.

```java
Dog d1 = new Dog("Rex", 3);
//   ↑         ↑
// 스택의        힙에 생성된 Dog 객체
// 참조 변수    (이름 "Rex", 나이 3 저장)
```

![객체 생성과 메모리 구조](/assets/posts/java-class-and-object-instantiation.svg)

## 참조 변수 — 주소를 담는 그릇

`Dog d1`은 `Dog` 타입의 **참조 변수**다. 참조 변수는 객체 자체가 아니라 **객체가 위치한 힙 주소**를 담는다. C 언어의 포인터와 개념은 같지만, Java는 포인터 산술 연산이 없고 GC가 주소를 관리하므로 훨씬 안전하다.

```java
Dog d1 = new Dog("Rex", 3);
Dog d3 = d1;   // d3는 d1과 같은 객체를 가리킨다

d3.name = "Buddy";   // d3를 통해 객체의 name을 변경
System.out.println(d1.name);   // "Buddy" — d1도 같은 객체이므로
```

`d1`과 `d3`는 서로 다른 참조 변수지만 같은 힙 객체를 가리킨다. 한쪽에서 변경하면 다른 쪽에서도 변경된 값이 보인다. 이 특성을 **알리아싱(Aliasing)** 이라고 부른다.

### null — 아무것도 가리키지 않는 참조

참조 변수에 아무 객체도 가리키지 않음을 명시적으로 표현할 때 `null`을 사용한다.

```java
Dog d4 = null;         // 아무 객체도 가리키지 않음
d4.bark();             // NullPointerException 발생!

if (d4 != null) {      // null 체크 필수
    d4.bark();
}
```

`null` 참조로 메서드를 호출하면 런타임에 `NullPointerException`이 발생한다. Java 14+에서는 어떤 변수가 null인지 메시지에 명시해줘서 디버깅이 쉬워졌다.

## 멤버 접근 — 점(.) 연산자

객체의 필드와 메서드는 **점(.) 연산자**로 접근한다.

```java
Dog d1 = new Dog("Rex", 3);

// 필드 읽기
System.out.println(d1.name);   // Rex
System.out.println(d1.age);    // 3

// 필드 쓰기
d1.age = 4;

// 메서드 호출
d1.bark();   // Rex: 왈왈!
```

접근 제어자(`private`, `protected`, `public`)가 어떻게 설정됐느냐에 따라 외부에서 직접 접근할 수 있는지 결정된다. 좋은 설계에서는 필드를 `private`으로 감추고 메서드를 통해서만 접근하도록 한다(캡슐화). 이는 이후 글에서 자세히 다룬다.

## 클래스의 구성 요소 요약

클래스 안에 선언할 수 있는 **멤버(Member)** 는 세 가지다.

| 멤버 | 역할 | 반환값 |
|------|------|--------|
| **필드(Field)** | 객체의 상태(데이터) 저장 | — |
| **생성자(Constructor)** | 객체 초기화, `new` 시 자동 호출 | 없음(void도 아님) |
| **메서드(Method)** | 객체의 행동(기능) 정의 | 있거나 없음 |

생성자는 클래스 이름과 동일하고, 반환 타입을 선언하지 않는다는 점이 메서드와 다르다. 생성자를 하나도 정의하지 않으면 컴파일러가 매개변수 없는 **기본 생성자(default constructor)** 를 자동으로 추가한다.

```java
public class Point {
    int x;
    int y;
    // 생성자 없음 → 컴파일러가 아래를 자동 추가
    // Point() { }
}

Point p = new Point();   // 기본 생성자로 생성 가능
p.x = 10;
p.y = 20;
```

단, 직접 생성자를 하나라도 정의하면 기본 생성자는 자동 추가되지 않는다.

## 실전 예제 — 은행 계좌 클래스

추상적인 `Dog`를 넘어, 실무에서 자주 보는 형태의 클래스를 살펴보자.

```java
public class BankAccount {
    String owner;
    double balance;

    BankAccount(String owner, double initialBalance) {
        this.owner   = owner;
        this.balance = initialBalance;
    }

    void deposit(double amount) {
        if (amount > 0) balance += amount;
    }

    boolean withdraw(double amount) {
        if (amount > 0 && balance >= amount) {
            balance -= amount;
            return true;
        }
        return false;
    }

    void printStatus() {
        System.out.printf("[%s] 잔액: %.2f원%n", owner, balance);
    }
}
```

```java
BankAccount acc1 = new BankAccount("Alice", 100_000);
BankAccount acc2 = new BankAccount("Bob",   50_000);

acc1.deposit(20_000);
acc1.withdraw(10_000);
acc1.printStatus();   // [Alice] 잔액: 110000.00원

acc2.printStatus();   // [Bob] 잔액: 50000.00원  (acc1과 완전히 독립)
```

`acc1`의 `balance`를 바꿔도 `acc2`는 영향받지 않는다. 이것이 클래스와 객체의 가장 중요한 특성이다.

## 클래스 vs 객체 핵심 비교

| | 클래스 | 객체 |
|--|--------|------|
| **정의** | 설계도 | 설계도로 만든 실체 |
| **메모리** | 메서드 영역(클래스 정보) | 힙(필드 데이터) |
| **개수** | .java 파일당 주로 1개 | 클래스 1개로 무한 생성 가능 |
| **생성** | 컴파일 타임 | `new` 키워드 (런타임) |
| **접근** | 클래스명 | 참조 변수.멤버 |

## 정리

클래스는 **설계도**, 객체는 **그 설계도로 만든 실체**다. `new` 키워드가 힙 메모리에 실체를 생성하고, 참조 변수는 그 주소를 스택에 저장한다. 참조 변수끼리 같은 객체를 가리킬 수 있고(알리아싱), `null`은 아무것도 가리키지 않음을 뜻한다.

다음 글에서는 클래스 구성 요소 중 **필드와 메서드**를 깊게 파고든다. 기본값, 타입별 특성, 매개변수 전달 방식까지 꼼꼼하게 다룬다.

---

**지난 글:** [Java Text Block 완전 정복 — 여러 줄 문자열 처리](/posts/java-text-block/)

**다음 글:** [Java 필드와 메서드 — 객체의 상태와 행동 정의](/posts/java-fields-methods/)

<br>
읽어주셔서 감사합니다. 😊
