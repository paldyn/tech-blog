---
title: "Collections 유틸리티 — 정렬·검색·동기화 래퍼"
description: "java.util.Collections가 제공하는 sort·binarySearch·shuffle·min·max 등 정렬 검색 메서드, unmodifiable·synchronized·checked 래퍼 팩토리, nCopies·singletonList·disjoint 등 편의 메서드와 현대적 대안 정리"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Collections", "sort", "binarySearch", "unmodifiable", "synchronized"]
featured: false
draft: false
---

[지난 글](/posts/java-priority-queue/)에서 PriorityQueue의 힙 구조를 살펴봤다. 이번에는 **`java.util.Collections`** 유틸리티 클래스를 다룬다. 컬렉션을 직접 만들지 않고 **이미 있는 컬렉션을 정렬·검색·변형·보호**하는 정적 메서드 모음이다.

## 정렬과 검색

`Collections.sort()`는 `List`를 제자리 정렬한다. 내부적으로 `TimSort`(삽입 정렬 + 병합 정렬 하이브리드)를 사용하며 안정 정렬이다.

```java
var list = new ArrayList<>(List.of(5, 3, 8, 1, 9, 2));

// 자연 순서 오름차순
Collections.sort(list);
// → [1, 2, 3, 5, 8, 9]

// Comparator로 내림차순
Collections.sort(list, Comparator.reverseOrder());
// → [9, 8, 5, 3, 2, 1]
```

`binarySearch()`는 **정렬된 리스트에서만** 올바르게 동작한다. 정렬 없이 호출하면 반환값이 정의되지 않는다.

```java
Collections.sort(list); // 반드시 먼저 정렬
int idx = Collections.binarySearch(list, 5); // O(log n)
// idx >= 0: 존재, idx < 0: 없음 (삽입 위치는 -(idx+1))
```

![Collections 유틸리티 메서드 전체 개요](/assets/posts/java-collections-utility-overview.svg)

`min()`과 `max()`는 자연 순서 또는 제공된 Comparator 기준으로 최솟값·최댓값을 반환한다. 두 메서드 모두 O(n)이며 컬렉션이 비어 있으면 `NoSuchElementException`을 던진다.

```java
List<String> names = List.of("Charlie", "Alice", "Bob");
System.out.println(Collections.min(names)); // Alice
System.out.println(Collections.max(names)); // Charlie

long count = Collections.frequency(names, "Alice"); // 1
```

## 변형 메서드

```java
var list = new ArrayList<>(List.of(1, 2, 3, 4, 5));

Collections.reverse(list);     // [5, 4, 3, 2, 1]
Collections.shuffle(list);     // 랜덤 셔플
Collections.swap(list, 0, 4);  // 인덱스 0과 4 교환
Collections.fill(list, 0);     // 모든 원소를 0으로

var src = List.of(10, 20);
var dst = new ArrayList<>(List.of(0, 0, 0));
Collections.copy(dst, src);    // dst[0]=10, dst[1]=20 (dest 크기 >= src 필수)

Collections.rotate(list, 2);  // 오른쪽으로 2 칸 로테이션
Collections.replaceAll(list, 0, 99); // 0을 모두 99로 교체
```

`copy(dest, src)`는 대상 리스트의 크기가 소스보다 커야 한다. 그렇지 않으면 `IndexOutOfBoundsException`을 던진다. 또한 얕은 복사만 수행한다.

## 방어 래퍼 팩토리

세 가지 래퍼가 자주 혼동된다.

![unmodifiable vs synchronized vs checked 래퍼](/assets/posts/java-collections-utility-wrappers.svg)

### unmodifiableList / unmodifiableMap / unmodifiableSet

쓰기 메서드를 막지만 **원본 변경은 뷰에 그대로 반영**된다. 진짜 불변 컬렉션이 필요하면 `List.copyOf()`나 `List.of()`를 사용한다.

```java
var mutable = new ArrayList<>(List.of("a", "b"));
var view = Collections.unmodifiableList(mutable);

view.add("c");    // UnsupportedOperationException
mutable.add("c"); // OK
System.out.println(view.size()); // 3 — 원본 변경이 반영됨
```

### synchronizedList / synchronizedMap

모든 메서드에 단일 뮤텍스를 적용한다. **반복(iteration)은 외부에서 직접 동기화**해야 한다.

```java
List<String> synced = Collections.synchronizedList(new ArrayList<>());

// 반복 시 직접 동기화 필수
synchronized (synced) {
    for (String s : synced) { /* ... */ }
}
```

현대 애플리케이션에서는 `CopyOnWriteArrayList`(읽기 다수)나 `ConcurrentHashMap`(Map 용도)을 더 많이 쓴다.

### checkedList / checkedMap

제네릭 타입 소거 우회를 방지한다. 런타임에 잘못된 타입 원소를 삽입하면 즉시 `ClassCastException`을 던진다.

```java
List<String> raw = new ArrayList<>();
List<String> safe = Collections.checkedList(raw, String.class);

// 컴파일러를 우회한 raw 삽입 시도
((List) safe).add(123); // ClassCastException 즉시
```

레거시 코드 디버깅 외에는 거의 쓰지 않는다.

## 편의 팩토리

```java
// 불변 단일 원소 리스트 (null 허용)
List<String> one = Collections.singletonList("only");

// 불변 빈 컬렉션 (공유 인스턴스, 타입 안전)
List<String> empty = Collections.emptyList();
Map<String, Integer> emptyMap = Collections.emptyMap();

// 같은 원소 n개로 이루어진 불변 리스트
List<String> copies = Collections.nCopies(5, "x");
// → ["x", "x", "x", "x", "x"]
```

`emptyList()`는 매번 새 객체를 생성하지 않고 공유 인스턴스를 반환하므로 빈 컬렉션을 자주 반환하는 메서드에 유용하다.

## disjoint — 교집합 없음 확인

두 컬렉션이 공통 원소를 갖지 않으면 `true`를 반환한다.

```java
List<Integer> a = List.of(1, 2, 3);
List<Integer> b = List.of(4, 5, 6);
List<Integer> c = List.of(3, 7, 8);

Collections.disjoint(a, b); // true  — 겹치는 원소 없음
Collections.disjoint(a, c); // false — 3이 공통
```

내부적으로 크기가 작은 컬렉션을 순회하며 상대 컬렉션에 `contains()`를 호출한다. 한쪽이 `Set`이면 O(n), 둘 다 `List`면 O(n²)이 된다.

## Java 9 이후 — Collections 유틸 vs 모던 API

| 목적 | 전통 방식 | Java 9+ 권장 |
|------|-----------|--------------|
| 불변 리스트 | `Collections.unmodifiableList(Arrays.asList(...))` | `List.of(...)` |
| 불변 맵 | `Collections.unmodifiableMap(...)` | `Map.of(k,v,...)` |
| 빈 리스트 | `Collections.emptyList()` | `List.of()` |
| 복사 불변 | -(없음)- | `List.copyOf(src)` |

`Collections` 유틸은 여전히 `sort`, `binarySearch`, `shuffle`, `frequency`, `disjoint` 등 탐색·조작 메서드에서 활발히 쓰인다.

---

**지난 글:** [PriorityQueue — 우선순위 큐의 힙 구조와 활용](/posts/java-priority-queue/)

**다음 글:** [Arrays 유틸리티 — 정렬·검색·복사·스트림 변환](/posts/java-arrays-utility/)

<br>
읽어주셔서 감사합니다. 😊
