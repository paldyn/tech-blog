---
title: "Java 기본형(Primitive Types) 완전 정리"
description: "Java 8가지 기본형의 크기·범위·기본값과 자동 형 변환, 래퍼 클래스, 주의사항을 예제 중심으로 완전히 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "primitive type", "기본형", "int", "long", "double", "char", "boolean", "형 변환", "래퍼 클래스"]
featured: false
draft: false
---

[지난 글](/posts/java-variables-and-literals/)에서 변수 선언 구조와 리터럴 표기법을 배웠다. 변수에 담기는 값은 크게 **기본형(primitive type)** 과 **참조형(reference type)** 으로 나뉜다. 이번에는 기본형 여덟 가지를 다루는데, 단순히 표를 외우는 것을 넘어 각 타입이 선택되는 이유, 정밀도 함정, 형 변환 규칙까지 실용적인 관점에서 살펴본다.

## 기본형이란

기본형은 **값 자체를 변수에 직접 저장**하는 타입이다. 참조형처럼 힙에 객체를 생성하지 않으므로 메모리 효율이 높고 연산 속도가 빠르다. Java 명세는 기본형을 정확히 여덟 가지로 고정한다.

![Java 기본형 8종 비교](/assets/posts/java-primitive-types-overview.svg)

## 정수형 (byte · short · int · long)

### int — 기본 정수형

`int`는 가장 자주 사용하는 정수형이다. 32비트 부호 있는 2의 보수 표현으로, 약 ±21억 범위를 다룬다. 접미사 없는 정수 리터럴의 기본 타입이기도 하다.

```java
int max = Integer.MAX_VALUE;   // 2,147,483,647
int min = Integer.MIN_VALUE;   // -2,147,483,648
int overflow = max + 1;        // -2,147,483,648 (오버플로! 예외 없음)
```

오버플로는 **예외 없이 조용히 발생**한다. 큰 범위가 필요하면 `long`을 쓰거나, 임의 정밀도가 필요하면 `BigInteger`를 사용한다.

### long — 64비트 정수

약 ±920경의 범위가 필요할 때 사용한다. 리터럴에 반드시 `L`(대문자 권장)을 붙여야 한다.

```java
long population = 8_000_000_000L;   // 80억
long nanos = System.nanoTime();     // 나노초 타임스탬프
```

### byte · short — 작은 정수

`byte`(-128 ~ 127)와 `short`(-32768 ~ 32767)는 메모리를 아껴야 하는 대용량 배열이나 파일 I/O 처리에 쓰인다. 단독 산술 연산에서는 JVM이 자동으로 `int`로 승격(promotion)하므로 결과를 다시 캐스팅해야 한다.

```java
byte a = 100, b = 40;
// byte c = a + b; // 컴파일 오류: int → byte 손실 변환
byte c = (byte)(a + b);  // 명시적 캐스팅 (-116, 오버플로)
```

## 실수형 (float · double)

### double — 기본 부동소수점

64비트 IEEE 754 배정밀도로, 유효 자리가 약 15~16자리다. 소수점 리터럴의 기본 타입이다.

```java
double pi  = 3.141592653589793;
double tax = 100.0 * 0.1;   // 10.000000000000002 (!)
```

부동소수점은 **이진 분수로 근사**하므로 정확한 십진 소수를 표현하지 못한다. 금액 계산에는 절대 `double`을 쓰지 말고 `BigDecimal`을 사용해야 한다.

### float — 32비트 단정밀도

유효 자리 약 7자리로 정밀도가 낮지만 메모리를 절반만 사용한다. 그래픽스 연산, 머신러닝 텐서 등 정밀도보다 메모리 효율이 중요한 곳에 쓰인다. 리터럴에 반드시 `f` 또는 `F`를 붙인다.

```java
float x = 3.14f;
float y = 1 / 3.0f;   // 0.33333334 (7자리 유효)
```

## 문자형 (char)

`char`는 UTF-16 코드 단위 하나를 저장하는 16비트 부호 없는 정수다. 내부적으로 0~65535 범위의 숫자이므로 정수와 산술 연산이 가능하다.

```java
char ch = 'A';
System.out.println(ch + 1);    // 66 (int로 승격)
System.out.println((char)(ch + 1)); // B
```

BMP(기본 다국어 평면) 밖의 이모지나 한자 중 일부는 코드 포인트가 65535를 초과한다. 이런 문자는 `char` 두 개로 이루어진 **서로게이트 쌍(surrogate pair)** 으로 표현되므로, 문자 단위 처리가 필요하면 `String`의 `codePoints()` 스트림을 사용해야 한다.

