---
title: "JVM 바이트코드 명령어 완전 정복"
description: "JVM 바이트코드 명령어를 6대 분류별로 정리합니다. 로드·스토어, 산술·논리, 타입 변환, 제어 흐름, 메서드 호출·반환, 객체·배열 명령어의 동작 원리를 javap 출력과 함께 실전 코드로 분석합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "바이트코드", "Bytecode", "javap", "if_icmple", "invokevirtual", "invokedynamic", "명령어", "opcode"]
featured: false
draft: false
---

[지난 글](/posts/jvm-bytecode-basics/)에서 `javac`가 Java 소스를 `.class` 파일로 변환하는 컴파일 파이프라인과 오퍼랜드 스택·로컬 변수 테이블의 동작 원리를 살펴봤습니다. 이번 글에서는 JVM이 실제로 처리하는 바이트코드 명령어(opcode)를 6대 분류별로 상세히 분석합니다. 명령어 이름의 규칙만 이해해도 `javap` 출력을 읽는 속도가 크게 올라갑니다.

## 명령어 체계 개요

JVM 명세(Java SE 21 기준)는 약 200개의 opcode를 정의합니다. 각 명령어는 1바이트 opcode로 시작하며, 뒤따르는 피연산자(operand)는 0~수 바이트입니다. 명령어 이름에는 세 가지 규칙이 있습니다.

1. **타입 접두사**: `i`=int, `l`=long, `f`=float, `d`=double, `a`=reference, `b`=byte, `s`=short
2. **빠른 변형**: `_0`, `_1`, `_2`, `_3` 접미사는 인덱스를 opcode에 인코딩한 단축형 (`iload_0` = `iload 0`)
3. **와이드 접두사**: `wide`는 뒤따르는 명령어의 인덱스를 2바이트로 확장

![JVM 바이트코드 명령어 6대 분류](/assets/posts/jvm-bytecode-instructions-categories.svg)

## 로드·스토어 명령어

로컬 변수 테이블과 오퍼랜드 스택 사이에 값을 이동하는 명령어 군입니다.

| 방향 | int | long | float | double | reference |
|---|---|---|---|---|---|
| 로컬 → 스택 | `iload` | `lload` | `fload` | `dload` | `aload` |
| 스택 → 로컬 | `istore` | `lstore` | `fstore` | `dstore` | `astore` |

`ldc`(Load Constant)는 상수 풀에서 값을 스택으로 올립니다. `ldc2_w`는 `long`·`double` 상수에 사용하는 2바이트 인덱스 변형입니다.

```java
// Java
void example() {
    int x = 42;
    String s = "hello";
}
```

```text
// javap -c 출력
0: bipush        42     // int 상수 push (-128~127)
2: istore_1             // local[1] = 42
3: ldc           #2     // 상수 풀 #2 "hello" → 스택
5: astore_2             // local[2] = "hello" 참조
6: return
```

`bipush`는 `-128~127` 범위의 int 상수를 1바이트로 직접 인코딩합니다. 범위가 넘어가면 `sipush`(2바이트) 또는 상수 풀에 저장된 값을 `ldc`로 올립니다.

## 산술·논리 명령어

스택 top 두 값을 pop하여 연산 후 결과를 push합니다. 단항 연산(negation, `ineg`)은 top 하나만 pop합니다.

```java
// Java
static long compute(int a, int b) {
    return (long) a * b + 100L;
}
```

```text
// javap -c 출력
0: iload_0          // push a
1: i2l              // int → long (타입 변환)
2: iload_1          // push b
3: i2l              // int → long
4: lmul             // long × long
5: ldc2_w   #2      // push 100L
8: ladd             // long + long
9: lreturn          // long 반환
```

`iinc` 명령어는 예외적으로 스택을 사용하지 않고 로컬 변수를 **직접** 증감합니다. `for (int i = 0; i < n; i++)` 루프의 `i++`가 `iinc 1, 1` 한 줄로 처리되는 이유입니다.

## 타입 변환 명령어

자동 확장 변환(widening)과 명시적 축소 변환(narrowing) 모두 바이트코드 명령어로 표현됩니다.

| 원본 → 대상 | 명령어 |
|---|---|
| int → long | `i2l` |
| int → float | `i2f` |
| int → double | `i2d` |
| long → int | `l2i` |
| double → int | `d2i` |
| int → byte | `i2b` |
| int → char | `i2c` |

`checkcast`와 `instanceof`는 참조 타입(reference type) 대상입니다.

```java
// Java
Object obj = "Hello";
if (obj instanceof String s) {
    System.out.println(s.length());
}
```

```text
// (Java 16+ 패턴 매칭 바이트코드 개요)
// obj → 스택
aload_1
// instanceof 검사 (Java 21: checkcast 결합)
instanceof    #3         // String?
ifeq          <skip>     // false → 건너뜀
aload_1
checkcast     #3         // String으로 캐스팅
astore_2                 // 패턴 변수 s
// s.length() 호출
aload_2
invokevirtual #4         // String.length()
// ... 출력 처리
```

## 제어 흐름 명령어

Java의 `if`, `for`, `while`, `switch`는 모두 바이트코드 수준에서 **오프셋 점프**로 변환됩니다.

![바이트코드 제어 흐름 — max(int, int) 분기 추적](/assets/posts/jvm-bytecode-instructions-trace.svg)

`if_icmp*` 계열은 스택 top 두 int를 비교합니다.

| 명령어 | 조건 | 참이면 |
|---|---|---|
| `if_icmpeq` | a == b | 지정 오프셋으로 jump |
| `if_icmpne` | a != b | jump |
| `if_icmplt` | a < b | jump |
| `if_icmple` | a ≤ b | jump |
| `if_icmpgt` | a > b | jump |
| `if_icmpge` | a ≥ b | jump |

