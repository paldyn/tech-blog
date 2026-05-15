---
title: "Spring Boot Starter 구조 완전 정복 — 내부 원리와 커스텀 Starter 만들기"
description: "Spring Boot Starter가 내부적으로 어떻게 구성되는지 완전히 이해합니다. spring-boot-starter-web 분해, Starter = 의존성 묶음 원칙, BOM(Bill of Materials)으로 버전 통합 관리, spring-boot-dependencies 역할, 커스텀 Starter 두 모듈 구조, AutoConfiguration.imports 파일 작성, @ConfigurationProperties 메타데이터, 그리고 실무 적용 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "Starter", "BOM", "AutoConfiguration", "커스텀스타터", "spring-boot-starter-web", "의존성관리", "spring-boot-dependencies"]
featured: false
draft: false
---

[지난 글](/posts/springboot-autoconfiguration/)에서 Auto-Configuration이 `@Conditional` 조건을 평가하며 빈을 자동 등록하는 원리를 살펴봤습니다. 이번에는 Auto-Configuration을 **패키징하고 배포하는 그릇** — Spring Boot Starter의 구조를 파헤칩니다.

## Starter란 무엇인가

한 줄로 정의하면 "**의존성 묶음 선언 파일**"입니다. `spring-boot-starter-web`이라는 JAR를 열어보면 Java 클래스가 없습니다. `pom.xml`(또는 `build.gradle`)만 있고, 그 안에 실제로 필요한 라이브러리들이 의존성으로 선언되어 있습니다.

개발자가 `implementation 'org.springframework.boot:spring-boot-starter-web'` 한 줄을 추가하면, Gradle/Maven이 Starter의 의존성 트리를 따라 필요한 모든 JAR를 자동으로 가져옵니다.

## spring-boot-starter-web 해부

![spring-boot-starter-web 내부 구조](/assets/posts/springboot-starter-structure-concept.svg)

`spring-boot-starter-web`이 전이적으로 끌어오는 주요 의존성입니다.

```
spring-boot-starter-web
├── spring-boot-starter                   ← 스프링 부트 핵심
│   ├── spring-boot                       ← SpringApplication, ApplicationContext
│   ├── spring-boot-autoconfigure         ← 모든 Auto-Configuration 클래스
│   └── spring-boot-starter-logging       ← Logback + SLF4J
├── spring-web                            ← RestTemplate, 웹 MVC 기반 클래스
├── spring-webmvc                         ← DispatcherServlet, @Controller 지원
├── spring-boot-starter-tomcat            ← 내장 Tomcat
│   └── tomcat-embed-core
└── spring-boot-starter-json              ← Jackson 자동 설정
    └── jackson-databind
```

직접 `jackson-databind`나 `tomcat-embed-core`를 의존성에 추가하지 않아도 되는 이유가 여기에 있습니다.

## BOM — 버전 통합 관리의 비밀

`spring-boot-starter-web`을 추가할 때 버전을 명시하지 않아도 됩니다. 이는 **BOM(Bill of Materials)**이 동작하기 때문입니다.

```groovy
// build.gradle — 버전을 명시하지 않아도 됨
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-security'
}
```

`spring-boot-dependencies` BOM이 모든 Spring 생태계 라이브러리의 버전을 중앙에서 관리합니다. `io.spring.dependency-management` Gradle 플러그인이 이 BOM을 임포트합니다.

```groovy
// build.gradle — 플러그인이 BOM을 임포트
plugins {
    id 'org.springframework.boot' version '3.3.0'
    id 'io.spring.dependency-management' version '1.1.4'
    id 'java'
}
```

BOM 덕분에 `hibernate-core`, `jackson-databind`, `logback-classic` 등 수십 개 라이브러리의 버전을 **Spring Boot가 검증한 호환 버전으로** 자동 선택합니다. "버전 충돌로 `NoSuchMethodError`가 발생했다"는 문제의 99%는 BOM 없이 버전을 혼합할 때 발생합니다.

## 내장 Tomcat을 Jetty로 교체

Starter 구조를 이해하면 내장 서버를 쉽게 교체할 수 있습니다.

```groovy
dependencies {
    implementation('org.springframework.boot:spring-boot-starter-web') {
        exclude group: 'org.springframework.boot',
                module: 'spring-boot-starter-tomcat'
    }
    implementation 'org.springframework.boot:spring-boot-starter-jetty'
}
```

`starter-web`에서 Tomcat Starter를 제외하고 Jetty Starter를 추가하면 됩니다. 코드 변경은 없습니다. 이것이 Starter 추상화의 힘입니다.

## 커스텀 Starter 만들기

팀 내 공통 기능(슬랙 알림, 내부 인증, 감사 로그 등)을 Starter로 패키징하면 여러 프로젝트에서 쉽게 재사용할 수 있습니다.

