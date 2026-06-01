---
title: "TreeMap — 정렬과 범위 쿼리를 지원하는 맵"
description: "TreeMap의 Red-Black Tree 기반 구조, NavigableMap 메서드(floorKey/ceilingKey/subMap/headMap/tailMap), Comparator를 통한 커스텀 정렬, null 키 불허 이유, 그리고 TreeMap이 빛나는 실전 사용 사례"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Map", "TreeMap", "Red-Black Tree", "NavigableMap", "범위 쿼리"]
featured: false
draft: false
---

[지난 글](/posts/java-map-linkedhashmap/)에서 LinkedHashMap의 삽입/접근 순서 모드와 LRU 캐시 패턴을 살펴봤다. 이번에는 **`TreeMap`**을 다룬다. TreeMap은 키를 항상 정렬된 순서로 유지하고, 범위 탐색 메서드를 제공하는 Map 구현체다.

## 내부 구조: Red-Black Tree

`TreeMap`은 `TreeSet`과 동일한 **Red-Black Tree**로 구현되어 있다. 차이는 각 노드에 키뿐만 아니라 값도 저장한다는 점이다. 트리의 자동 균형 유지로 모든 연산이 O(log n)을 보장한다.

```java
import java.util.TreeMap;

TreeMap<Integer, String> grades = new TreeMap<>();
grades.put(80, "B");
grades.put(70, "C");
grades.put(90, "A");
grades.put(100, "A+");

System.out.println(grades);
// {70=C, 80=B, 90=A, 100=A+} — 키 정렬 순서
```

## NavigableMap 메서드

`TreeMap`은 `NavigableMap<K, V>`를 구현한다. 이 인터페이스는 범위 탐색에 특화된 강력한 메서드를 제공한다.

![TreeMap NavigableMap 주요 API](/assets/posts/java-map-treemap-api.svg)

### 뷰 메서드

`headMap`, `tailMap`, `subMap`은 원본 TreeMap의 **라이브 뷰(live view)**를 반환한다. 뷰에 대한 쓰기 연산은 원본에 반영된다.

```java
TreeMap<Integer, String> scores = new TreeMap<>();
scores.put(70, "C"); scores.put(80, "B");
scores.put(90, "A"); scores.put(100, "A+");

// 80 이상 90 이하 (inclusive 양쪽)
NavigableMap<Integer, String> mid =
    scores.subMap(80, true, 90, true);
System.out.println(mid); // {80=B, 90=A}

// 뷰는 원본과 연결됨
mid.put(85, "B+"); // 원본에도 추가됨
```

## 커스텀 정렬

기본 정렬은 키의 자연 순서(`Comparable`)를 따른다. `Comparator`를 제공하면 커스텀 정렬을 적용할 수 있다.

```java
// 문자열 길이 오름차순, 같은 길이면 알파벳 순
TreeMap<String, Integer> byLength = new TreeMap<>(
    Comparator.comparingInt(String::length)
              .thenComparing(Comparator.naturalOrder())
);

byLength.put("banana", 1);
byLength.put("apple", 2);
byLength.put("fig", 3);

System.out.println(byLength);
// {fig=3, apple=2, banana=1}
```

## null 키 불허

`TreeMap`은 null 키를 허용하지 않는다. 정렬을 위해 `compareTo`(또는 `compare`)를 호출하는데, null과의 비교가 정의되지 않기 때문이다.

```java
TreeMap<String, Integer> map = new TreeMap<>();
map.put(null, 1); // NullPointerException!
```

값(value)의 null은 허용된다.

## HashMap vs LinkedHashMap vs TreeMap 비교

![HashMap vs LinkedHashMap vs TreeMap](/assets/posts/java-map-treemap-comparison.svg)

## 실전 사용 사례

**이벤트 타임라인**: 시간 순서로 이벤트를 저장하고 특정 시간 이전/이후 이벤트를 쿼리할 때.

```java
import java.time.Instant;
import java.util.TreeMap;

TreeMap<Instant, String> events = new TreeMap<>();
events.put(Instant.parse("2026-01-01T00:00:00Z"), "start");
events.put(Instant.parse("2026-06-01T00:00:00Z"), "mid");
events.put(Instant.parse("2026-12-31T00:00:00Z"), "end");

// 특정 시점 이전 모든 이벤트
Instant cutoff = Instant.parse("2026-07-01T00:00:00Z");
System.out.println(events.headMap(cutoff));
// {2026-01-01T00:00:00Z=start, 2026-06-01T00:00:00Z=mid}
```

**등급 경계 결정**: `floorKey`로 주어진 점수에 해당하는 등급을 O(log n)에 찾는다.

```java
TreeMap<Integer, String> grade = new TreeMap<>();
grade.put(0, "F"); grade.put(60, "D");
grade.put(70, "C"); grade.put(80, "B"); grade.put(90, "A");

int score = 85;
String letter = grade.get(grade.floorKey(score)); // "B"
```

---

**지난 글:** [LinkedHashMap — 순서를 기억하는 맵](/posts/java-map-linkedhashmap/)

**다음 글:** [ConcurrentHashMap — 고성능 동시성 맵](/posts/java-map-concurrenthashmap/)

<br>
읽어주셔서 감사합니다. 😊
