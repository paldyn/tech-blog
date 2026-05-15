---
title: "Java switch 표현식 완전 정리"
description: "Java 14에 정식 도입된 switch 표현식의 화살표 레이블, yield 키워드, 다중 레이블, 완전성 검사까지 전통 switch 문과 비교하며 코드 예제 중심으로 완전히 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "switch", "switch expression", "switch 표현식", "yield", "화살표 레이블", "패턴 매칭", "Java 14", "Java 17", "제어흐름"]
featured: false
draft: false
---

[지난 글](/posts/java-control-flow/)에서 if/else, for, while 같은 제어 흐름 구조를 정리했다. 이번에는 Java 14에 정식 표준(Standard Feature)으로 도입된 **switch 표현식(switch expression)**을 깊이 살펴본다. 기존 switch 문이 가진 fall-through 버그, 반복 코드, 값 반환 불가 문제를 어떻게 해결했는지 코드 예제로 설명한다.

## 전통 switch 문의 한계

Java 1 시절부터 쓰던 switch 문은 세 가지 고질적인 문제를 안고 있었다.

첫째, `break`를 빠뜨리면 **fall-through**가 발생한다. 의도치 않게 다음 case로 실행이 흘러 버그의 온상이 된다. 둘째, 여러 case에 같은 로직을 적용하려면 `case A: case B: case C:` 처럼 레이블을 줄줄이 나열해야 한다. 셋째, switch 문은 **문(statement)**이기 때문에 값을 반환하지 못한다. 결과를 담으려면 반드시 별도 변수를 먼저 선언해야 했다.

```java
// 전통 switch 문 — break 누락 시 fall-through 위험
String result;
switch (day) {
    case MON:
    case FRI:
        result = "Weekday";
        break;          // 빠뜨리면 다음 case로 흐름
    case SAT:
    case SUN:
        result = "Weekend";
        break;
    default:
        result = "Other";
}
```

![switch 문 vs switch 표현식](/assets/posts/java-switch-expression-comparison.svg)

## switch 표현식 기본 문법

Java 12, 13에서 Preview Feature로 소개되고 Java 14에서 정식 도입됐다. 핵심은 **화살표 레이블(`->`)**과 **표현식으로서의 값 반환**이다.

```java
// switch 표현식 — 화살표 레이블, fall-through 없음
String result = switch (day) {
    case MON, FRI -> "Weekday";
    case SAT, SUN -> "Weekend";
    default        -> "Other";
};
```

차이점을 정리하면 다음과 같다.

- `case MON, FRI ->` 처럼 **쉼표로 여러 레이블**을 한 줄에 묶을 수 있다.
- 화살표 오른쪽이 표현식(expression)이면 그 값이 switch 표현식의 결과가 된다.
- 화살표 레이블 사이에는 fall-through가 **원천적으로 없다**.
- switch 전체가 하나의 표현식이므로 변수에 직접 대입하거나 메서드 인수로 바로 전달할 수 있다.

## 다중 레이블

전통 switch에서 세 레이블을 같은 동작에 연결하려면 case를 세 줄 써야 했다. switch 표현식에서는 쉼표 하나로 해결된다.

```java
int numLetters = switch (day) {
    case MON, FRI, SUN -> 6;
    case TUE           -> 7;
    case THU, SAT      -> 8;
    case WED           -> 9;
};
```

이 코드에서 `day`가 `MON`, `FRI`, `SUN` 중 하나면 6을 반환하고 나머지 case도 마찬가지로 각각 해당 값을 반환한다.

## 블록 분기와 yield

case에 단순 값 하나가 아니라 여러 문장이 필요할 때는 블록(`{}`)을 쓴다. 블록에서 값을 반환할 때는 새로 추가된 **`yield` 키워드**를 사용한다.

