---
title: "내장 함수형 인터페이스 — Function·Consumer·Supplier·Predicate"
description: "java.util.function 패키지의 43개 내장 함수형 인터페이스 완전 정리 — Function·Consumer·Supplier·Predicate의 추상 메서드·기본 메서드·조합 패턴, UnaryOperator·BinaryOperator, 기본형 특화 IntFunction·ToIntFunction·IntConsumer 등, 언제 커스텀 함수형 인터페이스를 만들어야 하는지"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "FunctionalInterface", "Function", "Consumer", "Supplier", "Predicate", "java.util.function"]
featured: false
draft: false
---

[지난 글](/posts/java-method-reference/)에서 메서드 참조의 4가지 유형을 익혔다. 메서드 참조와 람다를 실제로 활용하려면 **어떤 함수형 인터페이스를 쓸지** 알아야 한다. Java는 `java.util.function` 패키지에 43개의 내장 함수형 인터페이스를 제공한다. 이 글에서는 그 핵심인 4종류를 깊이 이해한다.

## 4대 핵심 인터페이스

![내장 함수형 인터페이스 분류](/assets/posts/java-functional-interfaces-built-in-overview.svg)

| 인터페이스 | 추상 메서드 | 용도 |
|------------|-------------|------|
| `Function<T, R>` | `R apply(T t)` | T를 받아 R로 변환 |
| `Consumer<T>` | `void accept(T t)` | T를 받아 소비 (반환 없음) |
| `Supplier<T>` | `T get()` | 아무것도 받지 않고 T 공급 |
| `Predicate<T>` | `boolean test(T t)` | T를 받아 boolean 반환 |

## Function&lt;T, R&gt; — 변환

```java
// 기본 사용
Function<String, Integer> toLength = String::length;
toLength.apply("hello");  // 5

// andThen — f 먼저, g 나중
Function<String, Integer> strToLen = String::length;
Function<Integer, String> intToStr = Object::toString;
Function<String, String> strLenStr = strToLen.andThen(intToStr);
strLenStr.apply("hello");  // "5"

// compose — g 먼저, f 나중
Function<Integer, Integer> times2 = n -> n * 2;
Function<Integer, Integer> plus3  = n -> n + 3;
Function<Integer, Integer> plus3ThenTimes2 = times2.compose(plus3);
plus3ThenTimes2.apply(5);  // (5+3)*2 = 16

// identity — 입력을 그대로 반환
Function<String, String> identity = Function.identity();
```

### UnaryOperator&lt;T&gt;

`Function<T, T>`의 특화형이다. 입력과 출력 타입이 같을 때 사용한다.

```java
UnaryOperator<String> trim = String::trim;
UnaryOperator<Integer> negate = n -> -n;

// List.replaceAll()이 UnaryOperator를 받음
List<String> list = new ArrayList<>(List.of("  hello  ", "  world  "));
list.replaceAll(String::trim);  // [hello, world]
```

## Consumer&lt;T&gt; — 소비

```java
// 기본 사용
Consumer<String> print = System.out::println;
print.accept("hello");  // hello 출력

// andThen — 두 Consumer를 순서대로 실행
Consumer<String> log = s -> logger.info(s);
Consumer<String> print2 = System.out::println;
Consumer<String> logAndPrint = log.andThen(print2);
logAndPrint.accept("event");  // 로그 후 출력

// 실전: forEach
list.forEach(System.out::println);
map.forEach((k, v) -> System.out.println(k + "=" + v));  // BiConsumer
```

![내장 함수형 인터페이스 코드 예제](/assets/posts/java-functional-interfaces-built-in-code.svg)

## Supplier&lt;T&gt; — 공급

```java
// 기본 사용
Supplier<LocalDate> today = LocalDate::now;
today.get();  // 현재 날짜

// 지연 초기화 — 필요할 때만 생성
Supplier<List<String>> listFactory = ArrayList::new;
List<String> list = listFactory.get();  // 새 ArrayList 생성

// Optional.orElseGet — 값이 없을 때만 Supplier 실행
Optional<String> opt = Optional.empty();
String val = opt.orElseGet(() -> computeExpensiveDefault());  // 비어 있을 때만 실행

// vs orElse — 항상 평가됨
String val2 = opt.orElse(computeExpensiveDefault());  // 항상 실행 (비효율)
```

