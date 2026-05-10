---
title: "Hello, Java World — 첫 번째 Java 프로그램"
description: "Java 개발 환경을 확인하고 Hello World 프로그램을 작성·컴파일·실행하는 전체 흐름을 한 줄씩 상세히 익힌다"
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "Hello World", "javac", "JVM", "main method", "entry point"]
featured: false
draft: false
---

[지난 글](/posts/jvm-class-file-format/)에서 `.class` 파일의 내부 구조를 해부해 바이트코드가 어떻게 담기는지 살펴봤다. 이번에는 드디어 코드를 직접 작성한다. 단 몇 줄로 이루어진 Hello World 프로그램이지만, 그 안에는 클래스 선언, 진입점 메서드, 표준 출력, 컴파일 및 실행 과정이 모두 담겨 있다. 이 글에서는 코드 한 줄씩 정확한 의미를 짚고, 컴파일·실행 흐름과 흔한 오류 상황까지 함께 살펴본다.

## 개발 환경 확인

코드를 작성하기 전에 JDK가 정상적으로 설치되어 있는지 확인한다.

```bash
java -version
javac -version
```

```text
openjdk version "21.0.3" 2024-04-16
javac 21.0.3
```

`java`(런타임)와 `javac`(컴파일러) 모두 응답한다면 준비가 끝난 것이다. JDK 설치 방법은 SDKMAN 편에서 자세히 다뤘으니 참고하면 된다.

## Hello.java 작성

텍스트 에디터로 `Hello.java` 파일을 만들고 다음 코드를 입력한다.

```java
public class Hello {

    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

이게 전부다. Java 21 기준으로 가장 단순한 완전 실행 가능 프로그램이다.

## 코드 한 줄씩 해부

![Hello World 코드 해부](/assets/posts/java-hello-world-anatomy.svg)

### `public class Hello`

`class`는 Java의 기본 단위다. 모든 코드는 클래스 안에 위치한다. `public` 접근 제어자는 이 클래스를 다른 패키지에서도 참조할 수 있음을 의미한다.

**중요한 규칙**: 파일 내에 `public` 클래스가 있다면 **파일명과 클래스명이 반드시 일치**해야 한다. 클래스 이름이 `Hello`이면 파일 이름은 반드시 `Hello.java`여야 하며, 대소문자도 구분한다.

```java
// 파일명: Hello.java → OK
public class Hello { }

// 파일명: hello.java → 컴파일 오류
public class Hello { }
```

### `public static void main(String[] args)`

이것은 Java 프로그램의 **진입점(entry point)** 이다. JVM이 프로그램을 시작할 때 이 시그니처를 정확히 찾아 호출한다.

각 키워드의 의미:

| 키워드 | 의미 |
|--------|------|
| `public` | JVM(외부)에서 호출 가능 |
| `static` | 인스턴스 생성 없이 클래스 수준에서 호출 |
| `void` | 반환값 없음 |
| `main` | JVM이 약속된 진입점 이름 |
| `String[] args` | 커맨드라인 인수를 문자열 배열로 수신 |

이 시그니처가 조금이라도 다르면 JVM은 진입점을 찾지 못하고 오류를 낸다. `static`을 빠뜨리거나 `String[]` 대신 `int[]`를 쓰면 런타임에 `NoSuchMethodError`가 발생한다.

### `System.out.println("Hello, World!")`

표준 출력에 문자열을 한 줄 출력하고 개행을 추가한다.

- `System`: `java.lang` 패키지의 클래스. `java.lang`은 자동으로 import되므로 별도 선언이 필요 없다.
- `out`: `System` 클래스의 `static` 필드. 타입은 `java.io.PrintStream`이다.
- `println(String x)`: `PrintStream`의 메서드. 인수를 출력하고 `\n`을 추가한다.

`println`과 `print`의 차이:

```java
System.out.println("A"); // A + 개행
System.out.print("B");   // B (개행 없음)
System.out.printf("x=%d%n", 42); // 형식 문자열
```

## 컴파일

`javac` 명령으로 소스 파일을 바이트코드로 변환한다.

```bash
javac Hello.java
```

성공하면 아무 출력 없이 `Hello.class` 파일이 생성된다. `-v` 옵션을 추가하면 컴파일 과정 상세 정보를 볼 수 있다.

```bash
ls -lh Hello.class
# -rw-r--r--  1 user  staff   417B  May 11 09:00 Hello.class
```

400여 바이트의 바이너리 파일이다. 이 파일이 지난 글에서 해부한 `.class` 포맷을 따른다.

## 실행

`java` 명령에 클래스 이름을 넘겨 실행한다. `.class` 확장자는 쓰지 않는다.

```bash
java Hello
# Hello, World!
```

JVM은 다음 순서로 동작한다.

1. `Hello.class`를 클래스 로더로 메모리에 로드
2. 바이트코드 검증 (링킹)
3. `Hello.main(String[])` 탐색 후 호출
4. 바이트코드를 인터프리터/JIT로 실행
5. 프로세스 종료

![Java 프로그램 실행 흐름](/assets/posts/java-hello-world-pipeline.svg)

## Java 11+ 단일 파일 실행

Java 11부터는 단일 소스 파일을 `javac` 없이 바로 실행할 수 있다.

```bash
java Hello.java
# Hello, World!
```

내부적으로 컴파일 후 실행하지만 `.class` 파일은 디스크에 남기지 않는다. 빠른 스크립트 실행이나 학습 목적으로 유용하다. 단, 여러 파일에 걸친 프로젝트에는 사용할 수 없다.

## 커맨드라인 인수 사용

`main`의 `args` 배열을 통해 실행 시 인수를 받을 수 있다.

```java
public class Hello {

