---
title: "Gradle 기초 — build.gradle과 태스크"
description: "스프링 신규 프로젝트의 표준이 된 Gradle의 Kotlin DSL 문법, 태스크 시스템, 증분 빌드 원리를 실용적으로 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["spring", "gradle", "build", "kotlin-dsl", "task"]
featured: false
draft: false
---

[지난 글](/posts/spring-maven-basics/)에서 Maven의 pom.xml과 라이프사이클을 살펴봤습니다. 이번 글에서는 같은 역할을 하면서도 다른 방식으로 접근하는 **Gradle**을 정리합니다. Gradle은 신규 스프링 프로젝트에서 사실상 표준이 되었고, Spring Initializr도 기본 선택지로 Gradle을 제시합니다.

## Maven과 Gradle의 핵심 차이

Maven과 Gradle의 근본적인 차이는 **선언적 vs 명령형**입니다.

Maven의 pom.xml은 "어떤 상태여야 한다"를 XML로 선언합니다. 개발자가 직접 로직을 짤 수 없고, Maven이 미리 정해둔 라이프사이클 안에서만 움직입니다.

Gradle의 build.gradle.kts는 **Kotlin(또는 Groovy) 코드**입니다. 조건문, 루프, 함수를 써서 빌드 로직을 직접 제어할 수 있습니다.

```kotlin
// Gradle에서는 이런 로직이 가능
tasks.withType<Test> {
    if (System.getenv("CI") == "true") {
        maxParallelForks = 4
    }
}
```

XML에서는 불가능한 동적 설정입니다.

## Gradle 설치와 Wrapper

Gradle 자체를 설치할 필요는 없습니다. **Gradle Wrapper**를 사용하면 됩니다. Spring Initializr에서 생성된 프로젝트에는 이미 Wrapper가 포함되어 있습니다.

```
my-project/
├── gradlew          ← Linux/macOS 실행 스크립트
├── gradlew.bat      ← Windows 실행 스크립트
└── gradle/
    └── wrapper/
        ├── gradle-wrapper.jar
        └── gradle-wrapper.properties
```

`gradle-wrapper.properties`에 사용할 Gradle 버전이 지정됩니다.

