---
title: "람다 표현식 — 문법·특성·익명 클래스와의 차이"
description: "Java 람다 표현식 완전 정리 — 기본 문법(파라미터·화살표·본문), 익명 클래스와의 비교, 타겟 타입 추론, effectively final 캡처, this 참조 차이, invokedynamic 구현 원리, 람다를 쓰면 좋은 상황과 나쁜 상황"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "Lambda", "람다", "FunctionalInterface", "익명클래스", "타겟타입", "effectivelyFinal"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-vs-loop/)에서 스트림과 루프의 선택 기준을 정리했다. 이번에는 Stream API를 포함해 현대 Java 코드 전반에서 활용되는 **람다 표현식**을 깊이 다룬다. 람다는 단순히 코드를 줄이는 게 아니라, 코드를 **값처럼 전달**하는 함수형 프로그래밍의 핵심 개념이다.

## 람다 표현식이란

람다는 **이름 없는 함수**를 표현하는 방법이다. Java 8에서 도입됐으며, 함수형 인터페이스의 인스턴스를 간결하게 만들 수 있다.

```java
// Java 7 이전: 익명 클래스
Runnable r1 = new Runnable() {
    @Override
    public void run() {
        System.out.println("Hello");
    }
};

// Java 8+: 람다
Runnable r2 = () -> System.out.println("Hello");
```

![람다 문법 해부](/assets/posts/java-lambda-expressions-syntax.svg)

## 문법 구성 요소

람다는 세 부분으로 구성된다.

```text
(파라미터 목록) -> 본문
```

**파라미터 목록**

```java
() -> ...                    // 파라미터 없음
(x) -> ...                   // 파라미터 1개 (괄호 생략 가능)
x -> ...                     // 괄호 생략
(int x, int y) -> ...        // 타입 명시
(x, y) -> ...                // 타입 추론 (더 많이 사용)
```

**본문 형태**

```java
// 단일 표현식 (return 생략)
x -> x * 2

// 블록 본문 (return 명시 필요)
(x, y) -> {
    int result = x + y;
    return result;
}

// void 반환 (블록)
name -> {
    validate(name);
    save(name);
}
```

## 타겟 타입 — 컴파일러가 타입을 추론하는 방법

람다는 **타겟 타입**으로부터 시그니처를 추론한다. 타겟 타입은 람다가 할당되는 변수나 메서드 파라미터의 타입이다.

```java
// Comparator<String>의 compare(String, String) -> int를 추론
Comparator<String> cmp = (a, b) -> a.compareTo(b);

// Runnable의 run() -> void를 추론
Runnable r = () -> System.out.println("run");

// 메서드 파라미터의 타겟 타입
list.sort((a, b) -> a.compareTo(b));  // sort()의 파라미터 타입이 Comparator<String>
```

같은 람다가 다른 함수형 인터페이스로 해석될 수 있다.

```java
// () -> "hello"는 타겟 타입에 따라 달리 해석됨
Supplier<String> s = () -> "hello";      // Supplier<String>
Callable<String> c = () -> "hello";      // Callable<String>
```

## 함수형 인터페이스 @FunctionalInterface

람다는 **추상 메서드가 정확히 1개**인 인터페이스에만 할당할 수 있다. 이를 **함수형 인터페이스**라고 하며, `@FunctionalInterface` 어노테이션으로 강제할 수 있다.

```java
@FunctionalInterface
interface Transformer<T, R> {
    R transform(T input);

    // default/static 메서드는 제한 없음
    default Transformer<T, R> andLog() {
        return input -> {
            R result = this.transform(input);
            System.out.println(input + " -> " + result);
            return result;
        };
    }
}

// 람다로 구현
Transformer<String, Integer> length = s -> s.length();
length.transform("hello");  // 5
```

## effectively final — 외부 변수 캡처

람다는 둘러싼 스코프의 지역 변수를 캡처할 수 있다. 단, 캡처된 변수는 **final이거나 사실상 final(effectively final)** 이어야 한다.

```java
String prefix = "Hello, ";  // effectively final (한 번만 초기화)
Function<String, String> greeter = name -> prefix + name;

// prefix = "Hi"; // 이 줄이 있으면 컴파일 오류!
```

```java
// 잘못된 예: 루프 변수 캡처 불가
for (int i = 0; i < 10; i++) {
    // 컴파일 오류: i는 effectively final이 아님
    tasks.add(() -> System.out.println(i));
}

// 올바른 예: effectively final 복사본
for (int i = 0; i < 10; i++) {
    final int copy = i;  // 또는 그냥 int copy = i;
    tasks.add(() -> System.out.println(copy));
}
```

![람다 형태와 익명 클래스 비교](/assets/posts/java-lambda-expressions-forms.svg)

## this 참조 차이

```java
class MyClass {
    String name = "MyClass";

    void demo() {
        // 익명 클래스: this = 익명 클래스 인스턴스
        Runnable anon = new Runnable() {
            @Override
            public void run() {
                System.out.println(this.getClass().getName()); // MyClass$1
            }
        };

        // 람다: this = 둘러싼 클래스 인스턴스 (MyClass)
        Runnable lambda = () -> {
            System.out.println(this.name);  // "MyClass"
            System.out.println(this.getClass().getName()); // MyClass
        };
    }
}
```

람다 안의 `this`는 둘러싼 클래스를 가리킨다. 이는 람다가 클로저처럼 동작하기 때문이다.

## invokedynamic — JVM 구현 원리

람다는 익명 클래스처럼 별도의 `.class` 파일을 만들지 않는다. JVM이 **`invokedynamic`** 바이트코드 명령어와 **`LambdaMetafactory`** 를 통해 런타임에 동적으로 함수형 인터페이스 구현체를 생성한다.

- 처음 호출 시: `LambdaMetafactory`가 구현 클래스를 생성하고 캐시
- 이후 호출: 캐시된 구현 재사용
- 클래스 파일 생성 없음 → 클래스로딩 비용 절감

```bash
# 컴파일 후 클래스 파일 확인
javac MyClass.java
ls MyClass*.class  # MyClass$1.class 같은 익명 클래스 파일이 생기지 않음
```

## 람다를 쓰면 좋은 경우

```java
// 1. 짧고 단순한 콜백
button.addActionListener(e -> handleClick());

// 2. 스트림 파이프라인
list.stream().filter(s -> s.length() > 3).collect(toList());

// 3. Comparator 정의
list.sort(Comparator.comparing(Person::getName).thenComparing(Person::getAge));

// 4. 지연 초기화 (Supplier)
String val = Optional.ofNullable(cache.get(key))
    .orElseGet(() -> computeExpensiveValue(key));
```

## 람다를 쓰지 않는 편이 나은 경우

```java
// 1. 로직이 복잡해 메서드로 분리가 더 나을 때
// 나쁨: 긴 람다
list.stream().filter(item -> {
    // 20줄 복잡한 로직...
    return result;
}).collect(toList());

// 좋음: 별도 메서드
list.stream().filter(this::complexFilter).collect(toList());

// 2. 체크 예외가 많이 발생할 때 — try-catch 래핑이 가독성을 해침
// 3. this 참조가 헷갈릴 때
```

람다는 **1-3줄 이내의 단순한 로직**에 가장 어울린다. 복잡한 로직은 메서드로 이름을 붙여 의도를 명확히 드러내는 것이 더 좋다.

---

**지난 글:** [Stream vs for 루프 — 성능·가독성·선택 기준](/posts/java-stream-vs-loop/)

**다음 글:** [메서드 참조 — 4가지 종류와 활용법](/posts/java-method-reference/)

<br>
읽어주셔서 감사합니다. 😊
