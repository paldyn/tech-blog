---
title: "Java String Pool 완전 정복 — intern, 리터럴, 메모리 구조"
description: "Java String Pool의 위치 변화(PermGen → Heap), 리터럴과 new String()의 차이, intern() 동작 원리, StringTable 튜닝까지 메모리 관점에서 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "String Pool", "intern", "StringTable", "PermGen", "Heap", "메모리"]
featured: false
draft: false
---

[지난 글](/posts/java-string-essentials/)에서 String의 불변성과 핵심 메서드를 살펴봤다. 이번에는 한 단계 깊이 들어가 **String Pool**의 구조와 동작 원리를 파고든다. `"hello" == "hello"`가 `true`인 이유, `new String("hello")`가 왜 다른지, `intern()`이 실제로 무슨 일을 하는지를 메모리 수준에서 이해하면 String 관련 버그와 성능 문제를 근본적으로 예방할 수 있다.

## String Pool이란

String Pool(문자열 상수 풀, String Constant Pool)은 JVM이 동일한 문자열 리터럴을 단 하나의 힙 객체로 관리하는 영역이다. 소스 코드에 `"hello"`라는 리터럴이 100곳에 있어도 힙에는 `"hello"` 객체가 단 하나만 존재한다.

```java
String a = "hello";
String b = "hello";
System.out.println(a == b);      // true  — 같은 Pool 객체
System.out.println(a.equals(b)); // true
```

`a == b`가 `true`인 이유는 두 변수가 Pool 안의 동일한 객체를 가리키기 때문이다.

## Pool의 위치 변화: PermGen → Heap

Java 6까지 String Pool은 **PermGen(Permanent Generation)** 영역에 있었다. PermGen은 크기가 고정되어 있어 `intern()`을 남용하거나 클래스가 많으면 `OutOfMemoryError: PermGen space` 오류가 발생했다.

**Java 7부터** String Pool이 일반 **힙(Heap)** 으로 이동했다. 이 변화는 두 가지를 의미한다.

1. **GC 대상**: 더 이상 참조되지 않는 Pool 문자열이 가비지 컬렉터에 의해 회수될 수 있다.
2. **크기 제약 완화**: 힙 크기(-Xmx)가 허용하는 만큼 Pool이 커질 수 있다.

Java 8에서는 PermGen 자체가 사라지고 Metaspace로 교체되었다. String Pool은 계속 힙에 머문다.

## 리터럴 vs new String()

![String Pool 메모리 구조](/assets/posts/java-string-pool-structure.svg)

```java
String a = "hello";              // Pool 참조
String b = "hello";              // 같은 Pool 참조
String c = new String("hello");  // Pool 밖 별도 힙 객체
String d = new String("hello");  // 또 다른 별도 힙 객체

System.out.println(a == b);  // true
System.out.println(a == c);  // false — c는 다른 객체
System.out.println(c == d);  // false — 서로 다른 객체
System.out.println(c.equals(d)); // true — 내용은 같음
```

`new String("hello")`를 호출하면 JVM은 두 가지 일을 한다.

1. Pool에 `"hello"`가 없으면 Pool에 추가한다.
2. **항상** Pool 밖에 새로운 힙 객체를 하나 더 생성해 반환한다.

따라서 `new String(리터럴)` 형태는 메모리를 낭비한다. 의도적으로 Pool을 우회해야 하는 경우가 아니라면 리터럴을 직접 사용한다.

## intern() 메서드

`intern()`은 호출한 String 객체의 내용을 Pool에서 찾아 반환하는 메서드다.

![intern() 동작 흐름](/assets/posts/java-string-pool-intern.svg)

```java
String c = new String("hello"); // Pool 밖 객체
String poolRef = c.intern();    // Pool의 "hello" 반환

System.out.println(poolRef == "hello"); // true
System.out.println(c == "hello");       // false — c 자체는 여전히 Pool 밖
```

`intern()`은 반환값을 쓰는 게 핵심이다. 호출만 하고 반환값을 버리면 아무 효과가 없다.

### intern() 내부 동작

JVM은 내부적으로 `StringTable`이라는 해시 테이블로 Pool을 관리한다.

1. `intern()` 호출 시 `StringTable`에서 동일 내용의 항목을 검색한다.
2. 찾으면 그 항목의 참조를 반환한다.
3. 없으면 현재 객체(또는 그 복사본)를 `StringTable`에 등록하고 반환한다.

