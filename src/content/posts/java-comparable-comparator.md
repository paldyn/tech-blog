---
title: "Java Comparable과 Comparator — 자연 순서와 커스텀 정렬"
description: "java.lang.Comparable과 java.util.Comparator의 차이, compareTo() 반환값 규칙, Comparator.comparing()과 thenComparing()으로 다중 기준 정렬 체이닝, Collections.sort와 TreeMap에서의 활용법을 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Comparable", "Comparator", "정렬", "자연순서", "Collections.sort", "TreeMap"]
featured: false
draft: false
---

[지난 글](/posts/java-finalize-removed/)에서 `finalize()` 폐기 이유와 올바른 자원 관리 방법을 살펴봤다. 이번에는 Java에서 객체를 정렬하는 두 가지 방법인 **`Comparable`**과 **`Comparator`**를 다룬다. 둘 다 정렬 기준을 정의하지만 목적과 사용 방식이 다르다.

## 왜 두 가지가 필요한가

정수나 문자열은 크기가 자명하다. 하지만 `Person` 객체는 이름순인지, 나이순인지, 아니면 두 기준을 조합해야 하는지 알 수 없다. Java는 이 문제를 두 가지 방식으로 해결한다.

- **`Comparable`**: 클래스 자체에 "이 클래스의 자연 순서"를 내장
- **`Comparator`**: 외부에서 임의의 정렬 기준을 주입

## Comparable — 자연 순서 정의

`java.lang.Comparable<T>` 인터페이스는 메서드 하나만 가진다.

```java
public interface Comparable<T> {
    int compareTo(T o);
}
```

반환값 규칙: 음수이면 `this`가 앞, 0이면 동등, 양수이면 `this`가 뒤.

```java
record Age(int value) implements Comparable<Age> {
    @Override
    public int compareTo(Age other) {
        return Integer.compare(this.value, other.value);
    }
}

var ages = new ArrayList<>(List.of(new Age(30), new Age(20), new Age(25)));
Collections.sort(ages);  // Comparable 자동 사용
System.out.println(ages); // [Age[value=20], Age[value=25], Age[value=30]]
```

`Integer.compare(a, b)`를 사용하는 것이 올바르다. `a - b` 뺄셈 방식은 정수 오버플로우 버그를 일으킬 수 있다.

## Comparable을 구현하는 JDK 클래스들

`String`, `Integer`, `Double`, `LocalDate`, `BigDecimal` 등 자연 순서가 자명한 클래스들이 `Comparable`을 구현한다.

```java
List<String> names = Arrays.asList("Charlie", "Alice", "Bob");
Collections.sort(names); // String.compareTo() 사용
System.out.println(names); // [Alice, Bob, Charlie]

TreeSet<Integer> nums = new TreeSet<>();
nums.addAll(List.of(5, 3, 8, 1));
System.out.println(nums); // [1, 3, 5, 8] — 자동 정렬
```

`TreeSet`, `TreeMap`, `PriorityQueue`는 원소가 `Comparable`을 구현하거나 외부 `Comparator`를 받아야 한다.

## Comparator — 외부 정렬 기준

`java.util.Comparator<T>`는 두 객체를 비교하는 함수형 인터페이스다.

```java
@FunctionalInterface
public interface Comparator<T> {
    int compare(T o1, T o2);
}
```

람다나 메서드 참조로 간결하게 작성한다.

```java
record Person(String name, int age) { }

Comparator<Person> byName = (a, b) -> a.name().compareTo(b.name());
Comparator<Person> byAge  = Comparator.comparingInt(Person::age);

var people = new ArrayList<>(List.of(
    new Person("Charlie", 30),
    new Person("Alice", 25),
    new Person("Bob", 25)
));

people.sort(byName);   // 이름순
people.sort(byAge);    // 나이순
people.sort(byAge.reversed()); // 나이 역순
```

![Comparable vs Comparator 비교](/assets/posts/java-comparable-comparator-diff.svg)

## Comparator.comparing() 팩터리 메서드

`Comparator.comparing()`은 키 추출 함수를 받아 `Comparator`를 만든다.

```java
// 키 추출 함수로 Comparator 생성
Comparator<Person> c1 = Comparator.comparing(Person::name);
Comparator<Person> c2 = Comparator.comparingInt(Person::age);
Comparator<Person> c3 = Comparator.comparingDouble(Person::salary);
```

