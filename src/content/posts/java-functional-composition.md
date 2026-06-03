---
title: "함수 합성 — andThen·compose·Predicate 조합 완전 정리"
description: "Java 함수 합성 완전 분석 — Function.andThen()과 compose()의 실행 순서 차이, Predicate.and()·or()·negate() 조합, Consumer.andThen() 체이닝, UnaryOperator 파이프라인, 함수 합성으로 재사용 가능한 변환 파이프라인 설계하는 실전 패턴"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "함수합성", "andThen", "compose", "Predicate", "FunctionalComposition", "파이프라인"]
featured: false
draft: false
---

[지난 글](/posts/java-bifunction-bipredicate/)에서 두 입력을 처리하는 Bi 계열 인터페이스를 익혔다. 이번에는 **함수 합성(Functional Composition)** 을 다룬다. 함수 합성이란 여러 함수를 조합해 새로운 함수를 만드는 것이다. 코드 재사용성을 높이고 파이프라인을 유연하게 구성할 수 있다.

## 왜 함수 합성인가

```java
// 복잡한 변환을 여러 번 적용해야 할 때
String process(String input) {
    String trimmed  = input.trim();
    String lowered  = trimmed.toLowerCase();
    String replaced = lowered.replace(" ", "_");
    return replaced;
}

// 함수 합성으로 파이프라인 정의 — 재사용 가능
Function<String, String> normalize =
    ((Function<String, String>) String::trim)
        .andThen(String::toLowerCase)
        .andThen(s -> s.replace(" ", "_"));

// 어디서든 재사용
list.stream().map(normalize).collect(toList());
```

## Function.andThen() — 왼쪽에서 오른쪽으로

`f.andThen(g)` = `g(f(x))`. f가 먼저 실행되고, 그 결과가 g에 전달된다.

![Function 합성 andThen vs compose](/assets/posts/java-functional-composition-andthen.svg)

```java
Function<Integer, Integer> times2 = n -> n * 2;
Function<Integer, Integer> plus3  = n -> n + 3;

// andThen: times2 먼저 → plus3 나중
Function<Integer, Integer> times2ThenPlus3 = times2.andThen(plus3);
times2ThenPlus3.apply(5);  // 5*2=10, 10+3=13

// 여러 단계 연결
Function<String, String> pipeline = ((Function<String, String>) String::trim)
    .andThen(String::toLowerCase)
    .andThen(s -> s.replaceAll("\\s+", "-"));
pipeline.apply("  Hello World  ");  // "hello-world"
```

## Function.compose() — 오른쪽에서 왼쪽으로

`f.compose(g)` = `f(g(x))`. g가 먼저 실행되고, 그 결과가 f에 전달된다. 수학적 함수 합성 표기법 `f∘g`와 동일하다.

```java
Function<Integer, Integer> times2 = n -> n * 2;
Function<Integer, Integer> plus3  = n -> n + 3;

// compose: plus3 먼저 → times2 나중
Function<Integer, Integer> plus3ThenTimes2 = times2.compose(plus3);
plus3ThenTimes2.apply(5);  // 5+3=8, 8*2=16

// andThen vs compose 비교
times2.andThen(plus3).apply(5);  // 13 (2*5=10, 10+3=13)
times2.compose(plus3).apply(5);  // 16 (5+3=8, 8*2=16)
```

**팁**: `andThen`이 왼쪽→오른쪽으로 읽혀서 더 직관적이다. `compose`는 수학적 표기가 익숙한 경우에 사용한다.

## Predicate 조합 — and / or / negate

![Predicate 조합](/assets/posts/java-functional-composition-predicate.svg)

```java
Predicate<String> notNull   = s -> s != null;
Predicate<String> notBlank  = s -> !s.isBlank();
Predicate<String> maxLen20  = s -> s.length() <= 20;
Predicate<String> startsA   = s -> s.startsWith("A");

// and — p1 && p2 (단락 평가)
Predicate<String> notNullAndNotBlank = notNull.and(notBlank);

// or — p1 || p2 (단락 평가)
Predicate<String> nullOrBlank = notNullAndNotBlank.negate();

// 복합 조건
Predicate<String> valid = notNull.and(notBlank).and(maxLen20);

// Java 11+ Predicate.not
Predicate<String> hasContent = Predicate.not(String::isBlank);

// Stream.filter에 적용
List<String> result = inputs.stream()
    .filter(valid)
    .filter(startsA.or(s -> s.startsWith("B")))
    .collect(toList());
```

