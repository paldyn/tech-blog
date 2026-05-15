---
title: "Java 타입 변환(Type Conversion) 완전 정리"
description: "Java 자동 형 확장 변환과 명시적 캐스팅, 기본형·참조형 변환, 오버플로·정밀도 손실 함정, 업캐스팅·다운캐스팅, instanceof 패턴 매칭까지 예제 중심으로 완전히 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "type conversion", "형 변환", "casting", "widening", "narrowing", "업캐스팅", "다운캐스팅", "instanceof", "ClassCastException", "오버플로"]
featured: false
draft: false
---

[지난 글](/posts/java-reference-types/)에서 참조형의 메모리 구조와 네 가지 종류를 살펴봤다. Java에서는 한 타입의 값을 다른 타입으로 변환해야 하는 상황이 끊임없이 발생한다. 기본형 사이의 크기 변환, 기본형과 래퍼 클래스 사이의 박싱/언박싱, 상속 계층 안에서의 참조형 캐스팅까지 규칙이 다양하다. 규칙을 정확히 모르면 컴파일 오류 대신 런타임에 조용히 발생하는 오버플로나 비트 손실, 혹은 `ClassCastException`을 맞닥뜨리게 된다.

## 기본형 형 변환의 두 방향

Java 기본형 형 변환은 **자동(묵시적) 형 확장 변환**과 **명시적 형 축소 변환**으로 나뉜다.

| 구분 | 방향 | 키워드 | 위험성 |
|------|------|--------|--------|
| 형 확장(Widening) | 작은 타입 → 큰 타입 | 불필요 | 대부분 안전 |
| 형 축소(Narrowing) | 큰 타입 → 작은 타입 | 캐스트 연산자 필수 | 오버플로·정밀도 손실 |

## 자동 형 확장 변환 (Widening)

더 큰 타입으로는 명시적 캐스팅 없이 컴파일러가 자동으로 변환한다.

![자동 형 확장 변환 흐름](/assets/posts/java-type-conversion-widening.svg)

변환 경로는 `byte → short → int → long → float → double`이며, `char`는 16비트 부호 없는 정수로 `int` 이상으로 자동 확장된다.

```java
byte  b = 127;
int   i = b;      // byte → int (자동)
long  l = i;      // int  → long (자동)
float f = l;      // long → float (자동, 정밀도 손실 가능!)
double d = f;     // float → double (자동)

char ch = 'A';
int code = ch;    // char → int: 65 (자동)
```

### long → float 의 함정

그림에서 `long → float` 구간이 주황색 경고로 표시된 이유가 있다. `float`는 32비트이지만 부동소수점 형식이라 유효 자릿수는 약 7자리에 불과하다. `long`은 최대 19자리의 정수를 표현할 수 있으므로 이 범위를 벗어나면 **정밀도 손실**이 발생한다.

```java
long big = 123_456_789_012_345L; // 15자리 정수
float f  = big;                  // 자동 확장이지만 근사값!
System.out.println(big);  // 123456789012345
System.out.println(f);    // 1.23456794E14 (손실)
System.out.println((long) f == big); // false
```

자동 변환이지만 값이 바뀔 수 있으므로, 정밀도가 중요한 연산에서 `long → float` 경로는 피해야 한다.

## 명시적 형 축소 변환 (Narrowing Casting)

큰 타입에서 작은 타입으로 변환하려면 반드시 캐스트 연산자 `(type)`을 써야 한다. 컴파일러는 경고 없이 통과시키지만 **런타임 결과는 개발자의 책임**이다.

```java
double d = 9.99;
int i = (int) d;     // 9 (소수점 이하 절삭, 반올림이 아님)

long big = 1_234_567_890_000L;
int j = (int) big;   // 쓰레기값: 상위 32비트 소실
```

### 소수점 절삭 vs 반올림

`(int) 9.99`는 `9`이지, `10`이 아니다. 반올림이 필요하면 `Math.round()`를 사용한다.

```java
double d = 9.6;
int truncated = (int) d;               // 9
long rounded  = Math.round(d);         // 10
int roundedInt = (int) Math.round(d);  // 10
```

### 오버플로 안전 변환

`int` 범위(-2^31 ~ 2^31-1)를 벗어난 `long`을 `(int)`로 캐스팅하면 상위 32비트가 잘려 의미 없는 값이 된다. Java 8+의 `Math.toIntExact()`는 오버플로 시 `ArithmeticException`을 던져 오류를 명확히 한다.

```java
long safe   = 42L;
long unsafe = 5_000_000_000L;  // int 범위 초과

int a = Math.toIntExact(safe);    // 42
int b = Math.toIntExact(unsafe);  // ArithmeticException!
```

## 참조형 캐스팅: 업·다운캐스팅

참조형도 상속 계층 안에서 형 변환이 일어난다.

![명시적 캐스팅 함정과 안전 변환](/assets/posts/java-type-conversion-pitfalls.svg)

### 업캐스팅 (Upcasting) — 자동, 항상 안전

자식 클래스의 객체를 부모 타입 변수에 대입하는 것이다. 다형성의 핵심이며 컴파일러가 자동으로 처리한다.

