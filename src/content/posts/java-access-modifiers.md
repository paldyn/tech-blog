---
title: "Java 접근 제어자 완전 정복 — public, protected, default, private"
description: "Java 네 가지 접근 제어자의 적용 범위와 차이를 정확히 이해하고, 클래스·필드·메서드·생성자에 올바르게 적용하는 캡슐화 설계 원칙을 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "접근 제어자", "캡슐화", "public", "private", "protected", "information hiding", "OOP"]
featured: false
draft: false
---

[지난 글](/posts/java-final-keyword/)에서 `final` 키워드로 변경을 막는 방법을 다뤘다. 이번에는 **누가 해당 멤버에 접근할 수 있는지**를 결정하는 접근 제어자(Access Modifiers)를 파헤친다. Java에는 `public`, `protected`, (default), `private` 네 가지가 있고, 이 선택 하나가 클래스의 캡슐화 수준과 유지보수성을 좌우한다.

## 접근 제어자란

접근 제어자는 클래스, 필드, 메서드, 생성자에 적용해 **그 멤버에 접근할 수 있는 코드의 범위**를 제한한다. 제한이 클수록 내부 구현이 외부에 노출되지 않고, 나중에 내부를 바꿔도 외부 코드가 깨지지 않는다. 객체지향의 핵심 원칙인 **정보 은닉(Information Hiding)** 의 구체적 수단이다.

![Java 접근 제어자 — 적용 범위 비교](/assets/posts/java-access-modifiers-scope.svg)

## 네 가지 접근 제어자

### public — 완전 공개

`public`은 **어디서든 접근 가능**하다. 같은 클래스, 같은 패키지, 다른 패키지의 서브클래스, 아무 관계도 없는 코드 전부 접근할 수 있다.

```java
public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}

// 다른 패키지에서도 사용 가능
Calculator calc = new Calculator();
int result = calc.add(3, 4);
```

API의 진입점, 외부에 제공하는 서비스, 라이브러리의 공개 인터페이스에 사용한다. `public`으로 선언한 순간 그 시그니처는 외부 코드가 의존하는 계약이 된다. 한 번 공개된 `public` API는 하위 호환성을 깨지 않으면서 바꾸기 어려우므로, 신중하게 결정해야 한다.

### private — 완전 비공개

`private`은 **같은 클래스 내부에서만 접근 가능**하다. 서브클래스도, 같은 패키지도 접근할 수 없다.

```java
class BankAccount {
    private long balance;        // 외부에서 직접 수정 불가
    private String accountNumber;

    public void deposit(long amount) {
        validate(amount);        // private 메서드 내부에서 호출
        balance += amount;
    }

    private void validate(long amount) {   // 외부 노출 불필요
        if (amount <= 0)
            throw new IllegalArgumentException("금액은 양수여야 합니다.");
    }
}
```

필드는 **기본적으로 `private`** 이어야 한다. 외부에서 `balance`를 직접 수정할 수 없게 막고, `deposit()` 같은 공개 메서드를 통해서만 상태를 바꾸게 한다. 내부 구현 로직(`validate`)도 외부에 노출할 이유가 없으면 `private`이다.

### protected — 상속 고려 공개

`protected`는 **같은 클래스, 같은 패키지, 그리고 다른 패키지의 서브클래스**에서 접근 가능하다. 패키지 외부에 있더라도 상속 관계라면 접근할 수 있다는 점이 `default`와의 차이다.

```java
class Shape {
    protected double area;   // 서브클래스가 접근해야 하는 공유 상태

    protected void draw() {  // 서브클래스가 오버라이딩할 메서드
        System.out.println("도형을 그립니다.");
    }
}

class Circle extends Shape {
    Circle(double radius) {
        area = Math.PI * radius * radius; // protected 필드 접근
    }

    @Override
    protected void draw() {
        System.out.println("원을 그립니다.");
    }
}
```

`protected`는 상속 계층을 설계할 때 선택한다. 서브클래스가 오버라이딩하거나 공유해야 할 멤버에만 사용한다. **무분별한 `protected` 사용은 캡슐화를 약화**시킨다. 템플릿 메서드 패턴에서 서브클래스에게 훅(hook)을 제공할 때 전형적으로 `protected`를 사용한다.

### default (package-private) — 패키지 내 공개

접근 제어자를 **아무것도 쓰지 않으면** package-private 또는 default 접근 수준이 된다. **같은 패키지 내에서만 접근 가능**하고, 서브클래스라도 다른 패키지에 있으면 접근할 수 없다.

```java
// 같은 패키지: com.example.service
class UserValidator {      // default 클래스 — 패키지 외부에서 접근 불가
    boolean isValid(String username) {   // default 메서드
        return username != null && !username.isBlank();
    }
}

class UserService {
    private final UserValidator validator = new UserValidator(); // 같은 패키지이므로 접근 가능

    public void register(String username) {
        if (!validator.isValid(username))
            throw new IllegalArgumentException("유효하지 않은 사용자 이름");
        // ...
    }
}
```

패키지 내부의 협력 클래스들끼리만 사용하는 구현 세부사항에 적합하다. 외부 패키지에 API를 노출하지 않으면서 패키지 내부에서 코드를 나눌 수 있다. Java 표준 라이브러리도 내부 구현 클래스 대부분을 default 접근으로 유지한다.

## 적용 위치별 가이드

