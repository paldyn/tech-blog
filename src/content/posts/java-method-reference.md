---
title: "메서드 참조 — 4가지 유형 완전 정리"
description: "Java 메서드 참조(Method Reference) 4가지 유형 완전 분석 — 정적 메서드 참조, 특정 객체 인스턴스 메서드 참조, 임의 객체 인스턴스 메서드 참조, 생성자 참조의 문법·동작·람다 대응 관계, 언제 메서드 참조가 더 나은지 판단 기준"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "메서드참조", "MethodReference", "람다", "함수형프로그래밍", "생성자참조"]
featured: false
draft: false
---

[지난 글](/posts/java-lambda-expressions/)에서 람다 표현식의 문법과 특성을 살펴봤다. 메서드 참조는 람다를 더 간결하게 쓰는 방법이다. **`클래스명::메서드명`** 또는 **`객체::메서드명`** 형태로, 기존 메서드를 람다처럼 전달한다. 4가지 유형을 예제와 함께 하나씩 이해하자.

## 메서드 참조의 본질

메서드 참조는 **람다의 축약형**이다. 람다 본문이 단순히 메서드 하나를 호출하는 경우에 적용할 수 있다.

```java
// 람다
Function<String, Integer> f1 = s -> s.length();

// 메서드 참조 (동일한 의미)
Function<String, Integer> f2 = String::length;
```

두 코드는 동일한 바이트코드로 컴파일된다. 성능 차이는 없다.

![메서드 참조 4가지 유형](/assets/posts/java-method-reference-types.svg)

## 유형 1 — 정적 메서드 참조

```
클래스명::정적메서드명
```

람다 파라미터가 정적 메서드의 파라미터로 그대로 전달된다.

```java
// 람다 vs 메서드 참조
Function<String, Integer> parse1 = s -> Integer.parseInt(s);
Function<String, Integer> parse2 = Integer::parseInt;  // 동일

// Predicate
Predicate<String> isNull1 = s -> Objects.isNull(s);
Predicate<String> isNull2 = Objects::isNull;

// Consumer
Consumer<Object> print1 = obj -> System.out.println(obj);
Consumer<Object> print2 = System.out::println;  // 특정 객체 참조지만 정적처럼 동작

// 실전 사용
List<String> numbers = List.of("1", "2", "3", "4");
List<Integer> ints = numbers.stream()
    .map(Integer::parseInt)  // 정적 메서드 참조
    .collect(toList());
```

## 유형 2 — 특정 객체의 인스턴스 메서드 참조

```
특정객체::인스턴스메서드명
```

특정 객체 인스턴스의 메서드를 참조한다. 해당 객체가 메서드의 수신자(receiver)로 고정된다.

```java
String str = "Hello, World!";

// 람다 vs 메서드 참조
Supplier<String> upper1 = () -> str.toUpperCase();
Supplier<String> upper2 = str::toUpperCase;  // str이 고정된 수신자

// 외부 비교자 객체
Comparator<String> comp = String::compareTo;
// 아니라 특정 객체를 수신자로:
String pivot = "banana";
Predicate<String> lessThan1 = s -> pivot.compareTo(s) < 0;
// (특정 객체 참조로 직접 표현은 Predicate가 맞지 않아서 람다가 더 명확)

// 로거 예시
Logger logger = LoggerFactory.getLogger(MyClass.class);
Consumer<String> log = logger::info;  // logger가 고정 수신자
list.forEach(log);
```

## 유형 3 — 임의 객체의 인스턴스 메서드 참조

```
클래스명::인스턴스메서드명
```

가장 자주 쓰이는 유형이다. 람다의 첫 번째 파라미터가 메서드 수신자가 된다.

