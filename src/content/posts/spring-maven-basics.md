---
title: "Maven 기초 — pom.xml과 라이프사이클"
description: "스프링 프로젝트에서 자주 만나는 Maven의 핵심 개념인 pom.xml 구조, 의존성 관리, 라이프사이클을 실용적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["spring", "maven", "pom", "build", "dependency"]
featured: false
draft: false
---

[지난 글](/posts/spring-environment-jdk-ide-build/)에서 JDK, IDE, 빌드 도구를 설치하고 첫 스프링 프로젝트를 만들었습니다. 이번 글에서는 스프링 생태계에서 여전히 널리 쓰이는 Maven을 본격적으로 파봅니다. 신규 프로젝트는 Gradle을 선택하더라도, 기업 레거시 코드베이스나 오픈소스 라이브러리에서 Maven을 피할 수 없기 때문에 양쪽 모두 이해해 두는 것이 좋습니다.

## Maven이 하는 일

Maven은 자바 프로젝트의 세 가지 문제를 해결합니다.

1. **의존성 관리**: "이 라이브러리 jar 파일을 어디서 구해서 어디에 놓아야 하지?"
2. **빌드 표준화**: "컴파일, 테스트, 패키징 순서를 어떻게 정해야 하지?"
3. **프로젝트 정보**: "이 프로젝트는 누가 만들었고 어떤 버전인가?"

Maven 등장 이전에는 이 모든 것을 개발팀이 직접 결정하고 관리했습니다. 팀마다 방식이 달랐고 신규 팀원이 합류하면 환경 설정에만 반나절이 걸렸습니다. Maven은 "Convention over Configuration" 원칙으로 이 혼란을 표준화했습니다.

## 디렉토리 구조 — 바꾸지 말아야 할 것들

Maven 프로젝트는 디렉토리 구조가 고정입니다. 이 구조를 따르면 별도 설정 없이 Maven이 소스와 리소스를 자동으로 인식합니다.

```
my-app/
├── pom.xml                          ← 프로젝트 설정 파일
└── src/
    ├── main/
    │   ├── java/                    ← 소스 코드
    │   │   └── com/example/App.java
    │   └── resources/              ← 설정 파일 (application.yml 등)
    │       └── application.yml
    └── test/
        ├── java/                    ← 테스트 코드
        │   └── com/example/AppTest.java
        └── resources/              ← 테스트용 설정
```

`src/main/java`에 소스 코드, `src/test/java`에 테스트 코드를 두는 것이 Maven의 약속입니다. Gradle도 동일한 구조를 따릅니다.

## pom.xml — Maven의 핵심 설정 파일

**pom.xml**은 Maven 프로젝트의 설정을 모두 담은 XML 파일입니다. POM은 Project Object Model의 약자입니다. 스프링 부트 프로젝트의 pom.xml은 크게 세 부분으로 나뉩니다.

![pom.xml 핵심 구조](/assets/posts/spring-maven-pom-structure.svg)

### 부모 POM — 버전 관리의 핵심

`spring-boot-starter-parent`를 부모로 설정하면 수백 개의 의존성 버전이 자동으로 관리됩니다. 내부적으로 `spring-boot-dependencies`라는 BOM(Bill of Materials)을 포함하고 있어, 각 의존성의 `<version>`을 직접 명시하지 않아도 됩니다.

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>
    <!-- relativePath 생략 시 Maven Central에서 찾음 -->
</parent>
```

부모 POM은 또한 컴파일러 버전, UTF-8 인코딩, 리소스 필터링 같은 공통 플러그인 설정도 포함하고 있습니다.

### 프로젝트 좌표 — GAV

모든 Maven 아티팩트는 **GAV(GroupId, ArtifactId, Version)** 세 가지로 고유하게 식별됩니다.

```xml
<groupId>com.example</groupId>       <!-- 조직/회사 식별자 (역방향 도메인) -->
<artifactId>my-app</artifactId>      <!-- 프로젝트 이름 -->
<version>0.0.1-SNAPSHOT</version>   <!-- SNAPSHOT = 개발 중 -->
```

`SNAPSHOT`이 붙은 버전은 아직 릴리스되지 않은 개발 버전임을 의미합니다. 배포할 때는 `1.0.0`처럼 버전에서 SNAPSHOT을 제거합니다.

### 의존성 선언

```xml
<dependencies>
    <!-- 컴파일·런타임 모두 필요 (기본 scope: compile) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <!-- 부모 BOM이 버전 관리 → version 태그 불필요 -->
    </dependency>

    <!-- 런타임만 필요 (컴파일 클래스패스 미포함) -->
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- 테스트 시에만 필요 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- 컴파일 시에만 필요 (JAR에 미포함, 서버가 제공) -->
    <dependency>
        <groupId>jakarta.servlet</groupId>
        <artifactId>jakarta.servlet-api</artifactId>
        <scope>provided</scope>
    </dependency>
