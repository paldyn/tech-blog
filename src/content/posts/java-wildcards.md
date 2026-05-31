---
title: "와일드카드 — ? 타입의 유연성"
description: "비한정 와일드카드 <?>, 상한 와일드카드 <? extends T>, 하한 와일드카드 <? super T>의 읽기·쓰기 제약, 제네릭 불공변 문제 해결, 그리고 sumList·addNumbers 실전 예제"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "와일드카드", "Wildcard", "extends", "super", "불공변"]
featured: false
draft: false
---

[지난 글](/posts/java-bounded-type-parameter/)에서 `extends`로 타입 파라미터의 범위를 제한하는 방법을 배웠다. 이번에는 **와일드카드(Wildcard) `?`**를 다룬다. 와일드카드는 타입 파라미터 자리에 쓰이는 특수한 기호로, 클래스나 메서드를 **정의**할 때가 아니라 타입을 **사용**하는 위치(변수 선언, 메서드 파라미터)에서 유연성을 제공한다.

## 제네릭은 왜 불공변인가

`Integer`는 `Number`의 하위 타입이다. 그런데 `List<Integer>`는 `List<Number>`의 하위 타입이 **아니다**. 이를 **불공변(Invariant)**이라 한다.

```java
List<Integer> ints = List.of(1, 2, 3);
List<Number>  nums = ints; // 컴파일 오류!
```

이 제약이 없으면 타입 안전성이 깨진다.

```java
// 만약 허용된다면 (가상)
List<Number> nums = ints;
nums.add(3.14); // Double을 Integer 리스트에 삽입!
Integer i = ints.get(2); // ClassCastException!
```

와일드카드는 이 불공변의 제약을 **안전한 범위 내에서** 완화한다.

## 비한정 와일드카드 `<?>`

가장 느슨한 형태다. `List<?>`는 "원소 타입을 모르는 리스트"를 의미한다.

```java
// 읽기: Object만 가능 (타입을 모르므로)
void printAll(List<?> list) {
    for (Object o : list) {
        System.out.println(o);
    }
}

// 쓰기: null만 허용
void addNull(List<?> list) {
    list.add(null); // OK
    // list.add("x"); // 컴파일 오류
}
```

`printAll`은 `List<String>`, `List<Integer>`, `List<Object>` 어떤 리스트도 받을 수 있다.

## 상한 와일드카드 `<? extends T>`

"T 또는 T의 하위 타입 리스트"를 뜻한다. 원소를 **읽기**는 할 수 있지만 **쓰기**는 불가능하다.

```java
// Double, Integer, Long 리스트를 모두 받을 수 있음
static double sumList(List<? extends Number> list) {
    return list.stream()
               .mapToDouble(Number::doubleValue)
               .sum();
}
```

```java
List<Integer> ints    = List.of(1, 2, 3);
List<Double>  doubles = List.of(1.5, 2.5);

System.out.println(sumList(ints));    // 6.0
System.out.println(sumList(doubles)); // 4.0
```

쓰기가 불가능한 이유: `? extends Number`는 `Integer`일 수도 `Double`일 수도 있어서, `list.add(new Integer(1))`은 `Double` 리스트라면 타입 위반이다. 컴파일러는 안전을 위해 모두 막는다.

![와일드카드 세 가지 형태](/assets/posts/java-wildcards-types.svg)

## 하한 와일드카드 `<? super T>`

"T 또는 T의 상위 타입 리스트"를 뜻한다. 원소를 **쓰기**는 할 수 있지만 **읽기**는 `Object`로만 가능하다.

```java
// Integer, Number, Object 리스트 모두 받을 수 있음
static void addIntegers(List<? super Integer> list) {
    for (int i = 1; i <= 5; i++) {
        list.add(i); // Integer를 추가 — 항상 안전
    }
}
```

```java
List<Number> numbers = new ArrayList<>();
addIntegers(numbers); // Number super Integer → OK
System.out.println(numbers); // [1, 2, 3, 4, 5]

List<Object> objects = new ArrayList<>();
addIntegers(objects); // Object super Integer → OK
```

쓰기가 허용되는 이유: `? super Integer`이면 리스트가 `Integer`, `Number`, `Object` 중 하나인데, `Integer`는 이 모두의 하위 타입이므로 항상 안전하게 삽입할 수 있다.

![와일드카드 실전 활용](/assets/posts/java-wildcards-usage.svg)

## 세 가지 와일드카드 선택 기준

```
읽기만 (데이터 소비) → ? extends T
쓰기만 (데이터 생산) → ? super T
읽지도 쓰지도 않음  → ?
둘 다 (읽고 쓰기)   → 와일드카드 사용 불가 → T 타입 파라미터로 처리
```

## 주의: 와일드카드는 반환 타입에 쓰지 말 것

와일드카드를 반환 타입으로 쓰면 사용자가 반환값을 다시 와일드카드 타입으로 받아야 해서 불편하다.

```java
// NG — 반환 타입에 와일드카드
public List<? extends Number> getNumbers() { ... }

// OK — 타입 파라미터 사용
public <T extends Number> List<T> getNumbers() { ... }
```

---

**지난 글:** [경계 타입 파라미터 — extends와 super로 범위 제한](/posts/java-bounded-type-parameter/)

**다음 글:** [PECS 원칙 — Producer Extends, Consumer Super](/posts/java-pecs/)

<br>
읽어주셔서 감사합니다. 😊
