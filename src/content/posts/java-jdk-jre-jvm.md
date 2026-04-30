---
title: "JDK · JRE · JVM — 세 개념의 차이"
description: "Java 개발 환경을 구성하는 세 축인 JDK, JRE, JVM의 역할과 포함 관계를 명확히 이해하고, 각 구성 요소가 소스 코드 실행에서 어떤 역할을 담당하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["java", "jdk", "jre", "jvm", "bytecode", "javac", "class-loader", "jit"]
featured: false
draft: false
---

[지난 글](/posts/java-vendors/)에서 Eclipse Temurin, Amazon Corretto, Oracle JDK 등 다양한 JDK 배포판의 특징과 선택 기준을 살펴봤습니다. 이번에는 한 발 더 들어가서 JDK 내부를 구성하는 세 개념 — JDK, JRE, JVM — 이 서로 어떤 관계이고 각각 무슨 일을 담당하는지 정리합니다. 처음 Java를 배울 때 혼동하기 쉬운 개념이지만, 한 번 명확히 이해해두면 이후 JVM 튜닝이나 실행 환경 설정에서 큰 도움이 됩니다.

---

## 세 개념의 포함 관계

JDK, JRE, JVM은 서로 별개가 아니라 **중첩된 구조(포함 관계)** 입니다.

```
JDK (Java Development Kit)
├── 개발 도구: javac, javadoc, jar, jshell, jlink …
└── JRE (Java Runtime Environment)
    ├── 표준 라이브러리: java.base, java.util, java.io …
    └── JVM (Java Virtual Machine)
        ├── Class Loader Subsystem
        ├── Runtime Data Areas (Heap, Stack, Method Area …)
        ├── Execution Engine (Interpreter + JIT Compiler)
        ├── Garbage Collector
        └── Native Method Interface (JNI)
```

**JDK ⊃ JRE ⊃ JVM** — 개발 도구(JDK)가 가장 큰 상자이고, 그 안에 실행 환경(JRE)이 들어 있으며, 실행 환경의 핵심 엔진이 JVM입니다.

![JDK · JRE · JVM 구조](/assets/posts/java-jdk-jre-jvm-architecture.svg)

---

## JVM — 플랫폼 독립성의 비밀

**JVM(Java Virtual Machine)** 은 Java 바이트코드(`.class` 파일)를 읽어 현재 운영체제와 CPU에 맞는 명령으로 번역·실행하는 **가상 기계**입니다. 운영체제마다 JVM이 따로 구현되어 있기 때문에, 바이트코드는 어느 플랫폼에서도 동일하게 동작합니다 — Write Once, Run Anywhere의 핵심입니다.

JVM은 다음 세 가지 핵심 서브시스템으로 이루어집니다.

### Class Loader Subsystem

`.class` 파일을 JVM 메모리에 **로드 → 링크 → 초기화**하는 세 단계를 담당합니다. 우리가 `java MyApp`을 실행하면 가장 먼저 이 서브시스템이 동작합니다.

```java
// 런타임 동적 로딩 예시
Class<?> clazz = Class.forName("com.example.MyService");
// Class.forName() 내부에서 ClassLoader.loadClass()가 호출됨
Object instance = clazz.getDeclaredConstructor().newInstance();
```

### Runtime Data Areas

JVM이 사용하는 메모리 영역입니다. 주요 영역은 다음과 같습니다.

| 영역 | 특징 | 공유 범위 |
|---|---|---|
| **Heap** | 객체·배열 저장, GC 대상 | 모든 스레드 공유 |
| **Method Area** | 클래스 메타데이터, static 변수 | 모든 스레드 공유 |
| **JVM Stack** | 메서드 호출 프레임, 지역 변수 | 스레드별 독립 |
| **PC Register** | 현재 실행 중인 명령 주소 | 스레드별 독립 |
| **Native Method Stack** | 네이티브(C/C++) 메서드 실행 | 스레드별 독립 |

### Execution Engine

바이트코드를 실제로 실행합니다. 두 가지 방식을 병용합니다.

- **Interpreter**: 바이트코드를 한 줄씩 해석해 실행. 시작이 빠르지만 반복 실행 시 느림.
- **JIT(Just-In-Time) Compiler**: 자주 실행되는 핫(hot) 메서드를 네이티브 코드로 컴파일해 캐싱. 이후 호출은 C/C++ 수준 속도로 동작.

```
첫 100번: Interpreter로 실행
이후: JIT 컴파일된 네이티브 코드로 실행 → 수십 배 빠름
```

---

## JRE — 실행에 필요한 모든 것

**JRE(Java Runtime Environment)** 는 JVM과 **표준 라이브러리(Java SE API)**를 합친 패키지입니다. `String`, `List`, `InputStream` 같은 클래스들이 모두 JRE의 표준 라이브러리에 포함됩니다.

JDK 8까지는 JRE를 JDK와 별도로 배포했습니다. 개발자는 JDK를 쓰고, 최종 사용자는 JRE만 설치하는 구조였습니다. **JDK 11부터 JRE 단독 패키지 제공이 중단**되었고, JDK 하나로 개발과 실행을 모두 처리합니다.

> **`jlink`로 경량 런타임 만들기**: JDK 11+에서는 `jlink` 명령으로 애플리케이션에 필요한 모듈만 선택해 맞춤형 JRE를 만들 수 있습니다. Docker 이미지 크기를 줄이는 데 활용됩니다.