```properties
# gradle-wrapper.properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

Wrapper 버전 업그레이드:

```bash
$ ./gradlew wrapper --gradle-version 8.8 --distribution-type bin
```

## build.gradle.kts 구조

스프링 부트 프로젝트의 `build.gradle.kts` 전체 구조:

![build.gradle.kts 구조](/assets/posts/spring-gradle-build-script.svg)

실제 파일 예시:

```kotlin
// build.gradle.kts — 스프링 부트 3.x 기준
plugins {
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.4"
    java
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    runtimeOnly("com.h2database:h2")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

### plugins 블록

`plugins {}` 블록은 Gradle 플러그인을 선언합니다. 스프링 부트 프로젝트에서 필수적인 두 플러그인:

- `org.springframework.boot`: `bootJar`, `bootRun` 태스크 제공
- `io.spring.dependency-management`: Spring BOM 기반 버전 자동 관리

```kotlin
plugins {
    id("org.springframework.boot") version "3.3.0"
    // 이 플러그인 덕분에 하위 dependencies에서 버전 생략 가능
    id("io.spring.dependency-management") version "1.1.4"
    java
}
```

### dependencies 블록과 Configuration(scope)

Gradle의 의존성은 **Configuration**이라는 개념으로 scope를 구분합니다.

```kotlin
dependencies {
    // 스프링 웹 MVC (컴파일 + 런타임)
    implementation("org.springframework.boot:spring-boot-starter-web")

    // Lombok: 컴파일 시에만 사용되는 어노테이션 처리
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // H2: 런타임에만 필요한 인메모리 DB
    runtimeOnly("com.h2database:h2")

    // JUnit 5, Mockito 포함 (테스트 시에만)
    testImplementation("org.springframework.boot:spring-boot-starter-test")

    // 테스트 런타임에만 필요한 경우
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
```

## Gradle 태스크 시스템

Gradle의 빌드 단위는 **태스크(Task)** 입니다. Maven의 단계(phase)와 비슷하지만, Gradle은 태스크 간 의존성을 그래프(DAG: Directed Acyclic Graph)로 관리합니다.

![Gradle 태스크 의존성 DAG](/assets/posts/spring-gradle-task-dag.svg)

### 주요 태스크

```bash
# 코드 컴파일
$ ./gradlew compileJava

# 테스트 실행
$ ./gradlew test

# 실행 가능한 JAR 생성 (target에 해당하는 build/libs/ 에 생성)
$ ./gradlew bootJar

# 앱 실행 (개발 중)
$ ./gradlew bootRun

# 전체 빌드 (컴파일 + 테스트 + JAR)
$ ./gradlew build

# 빌드 산출물 삭제
$ ./gradlew clean

# clean + build 합치기
$ ./gradlew clean build

# 테스트 건너뛰기
$ ./gradlew build -x test

# 의존성 트리 출력
$ ./gradlew dependencies --configuration compileClasspath
```

### 커스텀 태스크

```kotlin
// build.gradle.kts에 커스텀 태스크 추가
tasks.register("printVersion") {
    doLast {
        println("Project version: $version")
    }
}

// JAR 생성 후 자동으로 실행되는 태스크
tasks.register("copyJar") {
    dependsOn(tasks.bootJar)
    doLast {
        copy {
            from(tasks.bootJar.get().archiveFile)
            into("/opt/deploy/")
        }
    }
}
```

## 증분 빌드와 빌드 캐시

Gradle의 최대 강점은 **증분 빌드(Incremental Build)** 입니다. 변경이 없는 태스크는 재실행하지 않고 `UP-TO-DATE` 표시와 함께 건너뜁니다.

```bash
# 첫 번째 빌드
$ ./gradlew build
> Task :compileJava
> Task :processResources
> Task :classes
> Task :bootJar
> Task :build
BUILD SUCCESSFUL in 8s

# 변경 없이 두 번째 빌드
$ ./gradlew build
> Task :compileJava UP-TO-DATE
> Task :processResources UP-TO-DATE
> Task :classes UP-TO-DATE
> Task :bootJar UP-TO-DATE
> Task :build UP-TO-DATE
BUILD SUCCESSFUL in 0s
```

두 번째 빌드는 거의 즉시 완료됩니다. CI/CD 환경에서는 **빌드 캐시(Build Cache)** 를 활성화하면 서버 간에도 캐시를 공유할 수 있습니다.

```kotlin
// settings.gradle.kts
buildCache {
    local {
        isEnabled = true
    }
    remote<HttpBuildCache> {
        url = uri("https://build-cache.company.com/cache/")
        isPush = System.getenv("CI") == "true"
    }
}
```

## 멀티 모듈 프로젝트

대규모 스프링 프로젝트는 여러 모듈로 나뉩니다. Gradle은 멀티 모듈 구성을 잘 지원합니다.

```
my-project/
├── settings.gradle.kts    ← 모듈 목록
├── build.gradle.kts       ← 공통 설정
├── api/
│   └── build.gradle.kts
├── service/
│   └── build.gradle.kts
└── common/
    └── build.gradle.kts
```

```kotlin
// settings.gradle.kts
rootProject.name = "my-project"
include("api", "service", "common")
```

```kotlin
// api/build.gradle.kts
dependencies {
    // 같은 프로젝트의 common 모듈 참조
    implementation(project(":common"))
}
```

## Groovy DSL vs Kotlin DSL

Gradle은 두 가지 DSL을 지원합니다.

| 구분 | Groovy DSL | Kotlin DSL |
|------|-----------|------------|
| 파일명 | `build.gradle` | `build.gradle.kts` |
| IDE 자동완성 | 제한적 | 완전 지원 |
| 타입 안전성 | 동적 타입 | 정적 타입 |
| 마이그레이션 | - | Groovy에서 전환 가능 |

신규 프로젝트라면 **Kotlin DSL**(`build.gradle.kts`)을 선택하세요. IDE 자동완성과 타입 검사 덕분에 오탈자 실수가 줄어듭니다.

## 정리

Gradle의 핵심은 세 가지입니다. 코드(Kotlin/Groovy)로 빌드를 기술하고, 태스크 그래프로 의존성을 관리하며, 증분 빌드와 캐시로 속도를 확보합니다. Maven의 XML보다 간결하고 강력하지만, 처음엔 낯선 DSL 문법이 진입 장벽이 됩니다. 이 시리즈의 예제는 모두 Gradle Kotlin DSL 기준으로 작성됩니다. 다음 글에서는 의존성 관리의 세부 사항(scope, transitive, BOM)을 더 깊이 파봅니다.

---

**지난 글:** [Maven 기초 — pom.xml과 라이프사이클](/posts/spring-maven-basics/)

**다음 글:** [의존성 관리 — scope, transitive, BOM](/posts/spring-dependency-management/)

<br>
읽어주셔서 감사합니다. 😊
