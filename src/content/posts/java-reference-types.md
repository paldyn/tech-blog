---
title: "Java 참조형(Reference Types) 완전 정리"
description: "Java 참조형의 개념, 힙·스택 메모리 구조, null 처리, 동일성 vs 동등성, 그리고 클래스·인터페이스·배열·열거형 4가지 종류를 예제 중심으로 완전히 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "reference type", "참조형", "heap", "stack", "null", "NullPointerException", "equals", "String Pool", "배열", "인터페이스", "열거형"]
featured: false
draft: false
---

[지난 글](/posts/java-primitive-types/)에서 Java 기본형 여덟 가지의 크기, 범위, 형 변환 규칙을 살펴봤다. 값을 변수에 직접 저장하는 기본형과 달리, **참조형(reference type)** 은 힙에 생성된 객체의 주소를 변수에 저장한다. Java에서 기본형 8개를 제외한 모든 타입이 참조형이며, 개발자가 직접 만드는 클래스부터 배열, 인터페이스, 열거형까지 모두 포함된다. 이 차이가 null 처리, 동등성 비교, 메모리 관리 등 Java 프로그래밍 전반에 걸쳐 큰 영향을 미친다.

## 참조형이란

참조형 변수는 **객체 자체를 담지 않고 객체가 있는 힙 메모리 주소(참조)를 담는다**. 비유하자면 기본형은 집 안에 물건을 직접 보관하는 것이고, 참조형은 물건이 보관된 창고의 주소를 적어 두는 방식이다.

이 구조 덕분에 참조형은:
- 크기에 관계없이 어떤 객체도 가리킬 수 있고
- 여러 변수가 **같은 객체를 공유**할 수 있으며
- 객체가 없음을 나타내는 **`null`** 값을 가질 수 있다

반면 값이 스택이 아닌 힙에 있으므로 GC 대상이 되고, 참조가 끊기면 메모리에서 회수된다.

## 메모리 구조: 스택과 힙

JVM은 변수를 스택(Stack)에, 객체를 힙(Heap)에 저장한다. 기본형은 스택의 변수 슬롯에 값이 직접 들어가지만, 참조형은 스택에 주소(참조)만 들어가고 실제 데이터는 힙에 있다.

![기본형 vs 참조형 — 메모리 저장 방식](/assets/posts/java-reference-types-memory.svg)

```java
int   age    = 30;              // 스택: 값 30을 직접 저장
String name  = "Alice";         // 스택: 힙 주소 저장, 힙에 String 객체
int[]  scores = {90, 85, 92};   // 스택: 힙 주소 저장, 힙에 int[] 객체
```

이 그림에서 핵심은 `name`과 `scores`가 스택에 **주소 값**을 가진다는 점이다. 만약 다른 변수가 같은 주소를 복사해 가지면, 두 변수는 **동일한 힙 객체를 가리키게 된다**. 이 공유 특성이 참조형을 이해하는 가장 중요한 개념이다.

```java
String a = "Hello";
String b = a;        // b도 같은 String 객체를 가리킴
b = "World";         // b가 새 객체를 가리키도록 변경 (a는 영향 없음)
System.out.println(a); // "Hello" — 문자열은 불변(immutable)이라 안전
```

`String`은 불변 객체라 위 예시가 문제없지만, `ArrayList` 같은 가변 객체를 두 변수가 공유하면 한쪽에서의 수정이 다른 쪽에도 보인다.

## 참조형의 4가지 종류

Java 명세는 참조형을 네 가지로 분류한다.

![Java 참조형 4가지](/assets/posts/java-reference-types-kinds.svg)

### 클래스 (class)

가장 일반적인 참조형이다. `new` 키워드로 힙에 인스턴스를 생성하고, 변수에는 그 주소가 저장된다.

```java
String msg = new String("hello");  // 명시적 객체 생성
ArrayList<Integer> list = new ArrayList<>();
```

### 인터페이스 (interface)

인터페이스 자체로는 인스턴스를 만들 수 없지만, 인터페이스 타입으로 변수를 선언해 그 구현 클래스의 객체를 담을 수 있다.

```java
List<String> names = new ArrayList<>();   // 타입은 List(인터페이스)
Runnable task = () -> System.out.println("run"); // 람다도 참조형
```

### 배열 (array)

배열은 같은 타입의 원소를 고정 크기로 연속 배치한 객체다. `int[]`처럼 기본형 배열도 힙에 생성되며 참조형으로 취급된다.

```java
int[]    primes = {2, 3, 5, 7, 11};
String[] days   = new String[7];
Object[] mixed  = new Object[3];   // 모든 참조형 담기 가능
```

### 열거형 (enum)

`enum`은 미리 정의된 상수 집합으로, 각 상수가 타입 안전한 싱글턴 객체다.

```java
enum Direction { NORTH, SOUTH, EAST, WEST }

Direction dir = Direction.NORTH;
System.out.println(dir.name());    // "NORTH"
System.out.println(dir.ordinal()); // 0
```

