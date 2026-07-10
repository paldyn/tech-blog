---
title: "Stream API 개요 — 파이프라인 구조와 지연 평가"
description: "Java 8 Stream API의 소스·중간 연산·종료 연산으로 이루어진 파이프라인 구조, 지연 평가(lazy evaluation)와 단락 평가(short-circuit), Stateless vs Stateful 중간 연산 차이, IntStream·LongStream·DoubleStream 기본 타입 특화 스트림"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "람다", "함수형", "지연평가", "파이프라인", "IntStream"]
featured: false
draft: false
---

[지난 글](/posts/java-collection-best-practices/)에서 컬렉션 모범 사례를 정리했다. 이번부터는 **Stream API** 시리즈를 시작한다. Stream은 Java 8의 가장 큰 변화 중 하나로, 컬렉션 데이터를 선언적으로 처리하는 파이프라인 모델을 제공한다.

## Stream이란

`java.util.stream.Stream<T>`는 데이터 원소의 **연속적인 흐름**이다. 컬렉션과 달리 데이터를 직접 저장하지 않는다. 소스(컬렉션, 배열, I/O 채널 등)에서 데이터를 읽어 일련의 연산을 파이프라인으로 처리한다.

핵심 특성 세 가지:
1. **지연 평가(lazy)**: 종료 연산이 호출될 때까지 중간 연산은 실행되지 않는다.
2. **1회 소비**: 종료 연산이 실행된 스트림은 재사용할 수 없다.
3. **내부 반복**: `for-each` 루프처럼 호출자가 반복을 제어하지 않고 스트림 내부에서 처리한다.

## 파이프라인 구조

Stream 파이프라인은 세 단계로 구성된다.

```text
소스 → 중간 연산 (0개 이상) → 종료 연산 (정확히 1개)
```

```java
List<String> result = List.of("banana", "apple", "cherry", "avocado")
    .stream()               // 소스
    .filter(s -> s.startsWith("a"))  // 중간 연산 1
    .map(String::toUpperCase)        // 중간 연산 2
    .sorted()                        // 중간 연산 3
    .toList();              // 종료 연산

// result: ["APPLE", "AVOCADO"]
```

![Stream 파이프라인 구조](/assets/posts/java-stream-overview-pipeline.svg)

## 지연 평가의 의미

중간 연산은 **새 Stream을 반환**하고 즉시 아무것도 실행하지 않는다. 종료 연산이 호출되는 순간 파이프라인 전체가 실행된다.

```java
Stream<String> stream = List.of("a", "bb", "ccc", "dddd")
    .stream()
    .filter(s -> {
        System.out.println("filter: " + s);
        return s.length() > 1;
    })
    .map(s -> {
        System.out.println("map: " + s);
        return s.toUpperCase();
    });

// 여기까지 아무 출력 없음
System.out.println("--- 종료 연산 호출 ---");
List<String> result = stream.toList();
// 이제 filter, map이 실행됨
```

출력 순서는 `filter:a → filter:bb → map:bb → filter:ccc → map:ccc → ...`처럼 **원소 단위로** 처리된다. 중간 연산별로 배치 처리하지 않는다.

## 단락 평가(Short-circuit)

일부 종료·중간 연산은 모든 원소를 처리하지 않고 일찍 종료할 수 있다.

```java
List<Integer> nums = List.of(1, 5, 2, 8, 3, 9, 4);

// 5보다 큰 첫 번째 원소 찾기 (뒤는 처리 안 함)
Optional<Integer> first = nums.stream()
    .filter(n -> n > 5)
    .findFirst(); // 8 발견 후 즉시 종료

// 하나라도 음수가 있는지 확인 (찾으면 중단)
boolean hasNeg = nums.stream().anyMatch(n -> n < 0); // false
```

단락 평가 지원 메서드: `findFirst`, `findAny`, `anyMatch`, `allMatch`, `noneMatch`, `limit`

## Stateless vs Stateful 중간 연산

```java
// Stateless: 각 원소를 독립적으로 처리
stream.filter(s -> s.length() > 2)   // 현재 원소만 봄
      .map(String::toLowerCase)       // 현재 원소만 변환

// Stateful: 모든 원소(또는 상당 부분)를 봐야 함
stream.sorted()      // 전체 버퍼링 필요
      .distinct()    // 이전 원소 기억 필요 (HashSet 유지)
      .limit(5)      // 카운터 상태 유지
```

Stateful 연산은 병렬 스트림에서 성능 병목이 될 수 있다. 특히 `sorted()`는 병렬로 실행해도 최종 합병에서 모든 원소를 봐야 한다.

## Stream 타입 계층과 기본 타입 특화

![Stream 타입 계층](/assets/posts/java-stream-overview-types.svg)

기본 타입을 `Stream<Integer>` 대신 `IntStream`으로 처리하면 **오토박싱/언박싱 비용**을 제거할 수 있다.

```java
// Stream<Integer>: Integer 객체 생성 발생
int sum1 = List.of(1, 2, 3, 4, 5)
               .stream()
               .mapToInt(Integer::intValue) // IntStream으로 전환
               .sum();

// IntStream.range: 0부터 9까지 (9 미포함)
IntStream.range(0, 10).forEach(System.out::println);

// IntStream.rangeClosed: 1부터 5까지 (5 포함)
int total = IntStream.rangeClosed(1, 5).sum(); // 15
```

기본 타입 스트림 전환 메서드:
- `mapToInt(ToIntFunction)` → `IntStream`
- `mapToLong(ToLongFunction)` → `LongStream`
- `mapToDouble(ToDoubleFunction)` → `DoubleStream`
- `boxed()` / `mapToObj(IntFunction)` → `Stream<T>` 로 복귀

## Stream vs for 루프

| 항목 | Stream | for 루프 |
|------|--------|---------|
| 가독성 | 선언적, 의도 명확 | 절차적, 상세 |
| 디버깅 | 상대적으로 어려움 | 브레이크포인트 쉬움 |
| 병렬화 | `.parallel()` 한 줄 | 직접 구현 복잡 |
| 성능 | 오버헤드 존재 (작은 컬렉션은 루프가 빠름) | 최소 오버헤드 |
| null 처리 | `Optional` 활용 | if 문 |
| 재사용 | 1회 소비 | 반복 가능 |

수백만 건 이상이거나 병렬 처리가 필요한 경우 Stream이 유리하다. 단순 반복이나 성능 임계 경로에서는 for 루프가 나을 수 있다.

## 1회 소비 원칙

```java
Stream<String> stream = list.stream();
stream.forEach(System.out::println); // OK

stream.forEach(System.out::println); // IllegalStateException: stream has already been operated upon or closed
```

스트림을 재사용해야 하면 `Supplier<Stream<T>>`로 감싸거나 소스에서 새 스트림을 생성한다.

```java
Supplier<Stream<String>> supplier = list::stream;
supplier.get().filter(...).count();  // 호출마다 새 스트림
supplier.get().map(...).toList();
```

---

**지난 글:** [컬렉션 프레임워크 모범 사례 — 선택·초기화·성능·안전](/posts/java-collection-best-practices/)

**다음 글:** [Stream 생성 — of·iterate·generate·Builder·파일·정규식](/posts/java-stream-creation/)

<br>
읽어주셔서 감사합니다. 😊