```bash
# java.base + java.logging 모듈만 포함한 경량 런타임 생성
jlink \
  --module-path "$JAVA_HOME/jmods" \
  --add-modules java.base,java.logging \
  --output /opt/custom-jre \
  --compress=2

# 생성된 런타임 크기 확인
du -sh /opt/custom-jre   # 일반 JDK 수백 MB → 수십 MB
```

---

## JDK — 개발 도구 집합

**JDK(Java Development Kit)** 는 JRE에 컴파일러와 각종 개발 도구를 추가한 패키지입니다. 서버나 CI 환경 모두에서 JDK를 설치하는 것이 일반적입니다.

![JDK 주요 도구와 바이트코드 실행 흐름](/assets/posts/java-jdk-jre-jvm-tools.svg)

JDK의 핵심 도구들을 카테고리별로 정리하면 다음과 같습니다.

### 개발·빌드

```bash
# 컴파일
javac -source 21 -target 21 src/Main.java -d out/

# JAR 생성
jar --create --file app.jar --main-class=Main -C out/ .

# API 문서 생성
javadoc -d docs/ src/Main.java

# REPL (대화형 셸, JDK 9+)
jshell
```

### 진단·프로파일링

```bash
# 실행 중인 JVM 프로세스 목록
jps -l

# JVM 플래그·힙 정보 등 진단 명령 전송
jcmd <pid> VM.flags
jcmd <pid> GC.heap_info

# 스레드 덤프 (데드락 분석에 필수)
jstack <pid>

# 힙 덤프 (메모리 누수 분석)
jmap -dump:format=b,file=heap.hprof <pid>

# Flight Recorder 시작 (JDK 11+, 무료 사용 가능)
jcmd <pid> JFR.start duration=60s filename=recording.jfr
```

### 패키징 (JDK 9+)

```bash
# 모듈 기반 링킹
jlink --module-path $JAVA_HOME/jmods \
      --add-modules java.base,java.net.http \
      --output dist/

# 네이티브 인스톨러 생성 (JDK 14+)
jpackage --name MyApp --input out/ --main-jar app.jar
```

---

## 소스 코드가 실행되기까지

Java 프로그램이 실행되는 과정을 단계별로 따라가 봅니다.

```
1. 개발자 작성:  Hello.java (소스 코드)
2. javac 컴파일: Hello.class (바이트코드, 플랫폼 무관)
3. java 실행:    JVM 시작 → Class Loader가 Hello.class 메모리에 로드
4. 바이트코드 실행: Interpreter가 한 줄씩 해석
5. JIT 최적화:   핫 메서드 → 네이티브 코드 컴파일 → 캐시
6. GC:           불필요한 객체를 Heap에서 자동 회수
```

```java
// Hello.java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

```bash
# 1단계: 컴파일
javac Hello.java
# → Hello.class 생성

# 2단계: 실행
java Hello
# → Hello, World!

# 바이트코드 확인 (디스어셈블)
javap -c Hello
# public static void main(java.lang.String[]);
#   Code:
#      0: getstatic  #7  // Field java/lang/System.out
#      3: ldc        #13 // String "Hello, World!"
#      5: invokevirtual #15 // Method println
#      8: return
```

`javap -c`가 보여주는 것이 **바이트코드(bytecode)** 입니다. JVM은 이 명령들을 해석해 실행합니다.

---

## JAVA_HOME과 PATH 설정

JDK를 수동으로 설치할 때 환경 변수 설정이 필요합니다.

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export PATH="$JAVA_HOME/bin:$PATH"

# 적용 후 확인
source ~/.bashrc
java -version
javac -version
echo $JAVA_HOME
```

여러 JDK 버전을 동시에 사용한다면 `JAVA_HOME`을 매번 수정하는 것보다 **SDKMAN** 같은 버전 관리 도구를 사용하는 것이 훨씬 편리합니다 — 다음 글에서 자세히 다룹니다.

---

## JDK 11+ 달라진 점 요약

| 항목 | JDK 8 이전 | JDK 11+ |
|---|---|---|
| 배포 형태 | JDK + JRE 별도 | JDK 단일 패키지 |
| 경량 런타임 | 없음 | `jlink`로 직접 생성 |
| Flight Recorder | 상업용 Oracle JDK 전용 | 모든 배포판 무료 |
| REPL | 없음 | `jshell` 포함 |
| 모듈 시스템 | 없음 (클래스패스만) | JPMS 도입 (JDK 9+) |

---

## 정리

- **JVM**: 바이트코드를 OS·CPU에 맞게 번역·실행하는 가상 기계. Class Loader, Runtime Data Areas, Execution Engine으로 구성.
- **JRE**: JVM + 표준 라이브러리. JDK 11부터 단독 패키지 없음.
- **JDK**: JRE + 개발 도구(javac, jar, jshell, jlink 등). 개발·운영 환경 모두에 설치하면 됩니다.
- **바이트코드**가 플랫폼 독립성을 가능하게 하고, **JIT 컴파일러**가 런타임 성능을 네이티브 수준으로 끌어올립니다.

---

**지난 글:** [JDK 벤더 배포판 완전 가이드](/posts/java-vendors/)

**다음 글:** [SDKMAN으로 JDK 설치하기](/posts/java-install-sdkman/)

<br>
읽어주셔서 감사합니다. 😊
