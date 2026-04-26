---
title: "Java란 무엇인가"
description: "Java의 정의, 핵심 철학 'Write Once, Run Anywhere', JVM 기반 실행 원리, 그리고 왜 지금도 Java를 배워야 하는지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["java", "jvm", "wora", "intro"]
featured: false
draft: false
---

## Java를 처음 만나는 순간

많은 개발자의 첫 프로그래밍 언어가 Java였습니다. 대학 강의실, 취업 준비, 사이드 프로젝트—어디서든 "Java 할 줄 아세요?"라는 질문을 들을 수 있었죠. 그런데 막상 "Java가 뭐예요?"라고 물으면 막히는 분들이 많습니다. 단순히 "프로그래밍 언어"라고 답하면 절반만 맞습니다. Java는 **언어이자 플랫폼**이기 때문입니다.

이 시리즈 'Java 완전 정복'의 첫 글로, Java의 정체를 제대로 짚어 봅니다.

---

## Java의 공식 정의

Sun Microsystems(현 Oracle)는 Java를 다음과 같이 정의했습니다.

> **Java is a simple, object-oriented, distributed, interpreted, robust, secure, architecture neutral, portable, high-performance, multithreaded, and dynamic language.**

한 문장에 11개의 형용사가 들어가 있습니다. 하나씩 뜯어보면 Java 설계 철학이 모두 담겨 있습니다. 하지만 가장 중요한 한 가지를 뽑는다면 **"Architecture Neutral + Portable"**, 즉 **Write Once, Run Anywhere(WORA)** 입니다.

---

## Write Once, Run Anywhere

전통적인 C/C++ 프로그램은 특정 OS와 CPU 아키텍처를 위해 컴파일됩니다. Windows x64용 바이너리는 Linux ARM에서 실행되지 않습니다. 1990년대 인터넷이 폭발적으로 성장하던 시기, Sun은 고민했습니다. *네트워크 어디서든 실행 가능한 코드를 어떻게 만들지?*

해답은 **중간 표현(Intermediate Representation)** 이었습니다.

![Java 플랫폼 개요](/assets/posts/java-what-is-java-overview.svg)

Java 소스 코드(`.java`)는 `javac` 컴파일러로 **바이트코드(bytecode, `.class`)** 로 변환됩니다. 바이트코드는 특정 CPU 명령어가 아니라 **가상 CPU(JVM)를 위한 명령어 집합**입니다. 그리고 JVM은 Windows, Linux, macOS, Solaris 등 다양한 플랫폼 위에서 동작합니다. 결국 개발자는 소스 코드를 한 번만 작성하면 되고, 각 플랫폼의 JVM이 바이트코드를 해당 환경에 맞는 기계어로 번역해 실행합니다.

```text
Hello.java  ──javac──▶  Hello.class  ──JVM──▶  실행
  (소스)                  (바이트코드)            (OS별)
```

---

## Java는 언어인가 플랫폼인가

둘 다입니다. 정확히는 세 가지 층위를 구분해야 합니다.

| 층위 | 구성 요소 | 역할 |
|------|-----------|------|
| **Java 언어** | 문법, 키워드, 타입 시스템 | 개발자가 코드를 작성하는 언어 규칙 |
| **JVM** | 실행 엔진, JIT 컴파일러, GC | 바이트코드를 해석·실행하는 런타임 |
| **Java 플랫폼** | JDK + JRE + 표준 라이브러리 | 개발·배포 전체 생태계 |

JVM은 Java 언어 전용이 아닙니다. **Kotlin, Scala, Groovy, Clojure**도 JVM 위에서 실행됩니다. 이들은 각자의 컴파일러로 바이트코드를 생성하고, 그 바이트코드를 JVM이 실행합니다. Java 언어와 JVM은 별개의 표준으로 관리됩니다.

---

## Hello World로 보는 Java 구조

![Hello World 프로그램 구조](/assets/posts/java-what-is-java-hello.svg)

