---
title: "List와 ArrayList — 순서 있는 컬렉션의 핵심"
description: "List 인터페이스의 핵심 메서드, ArrayList 내부 동적 배열 구조와 1.5배 확장 원리, 성능 특성(O(1) get vs O(n) insert), initialCapacity 최적화, ArrayList와 LinkedList 선택 기준"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "List", "ArrayList", "LinkedList", "동적 배열", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-collection-framework/)에서 컬렉션 프레임워크의 전체 구조를 살펴봤다. 이번에는 가장 많이 쓰이는 컬렉션인 **`List`와 `ArrayList`**를 깊이 파헤친다. 단순히 쓰는 방법을 넘어, 내부 구조를 이해하면 성능 문제를 예측하고 올바른 최적화 전략을 선택할 수 있다.

## List 인터페이스

`List`는 **순서가 있고, 중복을 허용하는** 시퀀스다. 인덱스로 원소에 접근할 수 있다는 점이 `Set`과 다른 핵심 특징이다.

```java
public interface List<E> extends Collection<E> {
    // 인덱스 기반 접근
    E get(int index);
    E set(int index, E element);
    void add(int index, E element);
    E remove(int index);

    // 검색
    int indexOf(Object o);
    int lastIndexOf(Object o);

    // 부분 리스트
    List<E> subList(int fromIndex, int toIndex);

    // 정렬 (Java 8+)
    void sort(Comparator<? super E> c);

    // 팩토리 (Java 9+)
    static <E> List<E> of(E... elements)
    static <E> List<E> copyOf(Collection<? extends E> coll)
}
```

## ArrayList 내부 구조

`ArrayList`는 이름 그대로 배열(`Object[] elementData`)을 기반으로 한다. **동적 배열(Dynamic Array)**이라고도 부른다.

```java
// ArrayList 핵심 필드 (OpenJDK 기준)
private Object[] elementData; // 실제 데이터 저장 배열
private int size;             // 현재 원소 수 (≤ elementData.length)
```

`size`는 원소 수이고, 배열의 길이(`elementData.length`)는 **용량(capacity)**이다. 용량은 항상 size 이상이다.

![ArrayList 내부 구조](/assets/posts/java-list-arraylist-structure.svg)

## 동적 확장 원리

원소를 추가할 때 `size == capacity`가 되면 내부 배열을 **1.5배** 크기로 복사해 확장한다.

```java
// OpenJDK ArrayList.grow() 핵심 로직
private Object[] grow(int minCapacity) {
    int oldCapacity = elementData.length;
    int newCapacity = oldCapacity + (oldCapacity >> 1); // × 1.5
    // newCapacity가 minCapacity보다 작으면 minCapacity 사용
    return elementData = Arrays.copyOf(elementData, newCapacity);
}
```

확장 시 `Arrays.copyOf`로 전체 배열을 복사하므로 **O(n)**이 걸린다. 하지만 확장 횟수가 log(n)이므로 **분할 상환(amortized) O(1)**으로 볼 수 있다.

## initialCapacity — 확장 비용 줄이기

원소 개수를 미리 알면 초기 용량을 지정해 불필요한 확장과 복사를 막을 수 있다.

```java
// 1,000개 원소 예상 → 처음부터 1,000 용량 확보
List<String> list = new ArrayList<>(1_000);

// 다른 컬렉션을 넣을 때
List<String> copy = new ArrayList<>(existingList.size());
copy.addAll(existingList);

// 또는 간단하게
List<String> copy = new ArrayList<>(existingList);
```

## 주요 연산의 시간 복잡도

| 연산 | ArrayList | LinkedList |
|---|---|---|
| `get(i)` | O(1) | O(n) |
| `add` (끝) | O(1) 분할 상환 | O(1) |
| `add(i)` (중간) | O(n) 이동 | O(n) 순회 |
| `remove(i)` | O(n) 이동 | O(n) 순회 |
| `contains` | O(n) | O(n) |
| 메모리 | 낮음 (배열) | 높음 (노드 포인터) |

![ArrayList vs LinkedList 성능 비교](/assets/posts/java-list-arraylist-operations.svg)

`ArrayList`가 `LinkedList`보다 **대부분의 연산에서 실제로 빠르다**. 이론상 중간 삽입은 `LinkedList`가 O(1)이지만, 삽입 위치를 찾는 데 O(n)이 필요하고, 메모리 레이아웃이 불연속적이어서 CPU 캐시 히트율이 낮다.

## 자주 쓰는 패턴

```java
List<String> list = new ArrayList<>(List.of("A", "B", "C"));

// 끝에 추가
list.add("D");

// 인덱스 위치에 삽입
list.add(1, "X"); // ["A", "X", "B", "C", "D"]

// 제거
list.remove(0);   // 인덱스로 제거
list.remove("X"); // 값으로 제거 (첫 번째 일치)

// 범위로 잘라내기
List<String> sub = list.subList(0, 2); // 뷰 — 원본 반영
sub.clear(); // 원본에서도 0~1번 제거됨

// 정렬
list.sort(Comparator.naturalOrder());
list.sort(Comparator.reverseOrder());

// 읽기 전용 뷰
List<String> unmodifiable = Collections.unmodifiableList(list);
List<String> immutableCopy = List.copyOf(list); // Java 10+
```

## 불변 List — List.of vs Arrays.asList

| 메서드 | null 허용 | 크기 변경 | 값 변경 |
|---|---|---|---|
| `List.of(...)` | X | X | X |
| `Arrays.asList(...)` | O | X (크기 고정) | O |
| `Collections.unmodifiableList` | O (원본 따라) | X | X |
| `new ArrayList<>(...)` | O | O | O |

```java
// List.of — 완전 불변
List<String> imm = List.of("a", "b");
// imm.add("c");      // UnsupportedOperationException
// imm.set(0, "x");  // UnsupportedOperationException

// Arrays.asList — 크기 고정, 값 변경 가능
List<String> fixed = Arrays.asList("a", "b");
fixed.set(0, "x");   // OK
// fixed.add("c");   // UnsupportedOperationException
```

---

**지난 글:** [컬렉션 프레임워크 개요 — Java Collections의 전체 구조](/posts/java-collection-framework/)

<br>
읽어주셔서 감사합니다. 😊
