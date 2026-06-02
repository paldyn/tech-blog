---
title: "Arrays 유틸리티 — 정렬·검색·복사·스트림 변환"
description: "java.util.Arrays의 sort·parallelSort·binarySearch·copyOf·copyOfRange·fill·equals·deepEquals·toString·stream·asList 전체 메서드 정리와 기본 타입 Dual-Pivot QuickSort vs 객체 TimSort 차이, asList 고정 크기 함정까지"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "Arrays", "정렬", "binarySearch", "copyOf", "parallelSort", "stream"]
featured: false
draft: false
---

[지난 글](/posts/java-collections-utility/)에서 `Collections` 유틸리티 클래스를 살펴봤다. 이번에는 **`java.util.Arrays`** 다. 배열에 특화된 정적 메서드 모음으로, 정렬부터 검색·복사·비교·스트림 변환까지 배열을 다루는 대부분의 작업을 커버한다.

## 정렬: sort vs parallelSort

`Arrays.sort()`는 배열을 제자리 정렬한다. 타입에 따라 알고리즘이 달라진다.

- **기본 타입(int, long 등)**: Dual-Pivot QuickSort — O(n log n) 평균, 캐시 효율 우수
- **객체 타입(Integer, String 등)**: TimSort — O(n log n) 안정 정렬, Comparable 또는 Comparator 사용

```java
int[] arr = {5, 3, 8, 1, 9, 2};
Arrays.sort(arr);               // 전체 정렬
Arrays.sort(arr, 1, 4);         // 인덱스 1~3 범위만 정렬

String[] words = {"banana", "apple", "cherry"};
Arrays.sort(words);             // 자연 순서
Arrays.sort(words, Comparator.comparingInt(String::length)); // 길이 순
```

`parallelSort()`는 `ForkJoinPool.commonPool()`을 활용해 병렬로 정렬한다. 배열 크기가 약 8,192 이상이고 CPU 코어가 여러 개일 때 유의미한 성능 향상이 나타난다. 작은 배열에서는 오히려 스레드 오버헤드로 느릴 수 있다.

```java
int[] big = new int[1_000_000];
// ... fill data
Arrays.parallelSort(big); // 멀티코어 활용
```

![Arrays 유틸리티 메서드 전체 개요](/assets/posts/java-arrays-utility-overview.svg)

## 이진 검색: binarySearch

**반드시 정렬된 배열에서만 호출**해야 한다. 정렬되지 않은 배열에서 호출하면 결과가 정의되지 않는다.

```java
int[] sorted = {1, 2, 3, 5, 8, 9};
int idx = Arrays.binarySearch(sorted, 5); // 3
int missing = Arrays.binarySearch(sorted, 4); // 음수 (-(삽입위치+1))
// missing == -4 → 4는 인덱스 3에 삽입되어야 함
```

반환값이 음수면 원소가 없다는 의미다. 삽입 위치는 `-(returnValue + 1)`로 계산한다.

## 복사: copyOf와 copyOfRange

```java
int[] arr = {1, 2, 3, 5, 8, 9};

// 앞에서 4개 복사 (새 배열 반환)
int[] copy4 = Arrays.copyOf(arr, 4);     // [1, 2, 3, 5]

// 길이 초과 시 0(기본값)으로 패딩
int[] copy8 = Arrays.copyOf(arr, 8);     // [1, 2, 3, 5, 8, 9, 0, 0]

// 인덱스 2(포함)~5(미포함) 범위 복사
int[] sub = Arrays.copyOfRange(arr, 2, 5); // [3, 5, 8]
```

내부적으로 `System.arraycopy()`를 호출하므로 네이티브 배열 복사 성능을 그대로 활용한다. `ArrayList`의 크기 조정도 같은 방식을 사용한다.

## 채우기: fill

```java
int[] arr = new int[6];
Arrays.fill(arr, 7);           // [7, 7, 7, 7, 7, 7]
Arrays.fill(arr, 2, 5, -1);    // [7, 7, -1, -1, -1, 7]
```

