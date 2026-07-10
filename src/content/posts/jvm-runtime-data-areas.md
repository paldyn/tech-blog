---
title: "JVM 런타임 데이터 영역"
description: "Heap·Metaspace·Code Cache·JVM Stack·PC Register·Native Method Stack 등 JVM이 실행 중에 사용하는 메모리 영역별 구조와 역할, OOM·SOE 발생 조건, 진단 방법까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "Heap", "Metaspace", "JVM Stack", "런타임 데이터 영역", "메모리 구조", "OutOfMemoryError"]
featured: false
draft: false
---

[지난 글](/posts/jvm-class-loader-delegation/)에서 부모 위임 모델이 클래스를 로드하는 원리를 살펴봤습니다. 클래스가 로드되면 JVM의 다양한 메모리 영역에 데이터가 흩어져 저장되기 시작합니다. 이번 글에서는 **JVM 런타임 데이터 영역(Runtime Data Areas)**의 구조와 각 영역이 어떤 데이터를 어떻게 관리하는지 살펴봅니다.

## 전체 구조: 공유 vs. 전용

JVM의 메모리 영역은 크게 **모든 스레드가 공유**하는 영역과 **스레드마다 독립적으로 존재**하는 영역으로 나뉩니다.

![JVM 런타임 데이터 영역 전체 구조](/assets/posts/jvm-runtime-data-areas-overview.svg)

공유 영역(Heap, Metaspace, Code Cache)은 GC의 관리를 받거나 용량 초과 시 `OutOfMemoryError`가 발생합니다. 스레드 전용 영역(PC Register, JVM Stack, Native Method Stack)은 스레드 생애주기와 함께하며, 스택 깊이 초과 시 `StackOverflowError`가 납니다.

## Heap

모든 **객체와 배열**이 생성되는 공간입니다. `new` 키워드로 만든 모든 것이 여기에 놓입니다. GC가 주기적으로 순회하며 참조가 끊긴 객체를 회수합니다.

```java
// 이 모든 것이 Heap에 할당된다
String s = new String("hello");       // Heap에 String 객체
int[] arr = new int[1000];            // Heap에 배열
List<String> list = new ArrayList<>(); // Heap에 ArrayList 객체
```

Heap 크기는 두 JVM 플래그로 제어합니다.

- `-Xms<size>`: 초기 Heap 크기 (기본 물리 메모리의 1/64)
- `-Xmx<size>`: 최대 Heap 크기 (기본 물리 메모리의 1/4)

운영 환경에서는 `-Xms`와 `-Xmx`를 동일하게 설정하는 것이 일반적입니다. JVM이 런타임에 Heap 크기를 늘리는 작업(GC 압박 포함) 자체가 지연을 유발하기 때문입니다.

### Heap 내부 세대 구조

GC 효율을 위해 Heap은 객체의 수명에 따라 영역을 나눕니다.

```
G1GC 기준 Heap 레이아웃
─────────────────────────────────────────────────
 Eden  │ Survivor0 │ Survivor1  ← Young Generation
─────────────────────────────────────────────────
             Old Generation (Tenured)
─────────────────────────────────────────────────
         Humongous Regions (대형 객체 전용)
─────────────────────────────────────────────────
```

대부분의 객체는 **Young Gen**에서 짧은 생애를 마치고 회수됩니다(Minor GC). 살아남은 객체는 Old Gen으로 이동(Promotion)하며, Old Gen이 차면 Full GC(또는 Mixed GC)가 발생합니다.

## Metaspace (Method Area)

Java 8 이전에는 **PermGen(Permanent Generation)**이라 불렸고 Heap의 일부였습니다. Java 8부터 **Metaspace**로 이름이 바뀌고 Native Memory(OS 직접 관리)로 이동했습니다.

Metaspace에는 다음 데이터가 저장됩니다.

| 데이터 | 설명 |
|---|---|
| 클래스 메타데이터 | 클래스 이름, 슈퍼클래스, 인터페이스, 필드·메서드 시그니처 |
| 런타임 Constant Pool | 심볼릭 참조 → 직접 참조로 해석된 값 |
| static 변수 | Java 8 이후, static 참조형 변수의 참조값 |
| 메서드 바이트코드 | 컴파일된 바이트코드 자체 |

```bash
# Metaspace 크기 제한 (기본은 시스템 메모리에 따라 무제한)
-XX:MetaspaceSize=256m       # 초기 크기
-XX:MaxMetaspaceSize=512m    # 최대 크기 (명시 권장)
```

`MaxMetaspaceSize`를 지정하지 않으면 Metaspace는 Native Memory 한계까지 계속 자랍니다. 클래스를 동적으로 생성하는 프레임워크(Spring AOP, Groovy 스크립트 등)에서 `OutOfMemoryError: Metaspace`가 발생하는 원인입니다.

## Code Cache

JIT 컴파일러가 바이트코드를 네이티브 코드로 변환한 결과물을 저장하는 영역입니다. Heap과 Metaspace 바깥의 Native Memory에 위치합니다.

```bash
# Code Cache 크기 설정 (기본 240 MB)
-XX:ReservedCodeCacheSize=512m

# Code Cache 사용량 모니터링
jcmd <pid> Compiler.codecache
```

