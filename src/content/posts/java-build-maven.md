---
title: "Maven 입문 — 자바 빌드 도구의 표준"
description: "Maven이 무엇인지, 왜 쓰는지부터 pom.xml 구조, 표준 디렉토리 레이아웃, 로컬 저장소, 전이 의존성, 기본 명령어까지 자바 빌드의 표준 도구 Maven을 처음부터 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "Maven", "빌드 도구", "pom.xml", "의존성 관리"]
featured: false
draft: false
---

[지난 글](/posts/graalvm-tradeoffs/)에서 GraalVM의 네이티브 이미지와 JIT 모드 사이의 트레이드오프를 살펴봤습니다. 이번 글부터는 자바 프로젝트를 어떻게 **빌드하고 관리**하는지에 집중합니다. 그 출발점은 자바 진영의 사실상 표준 빌드 도구인 **Maven**입니다.

## Maven이란 무엇인가

Maven은 아파치 소프트웨어 재단이 만든 **선언적(declarative) 빌드 도구**입니다. "선언적"이라는 말은 "무엇을 원하는지"를 XML로 기술하면, Maven이 알아서 "어떻게 할지"를 처리해 준다는 뜻입니다. 이와 대비되는 명령적(imperative) 도구는 빌드 스크립트에 각 단계를 직접 나열해야 합니다.

Maven의 핵심 철학은 두 가지입니다.

- **Convention over Configuration(CoC)**: 규칙을 따르면 설정이 필요 없습니다. 소스 코드를 `src/main/java`에 두면, 별도 설정 없이 Maven이 알아서 컴파일합니다.
- **선언적 의존성 관리**: 필요한 라이브러리를 `pom.xml`에 선언만 하면, Maven이 인터넷에서 내려받고 클래스패스에 추가합니다.

Maven 이전에는 개발자가 JAR 파일을 직접 내려받아 프로젝트에 넣고, 빌드 스크립트(Ant)에 모든 단계를 일일이 작성해야 했습니다. Maven은 이 반복 작업을 대부분 없앴습니다.

## pom.xml — 프로젝트의 설계도

Maven 프로젝트의 중심은 **pom.xml**(Project Object Model)입니다. 이 파일 하나에 프로젝트의 신원, 의존성, 빌드 설정이 모두 담깁니다.

![pom.xml 구조 — Maven 프로젝트의 핵심 설정 파일](/assets/posts/java-build-maven-pomxml.svg)

### GAV 좌표 (Coordinates)

Maven의 세계에서 모든 아티팩트(라이브러리, 프레임워크, 프로젝트 산출물)는 세 가지 정보로 유일하게 식별됩니다.

```xml
<groupId>com.example</groupId>       <!-- 조직/패키지 최상위 -->
<artifactId>my-app</artifactId>      <!-- 프로젝트 이름 -->
<version>1.0.0</version>             <!-- 버전 -->
```

이 세 값을 합쳐 **GAV 좌표**라고 부릅니다. Maven Central에 올라간 수백만 개의 라이브러리도 모두 이 방식으로 식별됩니다. 예를 들어 `org.springframework:spring-core:6.1.0`처럼 표기합니다.

### properties

공통으로 참조하는 값을 변수처럼 선언합니다. 의존성 버전이 여러 곳에 흩어지면 업데이트 시 실수가 납니다. `properties`로 한 곳에서 관리합니다.

```xml
<properties>
  <java.version>21</java.version>
  <spring.version>6.1.0</spring.version>
</properties>
```

이후 다른 곳에서 `${spring.version}` 형태로 참조합니다.

### dependencies — 의존성 선언

프로젝트에서 사용할 외부 라이브러리를 GAV 좌표로 선언합니다.

```xml
<dependencies>
  <dependency>
    <groupId>junit</groupId>
    <artifactId>junit</artifactId>
    <version>4.13.2</version>
    <scope>test</scope>
  </dependency>
</dependencies>
```

`<scope>`는 해당 의존성이 어느 시점에 필요한지를 지정합니다. 주요 스코프는 다음과 같습니다.

| 스코프 | 설명 | 예시 |
|---|---|---|
| `compile` (기본) | 컴파일~런타임 전 단계 필요 | spring-core |
| `test` | 테스트 컴파일·실행 시에만 | JUnit, Mockito |
| `provided` | 컴파일엔 필요하지만 런타임엔 컨테이너가 제공 | Servlet API |
| `runtime` | 컴파일엔 불필요, 런타임엔 필요 | JDBC 드라이버 |

