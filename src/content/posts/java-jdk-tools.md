---
title: "JDK 내장 도구 완전 정복"
description: "javac, java, jar, javap, jps, jstat, jstack, jcmd 등 JDK bin/ 디렉터리에 포함된 핵심 도구들의 용도와 실전 사용법을 범주별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JDK", "javac", "jar", "jstack", "jcmd", "진단도구"]
featured: false
draft: false
---

[지난 글](/posts/java-install-sdkman/)에서 SDKMAN으로 JDK를 설치하고 버전을 전환하는 방법을 살펴봤습니다. JDK를 설치하면 `bin/` 디렉터리에는 단순히 `javac`와 `java`만 들어 있는 것이 아닙니다. 컴파일, 실행, 패키징, 진단, 모니터링, 보안에 이르기까지 수십 개의 도구가 함께 제공됩니다. 이 도구들을 범주별로 이해해 두면 개발·운영 양쪽에서 생산성이 크게 오릅니다.

## JDK 도구 전체 조망

`$JAVA_HOME/bin/` 아래 도구들은 크게 여섯 범주로 나눌 수 있습니다.

![JDK 주요 도구 분류](/assets/posts/java-jdk-tools-overview.svg)

## 컴파일러 도구

### javac

`.java` 소스 파일을 바이트코드(`.class`)로 컴파일합니다. 가장 자주 쓰는 옵션은 다음과 같습니다.

| 옵션 | 설명 |
|------|------|
| `-d <dir>` | 출력 디렉터리 지정 |
| `-cp` / `-classpath` | 컴파일 시 클래스패스 |
| `--release <N>` | 호환 버전 지정 (예: `--release 17`) |
| `-Xlint:all` | 경고 최대 활성화 |
| `-parameters` | 메서드 파라미터 이름 보존 |

```bash
# src 하위 모든 .java 파일 컴파일 → out/ 으로 출력
javac -d out --release 21 -Xlint:all \
      $(find src -name "*.java")
```

### javap

컴파일된 `.class` 파일을 사람이 읽을 수 있는 바이트코드로 역어셈블합니다. JVM 내부 동작을 이해하거나 라이브러리의 공개 API를 확인할 때 유용합니다.

```bash
# 바이트코드 + 상수 풀 + 로컬 변수 테이블 출력
javap -c -verbose -p out/com/example/Hello.class
```

### jdeps

JAR 또는 클래스 파일의 모듈·패키지 의존성을 분석합니다. 모듈 시스템 마이그레이션 전 내부 API 사용 여부를 점검할 때 필수입니다.

```bash
# 내부 API(JDK 비공개) 사용 여부 확인
jdeps --jdk-internals --multi-release 21 lib/legacy.jar
```

## 실행 도구

### java

JVM 위에서 클래스나 JAR를 실행합니다. Java 11부터는 단일 소스 파일을 컴파일 없이 직접 실행할 수도 있습니다.

```bash
# 클래스 실행
java -cp out com.example.Hello

# 단일 소스 직접 실행 (Java 11+)
java src/com/example/Hello.java

# JVM 플래그와 함께 실행
java -Xmx512m -XX:+UseZGC -jar app.jar
```

### jshell

Java 9에서 도입된 REPL(Read-Eval-Print Loop) 환경입니다. 작은 코드 조각을 실험하거나 API를 빠르게 탐색할 때 유용합니다.

```bash
$ jshell
jshell> var list = List.of(1, 2, 3)
jshell> list.stream().map(n -> n * 2).toList()
$2 ==> [2, 4, 6]
jshell> /exit
```

## 패키징 도구

### jar

클래스 파일과 리소스를 하나의 JAR(Java ARchive) 파일로 묶습니다.

```bash
# 실행 가능한 JAR 생성
jar --create --file=app.jar \
    --main-class=com.example.Hello \
    -C out .

# JAR 목록 확인
jar --list --file=app.jar

# JAR 실행
java -jar app.jar
```

### jlink / jmod

모듈 시스템(Java 9+) 기반으로 커스텀 런타임 이미지를 생성합니다. 컨테이너 이미지 크기를 줄일 때 특히 효과적입니다.

```bash
# 필요한 모듈만 담은 커스텀 JRE 생성
jlink --add-modules java.base,java.logging \
      --output custom-jre \
      --strip-debug \
      --compress=2
```

## 진단 도구

