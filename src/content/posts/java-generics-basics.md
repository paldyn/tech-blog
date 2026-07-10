---
title: "Java 제네릭 완전 정복 — 타입 매개변수의 기초"
description: "제네릭이 해결하는 타입 안전성 문제, 타입 파라미터 이름 관례(T·E·K·V·N·R), 다이아몬드 연산자, 그리고 Box<T> 예제로 이해하는 제네릭의 핵심 개념"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "Generics", "타입 안전", "타입 파라미터", "다이아몬드 연산자"]
featured: false
draft: false
---

[지난 글](/posts/java-immutable-objects/)에서 불변 객체를 설계하는 다섯 가지 규칙을 살펴봤다. 이번에는 **제네릭(Generics)**을 다룬다. 제네릭은 Java 5에서 도입된 기능으로, 클래스·인터페이스·메서드가 처리할 데이터의 타입을 선언 시점에 지정하지 않고 **사용 시점에 결정**하게 해 준다. "타입을 파라미터처럼 넘긴다"는 발상이다.

## 제네릭이 해결하는 문제

제네릭 도입 전 Java 코드에서는 컬렉션에서 꺼낸 값을 항상 캐스팅해야 했다. 캐스팅이 잘못되면 **런타임에 `ClassCastException`** 이 발생했고, 컴파일러는 이를 잡아주지 못했다.

```java
// Java 5 이전 — Raw Type
List list = new ArrayList();
list.add("hello");
list.add(42);            // 실수로 Integer 삽입
String s = (String) list.get(1); // 런타임 ClassCastException!
```

제네릭을 사용하면 컴파일러가 타입 불일치를 **코드 작성 시점에** 알려준다.

```java
// Java 5 이후 — Generic Type
List<String> list = new ArrayList<>();
list.add("hello");
// list.add(42);  // 컴파일 오류 — IDE가 즉시 표시
String s = list.get(0); // 캐스팅 불필요
```

![제네릭 타입 안전성 비교](/assets/posts/java-generics-basics-comparison.svg)

## 타입 파라미터 이름 관례

Java 커뮤니티는 타입 파라미터에 대문자 한 글자를 사용하는 관례를 따른다.

| 기호 | 의미 | 주요 사용처 |
|---|---|---|
| `T` | Type | 일반 타입 파라미터 |
| `E` | Element | 컬렉션 원소 |
| `K` | Key | Map 키 |
| `V` | Value | Map 값 |
| `N` | Number | 숫자 타입 |
| `R` | Result | 함수 반환 타입 |
| `S, U, V` | — | 다중 파라미터 2·3·4번째 |

## Box\<T\> — 가장 간단한 제네릭 클래스

```java
class Box<T> {
    private T value;

    public Box(T value) {
        this.value = value;
    }

    public T getValue() {
        return value;
    }
}
```

`T`는 클래스 이름 뒤 `<>` 안에 선언한다. **인스턴스를 생성할 때** 구체 타입으로 교체된다.

```java
// T = String 으로 바인딩
Box<String> strBox = new Box<>("Java");
String s = strBox.getValue(); // 캐스팅 없음

// T = Integer 로 바인딩
Box<Integer> intBox = new Box<>(42);
int n = intBox.getValue();    // 자동 언박싱
```

![타입 파라미터 관례와 Box<T> 예제](/assets/posts/java-generics-basics-syntax.svg)

## 다이아몬드 연산자 `<>`

Java 7부터 우변의 타입 인자를 생략하는 **다이아몬드 연산자**를 지원한다. 컴파일러가 좌변 타입을 보고 추론한다.

```java
// 명시적 타입 인자 (Java 6 이하)
Box<String> box = new Box<String>("hello");

// 다이아몬드 연산자 — 타입 추론 (Java 7+)
Box<String> box = new Box<>("hello");

// Map에서도 동일
Map<String, List<Integer>> map = new HashMap<>();
```

## 제네릭의 세 가지 이점

**타입 안전(Type Safety)**: 잘못된 타입 삽입을 컴파일 타임에 차단한다.

**캐스팅 제거**: 꺼낼 때 자동으로 올바른 타입을 반환하므로 `(String)` 같은 명시적 캐스팅이 불필요하다.

**코드 재사용**: `Box<String>`, `Box<Integer>` 등 모든 타입에 하나의 `Box<T>` 클래스가 동작한다. 타입별로 클래스를 따로 작성할 필요가 없다.

## 주의: 기본 타입은 사용 불가

제네릭 타입 파라미터 자리에는 **참조 타입만** 사용할 수 있다. `int`, `double` 같은 프리미티브는 불가능하다.

```java
List<int> list = new ArrayList<>();     // 컴파일 오류!
List<Integer> list = new ArrayList<>(); // OK — 래퍼 타입 사용
```

오토박싱/언박싱 덕분에 `int` ↔ `Integer` 변환은 자동으로 처리되므로 실용적으로는 큰 불편이 없다. 단, 박싱/언박싱 비용이 성능에 민감한 코드에서는 주의해야 한다.

---

**지난 글:** [Java 불변 객체 — Immutable Object 설계와 활용](/posts/java-immutable-objects/)

**다음 글:** [제네릭 클래스 — 타입 매개변수를 가진 클래스 설계](/posts/java-generic-class/)

<br>
읽어주셔서 감사합니다. 😊
