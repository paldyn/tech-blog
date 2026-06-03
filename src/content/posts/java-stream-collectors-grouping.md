---
title: "groupingBy 심화 — 다운스트림 Collector 조합과 다중 레벨 그루핑"
description: "Collectors.groupingBy의 다운스트림 Collector 파라미터 완전 분석 — counting·summingInt·mapping·joining·collectingAndThen·teeing 조합 패턴, 다중 레벨(2단계·3단계) 중첩 그루핑, 집계 결과를 불변 맵으로 변환하는 실전 패턴"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Stream", "groupingBy", "Collectors", "downstream", "다운스트림", "중첩그루핑"]
featured: false
draft: false
---

[지난 글](/posts/java-stream-collectors/)에서 `Collectors` 유틸리티 전반을 살펴봤다. 이번에는 그 중에서 가장 강력하고 복잡한 **`groupingBy`** 를 집중 해부한다. 특히 두 번째 파라미터인 **다운스트림 Collector**를 자유자재로 조합하는 방법을 실전 예제로 익혀 보자.

## groupingBy 기본 시그니처

```java
// 1-파라미터 버전 (downstream = toList())
Collector<T, ?, Map<K, List<T>>> groupingBy(Function<? super T, ? extends K> classifier)

// 2-파라미터 버전 (downstream 지정)
Collector<T, ?, Map<K, D>> groupingBy(
    Function<? super T, ? extends K> classifier,
    Collector<? super T, A, D> downstream
)

// 3-파라미터 버전 (mapFactory + downstream)
Collector<T, ?, M> groupingBy(
    Function<? super T, ? extends K> classifier,
    Supplier<M> mapFactory,
    Collector<? super T, A, D> downstream
)
```

반환 타입의 `D`가 곧 downstream이 결정하는 값 타입이다.

![groupingBy 다운스트림 Collector 조합](/assets/posts/java-stream-collectors-grouping-downstream.svg)

## 자주 쓰는 downstream 조합

### counting() — 그룹별 개수

```java
Map<String, Long> countByDept = employees.stream()
    .collect(groupingBy(Employee::getDept, counting()));
// {개발팀=5, 마케팅팀=3, 영업팀=4}
```

### summingInt / averagingInt — 그룹별 합계·평균

```java
// 부서별 급여 합계
Map<String, Integer> salarySum = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        summingInt(Employee::getSalary)
    ));

// 부서별 평균 나이
Map<String, Double> avgAge = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        averagingInt(Employee::getAge)
    ));
```

### mapping() — 요소 변환 후 수집

```java
// 부서별 직원 이름 목록
Map<String, List<String>> namesByDept = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        mapping(Employee::getName, toList())
    ));

// 부서별 이름을 Set으로 수집 (중복 제거)
Map<String, Set<String>> nameSetByDept = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        mapping(Employee::getName, toSet())
    ));
```

### joining() — 그룹 내 문자열 연결

`mapping()`과 `joining()`을 결합하면 그룹별 문자열 집계가 가능하다.

```java
// 부서별 이름을 ", "로 연결
Map<String, String> nameJoinByDept = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        mapping(Employee::getName, joining(", "))
    ));
// {개발팀=홍길동, 김영수, 이철희}
```

## 다중 레벨 중첩 그루핑

downstream에 다시 `groupingBy`를 넣으면 중첩 그루핑이 된다.

![다중 레벨 groupingBy 코드 예제](/assets/posts/java-stream-collectors-grouping-multilevel.svg)

```java
// 부서 → 직급 → 이름 목록 (3단계)
import static java.util.stream.Collectors.*;

Map<String, Map<String, List<String>>> result = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        groupingBy(
            Employee::getLevel,
            mapping(Employee::getName, toList())
        )
    ));

// 결과 출력
result.forEach((dept, levelMap) -> {
    System.out.println("[" + dept + "]");
    levelMap.forEach((level, names) ->
        System.out.println("  " + level + ": " + names));
});
```

가독성 측면에서 2단계까지가 실무에서 권장되는 상한선이다. 3단계 이상이 필요하다면 중간 집계용 DTO를 만들거나 쿼리로 처리하는 편이 유지보수에 좋다.

## collectingAndThen() — 수집 후 변환

```java
// 그룹별 리스트를 unmodifiableList로 감싸기
Map<String, List<String>> immutableByDept = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        collectingAndThen(
            mapping(Employee::getName, toList()),
            Collections::unmodifiableList
        )
    ));

// 그룹별 최고 급여자 (Optional → Employee)
Map<String, Employee> topByDept = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        collectingAndThen(
            maxBy(Comparator.comparingInt(Employee::getSalary)),
            Optional::get
        )
    ));
```

## minBy / maxBy — 그룹별 최솟값·최댓값

```java
// 부서별 최연소 직원
Map<String, Optional<Employee>> youngestByDept = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        minBy(Comparator.comparingInt(Employee::getAge))
    ));
```

`Optional`로 감싸진 이유는 그룹이 비어 있을 가능성을 열어 두기 때문이다. `collectingAndThen`으로 `Optional::get`을 붙이면 언박싱할 수 있다.

## teeing() — 두 Collector 동시 적용 (Java 12+)

```java
// 그룹별 최솟값과 최댓값을 한 번의 순회로
Map<String, int[]> minMaxByDept = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        teeing(
            minBy(Comparator.comparingInt(Employee::getSalary)),
            maxBy(Comparator.comparingInt(Employee::getSalary)),
            (min, max) -> new int[]{
                min.map(Employee::getSalary).orElse(0),
                max.map(Employee::getSalary).orElse(0)
            }
        )
    ));
```

## 결과 맵 정렬 — mapFactory

기본 `groupingBy`는 반환 맵이 `HashMap`이라 순서가 보장되지 않는다. 키 정렬이 필요하면 세 번째 파라미터로 `TreeMap::new`를 전달하면 된다.

```java
// 키(부서명)를 알파벳 순으로 정렬
TreeMap<String, Long> sorted = employees.stream()
    .collect(groupingBy(
        Employee::getDept,
        TreeMap::new,
        counting()
    ));
```

## 정리

- **downstream 생략**: `toList()`가 기본값
- **집계**: `counting()`, `summingInt()`, `averagingInt()`, `summarizingInt()`
- **변환 후 수집**: `mapping()`, `joining()`
- **후처리**: `collectingAndThen()`, `filtering()` (Java 9+)
- **동시 집계**: `teeing()` (Java 12+)
- **중첩 그루핑**: downstream에 다시 `groupingBy`

downstream Collector는 `Collector<T, A, R>` 인터페이스를 구현한 어떤 것도 사용할 수 있으므로, 직접 구현한 커스텀 Collector도 적용 가능하다.

---

**지난 글:** [Stream Collectors — joining·groupingBy·partitioningBy·toMap](/posts/java-stream-collectors/)

**다음 글:** [Stream flatMap — 중첩 스트림 평탄화](/posts/java-stream-flatmap/)

<br>
읽어주셔서 감사합니다. 😊
