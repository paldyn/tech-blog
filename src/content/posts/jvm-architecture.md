---
title: "JVM 아키텍처 완전 해부"
description: "클래스 로더 서브시스템, 런타임 데이터 영역, 실행 엔진까지 JVM 내부 구조를 시각적으로 이해하고 Java 프로그램이 실행되는 원리를 낱낱이 파헤칩니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "JVM 아키텍처", "런타임 데이터 영역", "실행 엔진", "스택 프레임", "클래스 로더"]
featured: false
draft: false
---

[지난 글](/posts/java-jshell/)에서 JShell로 코드를 즉시 실행하는 방법을 살펴봤습니다. 이번에는 한 단계 더 깊이 들어가, **우리가 작성한 Java 코드가 JVM 내부에서 어떻게 처리되는지** 그 구조를 해부합니다. JVM은 단순한 런타임이 아니라 세 가지 핵심 서브시스템이 유기적으로 맞물려 돌아가는 정교한 소프트웨어입니다.

## JVM이란 무엇인가

JVM(Java Virtual Machine)은 `.class` 바이트코드를 받아 실제 OS 위에서 실행시키는 가상 머신입니다. "Write Once, Run Anywhere"의 핵심 비결이 바로 JVM에 있습니다. JVM 명세(specification)는 표준을 정의하고, 실제 구현체(HotSpot, OpenJ9, GraalVM 등)는 그 명세를 따라 각자의 방식으로 최적화합니다.

JVM의 내부는 크게 세 서브시스템으로 나뉩니다.

![JVM 아키텍처 전체 구조](/assets/posts/jvm-architecture-overview.svg)

## 1. 클래스 로더 서브시스템

JVM이 가장 먼저 하는 일은 `.class` 파일을 메모리로 읽어들이는 것입니다. 클래스 로더 서브시스템은 이 과정을 세 단계로 처리합니다.

### 로딩(Loading)

파일 시스템, JAR, 네트워크 등에서 `.class` 파일의 바이트 스트림을 읽어 `java.lang.Class` 객체를 생성합니다. 클래스 로더는 계층 구조(Bootstrap → Platform → Application)로 이루어져 있어 같은 클래스가 중복 로드되지 않도록 위임 방식으로 동작합니다.

### 링킹(Linking)

링킹은 다시 세 단계로 나뉩니다.

- **Verification**: 바이트코드가 JVM 명세에 맞는지 검증합니다. 잘못된 바이트코드는 여기서 `VerifyError`로 차단됩니다.
- **Preparation**: static 필드에 기본값(0, null, false)을 할당합니다.
- **Resolution**: 심볼릭 참조(클래스명 문자열)를 실제 메모리 참조로 교체합니다.

### 초기화(Initialization)

`static` 블록과 `static` 필드 초기화 코드가 실행됩니다. 클래스가 처음 실제로 사용될 때 단 한 번만 실행됩니다.

```java
class Config {
    // Initialization 단계에서 실행
    static final int MAX_SIZE;
    static {
        MAX_SIZE = Integer.parseInt(System.getenv()
            .getOrDefault("MAX_SIZE", "100"));
        System.out.println("Config initialized");
    }
}
```

## 2. 런타임 데이터 영역

클래스가 로드되면 JVM은 여러 메모리 공간을 나눠 데이터를 관리합니다.

### 공유 영역 (모든 스레드가 접근)

**Method Area**는 클래스별 메타데이터(필드, 메서드 정보, 바이트코드, static 변수)를 저장합니다. Java 8부터 Permgen이 제거되고 **Metaspace**(네이티브 메모리)로 대체되었습니다.

**Heap**은 `new`로 생성된 모든 객체와 배열이 저장되는 공간입니다. GC가 관리하는 핵심 영역이며, Young Generation과 Old Generation으로 나뉩니다.

### 스레드 전용 영역

**Java Stack**은 각 스레드마다 독립적으로 존재하며, 메서드 호출마다 **Stack Frame** 하나씩 쌓입니다. 메서드가 반환되면 해당 Frame은 즉시 제거됩니다.

