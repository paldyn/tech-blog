---
title: "Write Once, Run Anywhere — Java의 플랫폼 독립성"
description: "WORA 슬로건의 기술적 배경과 JVM이 플랫폼 독립성을 실현하는 원리, 바이트코드의 역할, 그리고 실무에서 마주치는 한계까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["java", "wora", "jvm", "bytecode", "platform-independence", "javac", "cross-platform"]
featured: false
draft: false
---

[지난 글](/posts/java-lts-release-cycle/)에서 Java 릴리즈 사이클과 LTS 버전을 살펴봤습니다. 이번에는 Java가 처음 세상에 나왔을 때 가장 파격적인 약속이었던 "Write Once, Run Anywhere(WORA)"를 기술적으로 파헤칩니다. 이 슬로건이 어떻게 가능한지, 그 이면에 어떤 설계 결정이 있었는지, 그리고 2020년대에도 여전히 유효한 약속인지를 살펴봅니다.

---

## WORA 이전의 세상

Java가 등장한 1990년대 중반에는 소프트웨어를 배포하는 방식이 매우 불편했습니다. C나 C++로 작성한 프로그램을 배포하려면 대상 플랫폼 각각을 위해 별도로 컴파일해야 했습니다.

- Windows x86용 바이너리
- Linux x86용 바이너리
- Solaris SPARC용 바이너리
- HP-UX PA-RISC용 바이너리...

각 플랫폼마다 다른 CPU 명령어셋, 다른 운영체제 API, 다른 ABI(Application Binary Interface)를 가지고 있었기 때문입니다. 인터넷이 빠르게 성장하던 당시, Sun Microsystems는 브라우저 안에서 어떤 플랫폼에서도 실행되는 소프트웨어를 만들고 싶었습니다. 그 해법이 바로 Java였습니다.

---

## JVM이라는 추상화 계층

Java의 핵심 아이디어는 **하드웨어와 운영체제 위에 가상 머신(JVM)이라는 추상화 계층을 놓는 것**입니다. Java 프로그램은 실제 CPU 명령어가 아닌, JVM이 이해하는 **바이트코드(bytecode)**로 컴파일됩니다.

```text
[Java 소스] → javac → [바이트코드 .class] → JVM → [실행]
```

JVM 자체는 플랫폼마다 다르게 구현됩니다. Windows용 JVM, Linux용 JVM, macOS용 JVM이 별도로 존재합니다. 하지만 이들은 모두 **동일한 바이트코드 명세(JVM Specification)를 구현**합니다. 덕분에 개발자가 한 번 컴파일한 `.class` 파일은 JVM이 설치된 어떤 시스템에서도 실행됩니다.

![Write Once, Run Anywhere — 동작 원리](/assets/posts/java-write-once-run-anywhere-wora.svg)

---

## 바이트코드란 무엇인가

바이트코드는 **가상 머신을 위한 중간 표현(Intermediate Representation)**입니다. 실제 CPU 명령어(예: x86-64 `mov rax, rbx`)도 아니고, 인터프리터가 문자 그대로 해석하는 소스코드도 아닙니다. JVM이 빠르게 해석하거나 네이티브 코드로 변환할 수 있도록 설계된, **스택 기반의 저수준 명령어셋**입니다.

아래는 `System.out.println("Hello, World!")`를 포함하는 간단한 클래스를 `javac`로 컴파일한 뒤 `javap -c`로 역어셈블한 결과입니다.

```bash
# 컴파일 후 바이트코드 확인
javac HelloWorld.java
javap -c HelloWorld
```

```text
public static void main(java.lang.String[]);
  Code:
     0: getstatic     #7   // Field java/lang/System.out
     3: ldc           #13  // String "Hello, World!"
     5: invokevirtual #15  // Method println:(Ljava/lang/String;)V
     8: return
```

각 명령어 앞의 숫자는 메서드 내 바이트코드 오프셋입니다. `getstatic`은 정적 필드를 스택에 올리고, `ldc`는 상수풀에서 문자열을 로드하며, `invokevirtual`은 가상 메서드를 호출합니다. 이 명령어들은 CPU 아키텍처와 무관하며, JVM이 알아서 해당 플랫폼에 맞는 기계어로 변환합니다.

![소스 코드 → 바이트코드 변환](/assets/posts/java-write-once-run-anywhere-bytecode.svg)

---

## JIT 컴파일: 해석이 아니라 변환

초기 JVM은 바이트코드를 한 명령어씩 해석(interpret)했기 때문에 성능이 느렸습니다. 오늘날 JVM은 **JIT(Just-In-Time) 컴파일러**를 내장하고 있습니다.

JIT 컴파일러는 자주 실행되는 코드(핫스팟)를 감지하고, 런타임에 해당 바이트코드를 실행 중인 플랫폼의 네이티브 기계어로 컴파일합니다. 이 과정은 프로그램이 실행되는 동안 투명하게 일어납니다.

```text
바이트코드 → 인터프리터 → (충분히 뜨거워지면) JIT → 네이티브 코드 캐시
```

