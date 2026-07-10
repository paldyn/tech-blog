---
title: "Queue와 Deque — 큐와 양방향 큐 인터페이스"
description: "Queue와 Deque 인터페이스 계층, offer/poll/peek의 null 반환 vs add/remove/element의 예외 방식, ArrayDeque를 Queue·Stack으로 사용하는 패턴, PriorityQueue·BlockingQueue 등 주요 구현체 비교"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Queue", "Deque", "ArrayDeque", "LinkedList", "PriorityQueue"]
featured: false
draft: false
---

[지난 글](/posts/java-map-concurrenthashmap/)에서 ConcurrentHashMap의 버킷 단위 잠금 구조를 살펴봤다. 이번에는 **`Queue`와 `Deque`** 인터페이스를 다룬다. FIFO, LIFO, 양방향 접근 등 다양한 큐 패턴의 기반이 되는 인터페이스와 그 구현체들을 정리한다.

## Queue 인터페이스

`Queue<E>`는 `Collection<E>`을 확장하며 **FIFO(First-In First-Out)** 원칙으로 원소를 처리한다. 핵심 메서드는 두 가지 형태로 제공된다: 실패 시 예외를 던지는 방식과 null/false를 반환하는 안전한 방식.

```java
import java.util.ArrayDeque;
import java.util.Queue;

Queue<String> queue = new ArrayDeque<>();

// 삽입: offer (safe) vs add (throw on failure)
queue.offer("first");
queue.offer("second");
queue.offer("third");

// 조회: peek (null on empty) vs element (throw on empty)
System.out.println(queue.peek());   // "first" (제거 없음)

// 제거: poll (null on empty) vs remove (throw on empty)
System.out.println(queue.poll());   // "first" (제거)
System.out.println(queue.size());   // 2
```

항상 `offer`/`poll`/`peek` 조합을 사용하는 것이 권장된다. 용량 제한 큐(BlockingQueue 등)에서 `add`가 `IllegalStateException`을 던질 수 있는 반면, `offer`는 `false`를 반환한다.

## Deque 인터페이스

`Deque<E>`는 `Queue<E>`를 확장하며 **양쪽 끝(head/tail)에서 삽입·조회·제거**가 가능하다.

![Queue / Deque 계층 구조](/assets/posts/java-queue-deque-hierarchy.svg)

![Queue / Deque 메서드 대응표](/assets/posts/java-queue-deque-methods.svg)

## ArrayDeque — 권장 구현체

`ArrayDeque`는 Deque 인터페이스의 배열 기반 구현체로, Queue와 Stack 모두에 LinkedList보다 우수한 성능을 제공한다.

```java
import java.util.ArrayDeque;
import java.util.Deque;

// Queue로 사용 (FIFO)
Deque<String> queue = new ArrayDeque<>();
queue.offer("a");      // = offerLast
queue.offer("b");
System.out.println(queue.poll()); // "a" = pollFirst

// Stack으로 사용 (LIFO)
Deque<Integer> stack = new ArrayDeque<>();
stack.push(1);   // = addFirst
stack.push(2);
stack.push(3);
System.out.println(stack.pop());  // 3 = removeFirst
```

`ArrayDeque`는 순환 배열로 구현되어 있어 양쪽 끝 삽입/제거가 모두 O(1)이다. null을 허용하지 않고 동기화도 없다.

## LinkedList — Deque 구현체이지만 추천하지 않는 이유

`LinkedList`도 `Deque`를 구현하지만, 노드 기반 구조로 인해 캐시 지역성이 낮아 `ArrayDeque`보다 느리다. 또한 `List` 인터페이스도 함께 구현하므로 인덱스 접근 등 큐의 의미를 벗어나는 연산이 노출된다. Queue/Deque 용도로만 쓴다면 `ArrayDeque`가 항상 더 나은 선택이다.

```java
// 비추 — LinkedList를 Queue로 사용
Queue<String> q1 = new LinkedList<>();

// 권장 — ArrayDeque를 Queue로 사용
Queue<String> q2 = new ArrayDeque<>();
```

## PriorityQueue — 우선순위 큐

`PriorityQueue`는 원소를 삽입 순서가 아닌 **우선순위(최솟값 우선)** 순으로 꺼낸다. 내부는 이진 최소 힙(min-heap)으로 구현된다.

```java
import java.util.PriorityQueue;

// 기본: 오름차순 (가장 작은 원소가 head)
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.offer(5); pq.offer(1); pq.offer(3);
System.out.println(pq.poll()); // 1 (최솟값)
System.out.println(pq.poll()); // 3
System.out.println(pq.poll()); // 5

// 내림차순
PriorityQueue<Integer> maxPQ =
    new PriorityQueue<>(java.util.Comparator.reverseOrder());
maxPQ.offer(5); maxPQ.offer(1); maxPQ.offer(3);
System.out.println(maxPQ.poll()); // 5 (최댓값)
```

`offer`/`poll`이 O(log n)이고, `peek`(최솟값 확인)이 O(1)이다.

## BlockingQueue — 멀티스레드 큐

`BlockingQueue`는 `Queue`의 스레드 안전 확장으로, 생산자-소비자 패턴에 사용된다.

```java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

BlockingQueue<String> bq = new ArrayBlockingQueue<>(100);

// 생산자 스레드: 가득 차면 블록
bq.put("item");        // 대기

// 소비자 스레드: 비어 있으면 블록
String item = bq.take();

// 타임아웃 버전
bq.offer("item", 100, java.util.concurrent.TimeUnit.MILLISECONDS);
bq.poll(100, java.util.concurrent.TimeUnit.MILLISECONDS);
```

주요 구현체: `ArrayBlockingQueue`(고정 크기), `LinkedBlockingQueue`(가변 크기), `LinkedBlockingDeque`(양방향 블로킹).

## 선택 가이드

| 필요한 것 | 권장 구현체 |
|---|---|
| 기본 FIFO 큐 | `ArrayDeque` |
| LIFO 스택 | `ArrayDeque` |
| 우선순위 기반 처리 | `PriorityQueue` |
| 생산자-소비자 멀티스레드 | `LinkedBlockingQueue` |
| 양방향 블로킹 | `LinkedBlockingDeque` |

---

**지난 글:** [ConcurrentHashMap — 고성능 동시성 맵](/posts/java-map-concurrenthashmap/)

**다음 글:** [PriorityQueue — 우선순위 큐의 힙 구조와 활용](/posts/java-priority-queue/)

<br>
읽어주셔서 감사합니다. 😊
