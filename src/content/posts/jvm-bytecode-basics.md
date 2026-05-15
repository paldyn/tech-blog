---
title: "JVM 바이트코드 기초: 소스에서 명령어까지"
description: "Java 소스가 .class 파일로 컴파일되는 과정, javap로 바이트코드를 직접 읽는 방법, 오퍼랜드 스택과 로컬 변수 테이블의 동작 원리를 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "바이트코드", "Bytecode", "javap", "오퍼랜드 스택", "클래스 파일", "컴파일", "CAFEBABE"]
featured: false
draft: false
---

[지난 글](/posts/jvm-tiered-compilation/)에서 JVM이 C1·C2 컴파일러를 협력시켜 빠른 시작과 높은 처리량을 동시에 달성하는 티어드 컴파일 전략을 살펴봤습니다. 두 컴파일러가 처리하는 입력은 Java 소스 코드가 아니라 **바이트코드(bytecode)**입니다. 이번 글에서는 Java 소스가 어떤 과정을 거쳐 바이트코드로 변환되는지, 그리고 JVM이 그 바이트코드를 어떤 방식으로 해석하는지를 낮은 추상 레벨에서 살펴봅니다.

## 바이트코드란 무엇인가

Java는 "Write Once, Run Anywhere"를 실현하기 위해 **두 단계 컴파일** 방식을 채택합니다. 첫 번째 단계에서 `javac`가 `.java` 소스를 플랫폼 중립적인 `.class` 파일로 변환하고, 두 번째 단계에서 JVM이 해당 `.class`를 실행 환경에 맞는 네이티브 코드로 번역합니다.

바이트코드(bytecode)는 첫 번째 단계의 산출물입니다. 이름에서 알 수 있듯이 각 명령어(opcode)가 정확히 **1바이트**로 표현됩니다. 최대 256가지 명령어를 정의할 수 있으며, JVM 명세(Java Virtual Machine Specification)는 현재 약 200개의 opcode를 정의합니다. 나머지는 미래 확장을 위해 예약돼 있습니다.

바이트코드가 플랫폼 중립적인 이유는 **JVM 명세**가 플랫폼별로 존재하기 때문입니다. 같은 `.class` 파일을 x86 윈도우의 HotSpot JVM, ARM macOS의 Zulu JDK, 클라우드 서버의 OpenJ9 어느 곳에서 실행해도 동일한 결과를 보장합니다.

## 컴파일 과정: javac의 내부

`javac`는 단순히 소스를 그대로 바이트코드로 변환하지 않습니다. 내부적으로 여러 단계를 거칩니다.

1. **파싱(Parsing)**: 소스 파일을 읽어 추상 구문 트리(AST)를 생성합니다.
2. **심볼 해석(Symbol Resolution)**: 타입 참조, 메서드 시그니처, 임포트를 해석합니다.
3. **타입 검사(Type Checking)**: 정적 타입 안전성을 검증합니다.
4. **탈슈가링(Desugaring)**: `for-each`, 제네릭, 람다, 문자열 switch 같은 고수준 구문을 저수준으로 변환합니다.
5. **코드 생성(Code Generation)**: AST를 바이트코드로 변환하고 `.class` 파일을 씁니다.

이 과정에서 소스 레벨의 제네릭 타입 정보(예: `List<String>`)는 **타입 소거(type erasure)**를 통해 사라집니다. 제네릭이 런타임에 보이지 않는 이유가 여기 있습니다.

## javap로 바이트코드 직접 읽기

JDK에 포함된 `javap` 도구를 사용하면 `.class` 파일의 바이트코드를 사람이 읽을 수 있는 어셈블리 형태로 출력할 수 있습니다.

```java
// Add.java
public class Add {
    public static int add(int a, int b) {
        return a + b;
    }
}
```

컴파일 후 `javap -c Add.class`를 실행하면 다음과 같은 출력을 얻습니다.

```text
Compiled from "Add.java"
public class Add {
  public static int add(int, int);
    Code:
       0: iload_0
       1: iload_1
       2: iadd
       3: ireturn
}
```

`-verbose` 옵션을 추가하면 상수 풀(Constant Pool), 최대 스택 깊이(`max stack`), 로컬 변수 테이블 크기(`max locals`), 예외 테이블 같은 추가 메타데이터를 볼 수 있습니다.

```bash
javap -c -verbose Add.class
```

```text
  public static int add(int, int);
    descriptor: (II)I
    flags: (0x0009) ACC_PUBLIC, ACC_STATIC
    Code:
      stack=2, locals=2, args_size=2
         0: iload_0
         1: iload_1
         2: iadd
         3: ireturn
```

`stack=2`는 이 메서드가 실행되는 동안 오퍼랜드 스택의 최대 깊이가 2임을, `locals=2`는 로컬 변수 슬롯이 2개임을 의미합니다.

## 오퍼랜드 스택 모델

JVM은 **스택 기반 가상 머신(stack-based VM)**입니다. 레지스터 기반 VM(예: Dalvik)과 달리, 명령어가 피연산자를 명시적으로 지정하지 않고 **오퍼랜드 스택(operand stack)**을 공유 임시 저장소로 사용합니다.

`add(3, 4)` 호출 시 각 명령어가 스택을 어떻게 변화시키는지 추적해 보겠습니다.

![오퍼랜드 스택 실행 모델 — add(3, 4) 단계별 추적](/assets/posts/jvm-bytecode-basics-operand-stack.svg)

