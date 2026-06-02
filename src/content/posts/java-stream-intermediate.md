---
title: "Stream 중간 연산 — filter·map·flatMap·distinct·sorted·peek"
description: "Stream 중간 연산 전체 정리 — Stateless(filter·map·flatMap·peek·mapToInt)와 Stateful(sorted·distinct·limit·skip·takeWhile·dropWhile) 분류, flatMap의 평탄화 원리, Java 9 takeWhile/dropWhile, Java 16 mapMulti, 병렬 스트림에서의 주의사항"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "filter", "map", "flatMap", "distinct", "sorted", "takeWhile"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-creation/)에서 다양한 방법으로 스트림을 만드는 법을 살펴봤다. 이번에는 파이프라인의 중간 단계인 **중간 연산(Intermediate Operation)** 을 다룬다. 중간 연산은 항상 `Stream<T>`를 반환하므로 메서드 체이닝으로 파이프라인을 구성한다.

## 중간 연산의 두 가지 분류

중간 연산은 이전 원소가 필요한지에 따라 **Stateless**와 **Stateful**로 나뉜다.

![Stream 중간 연산 분류와 특성](/assets/posts/java-stream-intermediate-ops.svg)

Stateless 연산은 현재 원소만 보고 독립적으로 처리하므로 병렬 스트림에서도 성능이 좋다. Stateful 연산은 이전 원소를 알아야 하기 때문에 전체 버퍼링이 필요하거나 스레드 간 동기화가 필요하다.

## filter — 조건 필터링

```java
List<Integer> nums = List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

// 짝수만
List<Integer> evens = nums.stream()
    .filter(n -> n % 2 == 0)
    .toList(); // [2, 4, 6, 8, 10]

// 여러 조건 조합
List<String> words = List.of("apple", "banana", "avocado", "cherry");
words.stream()
     .filter(s -> s.startsWith("a"))
     .filter(s -> s.length() > 5)
     .toList(); // [avocado]

// Predicate.not으로 부정
words.stream()
     .filter(Predicate.not(String::isEmpty))
     .toList();
```

## map — 원소 변환

`map()`은 `Function<T, R>`을 받아 원소를 다른 타입이나 값으로 변환한다.

```java
List<String> names = List.of("alice", "bob", "charlie");

// 대문자 변환
List<String> upper = names.stream()
    .map(String::toUpperCase)
    .toList(); // [ALICE, BOB, CHARLIE]

// 길이 추출
List<Integer> lengths = names.stream()
    .map(String::length)
    .toList(); // [5, 3, 7]

// 객체 변환
record Person(String name, int age) {}

List<String> result = people.stream()
    .map(Person::name)
    .toList();
```

기본 타입으로 변환할 때는 `mapToInt`, `mapToLong`, `mapToDouble`을 사용해 박싱 비용을 제거한다.

```java
int totalAge = people.stream()
    .mapToInt(Person::age)
    .sum(); // 박싱 없이 합산
```

## flatMap — 스트림 평탄화

`flatMap()`은 원소를 `Stream<R>`으로 변환한 뒤 그 스트림들을 하나의 스트림으로 합친다. `Stream<Stream<R>>`을 `Stream<R>`로 만드는 연산이다.

![flatMap 동작 원리](/assets/posts/java-stream-intermediate-flatmap.svg)

```java
// 각 문장을 단어로 분리
List<String> sentences = List.of("hello world", "java stream");
List<String> words = sentences.stream()
    .flatMap(s -> Arrays.stream(s.split(" ")))
    .toList(); // [hello, world, java, stream]

// 중첩 리스트 펼치기
List<List<Integer>> nested = List.of(
    List.of(1, 2), List.of(3, 4), List.of(5, 6)
);
List<Integer> flat = nested.stream()
    .flatMap(Collection::stream)
    .toList(); // [1, 2, 3, 4, 5, 6]
```

`flatMapToInt`, `flatMapToLong`, `flatMapToDouble`도 있다.

## distinct / sorted

```java
List<Integer> duped = List.of(3, 1, 4, 1, 5, 9, 2, 6, 5, 3);

// 중복 제거 (equals/hashCode 기반)
duped.stream().distinct().toList(); // [3, 1, 4, 5, 9, 2, 6]

// 자연 순서 정렬
duped.stream().sorted().toList(); // [1, 1, 2, 3, 3, 4, 5, 5, 6, 9]

// 커스텀 정렬
List<String> words = List.of("banana", "apple", "cherry");
words.stream()
     .sorted(Comparator.comparingInt(String::length))
     .toList(); // [apple, banana, cherry]

// 역순
words.stream()
     .sorted(Comparator.reverseOrder())
     .toList(); // [cherry, banana, apple]
```

## limit / skip

```java
List<Integer> nums = List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

// 앞 3개만
nums.stream().limit(3).toList(); // [1, 2, 3]

// 앞 3개 건너뛰기
nums.stream().skip(3).toList(); // [4, 5, 6, 7, 8, 9, 10]

// 페이지네이션 패턴 (페이지 2, 페이지당 3개)
int page = 2, size = 3;
nums.stream()
    .skip((long)(page - 1) * size)
    .limit(size)
    .toList(); // [4, 5, 6]
```

## takeWhile / dropWhile (Java 9+)

정렬된 스트림에서 조건이 깨지는 시점을 기준으로 분리한다.

```java
List<Integer> sorted = List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

// 조건이 true인 동안만 통과 (5를 만나면 중단)
sorted.stream()
      .takeWhile(n -> n < 5)
      .toList(); // [1, 2, 3, 4]

// 조건이 false가 된 시점부터 통과
sorted.stream()
      .dropWhile(n -> n < 5)
      .toList(); // [5, 6, 7, 8, 9, 10]
```

정렬되지 않은 스트림에서는 결과가 구현에 따라 다를 수 있다.

## peek — 중간 관찰

파이프라인 중간에 원소를 확인할 때 사용한다. 주로 **디버깅 목적**이다.

```java
List<String> result = words.stream()
    .filter(s -> s.length() > 4)
    .peek(s -> System.out.println("filter 통과: " + s))
    .map(String::toUpperCase)
    .peek(s -> System.out.println("map 결과: " + s))
    .toList();
```

`peek`은 사이드이펙트 전용이다. 데이터를 수정하거나 업무 로직에 사용하면 안 된다. 특히 병렬 스트림에서는 호출 순서가 보장되지 않는다.

## mapMulti (Java 16+)

`flatMap`의 대안으로 Consumer 기반 push 방식을 사용한다. Consumer를 통해 원소를 하나씩 밀어 넣어 중간 스트림 객체를 생성하지 않으므로 성능이 유리할 수 있다.

```java
List<Integer> result = List.of(1, 2, 3).stream()
    .<Integer>mapMulti((n, consumer) -> {
        consumer.accept(n);
        consumer.accept(n * 10);
    })
    .toList(); // [1, 10, 2, 20, 3, 30]
```

---

**지난 글:** [Stream 생성 — of·iterate·generate·Builder·파일·정규식](/posts/java-stream-creation/)

**다음 글:** [Stream 종료 연산 — collect·reduce·forEach·count·find·match](/posts/java-stream-terminal/)

<br>
읽어주셔서 감사합니다. 😊