## 논리형 (boolean)

`true` 또는 `false` 두 값만 가지며, 정수형과 변환이 불가하다.

```java
boolean isOpen  = true;
boolean isEmpty = (size == 0);
if (isOpen && !isEmpty) {
    process();
}
```

배열 원소로 사용할 때 JVM은 보통 1바이트를 할당하지만, 단독 변수의 실제 크기는 JVM 구현에 따라 다르다(보통 4바이트로 정렬).

## 자동 형 변환 (Widening Conversion)

작은 타입에서 큰 타입으로는 명시적 캐스팅 없이 자동 변환된다.

![자동 형 확장 변환 흐름](/assets/posts/java-primitive-types-widening.svg)

```java
byte  b = 10;
int   i = b;        // byte → int (자동)
long  l = i;        // int  → long (자동)
float f = l;        // long → float (자동, 정밀도 손실 가능!)
double d = f;       // float → double (자동)
```

`long → float` 구간은 크기 면에서는 확장이지만, `float`의 유효 자릿수(7)가 `long`의 범위를 다 커버하지 못하므로 **값의 정밀도 손실**이 발생할 수 있다.

## 명시적 형 변환 (Narrowing Conversion)

큰 타입에서 작은 타입으로는 반드시 캐스트 연산자를 써야 한다.

```java
double d = 9.99;
int    i = (int) d;     // 9 (소수점 이하 절삭, 반올림 아님)
long   l = 1_000_000_000_000L;
int    j = (int) l;     // 쓰레기 값: 상위 비트 잘림
```

`(int) 9.99`는 `10`이 아니라 `9`다. 소수점을 반올림하려면 `Math.round()`를 사용한다.

## 래퍼 클래스 (Wrapper Class)

컬렉션(`List`, `Map` 등)은 객체만 담을 수 있다. 기본형을 컬렉션에 넣거나, 제네릭 타입 파라미터로 쓰거나, `null`을 표현해야 할 때는 대응하는 **래퍼 클래스**를 사용한다.

| 기본형 | 래퍼 클래스 |
|--------|-------------|
| `byte` | `Byte` |
| `short` | `Short` |
| `int` | `Integer` |
| `long` | `Long` |
| `float` | `Float` |
| `double` | `Double` |
| `char` | `Character` |
| `boolean` | `Boolean` |

```java
List<Integer> nums = new ArrayList<>();
nums.add(42);          // 오토박싱: int → Integer (자동)
int n = nums.get(0);   // 언박싱: Integer → int (자동)
```

### 오토박싱 함정

```java
Integer a = 1000;
Integer b = 1000;
System.out.println(a == b);      // false (두 개의 Integer 객체)
System.out.println(a.equals(b)); // true  (값 비교)
```

`Integer` 캐시는 기본적으로 -128 ~ 127 범위만 같은 객체를 재사용한다. 이 범위를 벗어나면 `==` 비교가 `false`가 되므로 래퍼 클래스 값 비교에는 항상 `equals()`를 사용해야 한다.

성능이 민감한 루프 안에서 오토박싱이 반복되면 힙 할당이 누적되어 GC 부담이 증가한다. 내부 연산에는 기본형을, 경계(API 출력, 컬렉션 저장)에서만 래퍼 클래스를 사용하는 것이 좋다.

## 타입 선택 가이드

| 상황 | 권장 타입 |
|------|-----------|
| 일반 정수 연산 | `int` |
| 파일 크기, 타임스탬프, 큰 수 | `long` |
| 일반 실수 연산 | `double` |
| 메모리 절약 (그래픽스 등) | `float` |
| 금액, 정밀 소수 | `BigDecimal` |
| 임의 정밀도 정수 | `BigInteger` |
| 단일 문자 | `char` |
| 조건/플래그 | `boolean` |

## 정리

Java 기본형 여덟 가지는 크기와 범위가 명세로 고정되어 있고, 오버플로·정밀도 손실·형 변환 규칙이 각각 다르다. `int`와 `double`을 기본으로 사용하되 범위·정밀도·메모리 요구에 따라 다른 타입을 선택하고, 컬렉션이나 API 경계에서만 래퍼 클래스로 전환하는 것이 실무의 기본 원칙이다. 다음 글에서는 기본형의 반대편에 있는 **참조형(reference type)** 을 다루며 객체와 메모리의 관계를 본격적으로 살펴본다.

---

**지난 글:** [Java 변수와 리터럴 완전 정리](/posts/java-variables-and-literals/)

**다음 글:** [Java 참조형(Reference Types) 완전 정리](/posts/java-reference-types/)

<br>
읽어주셔서 감사합니다. 😊
