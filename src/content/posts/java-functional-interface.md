---
title: "Java 함수형 인터페이스 — @FunctionalInterface와 람다의 기반"
description: "함수형 인터페이스의 정의, SAM 규칙, @FunctionalInterface 어노테이션, java.util.function 주요 인터페이스, 합성 메서드(andThen/compose/and/or), 커스텀 함수형 인터페이스 설계를 실전 예제와 함께 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "함수형 인터페이스", "FunctionalInterface", "람다", "SAM", "Function", "Predicate", "Consumer", "Supplier", "함수형 프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/java-private-methods-interface/)에서 Java 9 `private` 메서드로 인터페이스 내부 구현을 캡슐화하는 방법을 살펴봤다. 이번에는 인터페이스 활용의 또 다른 핵심축, **함수형 인터페이스**를 다룬다. 람다 표현식과 메서드 참조가 동작할 수 있는 이유가 바로 여기에 있다.

## 함수형 인터페이스란

추상 메서드(SAM, Single Abstract Method)가 **정확히 1개**인 인터페이스다. `default`, `static`, `private` 메서드는 몇 개가 있어도 상관없다.

```java
@FunctionalInterface
public interface Transformer<T, R> {
    R transform(T input);           // SAM — 반드시 1개

    default Transformer<T, R> andLog() {   // OK — default
        return input -> {
            R result = transform(input);
            System.out.println(input + " -> " + result);
            return result;
        };
    }
}
```

`@FunctionalInterface` 어노테이션은 필수가 아니지만 붙이면 컴파일러가 SAM 규칙을 검증해 준다. 추상 메서드를 추가하거나 삭제해서 규칙이 깨지면 바로 컴파일 오류가 발생한다.

![함수형 인터페이스 개요와 주요 인터페이스](/assets/posts/java-functional-interface-overview.svg)

## 왜 SAM 1개여야 하는가

람다 표현식 `(x) -> x * 2`는 컴파일러가 **어떤 메서드의 구현인지 결정해야** 할당이 가능하다. 추상 메서드가 2개 이상이면 어느 메서드를 구현하는지 알 수 없어 컴파일 오류가 난다. 반대로 0개면 구현할 메서드 자체가 없다. 따라서 정확히 1개여야 한다.

```java
// 추상 메서드 2개 → 컴파일 오류
@FunctionalInterface  // Error: Multiple non-overriding abstract methods
interface Invalid {
    void methodA();
    void methodB();
}

// Object 메서드 재선언 → 추상 메서드 수에 미포함
@FunctionalInterface
interface Stringify<T> {
    String toStr(T t);              // SAM
    @Override String toString();    // Object 메서드 — 카운트 안 됨
}
```

## java.util.function 핵심 4종

Java 8은 가장 자주 쓰이는 패턴을 미리 정의해 `java.util.function` 패키지에 담아뒀다.

### Function&lt;T, R&gt; — 변환

```java
Function<String, Integer> length = String::length;
Function<Integer, String> intToStr = Object::toString;

// andThen: length 먼저, 그 결과를 intToStr에 전달
Function<String, String> pipeline = length.andThen(intToStr);
System.out.println(pipeline.apply("hello")); // "5"
```

### Predicate&lt;T&gt; — 조건 판별

```java
Predicate<String> notEmpty = s -> !s.isEmpty();
Predicate<String> noSpaces = s -> !s.contains(" ");

// 논리 조합
Predicate<String> valid = notEmpty.and(noSpaces);
List<String> result = List.of("ok", "", "has space")
    .stream()
    .filter(valid)
    .toList();
// ["ok"]
```

### Consumer&lt;T&gt; — 소비 (반환값 없음)

```java
Consumer<String> print = System.out::println;
Consumer<String> log = s -> System.err.println("[LOG] " + s);

// andThen: 두 Consumer를 순서대로 실행
Consumer<String> both = print.andThen(log);
both.accept("hello"); // stdout: hello, stderr: [LOG] hello
```

### Supplier&lt;T&gt; — 공급 (인수 없음)

```java
Supplier<List<String>> listFactory = ArrayList::new;
Supplier<LocalDate> today = LocalDate::now;

List<String> items = listFactory.get();
System.out.println(today.get());
```