```java
// 람다 vs 메서드 참조
Function<String, String> upper1 = s -> s.toUpperCase();
Function<String, String> upper2 = String::toUpperCase;  // s가 수신자

// 여러 파라미터: 첫 번째가 수신자, 나머지가 메서드 파라미터
BiFunction<String, String, Boolean> startsWith1 = (s, prefix) -> s.startsWith(prefix);
BiFunction<String, String, Boolean> startsWith2 = String::startsWith;

// 실전 사용
List<String> names = List.of("Alice", "Bob", "Charlie");

// 대문자 변환
names.stream().map(String::toUpperCase).collect(toList());

// 길이 기준 정렬
names.stream().sorted(Comparator.comparingInt(String::length)).collect(toList());

// 비어있지 않은 것 필터
names.stream().filter(Predicate.not(String::isEmpty)).collect(toList());
```

## 유형 4 — 생성자 참조

```
클래스명::new
```

생성자를 함수처럼 전달한다.

```java
// 기본 생성자
Supplier<ArrayList<String>> factory1 = () -> new ArrayList<>();
Supplier<ArrayList<String>> factory2 = ArrayList::new;

// 파라미터 있는 생성자
Function<String, StringBuilder> sbFactory = StringBuilder::new;
StringBuilder sb = sbFactory.apply("initial");

// 배열 생성자 (IntFunction)
IntFunction<String[]> arrayFactory = String[]::new;
String[] arr = arrayFactory.apply(10);  // new String[10]

// 실전 사용: Stream.toArray()
String[] array = names.stream().toArray(String[]::new);

// collect + 생성자 참조
TreeSet<String> sorted = names.stream()
    .collect(toCollection(TreeSet::new));
```

![메서드 참조 코드 예제](/assets/posts/java-method-reference-examples.svg)

## 메서드 참조를 쓸지 람다를 쓸지

**메서드 참조가 더 나은 경우**

```java
// 이름이 의도를 명확히 표현할 때
list.forEach(System.out::println);          // "각 요소를 출력"이 명확
list.stream().map(String::toUpperCase);     // "대문자로 변환"이 명확
list.stream().filter(Objects::nonNull);     // "null 아닌 것 필터"가 명확
```

**람다가 더 나은 경우**

```java
// 추가 로직이 있을 때
list.stream().map(s -> "[" + s + "]");      // 래핑 로직이 있음
list.stream().filter(s -> s.length() > 3); // 비교 로직이 있음

// 외부 변수 캡처가 필요할 때
int threshold = 5;
list.stream().filter(s -> s.length() > threshold);

// 타입 추론이 모호할 때
// (오버로딩된 메서드는 메서드 참조로 타입 불명확할 수 있음)
```

## 오버로딩과 메서드 참조

오버로딩된 메서드에 메서드 참조를 쓸 때 주의가 필요하다.

```java
// println은 다양한 타입을 받는 오버로딩 메서드
// 타겟 타입을 통해 컴파일러가 추론
Consumer<String> c = System.out::println;    // println(String) 추론
Consumer<Integer> d = System.out::println;   // println(int) 추론

// 모호한 경우 명시적 캐스팅 또는 람다 사용
Stream.<Object>of("a", 1).forEach(System.out::println);  // println(Object) 추론
```

## 정리 표

| 유형 | 문법 | 람다 대응 |
|------|------|-----------|
| 정적 메서드 | `Class::staticMethod` | `(args) -> Class.staticMethod(args)` |
| 특정 객체 | `obj::instanceMethod` | `(args) -> obj.instanceMethod(args)` |
| 임의 객체 | `Class::instanceMethod` | `(obj, args) -> obj.instanceMethod(args)` |
| 생성자 | `Class::new` | `(args) -> new Class(args)` |

---

**지난 글:** [람다 표현식 — 문법·특성·익명 클래스와의 차이](/posts/java-lambda-expressions/)

**다음 글:** [내장 함수형 인터페이스 — Function·Consumer·Supplier·Predicate](/posts/java-functional-interfaces-built-in/)

<br>
읽어주셔서 감사합니다. 😊