`comparing()` vs `comparingInt()`: `comparingInt()`는 `int` 키를 오토박싱 없이 처리해 성능이 더 좋다. `comparingLong()`, `comparingDouble()`도 같은 이유로 존재한다.

## thenComparing() — 다중 기준 체이닝

```java
record Employee(String dept, String name, int salary) { }

// 부서 오름차순 → 이름 오름차순 → 급여 내림차순
Comparator<Employee> order =
    Comparator.comparing(Employee::dept)
              .thenComparing(Employee::name)
              .thenComparingInt(Employee::salary)
              .reversed();

employees.sort(order);
```

`thenComparing()`은 앞 기준이 동순위일 때 다음 기준을 적용한다. `reversed()`는 지금까지 정의한 전체 순서를 뒤집는다.

![Comparator 체이닝 — 다중 기준 정렬](/assets/posts/java-comparable-comparator-chain.svg)

## null 처리

`null`이 포함된 컬렉션을 정렬할 때 `nullsFirst()` / `nullsLast()`를 사용한다.

```java
List<String> withNulls = Arrays.asList("B", null, "A", null, "C");

// null이 앞에
withNulls.sort(Comparator.nullsFirst(Comparator.naturalOrder()));
System.out.println(withNulls); // [null, null, A, B, C]

// null이 뒤에
withNulls.sort(Comparator.nullsLast(Comparator.naturalOrder()));
System.out.println(withNulls); // [A, B, C, null, null]
```

## TreeMap에서의 Comparator

`TreeMap`에 생성자로 `Comparator`를 전달하면 키의 자연 순서 대신 커스텀 순서로 관리된다.

```java
// 대소문자 무시 정렬
var map = new TreeMap<String, Integer>(String.CASE_INSENSITIVE_ORDER);
map.put("banana", 2);
map.put("Apple", 1);
map.put("cherry", 3);

System.out.println(map.firstKey()); // Apple
System.out.println(map);            // {Apple=1, banana=2, cherry=3}
```

## Comparable과 Comparator 선택 기준

| 상황 | 권장 |
|---|---|
| 클래스에 "자명한 자연 순서"가 하나 있음 | `Comparable` 구현 |
| 다양한 정렬 기준이 필요함 | `Comparator` 사용 |
| 외부 라이브러리 클래스 정렬 | `Comparator` (소스 수정 불가) |
| 클래스를 내 코드로 정의함 | `Comparable` + 필요 시 `Comparator` 추가 |

## compareTo() 계약

`compareTo()`는 `equals()`와 **일관성**을 유지해야 한다. `compareTo()` == 0이면 `equals()` == true를 반환하는 것이 권장된다. `TreeSet`과 `TreeMap`은 `equals()` 대신 `compareTo()`로 동등성을 판단한다. 두 메서드가 불일치하면 `SortedSet`/`SortedMap` 동작이 일반 `Set`/`Map`과 달라진다.

```java
// 위험: compareTo()와 equals() 불일치
BigDecimal a = new BigDecimal("1.0");
BigDecimal b = new BigDecimal("1.00");

System.out.println(a.equals(b));      // false — 스케일 다름
System.out.println(a.compareTo(b));   // 0 — 수치는 같음

// TreeSet은 compareTo() 사용 → 중복으로 간주
TreeSet<BigDecimal> ts = new TreeSet<>();
ts.add(a); ts.add(b);
System.out.println(ts.size()); // 1 — a와 b를 같은 값으로 봄

// HashSet은 equals() 사용 → 다른 값으로 간주
HashSet<BigDecimal> hs = new HashSet<>();
hs.add(a); hs.add(b);
System.out.println(hs.size()); // 2
```

`Comparable`과 `Comparator`는 Java 컬렉션 프레임워크, 스트림 정렬, 우선순위 큐의 핵심이다. 다음 글에서는 **불변 객체(Immutable Object)**를 다룬다. 불변 객체 설계의 원칙과 장점, 그리고 자바에서 불변 클래스를 만드는 올바른 방법을 살펴볼 것이다.

---

**지난 글:** [Java finalize() 제거 — try-with-resources와 Cleaner 대안](/posts/java-finalize-removed/)

**다음 글:** [Java 불변 객체 — Immutable Object 설계와 활용](/posts/java-immutable-objects/)

<br>
읽어주셔서 감사합니다. 😊