```java
// Hello.java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

가장 단순한 Hello World에도 Java의 핵심 요소가 담겨 있습니다.

- `public class Hello` — 모든 Java 코드는 클래스 안에 존재합니다. 파일명(`Hello.java`)은 public 클래스 이름과 동일해야 합니다.
- `public static void main(String[] args)` — JVM이 프로그램을 시작할 때 찾는 **진입점(entry point)** 입니다. 이 시그니처가 정확해야 실행됩니다.
- `System.out.println(...)` — 표준 출력(stdout)으로 텍스트를 출력합니다. `System`은 `java.lang` 패키지의 클래스이고, 자동으로 임포트됩니다.

컴파일과 실행은 터미널에서 두 명령어면 충분합니다.

```bash
javac Hello.java   # Hello.class 생성
java Hello         # JVM이 main() 호출
```

---

## Java의 주요 특성

### 객체지향(Object-Oriented)
Java는 **거의 모든 것이 객체**입니다. 메서드는 클래스 안에 있어야 하고, 상태는 필드로 관리됩니다. 원시 타입(`int`, `boolean` 등) 8가지만 예외입니다. 클래스, 상속, 다형성, 캡슐화 등 OOP 4대 원칙을 언어 수준에서 지원합니다.

### 강한 타입(Strongly Typed)
컴파일 시점에 타입을 검사합니다. `String name = 42;`는 컴파일 오류입니다. 이는 런타임 버그를 줄이고 IDE 자동완성·리팩토링을 가능하게 합니다. Java 10부터는 `var`로 타입 추론도 지원합니다.

```java
// Java 10 LTS부터 사용 가능
var message = "Hello";   // 컴파일러가 String으로 추론
var count = 42;          // int로 추론
```

### 자동 메모리 관리(Garbage Collection)
C/C++에서는 개발자가 직접 `malloc`/`free`로 메모리를 관리해야 합니다. Java는 **GC(Garbage Collector)** 가 사용하지 않는 객체를 자동으로 회수합니다. 메모리 누수와 댕글링 포인터 버그를 원천적으로 방지합니다. 다만 GC 동작을 이해하지 못하면 성능 문제를 디버깅하기 어렵기 때문에 이 시리즈의 Part XX에서 깊게 다룹니다.

### 멀티스레드(Multithreaded)
Java는 언어 수준에서 스레드를 지원합니다. `Thread` 클래스와 `Runnable` 인터페이스로 동시성 프로그래밍을 할 수 있고, `synchronized`, `volatile`, `java.util.concurrent` 패키지가 스레드 안전성을 보장합니다. Java 21 LTS부터는 **Virtual Threads**로 경량 동시성이 더욱 쉬워졌습니다.

### 풍부한 표준 라이브러리
Java는 "배터리 포함(batteries included)" 철학을 가집니다. 컬렉션(`java.util`), I/O(`java.io`, `java.nio`), 네트워킹(`java.net`), 암호화(`javax.crypto`), 날짜/시간(`java.time`) 등 광범위한 표준 라이브러리가 JDK에 포함되어 있습니다.

---

## Java의 에디션

Java는 용도에 따라 세 가지 에디션으로 나뉩니다.

| 에디션 | 풀네임 | 주요 사용처 |
|--------|--------|------------|
| **Java SE** | Standard Edition | 일반 애플리케이션, 라이브러리 |
| **Jakarta EE** | Enterprise Edition (구 Java EE) | 엔터프라이즈 서버 애플리케이션 |
| **Java ME** | Micro Edition | 임베디드·IoT 기기 |

이 시리즈는 **Java SE**를 중심으로 다루고, Jakarta EE 관련 내용은 필요시 언급합니다. 에디션별 차이는 다음 글 'Part I — 3편: SE · EE · ME · Jakarta EE'에서 자세히 설명합니다.

---

## 왜 지금도 Java인가

Java는 1995년 탄생 이후 30년이 지난 지금도 **TIOBE 인덱스 최상위**를 유지합니다. 그 이유는 단순히 역사가 오래됐기 때문이 아닙니다.

1. **안정적인 LTS 릴리스** — Java 8, 11, 17, 21이 장기 지원 버전으로 엔터프라이즈 환경에서 검증됐습니다.
2. **Spring 생태계** — Spring Boot를 중심으로 한 웹 개발 생태계가 세계 최대 규모입니다.
3. **클라우드 네이티브** — GraalVM Native Image, Virtual Threads, CRaC(Checkpoint/Restore) 등으로 컨테이너 시대에 맞게 진화 중입니다.
4. **JVM 언어의 허브** — Kotlin(Android), Scala(빅데이터), Groovy(Gradle)와의 상호운용성으로 JVM 생태계 전체를 활용할 수 있습니다.

```java
// 2024년 기준 Spring Boot 3.x + Java 21 LTS 구조 예시
@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

---

## 이 시리즈에서 다루는 것

'Java 완전 정복'은 302편 분량으로 Java의 역사부터 최신 LTS(Java 21)까지, 언어 문법부터 JVM 내부, GC 튜닝, 모듈 시스템, 테스트, 보안, 마이그레이션까지 종합적으로 다룹니다.

각 주제는 **JDK 8 / 11 / 17 / 21 LTS 기준**으로 설명하고, 신기능에는 도입 버전을 명시합니다. 예제 코드는 가능하면 Java 8 호환을 우선하고, 최신 기능 설명 시에는 버전을 표기합니다.

---

**다음 글:** Java 역사 (1995 ~ 21+) — Oak에서 Virtual Threads까지

<br>
읽어주셔서 감사합니다. 😊