## null: 참조형만의 특권과 위험

`null`은 "어떤 객체도 가리키지 않는다"는 의미의 특수 리터럴이다. **기본형은 null을 가질 수 없다**. 참조형 변수의 기본값이 `null`이므로 초기화하지 않은 인스턴스 필드는 자동으로 `null`이 된다.

```java
String s = null;
System.out.println(s.length()); // NullPointerException!
```

`null`인 참조에 메서드를 호출하면 `NullPointerException(NPE)`이 발생한다. Java 14부터 NPE 메시지가 더 상세해져 어떤 변수가 null이었는지 알려준다.

### null 안전 패턴

```java
// 1. 고전적 null 검사
if (s != null) {
    System.out.println(s.length());
}

// 2. Objects.requireNonNull (Java 7+) — null 이면 즉시 NPE
String name = Objects.requireNonNull(s, "name must not be null");

// 3. Optional (Java 8+) — null 가능성을 타입으로 표현
Optional<String> opt = Optional.ofNullable(s);
int len = opt.map(String::length).orElse(0);

// 4. 방어적 기본값 패턴
String result = (s != null) ? s : "default";
```

실무에서는 메서드 파라미터와 반환값에서 null 의미를 명확히 하고, 가능하면 `Optional`로 null 가능성을 타입 시스템에 드러내는 것이 좋다.

## 동일성(==)과 동등성(equals)

참조형에서 `==`는 **두 변수가 같은 힙 주소를 가리키는지**(동일성, identity)를 비교한다. **값이 같은지**(동등성, equality)를 비교하려면 `equals()`를 사용해야 한다.

```java
String a = new String("hello");
String b = new String("hello");

System.out.println(a == b);        // false — 힙의 다른 두 객체
System.out.println(a.equals(b));   // true  — 값은 같음

// 배열도 동일
int[] arr1 = {1, 2, 3};
int[] arr2 = {1, 2, 3};
System.out.println(arr1 == arr2);          // false
System.out.println(Arrays.equals(arr1, arr2)); // true
```

`==`로 문자열을 비교하는 실수는 매우 흔하다. 항상 `equals()`로 값을 비교하는 습관을 들여야 한다.

## String Pool — 문자열의 특별 취급

Java는 성능을 위해 **문자열 풀(String Pool)** 이라는 특별한 힙 영역을 운용한다. 문자열 리터럴로 생성된 `String`은 풀에 저장되고, 같은 리터럴을 쓰면 동일 객체를 재사용한다.

```java
String x = "hello";      // String Pool에 "hello" 저장
String y = "hello";      // Pool에서 동일 객체 재사용
String z = new String("hello"); // new → 풀 밖에 새 객체 생성

System.out.println(x == y); // true  — 풀의 같은 객체
System.out.println(x == z); // false — z는 풀 밖 새 객체
System.out.println(x.equals(z)); // true — 값은 동일

// intern()으로 풀에 등록
String w = z.intern();
System.out.println(x == w); // true — 풀에서 기존 객체 반환
```

실무에서는 `new String(...)` 대신 리터럴을 사용하는 것이 성능에 유리하다. Java 21 기준으로 풀은 힙의 일부(기존 PermGen이 아닌 Heap 영역)에 존재한다.

## 참조형 사용 시 주의사항

**얕은 복사 vs 깊은 복사**: 참조형을 단순 대입하면 주소만 복사되어 두 변수가 같은 객체를 공유한다. 독립적인 사본이 필요하면 복사 생성자, `clone()`, 또는 직접 깊은 복사를 구현해야 한다.

```java
List<String> original = new ArrayList<>(List.of("a", "b"));
List<String> shallow  = original;          // 같은 객체 공유
List<String> deep     = new ArrayList<>(original); // 새 리스트, 원소는 공유

shallow.add("c"); // original에도 영향
deep.add("d");    // original에 영향 없음
```

**메모리 누수**: 참조형 변수가 불필요한 객체를 계속 가리키면 GC가 회수하지 못해 메모리 누수가 생긴다. 컬렉션에서 불필요한 원소를 명시적으로 제거하거나, 수명이 긴 캐시에는 `WeakReference`를 검토한다.

## 정리

참조형은 Java에서 기본형을 제외한 모든 타입을 아우른다. 핵심은 **변수가 객체 자체가 아닌 힙 주소를 저장한다**는 점이며, 이에서 null 처리의 필요성, `==` vs `equals()` 구분, 얕은/깊은 복사의 차이가 모두 파생된다. 다음 글에서는 기본형과 참조형 사이, 그리고 상속 계층 안에서 이루어지는 **타입 변환(type conversion)** 규칙을 자세히 살펴본다.

---

**지난 글:** [Java 기본형(Primitive Types) 완전 정리](/posts/java-primitive-types/)

**다음 글:** [Java 타입 변환(Type Conversion) 완전 정리](/posts/java-type-conversion/)

<br>
읽어주셔서 감사합니다. 😊
