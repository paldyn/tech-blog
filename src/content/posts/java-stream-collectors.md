---
title: "Stream Collectors — joining·groupingBy·partitioningBy·toMap"
description: "java.util.stream.Collectors 전체 — toList·toSet·toMap·joining·groupingBy·partitioningBy·counting·summingInt·minBy·maxBy·mapping·collectingAndThen·teeing(Java 12)까지, 다운스트림 Collector 조합 패턴과 중복 키 처리"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "Collectors", "groupingBy", "partitioningBy", "joining", "toMap", "teeing"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-terminal/)에서 Stream 종료 연산을 살펴봤다. 이번에는 종료 연산 중 가장 강력한 **`collect()`** 와 함께 사용하는 **`Collectors`** 유틸리티 클래스를 깊게 다룬다. `Collectors`는 다양한 수집 전략을 정적 메서드로 제공한다.

## import 선언

```java
import java.util.stream.Collectors;
// 정적 임포트로 더 간결하게
import static java.util.stream.Collectors.*;
```

이하 코드 예제는 정적 임포트를 가정한다.

## 기본 수집: toList / toSet / toCollection

```java
List<String> words = List.of("banana", "apple", "cherry", "avocado");

// 가변 List
List<String> mutable = words.stream().collect(toList());

// 가변 Set (중복 제거)
Set<String> set = words.stream().collect(toSet());

// 특정 구현체 지정
TreeSet<String> sorted = words.stream().collect(toCollection(TreeSet::new));
SortedSet<String> sorted2 = words.stream().collect(toCollection(TreeSet::new));
```

Java 16+에서는 종료 연산 `.toList()`가 더 간결하다.

## joining — 문자열 합치기

```java
List<String> items = List.of("Java", "Python", "Rust");

// 구분자 없음
String raw = items.stream().collect(joining()); // "JavaPythonRust"

// 구분자
String csv = items.stream().collect(joining(", ")); // "Java, Python, Rust"

// 구분자 + 접두 + 접미
String json = items.stream().collect(joining("\", \"", "[\"", "\"]"));
// ["Java", "Python", "Rust"]
```

내부적으로 `StringBuilder`를 사용하므로 `+` 연결보다 효율적이다.

## toMap — 맵으로 수집

![Collectors 전체 분류](/assets/posts/java-stream-collectors-overview.svg)

```java
List<String> words = List.of("apple", "banana", "cherry");

// 단어 → 길이 맵
Map<String, Integer> lengthMap = words.stream()
    .collect(toMap(w -> w, String::length));
// {apple=5, banana=6, cherry=6}

// 중복 키가 있을 때 병합 함수 필수
List<String> dup = List.of("apple", "ant", "banana", "bear");
Map<Character, Long> firstCharCount = dup.stream()
    .collect(toMap(
        w -> w.charAt(0),           // 키: 첫 글자
        w -> 1L,                    // 값: 초기값 1
        Long::sum                   // 병합: 합산
    ));
// {a=2, b=2}
```

병합 함수 없이 중복 키가 발생하면 `IllegalStateException`이 발생한다.

## groupingBy — 분류별 그룹화

`groupingBy()`는 `Map<K, List<V>>`를 반환한다.

```java
List<String> words = List.of("a", "bb", "ccc", "dd", "e");

// 기본: 길이별 그룹
Map<Integer, List<String>> byLength = words.stream()
    .collect(groupingBy(String::length));
// {1=[a, e], 2=[bb, dd], 3=[ccc]}

// 다운스트림 Collector: 각 그룹 원소 수
Map<Integer, Long> countByLength = words.stream()
    .collect(groupingBy(String::length, counting()));
// {1=2, 2=2, 3=1}

// 다운스트림: 각 그룹 최대 길이 단어
Map<Integer, Optional<String>> maxByLength = words.stream()
    .collect(groupingBy(String::length,
             maxBy(Comparator.naturalOrder())));

// 결과 맵을 TreeMap으로
Map<Integer, List<String>> sorted = words.stream()
    .collect(groupingBy(String::length, TreeMap::new, toList()));
```

