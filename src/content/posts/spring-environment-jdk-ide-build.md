---
title: "JDK·IDE·빌드도구 한눈에 — 스프링 개발 환경 구축"
description: "스프링 개발을 시작하기 전에 갖춰야 할 JDK, IDE, 빌드도구 선택 기준과 설치 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["spring", "jdk", "ide", "maven", "gradle", "sdkman"]
featured: false
draft: false
---

[지난 글](/posts/spring-history/)에서 스프링이 1.x XML 시대부터 6.x에 이르기까지 어떻게 진화했는지 살펴봤습니다. 이제 실제로 코드를 작성할 준비를 해야 할 시간입니다. 첫 번째 스프링 프로젝트를 실행하기 전에 JDK, IDE, 빌드 도구라는 세 가지 선택을 해야 합니다. 이 글에서 각각의 선택 기준과 설치 방법을 정리합니다.

## JDK 선택 — 21을 권장하는 이유

자바 생태계에는 수십 종의 JDK 배포판이 존재합니다. OpenJDK, Temurin(Eclipse Adoptium), GraalVM, Corretto(Amazon), Liberica, Zulu(Azul) 등 이름만 들어도 머리가 복잡해집니다. 하지만 배포판 선택보다 **버전 선택**이 더 중요합니다.

**LTS(Long-Term Support)** 버전만 사용하세요. 비-LTS 버전은 6개월 후 지원이 끊깁니다.

| 버전 | LTS | Spring Boot | 지원 종료 |
|------|-----|-------------|-----------|
| JDK 8 | ✓ | 2.7.x까지 | 2030년 |
| JDK 11 | ✓ | 2.7.x까지 | 2032년 |
| JDK 17 | ✓ | **3.x 최소 요구** | 2029년 |
| JDK 21 | ✓ | **3.x 권장** | 2031년 |

이 시리즈는 **JDK 21**을 기준으로 합니다. JDK 17이 Spring Boot 3.x의 최소 요구 버전이지만, JDK 21에서는 **가상 스레드(Project Loom)** 와 **레코드 패턴**, **시퀀스드 컬렉션** 같은 유용한 기능이 추가됩니다.

![JDK 버전 선택 가이드](/assets/posts/spring-environment-jdk-versions.svg)

## JDK 설치 — SDKMAN 활용

**SDKMAN**은 여러 JDK 버전을 프로젝트별로 전환할 수 있는 버전 관리자입니다. macOS, Linux에서 강력히 권장합니다. Windows에서는 `winget` 또는 직접 설치를 사용합니다.

```bash
# SDKMAN 설치 (macOS/Linux)
$ curl -s "https://get.sdkman.io" | bash
$ source "$HOME/.sdkman/bin/sdkman-init.sh"

# 사용 가능한 JDK 목록 확인
$ sdk list java | grep -E "21.*tem"

# Temurin JDK 21 설치
$ sdk install java 21.0.3-tem

# 설치된 버전 확인
$ java -version
# openjdk version "21.0.3" 2024-04-16
```

프로젝트 디렉토리마다 다른 JDK 버전을 사용하고 싶다면:

```bash
# 프로젝트 루트에 .sdkmanrc 파일 생성
$ echo "java=21.0.3-tem" > .sdkmanrc

# 이후 이 디렉토리에 들어오면 자동으로 JDK 21로 전환
$ sdk env
```

Windows에서는 **Winget**이나 **Temurin 공식 인스톨러**를 사용합니다.

```powershell
# Windows — winget으로 설치
> winget install EclipseAdoptium.Temurin.21.JDK

# JAVA_HOME 환경 변수 설정 (시스템 환경 변수)
# C:\Program Files\Eclipse Adoptium\jdk-21.0.3.9-hotspot
```

## IDE 선택

### IntelliJ IDEA — 사실상 표준

스프링 개발에서 **IntelliJ IDEA**가 사실상 표준입니다. JetBrains가 개발했으며 Community 에디션은 무료입니다.

| 에디션 | 가격 | 스프링 지원 |
|--------|------|------------|
| Community | 무료 | 기본 자바 + 스프링 코어 |
| Ultimate | 유료(학생 무료) | Spring Boot DevTools, 내장 DB 뷰어 등 |

학생이라면 Ultimate를 무료로 사용할 수 있습니다(`jetbrains.com/student`). 업무 환경이 아니라면 Community 에디션으로 이 시리즈의 모든 예제를 실행할 수 있습니다.

IntelliJ 설치 후 Spring Boot 프로젝트를 여는 방법:

```
File → Open → build.gradle (또는 pom.xml) 선택
→ "Open as Project" 클릭
→ Gradle/Maven이 자동으로 의존성 다운로드
```

### VS Code — 경량 대안

