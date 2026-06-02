---
title: "Stream 종료 연산 — collect·reduce·forEach·count·find·match"
description: "Stream 종료 연산 전체 — collect(Collectors.*)·toList(), reduce의 identity/Optional 형태 차이, count·min·max·sum·average·summaryStatistics, findFirst·findAny와 Optional 반환, anyMatch·allMatch·noneMatch 단락 평가, forEach·forEachOrdered·toArray"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "collect", "reduce", "forEach", "findFirst", "anyMatch", "summaryStatistics"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-intermediate/)에서 Stream 중간 연산을 살펴봤다. 이번에는 파이프라인을 실제로 **실행시키는 종료 연산(Terminal Operation)** 을 다룬다. 종료 연산이 호출되는 순간 지연됐던 모든 중간 연산이 실행된다.

## 종료 연산의 공통 특성

종료 연산은 두 가지 특성을 갖는다.

1. **파이프라인 트리거**: 중간 연산은 종료 연산이 없으면 실행되지 않는다.
2. **스트림 소비**: 종료 연산 후 같은 스트림을 다시 쓸 수 없다.

![Stream 종료 연산 분류](/assets/posts/java-stream-terminal-overview.svg)

## reduce — 누적 집계

`reduce()`는 스트림 원소를 하나의 값으로 누적한다. BinaryOperator를 사용해 이전 누적값과 현재 원소를 결합한다.

```java
List<Integer> nums = List.of(1, 2, 3, 4, 5);

// identity 있음: 빈 스트림이면 identity 반환
int sum = nums.stream().reduce(0, Integer::sum);       // 15
int product = nums.stream().reduce(1, (a, b) -> a * b); // 120

// identity 없음: Optional 반환 (빈 스트림 고려)
Optional<Integer> max = nums.stream().reduce(Integer::max); // Optional.of(5)
```

![reduce 동작 원리와 종료 연산 코드](/assets/posts/java-stream-terminal-reduce.svg)

## collect — 컬렉션으로 수집

가장 유연한 종료 연산이다. `Collector` 구현에 따라 다양한 결과를 만들 수 있다.

```java
List<String> words = List.of("banana", "apple", "cherry", "avocado");

// 리스트로 수집 (가변)
List<String> list = words.stream()
    .filter(s -> s.length() > 5)
    .collect(Collectors.toList());

// 불변 리스트 (Java 16+)
List<String> immutable = words.stream()
    .filter(s -> s.startsWith("a"))
    .toList();

// Set으로 수집 (중복 제거)
Set<String> set = words.stream()
    .collect(Collectors.toSet());

// 문자열로 합치기
String joined = words.stream()
    .collect(Collectors.joining(", ", "[", "]"));
// [banana, apple, cherry, avocado]

// Map으로 수집
Map<String, Integer> lengthMap = words.stream()
    .collect(Collectors.toMap(
        w -> w,           // 키
        String::length    // 값
    ));
```

`toList()`(Java 16)는 null 원소를 허용하고 불변이다. `Collectors.toUnmodifiableList()`(Java 10)는 null 원소를 허용하지 않는다.

## count / min / max

```java
List<String> words = List.of("hi", "hello", "world", "java");

long count = words.stream()
    .filter(s -> s.length() > 3)
    .count(); // 3

Optional<String> shortest = words.stream()
    .min(Comparator.comparingInt(String::length)); // Optional.of("hi")

Optional<String> longest = words.stream()
    .max(Comparator.comparingInt(String::length)); // Optional.of("hello") or "world"
```

## IntStream 통계 메서드

`IntStream`, `LongStream`, `DoubleStream`에는 집계 전용 메서드가 있다.

```java
int[] arr = {3, 1, 4, 1, 5, 9, 2, 6};

int sum = Arrays.stream(arr).sum();              // 31
OptionalDouble avg = Arrays.stream(arr).average(); // 3.875
OptionalInt min = Arrays.stream(arr).min();      // 1
OptionalInt max = Arrays.stream(arr).max();      // 9

// summaryStatistics — 한 번의 순회로 모든 통계
IntSummaryStatistics stats = Arrays.stream(arr).summaryStatistics();
System.out.println(stats.getCount()); // 8
System.out.println(stats.getSum());   // 31
System.out.println(stats.getMin());   // 1
System.out.println(stats.getMax());   // 9
System.out.println(stats.getAverage()); // 3.875
```

## findFirst / findAny

```java
List<Integer> nums = List.of(1, 5, 2, 8, 3, 9);

// 5보다 큰 첫 번째 원소 (순차 스트림에서 순서 보장)
Optional<Integer> first = nums.stream()
    .filter(n -> n > 5)
    .findFirst(); // Optional.of(8)

// 병렬 스트림에서는 어떤 원소든 빠르게 찾음
Optional<Integer> any = nums.parallelStream()
    .filter(n -> n > 5)
    .findAny(); // 8 또는 9 (비결정적)
```

`findFirst`는 순차 스트림에서 항상 파이프라인 순서의 첫 번째를 반환한다. 병렬 스트림에서는 `findAny`가 더 빠르다.

## anyMatch / allMatch / noneMatch

세 메서드는 모두 단락 평가를 지원한다. 조건이 확정되는 즉시 나머지 원소 처리를 멈춘다.

```java
List<Integer> nums = List.of(2, 4, 6, 8, 10);

boolean hasEven = nums.stream().anyMatch(n -> n % 2 == 0);  // true (첫 원소에서 종료)
boolean allEven = nums.stream().allMatch(n -> n % 2 == 0);  // true
boolean noNeg   = nums.stream().noneMatch(n -> n < 0);      // true

// 빈 스트림
Stream.empty().anyMatch(x -> true);  // false
Stream.empty().allMatch(x -> false); // true  (vacuously true)
Stream.empty().noneMatch(x -> true); // true
```

## forEach / forEachOrdered

```java
List<String> list = List.of("a", "b", "c");

// 순차 스트림: 삽입 순서대로
list.stream().forEach(System.out::println); // a, b, c

// 병렬 스트림: 순서 미보장
list.parallelStream().forEach(System.out::println); // 임의 순서

// 병렬에서도 순서 보장 (성능 저하 감수)
list.parallelStream().forEachOrdered(System.out::println); // a, b, c
```

`forEach`는 업무 로직보다 출력이나 외부 상태 업데이트에 사용한다. 람다 내부에서 변수를 수정하면 effectively final 규칙을 위반하므로 `AtomicInteger` 같은 변경 가능 컨테이너를 써야 한다.

## toArray

```java
List<String> words = List.of("a", "b", "c");

// Object[]
Object[] objArr = words.stream().toArray();

// 타입 지정 (배열 생성자 참조)
String[] strArr = words.stream().toArray(String[]::new);

// 기본 타입 배열
int[] intArr = IntStream.range(0, 5).toArray(); // [0, 1, 2, 3, 4]
```

## iterator — 외부 반복이 필요할 때

스트림 API로 처리하기 어려운 복잡한 반복 로직이 필요하면 `iterator()`로 Iterator를 얻을 수 있다.

```java
Iterator<String> it = words.stream()
    .filter(s -> s.length() > 2)
    .iterator();

while (it.hasNext()) {
    String word = it.next();
    // 복잡한 로직
}
```

단, `iterator()` 호출 후 스트림은 소비된 상태다.

---

**지난 글:** [Stream 중간 연산 — filter·map·flatMap·distinct·sorted·peek](/posts/java-stream-intermediate/)

**다음 글:** [Stream Collectors — joining·groupingBy·partitioningBy·toMap](/posts/java-stream-collectors/)

<br>
읽어주셔서 감사합니다. 😊
