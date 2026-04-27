---
title: "의존성 관리 — scope, transitive, BOM"
description: "스프링 프로젝트에서 의존성 관리의 핵심인 scope 분류, 전이 의존성 충돌 해결, BOM 활용법을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["spring", "dependency", "maven", "gradle", "bom", "transitive"]
featured: false
draft: false
---

[지난 글](/posts/spring-gradle-basics/)에서 Gradle의 태스크 시스템과 증분 빌드를 살펴봤습니다. Maven과 Gradle 모두 의존성 선언 방식에서 `scope`라는 개념을 사용합니다. 이 글에서는 의존성 관리의 세 가지 핵심인 scope, 전이 의존성, BOM을 정리합니다. 이를 이해하지 못하면 빌드 오류와 JAR 크기 문제, 런타임 버전 충돌을 맞닥뜨렸을 때 원인을 파악하기가 어렵습니다.

## Scope — 의존성의 사용 범위

**scope**는 "이 라이브러리가 언제 필요한가"를 정의합니다. scope를 잘못 설정하면 불필요한 라이브러리가 최종 JAR에 포함되거나, 반대로 런타임에 필요한 클래스가 없어서 오류가 납니다.

### Gradle scope (Configuration)

```kotlin
dependencies {
    // implementation: 컴파일·런타임 모두 필요. 최종 JAR에 포함.
    // 의존하는 모듈의 소비자에게 노출되지 않음 (internal)
    implementation("org.springframework.boot:spring-boot-starter-web")

    // api: implementation과 같지만 소비자에게도 노출됨
    // 라이브러리 모듈에서만 사용 (java-library 플러그인 필요)
    api("com.google.guava:guava:32.1.3-jre")

    // compileOnly: 컴파일 시에만. 최종 JAR에 미포함.
    // 예: Lombok (어노테이션 처리 후 코드가 생성됨)
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // runtimeOnly: 런타임에만 필요. 컴파일 클래스패스 미포함.
    // 예: JDBC 드라이버, H2
    runtimeOnly("com.h2database:h2")
    runtimeOnly("org.postgresql:postgresql")

    // testImplementation: 테스트 코드에서만 사용
    testImplementation("org.springframework.boot:spring-boot-starter-test")

    // testRuntimeOnly: 테스트 런타임에만 필요
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
```

`implementation`과 `api`의 차이는 멀티 모듈에서 중요합니다. `api`로 선언하면 내 모듈을 사용하는 모든 모듈이 그 의존성에 접근할 수 있지만, `implementation`은 내 모듈 내부에서만 사용합니다. 라이브러리 누수를 막으려면 `api`보다 `implementation`을 기본으로 사용하세요.

### Maven scope

```xml
<dependencies>
    <!-- compile (기본): 컴파일·런타임 모두. 최종 JAR 포함 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- provided: 컴파일 시에만. 컨테이너(서버)가 제공 -->
    <dependency>
        <groupId>jakarta.servlet</groupId>
        <artifactId>jakarta.servlet-api</artifactId>
        <scope>provided</scope>
    </dependency>

    <!-- runtime: 런타임에만 필요 -->
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- test: 테스트 시에만 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- import: BOM을 가져올 때만 사용 (type=pom 필수) -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-dependencies</artifactId>
        <version>2023.0.0</version>
        <type>pom</type>
        <scope>import</scope>
    </dependency>
</dependencies>
```

## 전이 의존성 — 내가 선언하지 않은 라이브러리

`spring-boot-starter-web` 하나를 선언했는데, 실제로 수십 개의 JAR가 클래스패스에 들어옵니다. 이것이 **전이 의존성(Transitive Dependency)** 입니다.

![전이 의존성과 충돌 해결](/assets/posts/spring-dependency-management-transitive.svg)

`starter-web`이 `spring-webmvc`를 가져오고, `spring-webmvc`가 `spring-core`를, `spring-core`가 또 다른 것들을 가져옵니다. 이 연쇄가 전이 의존성입니다.

### 의존성 트리 확인

```bash
# Gradle — 컴파일 클래스패스 트리 출력
$ ./gradlew dependencies --configuration compileClasspath

# 특정 라이브러리가 어디서 왔는지 추적
$ ./gradlew dependencyInsight \
  --dependency jackson-databind \
  --configuration compileClasspath

# Maven
$ mvn dependency:tree
$ mvn dependency:tree -Dincludes=com.fasterxml.jackson.core
```

출력 예시:

```text
compileClasspath - Compile classpath for source set 'main'.
+--- org.springframework.boot:spring-boot-starter-web -> 3.3.0
|    +--- org.springframework.boot:spring-boot-starter -> 3.3.0
|    |    +--- org.springframework.boot:spring-boot -> 3.3.0
|    |    |    \--- org.springframework:spring-core:6.1.8
|    +--- org.springframework:spring-webmvc:6.1.8
|    \--- com.fasterxml.jackson.core:jackson-databind:2.17.1
```

### 충돌 해결

두 의존성이 같은 라이브러리의 다른 버전을 요구할 때 충돌이 발생합니다.

