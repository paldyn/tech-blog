---
title: "Java clone() — Cloneable과 깊은 복사·얕은 복사"
description: "Object.clone()의 동작 원리와 Cloneable 마커 인터페이스, 얕은 복사와 깊은 복사의 차이, clone()을 올바르게 구현하는 방법, 그리고 복사 생성자와 정적 팩터리 메서드를 대안으로 활용하는 방법을 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "clone", "Cloneable", "깊은 복사", "얕은 복사", "복사 생성자", "Object"]
featured: false
draft: false
---

[지난 글](/posts/java-tostring/)에서 `toString()`의 구현 패턴과 주의사항을 살펴봤다. 이번에는 `Object.clone()`을 다룬다. 객체를 복사하는 가장 기본적인 방법이지만, 설계에 여러 결함이 있어 현대 Java에서는 대안을 더 많이 사용한다.

## clone()의 기본 동작

`Object.clone()`은 현재 객체의 **얕은 복사(shallow copy)**를 반환한다. 새 객체를 만들고, 원래 객체의 모든 필드를 비트 단위로 복사한다.

```java
Object.clone()  // protected, CloneNotSupportedException 던짐
```

호출하려면 두 가지 조건이 필요하다.
1. 클래스가 `Cloneable` 인터페이스를 구현해야 한다
2. `clone()`을 `public`으로 오버라이드해야 한다

`Cloneable`을 구현하지 않고 `clone()`을 호출하면 `CloneNotSupportedException`이 발생한다.

## 기본 clone() 구현

```java
class Point implements Cloneable {
    int x, y;

    Point(int x, int y) { this.x = x; this.y = y; }

    @Override
    public Point clone() {
        try {
            return (Point) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError(); // Cloneable 구현했으므로 발생 불가
        }
    }
}

Point original = new Point(1, 2);
Point copy = original.clone();
System.out.println(copy.x + ", " + copy.y); // 1, 2
System.out.println(original == copy);        // false — 다른 객체
```

프리미티브 필드만 있는 경우 `super.clone()`만으로 충분하다.

## 얕은 복사의 함정

참조 타입 필드(배열, 컬렉션, 다른 객체)가 있을 때 얕은 복사는 **같은 객체를 참조**한다.

```java
class Profile implements Cloneable {
    String name;
    List<String> tags;

    Profile(String name, List<String> tags) {
        this.name = name;
        this.tags = tags;
    }

    @Override
    public Profile clone() {
        try {
            return (Profile) super.clone(); // tags는 같은 List를 가리킴
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}

Profile original = new Profile("Alice", new ArrayList<>(List.of("java")));
Profile copy = original.clone();

copy.tags.add("kotlin"); // 원본도 변경됨!
System.out.println(original.tags); // [java, kotlin] ← 의도치 않은 변경
```

`name`(`String`은 불변)은 괜찮지만, `tags`는 복사본과 원본이 같은 `List` 객체를 공유한다.

![얕은 복사 vs 깊은 복사 — 공유 참조 문제](/assets/posts/java-clone-shallow-deep.svg)

## 깊은 복사 구현

참조 필드를 개별적으로 복사해 독립적인 객체를 만든다.

```java
@Override
public Profile clone() {
    try {
        Profile copy = (Profile) super.clone();
        copy.tags = new ArrayList<>(this.tags); // 깊은 복사
        return copy;
    } catch (CloneNotSupportedException e) {
        throw new AssertionError();
    }
}

Profile original = new Profile("Alice", new ArrayList<>(List.of("java")));
Profile copy = original.clone();

copy.tags.add("kotlin");
System.out.println(original.tags); // [java] — 분리됨
System.out.println(copy.tags);     // [java, kotlin]
```

중첩된 가변 객체가 있다면 모든 단계를 깊은 복사해야 한다. 구조가 복잡할수록 구현이 어려워진다.

## 배열의 clone()

배열은 `Cloneable`을 이미 구현하고 있어 `clone()`을 바로 호출할 수 있다.

```java
int[] original = {1, 2, 3};
int[] copy = original.clone();
copy[0] = 99;
System.out.println(original[0]); // 1 — 프리미티브 배열은 깊은 복사

String[] names = {"Alice", "Bob"};
String[] nameCopy = names.clone();
// String은 불변이라 얕은 복사도 안전

int[][] matrix = {{1, 2}, {3, 4}};
int[][] matrixCopy = matrix.clone();
matrixCopy[0][0] = 99;
System.out.println(matrix[0][0]); // 99 — 2차원 배열은 내부 배열 공유!
```

2차원 배열의 경우 외부 배열은 복사되지만 내부 배열은 공유된다.

## clone()의 설계 결함

`clone()`에는 여러 구조적 문제가 있다.

**Cloneable의 역설**: `Cloneable` 인터페이스에 `clone()` 메서드가 없다. `clone()`은 `Object`에 있다. 마커 인터페이스를 구현해야 `super.clone()`이 작동하는 비직관적 설계다.

**checked 예외**: `CloneNotSupportedException`은 `Cloneable`을 구현한 클래스에서 절대 발생하지 않는데도 항상 처리해야 한다.

**상속 문제**: 서브클래스가 추가 필드를 갖는다면 부모의 `clone()`이 서브클래스 타입을 정확히 반환해도 새 필드는 복사되지 않는다.

**생성자 우회**: `clone()`은 생성자를 호출하지 않는다. 생성자에서 초기화하는 불변식(invariant)이 깨질 수 있다.

## 대안: 복사 생성자

`clone()` 대신 **복사 생성자(copy constructor)**가 훨씬 명확하다.

```java
class Profile {
    String name;
    List<String> tags;

    // 복사 생성자
    Profile(Profile other) {
        this.name = other.name;
        this.tags = new ArrayList<>(other.tags); // 깊은 복사
    }
}

Profile original = new Profile("Alice", List.of("java"));
Profile copy = new Profile(original); // 명시적, 예외 없음
```

복사 생성자는 `Cloneable` 없이 동작하고, checked 예외도 없으며, 상속과 독립적이다.

## 대안: 정적 팩터리 메서드

```java
class Profile {
    static Profile copyOf(Profile other) {
        return new Profile(other.name, new ArrayList<>(other.tags));
    }
}

Profile copy = Profile.copyOf(original);
```

이름에서 복사 의도가 명확히 드러난다.

![clone() 구현 vs 복사 생성자 — 코드 비교](/assets/posts/java-clone-impl.svg)

## 언제 clone()을 써야 하나

배열 복사(`Arrays.copyOf()`)나 컬렉션의 생성자 복사(`new ArrayList<>(other)`)처럼 내부적으로 `clone()`을 사용하는 경우가 여전히 있다. 직접 코드에서는 복사 생성자나 직렬화 기반 깊은 복사를 선호하는 것이 좋다.

`Object.clone()`은 Java 초기 설계의 실수 중 하나로 꼽힌다. 새 코드에서는 복사 생성자나 불변 객체 + record를 선호하라. 다음 글에서는 **`finalize()` 메서드의 제거 이유**와 자원 관리 대안(`try-with-resources`, `Cleaner`)을 다룬다.

---

**지난 글:** [Java toString() — 의미 있는 문자열 표현 만들기](/posts/java-tostring/)

**다음 글:** [Java finalize() 제거 — try-with-resources와 Cleaner 대안](/posts/java-finalize-removed/)

<br>
읽어주셔서 감사합니다. 😊