`goto`는 무조건 점프입니다. 컴파일러는 `break`·`continue`·루프의 back-edge를 `goto`로 표현합니다.

**switch 최적화**: 정수 case 집합이 밀집(dense)하면 `tableswitch`(O(1) 테이블 조회), 성긴(sparse) 경우 `lookupswitch`(이진 탐색)로 컴파일됩니다. Java 14+ 화살표 switch 표현식도 내부적으로 동일한 opcode를 사용합니다.

## 메서드 호출·반환 명령어

메서드 호출은 디스패치 방식에 따라 5가지 명령어로 나뉩니다.

```java
class Example {
    void demo(List<String> list) {
        // invokestatic — 정적 메서드
        int h = Objects.hash("a", "b");

        // invokevirtual — 가상 메서드 (다형성)
        int size = list.size();

        // invokeinterface — 인터페이스 메서드
        list.add("x");

        // invokespecial — 생성자·private·super
        super.hashCode();

        // invokedynamic — 람다·스트림
        list.stream()
            .filter(s -> s.startsWith("a"))
            .count();
    }
}
```

```text
// list.size() — invokevirtual
invokevirtual  #5   // java/util/List.size:()I

// list.add("x") — invokeinterface
ldc            #6   // "x"
invokeinterface #7, 2  // java/util/List.add:(Object)Z

// 람다 — invokedynamic
invokedynamic  #8   // filter:(Predicate)Stream
```

`invokedynamic`은 Java 7에서 도입됐습니다. `BootstrapMethod`가 첫 호출 시 실제 `MethodHandle`을 생성하고 이후에는 캐시된 경로를 사용합니다. 람다·메서드 레퍼런스·문자열 연결(`+`)이 이 방식을 활용합니다.

반환 명령어는 타입별로 존재합니다: `ireturn`(int/byte/short/char/boolean), `lreturn`, `freturn`, `dreturn`, `areturn`(reference), `return`(void).

## 객체·배열 명령어

```java
// new 생성자 호출 패턴
StringBuilder sb = new StringBuilder("init");
```

```text
// new → dup → invokespecial 패턴
new           #9    // StringBuilder 할당, 스택에 ref push
dup                 // ref 복사 (invokespecial이 소비하기 전에)
ldc           #10   // "init"
invokespecial #11   // StringBuilder.<init>:(String)V
astore_1            // local[1] = sb
```

`new`는 객체를 힙에 할당하고 참조를 스택에 push하지만 초기화하지 않습니다. `invokespecial`로 `<init>`(생성자)을 호출해야 비로소 초기화됩니다. 생성자가 스택의 참조(this)를 소비하기 때문에 `dup`으로 미리 복제해 두지 않으면 변수에 저장할 참조가 사라집니다.

배열 관련 주요 명령어:

| 명령어 | 설명 |
|---|---|
| `newarray` | 기본 타입 배열 생성 |
| `anewarray` | 참조 타입 배열 생성 |
| `multianewarray` | 다차원 배열 생성 |
| `arraylength` | 배열 길이 push |
| `iaload`/`iastore` | int 배열 요소 로드/스토어 |
| `aaload`/`aastore` | 참조 배열 요소 로드/스토어 |

## 실전 예제: 문자열 연결의 변화

Java 9 이전에는 `"a" + b`가 `StringBuilder.append()` 체인으로 컴파일됐습니다. Java 9+부터는 `invokedynamic` + `StringConcatFactory`를 사용해 JVM이 런타임 최적화를 직접 담당합니다.

```java
// Java 9+ 문자열 연결
String greet(String name) {
    return "Hello, " + name + "!";
}
```

```text
// Java 9+ javap -c 출력
0: aload_1              // push name
1: invokedynamic  #2    // makeConcatWithConstants
   // "Hello, !" —  이 name 자리
6: areturn
```

단 2개의 명령어로 완성됩니다. Java 8의 `StringBuilder` 4~5 단계 체인보다 간결하며, JVM이 런타임 조건에 따라 더 효율적인 구현을 선택할 수 있습니다.

## 예외 처리 명령어

`athrow`는 스택 top의 `Throwable` 참조를 팝하여 예외를 발생시킵니다. 예외 처리기(핸들러) 범위는 바이트코드 명령어가 아닌 **예외 테이블(exception table)**로 표현됩니다.

```text
Exception table:
  from    to  target  type
     0    16      19  Class java/io/IOException
```

`from`~`to` 범위의 PC에서 지정 타입 예외가 발생하면 `target` PC로 이동합니다. `finally` 블록은 예외 타입 없는 핸들러(catch-all)로 표현되거나, Java 컴파일러가 코드를 인라인하는 방식으로 처리합니다.

## 정리

- JVM 바이트코드 명령어는 6대 분류(로드·스토어, 산술·논리, 타입 변환, 제어 흐름, 메서드 호출·반환, 객체·배열)로 나뉜다.
- 명령어 이름의 타입 접두사(i/l/f/d/a)와 빠른 변형(`_0~_3`)만 이해하면 낯선 opcode도 빠르게 해석할 수 있다.
- `if_icmp*` 계열은 스택 비교 후 오프셋 점프로 분기를 구현한다.
- 생성자 호출은 `new` → `dup` → `invokespecial` 3단계 패턴이다.
- `invokedynamic`은 람다·문자열 연결 등 동적 디스패치에 사용되며 BootstrapMethod가 첫 호출 시 바인딩을 결정한다.

---

**지난 글:** [JVM 바이트코드 기초: 소스에서 명령어까지](/posts/jvm-bytecode-basics/)

**다음 글:** [JVM 클래스 파일 구조 완전 분석](/posts/jvm-class-file-format/)

<br>
읽어주셔서 감사합니다. 😊