2D 배열 초기화에 `fill`만으로는 부족하다. 행마다 독립적인 배열이 필요하면 루프로 생성해야 한다.

```java
int[][] matrix = new int[3][4];
// 모든 셀을 5로: fill은 행(배열 참조)을 채우므로 부적합
for (int[] row : matrix) {
    Arrays.fill(row, 5);
}
```

## 비교: equals와 deepEquals

![Arrays 핵심 사용 패턴](/assets/posts/java-arrays-utility-code.svg)

```java
int[] a = {1, 2, 3};
int[] b = {1, 2, 3};

a == b;               // false — 참조 비교
Arrays.equals(a, b);  // true  — 원소 값 비교

// 2D 배열
int[][] m1 = {{1, 2}, {3, 4}};
int[][] m2 = {{1, 2}, {3, 4}};
Arrays.equals(m1, m2);      // false — 내부 배열을 참조로 비교
Arrays.deepEquals(m1, m2);  // true  — 재귀적으로 값 비교
```

다차원 배열은 `deepEquals`와 `deepToString`을 사용한다.

```java
System.out.println(Arrays.toString(a));       // [1, 2, 3]
System.out.println(Arrays.deepToString(m1));  // [[1, 2], [3, 4]]
```

## 스트림 변환: Arrays.stream

```java
int[] nums = {1, 2, 3, 4, 5};

// 기본 타입 → 박싱 없이 IntStream
int sum = Arrays.stream(nums).sum(); // 15

// 범위 스트림
int partialSum = Arrays.stream(nums, 1, 4).sum(); // 2+3+4=9

// 객체 배열 → Stream<T>
String[] words = {"hello", "world"};
long count = Arrays.stream(words)
                   .filter(w -> w.length() > 4)
                   .count(); // 2
```

`int[]`를 `Arrays.stream()`에 넘기면 `IntStream`이 반환되어 `sum()`, `average()`, `min()`, `max()` 같은 특화 메서드를 바로 쓸 수 있다. `Integer[]`는 `Stream<Integer>`가 반환된다.

## asList의 함정

```java
// 고정 크기 List 뷰 반환 (add/remove 불가)
List<String> fixed = Arrays.asList("a", "b", "c");
fixed.set(0, "x"); // OK — 원소 교체 가능
fixed.add("d");    // UnsupportedOperationException

// 가변 리스트가 필요하면 새 ArrayList로 감싼다
List<String> mutable = new ArrayList<>(Arrays.asList("a", "b", "c"));
mutable.add("d");  // OK
```

또한 기본 타입 배열은 `Arrays.asList(int[])`로 호출하면 `List<int[]>`(배열 하나짜리 리스트)가 반환된다. `Integer[]`를 사용하거나 `Arrays.stream(intArr).boxed().toList()`를 활용한다.

```java
int[] primitives = {1, 2, 3};
List<Integer> boxed = Arrays.stream(primitives).boxed().toList();
```

## 언제 무엇을 쓸까

| 목적 | 권장 메서드 |
|------|-------------|
| 소규모 배열 정렬 | `Arrays.sort()` |
| 대용량 병렬 정렬 | `Arrays.parallelSort()` |
| 정렬 후 검색 | `Arrays.sort()` → `Arrays.binarySearch()` |
| 배열 복사본 | `Arrays.copyOf()` / `copyOfRange()` |
| 디버그 출력 | `Arrays.toString()` / `deepToString()` |
| 배열 → 스트림 | `Arrays.stream()` |
| 배열 → 고정 리스트 | `Arrays.asList()` |

---

**지난 글:** [Collections 유틸리티 — 정렬·검색·동기화 래퍼](/posts/java-collections-utility/)

**다음 글:** [불변 컬렉션 — List.of·Map.of·Set.of와 copyOf](/posts/java-immutable-collections/)

<br>
읽어주셔서 감사합니다. 😊
