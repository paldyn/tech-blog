---
title: "Stream flatMap — 중첩 스트림 평탄화와 활용 패턴"
description: "Stream.flatMap()의 동작 원리와 map()과의 차이점 — 중첩 컬렉션 평탄화, 문자열 분리, Optional 연쇄, flatMapToInt/Long/Double 기본형 특화, Stream.empty()로 null 대체하는 실전 패턴"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "flatMap", "중첩스트림", "평탄화", "Optional"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-collectors-grouping/)에서 `groupingBy` 다운스트림 조합을 익혔다. 이번에는 **`flatMap`** 을 다룬다. Stream API를 처음 배울 때 `map`과 혼동하기 쉽지만, 구조적으로 전혀 다른 연산이다. `flatMap`을 제대로 이해하면 중첩된 자료구조를 다루는 코드가 극적으로 단순해진다.

## map() vs flatMap() — 핵심 차이

```java
// map: T → R  (1:1 변환)
// 각 요소가 하나의 값으로 바뀜
Stream<Integer> lengths = Stream.of("hello", "world")
    .map(String::length);    // [5, 5]

// flatMap: T → Stream<R>  (1:N 변환 후 평탄화)
// 각 요소가 스트림으로 바뀐 뒤 모두 합쳐짐
Stream<Character> chars = Stream.of("hi", "ho")
    .flatMap(s -> s.chars().mapToObj(c -> (char) c));
// ['h','i','h','o'] — 2개의 스트림이 1개로 합쳐짐
```

`map`을 적용하면 `Stream<Stream<T>>` 중첩 스트림이 생기는 상황에서 `flatMap`을 쓰면 **하나의 평평한 스트림**이 된다.

![flatMap 동작 원리](/assets/posts/java-stream-flatmap-concept.svg)

## 중첩 컬렉션 평탄화

가장 흔한 사용 사례다. 부서별 직원 목록(`List<List<Employee>>`)을 전체 직원 목록(`List<Employee>`)으로 변환한다.

```java
List<List<String>> deptEmployees = List.of(
    List.of("홍길동", "김영수"),
    List.of("이철희", "박민지", "최지수")
);

// map 사용 시 — Stream<List<String>> (중첩)
Stream<List<String>> nested = deptEmployees.stream()
    .map(List::stream);  // Stream<Stream<String>>이 되어야 하지만 컴파일 오류

// flatMap 사용 시 — Stream<String> (평탄)
List<String> allEmployees = deptEmployees.stream()
    .flatMap(Collection::stream)  // 각 List를 스트림으로 펼침
    .collect(toList());
// [홍길동, 김영수, 이철희, 박민지, 최지수]
```

`Collection::stream`은 각 `List`를 `Stream<String>`으로 변환하는 메서드 참조다. `flatMap`이 이 스트림들을 하나로 합쳐 준다.

## 문자열 분리와 단어 추출

```java
List<String> sentences = List.of(
    "Java stream flatMap",
    "is very powerful"
);

// 모든 문장을 단어로 분리 후 고유 단어 추출
Set<String> uniqueWords = sentences.stream()
    .flatMap(s -> Arrays.stream(s.split(" ")))
    .map(String::toLowerCase)
    .collect(toSet());
// [java, stream, flatmap, is, very, powerful]
```

`split()`이 `String[]`을 반환하므로 `Arrays.stream()`으로 스트림을 만들어야 한다.

![flatMap 코드 예제](/assets/posts/java-stream-flatmap-code.svg)

## Optional과 flatMap

`Optional.flatMap()`은 `Optional<Optional<T>>`가 생기는 것을 방지한다.

```java
class User {
    Optional<Address> getAddress() { ... }
}

class Address {
    Optional<String> getCity() { ... }
}

// map 사용 시 — Optional<Optional<String>> 발생
Optional<Optional<String>> bad = findUser(id)
    .map(u -> u.getAddress()  // Optional<Optional<Address>>가 되어버림
        .map(Address::getCity));

// flatMap 사용 시 — Optional<String> 깔끔하게
Optional<String> city = findUser(id)
    .flatMap(User::getAddress)  // Optional<Address>
    .flatMap(Address::getCity); // Optional<String>
```

`Optional.flatMap()`은 값이 있으면 매핑 함수를 적용하고, 없으면 빈 `Optional`을 반환한다.

## Stream.flatMap으로 Optional 필터링

Java 9+ `Optional.stream()`을 활용하면 값이 있는 Optional만 골라낼 수 있다.

```java
List<Optional<String>> maybeNames = List.of(
    Optional.of("Alice"),
    Optional.empty(),
    Optional.of("Bob"),
    Optional.empty()
);

// Optional.stream()이 값이 있으면 단일 요소 스트림, 없으면 빈 스트림 반환
List<String> presentNames = maybeNames.stream()
    .flatMap(Optional::stream)  // Java 9+
    .collect(toList());
// [Alice, Bob]
```

## 기본형 특화 — flatMapToInt / flatMapToLong / flatMapToDouble

박싱 없이 기본형 스트림으로 평탄화하려면 특화 버전을 사용한다.

```java
List<int[]> arrays = List.of(
    new int[]{1, 2, 3},
    new int[]{4, 5},
    new int[]{6}
);

// flatMapToInt — IntStream 반환 (박싱 비용 없음)
int sum = arrays.stream()
    .flatMapToInt(Arrays::stream)  // 각 배열을 IntStream으로
    .sum();
// 21
```

팀별 점수 배열이나 대용량 숫자 처리에서 `flatMapToInt`를 쓰면 `flatMap` + `mapToInt`보다 메모리와 CPU 효율이 좋다.

## flatMap 사용 시 주의사항

**1. null을 반환하면 안 된다**

```java
// 잘못된 예 — NullPointerException 발생
stream.flatMap(item -> null);  // 절대 금지

// 올바른 예 — 빈 스트림으로 대체
stream.flatMap(item -> item == null ? Stream.empty() : item.getChildren().stream());
```

**2. 순서 보장**

순차 스트림에서 `flatMap`은 원소 순서를 보존한다. 첫 요소의 하위 스트림이 모두 나온 뒤 두 번째 요소의 하위 스트림이 나온다.

**3. 성능 고려**

`flatMap`은 각 요소마다 새 스트림 객체를 생성한다. 대용량 데이터에서 매우 작은 스트림을 무수히 만드는 경우 오버헤드가 있을 수 있다. 이런 경우 `for` 루프가 더 나을 수 있다.

## map vs flatMap 선택 기준

| 상황 | 연산 |
|------|------|
| 1:1 변환 (요소 → 단일 값) | `map()` |
| 1:N 변환 (요소 → 스트림) | `flatMap()` |
| Optional 연쇄 | `Optional.flatMap()` |
| 중첩 컬렉션 → 단일 스트림 | `flatMap(Collection::stream)` |
| 기본형 평탄화 | `flatMapToInt/Long/Double()` |

---

**지난 글:** [groupingBy 심화 — 다운스트림 Collector 조합](/posts/java-stream-collectors-grouping/)

**다음 글:** [Stream 병렬 처리 — ForkJoin 풀과 parallelStream](/posts/java-stream-parallel/)

<br>
읽어주셔서 감사합니다. 😊
