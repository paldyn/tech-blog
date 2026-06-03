---
title: "Stream vs for 루프 — 성능·가독성·선택 기준 완전 비교"
description: "Java Stream API와 전통적인 for/while 루프의 성능·가독성·디버깅·병렬화·조기 탈출 측면 비교 — JMH 벤치마크 결과, 상황별 선택 가이드, Stream이 더 나은 경우와 루프가 더 나은 경우, 팀 코드 컨벤션 설정 방법"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "for루프", "성능비교", "가독성", "JMH", "벤치마크"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-pitfalls/)에서 스트림의 함정들을 살펴봤다. 이번에는 좀 더 근본적인 질문에 답한다. **"스트림을 쓸까, for 루프를 쓸까?"** 답은 상황에 따라 다르다. 이 글에서는 여러 측면에서 두 방식을 비교하고 실무 선택 기준을 제시한다.

## 같은 결과, 다른 코드

```java
List<String> names = List.of("Alice", "Bob", "Charlie", "Dave", "Eve");

// for 루프 방식
List<String> longNamesLoop = new ArrayList<>();
for (String name : names) {
    if (name.length() > 3) {
        longNamesLoop.add(name.toUpperCase());
    }
}

// Stream 방식
List<String> longNamesStream = names.stream()
    .filter(n -> n.length() > 3)
    .map(String::toUpperCase)
    .collect(toList());
```

두 코드는 동일한 결과를 낸다. 어떤 것이 더 나은가?

## 가독성 비교

![Stream vs 루프 비교표](/assets/posts/java-stream-vs-loop-comparison.svg)

**Stream이 읽기 좋은 경우**

```java
// "이름 길이가 3 초과인 것들을 대문자로 수집"이 코드에 드러남
names.stream()
    .filter(n -> n.length() > 3)
    .map(String::toUpperCase)
    .collect(toList());
```

의도가 메서드 이름(`filter`, `map`, `collect`)에 담겨 있다. 선언적이다.

**루프가 읽기 좋은 경우**

```java
// 인덱스가 필요하거나 조기 탈출이 있는 경우
for (int i = 0; i < matrix.length; i++) {
    for (int j = 0; j < matrix[i].length; j++) {
        if (matrix[i][j] == target) {
            return new int[]{i, j};  // break처럼 즉시 탈출
        }
    }
}
```

2D 배열 순회나 조기 `return`이 필요한 로직은 스트림으로 표현하면 오히려 어색하다.

## 성능 비교

벤치마크 환경마다 다르지만 일반적인 경향은 다음과 같다.

```java
// JMH 벤치마크 예시 (단순 합산, 백만 건)
@Benchmark
public int loopSum() {
    int sum = 0;
    for (int n : intList) sum += n;
    return sum;
}

@Benchmark
public int streamSum() {
    return intList.stream()
        .mapToInt(Integer::intValue)
        .sum();
}

@Benchmark
public int intStreamSum() {
    return IntStream.rangeClosed(1, 1_000_000).sum();
}
```

**결과 경향 (예시)**:
- `for` 루프: 가장 빠름 (JIT가 가장 적극적으로 최적화)
- 기본형 특화 `IntStream`: 루프에 근접
- 박싱된 `Stream<Integer>`: 가장 느림

단순 반복 연산에서는 루프가 빠르다. 그러나 복잡한 집계나 병렬화가 필요한 경우 스트림이 더 나을 수 있다. **마이크로 최적화보다 가독성을 먼저 고려**하고, 병목이 확인된 곳에서만 성능을 튜닝한다.

## 병렬화

```java
// 루프: 직접 스레드 관리 필요
ExecutorService pool = Executors.newFixedThreadPool(4);
// ... 복잡한 분할/수집 코드

// 스트림: .parallel() 한 줄
long count = list.parallelStream()
    .filter(expensiveCheck)
    .count();
```

병렬 처리가 필요하면 스트림이 압도적으로 간결하다. 물론 이전 글에서 다뤘듯이 적절한 조건에서만 효과적이다.

## 조기 탈출 비교

```java
// 루프: break로 즉시 탈출
for (String s : list) {
    if (condition(s)) {
        process(s);
        break;  // 즉시 종료
    }
}

// 스트림: findFirst + ifPresent
list.stream()
    .filter(condition)
    .findFirst()
    .ifPresent(this::process);
```

조기 탈출 로직은 루프가 더 직관적이다. 스트림의 `findFirst()`도 내부적으로 단락 평가를 하지만 코드가 약간 복잡해진다.

## 디버깅 경험

루프는 IDE 디버거로 각 이터레이션을 단계별로 추적할 수 있다. 스트림은 람다 내부에 중단점을 설정하기 까다롭고, 스택 트레이스가 길고 복잡하다.

```java
// 스트림 디버깅: peek()으로 중간 값 확인
list.stream()
    .peek(s -> log.debug("before filter: {}", s))
    .filter(condition)
    .peek(s -> log.debug("after filter: {}", s))
    .collect(toList());
```

`peek()`은 프로덕션에 남기면 안 되고, 개발/디버깅 단계에서만 활용한다.

## 인덱스 접근

```java
// 루프: 인덱스가 필요한 경우
for (int i = 0; i < list.size(); i++) {
    process(i, list.get(i));  // 인덱스와 값을 함께 사용
}

// 스트림으로 인덱스 사용 (어색하지만 가능)
IntStream.range(0, list.size())
    .forEach(i -> process(i, list.get(i)));
```

인덱스가 필요하다면 루프가 자연스럽다. 스트림으로도 가능하지만 `IntStream.range()` 트릭이 필요해서 직관적이지 않다.

## 선택 가이드

![선택 가이드 플로우차트](/assets/posts/java-stream-vs-loop-guide.svg)

| 상황 | 권장 |
|------|------|
| 변환·필터·집계 파이프라인 | Stream |
| 인덱스 접근 필요 | for 루프 |
| 조기 break/continue | for 루프 |
| 병렬 처리 필요 | Stream.parallel() |
| 체크 예외 처리 많음 | for 루프 |
| 복잡한 중첩 상태 변환 | for 루프 |
| 코드 표현력이 우선 | Stream |
| 대용량 집계 | Stream + JMH 검증 |

## 팀 컨벤션 설정

"스트림과 루프 중 무엇을 기본으로 쓸까"는 팀 내에서 합의가 필요하다. 다음 원칙을 권장한다.

1. **명확한 변환·집계 파이프라인**: Stream 사용
2. **인덱스 접근, 조기 탈출, 복잡한 상태 변경**: for 루프
3. **성능 민감 코드**: JMH로 측정 후 선택
4. **일관성**: 한 메서드 안에서 스타일 혼용 최소화

---

**지난 글:** [Stream 주의사항 — 흔한 함정 8가지](/posts/java-stream-pitfalls/)

**다음 글:** [람다 표현식 — 문법·특성·활용 완전 정리](/posts/java-lambda-expressions/)

<br>
읽어주셔서 감사합니다. 😊
