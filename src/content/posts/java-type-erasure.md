---
title: "타입 소거 — 런타임의 제네릭 타입"
description: "타입 소거(Type Erasure)가 하위 호환성을 위해 T를 Object로 치환하는 과정, 소거 후 캐스팅 코드 자동 삽입, 런타임에 제네릭 타입 정보가 없는 이유, 힙 오염(Heap Pollution), 그리고 reifiable 타입"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "Type Erasure", "타입 소거", "Heap Pollution", "하위 호환"]
featured: false
draft: false
---

[지난 글](/posts/java-pecs/)에서 PECS 원칙으로 와일드카드를 선택하는 방법을 배웠다. 이번에는 **타입 소거(Type Erasure)**를 다룬다. 제네릭의 타입 정보가 런타임에 어떻게 처리되는지 이해하면, "왜 instanceof로 제네릭 타입을 검사할 수 없는가", "왜 제네릭 배열을 만들 수 없는가" 같은 질문에 명확하게 답할 수 있다.

## 타입 소거란

Java 컴파일러는 소스 코드를 바이트코드로 변환하면서 제네릭의 **타입 파라미터 정보를 모두 지운다**. 이를 타입 소거라 한다. 이 과정에서 세 가지 일이 벌어진다.

1. 경계 없는 `T` → `Object`로 치환
2. 경계 있는 `T extends Foo` → `Foo`로 치환
3. 타입 안전성을 보장하는 **캐스팅 코드 자동 삽입**

```java
// 소스 코드
class Box<T> {
    private T value;
    public T get() { return value; }
}

Box<String> box = new Box<>();
String s = box.get();
```

```java
// 바이트코드 (소거 후)
class Box {
    private Object value;
    public Object get() { return value; }
}

Box box = new Box();
String s = (String) box.get(); // 캐스팅 자동 삽입
```

![타입 소거 컴파일 전후](/assets/posts/java-type-erasure-process.svg)

## 하위 호환성이 설계 이유

타입 소거는 Java 5에서 제네릭이 도입될 때 **Java 4 이하 코드와의 하위 호환성**을 위해 선택된 방식이다. 덕분에 `ArrayList.class` 파일 하나로 `ArrayList<String>`, `ArrayList<Integer>` 모두 동작한다.

```java
// 런타임에 이 둘은 같은 클래스
List<String>.class  // 존재하지 않음 (컴파일 오류)
List<Integer>.class // 존재하지 않음 (컴파일 오류)
List.class          // OK — 런타임에 존재하는 유일한 클래스

// 따라서
List<String>  strList = new ArrayList<>();
List<Integer> intList = new ArrayList<>();
System.out.println(strList.getClass() == intList.getClass()); // true!
```

## 경계 타입 소거

경계가 있는 타입 파라미터는 경계 타입으로 치환된다.

```java
// 소스 코드
<T extends Comparable<T>> T min(T a, T b) {
    return a.compareTo(b) <= 0 ? a : b;
}

// 소거 후
Comparable min(Comparable a, Comparable b) {
    return a.compareTo(b) <= 0 ? a : b;
}
```

## Reifiable 타입과 Non-Reifiable 타입

런타임에 타입 정보가 완전히 남아 있는 타입을 **reifiable**, 소거되는 타입을 **non-reifiable**이라 한다.

| Reifiable (런타임 타입 정보 존재) | Non-Reifiable (소거됨) |
|---|---|
| 원시 타입 (`int`, `double`) | `List<String>` |
| Raw type (`List`) | `List<? extends Number>` |
| 배열 (`String[]`, `int[]`) | `Map<K,V>` |
| 비경계 와일드카드 (`List<?>`) | `T` (타입 파라미터) |

## 힙 오염 (Heap Pollution)

`@SafeVarargs` 없이 제네릭 가변 인수를 쓰거나, raw type을 섞어 쓸 때 발생한다.

```java
// 힙 오염 예
@SuppressWarnings("unchecked")
static <T> T[] toArray(T... args) {
    return args; // T[]는 소거 후 Object[] — 힙 오염 가능
}

// 실제 오염 시나리오
List<String> strs = new ArrayList<>();
List raw = strs;
raw.add(42);               // Integer 삽입 (unchecked 경고 발생)
String s = strs.get(0);   // ClassCastException!
```

![타입 소거 함정](/assets/posts/java-type-erasure-pitfalls.svg)

## 소거로 인한 제약 사항

```java
// 1. instanceof 검사 불가
if (obj instanceof List<String>) { }  // 컴파일 오류
if (obj instanceof List<?>)       { } // OK

// 2. 제네릭 배열 생성 불가
T[] arr = new T[10];              // 컴파일 오류
T[] arr = (T[]) new Object[10];  // 경고, 힙 오염 가능

// 3. 오버로딩: 소거 후 같은 시그니처 → 충돌
void process(List<String> l) {}
void process(List<Integer> l) {} // 컴파일 오류 — 소거 후 동일

// 4. 정적 필드에 T 불가 (클래스 정의에서)
// static T instance; // 컴파일 오류
```

## 런타임 타입 정보가 필요한 경우

타입 소거를 우회하는 방법으로 `Class<T>` 토큰을 전달하는 **type token** 패턴을 사용한다.

```java
// T를 직접 알 수 없으므로 Class<T>를 함께 전달
public static <T> T fromJson(String json, Class<T> type) {
    return objectMapper.readValue(json, type);
}

// 사용
User user = fromJson(json, User.class);
```

---

**지난 글:** [PECS 원칙 — Producer Extends, Consumer Super](/posts/java-pecs/)

**다음 글:** [제네릭 함정 — 흔한 실수와 주의사항](/posts/java-generics-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
