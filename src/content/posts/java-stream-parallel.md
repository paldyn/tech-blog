---
title: "Stream 병렬 처리 — parallelStream과 ForkJoin 풀"
description: "Java 병렬 스트림의 내부 구조 — ForkJoinPool.commonPool 동작 원리, 병렬화 효과가 큰 조건과 역효과 조건, 커스텀 ForkJoinPool로 격리 실행, 공유 상태·순서 의존 연산의 위험성, JMH 벤치마크로 성능 검증"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "parallel", "ForkJoin", "병렬스트림", "parallelStream", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-flatmap/)에서 `flatMap`으로 중첩 스트림을 평탄화하는 법을 익혔다. 이번에는 스트림의 병렬 처리, 즉 **`parallel()`** 와 **`parallelStream()`** 을 다룬다. 단 한 글자 추가로 멀티코어를 활용할 수 있다는 매력이 있지만, 잘못 쓰면 오히려 성능이 나빠지거나 오류가 생긴다.

## 병렬 스트림 생성

```java
// 컬렉션에서 직접
List<Integer> nums = List.of(1, 2, 3, 4, 5, 6, 7, 8);
nums.parallelStream()           // 병렬 스트림
    .map(n -> n * 2)
    .forEach(System.out::println);

// 기존 순차 스트림을 병렬로 전환
long count = IntStream.rangeClosed(1, 1_000_000)
    .parallel()                 // 병렬 전환
    .filter(n -> n % 2 == 0)
    .count();

// 병렬에서 다시 순차로
Stream<String> seq = list.parallelStream()
    .filter(s -> s.length() > 3)
    .sequential();              // 순차로 전환
```

## ForkJoin 풀 내부 동작

![ForkJoin 풀 동작 구조](/assets/posts/java-stream-parallel-forkjoin.svg)

병렬 스트림은 내부적으로 **`ForkJoinPool.commonPool()`** 을 사용한다.

1. **Fork(분할)**: `Spliterator`가 데이터를 균등하게 분할
2. **병렬 처리**: 각 Worker 스레드가 독립적으로 서브태스크 실행
3. **Join(병합)**: partial 결과를 combiner로 합산

기본 스레드 수는 `Runtime.getRuntime().availableProcessors() - 1`이다. 8코어 CPU라면 7개의 Worker 스레드가 생긴다.

```java
// 현재 환경의 병렬 스트림 스레드 수 확인
int parallelism = ForkJoinPool.commonPool().getParallelism();
System.out.println("Parallelism: " + parallelism);
```

## 병렬화 효과 조건

![병렬 스트림 성능 향상 조건](/assets/posts/java-stream-parallel-conditions.svg)

### 효과가 큰 경우

- **데이터 크기**: 수만 건 이상 (Fork/Join 오버헤드를 상회하는 이득)
- **CPU 집약적 연산**: 소수 판별, 암호화, 복잡한 수치 계산
- **분할 비용이 낮은 자료구조**: `ArrayList`, 배열, `IntStream.range()` 등
- **요소 독립성**: 각 요소 처리가 다른 요소 상태에 의존하지 않음

### 역효과가 나는 경우

```java
// 잘못된 예: 공유 가변 상태 (경쟁 조건 발생)
List<Integer> result = new ArrayList<>();
IntStream.range(0, 100)
    .parallel()
    .forEach(result::add);  // ConcurrentModificationException 또는 데이터 유실!

// 올바른 예: collect()로 수집
List<Integer> safe = IntStream.range(0, 100)
    .parallel()
    .boxed()
    .collect(toList());  // 스레드 안전
```

I/O 대기 작업은 commonPool 스레드를 블로킹으로 점유해서 앱 전체 처리량을 낮춘다. DB 조회, 파일 읽기가 포함된 파이프라인에는 병렬 스트림을 쓰지 않는다.

## 커스텀 ForkJoinPool로 격리

I/O 작업이 포함된 경우나 스레드 수를 직접 제어하고 싶다면 별도 풀을 만들어 격리할 수 있다.

```java
ForkJoinPool customPool = new ForkJoinPool(4);
try {
    List<String> result = customPool.submit(() ->
        list.parallelStream()
            .filter(s -> someExpensiveOp(s))
            .collect(toList())
    ).get();
} finally {
    customPool.shutdown();
}
```

이렇게 하면 commonPool을 오염시키지 않고 전용 스레드 풀에서 병렬 작업이 실행된다.

## 순서 의존 연산 주의

병렬 스트림에서 순서가 중요한 연산은 오버헤드가 생긴다.

```java
// findFirst — 병렬에서도 순서를 보장하므로 오버헤드 발생
Optional<String> first = list.parallelStream()
    .filter(s -> s.startsWith("A"))
    .findFirst();   // 순서 보장이 필요 → 병렬 이득 감소

// findAny — 순서 불필요, 병렬에서 더 빠름
Optional<String> any = list.parallelStream()
    .filter(s -> s.startsWith("A"))
    .findAny();    // 어느 스레드든 먼저 찾은 것 반환 → 빠름

// forEachOrdered — 순서 보장, 병렬 이득 거의 없음
list.parallelStream().forEachOrdered(System.out::println);
```

## 성능 측정은 JMH로

직관만으로 병렬이 빠를 거라고 가정하면 안 된다. 반드시 **JMH 벤치마크**로 측정해야 한다.

```java
@Benchmark
@BenchmarkMode(Mode.AverageTime)
public long sequential() {
    return IntStream.rangeClosed(1, 1_000_000)
        .filter(n -> n % 2 == 0)
        .sum();
}

@Benchmark
@BenchmarkMode(Mode.AverageTime)
public long parallel() {
    return IntStream.rangeClosed(1, 1_000_000)
        .parallel()
        .filter(n -> n % 2 == 0)
        .sum();
}
```

단순 합산 같은 연산은 데이터 1백만 건 이하에서 순차가 더 빠른 경우도 많다. 실측 없이 `parallel()`을 남발하면 오히려 성능이 저하된다.

## 정리

| 항목 | 내용 |
|------|------|
| 내부 구현 | `ForkJoinPool.commonPool()` |
| 기본 스레드 수 | CPU 코어 수 - 1 |
| 병렬화 효과 조건 | 대용량 데이터 + CPU 집약 + 분할 용이 |
| 주의 사항 | 공유 상태 없음, I/O 작업 제외 |
| 커스텀 풀 | `new ForkJoinPool(n).submit(...)` |
| 성능 검증 | JMH 벤치마크 필수 |

---

**지난 글:** [Stream flatMap — 중첩 스트림 평탄화](/posts/java-stream-flatmap/)

**다음 글:** [Stream 주의사항 — 흔한 함정과 해결책](/posts/java-stream-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
