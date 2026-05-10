---
title: "JVM Class File 포맷 완전 해부"
description: ".class 파일의 내부 구조와 각 섹션의 역할을 상수 풀부터 메서드 테이블까지 상세히 알아본다"
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "class file", "bytecode", "javap", "constant pool"]
featured: false
draft: false
---

[지난 글](/posts/jvm-bytecode-instructions/)에서 JVM 바이트코드 명령어들을 살펴봤다. 이번에는 그 명령어들이 실제로 어떤 바이너리 파일 안에 담기는지, 즉 `.class` 파일의 내부 구조를 해부한다. `.class` 파일은 플랫폼 독립적인 Java의 핵심 산출물이며, JVM이 클래스를 로드할 때 가장 먼저 읽는 파일이다.

## .class 파일이란

`javac`가 `.java` 소스를 컴파일하면 각 클래스(또는 내부 클래스)마다 하나의 `.class` 파일이 생성된다. 이 파일은 JVM 명세(Java Virtual Machine Specification)가 정의하는 엄격한 바이너리 포맷을 따른다. OS나 CPU 아키텍처에 무관하게 동일한 포맷이므로 "Write Once, Run Anywhere"가 가능하다.

파일의 모든 데이터는 **빅 엔디언(big-endian)** 으로 저장된다. 명세에서 `u1`, `u2`, `u4`는 각각 1·2·4 바이트 부호 없는 정수를 뜻한다.

## ClassFile 전체 구조

![JVM .class 파일 구조](/assets/posts/jvm-class-file-format-structure.svg)

JVM 명세는 `ClassFile` 구조체를 다음과 같이 정의한다.

```text
ClassFile {
  u4             magic;
  u2             minor_version;
  u2             major_version;
  u2             constant_pool_count;
  cp_info        constant_pool[constant_pool_count - 1];
  u2             access_flags;
  u2             this_class;
  u2             super_class;
  u2             interfaces_count;
  u2             interfaces[interfaces_count];
  u2             fields_count;
  field_info     fields[fields_count];
  u2             methods_count;
  method_info    methods[methods_count];
  u2             attributes_count;
  attribute_info attributes[attributes_count];
}
```

위 순서는 고정이며, JVM 클래스 로더는 이 순서 그대로 바이트를 읽는다.

## Magic Number — 0xCAFEBABE

파일의 첫 4바이트는 항상 `0xCAFEBABE`다. JVM은 이 값을 먼저 확인해 유효한 `.class` 파일인지 판별한다. 값이 다르면 즉시 `ClassFormatError`를 던진다.

이름은 Java 탄생 전 Sun의 개발자들이 사용하던 내부 식당 이름 "Café Dead"에서 유래했다는 설이 있다.

## 버전 정보

`minor_version`과 `major_version` 조합이 컴파일에 사용된 Java 릴리즈를 식별한다. 주요 매핑은 다음과 같다.

| Java 버전 | major_version |
|-----------|---------------|
| Java 8    | 52            |
| Java 11   | 55            |
| Java 17   | 61            |
| Java 21   | 65            |

JVM은 자신이 지원하는 버전보다 높은 `major_version`의 클래스를 로드하면 `UnsupportedClassVersionError`를 발생시킨다. 이 에러는 현장에서 자주 마주치는 버전 불일치 문제의 근본 원인이다.

## 상수 풀 (Constant Pool)

상수 풀은 `.class` 파일에서 가장 중요한 섹션이다. 클래스 안에서 사용되는 **모든 문자열 리터럴, 클래스 이름, 필드 이름, 메서드 이름, 타입 디스크립터**를 테이블 형태로 저장한다.

`constant_pool_count` 값이 *N*이면 실제 엔트리는 `#1`부터 `#(N-1)`까지다(`#0`은 사용하지 않는다). 각 엔트리는 1바이트 **tag**로 시작해 타입을 나타내고, 타입에 따라 뒤따르는 데이터 구조가 달라진다.

주요 태그:

| tag | 명칭 | 설명 |
|-----|------|------|
| 1   | `Utf8` | 문자열 데이터 |
| 7   | `Class` | 클래스/인터페이스 참조 |
| 8   | `String` | 문자열 리터럴 |
| 9   | `Fieldref` | 필드 참조 |
| 10  | `Methodref` | 메서드 참조 |
| 11  | `InterfaceMethodref` | 인터페이스 메서드 참조 |
| 12  | `NameAndType` | 이름 + 타입 디스크립터 |

바이트코드 명령어에서 `#5`처럼 인덱스로 참조하기 때문에 상수 풀은 전체 클래스의 **심볼 색인(symbol table)** 역할을 한다.

## Access Flags

2바이트로 구성되며, 비트 마스크로 클래스의 접근 수정자를 나타낸다.

