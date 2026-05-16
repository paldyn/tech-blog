---
title: "Java String 완전 정복 — 불변 객체, 주요 메서드, 비교의 모든 것"
description: "Java String의 불변성 원리, charAt부터 strip까지 핵심 메서드, == vs equals 함정, String.format 활용까지 실전 중심으로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "String", "불변성", "문자열", "equals", "String 메서드"]
featured: false
draft: false
---

[지난 글](/posts/java-multi-dimensional-array/)에서 다차원 배열과 가변 배열 구조를 살펴봤다. 이번에는 Java에서 가장 자주 사용되는 타입인 **String**을 깊이 파고든다. "그냥 문자열 아닌가?"라고 생각하면 오산이다. Java String은 불변 객체라는 설계 원칙 위에 세워져 있고, 이 원칙을 모르면 버그와 성능 문제를 반복하게 된다.

## String은 클래스다

Java에서 `String`은 기본 타입(primitive)이 아니라 `java.lang.String` 클래스의 인스턴스다. 내부적으로 Java 9 이전까지는 `char[]`를, Java 9 이후에는 `byte[]`(Compact Strings)를 사용해 문자를 저장한다.

```java
String greeting = "Hello";
String name     = new String("World");
```

두 선언 방식은 겉보기에 같아 보이지만 메모리 동작이 다르다. 이 차이는 String Pool을 다루는 다음 글에서 자세히 설명한다.

## 불변성(Immutability)

**String 객체는 한 번 생성되면 내부 상태를 절대 바꿀 수 없다.** `toUpperCase()`, `replace()`, `concat()` 같은 모든 변환 메서드는 기존 객체를 바꾸는 게 아니라 새 String 객체를 반환한다.

```java
String s = "hello";
s.toUpperCase();          // 리턴값을 버리면 아무 효과 없음
System.out.println(s);   // "hello" — 변하지 않음

String upper = s.toUpperCase();
System.out.println(upper); // "HELLO" — 새 객체
```

![String 불변성 구조](/assets/posts/java-string-essentials-immutability.svg)

불변성 덕분에 String은 세 가지 강점을 얻는다.

1. **스레드 안전**: 동기화 없이 여러 스레드가 동시에 읽어도 안전하다.
2. **hashCode 캐싱**: `hashCode()`는 최초 1회만 계산되어 필드에 저장된다. HashMap·HashSet의 키로 이상적인 이유다.
3. **String Pool 공유**: 동일 리터럴은 힙에 하나만 존재해 메모리를 아낀다.

## 자주 쓰는 메서드 분류

![자주 쓰는 String 메서드](/assets/posts/java-string-essentials-methods.svg)

### 검색·확인

```java
String s = "Hello, World!";

s.length();              // 13
s.charAt(7);             // 'W'
s.indexOf("World");      // 7
s.lastIndexOf('l');      // 10
s.contains("World");     // true
s.startsWith("Hello");   // true
s.endsWith("!");         // true
s.isEmpty();             // false — length() == 0 이면 true
s.isBlank();             // false — 공백만 있으면 true (Java 11)
```

`isEmpty()`는 길이가 0인 경우만 `true`를 반환한다. 공백 문자만 있는 `"   "`는 `isEmpty() == false`지만 `isBlank() == true`다.

### 변환

```java
"hello".toUpperCase();           // "HELLO"
"HELLO".toLowerCase();           // "hello"
"  hi  ".trim();                 // "hi" — ASCII 공백 제거
"  hi  ".strip();                // "hi" — 유니코드 공백도 제거 (Java 11)
"  hi  ".stripLeading();         // "hi  "
"  hi  ".stripTrailing();        // "  hi"
"ha".repeat(3);                  // "hahaha" (Java 11)
```

`trim()`은 ASCII 코드 32 이하 문자를 제거하지만 `strip()`은 `Character.isWhitespace()`를 기준으로 유니코드 공백도 처리한다. Java 11 이후라면 `strip()`을 기본으로 사용하는 편이 안전하다.

### 추출·분리

```java
String s = "Hello, World!";

s.substring(7);           // "World!" — 7번 인덱스부터 끝
s.substring(7, 12);       // "World"  — [7, 12) 범위
s.split(", ");            // ["Hello", "World!"]
s.split(",", 2);          // ["Hello", " World!"] — 최대 2토큰
s.chars()                 // IntStream (각 char의 코드포인트)
 .mapToObj(c -> String.valueOf((char) c))
 .toList();               // ["H","e","l","l","o",",","W","o","r","l","d","!"]
```