`orElseGet(Supplier)`는 `orElse(T)`와 다르게 실제로 값이 없을 때만 람다를 실행한다. 비용이 큰 연산에는 반드시 `orElseGet`을 써야 한다.

## Predicate&lt;T&gt; — 조건 검사

```java
// 기본 사용
Predicate<String> notEmpty = s -> !s.isEmpty();
notEmpty.test("hello");  // true
notEmpty.test("");       // false

// and — 단락 평가 (첫번째가 false면 두번째 미실행)
Predicate<String> notNull = Objects::nonNull;
Predicate<String> valid = notNull.and(notEmpty);

// or — 단락 평가 (첫번째가 true면 두번째 미실행)
Predicate<String> isNull = Objects::isNull;
Predicate<String> isBlank = String::isBlank;
Predicate<String> invalid = isNull.or(isBlank);

// negate — 반전
Predicate<String> hasContent = invalid.negate();

// Java 11+ Predicate.not
List<String> nonBlank = list.stream()
    .filter(Predicate.not(String::isBlank))
    .collect(toList());

// 실전: 다중 조건 조합
Predicate<User> eligible = user ->
    user.getAge() >= 18 &&
    user.isActive() &&
    user.hasVerifiedEmail();
// 위보다 조합이 더 읽기 좋을 때
Predicate<User> adultP = u -> u.getAge() >= 18;
Predicate<User> activeP = User::isActive;
Predicate<User> verifiedP = User::hasVerifiedEmail;
list.stream().filter(adultP.and(activeP).and(verifiedP)).collect(toList());
```

## 기본형 특화 인터페이스

박싱/언박싱 비용을 줄이기 위한 기본형 특화 버전이 있다.

```java
// Function 기본형 특화
IntFunction<String> intToStr = n -> String.valueOf(n);
ToIntFunction<String> strToInt = Integer::parseInt;
IntUnaryOperator doubleIt = n -> n * 2;

// Consumer 기본형 특화
IntConsumer printInt = System.out::println;
DoubleConsumer formatter = d -> System.out.printf("%.2f%n", d);

// Predicate 기본형 특화
IntPredicate isPositive = n -> n > 0;
LongPredicate isEven = n -> n % 2 == 0;

// 실전 사용
int[] ints = {1, 2, 3, 4, 5};
int sum = IntStream.of(ints)
    .filter(isPositive)        // IntPredicate
    .map(doubleIt)             // IntUnaryOperator
    .sum();
```

## BinaryOperator — 두 값을 받아 같은 타입 반환

```java
// BinaryOperator<T> = BiFunction<T, T, T>
BinaryOperator<Integer> add = Integer::sum;
BinaryOperator<Integer> max = Integer::max;

// Stream.reduce와 함께
Optional<Integer> sum = list.stream().reduce(Integer::sum);
int total = list.stream().reduce(0, Integer::sum);
```

## 커스텀 함수형 인터페이스는 언제?

내장 인터페이스로 부족한 경우에만 직접 만든다.

```java
// 이 경우는 직접 만들지 않아도 됨
// Function<String, Integer> 으로 충분
@FunctionalInterface
interface StringToInt {
    int convert(String s);  // 불필요
}

// 이 경우는 직접 만들 이유가 있음
// 파라미터 3개 필요 (표준에 없음)
@FunctionalInterface
interface TriFunction<A, B, C, R> {
    R apply(A a, B b, C c);
}

// 체크 예외를 던지는 함수 (표준은 체크 예외 미지원)
@FunctionalInterface
interface ThrowingSupplier<T> {
    T get() throws Exception;
}
```

---

**지난 글:** [메서드 참조 — 4가지 유형 완전 정리](/posts/java-method-reference/)

**다음 글:** [BiFunction·BiPredicate·BiConsumer — 두 입력 처리](/posts/java-bifunction-bipredicate/)

<br>
읽어주셔서 감사합니다. 😊