![커스텀 Starter 코드 구조](/assets/posts/springboot-starter-structure-code.svg)

공식 권장 구조는 **두 모듈**입니다.

```
paldyn-slack/
├── slack-autoconfigure/          ← Auto-Configuration 클래스 + 메타데이터
│   └── src/main/
│       ├── java/
│       │   └── io/paldyn/slack/
│       │       ├── SlackAutoConfiguration.java
│       │       └── SlackProperties.java
│       └── resources/
│           └── META-INF/spring/
│               └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
└── paldyn-slack-spring-boot-starter/   ← 의존성 묶음만 선언 (코드 없음)
    └── build.gradle
```

**왜 두 모듈인가?** `autoconfigure` 모듈은 `optional` 의존성으로만 참조합니다. Auto-Configuration 클래스가 포함된 모듈을 사용자가 직접 참조할 수도 있고, 아닐 수도 있기 때문입니다. `starter` 모듈은 그 `autoconfigure`를 `api` 의존성으로 묶어서 사용자가 starter 하나만 추가해도 모든 것이 동작하게 만듭니다.

```java
// SlackAutoConfiguration.java
@AutoConfiguration
@ConditionalOnClass(SlackClient.class)
@EnableConfigurationProperties(SlackProperties.class)
public class SlackAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public SlackClient slackClient(SlackProperties props) {
        return SlackClient.builder()
            .token(props.getToken())
            .channel(props.getDefaultChannel())
            .build();
    }
}
```

```java
// SlackProperties.java
@ConfigurationProperties(prefix = "slack")
public class SlackProperties {
    private String token;
    private String defaultChannel = "#general";
    // Getter / Setter
}
```

```
# META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
io.paldyn.slack.SlackAutoConfiguration
```

이 세 파일로 커스텀 Starter의 핵심이 완성됩니다.

## 설정 메타데이터 — IDE 자동완성 지원

커스텀 Starter의 사용성을 높이려면 `@ConfigurationProperties`에 대한 메타데이터를 생성해야 합니다.

```groovy
// slack-autoconfigure/build.gradle
dependencies {
    annotationProcessor 'org.springframework.boot:spring-boot-configuration-processor'
    compileOnly 'org.springframework.boot:spring-boot-autoconfigure'
}
```

빌드 시 `META-INF/spring-configuration-metadata.json`이 자동 생성되며, 이를 사용하는 프로젝트의 `application.yml`에서 `slack.token`, `slack.default-channel`에 대한 자동완성과 문서가 표시됩니다.

## Starter vs AutoConfiguration 모듈 사용 규칙

| 상황 | 추가할 의존성 |
|---|---|
| 일반 프로젝트에서 사용 | `{이름}-spring-boot-starter` |
| 다른 AutoConfigure 모듈에서 참조 | `{이름}-spring-boot-autoconfigure` (optional) |
| 테스트에서만 사용 | `testImplementation '{이름}-spring-boot-starter'` |

`optional` 의존성은 전이적으로 전파되지 않습니다. 사용자가 명시적으로 선택할 때만 활성화됩니다.

## 실무에서 Starter를 활용하는 방법

**1. 내부 라이브러리 Starter화**: 팀 공통 예외 처리, 공통 응답 포맷, 공통 감사 로그를 Starter로 만들어 사내 Maven 저장소에 배포합니다.

**2. 제3자 라이브러리 Starter 래핑**: 공식 Spring Boot Starter가 없는 라이브러리(특정 SDK 등)를 사내에서 Starter로 래핑해 팀 내 사용성을 높입니다.

**3. 테스트 전용 Starter**: `test-autoconfigure` 모듈처럼 테스트 전용 Auto-Configuration을 별도 Starter로 분리합니다.

## 정리

- Starter = 코드 없는 의존성 묶음 선언 — 실제 동작은 끌려오는 라이브러리와 Auto-Configuration이 담당
- BOM(`spring-boot-dependencies`)이 전체 Spring 생태계 의존성 버전을 검증된 조합으로 관리
- 내장 서버 교체: starter 제외 후 원하는 starter 추가 — 코드 변경 없음
- 커스텀 Starter = `autoconfigure` 모듈 + `starter` 모듈 두 개 구조가 공식 권장
- `AutoConfiguration.imports`에 클래스 등록, `@ConditionalOnMissingBean`으로 오버라이드 허용

---

**지난 글:** [Spring Boot Auto-Configuration 동작 원리 완전 정복](/posts/springboot-autoconfiguration/)

**다음 글:** [Spring Boot 내장 서버 완전 정복](/posts/springboot-embedded-server/)

<br>
읽어주셔서 감사합니다. 😊
