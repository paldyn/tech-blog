---
title: "Java 메서드 오버로딩 완전 정복 — 같은 이름, 다른 시그니처"
description: "Java 메서드 오버로딩의 원리부터 컴파일러 오버로드 해소 3단계, varargs 우선순위, 오토박싱·제네릭과의 상호작용까지 실전 예제로 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "메서드 오버로딩", "오버로드 해소", "varargs", "오토박싱", "정적 디스패치", "시그니처"]
featured: false
draft: false
---

[지난 글](/posts/java-this-keyword/)에서 `this` 키워드가 현재 인스턴스를 참조하는 원리를 살펴봤다. 이번에는 클래스 설계에서 자주 만나는 메서드 오버로딩(Method Overloading)을 파헤친다. 오버로딩은 단순히 이름을 재사용하는 편의 기능이 아니라, 컴파일러가 수행하는 **정적 디스패치(Static Dispatch)** 의 산물이다.

## 오버로딩이란

오버로딩은 **같은 클래스 안에서 이름이 동일한 메서드를 여러 개 정의하되, 매개변수 목록(개수·타입·순서)을 달리하는 것**이다. 반환 타입은 구분 기준이 아니다.

```java
class Printer {
    void print(int n)    { System.out.println("int: " + n); }
    void print(double d) { System.out.println("double: " + d); }
    void print(String s) { System.out.println("String: " + s); }
}
```

호출 시 컴파일러는 전달된 인수의 타입을 분석해 세 메서드 중 하나를 **컴파일 타임에** 확정한다. 런타임에 동적으로 결정하는 오버라이딩(Overriding)과 근본적으로 다르다.

![메서드 오버로딩 개념도](/assets/posts/java-method-overloading-concept.svg)

## 시그니처와 오버로딩 판단 기준

JVM 명세에서 메서드 **시그니처(Method Signature)** 는 메서드 이름과 매개변수 타입 목록의 조합이다. 반환 타입은 시그니처에 포함되지 않는다.

| 메서드 선언 | 시그니처 | 오버로드 가능? |
|---|---|---|
| `int add(int a, int b)` | `add(int, int)` | 기준 |
| `double add(double a, double b)` | `add(double, double)` | ✓ 타입 다름 |
| `int add(int a, int b, int c)` | `add(int, int, int)` | ✓ 개수 다름 |
| `long add(int a, int b)` | `add(int, int)` | ✗ 반환 타입만 다름 |

반환 타입만 다른 경우 컴파일러가 `add(1, 2)` 호출 시 `int add`와 `long add` 중 어느 것을 써야 할지 결정할 수 없어 컴파일 오류가 발생한다.

## 오버로드 해소 3단계

컴파일러는 오버로드된 메서드들 사이에서 가장 적합한 후보를 고를 때 세 단계를 순서대로 시도한다.

![오버로드 해소 3단계](/assets/posts/java-method-overloading-resolution.svg)

### 1단계 — 정확 일치

인수 타입이 매개변수 타입과 완전히 일치하는 메서드가 있으면 즉시 선택한다.

```java
void show(int n)  { System.out.println("int"); }
void show(long n) { System.out.println("long"); }

show(42);   // int 리터럴 → show(int) 선택 (1단계)
show(42L);  // long 리터럴 → show(long) 선택 (1단계)
```

### 2단계 — 확대 변환(Widening)

정확 일치가 없을 때, 손실 없는 자동 확대 변환을 적용해 일치하는 메서드를 찾는다. Java 확대 변환 순서는 다음과 같다.

```
byte → short → int → long → float → double
char → int
```

```java
byte b = 10;
show(b); // byte 정확 일치 없음 → byte→int 확대 → show(int) 선택
```

**주의**: `int`와 `long` 두 후보가 모두 확대 변환 대상이 되면 컴파일러는 더 구체적인(가장 좁은) 타입인 `int` 메서드를 선택한다.

### 3단계 — 가변 인수(Varargs)

