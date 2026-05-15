---
title: "Java 연산자(Operator) 완전 정리"
description: "Java의 산술·비교·논리·비트·대입·삼항 연산자 전체를 우선순위와 함께 정리하고, 단락 평가·정수 오버플로·패턴 매칭 instanceof 등 실무에서 자주 마주치는 함정까지 예제 중심으로 완전히 해설한다"
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "operators", "연산자", "산술연산자", "비교연산자", "논리연산자", "비트연산자", "삼항연산자", "instanceof", "단락평가", "오버플로"]
featured: false
draft: false
---

[지난 글](/posts/java-type-conversion/)에서 타입 변환을 살펴봤다. 이번에는 Java 코드 어디서나 등장하는 **연산자(Operator)**를 카테고리별로 체계적으로 정리한다. 연산자는 단순히 기호를 외우는 것을 넘어, 우선순위와 평가 순서를 이해해야 실제 코드에서 예상치 못한 버그를 피할 수 있다.

## 산술 연산자

가장 기본적인 계산을 담당한다. `+`, `-`, `*`, `/`, `%` 다섯 가지와 증감 연산자 `++`, `--`로 이루어진다.

```java
int a = 17, b = 5;
System.out.println(a + b);  // 22
System.out.println(a - b);  // 12
System.out.println(a * b);  // 85
System.out.println(a / b);  // 3  (정수 나눗셈: 소수점 버림)
System.out.println(a % b);  // 2  (나머지)

// 전위(pre) vs 후위(post) 증감
int x = 10;
System.out.println(++x);  // 11 (먼저 증가, 그 값 반환)
System.out.println(x++);  // 11 (반환 후 증가)
System.out.println(x);    // 12
```

정수끼리 나눌 때 `/`는 소수점을 버린다. 실수 나눗셈이 필요하면 한쪽을 `double`로 캐스팅해야 한다.

```java
double result = (double) 17 / 5;  // 3.4
```

## 비교 연산자

두 값을 비교해 `boolean`을 돌려준다. `==`, `!=`, `>`, `<`, `>=`, `<=` 여섯 가지다.

```java
int score = 85;
System.out.println(score >= 80);  // true
System.out.println(score == 100); // false

String s1 = "hello";
String s2 = new String("hello");
System.out.println(s1 == s2);       // false (참조 비교)
System.out.println(s1.equals(s2));  // true  (값 비교)
```

`==`는 기본형에서는 값을, 참조형에서는 **메모리 주소**를 비교한다. 문자열이나 객체의 내용을 비교할 때는 반드시 `equals()`를 써야 한다.

## 논리 연산자와 단락 평가

`&&`, `||`, `!`, `^`가 있으며, `&&`와 `||`는 **단락 평가(short-circuit evaluation)**를 수행한다.

```java
int divisor = 0;
// divisor != 0 이 false → 오른쪽(10/divisor)은 평가하지 않음 → ArithmeticException 방지
boolean safe = divisor != 0 && 10 / divisor > 2;

// true || ... → 오른쪽은 평가되지 않음
boolean flag = true || someExpensiveMethod();
```

`&`와 `|`는 단락 평가 없이 양쪽을 모두 평가하는 **비단락 연산자**다. 사이드 이펙트가 반드시 필요한 경우가 아니면 `&&`, `||`를 쓰는 것이 일반적이다.

![Java 연산자 분류](/assets/posts/java-operators-categories.svg)

## 비트 연산자와 시프트

비트 수준 조작이 필요할 때 사용한다. 플래그 관리, 해시 계산, 저수준 알고리즘 등에서 등장한다.

```java
int flags = 0b0000_1010;  // 비트 2, 3이 켜진 상태

// 비트 OR로 플래그 추가
flags |= 0b0000_0001;  // 0b0000_1011

// 비트 AND로 특정 비트 확인
boolean bit1Set = (flags & 0b0000_0010) != 0;  // true

// 시프트
int n = 8;
System.out.println(n << 1);  // 16  (×2)
System.out.println(n >> 1);  // 4   (÷2, 부호 유지)
System.out.println(-8 >>> 1); // 양수 (부호 비트 포함해 0으로 채움)
```

