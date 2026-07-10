---
title: "PECS 원칙 — Producer Extends, Consumer Super"
description: "PECS(Producer Extends Consumer Super) 원칙의 의미와 암기법, Collections.copy 시그니처 분석, 생산자와 소비자 역할 구분, 그리고 API 설계에서 와일드카드를 올바르게 쓰는 방법"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "PECS", "와일드카드", "Producer", "Consumer", "API 설계"]
featured: false
draft: false
---

[지난 글](/posts/java-wildcards/)에서 세 가지 와일드카드의 읽기·쓰기 제약을 배웠다. 이번에는 **PECS 원칙**을 다룬다. PECS는 Joshua Bloch가 《Effective Java》에서 제안한 와일드카드 선택 기준으로, "**P**roducer **E**xtends, **C**onsumer **S**uper"의 약자다. 와일드카드를 어떤 상황에 어떻게 써야 하는지 한 문장으로 정리한 황금 규칙이다.

## PECS의 핵심 관점

코드를 **"내가 컬렉션에서 값을 꺼내는가(Producer)"** 아니면 **"내가 컬렉션에 값을 넣는가(Consumer)"** 의 관점으로 바라본다.

- **Producer(생산자)**: 컬렉션이 값을 제공 → 내가 읽는다 → `? extends T`
- **Consumer(소비자)**: 컬렉션이 값을 받음 → 내가 쓴다 → `? super T`

![PECS 다이어그램](/assets/posts/java-pecs-diagram.svg)

## Collections.copy로 이해하는 PECS

표준 라이브러리 `Collections.copy`의 시그니처가 PECS의 교과서적 예제다.

```java
public static <T> void copy(
    List<? super T>   dest,  // Consumer: T를 받으므로 super T
    List<? extends T> src    // Producer: T를 제공하므로 extends T
) {
    int srcSize = src.size();
    // ...
    for (ListIterator<? super T> i = dest.listIterator(); ...) {
        i.next();
        i.set(src.get(srcSize++));
    }
}
```

`src`에서 원소를 **읽어서** `dest`에 **넣는다**. 읽는 쪽(src)은 `extends`, 쓰는 쪽(dest)은 `super`.

```java
List<Integer> src  = List.of(1, 2, 3);
List<Number>  dest = new ArrayList<>(Arrays.asList(0, 0, 0));

Collections.copy(dest, src);
// T = Integer 추론
// dest: ? super Integer → List<Number> 허용 (Number super Integer)
// src:  ? extends Integer → List<Integer> 허용 (trivially)
System.out.println(dest); // [1, 2, 3]
```

![PECS 코드 분석](/assets/posts/java-pecs-code.svg)

## PECS 적용 전/후 비교

PECS 없이 작성한 `addAll` 구현과 PECS를 적용한 구현을 비교해 보자.

```java
// PECS 없음 — 유연성 부족
static <T> void addAll(List<T> dest, List<T> src) {
    for (T e : src) dest.add(e);
}

// PECS 적용 — 훨씬 유연
static <T> void addAll(List<? super T> dest, List<? extends T> src) {
    for (T e : src) dest.add(e);
}
```

```java
List<Integer> ints   = List.of(1, 2, 3);
List<Number>  nums   = new ArrayList<>();

// PECS 없으면 컴파일 오류 (T는 Integer이어야 하는데 dest는 Number)
// PECS 있으면 OK — T = Integer, dest는 Number(super Integer), src는 Integer
addAll(nums, ints); // PECS 버전: OK
```

## 추가 예제 — 스택 pushAll/popAll

```java
class Stack<E> {
    // 생산자 src에서 읽어 this에 push
    public void pushAll(Iterable<? extends E> src) {
        for (E e : src) push(e);
    }

    // 소비자 dst에 this에서 pop해서 씀
    public void popAll(Collection<? super E> dst) {
        while (!isEmpty()) dst.add(pop());
    }
}
```

```java
Stack<Number> numStack = new Stack<>();

// pushAll: Integer는 Number의 하위 타입 — extends Number
Iterable<Integer> ints = List.of(1, 2, 3);
numStack.pushAll(ints); // OK

// popAll: Object는 Number의 상위 타입 — super Number
Collection<Object> objs = new ArrayList<>();
numStack.popAll(objs);  // OK
```

## 비교자에서의 PECS

Comparator 파라미터에도 동일한 원칙을 적용한다.

```java
// Effective Java에서 권장하는 sort 시그니처
public static <T extends Comparable<? super T>> void sort(List<T> list)

// Comparator도 Consumer → super 사용
public static <T> void sort(List<T> list, Comparator<? super T> c)
```

`Comparator<? super T>` 덕분에 `Animal` 비교자를 `Dog` 리스트 정렬에 재사용할 수 있다.

```java
Comparator<Animal> animalComp = Comparator.comparing(Animal::getName);
List<Dog> dogs = new ArrayList<>(List.of(new Dog("Rex"), new Dog("Max")));
dogs.sort(animalComp); // ? super Dog — Animal super Dog → OK
```

## 암기법 요약

```text
내가 컬렉션에서 꺼낸다 (읽는다) → extends  (Producer Extends)
내가 컬렉션에 넣는다   (쓴다)   → super    (Consumer Super)
둘 다 안 함            → ?
```

---

**지난 글:** [와일드카드 — ? 타입의 유연성](/posts/java-wildcards/)

**다음 글:** [타입 소거 — 런타임의 제네릭 타입](/posts/java-type-erasure/)

<br>
읽어주셔서 감사합니다. 😊
