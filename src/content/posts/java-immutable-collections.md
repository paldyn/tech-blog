---
title: "불변 컬렉션 — List.of·Map.of·Set.of와 copyOf"
description: "Java 9에서 도입된 List.of·Map.of·Set.of 불변 팩토리의 null 불허·중복 불허 특성, Java 10 copyOf로 독립 복사본 생성, Stream.toList(Java 16)와 toUnmodifiableList 차이, Map.ofEntries로 10쌍 한도 우회까지"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "불변", "List.of", "Map.of", "Set.of", "copyOf", "Java9", "Java10"]
featured: false
draft: false
---

[지난 글](/posts/java-arrays-utility/)에서 `Arrays` 유틸리티를 살펴봤다. 이번에는 **불변 컬렉션(Immutable Collections)** 을 다룬다. Java 9 이전에는 불변 컬렉션을 만드는 일이 번거로웠지만, Java 9부터 `List.of()`, `Set.of()`, `Map.of()`라는 깔끔한 팩토리가 추가됐다.

## Java 9 이전 — 번거로운 방식

Java 8까지는 불변 리스트를 만들려면 2~3단계가 필요했다.

```java
// Java 8 방식
List<String> list = Collections.unmodifiableList(
    new ArrayList<>(Arrays.asList("a", "b", "c"))
);
```

이 방식의 문제점은 **원본 참조가 외부에 남으면 불변성이 깨진다**는 것이다.

```java
ArrayList<String> source = new ArrayList<>(Arrays.asList("a", "b"));
List<String> view = Collections.unmodifiableList(source);
source.add("c"); // view에도 "c"가 생김!
```

![불변 컬렉션 진화 역사](/assets/posts/java-immutable-collections-overview.svg)

## Java 9 — List.of / Set.of / Map.of

```java
List<String> list = List.of("a", "b", "c");
Set<Integer> set  = Set.of(1, 2, 3);
Map<String, Integer> map = Map.of("one", 1, "two", 2);
```

이 세 팩토리는 공통적으로 다음 특성을 갖는다.

1. **진짜 불변**: `add`, `set`, `remove`, `put` 모두 `UnsupportedOperationException`
2. **null 원소 불허**: `List.of(null)` → `NullPointerException` 즉시
3. **직렬화 가능**: `Serializable` 구현
4. **내부 최적화**: 원소 수에 따라 배열 기반 또는 해시 기반 구현 자동 선택

`Set.of()`와 `Map.of()`는 추가로 **중복 불허**다.

```java
Set.of(1, 1);       // IllegalArgumentException — 중복 원소
Map.of("a", 1, "a", 2); // IllegalArgumentException — 중복 키
```

## List.of vs Arrays.asList 비교

| 항목 | `List.of()` | `Arrays.asList()` |
|------|-------------|-------------------|
| 불변성 | 완전 불변 | set() 허용, add/remove 불가 |
| null 허용 | 불허 | 허용 |
| 직렬화 | 가능 | 가능 |
| 원본 배열 반영 | 해당 없음 | 반영됨 (뷰) |
| 용도 | 상수 컬렉션 | 배열 → 리스트 변환 |

## Map.of의 10쌍 한도와 Map.ofEntries

`Map.of()`는 타입 안전을 위해 키-값 쌍을 개별 파라미터로 받는 오버로드를 10쌍까지만 제공한다. 11쌍 이상은 `Map.ofEntries()`를 사용한다.

```java
// 10쌍 이하
Map<String, Integer> small = Map.of(
    "a", 1, "b", 2, "c", 3
);

// 10쌍 초과
Map<String, Integer> large = Map.ofEntries(
    Map.entry("a", 1),
    Map.entry("b", 2),
    Map.entry("c", 3),
    Map.entry("d", 4),
    Map.entry("e", 5),
    Map.entry("f", 6),
    Map.entry("g", 7),
    Map.entry("h", 8),
    Map.entry("i", 9),
    Map.entry("j", 10),
    Map.entry("k", 11)  // 11번째
);
```

## Java 10 — copyOf

`List.copyOf()`, `Set.copyOf()`, `Map.copyOf()`는 소스 컬렉션의 **독립적인 불변 복사본**을 반환한다. 원본이 이후 바뀌어도 복사본에 영향이 없다.

```java
var source = new ArrayList<>(List.of("x", "y", "z"));
var copy = List.copyOf(source);

source.add("w");
System.out.println(copy.size()); // 3 — 원본 변경 무관
```

이미 불변 컬렉션(예: `List.of()` 결과)을 `copyOf`에 넘기면 **같은 인스턴스를 반환**하는 최적화가 적용된다.

```java
var original = List.of(1, 2, 3);
var copy = List.copyOf(original);
System.out.println(original == copy); // true (최적화)
```

`copyOf`도 null 원소를 포함한 소스에서는 `NullPointerException`을 던진다.

## Stream에서 불변 리스트로 수집

![List.of·Map.of·Set.of 사용 패턴](/assets/posts/java-immutable-collections-code.svg)

```java
List<String> filtered = list.stream()
    .filter(s -> !s.isBlank())
    .collect(Collectors.toUnmodifiableList()); // Java 10

// Java 16 이후 더 간결
List<String> filtered2 = list.stream()
    .filter(s -> !s.isBlank())
    .toList();
```

두 방식의 차이:
- `toUnmodifiableList()`: null 원소 허용 안 함
- `.toList()`: null 원소 허용, 약간 더 간결

## 가변 컬렉션이 필요할 때

불변 팩토리 결과에 원소를 추가해야 하면 가변 컬렉션으로 복사한다.

```java
var immutable = List.of("a", "b", "c");

// 추가 후 다시 불변으로
var extended = Stream.concat(immutable.stream(), Stream.of("d"))
                     .toList();

// 또는 가변 리스트로 작업
var mutable = new ArrayList<>(immutable);
mutable.add("d");
var final_ = List.copyOf(mutable);
```

## 정리: 언제 어떤 팩토리를 쓸까

| 상황 | 권장 |
|------|------|
| 소규모 상수 리스트 | `List.of(...)` |
| 소규모 상수 맵 (≤10쌍) | `Map.of(...)` |
| 대규모 상수 맵 | `Map.ofEntries(Map.entry(...), ...)` |
| 기존 컬렉션의 불변 복사본 | `List.copyOf(src)` |
| Stream 결과를 불변으로 | `.toList()` (Java 16+) |
| null 허용 불변 컬렉션 | `Collections.unmodifiableList(new ArrayList<>(...))` |

---

**지난 글:** [Arrays 유틸리티 — 정렬·검색·복사·스트림 변환](/posts/java-arrays-utility/)

**다음 글:** [컬렉션 프레임워크 모범 사례 — 선택·초기화·성능·안전](/posts/java-collection-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
