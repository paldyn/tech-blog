---
title: "Java final 키워드 완전 정복 — 불변 변수·메서드·클래스"
description: "Java final 키워드가 변수, 메서드, 클래스 각각에서 어떤 의미를 갖는지, JVM 최적화와 불변 객체 설계까지 final의 모든 것을 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "final", "불변 객체", "immutable", "final 변수", "final 메서드", "final 클래스", "JVM 최적화"]
featured: false
draft: false
---

[지난 글](/posts/java-static-members/)에서 클래스 레벨 멤버인 `static`을 다뤘다. 이번에는 Java에서 "더 이상 변경하지 않겠다"는 의도를 코드에 박는 키워드인 **`final`** 을 파헤친다. `final`은 단순히 상수를 선언하는 도구가 아니다. 변수, 메서드, 클래스 세 가지 위치에서 각기 다른 의미로 작동하며, JVM 최적화와 불변 설계의 핵심 기반이 된다.

## final이란

`final`은 "한 번 결정된 뒤에는 바꿀 수 없다"는 제약을 선언 시점에 명시하는 키워드다. 이 제약이 적용되는 대상에 따라 의미가 달라진다.

- **final 변수**: 재할당 불가
- **final 메서드**: 오버라이딩 불가
- **final 클래스**: 상속 불가

![Java final 키워드 — 세 가지 사용 맥락](/assets/posts/java-final-keyword-concept.svg)

## final 변수

### 지역 변수와 매개변수

지역 변수에 `final`을 붙이면 한 번 할당한 뒤 다시 쓸 수 없다.

```java
final int max = 100;
max = 200; // 컴파일 에러: cannot assign a value to final variable 'max'
```

매개변수에도 적용할 수 있다. 메서드 내부에서 실수로 매개변수를 덮어쓰는 버그를 컴파일 타임에 방지한다.

```java
static double tax(final double price, final double rate) {
    // price = 0; // 이 줄이 있으면 컴파일 에러
    return price * rate;
}
```

### 인스턴스 final 필드와 생성자 초기화

인스턴스 필드에 `final`을 붙이면 **객체 생성 시점에 단 한 번** 초기화해야 한다. 선언 지점에서 바로 초기화하거나, 생성자 안에서 초기화하는 두 가지 방법이 있다.

```java
class Point {
    final double x;
    final double y;

    Point(double x, double y) {
        this.x = x; // 생성자에서 초기화
        this.y = y;
    }
    // x, y는 이후 절대 바뀌지 않음
}
```

선언 지점이나 생성자 둘 다에서 초기화하지 않으면 컴파일 에러다. 반드시 초기화 경로가 존재해야 한다.

### static final — 클래스 상수

`static`과 결합하면 클래스 레벨의 상수가 된다. 원시 타입이나 `String` 리터럴로 초기화한 `static final` 필드는 **컴파일 타임 상수(Compile-Time Constant)** 가 되어, 사용 지점에 값이 인라인된다. JVM 최적화의 핵심이다.

```java
class HttpStatus {
    static final int OK           = 200;
    static final int NOT_FOUND    = 404;
    static final int SERVER_ERROR = 500;
    static final String BASE_URL  = "https://api.example.com";
}
```

관례적으로 `UPPER_SNAKE_CASE`로 명명한다. `enum`이 없던 Java 초기에는 상수 집합을 `static final`로 정의했고, 지금도 단순 수치 상수나 문자열 상수에 자주 쓴다.

## final 참조 타입의 함정

`final`은 **참조(주소) 자체만 고정**한다. 참조가 가리키는 객체의 내부 상태는 여전히 바꿀 수 있다. 이것이 초보자가 가장 많이 오해하는 지점이다.

```java
final List<String> list = new ArrayList<>();
list.add("A");      // 허용: 객체 내부 변경
list.add("B");      // 허용
list = new ArrayList<>(); // 컴파일 에러: 재할당 불가
```

"내용도 못 바꾸게" 하려면 불변 컬렉션을 써야 한다.

```java
final List<String> names = List.of("Alice", "Bob"); // 불변 리스트
names.add("Carol"); // 런타임 UnsupportedOperationException
```

![final 참조 vs 불변 객체 — 흔한 오해](/assets/posts/java-final-keyword-immutability.svg)

## final 메서드

클래스에서 메서드에 `final`을 붙이면 서브클래스가 그 메서드를 **오버라이딩할 수 없다**.

```java
class Template {
    // 알고리즘 뼈대 — 서브클래스가 바꾸면 안 됨
    final void execute() {
        before();
        doWork();
        after();
    }

    void before() {}
    void doWork() {} // 오버라이딩 허용
    void after() {}
}

class ConcreteTask extends Template {
    @Override
    void doWork() { System.out.println("실제 작업"); }

    // @Override void execute() {} // 컴파일 에러
}
```

템플릿 메서드 패턴에서 상위 클래스가 알고리즘의 뼈대를 확정할 때 `final`을 쓴다. 상속 계층에서 **변해서는 안 되는 로직**에 `final`을 붙이면 의도가 명확해지고 실수를 컴파일 타임에 잡는다.

### JVM 최적화: 인라이닝