```java
String description = switch (errorCode) {
    case 404 -> "Not Found";
    case 500 -> {
        String msg = "Internal Server Error";
        log(msg);
        yield msg;          // 블록에서 값 반환
    }
    default -> "Unknown Error";
};
```

`yield`는 switch 표현식 전용 키워드다. 일반 메서드에서 쓰이는 `return`과 역할이 비슷하지만 switch 표현식의 블록 case에서만 사용할 수 있다.

![switch 표현식 yield와 블록 분기](/assets/posts/java-switch-expression-yield.svg)

## 콜론 레이블 방식과의 혼용

switch 표현식은 화살표 레이블 외에 **전통 콜론(`:`) 레이블**도 지원한다. 단, 콜론 레이블을 쓰면 fall-through가 다시 살아나므로 주의해야 한다. 블록 안에서 값을 반환할 때는 마찬가지로 `yield`를 쓴다.

```java
int result = switch (x) {
    case 1:
    case 2:
        yield 10;    // fall-through 허용 → 1, 2 모두 yield 10
    default:
        yield 0;
};
```

실무에서는 가독성과 안전성 때문에 화살표 레이블을 강력히 권장한다. 콜론 레이블 방식은 fall-through를 의도적으로 활용하는 아주 드문 경우에만 쓰는 것이 좋다.

## 완전성(Exhaustiveness) 검사

switch 표현식이 문(statement)이 아닌 **표현식**이기 때문에 컴파일러는 모든 가능한 입력 값에 대해 결과가 있는지를 검사한다. 이를 **완전성(exhaustiveness)** 검사라고 한다.

- `int`, `String`, 일반 `enum` 등을 selector로 쓸 경우 `default` case가 반드시 있어야 한다.
- **sealed class**나 **enum의 모든 상수를 명시**한 경우에는 컴파일러가 완전하다고 판단해 `default`를 생략할 수 있다.

```java
enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

// 7개 상수를 모두 나열 → default 불필요
int letters = switch (day) {
    case MON, FRI, SUN -> 6;
    case TUE           -> 7;
    case THU, SAT      -> 8;
    case WED           -> 9;
};
```

## switch 표현식을 문으로 쓰기

switch 표현식의 결과값을 버리고 side-effect만을 목적으로 사용할 수도 있다. 이때는 세미콜론 없이 문처럼 사용하면 된다.

```java
switch (command) {
    case "start"  -> startService();
    case "stop"   -> stopService();
    case "restart"-> { stopService(); startService(); }
    default       -> throw new IllegalArgumentException("unknown: " + command);
}
```

`throw`는 문(statement)이므로 화살표 오른쪽에 바로 쓸 수 있다는 점도 유용하다.

## switch 표현식이 등장한 배경

Java 12(JEP 325)에서 처음 Preview로 등장한 이유는 단순히 편의성만이 아니었다. Java 17부터 시작된 **패턴 매칭 switch(JEP 406→441)**의 기반 문법이 필요했기 때문이다. switch 표현식이 있어야 뒤에서 다룰 타입 패턴, guarded pattern, record pattern 같은 강력한 기능이 자연스럽게 switch 안에 들어올 수 있었다.

## 정리

switch 표현식은 **화살표 레이블**로 fall-through를 없애고, **다중 레이블**로 중복 코드를 줄이며, **yield**로 블록 내부에서도 값을 반환할 수 있게 한다. 컴파일러가 완전성을 검사해 default 누락도 잡아준다. Java 14 이상이라면 전통 switch 문 대신 switch 표현식을 기본으로 쓰는 것이 좋다. 다음 글에서는 Java 21에 정식 도입된 패턴 매칭 switch로 이 표현식이 얼마나 더 강력해지는지 살펴본다.

---

**지난 글:** [Java 제어 흐름(Control Flow) 완전 정리](/posts/java-control-flow/)

**다음 글:** [Java 패턴 매칭 switch 완전 정리](/posts/java-pattern-matching-switch/)

<br>
읽어주셔서 감사합니다. 😊
