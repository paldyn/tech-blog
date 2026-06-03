---
title: "BiFunction·BiPredicate·BiConsumer — 두 입력 처리"
description: "java.util.function Bi 계열 함수형 인터페이스 완전 분석 — BiFunction<T,U,R>의 apply와 andThen, BiPredicate<T,U>의 test·and·or·negate, BiConsumer<T,U>와 Map.forEach, BinaryOperator와 Stream.reduce, ToIntBiFunction 등 기본형 특화"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "BiFunction", "BiPredicate", "BiConsumer", "BinaryOperator", "함수형인터페이스", "두입력"]
featured: false
draft: false
---

[지난 글](/posts/java-functional-interfaces-built-in/)에서 단일 입력 함수형 인터페이스를 익혔다. 이번에는 **두 개의 입력 파라미터**를 받는 **Bi 계열 함수형 인터페이스**를 다룬다. 두 값을 조합하거나 비교하는 로직에서 자연스럽게 등장한다.

## Bi 계열이 필요한 이유

단일 파라미터 인터페이스로는 두 값을 동시에 처리하기 어렵다.

```java
// 두 값을 조합 — Function으로는 표현 불가
// "이름과 나이를 받아 소개 문자열 반환"
String intro = (name, age) -> name + "(" + age + ")";  // 어디에 담을까?

// BiFunction을 사용
BiFunction<String, Integer, String> intro =
    (name, age) -> name + " (" + age + "세)";
intro.apply("홍길동", 30);  // "홍길동 (30세)"
```

![Bi 계열 입력-출력 다이어그램](/assets/posts/java-bifunction-bipredicate-diagram.svg)

## BiFunction&lt;T, U, R&gt;

두 값을 받아 결과를 생성하는 함수다.

```java
// 기본 사용
BiFunction<String, Integer, String> repeatStr =
    (s, n) -> s.repeat(n);
repeatStr.apply("ab", 3);  // "ababab"

// andThen — 결과에 추가 변환
BiFunction<String, Integer, Integer> repeatLen =
    repeatStr.andThen(String::length);
repeatLen.apply("ab", 3);  // "ababab".length() = 6
```

`andThen`은 `BiFunction`의 기본 메서드다. 결과 타입 `R`에 `Function<R, V>`를 적용해 최종 타입 `V`를 반환한다.

```java
// 실전 예: 두 조건의 점수 계산
BiFunction<Integer, Integer, String> scoreGrade =
    (score, bonus) -> {
        int total = score + bonus;
        return total >= 90 ? "A" : total >= 80 ? "B" : "C";
    };
scoreGrade.apply(75, 18);  // "A" (93점)
```

## BinaryOperator&lt;T&gt;

`BiFunction<T, T, T>`의 특화형이다. 같은 타입 두 값을 받아 같은 타입을 반환한다.

```java
// 기본 사용
BinaryOperator<Integer> add  = Integer::sum;
BinaryOperator<Integer> max  = Integer::max;
BinaryOperator<String>  join = (a, b) -> a + ", " + b;

// Stream.reduce와 결합
List<Integer> nums = List.of(1, 2, 3, 4, 5);

int total = nums.stream().reduce(0, Integer::sum);    // 15
Optional<Integer> maxVal = nums.stream().reduce(Integer::max); // Optional[5]

// 전화번호부 병합
Map<String, Integer> a = Map.of("Alice", 90, "Bob", 80);
Map<String, Integer> b = Map.of("Alice", 85, "Charlie", 70);
// 동일 키는 큰 값으로 병합
Map<String, Integer> merged = Stream.of(a, b)
    .flatMap(m -> m.entrySet().stream())
    .collect(toMap(
        Map.Entry::getKey,
        Map.Entry::getValue,
        Integer::max   // BinaryOperator — 중복 키 병합
    ));
```

## BiPredicate&lt;T, U&gt;

두 값을 받아 boolean을 반환하는 조건 인터페이스다.

```java
// 기본 사용
BiPredicate<String, Integer> longerThan =
    (s, n) -> s.length() > n;
longerThan.test("hello", 3);  // true
longerThan.test("hi", 5);     // false

// and / or / negate
BiPredicate<String, Integer> notNull =
    (s, n) -> s != null;
BiPredicate<String, Integer> validLength =
    notNull.and(longerThan);
validLength.test("hello", 3);  // true
validLength.test(null, 3);     // false (단락 평가)

// 실전: Map.entrySet 필터
map.entrySet().stream()
    .filter(e -> {
        String k = e.getKey();
        Integer v = e.getValue();
        return longerThan.test(k, 3) && v > 50;
    })
    .collect(toMap(Map.Entry::getKey, Map.Entry::getValue));
```

![BiFunction·BiPredicate 코드 예제](/assets/posts/java-bifunction-bipredicate-code.svg)

## BiConsumer&lt;T, U&gt;

두 값을 받아 소비한다. `Map.forEach()`가 대표적인 사용처다.

```java
// 기본 사용
BiConsumer<String, Integer> printEntry =
    (k, v) -> System.out.println(k + " -> " + v);
printEntry.accept("score", 95);  // "score -> 95"

// Map.forEach의 파라미터가 BiConsumer<K, V>
Map<String, Integer> scores = Map.of("Alice", 90, "Bob", 85);
scores.forEach((name, score) ->
    System.out.printf("%s: %d점%n", name, score));

// andThen — 두 BiConsumer 순서대로 실행
BiConsumer<String, Integer> log =
    (k, v) -> logger.info("{} = {}", k, v);
BiConsumer<String, Integer> display = printEntry;
BiConsumer<String, Integer> logAndDisplay = log.andThen(display);
scores.forEach(logAndDisplay);
```

## ToIntBiFunction / ToLongBiFunction / ToDoubleBiFunction

박싱 없는 기본형 결과를 반환하는 특화 버전이다.

```java
// ToIntBiFunction<T, U>: T, U -> int
ToIntBiFunction<String, String> longestLength =
    (a, b) -> Math.max(a.length(), b.length());
longestLength.applyAsInt("hello", "world!");  // 6

// ToDoubleBiFunction<T, U>: T, U -> double
ToDoubleBiFunction<Integer, Integer> avg =
    (a, b) -> (a + b) / 2.0;
avg.applyAsDouble(80, 90);  // 85.0
```

## 실전 패턴 — 팩토리와 결합

```java
// Map.computeIfAbsent의 내부 동작과 유사한 패턴
BiFunction<String, Map<String, List<String>>, List<String>> getOrCreate =
    (key, map) -> map.computeIfAbsent(key, k -> new ArrayList<>());

// 두 엔티티를 받아 DTO 생성
BiFunction<User, Order, OrderDTO> createDTO =
    (user, order) -> new OrderDTO(
        user.getName(),
        order.getAmount(),
        order.getDate()
    );
```

## Bi 계열 선택 가이드

| 목적 | 인터페이스 |
|------|------------|
| 두 값 → 결과 (다른 타입) | `BiFunction<T, U, R>` |
| 두 값 → 결과 (같은 타입) | `BinaryOperator<T>` |
| 두 값 → boolean | `BiPredicate<T, U>` |
| 두 값 소비 (반환 없음) | `BiConsumer<T, U>` |
| 두 값 → int (박싱 없음) | `ToIntBiFunction<T, U>` |

---

**지난 글:** [내장 함수형 인터페이스 — Function·Consumer·Supplier·Predicate](/posts/java-functional-interfaces-built-in/)

**다음 글:** [함수 합성 — andThen·compose·Predicate 조합](/posts/java-functional-composition/)

<br>
읽어주셔서 감사합니다. 😊