앞 두 단계에서 후보를 찾지 못한 경우에만 `...` 매개변수를 가진 메서드를 검토한다. Varargs는 항상 마지막 순위다.

```java
void sum(int a, int b)   { System.out.println("two"); }
void sum(int... nums)    { System.out.println("varargs"); }

sum(1, 2);    // 1단계에서 sum(int, int) 선택 — varargs 호출 안 됨
sum(1, 2, 3); // sum(int, int)는 인수 3개 불일치 → 3단계 sum(int...) 선택
```

## 오토박싱과 오버로딩의 함정

Java 5부터 추가된 오토박싱(Autoboxing)은 오버로드 해소 우선순위에서 **확대 변환보다 낮다**.

```java
void process(int n)     { System.out.println("int"); }
void process(Integer n) { System.out.println("Integer"); }

int x = 5;
process(x); // → process(int): 정확 일치 (오토박싱 불필요)

Integer y = 5;
process(y); // → process(Integer): 정확 일치
```

`int`에서 `long`으로의 확대 변환이 `int`에서 `Integer`로의 오토박싱보다 우선 적용된다. 이 때문에 다음과 같은 상황이 직관과 다를 수 있다.

```java
void check(long n)    { System.out.println("long"); }
void check(Integer n) { System.out.println("Integer"); }

int x = 5;
check(x); // → check(long): int→long 확대가 int→Integer 박싱보다 우선
```

## 제네릭과 오버로딩 제한

타입 소거(Type Erasure) 때문에 제네릭 타입만 다른 오버로드는 컴파일 오류다.

```java
// 컴파일 오류: 소거 후 둘 다 List가 되어 시그니처 충돌
void process(List<String> list) { }
void process(List<Integer> list) { }
```

타입 소거 후 두 메서드의 시그니처가 `process(List)` 로 동일해진다. 이 경우 메서드 이름을 구분하거나, 반환 타입을 다르게 하는 방식도 소용없다.

## 생성자 오버로딩

오버로딩은 생성자에도 그대로 적용된다. `this()` 위임을 통해 중복을 최소화하는 패턴이 실전에서 자주 쓰인다.

```java
class Connection {
    private final String host;
    private final int port;
    private final int timeout;

    Connection(String host) {
        this(host, 3306);
    }

    Connection(String host, int port) {
        this(host, port, 30);
    }

    Connection(String host, int port, int timeout) {
        this.host    = host;
        this.port    = port;
        this.timeout = timeout;
    }
}
```

가장 많은 매개변수를 받는 생성자에 실제 초기화 로직을 몰아넣고, 나머지는 `this()`로 위임하면 유지보수 포인트가 하나로 줄어든다.

## 실전 팁

**오버로딩을 피해야 하는 경우**: 인수가 `null`일 때 어느 오버로드가 선택될지 모호해질 수 있다.

```java
void handle(String s)  { System.out.println("String"); }
void handle(Object o)  { System.out.println("Object"); }

handle(null); // → handle(String): 더 구체적인 타입 선택
```

`handle(null)` 은 `String`이 `Object`의 하위 타입이므로 컴파일러가 `handle(String)`을 선택한다. 하지만 `String`과 `Integer` 두 후보가 있다면 둘 다 `Object`의 하위 타입이고 서로 상하관계가 없으므로 **컴파일 오류**가 된다.

**가독성 우선**: 오버로딩은 API 사용자 입장에서 자연스러운 다형성을 제공하지만, 과용하면 코드 리뷰 시 어느 메서드가 호출되는지 추적하기 어렵다. IDE의 "Go to Definition"을 항상 신뢰할 수 없는 환경(예: 동적 리플렉션)에서는 명시적인 이름 구분이 낫다.

---

**지난 글:** [Java this 키워드 완전 정복 — 인스턴스 자기 참조](/posts/java-this-keyword/)

**다음 글:** [Java static 멤버 완전 정복 — 클래스 레벨 필드와 메서드](/posts/java-static-members/)

<br>
읽어주셔서 감사합니다. 😊