## 컴파일 타임 상수 표현식

컴파일러는 **상수 표현식**으로만 이뤄진 문자열 연결을 컴파일 시점에 Pool 항목으로 만든다.

```java
final String A = "hel";
final String B = "lo";
String c = A + B;           // 컴파일 타임 상수 → Pool의 "hello"

String x = "hel";
String y = "lo";
String z = x + y;           // 런타임 연결 → 새 힙 객체

System.out.println(c == "hello"); // true
System.out.println(z == "hello"); // false
```

`final`로 선언된 지역 변수 또는 필드의 리터럴 연결은 컴파일러가 인라인해 Pool 항목이 된다. `final`이 없으면 런타임에 `StringBuilder`를 통해 새 객체가 만들어진다.

## StringTable 크기와 성능

`StringTable`은 해시 테이블이므로 버킷 수가 성능에 영향을 준다. 기본값은 JVM 버전마다 다르다.

| JVM 버전   | 기본 버킷 수    |
|-----------|------------|
| Java 7u40 이전 | 1009      |
| Java 7u40+    | 60013     |
| Java 11+      | 65536     |

버킷 수가 너무 적으면 해시 충돌이 많아 `intern()` 성능이 낮아진다. 대량의 고유 문자열을 `intern()`할 경우 `-XX:StringTableSize=131072` 처럼 두 배로 늘릴 수 있다(소수 값 권장).

```bash
# StringTable 통계 확인 (Java 11+)
java -XX:+PrintStringTableStatistics -version
```

## G1 GC의 String Deduplication

Java 8u20부터 G1 GC는 **String Deduplication**(문자열 중복 제거)을 지원한다. Pool 외부의 중복된 `char[]`/`byte[]`를 GC가 자동으로 하나로 합쳐 메모리를 줄인다.

```bash
# String Deduplication 활성화
java -XX:+UseG1GC -XX:+UseStringDeduplication MyApp
```

`intern()`은 참조를 공유하지만, String Deduplication은 내부 바이트 배열을 공유한다. 두 접근은 상호 보완적이다.

## 언제 intern()을 쓰면 좋은가

```java
// 좋은 사례: 유한한 종류의 문자열 (상태, 코드명)
Map<String, List<Order>> byStatus = new HashMap<>();
String key = fetchStatusFromDB().intern(); // 동일 상태 문자열이 Pool 하나 공유

// 나쁜 사례: 사용자 입력, 파일 내용 등 무한한 고유 문자열
for (String line : hugeFile) {
    line.intern(); // Pool을 계속 불림 → 힙 압박
}
```

`intern()`이 효과적인 경우는 **값의 종류가 유한**하고, 동일 문자열이 여러 곳에서 반복 생성될 때다. 사용자 입력처럼 종류가 무한한 문자열에 `intern()`을 남용하면 Pool이 부풀어 GC 부담이 오히려 커진다.

## 실전 정리

```java
// 1. 리터럴 사용 — Pool 자동 활용
String s1 = "hello";

// 2. new String 지양 — Pool 밖 객체 생성
String s2 = new String("hello"); // 불필요한 객체 생성

// 3. 내용 비교는 equals()
s1.equals(s2);   // true  (올바름)
s1 == s2;        // false (참조 비교 — 잘못된 사용)

// 4. intern() 반환값을 반드시 사용
String pooled = s2.intern(); // pooled == s1 → true
s2.intern();                 // 반환값 버리면 의미 없음

// 5. 컴파일 타임 상수는 자동으로 Pool 항목
final String prefix = "hel";
(prefix + "lo") == "hello";  // true
```

String Pool은 Java 메모리 모델의 핵심 최적화 장치다. 리터럴을 쓰면 JVM이 자동으로 Pool을 활용하고, `new String()`은 의도적인 우회가 필요할 때만 쓴다. `intern()`은 동적으로 생성된 문자열을 Pool로 끌어들이는 수단이지만 남용하면 독이 된다. 이 세 가지 원칙을 기억하면 String 관련 메모리 문제의 대부분을 예방할 수 있다.

---

**지난 글:** [Java String 완전 정복 — 불변 객체와 주요 메서드](/posts/java-string-essentials/)

**다음 글:** [Java StringBuilder와 StringBuffer 완전 정복](/posts/java-stringbuilder-stringbuffer/)

<br>
읽어주셔서 감사합니다. 😊
