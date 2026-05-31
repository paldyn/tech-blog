---
title: "제네릭 메서드 — 메서드 수준의 타입 매개변수"
description: "제네릭 메서드 선언 위치(반환 타입 앞 <T>), 타입 추론, 비 제네릭 클래스의 static 제네릭 메서드, swap·identity 예제, 그리고 명시적 타입 인자 호출법"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "Generic Method", "타입 추론", "타입 파라미터"]
featured: false
draft: false
---

[지난 글](/posts/java-generic-class/)에서 타입 파라미터를 가진 클래스를 설계하는 방법을 살펴봤다. 이번에는 **제네릭 메서드**를 다룬다. 제네릭 메서드는 클래스 수준이 아니라 **메서드 수준**에서 타입 파라미터를 선언한다. 제네릭 클래스가 아닌 일반 클래스에도 제네릭 메서드를 정의할 수 있어, 유틸리티 클래스 작성에서 특히 자주 쓰인다.

## 선언 문법 — 반환 타입 앞 `<T>`

제네릭 메서드의 타입 파라미터는 **반환 타입 바로 앞**에 `<T>` 형식으로 선언한다.

```java
// 일반 메서드 — 반환 타입: String
public static String getFirst(String[] arr) { ... }

// 제네릭 메서드 — <T>를 반환 타입 앞에 추가
public static <T> T getFirst(T[] arr) {
    return arr[0];
}
```

수식어(접근 제한자, `static`)는 `<T>` 앞에 오고, 반환 타입 `T`는 `<T>` 뒤에 온다.

## 타입 추론 — 인수에서 T 결정

컴파일러는 메서드 인수의 타입을 보고 `T`를 자동으로 추론한다. 호출할 때 타입 인자를 명시할 필요가 없다.

```java
public static <T> T identity(T value) {
    return value;
}

// 컴파일러 추론: T = String
String s = identity("Java");

// 컴파일러 추론: T = Integer
int n = identity(42);

// 컴파일러 추론: T = Double
double d = identity(3.14);
```

![제네릭 메서드 타입 추론 흐름](/assets/posts/java-generic-method-diagram.svg)

## 실전 예제 — swap과 fromArray

제네릭 메서드의 대표적인 활용 사례다.

```java
// 배열 원소 교환
public static <T> void swap(T[] arr, int i, int j) {
    T tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

// 배열 → List 변환
public static <T> List<T> fromArray(T[] arr) {
    return new ArrayList<>(Arrays.asList(arr));
}
```

```java
String[] names = {"A", "B", "C"};
swap(names, 0, 2);     // T = String 추론
// names = ["C", "B", "A"]

Integer[] nums = {1, 2, 3};
List<Integer> list = fromArray(nums); // T = Integer 추론
```

![제네릭 메서드 실전 예제](/assets/posts/java-generic-method-inference.svg)

## 명시적 타입 인자

자동 추론이 어렵거나 모호한 경우 타입 인자를 명시할 수 있다. 메서드 이름 앞에 `.<T>` 형식으로 작성한다.

```java
// 명시적 타입 인자 — 인스턴스 메서드
List<String> list = obj.<String>getList();

// 명시적 타입 인자 — 정적 메서드
Utils.<String>swap(names, 0, 2);

// 추론이 불가능한 경우: 인수 없이 반환 타입만 있을 때
public static <T> List<T> emptyList() {
    return new ArrayList<>();
}
// T 추론 불가 — 명시 필요
List<String> empty = Utils.<String>emptyList();
// 또는 좌변 타입에서 추론 (Java 8+)
List<String> empty = Utils.emptyList(); // 보통 이걸로 충분
```

## 제네릭 메서드 vs 제네릭 클래스

| 항목 | 제네릭 메서드 | 제네릭 클래스 |
|---|---|---|
| 타입 파라미터 범위 | 해당 메서드 | 클래스 전체 |
| 선언 위치 | 반환 타입 앞 | 클래스 이름 뒤 |
| `static` 가능 여부 | 가능 | 인스턴스 타입 파라미터 불가 |
| 주요 용도 | 유틸리티 메서드 | 타입 안전 컨테이너 |

## Collections 클래스 예시

표준 라이브러리 `java.util.Collections`가 제네릭 메서드의 좋은 예다.

```java
// <T extends Comparable<? super T>> 로 정렬 가능 보장
public static <T extends Comparable<? super T>> void sort(List<T> list)

// 비교자 기반 정렬
public static <T> void sort(List<T> list, Comparator<? super T> c)

// 타입 안전 빈 컬렉션
public static <T> List<T> emptyList()
public static <K,V> Map<K,V> emptyMap()
```

```java
List<Integer> nums = Arrays.asList(3, 1, 2);
Collections.sort(nums);         // T = Integer 추론
System.out.println(nums);       // [1, 2, 3]

// Comparator 역정렬
Collections.sort(nums, Comparator.reverseOrder());
System.out.println(nums);       // [3, 2, 1]
```

---

**지난 글:** [제네릭 클래스 — 타입 매개변수를 가진 클래스 설계](/posts/java-generic-class/)

**다음 글:** [경계 타입 파라미터 — extends와 super로 범위 제한](/posts/java-bounded-type-parameter/)

<br>
읽어주셔서 감사합니다. 😊