## 표준 디렉토리 레이아웃

Maven이 "Convention over Configuration"를 실현하는 가장 눈에 띄는 방식이 표준 디렉토리 구조입니다. 아래 규칙을 따르면 별도 설정 없이 모든 것이 동작합니다.

![Maven 표준 디렉토리 구조 & 기본 명령어](/assets/posts/java-build-maven-commands.svg)

```
my-app/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/        ← 프로덕션 소스 코드
    │   └── resources/   ← 프로퍼티, XML 등 리소스
    └── test/
        ├── java/        ← 테스트 코드
        └── resources/   ← 테스트용 리소스
```

빌드 결과물은 `target/` 디렉토리에 생성됩니다. `mvn clean`을 실행하면 이 디렉토리가 삭제됩니다.

## 로컬 저장소와 Maven Central

Maven이 의존성을 해결하는 방식은 두 단계입니다.

1. **로컬 저장소(`~/.m2/repository`) 확인**: 이미 내려받은 파일이 있으면 여기서 바로 사용합니다.
2. **원격 저장소(Maven Central) 다운로드**: 없으면 `https://repo.maven.apache.org/maven2`에서 내려받고 로컬에 캐시합니다.

한 번 내려받은 의존성은 로컬에 영구 캐시되므로, 오프라인 환경에서도 재사용할 수 있습니다. 팀 내에서는 Nexus나 Artifactory 같은 사설 저장소를 중간에 두기도 합니다.

## 전이 의존성 해결

선언하는 의존성이 또 다른 의존성을 필요로 하는 경우, Maven은 이를 자동으로 처리합니다. 예를 들어 `spring-webmvc`를 선언하면 그것이 의존하는 `spring-core`, `spring-beans` 등이 자동으로 포함됩니다. 이를 **전이 의존성(transitive dependency)** 이라고 합니다.

전이 의존성의 버전이 충돌하면 Maven은 **가장 가까운 선언(nearest wins)** 원칙으로 해결합니다. 직접 선언한 버전이 전이 의존성 버전보다 우선합니다. `mvn dependency:tree` 명령으로 실제 의존성 트리를 확인할 수 있습니다.

## 기본 명령어

```bash
# 소스 코드 컴파일
mvn compile

# 단위 테스트 실행 (compile 먼저 실행됨)
mvn test

# JAR 또는 WAR 파일 생성 (compile + test + package)
mvn package

# 로컬 저장소(~/.m2)에 설치 (다른 프로젝트에서 참조 가능)
mvn install

# 빌드 산출물(target/) 삭제
mvn clean

# 자주 쓰는 조합: 이전 결과 지우고 새로 빌드
mvn clean package
```

중요한 점은 Maven의 각 명령이 **누적 실행**된다는 것입니다. `mvn test`를 실행하면 `validate` → `compile` → `test` 순서로 모두 실행됩니다. 이것이 Maven 라이프사이클의 핵심 동작 방식인데, 다음 글에서 자세히 다룹니다.

## 최소 pom.xml 예시

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
           http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0.0</version>
  <packaging>jar</packaging>

  <properties>
    <java.version>21</java.version>
    <maven.compiler.source>${java.version}</maven.compiler.source>
    <maven.compiler.target>${java.version}</maven.compiler.target>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.10.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
```

이 `pom.xml`만으로 JUnit 5로 단위 테스트를 작성하고 `mvn test`로 실행할 수 있습니다. 아무 Ant 스크립트도, 클래스패스 설정도 필요하지 않습니다.

## 정리

Maven은 **선언적** 방식으로 자바 프로젝트를 관리합니다. `pom.xml`에 GAV 좌표와 의존성을 선언하면, Maven이 표준 디렉토리 규칙에 따라 소스를 컴파일하고 테스트를 실행하고 패키지를 생성합니다. 의존성은 Maven Central에서 자동으로 내려받아 `~/.m2`에 캐시됩니다. 전이 의존성도 자동 해결됩니다. 이 구조 위에서 빌드 각 단계가 어떤 순서로 실행되는지를 이해하려면 라이프사이클 개념이 필요합니다.

---

**지난 글:** [GraalVM 트레이드오프 — 언제 쓰고 언제 피할까](/posts/graalvm-tradeoffs/)

**다음 글:** [Maven 라이프사이클 — 빌드 단계 완전 이해](/posts/java-maven-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