Code Cache가 가득 차면 JIT는 새 코드를 컴파일하지 못하고 기존 네이티브 코드도 점진적으로 언로드됩니다. 결과적으로 인터프리터 모드로 폴백하면서 급격한 성능 저하가 나타납니다. 로그에 `CodeCache is full. Compiler has been disabled.` 메시지가 보이면 이 상황입니다.

## PC Register (Program Counter Register)

현재 실행 중인 **JVM 바이트코드 명령의 주소**를 가리키는 스레드 전용 레지스터입니다. 스레드가 CPU에서 교체되었다가 다시 돌아올 때 어디서 재개할지 알기 위해 필요합니다.

Native 메서드를 실행하는 동안에는 PC Register 값이 undefined(정의되지 않음)입니다. Native 코드는 JVM 바이트코드 주소 체계 밖에 있기 때문입니다.

## JVM Stack

메서드가 호출될 때마다 **스택 프레임(Stack Frame)**이 하나 추가되고, 메서드가 반환되면 팝(pop)됩니다. 각 프레임은 세 부분으로 구성됩니다.

![JVM 스택 프레임 구조와 피연산자 스택 동작](/assets/posts/jvm-runtime-data-areas-stack-frame.svg)

```
Frame 구조
──────────────────────────────────────
 Local Variable Array  (지역 변수 배열)
 Operand Stack         (피연산자 스택)
 Frame Data            (CP 참조, 반환 주소, 예외 테이블)
──────────────────────────────────────
```

**지역 변수 배열(Local Variable Array)**: 메서드의 파라미터와 지역 변수가 인덱스 기반으로 저장됩니다. 인스턴스 메서드는 인덱스 0이 항상 `this`입니다.

**피연산자 스택(Operand Stack)**: 바이트코드 명령이 값을 올리고(push) 내리며(pop) 연산을 수행하는 작업 공간입니다. `iadd`는 스택에서 int 두 개를 팝하고 덧셈 결과를 다시 푸시합니다.

```java
public int add(int a, int b) {
    return a + b; // iload_1, iload_2, iadd, ireturn
}
```

JVM Stack 크기는 `-Xss`로 설정하며, 기본값은 OS와 JVM 구현마다 다릅니다(보통 512 KB~1 MB). 재귀가 깊어지거나 지역 변수가 매우 많으면 `StackOverflowError`가 발생합니다.

```java
// StackOverflowError 예시
public static void infinite() {
    infinite(); // 탈출 조건 없는 재귀 → SOE
}
```

## Native Method Stack

`native` 키워드로 선언된 C/C++ 메서드가 실행될 때 사용하는 스택입니다. JNI(Java Native Interface)를 통해 호출되는 OS API, 파일 I/O의 저수준 구현 등이 여기서 실행됩니다.

HotSpot JVM은 JVM Stack과 Native Method Stack을 하나로 통합 구현합니다. Java 메서드와 Native 메서드 호출이 동일한 스레드 스택에서 섞여 나타나는 이유입니다. `jstack`으로 스레드 덤프를 뽑으면 `[native]`로 표시된 프레임이 Native Method Stack에 해당합니다.

## 영역별 OOM 진단

```bash
# 1. Heap OOM: 힙 덤프로 누수 분석
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/heap.hprof
# 분석: jvisualvm, Eclipse MAT

# 2. Metaspace OOM: 클래스 로더 누수 의심
jcmd <pid> VM.classloaders
jcmd <pid> VM.classloader_stats

# 3. Code Cache: JIT 컴파일 상태 확인
jcmd <pid> Compiler.codecache

# 4. 전체 메모리 요약
jcmd <pid> VM.native_memory summary
```

`-XX:+PrintGCDetails -XX:+PrintGCDateStamps`를 추가하면 각 GC가 얼마나 자주, 얼마나 오래 발생하는지 파악할 수 있습니다.

## 정리

| 영역 | 스레드 | 저장 내용 | 오류 |
|---|---|---|---|
| Heap | 공유 | 객체, 배열 | OOM |
| Metaspace | 공유 | 클래스 메타데이터, static 변수 | OOM |
| Code Cache | 공유 | JIT 네이티브 코드 | JIT 중단 |
| PC Register | 전용 | 현재 실행 바이트코드 주소 | - |
| JVM Stack | 전용 | 메서드 프레임 (지역변수·피연산자 스택) | SOE |
| Native Method Stack | 전용 | C/C++ 네이티브 프레임 | SOE |

런타임 데이터 영역을 이해하면 OOM이나 SOE 같은 에러가 발생했을 때 "어디서 무엇이 차고 있는지"를 구체적으로 진단할 수 있습니다. 다음 글에서는 그중 가장 크고 중요한 **Heap의 내부 구조** — Young/Old 영역 구분과 객체의 생애주기를 자세히 살펴봅니다.

---

**지난 글:** [클래스 로더 위임 모델 심화](/posts/jvm-class-loader-delegation/)

**다음 글:** [JVM Heap 구조 완전 분석](/posts/jvm-heap-structure/)

<br>
읽어주셔서 감사합니다. 😊