| 명령어 | 동작 | 스택 상태 |
|---|---|---|
| (시작) | — | `[]` |
| `iload_0` | 로컬 변수 0번(a=3)을 스택에 push | `[3]` |
| `iload_1` | 로컬 변수 1번(b=4)을 스택에 push | `[3, 4]` |
| `iadd` | 스택 top 2개를 pop, 합산 후 push | `[7]` |
| `ireturn` | 스택 top을 pop하여 호출자에게 반환 | `[]` |

`i`는 **int** 타입을 의미합니다. `l`은 long, `f`는 float, `d`는 double, `a`는 reference 타입에 해당합니다. 명령어 이름에 타입 접두사가 붙어 있어 JVM이 타입 안전성을 바이트코드 수준에서 검증할 수 있습니다.

## 로컬 변수 테이블

각 스택 프레임(stack frame)에는 오퍼랜드 스택 외에 **로컬 변수 테이블(local variable table)**이 있습니다. 이 테이블은 메서드 매개변수와 지역 변수를 인덱스 기반으로 저장합니다.

- **정적 메서드**: 인덱스 0이 첫 번째 매개변수
- **인스턴스 메서드**: 인덱스 0이 항상 `this`, 매개변수는 1부터 시작

```java
// 인스턴스 메서드의 로컬 변수 테이블 예
public int multiply(int x, int y) {
    int result = x * y;
    return result;
}
// local[0] = this (묵시적)
// local[1] = x
// local[2] = y
// local[3] = result
```

`long`과 `double`은 64비트 값이므로 슬롯 2개를 점유합니다. 이 때문에 `long` 매개변수 이후에 오는 변수는 인덱스가 1이 아닌 2 증가합니다.

## 클래스 파일 구조

`.class` 파일은 구조화된 이진 형식입니다. 파일 시작부터 다음 항목이 순서대로 나타납니다.

```text
ClassFile {
    u4 magic;               // 0xCAFEBABE — Java 클래스 파일 식별자
    u2 minor_version;       // 부 버전 (보통 0)
    u2 major_version;       // 주 버전 (Java 21 = 65)
    u2 constant_pool_count; // 상수 풀 항목 수
    cp_info constant_pool[]; // 문자열·타입·메서드 참조 등
    u2 access_flags;        // public, final, abstract 등
    u2 this_class;          // 현재 클래스 이름 (상수 풀 인덱스)
    u2 super_class;         // 부모 클래스 이름
    u2 interfaces_count;
    u2 interfaces[];        // 구현 인터페이스 목록
    u2 fields_count;
    field_info fields[];    // 필드 정보
    u2 methods_count;
    method_info methods[];  // 메서드 정보 (바이트코드 포함)
    u2 attributes_count;
    attribute_info attributes[]; // 소스 파일명, 디버그 정보 등
}
```

이 구조를 직접 확인하고 싶다면 `xxd Add.class | head -4`를 실행하면 첫 바이트가 `cafe babe`임을 볼 수 있습니다.

![Java 컴파일 파이프라인: .java → .class → JVM 실행](/assets/posts/jvm-bytecode-basics-pipeline.svg)

`magic` 필드(`0xCAFEBABE`)는 James Gosling이 선택한 식별자로, JVM이 파일을 로드할 때 이 값을 확인해 Java 클래스 파일인지 검증합니다. 값이 일치하지 않으면 `ClassFormatError`가 발생합니다.

## 상수 풀의 역할

상수 풀(constant pool)은 클래스 파일의 핵심 구조물입니다. 문자열 리터럴, 클래스·인터페이스·메서드·필드 참조, 기본 타입 상수가 모두 여기 저장됩니다. 바이트코드 명령어는 직접 값을 가지는 대신 상수 풀의 인덱스를 참조합니다.

```text
Constant pool:
   #1 = Methodref    #2.#3   // java/lang/Object."<init>":()V
   #2 = Class        #4      // java/lang/Object
   #3 = NameAndType  #5:#6   // "<init>":()V
   #4 = Utf8         java/lang/Object
   #5 = Utf8         <init>
   #6 = Utf8         ()V
```

이 간접 참조 방식 덕분에 클래스 파일이 컴팩트하게 유지되고, 링킹(linking) 단계에서 심볼릭 참조가 실제 메모리 주소로 해석됩니다.

## 바이트코드가 플랫폼 중립적인 이유

바이트코드 자체는 특정 CPU 아키텍처에 종속되지 않습니다. JVM이 **중간 계층** 역할을 하며 실행 환경(Windows x86, Linux ARM, macOS Apple Silicon)에 맞는 네이티브 명령어로 변환합니다. JVM 구현체는 반드시 JVM 명세를 따라야 하므로 동일한 `.class`가 어느 플랫폼에서나 동일하게 동작합니다.

Kotlin, Scala, Groovy, Clojure 같은 JVM 언어들이 Java 라이브러리와 완벽하게 상호 운용될 수 있는 이유도 모두 바이트코드라는 **공통 언어** 덕분입니다.

## 정리

- `javac`는 Java 소스를 플랫폼 중립적인 `.class` 바이트코드로 변환한다.
- 바이트코드는 1바이트 opcode + 선택적 피연산자로 구성된 명령어 집합이다.
- JVM은 스택 기반 VM으로, 오퍼랜드 스택과 로컬 변수 테이블을 통해 명령어를 실행한다.
- `javap -c -verbose`로 바이트코드와 메타데이터를 직접 확인할 수 있다.
- 같은 `.class` 파일은 JVM 명세를 구현한 어떤 플랫폼에서도 동일하게 실행된다.

---

**다음 글:** [JVM 바이트코드 명령어 완전 정복](/posts/jvm-bytecode-instructions/)

<br>
읽어주셔서 감사합니다. 😊