운영 환경에서 JVM 문제를 빠르게 파악하려면 진단 도구 사용법을 알고 있어야 합니다.

![자주 쓰는 JDK 명령어 예시](/assets/posts/java-jdk-tools-commands.svg)

### jps

실행 중인 Java 프로세스 목록을 출력합니다. `-l` 옵션으로 전체 클래스 이름, `-v`로 JVM 인수까지 볼 수 있습니다.

```bash
jps -lv
# 출력 예:
# 12345 com.example.App -Xmx512m -Denv=prod
```

### jstat

GC 활동, 클래스 로딩, JIT 컴파일 통계를 실시간으로 확인합니다.

```bash
# 1초 간격으로 GC 사용률 10회 출력
jstat -gcutil <pid> 1000 10
# S0   S1    E     O     M   CCS  YGC  YGCT  FGC  FGCT  GCT
# 0.00 99.50 23.12 45.80 ...
```

`E`(Eden), `O`(Old), `YGC`(Young GC 횟수) 등을 통해 메모리 누수나 GC 압박을 빠르게 감지할 수 있습니다.

### jstack

특정 프로세스의 모든 스레드 덤프를 출력합니다. 데드락이나 스레드 블로킹 문제 진단에 사용합니다.

```bash
jstack <pid> > thread-dump.txt

# 데드락 감지만
jstack -l <pid> | grep -A 20 "deadlock"
```

### jcmd

하나의 도구로 다양한 JVM 진단 명령을 전송합니다. `jstack`, `jmap`, `jstat`의 기능을 대부분 대체할 수 있는 현대적인 인터페이스입니다.

```bash
# 지원 명령 목록 확인
jcmd <pid> help

# 힙 정보
jcmd <pid> GC.heap_info

# 힙 히스토그램 (상위 20개 클래스)
jcmd <pid> GC.class_histogram | head -25

# Flight Recorder 60초 녹화
jcmd <pid> JFR.start duration=60s filename=recording.jfr

# 강제 GC 실행
jcmd <pid> GC.run
```

### jmap

힙 덤프 파일을 생성합니다. 메모리 누수 분석 시 VisualVM, Eclipse MAT 등과 함께 사용합니다.

```bash
# hprof 형식 힙 덤프 생성
jmap -dump:live,format=b,file=heap.hprof <pid>
```

> **참고**: Java 9 이후 `jmap -dump`는 `jcmd <pid> GC.heap_dump`로 대체 가능하며, 후자가 더 안전합니다.

## 모니터링 도구

### jconsole

JVM 메모리, 스레드, 클래스, MBean을 GUI로 모니터링합니다. JVM 옵션 없이 로컬·원격 프로세스 모두 연결할 수 있습니다.

```bash
# 로컬 프로세스 선택 창 열기
jconsole

# 특정 PID 바로 연결
jconsole <pid>
```

## 보안 도구

### keytool

키스토어를 생성·관리합니다. TLS 인증서, 코드 서명 키 등을 다룰 때 사용합니다.

```bash
# 자체 서명 인증서 생성
keytool -genkeypair -alias myapp \
        -keyalg RSA -keysize 2048 \
        -validity 365 \
        -keystore keystore.jks
```

## 도구 선택 가이드

| 상황 | 권장 도구 |
|------|-----------|
| 실행 중 JVM 프로세스 확인 | `jps -l` |
| GC 압박/메모리 추이 실시간 확인 | `jstat -gcutil` |
| 스레드 블로킹/데드락 | `jstack` 또는 `jcmd … Thread.print` |
| 힙 덤프 생성 | `jcmd … GC.heap_dump` |
| 일반 JVM 진단 (모든 상황) | `jcmd` (통합 권장) |
| 모듈 의존성 마이그레이션 전 점검 | `jdeps --jdk-internals` |
| 커스텀 경량 JRE 생성 | `jlink` |

JDK 도구들은 단독으로도 강력하지만, `jps`로 PID를 찾고 `jstat`으로 GC를 확인한 뒤 `jcmd`로 힙 덤프까지 이어지는 진단 워크플로를 익혀 두면 운영 장애 상황에서 빠르게 원인을 좁힐 수 있습니다.

---

**지난 글:** [SDKMAN으로 JDK 설치하기](/posts/java-install-sdkman/)

**다음 글:** [클래스패스와 모듈패스](/posts/java-classpath-modulepath/)

<br>
읽어주셔서 감사합니다. 😊
