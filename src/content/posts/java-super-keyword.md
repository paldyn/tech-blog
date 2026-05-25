---
title: "Java super 키워드 완전 정복 — 생성자 체이닝과 부모 멤버 접근"
description: "Java super 키워드의 3가지 사용법(생성자 호출, 메서드 호출, 필드 접근)을 예제 중심으로 완전 정복하고, 생성자 체이닝 흐름과 컴파일러 자동 삽입 규칙까지 설명한다"
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "super", "생성자", "생성자 체이닝", "상속", "super()", "오버라이딩", "OOP", "객체지향"]
featured: false
draft: false
---

[지난 글](/posts/java-method-overriding/)에서 `@Override`로 부모 메서드를 재정의하는 방법을 살펴봤다. 오버라이딩을 하고 나면 자연스럽게 "재정의했는데 부모 구현도 함께 쓰고 싶다"는 상황이 생긴다. 바로 이 때 등장하는 것이 **`super` 키워드**다. `super`는 자식 클래스 안에서 부모 클래스의 생성자·메서드·필드에 직접 접근할 수 있게 해주는, Java 상속의 핵심 연결 고리다.

## super란 무엇인가

`super`는 현재 객체의 **부모 클래스 부분을 가리키는 참조**다. `this`가 현재 객체 자신을 가리키듯, `super`는 부모 클래스의 멤버를 명시적으로 지정할 때 사용한다. 크게 세 가지 형태로 사용된다.

![super 키워드 3가지 사용법](/assets/posts/java-super-keyword-overview.svg)

## ① super() — 부모 생성자 호출

자식 클래스의 생성자에서 `super(...)`를 호출하면 부모 생성자를 직접 실행할 수 있다.

```java
public class Animal {
    private String name;

    public Animal(String name) {
        this.name = name;
        System.out.println("Animal 생성: " + name);
    }

    public String getName() { return name; }
}

public class Dog extends Animal {
    private String breed;

    public Dog(String name, String breed) {
        super(name);          // ← 반드시 첫 번째 문장
        this.breed = breed;
        System.out.println("Dog 생성: " + breed);
    }
}
```

`super(name)`이 없으면 컴파일러는 자동으로 `super()`(인수 없는 부모 생성자)를 삽입한다. `Animal`에 기본 생성자가 없으므로 이 경우 컴파일 오류가 발생한다. 명시적으로 작성하는 습관이 중요하다.

**`super()` 핵심 규칙:**

| 규칙 | 설명 |
|------|------|
| 첫 번째 문장 | 생성자 안에서 `super()`는 반드시 첫 줄이어야 한다 |
| `this()`와 공존 불가 | `this()`도 첫 줄이어야 하므로 둘 다 쓸 수 없다 |
| 생략 시 자동 삽입 | 컴파일러가 `super()`를 자동으로 넣는다 |
| 부모에 no-arg 없으면 오류 | 부모가 매개변수 생성자만 갖고 기본 생성자가 없으면 컴파일 실패 |

## 생성자 체이닝 흐름

`new Dog("Rex", "리트리버")`를 호출하면 내부적으로 다음 순서로 실행된다.

![생성자 체이닝 흐름](/assets/posts/java-super-keyword-constructor-chain.svg)

`Object → Animal → Dog` 순으로 **상위 클래스부터 아래로** 실행된다. 그 결과 출력 순서도 "Animal 생성: Rex" → "Dog 생성: 리트리버"가 된다. 이 순서를 이해하면 초기화 실패 버그의 원인을 찾을 때 큰 도움이 된다.

## ② super.method() — 부모 메서드 호출

오버라이딩한 메서드 안에서 부모 메서드를 호출할 때 `super.메서드명()`을 쓴다.

```java
public class Animal {
    public void describe() {
        System.out.println("이름: " + getName());
    }
}

public class Dog extends Animal {
    private String breed;

    @Override
    public void describe() {
        super.describe();                      // 부모 describe() 먼저 실행
        System.out.println("품종: " + breed);  // 자식만의 추가 정보
    }
}

// 실행 결과
Dog dog = new Dog("Rex", "리트리버");
dog.describe();
// 이름: Rex
// 품종: 리트리버
```

