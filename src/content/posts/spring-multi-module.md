---
title: "Spring Boot 멀티 모듈 프로젝트 — 구조 설계와 빌드 전략"
description: "Gradle 멀티 모듈로 Spring Boot 프로젝트를 domain·application·infra·api·bootstrap 계층으로 분리하는 방법, 의존성 방향 규칙, bootJar 설정, ComponentScan 범위 문제까지 실전 기준으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "멀티모듈", "Gradle", "Maven", "모듈화", "아키텍처", "DDD", "클린아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/spring-jar-vs-war/)에서 Spring Boot 애플리케이션의 패키징 방식(JAR/WAR)과 배포 전략을 비교했다. 이번에는 프로젝트 자체의 구조를 여러 모듈로 나누는 **멀티 모듈(Multi-Module)** 아키텍처를 다룬다. 비즈니스 로직이 커지고 팀이 커질수록 단일 모듈 구조는 컴파일 의존성 관리, 테스트 속도, 변경 영향 범위 파악 모든 면에서 한계를 드러낸다.

## 왜 멀티 모듈인가?

단일 모듈 프로젝트에서는 `Controller`가 `JpaRepository`를 직접 주입받거나, 도메인 엔티티가 HTTP 레이어 어노테이션을 달고 있어도 컴파일이 그냥 통과된다. 의존성 방향을 강제하는 물리적 경계가 없기 때문이다. 멀티 모듈로 분리하면 다음이 가능하다.

- **컴파일 수준 의존성 강제**: `:domain` 모듈에 Spring 관련 클래스가 들어오면 빌드 자체가 실패한다
- **테스트 속도**: 도메인 로직만 변경됐을 때 API 모듈 테스트를 건너뛸 수 있다
- **팀 분리**: 팀A는 `:api`, 팀B는 `:infra-db` 담당처럼 소유권을 명확히 할 수 있다

## 모듈 레이아웃 설계

정답은 없지만 가장 많이 쓰이는 패턴은 다음과 같다.

```
my-service/
├── domain/           ← Entity, Value Object, 도메인 규칙
├── application/      ← UseCase, Service, Port 인터페이스
├── infra-db/         ← JPA 구현, Repository 구현체
├── infra-external/   ← 외부 API, 메시지 큐 클라이언트
├── api/              ← Controller, DTO, 요청/응답 변환
├── bootstrap/        ← main(), Spring 컨텍스트 조립
└── settings.gradle
```

![멀티 모듈 구조 및 의존성 방향](/assets/posts/spring-multi-module-structure.svg)

의존성은 **항상 외부에서 내부(도메인)를 향해야 한다**. `domain`이 `infra-db`를 모르는 것이 핵심 규칙이다. DIP(의존성 역전 원칙)를 지키려면 `:domain`에 Port 인터페이스를 정의하고 `:infra-db`에서 구현체를 제공하는 방식을 쓴다.

허용 방향:
- `:api` → `:application` → `:domain`
- `:infra-db` → `:domain`
- `:bootstrap` → 모든 모듈 (런타임 조립)

금지 방향:
- `:domain` → 어떤 모듈도 금지 (의존성 없는 순수 Java)
- `:application` → `:infra-db` (Port 인터페이스로만 통신)

## Gradle 멀티 모듈 설정

### settings.gradle

```groovy
rootProject.name = 'my-service'

include(
    ':domain',
    ':application',
    ':infra-db',
    ':infra-external',
    ':api',
    ':bootstrap'
)
```

### 루트 build.gradle — 공통 설정

```groovy
plugins {
    id 'org.springframework.boot' version '3.3.0' apply false
    id 'io.spring.dependency-management' version '1.1.5' apply false
    id 'java' apply false
}

subprojects {
    apply plugin: 'java-library'
    apply plugin: 'io.spring.dependency-management'

    group = 'com.example'
    version = '1.0.0-SNAPSHOT'

    java {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    dependencyManagement {
        imports {
            mavenBom "org.springframework.boot:spring-boot-dependencies:3.3.0"
        }
    }

    repositories {
        mavenCentral()
    }
}
```

`apply false`가 핵심이다. 루트에서는 플러그인 버전만 선언하고, 실제 적용은 각 서브 모듈에서 `apply plugin` 으로 제어한다. Spring Boot 플러그인의 `bootJar` 태스크는 실행 가능한 JAR을 만드는데, 이를 모든 모듈에 적용하면 의미 없는 JAR이 여러 개 생성된다.

![멀티 모듈 Gradle 빌드 설정](/assets/posts/spring-multi-module-build.svg)

### :domain/build.gradle — 순수 Java