### Predicate.isEqual() — 정적 팩토리

```java
// 특정 값과 같은지 검사
Predicate<String> isJava = Predicate.isEqual("Java");
Predicate<String> isJavaOrPython = isJava.or(Predicate.isEqual("Python"));

List<String> langs = List.of("Java", "Kotlin", "Python", "Go");
langs.stream().filter(isJavaOrPython).collect(toList());
// [Java, Python]
```

## Consumer 체이닝 — andThen

```java
Consumer<String> logInfo  = s -> logger.info("Processing: {}", s);
Consumer<String> validate = s -> { if (s.isBlank()) throw new IllegalArgumentException(); };
Consumer<String> persist  = s -> repository.save(s);

// 세 Consumer를 순서대로 실행
Consumer<String> pipeline = logInfo.andThen(validate).andThen(persist);
list.forEach(pipeline);
```

Consumer.andThen()은 왼쪽 Consumer가 먼저 실행된다. Function.andThen()과 동일한 방향이다.

## UnaryOperator 파이프라인

같은 타입의 변환을 여러 번 조합할 때 `UnaryOperator`를 사용하면 시그니처가 단순해진다.

```java
UnaryOperator<String> trim    = String::trim;
UnaryOperator<String> lower   = String::toLowerCase;
UnaryOperator<String> escape  = s -> s.replace("&", "&amp;");

// Function.andThen과 동일하지만 UnaryOperator 타입 유지
// (UnaryOperator는 Function의 하위 타입이므로 andThen 사용 가능)
Function<String, String> sanitize = trim.andThen(lower).andThen(escape);

// 동적 파이프라인 구성
List<UnaryOperator<String>> operators = List.of(trim, lower, escape);
UnaryOperator<String> combined = operators.stream()
    .reduce(UnaryOperator.identity(), (f, g) -> x -> g.apply(f.apply(x)));
combined.apply("  Hello & World  ");  // "hello &amp; world"
```

## 실전 — 입력 유효성 검사 체인

```java
@FunctionalInterface
interface Validator<T> {
    List<String> validate(T value);

    default Validator<T> and(Validator<T> other) {
        return value -> {
            List<String> errors = new ArrayList<>(this.validate(value));
            errors.addAll(other.validate(value));
            return errors;
        };
    }
}

Validator<String> notBlank = s ->
    s.isBlank() ? List.of("빈 값 불가") : List.of();
Validator<String> maxLen = s ->
    s.length() > 50 ? List.of("50자 초과") : List.of();
Validator<String> noSpecial = s ->
    s.matches(".*[<>\"';&].*") ? List.of("특수문자 불가") : List.of();

Validator<String> inputValidator = notBlank.and(maxLen).and(noSpecial);
List<String> errors = inputValidator.validate(userInput);
```

## 함수 합성 사용 가이드

| 상황 | 사용 |
|------|------|
| A → B → C 파이프라인 | `Function.andThen()` |
| 수학적 f∘g 표현 | `Function.compose()` |
| 여러 조건 AND | `Predicate.and()` |
| 여러 조건 OR | `Predicate.or()` |
| 조건 반전 | `Predicate.negate()` / `Predicate.not()` |
| 여러 소비 동작 순서 실행 | `Consumer.andThen()` |
| 같은 타입 변환 파이프라인 | `UnaryOperator.andThen()` |

함수 합성은 불변 파이프라인을 만들기 때문에 스레드 안전하고 테스트하기 쉽다. 작은 단위 함수를 조합해 복잡한 로직을 구성하는 것이 함수형 스타일의 핵심이다.

---

**지난 글:** [BiFunction·BiPredicate·BiConsumer — 두 입력 처리](/posts/java-bifunction-bipredicate/)

<br>
읽어주셔서 감사합니다. 😊