`substring(begin, end)`는 `begin`은 포함하고 `end`는 포함하지 않는 **반개방 구간**임을 기억한다.

### 교체

```java
"hello world".replace('l', 'L');          // "heLLo WorLd"
"hello world".replace("world", "Java");   // "hello Java"
"aaa".replaceFirst("a", "b");             // "baa"
"aaa".replaceAll("a", "b");               // "bbb"
"2026-05-17".replaceAll("\\d", "#");      // "####-##-##"
```

`replaceAll`과 `replaceFirst`의 첫 번째 인수는 **정규식**이다. `replace`는 리터럴 매칭이다.

### 결합

```java
String.join("-", "2026", "05", "17");     // "2026-05-17"
String.join(", ", List.of("a","b","c"));  // "a, b, c"
String.format("이름: %s, 나이: %d", "철수", 20); // "이름: 철수, 나이: 20"
"Java".concat(" 21");                     // "Java 21"
```

반복적으로 문자열을 이어야 할 때는 `+` 연산자나 `concat` 대신 `StringBuilder`를 사용한다. 매 연산마다 새 객체가 생성되기 때문이다.

### Java 11 `lines()`

```java
String text = "one\ntwo\nthree";
text.lines()
    .map(String::toUpperCase)
    .forEach(System.out::println);
// ONE
// TWO
// THREE
```

## == vs equals() — 반드시 알아야 할 함정

```java
String a = new String("hello");
String b = new String("hello");

a == b;         // false — 서로 다른 힙 객체의 참조를 비교
a.equals(b);    // true  — 내용(char 시퀀스)을 비교
```

`==`는 참조 주소를 비교한다. 두 변수가 정확히 같은 힙 객체를 가리킬 때만 `true`다. **내용이 같은지 비교하려면 반드시 `equals()`를 사용한다.**

대소문자를 무시하고 비교할 때는 `equalsIgnoreCase()`, 사전순으로 정렬할 때는 `compareTo()` 또는 `compareToIgnoreCase()`를 쓴다.

```java
"Java".equalsIgnoreCase("java");   // true
"abc".compareTo("abd");            // -1 (음수 → 앞이 사전순으로 빠름)
```

### NPE 방어 패턴

```java
String s = null;
s.equals("hello");         // NullPointerException!
"hello".equals(s);         // false — 안전
Objects.equals(s, "hello"); // false — 양쪽 null 허용
```

변수가 `null`일 수 있다면 리터럴을 왼쪽에 두거나 `Objects.equals()`를 사용한다.

## String을 다른 타입으로, 다른 타입을 String으로

```java
// 기본 타입 → String
String.valueOf(42);       // "42"
String.valueOf(3.14);     // "3.14"
String.valueOf(true);     // "true"
Integer.toString(255, 16); // "ff" (16진수)

// String → 기본 타입
int n    = Integer.parseInt("42");
double d = Double.parseDouble("3.14");
boolean b = Boolean.parseBoolean("true");

// char 배열 ↔ String
char[] chars = "hello".toCharArray();
String back  = new String(chars);
```

## 유용한 정적 메서드 모음

```java
// 반복 (Java 11)
"-".repeat(20);           // "--------------------"

// 형식화
String.format("%05d", 42);         // "00042"
String.format("%.2f", 3.14159);    // "3.14"

// chars / codePoints
"abc".chars().sum();               // 97+98+99 = 294
```

## 정리

Java String은 **불변 객체**라는 전제 위에 설계되어 있다. 변환 메서드는 항상 새 객체를 반환하며 원본을 바꾸지 않는다. 내용 비교는 항상 `equals()`를 사용하고, 반복 결합은 `StringBuilder`로, 유니코드 공백 제거가 필요하면 `strip()`으로 대체한다. Java 11에서 추가된 `isBlank()`, `strip()`, `repeat()`, `lines()`는 실무에서 매우 자주 쓰이므로 익혀두자.

---

**지난 글:** [Java 다차원 배열 완전 정복 — 2D 배열부터 가변 배열까지](/posts/java-multi-dimensional-array/)

**다음 글:** [Java String Pool 완전 정복 — intern, 리터럴, 메모리 구조](/posts/java-string-pool/)

<br>
읽어주셔서 감사합니다. 😊