VS Code에서는 **Extension Pack for Java** + **Spring Boot Extension Pack**을 설치하면 됩니다.

```bash
# VS Code 확장 설치 (CLI)
$ code --install-extension vscjava.vscode-java-pack
$ code --install-extension vmware.vscode-boot-dev-pack
```

### 공통 설정 — 인코딩과 줄 끝 문자

IDE와 무관하게 반드시 설정해야 할 것들:

```
인코딩: UTF-8 (macOS/Linux 기본값, Windows 주의)
줄 끝 문자: LF (UNIX 스타일, Windows는 CRLF가 기본)
```

IntelliJ 기준: `Settings → Editor → File Encodings → UTF-8` 설정, `Settings → Editor → Code Style → Line separator: Unix and macOS (\n)`.

## 빌드 도구 — Maven vs Gradle

스프링 프로젝트에서는 **Maven**과 **Gradle** 두 가지 빌드 도구를 사용합니다.

![Maven vs Gradle 비교](/assets/posts/spring-environment-build-tools.svg)

### Maven

XML 기반의 선언적 빌드 도구입니다. 2004년 등장해 오랫동안 자바 생태계의 표준이었습니다. 설정이 장황하지만 구조가 명확해 처음 배우기 좋습니다.

```xml
<!-- pom.xml — 스프링 부트 프로젝트 최소 구조 -->
<project>
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.0</version>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>my-app</artifactId>
    <version>0.0.1-SNAPSHOT</version>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>
</project>
```

`spring-boot-starter-parent`를 부모로 설정하면 모든 스프링 의존성 버전이 자동으로 관리됩니다. `<version>` 태그를 일일이 쓸 필요가 없습니다.

### Gradle

Groovy 또는 Kotlin DSL 기반의 빌드 도구입니다. Maven보다 빌드 속도가 빠르고 설정이 간결합니다. 신규 프로젝트에는 Gradle(Kotlin DSL)을 권장합니다.

```kotlin
// build.gradle.kts — Kotlin DSL
plugins {
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.4"
    kotlin("jvm") version "1.9.23"
    kotlin("plugin.spring") version "1.9.23"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_21
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    runtimeOnly("com.h2database:h2")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

### Gradle Wrapper — 팀 전체 버전 통일

**Gradle Wrapper**를 사용하면 팀원 모두가 동일한 Gradle 버전을 쓸 수 있습니다. `gradlew`(Linux/Mac), `gradlew.bat`(Windows) 파일이 Wrapper입니다.

```bash
# Wrapper를 통해 빌드 (Gradle 미설치 상태에서도 동작)
$ ./gradlew build

# Gradle 버전 업그레이드
$ ./gradlew wrapper --gradle-version 8.7

# 주요 태스크
$ ./gradlew bootRun      # 앱 실행
$ ./gradlew test         # 테스트 실행
$ ./gradlew bootJar      # 실행 가능한 JAR 생성
$ ./gradlew dependencies # 의존성 트리 출력
```

## 첫 프로젝트 생성 — Spring Initializr

환경이 갖춰졌다면, **Spring Initializr**(`start.spring.io`)에서 프로젝트 뼈대를 만드는 것이 가장 빠릅니다.

```
Project: Gradle - Kotlin
Language: Java
Spring Boot: 3.3.x
Group: com.example
Artifact: demo
Packaging: Jar
Java: 21

Dependencies:
  ✓ Spring Web
  ✓ Spring Data JPA
  ✓ H2 Database
  ✓ Lombok
```

생성 후 압축 해제하고 IntelliJ로 열면 몇 분 안에 실행 준비가 됩니다.

```bash
$ cd demo
$ ./gradlew bootRun
# 2024-xx-xx T... Started DemoApplication in 1.234 seconds
```

## 환경 체크리스트

프로젝트를 시작하기 전에 다음을 확인하세요.

```bash
# JDK 버전 확인
$ java -version
# openjdk version "21.0.3" ...

# Gradle Wrapper 버전 확인
$ ./gradlew --version
# Gradle 8.7

# 프로젝트 빌드 성공 확인
$ ./gradlew build
# BUILD SUCCESSFUL in 30s
```

## 정리

JDK 21(Temurin), IntelliJ IDEA(Community), Gradle(Kotlin DSL) — 이 조합이 현시점 가장 생산적인 스프링 개발 환경입니다. Spring Initializr로 프로젝트를 만들고 `./gradlew bootRun`으로 실행되는 것을 확인하셨다면, 다음 글부터 본격적인 Maven과 Gradle 학습을 시작합니다.

---

**지난 글:** [스프링의 역사 — 1.x XML 시대부터 6.x까지](/posts/spring-history/)

**다음 글:** [Maven 기초 — pom.xml과 라이프사이클](/posts/spring-maven-basics/)

<br>
읽어주셔서 감사합니다. 😊