![groupingBy · partitioningBy · joining · toMap 코드](/assets/posts/java-stream-collectors-code.svg)

## partitioningBy — true/false 분리

`partitioningBy()`는 `Map<Boolean, List<T>>`를 반환한다. 항상 `true`와 `false` 두 키가 존재한다.

```java
List<Integer> nums = List.of(1, 2, 3, 4, 5, 6);

Map<Boolean, List<Integer>> evenOdd = nums.stream()
    .collect(partitioningBy(n -> n % 2 == 0));
// {false=[1, 3, 5], true=[2, 4, 6]}

// 다운스트림: 각 파티션 합계
Map<Boolean, Integer> sumByParity = nums.stream()
    .collect(partitioningBy(n -> n % 2 == 0, summingInt(n -> n)));
// {false=9, true=12}
```

## 집계 Collector

```java
List<String> words = List.of("hello", "world", "java", "stream");

// 원소 수
long count = words.stream().collect(counting()); // 4

// 합계
int totalLen = words.stream().collect(summingInt(String::length)); // 21

// 평균
double avgLen = words.stream().collect(averagingInt(String::length)); // 5.25

// 최솟값 / 최댓값
Optional<String> min = words.stream()
    .collect(minBy(Comparator.comparingInt(String::length))); // java
```

## mapping / filtering / collectingAndThen

이 세 메서드는 다른 Collector를 감싸는 **어댑터** 역할을 한다.

```java
// groupingBy 내부에서 변환 적용
Map<Integer, List<Character>> firstCharByLen = words.stream()
    .collect(groupingBy(String::length,
             mapping(s -> s.charAt(0), toList())));

// 수집 후 추가 변환 (불변 리스트로)
List<String> immutable = words.stream()
    .collect(collectingAndThen(toList(), Collections::unmodifiableList));

// filtering: groupingBy 내부 필터
Map<Integer, List<String>> filtered = words.stream()
    .collect(groupingBy(String::length,
             filtering(s -> s.contains("o"), toList())));
```

## teeing (Java 12) — 두 방향 동시 수집

하나의 스트림을 두 Collector에 동시에 흘려보내고 결과를 합친다. 스트림을 두 번 순회하지 않아도 된다.

```java
// 합계와 개수를 동시에
String result = Stream.of(1, 2, 3, 4, 5)
    .collect(Collectors.teeing(
        summingInt(i -> i),  // Collector 1: 합계
        counting(),           // Collector 2: 개수
        (sum, cnt) -> "합계=" + sum + ", 평균=" + (double) sum / cnt
    ));
// "합계=15, 평균=3.0"

// min과 max 동시에
record MinMax(int min, int max) {}
MinMax minMax = Stream.of(3, 1, 4, 1, 5, 9, 2)
    .collect(Collectors.teeing(
        minBy(Comparator.naturalOrder()),
        maxBy(Comparator.naturalOrder()),
        (min, max) -> new MinMax(min.orElseThrow(), max.orElseThrow())
    ));
```

## 실전 조합 패턴

```java
record Employee(String dept, String name, int salary) {}

List<Employee> employees = /* ... */;

// 부서별 평균 연봉 (내림차순 정렬)
Map<String, Double> avgSalaryByDept = employees.stream()
    .collect(groupingBy(Employee::dept,
             averagingInt(Employee::salary)));

// 부서별 최고 연봉자
Map<String, Optional<Employee>> topByDept = employees.stream()
    .collect(groupingBy(Employee::dept,
             maxBy(Comparator.comparingInt(Employee::salary))));

// 부서별 이름 목록 (쉼표 구분)
Map<String, String> namesByDept = employees.stream()
    .collect(groupingBy(Employee::dept,
             mapping(Employee::name, joining(", "))));
```

---

**지난 글:** [Stream 종료 연산 — collect·reduce·forEach·count·find·match](/posts/java-stream-terminal/)

**다음 글:** [groupingBy 심화 — 다운스트림 Collector 조합과 다중 레벨 그루핑](/posts/java-stream-collectors-grouping/)

<br>
읽어주셔서 감사합니다. 😊