HotSpot JVM은 C1(클라이언트 컴파일러, 빠른 시작)과 C2(서버 컴파일러, 최적화된 실행)를 조합한 **티어드 컴파일(Tiered Compilation)**을 사용합니다. 덕분에 현대 Java 프로그램은 C/C++에 근접하는 실행 성능을 냅니다.

---

## `.class` 파일과 JAR 배포

실무에서는 `.class` 파일 하나가 아니라 여러 클래스를 묶은 **JAR(Java ARchive)** 파일로 배포합니다. JAR는 사실 ZIP 파일이며, 클래스 파일과 리소스, 메타데이터를 담습니다.

```bash
# 여러 .class 파일을 JAR로 묶기
jar cf myapp.jar -C build/classes .

# 실행 가능한 Uber JAR (maven-shade-plugin 등으로 생성)
java -jar myapp.jar

# 특정 클래스 실행
java -cp myapp.jar com.example.Main
```

JAR 하나만 복사해 `java -jar`로 실행하면 끝입니다. Windows 머신에서 만든 JAR를 Linux 서버에 올려 그대로 실행할 수 있습니다. WORA의 실용적인 모습입니다.

---

## WORA의 실제 한계

WORA가 100% 완벽하지는 않습니다. 실무에서는 다음과 같은 상황에서 플랫폼 차이를 경험합니다.

### 파일 시스템과 경로 구분자

Windows는 `\`, Unix 계열은 `/`를 경로 구분자로 씁니다. `File.separator`나 `Path` API를 쓰면 해결됩니다.

```java
// 잘못된 방법 — Windows에서 실패할 수 있음
File f = new File("data/input.txt");

// 올바른 방법 — 플랫폼 독립적
Path p = Path.of("data", "input.txt");
```

### 줄 끝 문자 (Line Ending)

Windows는 `\r\n`, Unix는 `\n`을 사용합니다. 텍스트 파일을 직접 다룰 때 문제가 됩니다.

```java
// 시스템 줄 끝 문자 사용
String newLine = System.lineSeparator();
```

### 네이티브 코드(JNI/JNA)

JNI(Java Native Interface)나 JNA를 통해 플랫폼별 네이티브 라이브러리(`.dll`, `.so`, `.dylib`)를 호출하는 경우, 해당 부분은 플랫폼에 묶입니다. 예를 들어 암호화 하드웨어 가속이나 GPU 직접 접근이 이런 경우입니다.

### GUI 렌더링 차이

Swing이나 JavaFX로 만든 UI는 플랫폼의 네이티브 렌더링 엔진에 따라 폰트, 픽셀 밀도, 기본 색상이 달라 보일 수 있습니다.

### 인코딩과 Locale

`Charset.defaultCharset()`은 플랫폼마다 다릅니다. 한국 Windows에서는 EUC-KR이 기본일 수 있습니다. 문자열을 바이트로 변환할 때는 항상 명시적으로 `StandardCharsets.UTF_8`을 지정하세요.

```java
// 반드시 명시적 인코딩 지정
byte[] bytes = str.getBytes(StandardCharsets.UTF_8);
String text = new String(bytes, StandardCharsets.UTF_8);
```

---

## 현대의 WORA: 컨테이너와 네이티브 이미지

오늘날 서버 배포에서는 WORA의 의미가 약간 달라졌습니다.

### 컨테이너(Docker)

Docker 컨테이너는 JVM이 포함된 Linux 환경을 캡슐화합니다. `java -jar myapp.jar`를 `CMD`로 지정한 이미지를 만들면, Docker가 동작하는 어느 환경에서나(Linux, macOS, Windows + WSL2) 동일하게 실행됩니다.

```dockerfile
FROM eclipse-temurin:21-jre-jammy
COPY myapp.jar /app/myapp.jar
ENTRYPOINT ["java", "-jar", "/app/myapp.jar"]
```

### GraalVM 네이티브 이미지

GraalVM의 AOT(Ahead-Of-Time) 컴파일러는 Java 바이트코드를 플랫폼 네이티브 실행 파일로 변환합니다. 이는 WORA를 포기하는 대신 빠른 시작 시간과 낮은 메모리 사용을 얻는 트레이드오프입니다. 마이크로서비스와 서버리스 환경에서 주목받고 있습니다.

---

## 정리

- WORA는 **바이트코드 + JVM 추상화**로 실현되었습니다.
- `javac`가 `.java` → `.class` 바이트코드를 생성하고, 플랫폼별 JVM이 이를 실행합니다.
- 현대 JVM은 JIT 컴파일로 네이티브에 가까운 성능을 냅니다.
- 파일 경로, 줄 끝 문자, 네이티브 라이브러리 등에서 플랫폼 차이가 생길 수 있습니다.
- 컨테이너와 GraalVM 네이티브 이미지는 현대 배포 환경에서 WORA를 보완하거나 대체합니다.

---

**지난 글:** [Java LTS와 릴리즈 사이클](/posts/java-lts-release-cycle/)

**다음 글:** [JDK 벤더 배포판 완전 가이드](/posts/java-vendors/)

<br>
읽어주셔서 감사합니다. 😊