```groovy
// Spring 의존성 없음, 도메인 규칙만
dependencies {
    // 필요 시 Lombok, Jakarta Validation 정도만
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
}
```

### :application/build.gradle

```groovy
dependencies {
    implementation project(':domain')
    // UseCase 구현 — Spring 컨텍스트 없이 동작 가능하게 설계
    // Spring Framework 의존성은 최소화 (인터페이스만 사용)
}
```

### :infra-db/build.gradle

```groovy
dependencies {
    implementation project(':domain')
    implementation project(':application')   // Port 인터페이스 구현

    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    runtimeOnly 'com.mysql:mysql-connector-j'
}
```

### :bootstrap/build.gradle — 유일한 실행 가능 모듈

```groovy
apply plugin: 'org.springframework.boot'

dependencies {
    implementation project(':api')
    implementation project(':application')
    implementation project(':infra-db')
    implementation project(':infra-external')
    // 모든 모듈을 조합하는 진입점
}

// 다른 모듈의 bootJar를 비활성화
bootJar.enabled = true
jar.enabled = false
```

나머지 모듈에는 다음을 추가해 실행 불가 jar만 생성되게 한다.

```groovy
// :domain, :application, :api 등
bootJar.enabled = false
jar.enabled = true
```

## @SpringBootApplication과 ComponentScan 주의사항

`@SpringBootApplication`은 해당 클래스가 위치한 패키지와 하위 패키지를 ComponentScan한다. 멀티 모듈에서 각 모듈이 서로 다른 패키지 경로를 갖는다면, 다른 모듈의 빈이 스캔되지 않는 문제가 생긴다.

**방법 1 — 패키지 구조 통일** (가장 단순):

```
com.example.myservice.domain.*
com.example.myservice.application.*
com.example.myservice.infra.*
com.example.myservice.api.*
com.example.myservice.bootstrap.MyApplication  ← com.example.myservice 루트
```

`MyApplication`이 `com.example.myservice` 아래에 있으면 전체 서브패키지가 스캔된다.

**방법 2 — 명시적 scanBasePackages**:

```java
@SpringBootApplication(scanBasePackages = {
    "com.example.myservice"
})
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

## @Entity ComponentScan 문제

JPA `@Entity`는 ComponentScan이 아닌 `@EnableJpaRepositories`와 `@EntityScan`으로 관리된다. `:infra-db` 모듈에 엔티티와 레포지토리가 있고 `:bootstrap`에서 조합할 때 명시적으로 지정해야 한다.

```java
@SpringBootApplication
@EnableJpaRepositories(basePackages = "com.example.myservice.infra.db")
@EntityScan(basePackages = "com.example.myservice.domain")
public class MyApplication { ... }
```

## 테스트 전략

모듈별 독립 테스트가 멀티 모듈의 핵심 이점이다.

```groovy
// :domain 모듈 테스트 — Spring 없음, JUnit만으로 초고속
// :application 모듈 테스트 — Mockito로 Port 목(mock) 주입
// :infra-db 모듈 테스트 — @DataJpaTest, Testcontainers
// :api 모듈 테스트 — @WebMvcTest, UseCase 목 주입
// :bootstrap 통합 테스트 — @SpringBootTest (전체 컨텍스트)
```

`:domain` 테스트는 Spring 컨텍스트를 띄우지 않으므로 수백 ms 안에 완료된다. CI에서 변경된 모듈만 테스트를 실행하면 전체 빌드 시간이 대폭 줄어든다.

```bash
# 특정 모듈만 테스트
./gradlew :domain:test :application:test

# 전체 빌드
./gradlew :bootstrap:bootJar
```

## Maven 멀티 모듈

Maven을 사용한다면 루트 `pom.xml`에서 `<modules>`를 선언하고 각 모듈을 자식 `pom.xml`로 관리한다.

```xml
<!-- 루트 pom.xml -->
<packaging>pom</packaging>
<modules>
    <module>domain</module>
    <module>application</module>
    <module>infra-db</module>
    <module>api</module>
    <module>bootstrap</module>
</modules>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.3.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

Gradle에 비해 설정이 verbose하지만, 레거시 프로젝트나 Maven Central 배포가 주목적인 라이브러리에서는 Maven이 더 성숙한 생태계를 제공한다.

---

**지난 글:** [Spring Boot JAR vs WAR — 패키징 방식과 배포 전략 선택 가이드](/posts/spring-jar-vs-war/)

**다음 글:** [Spring Boot 도커라이징 — 이미지 빌드와 컨테이너 실행 전략](/posts/spring-dockerizing/)

<br>
읽어주셔서 감사합니다. 😊