    public static void main(String[] args) {
        String name = args.length > 0 ? args[0] : "World";
        System.out.println("Hello, " + name + "!");
    }
}
```

```bash
javac Hello.java
java Hello Korea
# Hello, Korea!
```

`args[0]`부터 인수가 채워지며, 인수가 없으면 배열 길이가 0이다. 배열 범위를 확인하지 않고 접근하면 `ArrayIndexOutOfBoundsException`이 발생하므로 위 예제처럼 길이 확인을 먼저 한다.

## 자주 겪는 오류

### `error: class Hello is public, should be in a file named Hello.java`

파일명과 public 클래스명이 다를 때 발생한다. 파일명을 맞춰야 한다.

### `UnsupportedClassVersionError`

```text
Error: LinkageError occurred while loading main class Hello
  java.lang.UnsupportedClassVersionError: Hello has been compiled by a more
  recent version of the Java Runtime (class file version 65.0)
```

Java 21로 컴파일된 `.class`를 Java 11 JVM으로 실행하면 이 오류가 난다. `java -version`으로 런타임 버전을 확인하고, 컴파일 버전과 일치시킨다.

### `NoSuchMethodError: main`

```text
Error: Main method not found in class Hello
```

`main` 시그니처가 정확하지 않다. `static`이 빠져 있거나 매개변수 타입이 틀렸는지 확인한다.

### `ClassNotFoundException`

```bash
java hello   # 소문자
# Error: Could not find or load main class hello
```

클래스 이름은 대소문자를 구분한다. `java Hello`처럼 정확히 입력해야 한다.

## 패키지를 사용하는 경우

실제 프로젝트에서는 클래스를 패키지로 구성한다.

```java
package com.example;

public class Hello {

    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

이 경우 디렉터리 구조와 패키지 선언이 일치해야 한다.

```bash
mkdir -p com/example
# Hello.java를 com/example/ 에 저장

javac com/example/Hello.java
java com.example.Hello    # 패키지 포함 전체 이름
# Hello, World!
```

클래스 이름 대신 패키지명까지 포함한 **완전 한정 이름(fully qualified name)** 으로 실행한다.

## 정리

Hello World 프로그램은 단순해 보이지만 Java의 핵심 규칙이 압축되어 있다. 파일명과 클래스명의 일치, `main` 진입점의 고정 시그니처, `java.lang` 자동 import, 컴파일-실행 이분 구조가 모두 이 다섯 줄 안에 들어 있다. 다음 글에서는 변수와 리터럴을 다루며 Java의 타입 시스템에 본격적으로 발을 들인다.

---

**지난 글:** [JVM Class File 포맷 완전 해부](/posts/jvm-class-file-format/)

**다음 글:** [Java 변수와 리터럴 완전 정리](/posts/java-variables-and-literals/)

<br>
읽어주셔서 감사합니다. 😊