</dependencies>
```

scope의 의미를 이해하면 어떤 라이브러리가 최종 JAR에 포함되는지, 테스트에만 쓰이는지를 명확히 제어할 수 있습니다.

## Maven 라이프사이클

Maven에는 **세 가지 기본 라이프사이클**이 있습니다. 일상적으로 쓰는 것은 `default` 라이프사이클입니다.

| 라이프사이클 | 역할 |
|------------|------|
| **default** | 소스 빌드, 테스트, 패키징, 배포 |
| **clean** | `target/` 디렉토리 삭제 |
| **site** | 프로젝트 문서 사이트 생성 |

`default` 라이프사이클의 주요 단계(phase):

![Maven 기본 라이프사이클](/assets/posts/spring-maven-lifecycle.svg)

**중요**: 특정 단계를 실행하면 그 이전 단계가 모두 순서대로 실행됩니다. `mvn package`를 실행하면 `validate → compile → test → package`가 차례로 실행됩니다.

## 실무에서 자주 쓰는 명령어

```bash
# 빌드 전 캐시 정리 + 패키징 (CI/CD에서 표준)
$ mvn clean package

# 테스트 건너뛰고 빠르게 패키징 (로컬 확인용)
$ mvn clean package -DskipTests

# 특정 테스트 클래스만 실행
$ mvn test -Dtest=OrderServiceTest

# 의존성 트리 출력 (충돌 분석)
$ mvn dependency:tree

# 멀티모듈에서 특정 모듈만 빌드
$ mvn install -pl :user-service -am

# 오프라인 모드 (인터넷 없는 환경)
$ mvn package -o
```

## Maven Wrapper — 버전 통일

팀 전체가 동일한 Maven 버전을 사용하도록 **Maven Wrapper**를 사용하면 좋습니다.

```bash
# Maven Wrapper 생성
$ mvn wrapper:wrapper

# 이후 Maven 설치 없이 ./mvnw 사용
$ ./mvnw clean package

# Windows
> mvnw.cmd clean package
```

Spring Initializr에서 생성된 프로젝트는 기본적으로 Maven Wrapper(`mvnw`, `mvnw.cmd`, `.mvn/` 디렉토리)를 포함합니다.

## 로컬 저장소와 원격 저장소

Maven은 의존성을 다음 순서로 찾습니다.

```
1. 로컬 저장소 (~/.m2/repository)
   → 있으면 사용

2. 원격 저장소 (Maven Central, 사내 Nexus/Artifactory)
   → 없으면 다운로드 후 로컬 캐시

3. 다운로드 실패 → 빌드 오류
```

사내 사설 저장소를 사용할 때는 `settings.xml`에 미러를 설정합니다.

```xml
<!-- ~/.m2/settings.xml -->
<settings>
    <mirrors>
        <mirror>
            <id>nexus</id>
            <url>https://nexus.company.com/repository/maven-public/</url>
            <mirrorOf>*</mirrorOf>
        </mirror>
    </mirrors>
</settings>
```

## 프로파일 — 환경별 설정 분리

Maven **프로파일**로 개발/운영 환경별로 다른 설정을 적용할 수 있습니다.

```xml
<profiles>
    <profile>
        <id>dev</id>
        <activation>
            <activeByDefault>true</activeByDefault>
        </activation>
        <properties>
            <spring.profiles.active>dev</spring.profiles.active>
        </properties>
    </profile>

    <profile>
        <id>prod</id>
        <properties>
            <spring.profiles.active>prod</spring.profiles.active>
        </properties>
    </profile>
</profiles>
```

```bash
# prod 프로파일 활성화
$ mvn package -Pprod
```

## 정리

Maven은 XML이 장황하다는 단점이 있지만, 명확한 구조와 풍부한 플러그인 생태계 덕분에 여전히 많은 프로젝트에서 사용됩니다. 핵심은 세 가지입니다. GAV로 아티팩트를 식별하고, 부모 POM이 버전을 관리하며, 라이프사이클 단계가 순서대로 실행된다는 것입니다. 다음 글에서는 Maven보다 빠르고 간결한 Gradle을 살펴봅니다.

---

**지난 글:** [JDK·IDE·빌드도구 한눈에 — 스프링 개발 환경 구축](/posts/spring-environment-jdk-ide-build/)

**다음 글:** [Gradle 기초 — build.gradle과 태스크](/posts/spring-gradle-basics/)

<br>
읽어주셔서 감사합니다. 😊