`final` 메서드는 JIT 컴파일러가 호출 지점에 직접 코드를 삽입(인라이닝)하기 쉽다. `private` 메서드도 사실상 `final`이라 같은 최적화가 적용된다. 현대 JIT는 비-`final` 메서드도 profiling 데이터를 보고 인라이닝하므로 성능 차이는 대부분 미미하지만, 의도를 명확히 전달한다는 설계 가치는 크다.

## final 클래스

클래스에 `final`을 붙이면 **서브클래스를 만들 수 없다**. 상속 자체를 차단한다.

```java
final class ImmutablePoint {
    final double x;
    final double y;

    ImmutablePoint(double x, double y) {
        this.x = x;
        this.y = y;
    }
}

// class SubPoint extends ImmutablePoint {} // 컴파일 에러
```

JDK에서 `final` 클래스의 대표 예시는 `java.lang.String`이다. `String`이 상속 가능하다면 누군가 `String`처럼 행동하는 가짜 클래스를 만들어 보안 취약점을 일으킬 수 있다. `Integer`, `Long`, `Boolean` 등 래퍼 클래스, `Math`, `System`도 모두 `final`이다.

```java
// JDK 소스에서 발췌 (의사 코드)
public final class String implements Serializable, Comparable<String>, CharSequence {
    // ...
}
```

### final 클래스를 쓰는 세 가지 이유

1. **보안**: 상속을 통한 동작 변경이나 위장을 원천 차단한다.
2. **불변성 보장**: 모든 필드가 `final`인 클래스를 `final`로 선언하면 완전한 불변 객체가 된다.
3. **명시적 설계**: "이 클래스는 확장을 염두에 두지 않았다"는 의도를 명확히 전달한다.

## 불변 클래스(Immutable Class) 설계

`final` 키워드를 활용해 완전한 불변 클래스를 만드는 공식 패턴이 있다.

```java
// 불변 클래스의 4가지 조건
public final class Money {           // 1. 클래스를 final로
    private final long amount;       // 2. 모든 필드를 final로
    private final String currency;   // 3. 모든 필드를 private으로

    public Money(long amount, String currency) {
        this.amount = amount;
        this.currency = currency;
    }                                // 4. setter 없음 (읽기 전용 접근자만)

    public long getAmount()      { return amount; }
    public String getCurrency()  { return currency; }

    public Money add(Money other) {
        if (!currency.equals(other.currency))
            throw new IllegalArgumentException("다른 통화");
        return new Money(amount + other.amount, currency); // 새 객체 반환
    }
}
```

불변 클래스의 네 가지 조건:

| 조건 | 설명 |
|---|---|
| 클래스를 `final`로 | 서브클래스로 가변 행동 주입 방지 |
| 모든 필드를 `final`로 | 한 번 설정 후 변경 불가 |
| 모든 필드를 `private`으로 | 직접 접근 차단 |
| setter 없음 | 상태 변경 메서드 금지, 변경 시 새 객체 반환 |

불변 객체는 **스레드 안전(Thread-Safe)** 하다. 상태가 바뀌지 않으므로 여러 스레드가 동시에 읽어도 동기화가 필요 없다.

## 실전 가이드라인

### 언제 final을 써야 하는가

- **상수**: `static final` + `UPPER_SNAKE_CASE` — 항상
- **인스턴스 필드**: 객체 생성 후 변경할 이유가 없으면 습관적으로 `final`
- **지역 변수**: 나중에 재할당할 필요가 없다면 `final`로 선언해 의도 명확히
- **메서드**: 서브클래스가 바꾸면 안 되는 핵심 로직
- **클래스**: 확장을 의도하지 않거나 불변성을 강제할 때

### Effective Java의 조언

> "모든 필드를 final로 선언하라. 단, 성능이나 유연성을 위해 꼭 필요할 때만 풀어라." — Effective Java 3판, 아이템 17

이 조언의 핵심은 **기본값을 불변으로 설정하고, 가변성을 적극적으로 정당화하라**는 것이다.

### 오해 정리

```java
// final 참조 ≠ 불변 객체
final int[] arr = {1, 2, 3};
arr[0] = 99;        // 가능: 배열 내용 변경
// arr = new int[]{4, 5, 6}; // 불가: 재할당

// 완전한 불변 배열이 필요하면
final int[] frozen = Arrays.copyOf(arr, arr.length);
// 또는 배열 대신 List.of() 사용
```

## 정리

`final`은 "변하지 않는다"는 계약을 코드에 새긴다. 변수에서는 재할당을, 메서드에서는 오버라이딩을, 클래스에서는 상속을 막는다. 세 맥락 모두 **의도의 명시**와 **실수 방지**라는 목적이 공통된다. 특히 불변 클래스를 설계할 때 `final`은 스레드 안전성과 예측 가능한 코드의 기반이 된다.

---

**지난 글:** [Java static 멤버 완전 정복 — 클래스 레벨 필드와 메서드](/posts/java-static-members/)

**다음 글:** [Java 접근 제어자 완전 정복 — public, protected, default, private](/posts/java-access-modifiers/)

<br>
읽어주셔서 감사합니다. 😊
