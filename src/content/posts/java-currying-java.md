---
title: "커링(Currying) — 다중 인자 함수를 단계적 함수로 분해하기"
description: "Java 커링 완전 분석 — 커링 개념과 부분 적용 차이, Function 체인으로 구현하는 커링 패턴, BiFunction 커링, 로거·검증·설정 팩토리 등 실전 활용, 커링이 적합한 상황과 오남용 주의점"
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "커링", "Currying", "부분적용", "PartialApplication", "Function", "함수형프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/java-functional-composition/)에서 `andThen`·`compose`로 함수를 합성하는 방법을 익혔다. 이번에는 **커링(Currying)** 을 다룬다. 커링은 여러 인자를 받는 함수를 인자 하나씩 받는 함수들의 연쇄로 변환하는 기법이다. 수학자 Haskell Curry의 이름에서 유래했으며, 함수형 언어에서는 기본 동작이지만 Java에서는 `Function` 중첩으로 직접 구현해야 한다.

## 커링이 필요한 이유

일반적인 함수 `f(a, b)`는 두 인자를 반드시 동시에 제공해야 한다. 하지만 실무에서는 **첫 번째 인자는 정해져 있고 두 번째 인자만 나중에 결정**되는 경우가 많다. 커링은 이런 상황에서 함수의 인자를 **단계적으로 적용**할 수 있게 해준다.

```java
// 커링 없이: 항상 두 인자를 동시에 전달
int add(int a, int b) { return a + b; }
add(3, 4); // 7

// 커링: 첫 번째 인자만 먼저 고정
Function<Integer, Function<Integer, Integer>> curriedAdd =
    a -> b -> a + b;

Function<Integer, Integer> addThree = curriedAdd.apply(3); // 첫 인자 3 고정
addThree.apply(4); // 7 — 나중에 두 번째 인자 제공
addThree.apply(10); // 13 — 같은 함수 재사용
```

![커링 개념 — 다중 인자 함수를 단계적 함수로](/assets/posts/java-currying-java-concept.svg)

## 커링과 부분 적용의 차이

두 개념은 자주 혼동되지만 다르다.

| 구분 | 커링 | 부분 적용 |
|------|------|-----------|
| 정의 | `f(a,b)` → `f(a)(b)` — 인자를 1개씩 | 일부 인자를 미리 고정한 새 함수 |
| 결과 | 항상 단항 함수 체인 | 인자 수가 줄어든 함수 |
| Java 구현 | `Function<A, Function<B, R>>` | `() -> original(fixed, ...)` |

```java
// 커링 — 인자를 1개씩 분리
Function<String, Function<String, String>> greet =
    greeting -> name -> greeting + ", " + name + "!";

// 부분 적용 — 일부 인자를 클로저로 캡처
String greeting = "Hello";
Function<String, String> helloTo = name -> greeting + ", " + name + "!";
```

## BiFunction 커링

`BiFunction<A, B, R>`은 두 인자를 받는다. 커링하면 `Function<A, Function<B, R>>`이 된다.

```java
import java.util.function.BiFunction;
import java.util.function.Function;

BiFunction<Integer, Integer, Integer> multiply = (a, b) -> a * b;

// BiFunction → 커링 변환
Function<Integer, Function<Integer, Integer>> curriedMultiply =
    a -> b -> multiply.apply(a, b);

Function<Integer, Integer> double_ = curriedMultiply.apply(2);
Function<Integer, Integer> triple  = curriedMultiply.apply(3);

double_.apply(5);  // 10
triple.apply(5);   // 15
```

## 실전 패턴

### 로거 팩토리

```java
Function<String, Function<String, String>> log =
    level -> msg -> "[" + level + "] " + msg;

// 로그 레벨별 함수 미리 생성
Function<String, String> info  = log.apply("INFO");
Function<String, String> warn  = log.apply("WARN");
Function<String, String> error = log.apply("ERROR");

info.apply("서버 시작");           // [INFO] 서버 시작
warn.apply("DB 커넥션 풀 부족");   // [WARN] DB 커넥션 풀 부족
error.apply("NullPointerException"); // [ERROR] NullPointerException
```

### 검증 규칙 조립

```java
Function<Integer, Predicate<Integer>> minCheck =
    min -> n -> n >= min;

Predicate<Integer> isAdult    = minCheck.apply(18);
Predicate<Integer> isPositive = minCheck.apply(1);

// 합성도 가능
Predicate<Integer> isValidAge = isAdult.and(minCheck.apply(0));
```

### 설정 팩토리

```java
Function<String, Function<Integer, String>> endpoint =
    host -> port -> "http://" + host + ":" + port;

Function<Integer, String> localEndpoint = endpoint.apply("localhost");
localEndpoint.apply(8080);  // http://localhost:8080
localEndpoint.apply(9090);  // http://localhost:9090
```

![커링 활용 패턴 — 부분 적용과 재사용](/assets/posts/java-currying-java-pattern.svg)

## 커링 유틸리티 헬퍼

반복적으로 사용한다면 헬퍼 메서드로 추출할 수 있다.

```java
// BiFunction → 커링 변환 헬퍼
static <A, B, R> Function<A, Function<B, R>> curry(BiFunction<A, B, R> f) {
    return a -> b -> f.apply(a, b);
}

// 사용
Function<String, Function<String, Boolean>> startsWith =
    curry((s, prefix) -> s.startsWith(prefix));

Function<String, Boolean> isHttp = startsWith.apply("http");
isHttp.apply("https://example.com"); // true
isHttp.apply("ftp://files.com");     // false
```

## 주의사항

커링이 항상 좋은 것은 아니다. 남용하면 가독성이 오히려 나빠진다.

```java
// 나쁜 예: 단순한 경우에 커링 강제 적용
Function<String, Function<String, Function<String, String>>> makeUrl =
    protocol -> host -> path -> protocol + "://" + host + "/" + path;
// 읽기 어렵고 사용도 불편: makeUrl.apply("https").apply("example.com").apply("api")

// 좋은 예: 메서드로 충분히 표현
String makeUrl(String protocol, String host, String path) {
    return protocol + "://" + host + "/" + path;
}
```

커링이 적합한 경우는 **첫 번째 인자가 고정되어 재사용**될 때, **Stream이나 함수 합성 파이프라인에 넣을 단항 함수가 필요**할 때다. 단순히 '함수형이니까'라는 이유로 커링을 쓰면 복잡도만 높아진다.

---

**지난 글:** [함수 합성 — andThen·compose·Predicate 조합 완전 정리](/posts/java-functional-composition/)

**다음 글:** [불변 객체(Immutable Objects) — 안전한 설계의 기초](/posts/java-immutability/)

<br>
읽어주셔서 감사합니다. 😊