`super.describe()`를 호출하면 부모 구현이 그대로 실행되고, 이후 자식만의 로직을 추가할 수 있다. 이 패턴은 로깅 클래스나 검증 클래스에서 흔하게 볼 수 있다.

```java
// 실전 패턴: 부모 검증 후 자식 추가 검증
@Override
public boolean validate(String input) {
    if (!super.validate(input)) return false;  // 부모 검증 통과 여부 먼저 확인
    return input.length() <= 100;              // 자식만의 추가 규칙
}
```

## ③ super.field — 부모 필드 접근

필드 이름이 부모와 자식에서 겹칠 때(필드 숨김, field hiding) `super.필드명`으로 부모 필드를 명시적으로 지정한다.

```java
public class Shape {
    protected String type = "도형";
}

public class Circle extends Shape {
    private String type = "원";  // 부모 type 필드를 숨김(hiding)

    public void printTypes() {
        System.out.println(super.type);  // → "도형" (부모)
        System.out.println(this.type);   // → "원" (자식)
    }
}
```

필드 숨김은 권장되지 않는 패턴이다. 대부분의 경우 접근자(getter)를 통해 필드에 접근하는 것이 더 명확하다. `super.field`는 이런 레거시 상황을 다룰 때나 테스트 목적 외에는 거의 사용하지 않는다.

## super 사용 불가 상황

정적 컨텍스트에서는 `super`를 사용할 수 없다.

```java
public class Dog extends Animal {
    // 컴파일 오류 — static 메서드에서 super 사용 불가
    public static void staticMethod() {
        super.someMethod(); // ← 오류: non-static variable super cannot be referenced from a static context
    }

    // 정상 — 인스턴스 메서드에서 사용
    public void instanceMethod() {
        super.someMethod(); // ← OK
    }
}
```

`super`는 인스턴스에 묶인 개념이기 때문에 정적 메서드, 정적 초기화 블록에서는 사용할 수 없다.

## super.super는 불가

Java는 두 단계 이상의 `super` 접근(`super.super.method()`)을 허용하지 않는다.

```java
// GuideDog → Dog → Animal 계층
public class GuideDog extends Dog {
    @Override
    public void describe() {
        super.describe();        // Dog.describe() 호출 — OK
        // super.super.describe(); ← 컴파일 오류 — 불가
    }
}
```

세 단계 계층에서 조부모 클래스의 메서드를 직접 호출하는 방법은 없다. 이것은 의도된 설계다. 중간 계층을 건너뛰면 캡슐화가 깨지기 때문이다.

## this()와 super()의 관계

```java
public class Dog extends Animal {
    public Dog(String breed) {
        this("Unknown", breed);  // ← this() 사용 시 super() 생략 가능
    }

    public Dog(String name, String breed) {
        super(name);             // ← 이 생성자에서 super() 호출
        this.breed = breed;
    }
}
```

`this()`를 쓰면 같은 클래스 내 다른 생성자로 위임하므로, 최종적으로 호출되는 생성자 하나에서만 `super()`를 호출하면 된다. 두 생성자 모두에서 `super()`를 쓰거나, `this()`와 `super()`를 한 생성자에서 함께 쓰면 컴파일 오류가 발생한다.

## 정리

`super` 키워드는 Java 상속에서 부모와 자식 사이의 명시적 연결 통로다.

- **`super(args)`** — 부모 생성자 호출, 반드시 첫 번째 문장
- **`super.method()`** — 오버라이딩된 부모 메서드 호출
- **`super.field`** — 숨겨진 부모 필드 접근 (권장하지 않음)

생성자 체이닝을 통해 객체는 항상 루트(`Object`)부터 시작해 위에서 아래 순으로 초기화된다. 이 흐름을 명확히 이해하면 복잡한 상속 계층에서도 초기화 순서를 자신 있게 추론할 수 있다.

---

**지난 글:** [Java 메서드 오버라이딩 완전 정복 — @Override와 재정의 규칙](/posts/java-method-overriding/)

**다음 글:** [Java 다형성 완전 정복 — 업캐스팅과 동적 디스패치](/posts/java-polymorphism/)

<br>
읽어주셔서 감사합니다. 😊
