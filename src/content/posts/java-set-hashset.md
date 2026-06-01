---
title: "HashSet — 해시 기반 중복 없는 컬렉션"
description: "HashSet 내부 HashMap 기반 구조, 해시 버킷과 충돌 처리(연결 리스트→트리), equals/hashCode 계약, load factor와 capacity 튜닝, 그리고 HashSet을 올바르게 사용하기 위한 실전 패턴"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Set", "HashSet", "hashCode", "equals", "해시", "버킷"]
featured: false
draft: false
---

[지난 글](/posts/java-list-vector-stack/)에서 레거시 Vector와 Stack을 살펴봤다. 이번에는 **`HashSet`**을 다룬다. `HashSet`은 Java에서 가장 많이 쓰이는 `Set` 구현체로, 중복 없는 원소 저장과 O(1) 평균 검색 성능을 제공한다.

## HashSet은 HashMap 위에 올라탄 Set

`HashSet`의 핵심을 한 줄로 표현하면: **`HashMap<E, Object>`의 키 집합을 Set처럼 노출하는 래퍼**다.

```java
// java.util.HashSet 내부 (간략화)
private transient HashMap<E, Object> map;
private static final Object PRESENT = new Object(); // 더미 값

public boolean add(E e) {
    return map.put(e, PRESENT) == null;
}

public boolean contains(Object o) {
    return map.containsKey(o);
}

public boolean remove(Object o) {
    return map.remove(o) == PRESENT;
}
```

원소는 HashMap의 **키**로, 더미 싱글턴 `PRESENT`는 항상 동일한 **값**으로 저장된다. 덕분에 키의 중복 감지 로직(hashCode + equals)이 그대로 Set의 중복 제거 로직으로 활용된다.

![HashSet 내부 구조 — HashMap 기반](/assets/posts/java-set-hashset-structure.svg)

## 해시 버킷과 충돌 처리

원소를 추가할 때 내부에서 일어나는 과정:

1. `element.hashCode()` 계산
2. 보조 해시 함수 적용: `(h = key.hashCode()) ^ (h >>> 16)` (높은 비트와 낮은 비트 믹싱)
3. 버킷 인덱스 계산: `hash & (capacity - 1)`
4. 해당 버킷에 원소 삽입 (충돌 시 연결 리스트로 체이닝)

Java 8 이후 **버킷 하나에 원소가 8개 이상** 쌓이면 연결 리스트를 **Red-Black Tree**로 전환한다. 이로써 최악의 경우 O(n) 검색이 O(log n)으로 개선된다.

```java
import java.util.HashSet;
import java.util.Set;

Set<String> fruits = new HashSet<>();
fruits.add("apple");
fruits.add("banana");
fruits.add("apple");  // 중복 — 무시됨

System.out.println(fruits.size());      // 2
System.out.println(fruits.contains("banana")); // true
System.out.println(fruits);             // 순서 보장 없음
```

## equals/hashCode 계약

`HashSet`이 올바르게 작동하려면 원소 클래스가 `equals`와 `hashCode`를 일관되게 구현해야 한다.

![equals / hashCode 계약](/assets/posts/java-set-hashset-contract.svg)

**계약 핵심**: `equals()` 가 `true`를 반환하면 반드시 같은 `hashCode()`를 반환해야 한다. 반대는 성립하지 않아도 된다(충돌). `equals`만 재정의하고 `hashCode`를 재정의하지 않으면 같은 값을 가진 두 객체가 다른 버킷에 저장되어 중복 원소가 생긴다.

```java
import java.util.Objects;

public class Point {
    private final int x, y;

    public Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Point p)) return false;
        return x == p.x && y == p.y;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y);  // 두 필드 모두 반영
    }
}

Set<Point> points = new HashSet<>();
points.add(new Point(1, 2));
points.add(new Point(1, 2)); // 중복 제거
System.out.println(points.size()); // 1
```

`Objects.hash(...)` 또는 IDE 생성 코드를 쓰면 안전하다. Java 14+ `record`는 equals/hashCode를 자동으로 올바르게 생성해준다.

## load factor와 initialCapacity 튜닝

```java
// 기본: capacity=16, loadFactor=0.75
Set<String> s1 = new HashSet<>();

// 예상 원소 수를 알 때: initialCapacity 지정 (rehash 방지)
// 원소 수 N을 저장하려면 capacity >= N / loadFactor
Set<String> s2 = new HashSet<>(200); // 최소 150개 원소 수용

// loadFactor 조정: 낮을수록 메모리 낭비, 높을수록 충돌 증가
Set<String> s3 = new HashSet<>(16, 0.5f); // 공간-성능 트레이드오프
```

- `loadFactor` 기본값 0.75는 공간 효율과 충돌률의 균형점이다.
- 원소 수를 미리 알고 있다면 `initialCapacity = (int)(expectedSize / loadFactor) + 1`로 설정해 rehash 비용을 줄인다.

## 집합 연산

```java
Set<Integer> a = new HashSet<>(Set.of(1, 2, 3, 4));
Set<Integer> b = new HashSet<>(Set.of(3, 4, 5, 6));

// 합집합
Set<Integer> union = new HashSet<>(a);
union.addAll(b);              // {1, 2, 3, 4, 5, 6}

// 교집합
Set<Integer> intersection = new HashSet<>(a);
intersection.retainAll(b);    // {3, 4}

// 차집합
Set<Integer> diff = new HashSet<>(a);
diff.removeAll(b);            // {1, 2}
```

## 성능 특성

| 연산 | 평균 | 최악 (Java 8 이후) |
|---|---|---|
| `add(e)` | O(1) | O(log n) |
| `remove(o)` | O(1) | O(log n) |
| `contains(o)` | O(1) | O(log n) |
| 순회 | O(capacity + size) | O(capacity + size) |

순회 비용에 `capacity`가 포함되는 점 주의 — 버킷이 크고 원소가 적으면 빈 버킷을 다 건너뛰어야 한다.

---

**지난 글:** [Vector와 Stack — 레거시 스레드 안전 컬렉션](/posts/java-list-vector-stack/)

**다음 글:** [LinkedHashSet — 삽입 순서를 유지하는 Set](/posts/java-set-linkedhashset/)

<br>
읽어주셔서 감사합니다. 😊
