---
title: "Java 변수와 리터럴 완전 정리"
description: "Java 변수 선언 구조, 네 가지 변수 종류, 여섯 가지 리터럴 형태를 코드와 함께 깊이 있게 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "변수", "리터럴", "지역변수", "인스턴스필드", "정적필드", "primitive", "타입 시스템"]
featured: false
draft: false
---

[지난 글](/posts/java-hello-world/)에서 Hello World 프로그램을 작성하고 컴파일·실행 흐름까지 살펴봤다. 이번에는 Java 코드의 가장 기본 재료인 **변수(variable)** 와 **리터럴(literal)** 을 다룬다. "변수 선언은 다 알고 있다"고 생각하기 쉽지만, 지역 변수와 인스턴스 필드의 초기화 규칙이 어떻게 다른지, `0xFF`나 `1_000L` 같은 리터럴 표기법이 내부에서 어떻게 해석되는지를 정확히 알아야 컴파일 오류와 런타임 버그를 예방할 수 있다.

## 변수란 무엇인가

변수는 **이름이 붙은 메모리 공간**이다. Java 프로그램이 실행될 때 JVM은 이 공간에 값을 저장하고, 코드에서는 이름(식별자)을 통해 그 값을 읽거나 갱신한다.

```java
int count = 42;        // 선언 + 초기화
count = count + 1;     // 값 갱신 (43)
```

변수 선언은 네 가지 요소로 구성된다.

![Java 변수 선언 구조](/assets/posts/java-variables-and-literals-anatomy.svg)

| 구성 요소 | 역할 | 예시 |
|---|---|---|
| **타입** | 저장할 값의 종류와 크기 결정 | `int`, `String` |
| **한정자** (선택) | `final`, `static` 등 속성 제한 | `final` |
| **변수명** | 값을 참조하는 lowerCamelCase 식별자 | `count` |
| **초기값** (선택) | `=` 뒤의 리터럴·식·객체 | `42` |

## 네 가지 변수 종류

### 지역 변수 (Local Variable)

메서드 또는 블록 내부에서 선언하며, **스택 프레임**에 저장된다.

```java
void process() {
    int result = 0;          // 지역 변수 선언 + 초기화
    for (int i = 0; i < 10; i++) {
        result += i;
    }
    System.out.println(result);
}
```

지역 변수는 자동으로 초기화되지 않는다. 초기화하지 않고 읽으면 **컴파일 오류**가 발생한다.

```java
void broken() {
    int x;
    System.out.println(x); // 컴파일 오류: variable x might not have been initialized
}
```

### 인스턴스 필드 (Instance Field)

클래스 내부, 메서드 외부에 선언하며 객체마다 독립적인 공간을 갖는다. **힙(Heap)** 에 저장되고, 선언 시 기본값으로 자동 초기화된다.

```java
public class Counter {
    int count;          // 기본값 0 으로 자동 초기화
    String label;       // 기본값 null 로 자동 초기화
    boolean active;     // 기본값 false 로 자동 초기화
}
```

### 정적 필드 (Static Field)

`static` 키워드로 선언하며 클래스당 하나의 공간만 존재한다. **메서드 영역(Method Area)** 에 저장되고 모든 인스턴스가 공유한다.

```java
public class Config {
    static int instanceCount = 0;   // 클래스당 하나
    static final String VERSION = "1.0.0"; // 상수 관례

    Config() {
        instanceCount++;
    }
}
```

`static final` 조합은 Java에서 상수를 표현하는 관용적 방법이며, 이름을 `UPPER_SNAKE_CASE`로 짓는 것이 관례다.

### 매개변수 (Parameter)

메서드 시그니처에 선언하며, 호출 시 전달된 값이 복사된다.

```java
void greet(String name, int repeat) {
    for (int i = 0; i < repeat; i++) {
        System.out.println("Hello, " + name);
    }
}
```

기본형(primitive) 매개변수는 **값이 복사**되므로 메서드 내부에서 변경해도 호출자 변수에 영향을 주지 않는다. 참조형(reference)은 **참조가 복사**되어 객체 상태는 변경 가능하지만, 참조 자체를 바꿔도 호출자에게 반영되지 않는다.

## `var` — 타입 추론 (Java 10+)

Java 10부터 **`var`** 키워드를 사용하면 컴파일러가 오른쪽 초기값에서 타입을 추론한다.

```java
var count  = 42;           // int
var name   = "Alice";      // String
var list   = new ArrayList<String>(); // ArrayList<String>
var reader = new BufferedReader(
                 new InputStreamReader(System.in));
```

`var`는 지역 변수에만 허용된다. 필드, 매개변수, 반환 타입에는 사용할 수 없다. 초기값 없이 `var` 선언도 불가하다.

