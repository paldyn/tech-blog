---
title: "LinkedList — 이중 연결 리스트의 구조와 실전 활용"
description: "LinkedList 내부 이중 연결 리스트 노드 구조, ArrayList와의 성능 트레이드오프, Deque 인터페이스 구현체로서의 활용, 그리고 LinkedList를 실제로 선택해야 할 상황과 피해야 할 상황"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "LinkedList", "이중 연결 리스트", "Deque", "List", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-list-arraylist/)에서 ArrayList의 동적 배열 구조와 성능 특성을 살펴봤다. 이번에는 **`LinkedList`**를 다룬다. LinkedList는 ArrayList와 달리 연속된 메모리 블록 대신 노드 체인으로 데이터를 저장한다. "항상 ArrayList를 쓰라"는 통설 너머에 LinkedList가 진정 빛나는 상황이 존재한다.

## 내부 구조: 이중 연결 리스트

Java의 `LinkedList`는 **이중 연결 리스트(Doubly Linked List)**로 구현되어 있다. 각 원소는 독립적인 `Node<E>` 객체에 저장되며, 이전 노드와 다음 노드를 참조하는 두 포인터를 보유한다.

```java
// java.util.LinkedList 내부 (간략화)
private static class Node<E> {
    E item;
    Node<E> next;
    Node<E> prev;

    Node(Node<E> prev, E element, Node<E> next) {
        this.item = element;
        this.next = next;
        this.prev = prev;
    }
}
```

`LinkedList` 객체 자체는 `head`, `tail`, `size` 세 필드만 직접 보유한다. 원소를 추가하면 새 `Node`를 힙에 할당하고 기존 노드의 포인터만 교체하면 된다.

![LinkedList 내부 구조 — 이중 연결 리스트](/assets/posts/java-list-linkedlist-structure.svg)

## 주요 연산과 시간 복잡도

![ArrayList vs LinkedList 연산별 성능 비교](/assets/posts/java-list-linkedlist-performance.svg)

**인덱스 접근 `get(i)`**: 배열처럼 임의 접근이 불가능하다. `head`(또는 `tail`)에서 순차적으로 포인터를 따라가야 하므로 O(n)이다. `i < size/2`이면 `head`에서, 그 반대이면 `tail`에서 탐색해 절반으로 줄이지만 여전히 O(n)이다.

**끝에 추가 `add(e)`**: `tail` 포인터를 알고 있으므로 새 노드를 `tail.next`에 연결하고 `tail`을 교체하면 된다. O(1).

**중간 삽입/삭제**: 노드 포인터 교체 자체는 O(1)이다. 단, *해당 위치 노드를 먼저 찾아야* 하기 때문에 인덱스 기반 호출(`add(i, e)`, `remove(i)`)은 내부적으로 탐색 O(n)을 수행한다. **반복자(Iterator)를 통해 현재 위치를 유지하는 경우에만 진정한 O(1) 삽입/삭제**가 보장된다.

## List 인터페이스 구현

```java
import java.util.LinkedList;
import java.util.List;
import java.util.ListIterator;

List<String> tasks = new LinkedList<>();
tasks.add("compile");
tasks.add("test");
tasks.add("deploy");

// 중간 삽입 — 반복자 사용 시 O(1)
ListIterator<String> it = tasks.listIterator(1);
it.add("lint");          // "test" 앞에 삽입
System.out.println(tasks); // [compile, lint, test, deploy]

// 인덱스 접근 — 내부적으로 O(n) 탐색
String second = tasks.get(1);   // "lint"
```

## Deque 인터페이스 구현

`LinkedList`는 `List`뿐만 아니라 **`Deque<E>`도 구현**한다는 점이 특징적이다. 양방향 큐(Double-Ended Queue)로 쓸 수 있다.

```java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedList;

// 스택처럼
Deque<Integer> stack = new LinkedList<>();
stack.push(1);   // addFirst
stack.push(2);
stack.push(3);
System.out.println(stack.pop());  // 3 (LIFO)

// 큐처럼
Deque<String> queue = new LinkedList<>();
queue.offer("a");
queue.offer("b");
System.out.println(queue.poll()); // "a" (FIFO)
```

다만 Deque 용도라면 **`ArrayDeque`가 LinkedList보다 빠르다** — 배열 기반으로 캐시 지역성이 좋고 노드 객체 할당이 없기 때문이다.

## LinkedList vs ArrayList 선택 기준

LinkedList가 ArrayList보다 유리한 경우:

1. **Iterator를 통한 대량 중간 삽입/삭제**: 순차 순회 중 많은 원소를 삽입·삭제하는 편집 워크플로.
2. **Queue/Deque 구현 (성능보다 코드 명확성 우선)**: `ArrayDeque`가 없던 시절 코드베이스 유지.
3. **무한히 증가하는 순차 큐**: 배열 복사 비용을 원천적으로 제거.

반대로 **대부분의 상황에서는 ArrayList**가 낫다. 인덱스 접근, 캐시 지역성, 메모리 오버헤드(각 노드가 두 포인터를 추가 보유) 모두 ArrayList에 유리하다.

```java
// 잘못된 패턴: 인덱스로 LinkedList 순회
LinkedList<Integer> list = new LinkedList<>(List.of(1, 2, 3, 4, 5));
for (int i = 0; i < list.size(); i++) {
    System.out.println(list.get(i)); // 매번 O(n) 탐색 — O(n²) 전체!
}

// 올바른 패턴: 향상 for문 또는 Iterator 사용
for (int v : list) {
    System.out.println(v);           // 내부적으로 Iterator — O(n)
}
```

## 메모리 고려사항

`ArrayList`는 원소마다 참조(8바이트) 하나만 추가하지만, `LinkedList`는 각 `Node` 객체(헤더 16바이트 + item 8바이트 + next 8바이트 + prev 8바이트 = 40바이트)를 별도로 힙에 할당한다. 원소 수가 많을수록 메모리 사용량과 GC 부담이 커진다.

```java
// 메모리 비교 시뮬레이션 (원소 100만 개)
// ArrayList:  ~8MB (참조 배열)
// LinkedList: ~40MB (노드 객체 × 100만)
```

원소 수가 수만 이상이고 랜덤 접근이 빈번하다면 LinkedList는 현실적으로 사용 적합도가 낮다.

## 요약

| 특성 | LinkedList |
|---|---|
| 구현 | 이중 연결 리스트 |
| `get(i)` | O(n) |
| 끝에 `add` | O(1) |
| Iterator 삽입/삭제 | O(1) |
| 구현 인터페이스 | `List`, `Deque` |
| 메모리 오버헤드 | 높음 (노드 객체) |

---

**지난 글:** [List와 ArrayList — 순서 있는 컬렉션의 핵심](/posts/java-list-arraylist/)

**다음 글:** [Vector와 Stack — 레거시 스레드 안전 컬렉션](/posts/java-list-vector-stack/)

<br>
읽어주셔서 감사합니다. 😊