## 합성 — andThen과 compose

`Function`이 제공하는 합성 메서드 두 가지는 **실행 순서**만 다르다.

```java
Function<Integer, Integer> doubleIt = x -> x * 2;
Function<Integer, Integer> addTen = x -> x + 10;

// andThen: doubleIt → addTen
Function<Integer, Integer> doubleThenAdd = doubleIt.andThen(addTen);
System.out.println(doubleThenAdd.apply(3)); // (3*2)+10 = 16

// compose: addTen → doubleIt
Function<Integer, Integer> addThenDouble = doubleIt.compose(addTen);
System.out.println(addThenDouble.apply(3)); // (3+10)*2 = 26
```

![함수형 인터페이스 합성 — andThen과 compose](/assets/posts/java-functional-interface-composition.svg)

메모리 기법: `f.andThen(g)`는 `g(f(x))`, `f.compose(g)`는 `f(g(x))`. `andThen`이 자연어 순서("f하고 그 다음 g")에 더 가깝다.

## 커스텀 함수형 인터페이스 만들기

표준 인터페이스로 표현하기 어려운 의미론(예: 체크드 예외 포함)이 있을 때 직접 정의한다.

```java
@FunctionalInterface
public interface ThrowingFunction<T, R> {
    R apply(T input) throws Exception;

    static <T, R> Function<T, R> wrap(ThrowingFunction<T, R> fn) {
        return input -> {
            try {
                return fn.apply(input);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        };
    }
}

// 사용 예
List<String> paths = List.of("a.txt", "b.txt");
paths.stream()
     .map(ThrowingFunction.wrap(Files::readString))
     .forEach(System.out::println);
```

표준 `Function<T, R>`의 `apply`는 체크드 예외를 던질 수 없다. `ThrowingFunction`으로 감싸면 람다 내부의 체크드 예외를 깔끔하게 처리할 수 있다.

## 흔한 실수와 주의사항

**상태를 가지는 람다는 피한다.** 람다가 외부 가변 변수를 캡처하면 스레드 안전성 문제가 생기고 테스트하기 어렵다. effectively final만 캡처한다.

```java
int count = 0;
// 컴파일 오류: count가 effectively final이 아님
// Consumer<String> bad = s -> count++;  // 금지

// 올바른 방법: AtomicInteger 사용
AtomicInteger cnt = new AtomicInteger();
Consumer<String> good = s -> cnt.incrementAndGet();
```

**너무 복잡한 람다는 메서드로 추출한다.** 람다가 3줄을 넘어간다면 가독성을 위해 private 메서드로 뽑고 메서드 참조로 대체한다.

**원시 타입 특화 인터페이스를 활용한다.** `Function<Integer, Integer>` 대신 `IntUnaryOperator`를, `Supplier<Integer>` 대신 `IntSupplier`를 쓰면 오토박싱 비용이 없다.

```java
// 오토박싱 발생
Function<Integer, Integer> boxed = x -> x * 2;

// 오토박싱 없음
IntUnaryOperator primitive = x -> x * 2;
```

## 함수형 인터페이스와 람다, 스트림의 관계

스트림 API의 `filter`, `map`, `forEach` 같은 메서드 시그니처를 보면 모두 함수형 인터페이스를 인수로 받는다.

```java
Stream<String> stream = List.of("Java", "9", "private").stream();

stream
    .filter(s -> s.length() > 2)         // Predicate<String>
    .map(String::toUpperCase)             // Function<String, String>
    .forEach(System.out::println);        // Consumer<String>
```

람다와 메서드 참조가 각각 적절한 함수형 인터페이스 타입으로 변환되기 때문에 이런 체이닝이 가능하다. 다음 글에서는 메서드 참조를 더 깊이 들여다보고, 이어서 `java.util.function`의 나머지 인터페이스(`BiFunction`, `BiPredicate` 등)까지 살펴볼 것이다.

---

**지난 글:** [Java 인터페이스 private 메서드 — 구현 캡슐화와 중복 제거](/posts/java-private-methods-interface/)

**다음 글:** [Java 메서드 참조 — 람다의 축약 표현 4가지](/posts/java-method-reference/)

<br>
읽어주셔서 감사합니다. 😊
