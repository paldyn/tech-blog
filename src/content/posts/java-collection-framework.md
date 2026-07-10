---
title: "컬렉션 프레임워크 개요 — Java Collections의 전체 구조"
description: "Iterable→Collection→List/Set/Queue 계층, Map의 별도 계층, 주요 구현체 선택 기준 표, Iterable·Collection 공통 인터페이스 메서드, 그리고 어떤 컬렉션을 언제 써야 하는지 가이드"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Collection Framework", "List", "Set", "Map", "Queue"]
featured: false
draft: false
---

[지난 글](/posts/java-generics-pitfalls/)에서 제네릭 사용 시 주의해야 할 함정들을 정리했다. 이번에는 **Java 컬렉션 프레임워크(Collection Framework)**를 개관한다. 컬렉션 프레임워크는 데이터를 저장·검색·수정·순회하는 데이터 구조와 알고리즘의 통합 체계다. Java 2(1.2)에서 도입되어 이후 버전마다 꾸준히 확장되었다.

## 전체 계층 구조

```text
Iterable<E>
  └─ Collection<E>
       ├─ List<E>         — 순서 있는 시퀀스, 중복 허용
       │    ├─ ArrayList
       │    ├─ LinkedList
       │    └─ Vector (레거시)
       ├─ Set<E>          — 중복 없는 집합
       │    ├─ HashSet
       │    ├─ LinkedHashSet
       │    └─ SortedSet → TreeSet
       └─ Queue<E>        — FIFO / 우선순위
            ├─ ArrayDeque  (Deque 구현)
            └─ PriorityQueue

Map<K,V>  (Collection 계층에 속하지 않음)
  ├─ HashMap
  ├─ LinkedHashMap
  ├─ TreeMap
  └─ ConcurrentHashMap
```

`Map`은 키-값 쌍을 다루기 때문에 `Collection` 계층에 속하지 않는다. 하지만 같은 패키지 `java.util`에 있으며, 실무에서 가장 많이 쓰이는 자료구조 중 하나다.

![컬렉션 프레임워크 계층 구조](/assets/posts/java-collection-framework-hierarchy.svg)

## Iterable\<E\> — 반복 가능의 근원

`Iterable`은 `for-each` 루프를 가능하게 하는 인터페이스다. `iterator()` 메서드 하나만 있다.

```java
public interface Iterable<T> {
    Iterator<T> iterator();

    // Java 8+
    default void forEach(Consumer<? super T> action) { ... }
    default Spliterator<T> spliterator() { ... }
}
```

`Iterator`는 `hasNext()`, `next()`, `remove()` 세 메서드를 제공한다.

```java
List<String> list = List.of("a", "b", "c");

// for-each (내부적으로 iterator 사용)
for (String s : list) System.out.println(s);

// 명시적 iterator
Iterator<String> it = list.iterator();
while (it.hasNext()) System.out.println(it.next());
```

## Collection\<E\> — 컬렉션의 공통 인터페이스

`Collection`은 모든 단일 원소 컬렉션이 구현하는 인터페이스다. 핵심 메서드:

```java
// 원소 수
int size();
boolean isEmpty();

// 포함 여부
boolean contains(Object o);
boolean containsAll(Collection<?> c);

// 추가
boolean add(E e);
boolean addAll(Collection<? extends E> c);

// 제거
boolean remove(Object o);
boolean removeAll(Collection<?> c);
boolean retainAll(Collection<?> c);
void clear();

// 변환
Object[] toArray();
<T> T[] toArray(T[] a);

// Java 8+
Stream<E> stream();
Stream<E> parallelStream();
```

## 구현체 선택 가이드

![컬렉션 구현체 선택 가이드](/assets/posts/java-collection-framework-guide.svg)

### List 선택
- **ArrayList**: 인덱스 접근이 많고, 끝에서만 추가/삭제 → **기본 선택**
- **LinkedList**: 양 끝 삽입/삭제가 빈번하거나 Deque가 필요 → 그 외엔 ArrayList가 더 빠름

### Set 선택
- **HashSet**: 순서 불필요, 빠른 contains → **기본 선택**
- **LinkedHashSet**: 삽입 순서를 유지하면서 중복 제거
- **TreeSet**: 정렬된 순서가 필요, `headSet`/`tailSet` 범위 검색

### Map 선택
- **HashMap**: 빠른 조회/삽입, 순서 불필요 → **기본 선택**
- **LinkedHashMap**: 삽입·접근 순서 유지, LRU 캐시 구현에 활용
- **TreeMap**: 키 정렬 순서, 범위 검색(`subMap`, `headMap`, `tailMap`)
- **ConcurrentHashMap**: 멀티스레드 환경에서 안전한 동시 접근

## Null 허용 여부

컬렉션마다 `null` 허용 정책이 다르다.

| 구현체 | null 원소/키 | null 값 |
|---|---|---|
| ArrayList | O | — |
| HashSet | O (1개) | — |
| LinkedHashSet | O (1개) | — |
| TreeSet | X (NullPointerException) | — |
| HashMap | O (키 1개) | O |
| TreeMap | X (키) | O |
| ConcurrentHashMap | X | X |

`TreeSet`과 `TreeMap`은 자연 정렬이나 Comparator를 사용하는데, `null`과의 비교가 불가능해서 예외를 던진다.

## Collections 유틸리티 클래스

`java.util.Collections`에 있는 정적 메서드들은 컬렉션 조작에 자주 쓰인다.

```java
List<Integer> list = new ArrayList<>(List.of(3, 1, 4, 1, 5));

Collections.sort(list);                   // [1, 1, 3, 4, 5]
Collections.reverse(list);               // [5, 4, 3, 1, 1]
Collections.shuffle(list);               // 무작위 섞기
Collections.min(list);                   // 1
Collections.max(list);                   // 5
Collections.frequency(list, 1);          // 2

// 불변 래퍼
List<Integer> immutable = Collections.unmodifiableList(list);
// immutable.add(6); // UnsupportedOperationException
```

---

**지난 글:** [제네릭 함정 — 흔한 실수와 주의사항](/posts/java-generics-pitfalls/)

**다음 글:** [List와 ArrayList — 순서 있는 컬렉션의 핵심](/posts/java-list-arraylist/)

<br>
읽어주셔서 감사합니다. 😊