## 리터럴(Literal) 완전 정리

리터럴은 **소스 코드에 직접 쓴 고정 값**이다. 컴파일러가 리터럴을 읽어 그에 맞는 타입의 값으로 변환한다.

![Java 리터럴 종류](/assets/posts/java-variables-and-literals-literals.svg)

### 정수형 리터럴

```java
int  dec  = 42;          // 10진수 (기본)
int  hex  = 0xFF;        // 16진수 (0x/0X 접두사)
int  bin  = 0b1010_1010; // 2진수 (0b/0B 접두사, JDK 7+)
int  oct  = 0755;        // 8진수 (0 접두사)
long big  = 9_000_000_000L; // long 접미사 L (구분자 _ JDK 7+)
```

접미사 없는 정수 리터럴의 기본 타입은 `int`다. `long` 범위의 값은 반드시 `L`을 붙여야 한다. 소문자 `l`도 허용되지만 숫자 `1`과 구분이 어려워 **대문자 `L` 사용이 관례**다.

### 부동소수점 리터럴

```java
double pi    = 3.14;       // double (기본)
double e     = 2.718d;     // double (명시, d/D 생략 가능)
float  ratio = 1.618f;     // float  (f/F 반드시 필요)
double nano  = 1.0e-9;     // 과학적 표기법
```

소수점을 포함한 리터럴의 기본 타입은 `double`이다. `float`에 소수점 리터럴을 대입할 때 `f`를 빠뜨리면 **"가능한 손실 변환(possible lossy conversion)"** 컴파일 오류가 발생한다.

### 문자 리터럴

```java
char a = 'A';        // 단일 문자
char nl = '\n';      // 이스케이프 시퀀스
char uni = 'A'; // 유니코드 이스케이프 (= 'A')
```

`char`는 16비트 부호 없는 정수(`0` ~ `65535`)로, UTF-16 코드 단위를 저장한다.

### 문자열 리터럴

```java
String hello = "Hello, World!";
String empty = "";
String tab   = "col1\tcol2";
```

문자열 리터럴은 **String Pool**에 저장된다. 동일한 리터럴을 여러 번 써도 JVM은 풀에서 같은 객체를 재사용한다.

```java
String a = "java";
String b = "java";
System.out.println(a == b);      // true  (같은 풀 객체)
System.out.println(a == new String("java")); // false (힙 새 객체)
```

`==`는 참조를 비교하므로 문자열 내용 비교에는 반드시 `equals()`를 사용해야 한다.

### 논리형 리터럴

```java
boolean flag = true;
boolean done = false;
```

`true`와 `false`는 Java 예약어로, 대·소문자를 구분한다. `1`이나 `0`은 `boolean`에 대입할 수 없다.

### null 리터럴

```java
String s = null;  // 참조가 없는 상태
Object o = null;
```

`null`은 참조형 변수에만 대입 가능하며 기본형에는 사용할 수 없다. `null` 참조에 메서드를 호출하면 런타임에 `NullPointerException`이 발생하므로 방어적으로 다뤄야 한다.

## 변수 명명 규칙 정리

| 대상 | 규칙 | 예시 |
|---|---|---|
| 지역 변수·필드·매개변수 | lowerCamelCase | `userName`, `totalCount` |
| 상수 (`static final`) | UPPER_SNAKE_CASE | `MAX_SIZE`, `DEFAULT_TIMEOUT` |
| 클래스·인터페이스 | UpperCamelCase | `MyService`, `Runnable` |
| 패키지 | 소문자, `.` 구분 | `com.example.util` |

식별자에는 유니코드 문자도 허용되지만, ASCII 알파벳·숫자·`_`·`$`만 사용하는 것이 현업 관례다. `$`는 자동 생성 코드(람다·익명 클래스 등)에서 JVM이 사용하므로 직접 쓰지 않는 것이 좋다.

## 정리

변수는 Java 타입 시스템의 출발점이다. 지역·인스턴스·정적·매개변수라는 네 종류의 차이(초기화 방식, 저장 위치, 생명 주기)를 명확히 이해해야 메모리 관련 문제를 예방할 수 있다. 리터럴 표기법도 접두사·접미사·구분자를 정확히 써야 의도한 타입의 값이 만들어진다. 다음 글에서는 변수에 담기는 **기본형(primitive type)** 여덟 가지를 크기·범위·기본값 관점에서 낱낱이 살펴본다.

---

**지난 글:** [Hello, Java World — 첫 번째 Java 프로그램](/posts/java-hello-world/)

**다음 글:** [Java 기본형(Primitive Types) 완전 정리](/posts/java-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