**PC Register**(Program Counter)는 현재 실행 중인 바이트코드 명령의 주소를 가집니다. 스레드가 인터리빙될 때 각자의 위치를 기억하기 위해 스레드별로 존재합니다.

**Native Method Stack**은 JNI(Java Native Interface)를 통해 C/C++ 등 네이티브 코드를 호출할 때 사용됩니다.

### Stack Frame 구조

![Java Stack과 스택 프레임 구조](/assets/posts/jvm-architecture-stack-frame.svg)

Stack Frame은 세 부분으로 구성됩니다.

| 구성 요소 | 역할 |
|---|---|
| Local Variable Array | `this`, 파라미터, 지역변수를 인덱스로 저장 |
| Operand Stack | 연산의 중간 값을 임시 저장 (계산기 스택) |
| Frame Data | 반환 주소, 예외 테이블, Constant Pool 참조 |

```java
// 이 메서드가 호출되면 Stack Frame 1개가 생성됨
int add(int a, int b) {
    // Local Variable Array: [0]=this, [1]=a, [2]=b
    // Operand Stack: iload_1, iload_2, iadd 순서로 수행
    return a + b;
}
```

## 3. 실행 엔진

실행 엔진은 바이트코드를 실제 CPU 명령으로 변환해 실행합니다.

### 인터프리터

바이트코드를 한 줄씩 해석해 실행합니다. JVM 시작 직후부터 즉시 동작하지만 반복 실행 시 성능 오버헤드가 있습니다.

### JIT 컴파일러

자주 실행되는 **핫스팟(Hotspot)** 코드를 감지해 기계어로 컴파일합니다. 컴파일된 코드는 **Code Cache**에 저장되어 이후 호출 시 인터프리터를 거치지 않고 직접 실행됩니다. HotSpot JVM은 C1(클라이언트)과 C2(서버) 컴파일러를 계층적으로 활용하는 **Tiered Compilation**을 사용합니다.

### 가비지 컬렉터

Heap의 더 이상 참조되지 않는 객체를 자동으로 회수합니다. G1, ZGC, Shenandoah 등 다양한 GC 알고리즘이 존재하며 이후 글에서 자세히 다룹니다.

## JNI와 네이티브 라이브러리

JVM은 완전히 독립적이지 않습니다. `System.gc()`, `Object.hashCode()` 같은 일부 핵심 메서드는 내부적으로 JNI를 통해 OS 네이티브 코드를 호출합니다. 또한 `java.nio`의 Direct Buffer처럼 JVM Heap 밖의 메모리를 직접 다루는 Off-heap 영역도 JNI 연결로 관리됩니다.

## JVM 플래그로 메모리 조정하기

실무에서는 JVM 시작 옵션으로 각 영역의 크기를 조절합니다.

```bash
# Heap 초기값 256MB, 최대 2GB
java -Xms256m -Xmx2g MyApp

# Metaspace 최대 크기 제한
java -XX:MaxMetaspaceSize=256m MyApp

# 스레드 스택 크기 (기본값 512k ~ 1MB)
java -Xss512k MyApp

# JIT 컴파일 로그 출력 (진단용)
java -XX:+PrintCompilation MyApp
```

## 정리

| 서브시스템 | 역할 | 핵심 구성 |
|---|---|---|
| 클래스 로더 | `.class` → 메모리 적재 | 로딩 → 링킹 → 초기화 |
| 런타임 데이터 | 메모리 구조 관리 | Heap, Method Area, Stack |
| 실행 엔진 | 바이트코드 → 기계어 | 인터프리터, JIT, GC |

JVM 아키텍처를 이해하면 메모리 누수 디버깅, 성능 튜닝, GC 로그 분석 등 실무 문제를 훨씬 체계적으로 접근할 수 있습니다. 다음 글에서는 이 중 **클래스 로더 서브시스템**의 계층 구조와 위임 모델을 더 깊이 파헤칩니다.

---

**지난 글:** [JShell로 Java 코드 즉시 실행하기](/posts/java-jshell/)

**다음 글:** [JVM 클래스 로더 시스템](/posts/jvm-class-loader/)

<br>
읽어주셔서 감사합니다. 😊
