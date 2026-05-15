---
title: "Java 배열 완전 정복 — 선언부터 Arrays 유틸리티까지"
description: "Java 배열의 선언·생성·초기화·접근·순회부터 Arrays 유틸리티 클래스까지, 힙 메모리 구조와 흔한 함정을 포함해 배열의 모든 것을 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "배열", "Array", "Arrays", "자료구조"]
featured: false
draft: false
---

[지난 글](/posts/java-pattern-matching-switch/)에서 패턴 매칭 switch로 타입 기반 분기를 선언적으로 처리하는 방법을 살펴봤다. 이번에는 Java에서 가장 기초적이면서도 뜻밖에 함정이 많은 **배열(Array)**을 처음부터 끝까지 다진다. 배열은 동일한 타입의 값을 연속된 메모리 공간에 나란히 저장하는 자료구조로, Java의 모든 컬렉션 프레임워크가 내부적으로 배열을 활용한다. 제대로 이해하면 `ArrayList`, `HashMap` 같은 고수준 컬렉션을 쓸 때도 성능 예측이 훨씬 쉬워진다.

## 배열이란 무엇인가

배열은 **고정 크기**의 동일 타입 데이터를 담는 객체다. 선언 시점에는 참조 변수만 만들어지고, `new` 키워드로 실제 메모리를 할당해야 한다. 생성된 배열은 **힙(Heap)**에 위치하며 스택의 참조 변수가 그 주소를 가리킨다.

![배열 구조와 힙 메모리](/assets/posts/java-arrays-basics-structure.svg)

배열의 핵심 특성 세 가지를 먼저 기억해 두자.

- **0-based 인덱스**: 첫 요소는 `arr[0]`, 마지막은 `arr[arr.length - 1]`
- **고정 크기**: 한 번 생성하면 크기를 바꿀 수 없다. 크기 변경이 필요하면 `ArrayList`를 쓴다
- **기본값 자동 초기화**: `int[]`는 `0`, `boolean[]`은 `false`, 객체 배열은 `null`로 초기화된다

## 선언, 생성, 초기화

배열을 만드는 방법은 세 가지다.

```java
// 방법 1: 선언 후 new로 생성
int[] scores = new int[5];      // [0, 0, 0, 0, 0]

// 방법 2: 선언과 동시에 리터럴 초기화
int[] primes = {2, 3, 5, 7, 11};

// 방법 3: new와 리터럴 동시 사용 (메서드 인수 전달 시 유용)
printArray(new int[]{10, 20, 30});

// 객체 배열
String[] names = new String[3]; // [null, null, null]
names[0] = "Alice";
```

`int arr[]` 처럼 변수 뒤에 `[]`를 붙이는 C 스타일 문법도 허용되지만, Java 컨벤션은 **타입 뒤에 `[]`**를 붙인다.

## 배열 접근과 순회

```java
int[] arr = {10, 20, 30, 40, 50};

// 인덱스 직접 접근 — O(1)
int first = arr[0];   // 10
int last  = arr[arr.length - 1]; // 50

// 인덱스가 필요할 때: 전통 for
for (int i = 0; i < arr.length; i++) {
    System.out.printf("[%d] = %d%n", i, arr[i]);
}

// 인덱스가 불필요할 때: enhanced for (for-each)
for (int v : arr) {
    System.out.println(v);
}
```

`arr.length`는 **필드**이므로 괄호가 없다. `String.length()`와 혼동하지 않도록 주의하자.

## Arrays 유틸리티 클래스

`java.util.Arrays`는 배열 조작에 필요한 거의 모든 기능을 정적 메서드로 제공한다.

```java
import java.util.Arrays;

int[] arr = {5, 3, 1, 4, 2};

// 정렬 (Dual-Pivot Quicksort, O(n log n))
Arrays.sort(arr);                    // [1, 2, 3, 4, 5]

// 이진 탐색 — 반드시 정렬 후 사용
int idx = Arrays.binarySearch(arr, 3); // 인덱스 2 반환, 없으면 음수

// 복사
int[] copy = Arrays.copyOf(arr, arr.length);         // 전체 복사
int[] slice = Arrays.copyOfRange(arr, 1, 4);         // [2, 3, 4]

// 내용 비교 (== 대신 사용)
System.out.println(Arrays.equals(arr, copy));        // true

// 전체 동일 값으로 채우기
Arrays.fill(arr, 0);                                 // [0, 0, 0, 0, 0]

// 디버깅용 문자열 변환
System.out.println(Arrays.toString(arr));            // [0, 0, 0, 0, 0]
```

역순 정렬이 필요하면 기본형 배열(`int[]`)을 직접 쓸 수 없다. 래퍼 타입 배열로 변환해야 한다.

```java
Integer[] boxed = {5, 3, 1, 4, 2};
Arrays.sort(boxed, Comparator.reverseOrder()); // [5, 4, 3, 2, 1]
```

## 배열 복사 주의: 얕은 복사 vs 깊은 복사

```java
int[] a = {1, 2, 3};
int[] b = a;          // 얕은 복사 — 같은 힙 객체를 가리킴

b[0] = 99;
System.out.println(a[0]); // 99 ← a도 바뀐다!

// 진짜 복사(독립 배열)
int[] c = Arrays.copyOf(a, a.length);
c[0] = 0;
System.out.println(a[0]); // 99 ← a 불변
```

객체 배열의 경우 `Arrays.copyOf`는 여전히 **내부 객체의 참조**만 복사한다(얕은 복사). 객체 자체를 독립적으로 복사하려면 별도 로직이 필요하다.

## 흔한 런타임 예외

![배열 연산 패턴과 주의사항](/assets/posts/java-arrays-basics-operations.svg)

| 예외 | 원인 |
|---|---|
| `ArrayIndexOutOfBoundsException` | 인덱스가 `0` 미만이거나 `length` 이상 |
| `NullPointerException` | 선언만 하고 초기화하지 않은 배열에 접근 |
| `NegativeArraySizeException` | `new int[-1]`처럼 음수 크기로 생성 |

## 배열 vs ArrayList

배열은 성능이 뛰어나지만 크기가 고정된다. 일반적으로 다음 기준으로 선택한다.

- **배열**: 크기가 확정적이고 성능이 중요한 경우 (예: 알고리즘 문제, 내부 버퍼)
- **`ArrayList`**: 동적 추가·삭제가 필요한 경우

`ArrayList`도 내부는 배열이다. 용량 초과 시 1.5배 크기로 새 배열을 할당하고 복사한다는 사실을 알면 성능 예측이 쉬워진다.

## 정리

배열은 Java에서 가장 원시적인 자료구조지만, 힙 할당 방식과 참조 의미론을 정확히 이해하면 더 복잡한 컬렉션도 자신 있게 다룰 수 있다. 핵심은 세 가지다: 0-based 인덱스, 고정 크기, 그리고 `=` 대입은 참조 복사라는 사실.

---

**다음 글:** [Java 다차원 배열 완전 정복](/posts/java-multi-dimensional-array/)

<br>
읽어주셔서 감사합니다. 😊
