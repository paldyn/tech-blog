---
title: "Stream 주의사항 — 흔한 함정 8가지와 해결책"
description: "Java Stream 실무에서 자주 만나는 함정 — 스트림 재사용 IllegalStateException, forEach 사이드 이펙트, 무한 스트림 limit 누락, 지연 실행 오해, 병렬 스트림 공유 상태, Optional.get() 무검증, checked exception 처리, 과도한 체이닝"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "pitfalls", "IllegalStateException", "사이드이펙트", "무한스트림", "병렬스트림"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-parallel/)에서 병렬 스트림의 동작 원리를 살펴봤다. 스트림은 강력하지만 잘못 사용하면 런타임 예외, 데이터 유실, 성능 저하로 이어진다. 이번 글에서는 실무에서 자주 만나는 **8가지 함정**을 구체적인 예제와 함께 정리한다.

## 함정 1 — 스트림 재사용 (IllegalStateException)

스트림은 **한 번 소비하면 재사용 불가**다.

```java
Stream<String> stream = list.stream()
    .filter(s -> s.length() > 3);

// 첫 번째 사용
long count = stream.count(); // OK

// 두 번째 사용 시도
List<String> result = stream.collect(toList()); // IllegalStateException!
// java.lang.IllegalStateException: stream has already been operated upon or closed
```

![Stream 재사용 오류와 해결책](/assets/posts/java-stream-pitfalls-reuse.svg)

**해결책**: 매번 새 스트림을 생성하거나, `Supplier<Stream<T>>` 패턴을 쓴다.

```java
// 패턴 1: 매번 새 스트림
long count = list.stream().filter(p).count();
List<String> result = list.stream().filter(p).collect(toList());

// 패턴 2: Supplier로 팩토리 제공
Supplier<Stream<String>> streamFactory = () -> list.stream().filter(p);
long count = streamFactory.get().count();
List<String> result = streamFactory.get().collect(toList());
```

## 함정 2 — forEach 사이드 이펙트

```java
// 잘못된 예: 외부 리스트에 add()하는 forEach
List<String> result = new ArrayList<>();
list.stream()
    .filter(s -> s.startsWith("A"))
    .forEach(result::add);  // 가변 공유 상태 수정 — 병렬 시 문제

// 올바른 예: collect()로 수집
List<String> result = list.stream()
    .filter(s -> s.startsWith("A"))
    .collect(toList());
```

`forEach`는 부수 효과가 없는 로깅, 출력처럼 **소비(consume)** 목적에만 쓴다. 컬렉션 구성은 `collect()`를 사용한다.

## 함정 3 — 무한 스트림 종료 조건 누락

```java
// iterate는 무한 스트림 생성
Stream.iterate(0, n -> n + 1)     // 0, 1, 2, 3, ...
    .filter(n -> n % 2 == 0)
    .collect(toList());            // 영원히 실행됨!

// limit()으로 반드시 종료
List<Integer> evens = Stream.iterate(0, n -> n + 1)
    .filter(n -> n % 2 == 0)
    .limit(10)                     // 처음 10개만
    .collect(toList());

// Java 9+ takeWhile
Stream.iterate(0, n -> n + 1)
    .takeWhile(n -> n < 20)        // 20 미만 동안
    .collect(toList());
```

## 함정 4 — 중간 연산의 지연 실행

```java
// 중간 연산만으로는 아무것도 실행되지 않음
Stream<String> filtered = list.stream()
    .filter(s -> {
        System.out.println("filter: " + s); // 이 시점엔 출력 안 됨
        return s.length() > 3;
    });
// 여기까지 아무 출력 없음

// 종료 연산이 있어야 실행됨
List<String> result = filtered.collect(toList()); // 이제 출력됨
```

디버깅 시 `filter`나 `map` 안에 로그를 찍어도 출력이 없다면 종료 연산을 확인하자.

## 함정 5 — 병렬 스트림 + 공유 가변 상태

