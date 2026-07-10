---
title: "Gradle 입문 — 유연한 빌드 자동화"
description: "Gradle은 선언형과 명령형을 결합한 빌드 도구입니다. Task DAG, Kotlin DSL, Gradle Wrapper, 증분 빌드와 빌드 캐시까지 — Maven과 다른 Gradle의 핵심 개념과 기본 사용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "Gradle", "빌드", "Kotlin DSL", "빌드 자동화"]
featured: false
draft: false
---

[지난 글](/posts/java-maven-plugins/)에서 Maven의 플러그인 구조와 pom.xml 설정 방식을 살펴봤습니다. Maven이 XML 기반의 선언형 설정으로 표준화된 빌드를 제공한다면, **Gradle**은 "빌드 스크립트도 코드다"라는 철학으로 훨씬 유연하면서도 강력한 빌드 자동화를 추구합니다. 2012년 처음 등장해 현재는 Android 공식 빌드 도구이자 Java·Kotlin 생태계에서 Maven과 양대 산맥을 이루고 있습니다.

## Gradle이란

Gradle은 **선언형(declarative) + 명령형(imperative)** 빌드 언어입니다. Maven처럼 `<dependency>`를 나열하는 선언형 방식도 쓰지만, 조건 분기나 반복 같은 일반 프로그래밍 코드도 빌드 스크립트 안에서 직접 쓸 수 있습니다. 복잡한 빌드 로직을 pom.xml 대신 읽기 쉬운 코드로 표현할 수 있다는 것이 가장 큰 장점입니다.

## Groovy DSL vs Kotlin DSL

Gradle 빌드 스크립트는 두 가지 언어로 작성할 수 있습니다.

- **Groovy DSL** (`build.gradle`): 동적 타이핑의 간결한 문법. Gradle이 오랫동안 사용해 온 전통 방식이며 기존 예제 코드의 대부분이 이 형식입니다.
- **Kotlin DSL** (`build.gradle.kts`): 정적 타이핑으로 **IDE 자동완성과 타입 안전성**이 뛰어납니다. Gradle 공식 문서가 Kotlin DSL을 기본으로 제시하며, 신규 프로젝트에서 권장됩니다.

두 DSL은 문법만 다를 뿐 기능적으로 동등하므로, 이 글에서는 Kotlin DSL 기준으로 설명합니다.

## Task Graph (DAG)

![Gradle 빌드 흐름 — Task DAG](/assets/posts/java-build-gradle-overview.svg)

Maven이 라이프사이클의 선형 단계를 따라 실행한다면, Gradle은 **Task들의 의존 그래프(DAG, Directed Acyclic Graph)** 를 구성해 실행합니다. `./gradlew build`를 실행하면 Gradle은 다음 과정을 거칩니다.

1. **구성(Configuration) 단계**: 빌드 스크립트를 평가하고 Task들의 의존 관계를 DAG로 구성합니다.
2. **실행(Execution) 단계**: DAG를 위상 정렬(topological sort)해 올바른 순서로 Task를 실행합니다.

예를 들어 `build` Task는 `test`에 의존하고, `test`는 `compileJava`에 의존합니다. 따라서 `compileJava → test → jar` 순서가 자동으로 결정됩니다. 이 구조 덕분에 커스텀 Task를 기존 Task 사이에 자연스럽게 끼워 넣을 수 있습니다.

## 핵심 플러그인: java와 application

Gradle도 플러그인으로 기능을 확장합니다. Java 프로젝트에 가장 기본적인 두 플러그인은 다음과 같습니다.

- **`java`**: `compileJava`, `test`, `jar` 등의 기본 Task와 소스셋(sourceSets) 설정을 추가합니다.
- **`application`**: `run` Task를 추가하고 실행 가능한 배포 패키지를 생성하는 기능을 제공합니다.

## dependencies 블록과 구성(Configuration)

Gradle에서 의존성은 **구성(Configuration)** 이라는 버킷에 할당합니다. 대표적인 구성은 다음과 같습니다.

| 구성 | 역할 |
|---|---|
| `implementation` | 컴파일 + 런타임 의존성. 소비자 모듈에 노출되지 않음 |
| `api` | `implementation`과 같으나 소비자 모듈에도 노출 (java-library 플러그인 필요) |
| `testImplementation` | 테스트 코드에서만 사용 |
| `compileOnly` | 컴파일 시에만 필요, 런타임 클래스패스에 포함되지 않음 |
| `runtimeOnly` | 런타임에만 필요, 컴파일 클래스패스에 없음 |

`implementation`을 기본으로 쓰고, 라이브러리를 만들 때 공개 API에 포함해야 하는 의존성에만 `api`를 사용하는 것이 권장 패턴입니다. Maven의 `<scope>compile`이 `implementation`에 해당하고, `<scope>test`가 `testImplementation`에 해당한다고 보면 됩니다.

## Gradle Wrapper

