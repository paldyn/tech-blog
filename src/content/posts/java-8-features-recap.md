---
title: "Java 8 핵심 기능 총정리"
description: "Java 8에서 도입된 Lambda, Stream API, Optional, Date/Time API, Functional Interface, Method Reference, CompletableFuture 등 핵심 기능을 예제 중심으로 총정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "Java8", "Lambda", "Stream", "Optional", "함수형 프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/java-virtual-thread-best-practices/)에서 Virtual Thread 운영 모범 사례를 살펴봤습니다. 이제 Java 버전별 변화를 살펴볼 차례입니다. Java 8은 2014년 출시 이후 10년 넘게 엔터프라이즈 환경에서 가장 널리 사용되는 버전으로, **함수형 프로그래밍 패러다임을 Java에 처음 도입**한 역사적 전환점입니다.

## Java 8이 중요한 이유

Java 8 이전의 Java는 순수 객체지향 언어였습니다. 콜백을 위해 익명 클래스를 작성하고, 컬렉션을 처리하려면 반복문을 중첩했습니다. Java 8은 세 가지 측면에서 패러다임을 바꿨습니다.

- **간결함**: Lambda와 Method Reference로 코드 줄이기
- **선언적 스타일**: Stream API로 "어떻게"가 아닌 "무엇"을 표현
- **안전성**: Optional로 null 처리 명시화, 새 Date/Time API로 불변 날짜 객체 제공

![Java 8 핵심 기능 한눈에 보기](/assets/posts/java-8-features-recap-overview.svg)

## Lambda 표현식

Lambda는 **단 하나의 추상 메서드를 가진 함수형 인터페이스**의 구현체를 간결하게 표현합니다.

```java
// 이전 방식 — 익명 클래스
Comparator<String> comp = new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return a.compareTo(b);
    }
};

// Lambda 방식
Comparator<String> comp = (a, b) -> a.compareTo(b);

// 타입 추론 가능하면 괄호 생략 가능
list.forEach(s -> System.out.println(s));
```

Lambda 문법은 `(파라미터) -> { 바디 }` 형태입니다. 바디가 단일 표현식이면 `{}` 와 `return`을 생략할 수 있습니다.

## Functional Interface와 java.util.function

`@FunctionalInterface`는 추상 메서드가 정확히 하나인 인터페이스를 의미합니다.

```java
// 주요 내장 함수형 인터페이스
Function<String, Integer>  fn  = String::length;   // T → R
Predicate<String>          pred = s -> s.length() > 3; // T → boolean
Consumer<String>           cons = System.out::println; // T → void
Supplier<LocalDate>        sup  = LocalDate::now;      // () → T
BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;

// 합성
Function<String, String> upper = String::toUpperCase;
Function<String, String> trim  = String::trim;
Function<String, String> combined = trim.andThen(upper);
```

## Stream API

Stream은 컬렉션 데이터를 처리하는 선언적 파이프라인입니다. 중간 연산(intermediate)은 Lazy하게 평가되며, 최종 연산(terminal)이 호출될 때 실제로 실행됩니다.

![Stream API 파이프라인 구조](/assets/posts/java-8-features-recap-streams.svg)

```java
// 부서별 평균 급여 계산
Map<String, Double> avgSalary = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.averagingDouble(Employee::getSalary)
    ));

// flatMap — 중첩 컬렉션 펼치기
List<String> allTags = posts.stream()
    .flatMap(post -> post.getTags().stream())
    .distinct()
    .sorted()
    .collect(Collectors.toList());

// 병렬 스트림 — CPU-bound 대용량 처리
long count = LongStream.rangeClosed(1, 100_000_000L)
    .parallel()
    .filter(n -> isPrime(n))
    .count();
```

**주의**: `parallelStream()`은 CPU-bound 대용량 처리에서 효과적이지만, 순서가 중요하거나 공유 가변 상태에 접근하는 경우 오히려 성능이 떨어질 수 있습니다.

## Method Reference

Lambda의 축약 표현으로, 이미 존재하는 메서드를 참조합니다.

```java
// 4가지 유형
list.forEach(System.out::println);        // 정적 메서드 참조 아님, 객체 메서드
list.stream().map(String::toUpperCase)    // 임의 객체의 인스턴스 메서드
    .map(String::new)                     // 생성자 참조
    .forEach(s -> s.contains("A"));       // (람다와 혼용 가능)

// 정적 메서드 참조
list.stream().map(Integer::parseInt);

// 특정 객체 인스턴스 메서드 참조
String prefix = "Hello, ";
list.stream().map(prefix::concat);
```

## Optional

`Optional<T>`는 값이 있거나 없을 수 있음을 타입으로 표현합니다. `null` 반환 대신 사용해 NullPointerException을 방지합니다.

```java
Optional<String> name = findUserById(42L)
    .map(User::getName)
    .filter(n -> !n.isBlank());

// 값 추출
String result = name.orElse("Anonymous");
String result2 = name.orElseGet(() -> generateDefault());
String result3 = name.orElseThrow(
    () -> new EntityNotFoundException("User not found")
);

// 값이 있을 때만 실행
name.ifPresent(n -> log.info("User: {}", n));
name.ifPresentOrElse(
    n -> log.info("User: {}", n),
    () -> log.warn("User not found")
);
```

## Date/Time API (java.time)

`java.util.Date`와 `Calendar`의 단점(가변, 스레드 불안전, 월이 0부터 시작 등)을 해결한 새 API입니다.

```java
// 날짜/시간 생성
LocalDate date    = LocalDate.of(2024, 3, 15);
LocalTime time    = LocalTime.of(14, 30, 0);
LocalDateTime ldt = LocalDateTime.of(date, time);

// 타임존 포함
ZonedDateTime zdt = ZonedDateTime.now(ZoneId.of("Asia/Seoul"));

// 포맷
String formatted = ldt.format(
    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
);

// 날짜 계산 — 불변 객체, 새 인스턴스 반환
LocalDate nextWeek  = date.plusWeeks(1);
LocalDate lastMonth = date.minusMonths(1);
long days = ChronoUnit.DAYS.between(date, nextWeek); // 7
```

## CompletableFuture

Java 5의 `Future`는 `get()`이 블로킹이어서 비동기 파이프라인을 만들기 어려웠습니다. `CompletableFuture`는 이를 해결합니다.

```java
CompletableFuture<String> future =
    CompletableFuture.supplyAsync(() -> fetchUser(42L))
        .thenApply(user -> user.getName())
        .thenApply(String::toUpperCase)
        .exceptionally(ex -> "ANONYMOUS");

// 여러 Future 조합
CompletableFuture<Void> all = CompletableFuture.allOf(
    fetchUser(1L), fetchUser(2L), fetchUser(3L)
);
all.join(); // 모두 완료될 때까지 대기
```

## 정리

Java 8의 핵심은 **함수를 값으로 다루는 패러다임의 도입**입니다. Lambda와 Stream API는 컬렉션 처리 코드의 가독성을 극적으로 향상시켰고, Optional과 새 Date/Time API는 오랜 관행적 버그 원인을 제거했습니다. Java 8을 마스터하는 것은 그 이후 버전(11, 17, 21)의 기능을 이해하는 기반이 됩니다.

---

**지난 글:** [Virtual Thread 운영 모범 사례](/posts/java-virtual-thread-best-practices/)

**다음 글:** [Java 9·10 주요 변경 사항 브리지](/posts/java-9-10-bridge/)

<br>
읽어주셔서 감사합니다. 😊
