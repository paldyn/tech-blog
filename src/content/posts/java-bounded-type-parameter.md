---
title: "경계 타입 파라미터 — extends와 super로 범위 제한"
description: "상한 경계 <T extends Number>, 다중 경계 <T extends A & B>, 경계 지정 시 T의 메서드 호출 가능성, 재귀 타입 경계 <T extends Comparable<T>>, 그리고 min·sum 구현 실전 예제"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "Bounded Type Parameter", "extends", "Comparable", "상한 경계"]
featured: false
draft: false
---

[지난 글](/posts/java-generic-method/)에서 메서드 수준의 타입 파라미터를 다뤘다. 이번에는 **경계 타입 파라미터(Bounded Type Parameter)**를 살펴본다. 타입 파라미터 `<T>`는 기본적으로 어떤 타입이든 받을 수 있다. 하지만 "숫자여야 한다", "비교 가능해야 한다"처럼 특정 조건을 요구하는 코드에서는 경계를 지정해 범위를 제한해야 한다.

## 상한 경계 `<T extends Bound>`

`extends` 키워드로 `T`가 받아들일 수 있는 타입의 **상한선**을 지정한다. `T`는 `Bound` 자신이거나 그 하위 타입이어야 한다.

```java
// T는 Number 또는 Number의 하위 타입만 가능
public static <T extends Number> double sum(List<T> list) {
    double total = 0;
    for (T n : list) {
        total += n.doubleValue(); // Number 메서드 호출 가능
    }
    return total;
}
```

경계를 지정하면 `T`가 `Number`의 메서드를 가지고 있음을 보장하므로, 컴파일러는 `n.doubleValue()` 같은 호출을 허용한다. 경계 없는 `<T>`였다면 이 호출은 컴파일 오류가 난다.

```java
sum(List.of(1, 2, 3));         // T = Integer ✓
sum(List.of(1.5, 2.5, 3.0));  // T = Double ✓
// sum(List.of("a", "b"));     // T = String — Number 하위 아님, 오류
```

## 재귀 타입 경계 `<T extends Comparable<T>>`

`T`가 자기 자신과 비교 가능해야 할 때 자주 쓰는 패턴이다.

```java
public static <T extends Comparable<T>> T min(T a, T b) {
    return a.compareTo(b) <= 0 ? a : b;
}

public static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}
```

```java
int  m1 = min(3, 7);         // T = Integer → 3
String m2 = min("apple", "banana"); // T = String → "apple"
```

`String`, `Integer`, `LocalDate` 등 `Comparable`을 구현한 모든 타입에 하나의 메서드가 동작한다.

![경계 타입 파라미터 계층 구조](/assets/posts/java-bounded-type-parameter-hierarchy.svg)

![경계 타입 파라미터 코드 예제](/assets/posts/java-bounded-type-parameter-code.svg)

## 다중 경계 `<T extends A & B & C>`

`&`로 연결해 여러 상한을 동시에 지정할 수 있다. 이때 **첫 번째만 클래스**이고 나머지는 반드시 **인터페이스**여야 한다.

```java
// Number 클래스 + Comparable 인터페이스
public static <T extends Number & Comparable<T>> T clamp(T val, T min, T max) {
    if (val.compareTo(min) < 0) return min;
    if (val.compareTo(max) > 0) return max;
    return val;
}

// 인터페이스만 여러 개
public static <T extends Serializable & Cloneable> void persist(T obj) { ... }
```

```java
int clamped = clamp(15, 0, 10); // 10 (상한 초과)
int ok      = clamp(5, 0, 10);  // 5  (범위 안)
```

클래스 두 개를 동시에 `extends` 하는 건 Java의 단일 상속 규칙상 불가능하다.

```java
// 컴파일 오류 — 클래스 두 개 extends 불가
// <T extends ArrayList & LinkedList>
```

## 실전 활용 — 정렬 가능한 바이너리 트리

경계 타입 파라미터는 자료구조를 구현할 때 매우 유용하다.

```java
class BinarySearchTree<T extends Comparable<T>> {
    private T value;
    private BinarySearchTree<T> left, right;

    public BinarySearchTree(T value) {
        this.value = value;
    }

    public void insert(T item) {
        if (item.compareTo(value) < 0) {
            if (left == null) left = new BinarySearchTree<>(item);
            else left.insert(item);
        } else {
            if (right == null) right = new BinarySearchTree<>(item);
            else right.insert(item);
        }
    }

    public boolean contains(T item) {
        int cmp = item.compareTo(value);
        if (cmp == 0) return true;
        if (cmp < 0)  return left  != null && left.contains(item);
        return right != null && right.contains(item);
    }
}
```

`T extends Comparable<T>` 덕분에 `compareTo`를 안전하게 호출할 수 있다.

---

**지난 글:** [제네릭 메서드 — 메서드 수준의 타입 매개변수](/posts/java-generic-method/)

**다음 글:** [와일드카드 — ? 타입의 유연성](/posts/java-wildcards/)

<br>
읽어주셔서 감사합니다. 😊