| 플래그 | 값 | 의미 |
|--------|-----|------|
| `ACC_PUBLIC`    | 0x0001 | public 클래스 |
| `ACC_FINAL`     | 0x0010 | 상속 불가 |
| `ACC_SUPER`     | 0x0020 | `invokespecial` 의미 변경 (항상 설정) |
| `ACC_INTERFACE` | 0x0200 | 인터페이스 |
| `ACC_ABSTRACT`  | 0x0400 | 추상 클래스 |
| `ACC_ENUM`      | 0x4000 | enum |
| `ACC_ANNOTATION`| 0x2000 | 어노테이션 |

일반 `public class`는 `ACC_PUBLIC | ACC_SUPER = 0x0021`이 된다.

## this_class / super_class / interfaces

`this_class`와 `super_class`는 상수 풀 내 `Class` 엔트리에 대한 인덱스(u2)다. `Object`의 `super_class`는 0으로 표현한다.

`interfaces` 배열에는 구현한 인터페이스들의 상수 풀 인덱스가 순서대로 나열된다.

## Fields & Methods

`fields`와 `methods` 테이블은 각각 `field_info`, `method_info` 구조체의 배열이다. 두 구조체 모두 `access_flags`, `name_index`, `descriptor_index`, `attributes_count`, `attributes`를 포함한다.

메서드의 실제 바이트코드는 `method_info` 안의 `Code` 어트리뷰트 안에 들어간다. `Code`는 다음을 담는다.

- `max_stack` — 연산 스택의 최대 깊이
- `max_locals` — 지역 변수 슬롯 수 (파라미터 포함)
- `code` — 바이트코드 명령어 배열
- `exception_table` — try-catch 범위 테이블
- `attributes` — `LineNumberTable`, `LocalVariableTable` 등

## Attributes

어트리뷰트는 구조체 전반(ClassFile, field_info, method_info, Code)에 붙을 수 있는 확장 메커니즘이다. 주목할 만한 어트리뷰트들은 다음과 같다.

```text
SourceFile         — 원본 .java 파일 이름
InnerClasses       — 내부 클래스 정보
Signature          — 제네릭 타입 정보 (타입 소거 후 보존)
RuntimeVisibleAnnotations — 런타임 반영 가능한 어노테이션
BootstrapMethods   — invokedynamic 부트스트랩 메서드 목록
NestHost / NestMembers — Java 11+ 네스트 접근 제어
```

Java 버전이 올라갈수록 새 어트리뷰트가 추가되지만, 모르는 어트리뷰트는 JVM이 무시하므로 하위 호환성을 유지한다.

## javap로 직접 확인하기

`javap`는 JDK에 포함된 역어셈블러다. `-v` 플래그로 상수 풀과 바이트코드를 포함한 전체 정보를 볼 수 있다.

```bash
javac Hello.java
javap -v Hello.class
```

![javap -v로 읽는 .class 파일](/assets/posts/jvm-class-file-format-bytecode.svg)

출력의 구조를 요약하면 다음과 같다.

```text
// javap -v Hello.class (발췌)
  major version: 65
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER

Constant pool:
   #1 = Methodref  #2.#3
   #7 = String     #8       // "Hello, World!"
  ...

public static void main(java.lang.String[]):
  Code:
     0: getstatic    #4   // Field java/io/PrintStream.out
     3: ldc          #7   // "Hello, World!"
     5: invokevirtual #5  // println
     8: return
```

`getstatic`, `ldc`, `invokevirtual`, `return` 네 개의 명령어가 출력 한 줄을 담당하는 것을 확인할 수 있다.

## 헥스 덤프로 매직 넘버 확인

바이너리 파일 수준에서 직접 확인하면 명세가 더 명확해진다.

```bash
# macOS / Linux
xxd Hello.class | head -4
```

```text
00000000: cafe babe 0000 0041 005a 0a00 0200 03...
          ^^^^ ^^^^ ---- ---- ^^^^
          magic       major=65(Java21) cp_count=90
```

## 정리

`.class` 파일은 JVM이 약속한 엄격한 바이너리 계약서다. 매직 넘버로 시작해 버전 → 상수 풀 → 접근 플래그 → 클래스 계층 → 필드 → 메서드 → 어트리뷰트 순으로 정보가 배치되며, 이 구조를 이해하면 클래스 로딩 오류 진단, 바이트코드 조작 라이브러리(ASM, ByteBuddy), 리플렉션 동작 원리까지 훨씬 깊이 있게 파악할 수 있다.

---

**지난 글:** [JVM 바이트코드 명령어](/posts/jvm-bytecode-instructions/)

**다음 글:** [Hello, Java World — 첫 번째 Java 프로그램](/posts/java-hello-world/)

<br>
읽어주셔서 감사합니다. 😊
