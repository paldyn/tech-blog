---
title: "Stream 생성 — of·iterate·generate·Builder·파일·정규식"
description: "Stream 생성의 모든 방법 — collection.stream()·Arrays.stream()·Stream.of()·ofNullable()·empty(), 무한 스트림 iterate와 generate, Java 9의 iterate 종료 조건, Files.lines·Pattern.splitAsStream·String.chars, Stream.Builder와 concat까지"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "iterate", "generate", "Files.lines", "ofNullable", "IntStream.range"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-overview/)에서 Stream 파이프라인 구조와 지연 평가를 살펴봤다. 이번에는 **Stream을 어떻게 만드는지** — 다양한 소스에서 스트림을 생성하는 모든 방법을 정리한다.

## 컬렉션과 배열에서 생성

가장 일반적인 스트림 생성 방법이다.

```java
List<String> list = List.of("a", "b", "c");
Stream<String> seq = list.stream();           // 순차 스트림
Stream<String> par = list.parallelStream();   // 병렬 스트림

int[] arr = {1, 2, 3, 4, 5};
IntStream intStream = Arrays.stream(arr);           // IntStream (박싱 없음)
IntStream rangeStream = Arrays.stream(arr, 1, 4);   // 인덱스 1~3만
```

`Set`, `Map.values()`, `Map.keySet()`, `Map.entrySet()` 등 `Collection` 구현체라면 모두 `.stream()`을 호출할 수 있다.

## 정적 팩토리 — Stream.of / empty / ofNullable

```java
// 원소 나열
Stream<String> s1 = Stream.of("x", "y", "z");

// 빈 스트림
Stream<String> empty = Stream.empty();

// null 안전 (Java 9+)
String maybeNull = getValueOrNull();
Stream<String> s2 = Stream.ofNullable(maybeNull);
// null이면 빈 스트림, 아니면 원소 1개짜리 스트림
```

`Stream.ofNullable()`은 `flatMap`과 결합할 때 특히 유용하다.

```java
// null 값이 섞인 리스트에서 null 제거
List<String> result = names.stream()
    .flatMap(Stream::ofNullable)
    .toList();
```

![Stream 생성 방법 전체 정리](/assets/posts/java-stream-creation-sources.svg)

## 정수 범위 — IntStream.range / rangeClosed

```java
// 0 이상 10 미만 (10 제외)
IntStream.range(0, 10).forEach(i -> System.out.print(i + " "));
// 0 1 2 3 4 5 6 7 8 9

// 1 이상 5 이하 (5 포함)
int sum = IntStream.rangeClosed(1, 5).sum(); // 15

// for 루프 대체: 0~99까지 처리
IntStream.range(0, 100)
         .filter(i -> i % 7 == 0)
         .forEach(System.out::println);
```

## 무한 스트림 — iterate와 generate

![iterate · generate · ofNullable · Builder 코드](/assets/posts/java-stream-creation-code.svg)

### Stream.iterate

```java
// Java 8: 시드 + 누적 함수 (무한, limit 필수)
Stream.iterate(1, n -> n * 2)
      .limit(10)
      .forEach(System.out::println); // 1, 2, 4, 8, ..., 512

// Java 9: 종료 조건 추가 (for 루프와 동일한 의미)
// iterate(init; hasNext; next)
Stream.iterate(1, n -> n <= 1000, n -> n * 2)
      .toList(); // [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
```

### Stream.generate

`Supplier<T>`를 무한히 호출해 원소를 생성한다. 상태 없이 같은 값을 반복하거나 랜덤 값을 생성할 때 사용한다.

```java
// 상수 무한 스트림
Stream.generate(() -> "hello").limit(3).toList(); // ["hello", "hello", "hello"]

// 랜덤 UUID 5개
List<UUID> ids = Stream.generate(UUID::randomUUID).limit(5).toList();

// Random 클래스의 전용 메서드
List<Integer> randoms = new Random().ints(5, 1, 100)
                                    .boxed()
                                    .toList(); // 1~99 범위 난수 5개
```

## 파일과 I/O

`Files.lines()`는 파일을 줄 단위로 읽는 스트림을 반환한다. 스트림이 닫히면 파일 핸들도 닫히므로 `try-with-resources`를 사용한다.

```java
try (Stream<String> lines = Files.lines(Path.of("data.csv"))) {
    long count = lines
        .filter(l -> !l.startsWith("#"))  // 주석 제거
        .count();
    System.out.println("데이터 행: " + count);
}

// 디렉토리 목록
try (Stream<Path> entries = Files.list(Path.of("/tmp"))) {
    entries.filter(p -> p.toString().endsWith(".log"))
           .forEach(System.out::println);
}
```

## 문자열과 정규식

```java
// 문자 코드포인트 스트림
"Hello".chars() // IntStream: 72, 101, 108, 108, 111
       .filter(Character::isUpperCase)
       .count(); // 1

// 정규식으로 분할
Pattern.compile("[,;\\s]+")
       .splitAsStream("a, b;c d")
       .toList(); // ["a", "b", "c", "d"]
```

## Stream.Builder

원소를 동적으로 추가한 뒤 스트림으로 변환한다. 원소 수를 미리 알 수 없을 때 유용하다.

```java
Stream.Builder<String> builder = Stream.builder();
builder.add("first");
if (condition) builder.add("second");
builder.add("last");

Stream<String> stream = builder.build();
// build() 호출 후 추가 시도 → IllegalStateException
```

## Stream.concat — 두 스트림 이어붙이기

```java
Stream<String> a = Stream.of("x", "y");
Stream<String> b = Stream.of("1", "2", "3");

Stream<String> merged = Stream.concat(a, b);
// ["x", "y", "1", "2", "3"]
```

세 개 이상을 이어붙일 때는 `Stream.concat`을 중첩하면 깊은 파이프라인 트리가 생겨 성능에 불리할 수 있다. 그보다는 `flatMap`이 더 효율적이다.

```java
// 여러 리스트 합치기
List<List<String>> listOfLists = List.of(a, b, c);
Stream<String> combined = listOfLists.stream().flatMap(Collection::stream);
```

## Optional.stream()

Java 9에서 추가됐다. `flatMap`과 함께 Optional을 포함한 리스트에서 값만 추출할 때 편리하다.

```java
List<Optional<String>> optionals = List.of(
    Optional.of("hello"), Optional.empty(), Optional.of("world")
);

List<String> present = optionals.stream()
    .flatMap(Optional::stream)
    .toList(); // ["hello", "world"]
```

---

**지난 글:** [Stream API 개요 — 파이프라인 구조와 지연 평가](/posts/java-stream-overview/)

**다음 글:** [Stream 중간 연산 — filter·map·flatMap·distinct·sorted·peek](/posts/java-stream-intermediate/)

<br>
읽어주셔서 감사합니다. 😊
