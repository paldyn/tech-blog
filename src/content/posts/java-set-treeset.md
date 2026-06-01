---
title: "TreeSet — 정렬과 범위 쿼리를 지원하는 Set"
description: "TreeSet의 Red-Black Tree 기반 구조, O(log n) 성능, NavigableSet 메서드(floor/ceiling/headSet/tailSet/subSet), Comparable과 Comparator를 통한 커스텀 정렬, 그리고 TreeSet이 적합한 상황"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Set", "TreeSet", "Red-Black Tree", "NavigableSet", "정렬"]
featured: false
draft: false
---

[지난 글](/posts/java-set-linkedhashset/)에서 삽입 순서를 유지하는 LinkedHashSet을 살펴봤다. 이번에는 **`TreeSet`**을 다룬다. TreeSet은 원소를 항상 **정렬된 순서**로 유지하고, 범위 탐색과 인접 원소 검색 같은 풍부한 쿼리 메서드를 제공한다.

## 내부 구조: Red-Black Tree

`TreeSet`은 내부적으로 `TreeMap`을 사용하며, TreeMap은 **Red-Black Tree**(자기 균형 이진 탐색 트리)로 구현되어 있다.

```java
// java.util.TreeSet 내부 (간략화)
private transient NavigableMap<E, Object> m;

public TreeSet() {
    this(new TreeMap<>());
}
```

Red-Black Tree는 삽입·삭제 후 트리를 자동으로 균형 잡아 높이를 O(log n)으로 유지한다. 따라서 모든 기본 연산(add, remove, contains)이 **O(log n)**을 보장한다.

![TreeSet 내부 — Red-Black Tree 기반 정렬](/assets/posts/java-set-treeset-structure.svg)

## 기본 사용

```java
import java.util.TreeSet;

TreeSet<Integer> nums = new TreeSet<>();
nums.add(5);
nums.add(3);
nums.add(8);
nums.add(1);
nums.add(4);

System.out.println(nums);        // [1, 3, 4, 5, 8] — 정렬 순서
System.out.println(nums.first()); // 1
System.out.println(nums.last());  // 8
```

## NavigableSet 메서드

`TreeSet`은 `NavigableSet<E>`를 구현한다. 이 인터페이스는 범위 탐색에 특화된 강력한 메서드를 제공한다.

![TreeSet NavigableSet 주요 메서드](/assets/posts/java-set-treeset-methods.svg)

### headSet / tailSet / subSet

이 뷰 메서드들은 원본 TreeSet의 **뷰**를 반환한다. 뷰에 대한 변경은 원본에 반영되고, 원본의 변경도 뷰에 반영된다.

```java
TreeSet<String> words = new TreeSet<>(
    Set.of("apple", "banana", "cherry", "date", "elderberry")
);

// b 이상 d 미만 (알파벳 범위)
NavigableSet<String> sub = words.subSet("b", true, "d", false);
System.out.println(sub); // [banana, cherry]

// d 미만 모두
System.out.println(words.headSet("d")); // [apple, banana, cherry]

// c 이상 모두 (내림차순 뷰)
NavigableSet<String> desc = words.tailSet("c").descendingSet();
System.out.println(desc); // [elderberry, date, cherry]
```

## Comparator를 통한 커스텀 정렬

기본 정렬은 `Comparable`(자연 순서)을 따른다. 커스텀 순서가 필요하면 생성자에 `Comparator`를 전달한다.

```java
import java.util.Comparator;
import java.util.TreeSet;

// 문자열 길이 역순으로 정렬
TreeSet<String> byLength = new TreeSet<>(
    Comparator.comparingInt(String::length).reversed()
              .thenComparing(Comparator.naturalOrder())
);

byLength.add("apple");
byLength.add("fig");
byLength.add("banana");
byLength.add("kiwi");

System.out.println(byLength); // [banana, apple, kiwi, fig]
```

## null 불허

`TreeSet`은 `null`을 허용하지 않는다. `null`을 삽입하거나 비교할 때 `NullPointerException`이 발생한다.

```java
TreeSet<String> s = new TreeSet<>();
s.add(null); // NullPointerException!
```

HashSet/LinkedHashSet과 달리 TreeSet의 정렬 연산이 `compareTo`(또는 Comparator)를 호출하는데, `null`과의 비교가 정의되어 있지 않기 때문이다.

## TreeSet vs HashSet 선택 기준

| 상황 | 권장 |
|---|---|
| 중복 제거만 필요 | `HashSet` |
| 삽입 순서 재현 필요 | `LinkedHashSet` |
| 원소를 항상 정렬된 상태로 유지 | `TreeSet` |
| `first()` / `last()` / `floor()` / `ceiling()` 범위 쿼리 | `TreeSet` |
| 알파벳·숫자 순서 최솟값/최댓값 | `TreeSet` |

TreeSet은 HashSet보다 O(1) vs O(log n)으로 느리지만, 범위 쿼리와 정렬 유지가 필요할 때는 별도의 정렬 비용 없이 이를 자동으로 처리해준다.

```java
// 슬라이딩 윈도우 최솟값 — TreeSet 활용
TreeSet<int[]> window = new TreeSet<>(Comparator.comparingInt(a -> a[0]));
window.add(new int[]{3, 0});
window.add(new int[]{1, 1});
window.add(new int[]{5, 2});

int[] min = window.first(); // [1, 1] — 첫 번째 원소가 최솟값
window.pollFirst();         // 최솟값 제거
```

---

**지난 글:** [LinkedHashSet — 삽입 순서를 유지하는 Set](/posts/java-set-linkedhashset/)

**다음 글:** [HashMap — 해시 맵의 내부 구조와 성능](/posts/java-map-hashmap/)

<br>
읽어주셔서 감사합니다. 😊