프로젝트 루트에 있는 `gradlew` (Linux/Mac) 또는 `gradlew.bat` (Windows)가 **Gradle Wrapper**입니다. Wrapper는 로컬에 Gradle이 설치되어 있지 않아도 `gradle/wrapper/gradle-wrapper.properties`에 지정된 버전을 자동으로 내려받아 실행합니다.

```bash
# Wrapper를 통해 빌드 (권장 — CI/CD에서도 이 방식 사용)
./gradlew build

# 테스트만 실행
./gradlew test

# 애플리케이션 실행 (application 플러그인 필요)
./gradlew run

# 사용 가능한 Task 목록 확인
./gradlew tasks
```

Wrapper 덕분에 "내 컴퓨터에서는 되는데 CI에서 안 된다"는 Gradle 버전 불일치 문제를 없앨 수 있습니다. `gradlew` 파일과 `gradle/wrapper/` 디렉터리는 반드시 Git에 커밋해야 합니다.

## 최소 build.gradle.kts 예제

아래는 Java 애플리케이션을 위한 가장 기본적인 Kotlin DSL 설정입니다.

```kotlin
plugins {
    java
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.google.guava:guava:32.1.3-jre")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
    mainClass = "com.example.App"
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

Maven의 pom.xml보다 훨씬 짧습니다. Kotlin DSL이기 때문에 IDE에서 `plugins {`나 `dependencies {` 블록 안에서 자동완성이 작동하고, 오타는 컴파일 에러로 즉시 잡힙니다.

![build.gradle.kts 구조](/assets/posts/java-build-gradle-deps.svg)

## 증분 빌드 · 빌드 캐시 · Daemon

Gradle이 Maven보다 빠르다고 알려진 이유는 세 가지 최적화 덕분입니다.

**증분 빌드(Incremental Build)**  
각 Task는 입력(소스 파일, 설정 값)과 출력(클래스 파일, JAR)을 추적합니다. 이전 빌드 이후 입출력이 변하지 않았다면 해당 Task는 `UP-TO-DATE`로 표시되고 실행을 건너뜁니다. 변경된 파일에만 영향받는 Task만 다시 실행됩니다.

**빌드 캐시(Build Cache)**  
증분 빌드가 "이 기계에서 전에 한 작업"을 재사용한다면, 빌드 캐시는 입력의 해시값을 키로 로컬 혹은 원격 캐시에서 출력을 가져옵니다. 다른 개발자나 CI 서버가 동일한 입력으로 빌드한 결과를 공유할 수 있어, 클린 빌드도 빠릅니다. `FROM-CACHE`로 표시된 Task가 캐시 히트입니다.

**Gradle Daemon**  
`./gradlew` 명령을 처음 실행하면 백그라운드에 JVM 프로세스(Daemon)가 남습니다. 다음 빌드부터는 이 Daemon을 재사용해 JVM 기동 비용과 클래스 로딩 비용을 절약합니다. Daemon은 3시간 동안 사용하지 않으면 자동 종료됩니다. 로컬 개발 환경에서 반복 빌드 시간을 크게 줄여 줍니다.

## Maven과 비교하면

| 항목 | Maven | Gradle |
|---|---|---|
| 설정 형식 | XML (pom.xml) | Groovy/Kotlin DSL |
| 빌드 모델 | 선형 라이프사이클 | Task DAG |
| 확장성 | 플러그인만 | 플러그인 + 스크립트 코드 |
| 증분 빌드 | 제한적 | 강력 (입출력 추적) |
| 빌드 캐시 | 없음 | 로컬 + 원격 캐시 |
| 학습 곡선 | 낮음 (선언형) | 중간 (DSL 학습 필요) |
| Android 지원 | 미지원 | 공식 빌드 도구 |

Maven은 표준화되어 있어 새로 배우기 쉽고, 엔터프라이즈 Java 생태계에서 오랜 기간 검증됐습니다. Gradle은 대형 프로젝트에서 빌드 시간 절약 효과가 크고, 복잡한 빌드 요구사항을 코드로 표현할 수 있다는 강점이 있습니다. 프로젝트의 규모와 팀의 익숙함에 따라 선택하되, Kotlin DSL로 시작하면 IDE 지원 덕분에 학습 곡선을 많이 낮출 수 있습니다.

## 정리

Gradle은 Task DAG, 증분 빌드, 빌드 캐시, Daemon이라는 네 가지 메커니즘으로 빠르고 유연한 빌드를 제공합니다. `build.gradle.kts`의 Kotlin DSL은 타입 안전한 방식으로 의존성과 Task를 선언하게 해 주고, Gradle Wrapper는 팀 전체에 동일한 빌드 환경을 보장합니다. Maven의 선언형 단순함도 좋지만, 빌드 속도와 유연성이 중요해지는 시점에 Gradle을 고려해 보시기 바랍니다.

---

**지난 글:** [Maven 플러그인 — 빌드를 확장하는 법](/posts/java-maven-plugins/)

**다음 글:** [Gradle Task — 빌드의 최소 실행 단위](/posts/java-gradle-tasks/)

<br>
읽어주셔서 감사합니다. 😊
