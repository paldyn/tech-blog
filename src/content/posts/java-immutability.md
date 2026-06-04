---
title: "불변 객체(Immutable Objects) — 안전한 설계의 기초"
description: "Java 불변 객체 완전 정리 — 불변 클래스 설계 5가지 규칙, final 클래스·필드·setter 금지, 방어적 복사, 불변 컬렉션 활용, String·BigDecimal·LocalDate 등 JDK 불변 클래스, 멀티스레드 안전성과 성능 트레이드오프"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "불변객체", "Immutable", "final", "방어적복사", "스레드안전", "함수형프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/java-currying-java/)에서 커링으로 함수를 단계적으로 분해하는 기법을 살펴봤다. 이번에는 **불변 객체(Immutable Objects)** 를 다룬다. 불변 객체란 생성된 이후 상태가 절대 바뀌지 않는 객체다. 함수형 프로그래밍의 핵심 원칙이기도 하지만, 멀티스레드 안전성과 버그 방지 측면에서도 강력한 설계 기법이다.

## 불변 객체가 왜 좋은가

가변 객체는 어디서든 상태가 바뀔 수 있어 버그 추적이 어렵다. 불변 객체는 생성 시점의 상태가 항상 유지되므로 예측 가능하다.

```java
// 가변 객체의 문제: 공유 후 어디선가 변경
List<String> names = new ArrayList<>(List.of("Alice", "Bob"));
processNames(names); // 이 메서드가 names를 수정할 수도 있음
System.out.println(names); // [Alice] — Bob이 사라졌을 수 있음

// 불변 컬렉션: 수정 시도 시 UnsupportedOperationException
List<String> immutableNames = List.of("Alice", "Bob");
immutableNames.add("Charlie"); // 런타임 예외 — 안전하게 거부
```

주요 장점은 세 가지다. 첫째, **스레드 안전성** — 동기화 없이 여러 스레드에서 공유 가능. 둘째, **버그 방지** — 예상치 못한 상태 변경이 불가능. 셋째, **캐싱 가능** — 상태가 변하지 않으므로 결과를 안심하고 캐싱.

![불변 객체 — 상태 변경 없이 새 객체로](/assets/posts/java-immutability-concept.svg)

## 불변 클래스 설계 5가지 규칙

### 규칙 1: 클래스를 final로 선언

```java
public final class Money {
    // final 클래스: 상속 불가
    // 하위 클래스에서 필드를 추가하거나 메서드를 오버라이드해
    // 불변 계약을 깨는 것을 원천 봉쇄
}
```

### 규칙 2: 모든 필드를 private final로

```java
public final class Money {
    private final long amount;     // final: 생성 후 변경 불가
    private final String currency; // private: 외부에서 직접 접근 불가
}
```

### 규칙 3: setter 메서드를 만들지 않는다

변경이 필요하면 새 객체를 반환하는 `with*` 메서드를 제공한다.

```java
public final class Money {
    private final long amount;
    private final String currency;

    public Money(long amount, String currency) {
        this.amount = amount;
        this.currency = currency;
    }

    // setter 없음 — 새 객체 반환
    public Money add(long extra) {
        return new Money(this.amount + extra, this.currency);
    }

    public Money withCurrency(String newCurrency) {
        return new Money(this.amount, newCurrency);
    }
}
```

### 규칙 4: 가변 필드는 방어적 복사

`List`, `Date`, `byte[]` 같은 가변 타입을 필드로 가지면 생성자와 getter에서 복사본을 사용해야 한다.

```java
public final class Order {
    private final List<String> items;

    public Order(List<String> items) {
        // 생성자: 외부에서 전달된 리스트를 그대로 참조하면 외부에서 수정 가능
        this.items = List.copyOf(items); // 불변 복사본
    }

    public List<String> getItems() {
        return items; // List.copyOf는 이미 불변 — 그대로 반환 가능
    }
}
```

### 규칙 5: 불변 컬렉션 사용

```java
// Java 9+
List<String> list = List.of("a", "b", "c");        // 불변
Set<Integer>  set  = Set.of(1, 2, 3);               // 불변
Map<String, Integer> map = Map.of("key", 1);        // 불변

// 기존 컬렉션에서 불변 복사본
List<String> copy = List.copyOf(mutableList);
Map<String, Integer> copyMap = Map.copyOf(mutableMap);
```

![불변 클래스 설계 5가지 규칙](/assets/posts/java-immutability-rules.svg)

## JDK의 불변 클래스 예시

Java 표준 라이브러리에는 불변 클래스가 많다.

```java
// String — 가장 대표적인 불변 클래스
String s = "Hello";
String upper = s.toUpperCase(); // s는 그대로, upper는 새 String

// BigDecimal — 금융 계산에 쓰이는 불변 수치
BigDecimal price = new BigDecimal("9.99");
BigDecimal discounted = price.multiply(new BigDecimal("0.9")); // 새 객체

// LocalDate (Java 8+) — 날짜 불변 처리
LocalDate today = LocalDate.now();
LocalDate tomorrow = today.plusDays(1); // today는 변하지 않음
```

## Record로 불변 클래스 간결하게 작성

Java 16+의 `record`는 불변 클래스를 위한 간결한 문법을 제공한다.

```java
// record: final 클래스, private final 필드, 생성자, getter, equals/hashCode/toString 자동 생성
record Point(int x, int y) {
    // 검증 로직은 compact constructor로
    Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException("음수 좌표 불가");
    }

    // with 메서드는 수동으로 추가
    Point withX(int newX) { return new Point(newX, this.y); }
}

Point p1 = new Point(3, 4);
Point p2 = p1.withX(5); // p1은 그대로 {3, 4}
```

## 불변 객체의 단점과 트레이드오프

불변 객체가 항상 최선은 아니다. 변경이 잦은 경우에는 매번 새 객체를 생성하므로 메모리 압박이 생긴다.

```java
// 나쁜 예: 루프 안에서 불변 객체를 계속 생성
String result = "";
for (String word : words) {
    result = result + word; // 매번 새 String 생성 — O(n²) 복사
}

// 좋은 예: 가변 빌더를 사용 후 최종적으로 불변 객체 생성
StringBuilder sb = new StringBuilder();
for (String word : words) {
    sb.append(word); // 내부 버퍼 재사용
}
String result2 = sb.toString(); // 최종 불변 String
```

불변 객체 도입 기준은 간단하다. **공유되거나, 캐싱되거나, 멀티스레드에서 사용**되는 데이터라면 불변으로 만드는 것이 원칙이다. 단순히 한 메서드 안에서만 사용되는 임시 객체라면 가변이 합리적일 수 있다.

---

**지난 글:** [커링(Currying) — 다중 인자 함수를 단계적 함수로 분해하기](/posts/java-currying-java/)

**다음 글:** [Optional — null을 대체하는 안전한 값 컨테이너](/posts/java-optional/)

<br>
읽어주셔서 감사합니다. 😊