`>>` 는 산술 우측 시프트로 부호 비트를 복사하고, `>>>` 는 논리 우측 시프트로 최상위 비트를 항상 0으로 채운다.

## 대입 연산자

`=` 기본 대입과 복합 대입(`+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `|=`, `^=`, `<<=`, `>>=`)이 있다.

```java
int val = 10;
val += 5;   // val = val + 5  → 15
val *= 2;   // val = val * 2  → 30
val >>= 1;  // val = val >> 1 → 15
```

복합 대입 연산자는 내부적으로 **묵시적 캐스팅**이 포함되어 있어 주의가 필요하다.

```java
byte b = 10;
b += 5;  // OK: (byte)(b + 5) — 컴파일러가 자동 처리
// b = b + 5;  // 컴파일 에러: int를 byte에 직접 대입 불가
```

## 삼항 연산자

`condition ? valueIfTrue : valueIfFalse` 형태로 간결한 조건부 값 선택에 쓴다.

```java
int temp = 36;
String status = temp >= 37.5 ? "발열" : "정상";

// 중첩 삼항 (가독성을 위해 switch expression 권장)
int score = 82;
String grade = score >= 90 ? "A"
             : score >= 80 ? "B"
             : score >= 70 ? "C"
             : "F";
// grade = "B"
```

## instanceof 와 패턴 매칭

`instanceof`는 객체의 런타임 타입을 검사한다. Java 16부터 **패턴 매칭 instanceof**가 정식 도입돼 캐스팅 코드를 제거할 수 있다.

```java
Object obj = "Hello, Java";

// 전통적인 방식
if (obj instanceof String) {
    String s = (String) obj;
    System.out.println(s.length());
}

// 패턴 매칭 (Java 16+)
if (obj instanceof String s) {
    System.out.println(s.length());  // 캐스팅 불필요
}
```

## 연산자 우선순위

우선순위가 헷갈릴 때는 **괄호 `()`를 명시적으로 사용**하는 것이 가장 안전하다.

| 높음 | `()` `[]` `.` | 후위 `++` `--` | 전위 `++` `--` `!` `~` |
|------|---------------|----------------|-------------------------|
| ↓ | 산술 `*` `/` `%` | 산술 `+` `-` | 시프트 `<<` `>>` `>>>` |
| ↓ | 비교 `<` `>` `<=` `>=` `instanceof` | 동등 `==` `!=` | 비트 `&` `^` `\|` |
| 낮음 | 논리 `&&` `\|\|` | 삼항 `?:` | 대입 `=` `+=` … |

## 오버플로와 부동소수점 주의

```java
int max = Integer.MAX_VALUE;  // 2_147_483_647
System.out.println(max + 1);  // -2_147_483_648 (오버플로 — 예외 없음!)

// 큰 수 연산은 long 또는 BigInteger 사용
long safe = (long) max + 1;   // 2_147_483_648

// 부동소수점 정밀도 문제
System.out.println(0.1 + 0.2);  // 0.30000000000000004
// 정확한 금융 계산은 BigDecimal 사용
```

![연산자 주요 예제](/assets/posts/java-operators-examples.svg)

Java의 정수 연산은 오버플로가 발생해도 예외를 던지지 않고 조용히 래핑(wrap-around)된다. 큰 수를 다룰 때는 `long`이나 `BigInteger`를 선택해야 한다.

## 정리

Java 연산자의 핵심은 세 가지다. 첫째, `&&`/`||`의 **단락 평가**를 활용하면 null 검사나 나눗셈 가드를 간결하게 쓸 수 있다. 둘째, `==`는 참조형에서 참조를 비교하므로 **내용 비교엔 `equals()`**를 쓴다. 셋째, 정수 **오버플로는 예외 없이 발생**하므로 범위를 의식해야 한다. 우선순위가 불분명하면 괄호로 명확히 하는 습관이 버그를 미연에 방지한다.

---

**지난 글:** [Java 타입 변환(Type Conversion) 완전 정리](/posts/java-type-conversion/)

**다음 글:** [Java 제어 흐름(Control Flow) 완전 정리](/posts/java-control-flow/)

<br>
읽어주셔서 감사합니다. 😊