![접근 제어자 실전 패턴 — 캡슐화 설계](/assets/posts/java-access-modifiers-design.svg)

### 클래스

top-level 클래스(파일 최상위)에는 `public`과 default만 쓸 수 있다. `private`이나 `protected`는 top-level에 적용 불가(컴파일 에러)다. 외부 패키지에 공개해야 하는 클래스는 `public`, 패키지 내부용이면 아무것도 쓰지 않는다.

중첩 클래스(nested class)는 네 가지 모두 사용할 수 있다. `private` 중첩 클래스는 외부에서 완전히 숨겨진 구현 내부 클래스로 쓰인다.

### 필드

**필드는 항상 `private`으로 시작하라.** 예외는 없다고 봐도 된다. `public` 필드는 캡슐화를 파괴한다. 외부에서 `account.balance = -9999999`처럼 직접 수정하면 객체의 불변식(invariant)이 깨진다.

```java
// 나쁜 예 (절대 하지 말 것)
public class User {
    public String name;      // 누구나 수정 가능 → 위험
    public int age;
}

// 좋은 예
public class User {
    private String name;
    private int age;

    public String getName() { return name; }
    public int getAge()     { return age; }

    public void setAge(int age) {
        if (age < 0) throw new IllegalArgumentException();
        this.age = age;
    }
}
```

유일한 예외는 값 객체(Value Object)의 `public final` 필드다. Java 16부터 `record`가 이 패턴을 공식화했다.

```java
record Point(double x, double y) {}  // x, y는 public final로 노출되지만 불변
```

### 메서드

외부 클라이언트에게 제공하는 API는 `public`, 구현 세부사항인 헬퍼 메서드는 `private`이다. 상속 계층에서 서브클래스에 확장 지점을 제공할 때는 `protected`를 쓴다.

```java
public class OrderService {
    // 외부에 공개된 API
    public Order createOrder(long userId, List<Long> productIds) {
        validateUser(userId);             // private 헬퍼 호출
        List<Product> products = loadProducts(productIds);  // private 헬퍼
        return buildOrder(userId, products);
    }

    private void validateUser(long userId) { /* ... */ }
    private List<Product> loadProducts(List<Long> ids) { /* ... */ }
    private Order buildOrder(long userId, List<Product> ps) { /* ... */ }
}
```

### 생성자

생성자를 `private`으로 선언하면 외부에서 `new`로 객체를 직접 생성하지 못한다. 팩토리 메서드 패턴이나 싱글톤 패턴에 쓰인다.

```java
public class DatabaseConnection {
    private static DatabaseConnection instance;

    private DatabaseConnection() { /* 초기화 */ } // 직접 생성 금지

    public static DatabaseConnection getInstance() {
        if (instance == null) instance = new DatabaseConnection();
        return instance;
    }
}
```

## 최소 권한 원칙

접근 제어자 선택의 핵심 원칙은 **최소 권한(Principle of Least Privilege)** 이다. 필요한 최소한의 범위만 열어라. 처음에는 `private`으로 두고, 진짜 필요할 때 단계적으로 넓혀라.

```text
private → default → protected → public
(가장 제한적)               (가장 개방적)
```

처음부터 `public`으로 만들면 나중에 좁히기 어렵다. 외부 코드가 이미 그 API에 의존하기 때문이다. 반대로 `private`으로 시작하면 필요할 때 언제든 넓힐 수 있다.

## protected의 오해와 진실

`protected`가 `default`보다 더 "좁다"고 오해하는 경우가 있다. 실제로는 반대다.

| 접근 수준 | 같은 패키지 | 다른 패키지 서브클래스 |
|---|---|---|
| default | ✓ | ✗ |
| protected | ✓ | ✓ |

`protected`는 `default`의 접근 범위에 더해 **다른 패키지의 서브클래스**까지 열어준다. 상속을 설계하지 않은 클래스에서 `protected`를 쓰면 필요 이상으로 넓게 공개하는 셈이다.

## 모듈 시스템과 접근 제어 (Java 9+)

Java 9의 모듈 시스템은 패키지 단위로 공개 범위를 한 층 더 제어한다. 클래스가 `public`이어도 `module-info.java`에서 `exports`를 선언하지 않으면 다른 모듈에서 접근할 수 없다.

```java
// module-info.java
module com.example.myapp {
    exports com.example.myapp.api;         // 이 패키지만 외부 공개
    // com.example.myapp.internal 은 공개하지 않음
}
```

이렇게 하면 `internal` 패키지의 `public` 클래스도 모듈 외부에서 접근이 차단된다. 접근 제어자와 모듈 경계를 함께 활용하면 더 정교한 캡슐화가 가능하다.

## 정리

접근 제어자는 단순한 문법 요소가 아니라 클래스의 **인터페이스와 구현을 분리하는 설계 도구**다. `private`으로 내부를 숨기고 `public`으로 계약을 선언하는 기본 패턴이 캡슐화의 출발점이다. 최소 권한 원칙에 따라 필요한 범위만 열어두면 내부 구현을 자유롭게 바꿔도 외부 코드가 영향받지 않는 유연한 설계가 만들어진다.

---

**지난 글:** [Java final 키워드 완전 정복 — 불변 변수·메서드·클래스](/posts/java-final-keyword/)

**다음 글:** [Java 캡슐화 완전 정복 — 정보 은닉과 불변식 보호](/posts/java-encapsulation/)

<br>
읽어주셔서 감사합니다. 😊
