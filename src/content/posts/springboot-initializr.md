---
title: "Spring Initializr 완전 정복 — 프로젝트 생성부터 첫 실행까지"
description: "Spring Initializr(start.spring.io)로 Spring Boot 프로젝트를 생성하는 모든 과정을 완전히 이해합니다. 빌드 도구·언어·버전 선택 기준, Starter 의존성 추가 방법, 생성된 프로젝트 구조 해설, IntelliJ IDEA와 VS Code에서의 임포트 방법, CLI(curl/HTTPie)와 Spring Boot CLI로 명령행에서 프로젝트 생성, 그리고 사내 커스텀 Initializr 구축 개요까지 실무 중심으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "SpringInitializr", "프로젝트생성", "start.spring.io", "Gradle", "Maven", "Starter", "IDE"]
featured: false
draft: false
---

[지난 글](/posts/springboot-four-features/)에서 Spring Boot의 네 가지 핵심 특징인 Auto-Configuration, Embedded Server, Starter Dependencies, Production-Ready 지원을 살펴봤습니다. 이번에는 이 특징을 갖춘 프로젝트를 **단 몇 분 만에 만드는 도구**, Spring Initializr를 다룹니다.

## Spring Initializr란

Spring Initializr는 Pivotal(현 VMware)이 운영하는 웹 기반 프로젝트 생성기입니다. `start.spring.io`에서 프로젝트 메타데이터와 의존성을 선택하면 즉시 실행 가능한 Spring Boot 프로젝트 골격을 ZIP 파일로 제공합니다. 새로운 Spring Boot 프로젝트를 시작할 때 빈 폴더에서 `build.gradle`을 직접 작성할 필요가 없습니다.

IntelliJ IDEA, VS Code, Eclipse STS 같은 IDE에도 Initializr가 내장되어 있어 브라우저를 열지 않고도 IDE 안에서 프로젝트를 생성할 수 있습니다.

## 웹 UI에서 프로젝트 생성

`start.spring.io`에서 선택해야 하는 항목은 여섯 가지입니다.

![Spring Initializr 프로젝트 생성 흐름](/assets/posts/springboot-initializr-concept.svg)

### 1. 빌드 도구: Maven vs Gradle

실무에서는 **Gradle Groovy DSL** 또는 **Gradle Kotlin DSL**이 우세합니다. Maven은 XML 기반이라 가독성이 낮고 커스터마이징이 어렵습니다. Kotlin DSL은 IDE 자동완성이 완벽하게 지원되지만 Groovy DSL보다 빌드 속도가 약간 느릴 수 있습니다. 팀 내 기존 컨벤션이 없다면 **Gradle Groovy DSL**을 권장합니다.

### 2. 언어: Java / Kotlin / Groovy

Java를 선택하는 것이 일반적입니다. Kotlin은 간결한 문법과 null 안전성 때문에 선호도가 높아지고 있으며 Spring Boot 3.x와 완벽하게 호환됩니다.

### 3. Spring Boot 버전

**SNAPSHOT**이나 **M(Milestone)** 버전은 개발 중인 버전이므로 프로덕션에는 사용하지 않습니다. 버전 뒤에 아무 접미사가 없는 **GA(General Availability)** 버전 중 가장 최신을 선택합니다. 2025년 기준으로는 Spring Boot 3.x 계열이 현재 지원 버전입니다.

### 4. 프로젝트 메타데이터

- **Group**: 역 도메인 형식. 예) `com.example`, `io.paldyn`
- **Artifact**: 프로젝트(모듈) 이름. 예) `user-service`, `api-gateway`
- **Package name**: 자동으로 `{Group}.{Artifact}` 형태로 생성됨
- **Packaging**: `Jar`(기본) 또는 `War`. 컨테이너 환경이라면 Jar 선택
- **Java**: LTS 버전인 21(Java 21)을 권장

### 5. 의존성(Dependencies) 선택

검색창에 키워드를 입력해 Starter를 추가합니다. 자주 사용하는 조합:

| 시나리오 | 추가할 Starter |
|---|---|
| REST API 서버 | Spring Web, Spring Data JPA, Lombok, Validation |
| REST API + 인증 | + Spring Security |
| 개발·테스트용 DB | + H2 Database |
| 운영 DB | + PostgreSQL Driver / MySQL Driver |
| 캐시 | + Spring cache abstraction + Caffeine |
| 모니터링 | + Spring Boot Actuator |

처음에 의존성을 완벽하게 선택하지 않아도 됩니다. `build.gradle`에 나중에 추가하면 됩니다.

### 6. GENERATE 클릭 → ZIP 다운로드

**GENERATE** 버튼을 클릭하면 ZIP 파일이 다운로드됩니다. 압축을 풀고 IDE에서 열면 됩니다.

## 생성된 프로젝트 구조 해설

```
my-project/
├── build.gradle                    ← 빌드 스크립트 (Gradle)
├── settings.gradle                 ← 루트 프로젝트 이름 설정
├── gradlew / gradlew.bat           ← Gradle Wrapper (로컬 Gradle 설치 불필요)
├── .gitignore                      ← 자동 생성된 Git 무시 목록
├── src/
│   ├── main/
│   │   ├── java/com/example/demo/
│   │   │   └── DemoApplication.java   ← @SpringBootApplication 메인 클래스
│   │   └── resources/
│   │       ├── application.properties  ← 기본 설정 파일
│   │       ├── static/                 ← 정적 자원 (HTML, CSS, JS)
│   │       └── templates/              ← 템플릿 엔진 파일 (Thymeleaf 등)
│   └── test/
│       └── java/com/example/demo/
│           └── DemoApplicationTests.java  ← 기본 테스트 클래스
└── .mvn/ 또는 gradle/wrapper/      ← Wrapper 설정
```

