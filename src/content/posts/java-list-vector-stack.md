---
title: "Vector와 Stack — 레거시 스레드 안전 컬렉션"
description: "Vector와 Stack의 역사·내부 구조·synchronized 문제, Stack이 List를 상속하는 설계 결함, 그리고 현대 Java에서 ArrayDeque와 Collections.synchronizedList로 대체하는 실전 마이그레이션 가이드"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Vector", "Stack", "레거시", "ArrayDeque", "스레드 안전"]
featured: false
draft: false
---

[지난 글](/posts/java-list-linkedlist/)에서 LinkedList의 이중 연결 리스트 구조를 살펴봤다. 이번에는 Java 1.0 시절부터 존재하는 **`Vector`와 `Stack`**을 다룬다. 두 클래스는 지금도 표준 라이브러리에 남아 있어 레거시 코드에서 종종 만날 수 있지만, 현대 Java 개발에서는 더 나은 대안으로 교체하는 것이 권장된다.

## Vector — 최초의 동기화된 List

`Vector`는 Java 1.0에서 도입된 동적 배열 구현체다. Java 1.2에서 컬렉션 프레임워크가 도입될 때 `AbstractList`를 구현하도록 개조되어 `List` 인터페이스를 만족하게 됐다.

```java
import java.util.Vector;

Vector<String> v = new Vector<>();
v.add("apple");
v.add("banana");
v.add("cherry");

System.out.println(v.get(0));        // "apple"
System.out.println(v.size());        // 3
System.out.println(v.capacity());    // 기본 10, 꽉 차면 2배 확장
```

`ArrayList`와 달리 `Vector`는 **모든 공개 메서드에 `synchronized`가 붙어 있다**. 단일 스레드 환경에서도 매 호출마다 락 획득/해제 비용이 발생한다.

```java
// Vector 내부 (간략화)
public synchronized boolean add(E e) { ... }
public synchronized E get(int index) { ... }
public synchronized int size() { ... }
public synchronized void clear() { ... }
```

**용량(capacity) 확장 전략**도 ArrayList와 다르다. `ArrayList`는 현재 크기의 1.5배로 확장하지만, `Vector`는 `capacityIncrement` 파라미터가 0이면 현재 용량의 **2배**로 확장한다. 메모리를 더 많이 낭비하는 경향이 있다.

![Vector · Stack 클래스 계층](/assets/posts/java-list-vector-stack-hierarchy.svg)

## Stack — Vector를 상속하는 설계 실수

`Stack`은 `Vector`를 상속(`extends Vector`)하는 방식으로 구현되어 있다. 이 설계는 심각한 결함이다.

```java
import java.util.Stack;

Stack<Integer> stack = new Stack<>();
stack.push(10);
stack.push(20);
stack.push(30);

System.out.println(stack.peek());   // 30 (제거 없이 최상단 확인)
System.out.println(stack.pop());    // 30 (제거)
System.out.println(stack.empty());  // false (10, 20 남음)
System.out.println(stack.search(10)); // 2 (1이 top, 2가 그 아래)
```

`Stack`이 `Vector`를 상속하기 때문에 `List`의 모든 메서드가 그대로 노출된다. 인덱스로 중간 원소에 접근하거나 `add(index, e)`로 스택 중간에 삽입하는 것도 문법적으로 가능하다 — 스택의 LIFO 캡슐화가 완전히 깨진다.

```java
Stack<Integer> stack = new Stack<>();
stack.push(1); stack.push(2); stack.push(3);

// 스택임에도 List 메서드 전부 노출
stack.add(1, 99);           // 인덱스 1에 삽입 — 스택 의미 위반
stack.remove(0);            // 바닥 원소 제거 — 스택 의미 위반
System.out.println(stack.get(0)); // List 방식 접근
```

![Stack vs ArrayDeque — LIFO 연산 비교](/assets/posts/java-list-vector-stack-operations.svg)

## 현대적 대안

### 단일 스레드 스택: ArrayDeque

```java
import java.util.ArrayDeque;
import java.util.Deque;

Deque<Integer> stack = new ArrayDeque<>();
stack.push(1);   // addFirst
stack.push(2);
stack.push(3);

System.out.println(stack.peek());  // 3
System.out.println(stack.pop());   // 3

// Deque 인터페이스 타입을 쓰므로 get(0) 등 List 메서드가 없음
```

`ArrayDeque`는 동기화가 없어 단일 스레드에서 더 빠르다. 또한 `Deque` 인터페이스 타입으로 선언하면 LIFO 연산만 노출되어 캡슐화가 보장된다.

### 스레드 안전 List: Collections.synchronizedList

`Vector`를 다중 스레드 환경에서 List로 쓰던 코드를 마이그레이션할 때:

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

// Vector 대체: 동기화 래퍼
List<String> syncList =
    Collections.synchronizedList(new ArrayList<>());

// 주의: 복합 연산은 별도로 동기화해야 함
synchronized (syncList) {
    if (!syncList.contains("x")) {
        syncList.add("x");
    }
}
```

더 높은 동시성이 필요하다면 `CopyOnWriteArrayList`(읽기 다수·쓰기 드문 경우) 또는 `ConcurrentLinkedQueue`를 고려한다.

### Vector의 Enumeration

레거시 코드에서 `Vector`를 `Enumeration`으로 순회하는 패턴을 볼 수 있다:

```java
Vector<String> v = new Vector<>(List.of("a", "b", "c"));

// 레거시 방식
java.util.Enumeration<String> e = v.elements();
while (e.hasMoreElements()) {
    System.out.println(e.nextElement());
}

// 현대 방식 (Iterator 또는 향상 for문)
for (String s : v) {
    System.out.println(s);
}
```

## 마이그레이션 요약

| 레거시 | 현대 대체 | 이유 |
|---|---|---|
| `new Vector<>()` | `new ArrayList<>()` | 단일 스레드, 더 빠름 |
| `new Vector<>()` (멀티스레드) | `Collections.synchronizedList(new ArrayList<>())` | 명시적 동기화 |
| `new Stack<>()` | `new ArrayDeque<>()` | LIFO 캡슐화, 더 빠름 |
| `v.elements()` | `for-each` / `Iterator` | 현대 순회 API |

`Vector`와 `Stack`은 Java 표준 라이브러리에서 공식적으로 deprecated 처리되어 있지 않지만, Javadoc에 "use ArrayList instead", "use ArrayDeque instead"라는 권고가 명시되어 있다.

---

**지난 글:** [LinkedList — 이중 연결 리스트의 구조와 실전 활용](/posts/java-list-linkedlist/)

**다음 글:** [HashSet — 해시 기반 중복 없는 컬렉션](/posts/java-set-hashset/)

<br>
읽어주셔서 감사합니다. 😊