```java
String s  = "hello";
Object obj = s;         // String → Object (업캐스팅, 자동)

ArrayList<Integer> list = new ArrayList<>();
List<Integer> iList = list; // ArrayList → List (업캐스팅, 자동)
```

### 다운캐스팅 (Downcasting) — 명시적, 주의 필요

부모 타입 변수를 자식 타입으로 변환한다. 실제 객체가 그 타입이 아니면 `ClassCastException`이 발생한다.

```java
Object obj = "hello";
String s = (String) obj;   // OK — 실제 객체가 String
System.out.println(s.toUpperCase()); // "HELLO"

Object num = 42;
String bad = (String) num; // ClassCastException! Integer를 String으로 캐스팅
```

### instanceof 연산자로 안전한 다운캐스팅

캐스팅 전에 `instanceof`로 타입을 검사하면 `ClassCastException`을 예방할 수 있다.

```java
Object obj = "hello";

// 고전적 방식 (Java 15 이하)
if (obj instanceof String) {
    String s = (String) obj;
    System.out.println(s.length());
}

// 패턴 매칭 (Java 16+) — 검사와 캐스팅을 한 번에
if (obj instanceof String s) {
    System.out.println(s.length()); // s는 이미 String으로 바인딩
}
```

Java 16에 도입된 패턴 매칭 `instanceof`는 타입 검사와 캐스팅을 한 줄로 합쳐 코드 중복을 없애준다.

## 오토박싱과 언박싱 (Auto-boxing / Unboxing)

기본형과 래퍼 클래스 사이의 변환은 Java 5부터 컴파일러가 자동으로 처리한다.

```java
// 오토박싱: int → Integer (컴파일러가 Integer.valueOf(42) 삽입)
Integer boxed = 42;

// 언박싱: Integer → int (컴파일러가 boxed.intValue() 삽입)
int unboxed = boxed;

// 컬렉션에서 자연스럽게 사용
List<Integer> list = new ArrayList<>();
list.add(100);       // 오토박싱
int val = list.get(0); // 언박싱
```

### 오토박싱 성능 함정

```java
Long sum = 0L;
for (long i = 0; i < 1_000_000; i++) {
    sum += i;  // 매 반복마다 Long 언박싱 + long 덧셈 + Long 오토박싱!
}
```

위 코드는 루프당 `Long` 객체를 하나씩 생성해 GC 부담이 크다. 내부 연산에는 기본형(`long`)을 쓰고 API 경계에서만 래퍼 클래스로 전환하는 것이 원칙이다.

### 언박싱 NPE

`null`인 래퍼 클래스 변수를 언박싱하면 `NullPointerException`이 발생한다.

```java
Integer n = null;
int val = n;  // NullPointerException — null.intValue() 호출
```

메서드가 `Integer`를 반환할 때 `null`을 반환할 수 있다면, 언박싱 전에 반드시 null 검사를 해야 한다.

## 문자열과 기본형 변환

`String`은 다른 타입과 내장 변환 규칙이 있다.

```java
// 기본형 → String
String s1 = String.valueOf(42);       // "42"
String s2 = Integer.toString(42);     // "42"
String s3 = "" + 42;                  // "42" (간편하지만 성능 낮음)

// String → 기본형
int    i = Integer.parseInt("42");     // 42
double d = Double.parseDouble("3.14"); // 3.14
boolean b = Boolean.parseBoolean("true"); // true

// 잘못된 형식이면 NumberFormatException
int bad = Integer.parseInt("abc");     // NumberFormatException!
```

## switch 식과 패턴 매칭 (Java 21)

Java 21의 `switch` 표현식은 여러 타입을 한꺼번에 다운캐스팅해 처리하는 **타입 패턴 매칭 switch**를 지원한다.

```java
Object obj = getSomeValue();

String desc = switch (obj) {
    case Integer i -> "정수: " + i;
    case String  s -> "문자열: " + s;
    case Double  d -> "실수: " + d;
    default        -> "알 수 없는 타입";
};
```

각 `case`에서 자동으로 타입 검사와 변수 바인딩이 이루어져, 기존의 `instanceof` + 캐스팅 연쇄보다 훨씬 간결하다.

## 정리

Java의 타입 변환은 크게 **기본형 확장(자동)·축소(명시적), 오토박싱/언박싱, 참조형 업·다운캐스팅**으로 나뉜다. 자동 변환이라도 `long → float` 같은 정밀도 손실 구간이 있고, 명시적 캐스팅은 오버플로와 비트 손실 위험을 항상 내포한다. 다운캐스팅 전에는 패턴 매칭 `instanceof`로 타입을 검사하고, 오토박싱이 반복되는 루프에서는 기본형을 사용하는 습관이 안전하고 빠른 코드를 만든다. 다음 글에서는 Java의 모든 연산자 종류와 우선순위, 비트 연산, 삼항 연산자 등을 다룬다.

---

**지난 글:** [Java 참조형(Reference Types) 완전 정리](/posts/java-reference-types/)

**다음 글:** [Java 연산자(Operators) 완전 정리](/posts/java-operators/)

<br>
읽어주셔서 감사합니다. 😊