`gradlew`(Gradle Wrapper)가 포함되어 있으므로 팀 내 Gradle 버전을 통일할 수 있습니다. 로컬에 Gradle이 설치되지 않아도 `./gradlew bootRun`으로 즉시 실행됩니다.

## build.gradle 구조 이해

![Spring Initializr build.gradle 생성 예시](/assets/posts/springboot-initializr-code.svg)

```groovy
plugins {
    id 'org.springframework.boot' version '3.3.0'
    id 'io.spring.dependency-management' version '1.1.4'
    id 'java'
}
```

- `org.springframework.boot`: `bootJar`, `bootRun` 태스크 추가, 실행 가능 JAR 생성
- `io.spring.dependency-management`: `spring-boot-dependencies` BOM 임포트, 의존성 버전 자동 관리

`dependency-management` 플러그인 덕분에 `spring-boot-starter-web` 같은 의존성에 버전을 명시하지 않아도 됩니다. 플러그인이 Spring Boot 버전에 맞는 버전을 자동으로 결정합니다.

## IntelliJ IDEA에서 프로젝트 생성

IntelliJ IDEA Ultimate에는 Spring Initializr가 내장되어 있습니다. `File → New → Project → Spring Initializr`를 선택하면 웹 UI와 동일한 옵션을 IDE 안에서 설정할 수 있습니다. 내부적으로 `start.spring.io` API를 호출합니다.

IntelliJ IDEA Community Edition은 Spring 플러그인을 직접 지원하지 않지만, 웹 UI에서 생성한 ZIP을 `File → Open`으로 임포트하면 됩니다.

## CLI로 프로젝트 생성

브라우저나 IDE 없이 터미널에서도 생성할 수 있습니다.

```bash
# curl로 start.spring.io API 직접 호출
curl https://start.spring.io/starter.zip \
  -d type=gradle-project \
  -d language=java \
  -d bootVersion=3.3.0 \
  -d baseDir=my-api \
  -d groupId=com.example \
  -d artifactId=my-api \
  -d name=my-api \
  -d packageName=com.example.myapi \
  -d javaVersion=21 \
  -d dependencies=web,data-jpa,lombok,h2,validation \
  -o my-api.zip

unzip my-api.zip
cd my-api
./gradlew bootRun
```

CI/CD 파이프라인에서 새 마이크로서비스를 자동으로 스캐폴딩(scaffolding)할 때 유용합니다.

## Spring Boot CLI로 프로젝트 생성

Spring Boot CLI를 설치하면 더 짧은 명령으로 생성할 수 있습니다.

```bash
# Homebrew로 설치 (macOS)
brew install spring-io/tap/spring-boot

# 프로젝트 생성
spring init \
  --build=gradle \
  --java-version=21 \
  --dependencies=web,data-jpa,lombok \
  --artifact-id=my-service \
  my-service.zip

unzip my-service.zip -d my-service
```

## 사내 커스텀 Initializr

팀 내에서 공통 설정(내부 Maven 저장소 주소, 공통 Starter, 코드 컨벤션 설정 파일)을 포함한 프로젝트 템플릿이 필요하다면 **사내 Initializr**를 구축할 수 있습니다. Spring의 오픈소스 프로젝트 `initializr`를 클론해 커스터마이징하거나, `start.spring.io`의 REST API와 동일한 형식으로 응답하는 경량 서버를 직접 구현할 수 있습니다.

```yaml
# application.yml — 커스텀 Initializr 의존성 목록 추가 예시
initializr:
  dependencies:
    - name: 사내 공통 라이브러리
      id: internal-common
      description: 팀 공통 유틸리티, 예외 처리, 로깅
      groupId: io.paldyn
      artifactId: paldyn-common
      version: 1.5.0
      starter: false
```

## 첫 실행 확인

생성된 프로젝트를 처음 실행하면 Spring Boot 배너와 함께 기동 로그가 출력됩니다.

```bash
./gradlew bootRun

# 출력 예시
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
...
Started DemoApplication in 2.341 seconds (process running for 2.7)
```

`src/main/resources/application.properties`에 다음을 추가하면 배너를 끌 수 있습니다.

```properties
spring.main.banner-mode=off
```

## 정리

- `start.spring.io`에서 빌드 도구·버전·의존성 선택 후 ZIP 다운로드
- 프로덕션에는 GA 버전 선택, SNAPSHOT/Milestone 버전 사용 금지
- `gradlew` Wrapper 포함 — 팀 내 Gradle 버전 통일 보장
- `dependency-management` 플러그인이 모든 의존성 버전 자동 관리
- curl/Spring CLI로 터미널에서 생성 가능 — CI/CD 자동화에 활용
- 팀 공통 설정 필요 시 사내 커스텀 Initializr 구축 고려

---

**지난 글:** [Spring Boot 4가지 핵심 특징 완전 정복](/posts/springboot-four-features/)

**다음 글:** [@SpringBootApplication 완전 정복](/posts/springboot-application-annotation/)

<br>
읽어주셔서 감사합니다. 😊