```java
// 잘못된 예: ArrayList는 스레드 안전하지 않음
List<Integer> nums = new ArrayList<>();
IntStream.range(0, 10_000)
    .parallel()
    .forEach(nums::add);  // 데이터 유실 또는 예외 발생

// 올바른 예 1: collect() 사용
List<Integer> safe = IntStream.range(0, 10_000)
    .parallel()
    .boxed()
    .collect(toList());

// 올바른 예 2: ConcurrentHashMap 또는 Atomic 사용
AtomicInteger counter = new AtomicInteger(0);
IntStream.range(0, 10_000)
    .parallel()
    .forEach(n -> counter.incrementAndGet());
```

## 함정 6 — Optional.get() 무검증 호출

```java
// 잘못된 예
Optional<String> opt = list.stream()
    .filter(s -> s.startsWith("Z"))
    .findFirst();

String value = opt.get(); // NoSuchElementException if empty!

// 올바른 예
String value = opt.orElse("기본값");
String value2 = opt.orElseGet(() -> computeDefault());
opt.ifPresent(v -> System.out.println("Found: " + v));

// Java 10+
String value3 = opt.orElseThrow(() ->
    new IllegalStateException("Z로 시작하는 값 없음"));
```

## 함정 7 — Checked Exception 처리

람다는 기본적으로 체크 예외를 선언할 수 없다.

```java
// 컴파일 오류: IOException은 checked exception
list.stream()
    .map(path -> Files.readString(Path.of(path))) // 컴파일 오류!
    .collect(toList());

// 해결책 1: try-catch 래핑
list.stream()
    .map(path -> {
        try {
            return Files.readString(Path.of(path));
        } catch (IOException e) {
            throw new UncheckedIOException(e);  // unchecked로 변환
        }
    })
    .collect(toList());

// 해결책 2: 헬퍼 메서드
static <T, R> Function<T, R> wrap(ThrowingFunction<T, R> fn) {
    return t -> {
        try { return fn.apply(t); }
        catch (Exception e) { throw new RuntimeException(e); }
    };
}
list.stream().map(wrap(path -> Files.readString(Path.of(path)))).collect(toList());
```

## 함정 8 — 과도한 스트림 체이닝

```java
// 너무 긴 체이닝 — 디버깅 매우 어려움
List<String> result = input.stream()
    .filter(Objects::nonNull)
    .map(String::trim)
    .filter(s -> !s.isEmpty())
    .flatMap(s -> Arrays.stream(s.split(",")))
    .map(String::toLowerCase)
    .distinct()
    .sorted()
    .filter(s -> s.length() >= 2)
    .limit(50)
    .collect(toList());

// 중간 변수로 분리하면 디버깅 용이
Stream<String> nonEmpty = input.stream()
    .filter(Objects::nonNull)
    .map(String::trim)
    .filter(s -> !s.isEmpty());

List<String> result = nonEmpty
    .flatMap(s -> Arrays.stream(s.split(",")))
    .map(String::toLowerCase)
    .distinct()
    .sorted()
    .filter(s -> s.length() >= 2)
    .limit(50)
    .collect(toList());
```

![Stream 주요 함정 목록](/assets/posts/java-stream-pitfalls-list.svg)

## 디버깅 팁 — peek()

```java
list.stream()
    .filter(s -> s.length() > 3)
    .peek(s -> System.out.println("after filter: " + s))  // 중간 값 출력
    .map(String::toUpperCase)
    .peek(s -> System.out.println("after map: " + s))
    .collect(toList());
```

`peek()`은 중간 연산이므로 스트림을 소비하지 않는다. 프로덕션 코드에 남기지 않도록 주의한다.

---

**지난 글:** [Stream 병렬 처리 — parallelStream과 ForkJoin 풀](/posts/java-stream-parallel/)

**다음 글:** [Stream vs for 루프 — 언제 무엇을 쓸까](/posts/java-stream-vs-loop/)

<br>
읽어주셔서 감사합니다. 😊