```kotlin
// Gradle — 버전 강제 지정
configurations.all {
    resolutionStrategy {
        force("com.fasterxml.jackson.core:jackson-databind:2.17.1")
    }
}

// 또는 dependency constraints
dependencies {
    constraints {
        implementation("com.fasterxml.jackson.core:jackson-databind:2.17.1") {
            because("CVE-2023-xxxx 보안 패치")
        }
    }
}
```

```xml
<!-- Maven — dependencyManagement로 버전 통제 -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.17.1</version>
        </dependency>
    </dependencies>
</dependencyManagement>
```

### 전이 의존성 제외

특정 라이브러리를 완전히 제외해야 할 때:

```kotlin
// Gradle — 특정 전이 의존성 제외
implementation("org.springframework.boot:spring-boot-starter-logging") {
    exclude(group = "ch.qos.logback", module = "logback-classic")
}

// 로그백 대신 log4j2 사용
implementation("org.springframework.boot:spring-boot-starter-log4j2")
```

```xml
<!-- Maven -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-logging</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

## BOM — Bill of Materials

**BOM(Bill of Materials)** 은 "이 라이브러리들은 이 버전 조합을 쓰면 검증됨"을 선언하는 특별한 POM입니다. BOM 하나만 가져오면 수십~수백 개의 라이브러리 버전이 한꺼번에 관리됩니다.

![BOM 동작 원리](/assets/posts/spring-dependency-management-bom.svg)

### Spring Boot BOM 계층

Spring Boot는 세 겹의 BOM 계층을 가집니다.

1. **spring-boot-dependencies**: 핵심 BOM. 600여 개 라이브러리 버전 정의
2. **spring-boot-starter-parent** (Maven): spring-boot-dependencies를 import한 부모 POM
3. **io.spring.dependency-management** (Gradle): BOM을 Gradle에서 사용할 수 있게 하는 플러그인

```kotlin
// Gradle — Spring Boot BOM이 아닌 다른 BOM도 추가 가능
dependencyManagement {
    imports {
        // Spring Cloud BOM 추가
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2023.0.2")
        // Testcontainers BOM 추가
        mavenBom("org.testcontainers:testcontainers-bom:1.19.8")
    }
}

dependencies {
    // 버전 없이 선언 — Spring Cloud BOM이 버전 결정
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
    testImplementation("org.testcontainers:postgresql")
}
```

### BOM에서 버전 재정의

BOM이 지정한 버전보다 더 새로운 버전을 써야 할 때:

```kotlin
// Gradle — ext로 버전 재정의 (Spring Boot BOM이 이 방식 지원)
extra["jackson.version"] = "2.17.2"  // BOM 기본값 재정의

// 또는 직접 명시
implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
```

```xml
<!-- Maven — properties로 BOM 버전 재정의 -->
<properties>
    <jackson-bom.version>2.17.2</jackson-bom.version>
</properties>
```

## 의존성 잠금 (Dependency Locking)

재현 가능한 빌드를 위해 **의존성 버전을 파일에 잠글** 수 있습니다.

```kotlin
// build.gradle.kts — 의존성 잠금 활성화
dependencyLocking {
    lockAllConfigurations()
}
```

```bash
# 현재 의존성 버전을 파일에 기록
$ ./gradlew dependencies --write-locks

# 이후 빌드에서 잠금 파일과 다른 버전이 있으면 실패
# gradle/dependency-locks/ 디렉토리에 lockfile 생성
```

잠금 파일을 git에 커밋해 두면, CI 환경에서도 항상 같은 버전 조합으로 빌드됩니다.

## 실무 권장 사항

의존성 관리에서 실무적으로 중요한 규칙들:

```kotlin
dependencies {
    // 1. starter가 있으면 starter를 써라
    //    (spring-webmvc 직접 대신 spring-boot-starter-web)
    implementation("org.springframework.boot:spring-boot-starter-web")

    // 2. 버전은 BOM에 맡겨라
    //    (직접 버전 명시는 충돌 위험)
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")

    // 3. scope를 정확히 설정하라
    //    (테스트 라이브러리가 runtime에 포함되지 않게)
    testImplementation("org.springframework.boot:spring-boot-starter-test")

    // 4. 보안 취약점은 constraints로 패치하라
    constraints {
        implementation("org.yaml:snakeyaml:2.2") {
            because("CVE-2022-1471 패치")
        }
    }
}
```

보안 취약점이 포함된 전이 의존성은 `./gradlew dependencyInsight`로 추적하고, `constraints`로 패치 버전을 강제합니다.

## 정리

의존성 관리의 핵심은 세 가지입니다. scope로 라이브러리의 사용 범위를 명확히 구분하고, 전이 의존성 충돌을 트리 분석으로 파악하며, BOM으로 검증된 버전 조합을 사용합니다. Spring Boot의 BOM은 이 세 가지를 한꺼번에 해결해주는 가장 편리한 도구입니다. Chapter 2가 마무리됩니다. 다음 Chapter 3부터는 스프링 코어의 핵심인 IoC 컨테이너로 들어갑니다.

---

**지난 글:** [Gradle 기초 — build.gradle과 태스크](/posts/spring-gradle-basics/)

<br>
읽어주셔서 감사합니다. 😊
