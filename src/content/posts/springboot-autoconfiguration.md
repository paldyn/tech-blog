---
title: "Spring Boot Auto-Configuration 동작 원리 완전 정복"
description: "Spring Boot Auto-Configuration이 어떻게 수백 개의 빈을 자동으로 등록하는지 내부 동작 원리를 완전히 이해합니다. @EnableAutoConfiguration, AutoConfiguration.imports, @Conditional 계열 애노테이션, 사용자 빈 우선 원칙, --debug 모드로 Auto-Configuration 보고서 분석, 그리고 특정 Auto-Configuration을 제외하는 방법까지 실무 중심으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "AutoConfiguration", "EnableAutoConfiguration", "Conditional", "SpringFactories", "AutoConfigurationImports", "자동구성", "내부원리"]
featured: false
draft: false
---

[지난 글](/posts/springboot-profiles/)에서 환경별 설정 분리를 위한 Profiles를 다뤘습니다. 이번에는 Spring Boot의 가장 강력한 특징이자 "설정 없이 바로 동작하는" 마법의 근원인 **Auto-Configuration 동작 원리**를 완전히 해부합니다.

## Auto-Configuration이란

`spring-boot-starter-web` 하나만 의존성에 추가하면 Tomcat이 내장되고, DispatcherServlet이 등록되고, JSON 변환기가 설정됩니다. 이것이 Auto-Configuration입니다.

핵심 원리는 단순합니다. **"클래스패스에 특정 라이브러리가 있으면, 그에 맞는 빈을 자동으로 등록한다."** 이 조건부 빈 등록 로직이 수백 개의 `@Configuration` 클래스에 담겨 있으며, Spring Boot가 기동 시 이를 일괄 처리합니다.

## 세 단계 동작 흐름

![Spring Boot Auto-Configuration 동작 원리](/assets/posts/springboot-autoconfiguration-concept.svg)

**1단계 — 후보 목록 수집**

`@EnableAutoConfiguration`이 트리거가 됩니다. `@SpringBootApplication` 안에 포함된 이 애노테이션이 활성화되면, Spring Boot는 클래스패스의 모든 JAR에서 Auto-Configuration 클래스 목록을 수집합니다.

- Spring Boot 2.x: `META-INF/spring.factories`의 `EnableAutoConfiguration` 키
- Spring Boot 3.x: `META-INF/spring/AutoConfiguration.imports` 파일

**2단계 — 조건(@Conditional) 평가**

수집된 후보 클래스 각각에 붙은 `@Conditional` 계열 애노테이션을 평가합니다. 조건이 충족되지 않는 클래스는 건너뜁니다.

**3단계 — 빈 등록**

모든 조건을 통과한 `@Configuration` 클래스가 스프링 컨텍스트에 로딩되고, 정의된 빈들이 등록됩니다.

## @Conditional 계열 애노테이션

![@Conditional 계열 애노테이션과 DataSourceAutoConfiguration 예시](/assets/posts/springboot-autoconfiguration-code.svg)

가장 자주 사용되는 조건들입니다.

```java
@AutoConfiguration
@ConditionalOnClass(DataSource.class)         // DataSource 클래스가 CP에 있을 때
@ConditionalOnMissingBean(DataSource.class)   // DataSource 빈이 아직 없을 때
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnProperty(
        prefix = "spring.datasource", name = "url")   // 설정 키가 존재할 때
    public DataSource dataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }
}
```

`@ConditionalOnMissingBean`이 핵심입니다. **사용자가 같은 타입의 빈을 먼저 등록하면 Auto-Configuration의 빈 등록이 건너뜁니다.** 이것이 커스터마이징 포인트입니다.

## Auto-Configuration 후보 파일 구조

Spring Boot 3.x 기준으로 `spring-boot-autoconfigure` JAR 내부의 구조를 살펴보면:

```
META-INF/spring/
└── org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

이 파일에 Auto-Configuration 클래스들이 줄바꿈으로 구분되어 나열됩니다.

```
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration
org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
org.springframework.boot.autoconfigure.cache.CacheAutoConfiguration
# ... 150개 이상
```

## --debug 모드로 Auto-Configuration 보고서 확인

어떤 Auto-Configuration이 적용됐고 어떤 것이 제외됐는지 확인하려면 `--debug` 플래그를 사용합니다.

```bash
java -jar app.jar --debug
# 또는
./gradlew bootRun --args='--debug'
```

애플리케이션 로그에 **Conditions Evaluation Report**가 출력됩니다.

```
============================
CONDITIONS EVALUATION REPORT
============================

Positive matches:   ← 조건 충족, 등록됨
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'javax.sql.DataSource' (...)

Negative matches:   ← 조건 미충족, 건너뜀
-----------------
   ActiveMQAutoConfiguration:
      - @ConditionalOnClass did not find required class 'javax.jms.ConnectionFactory'

Exclusions:         ← 사용자가 명시적으로 제외
-----------
   None
```

이 보고서를 읽으면 "왜 내 설정이 적용되지 않는가"를 빠르게 진단할 수 있습니다.

## Auto-Configuration 제외하기

특정 Auto-Configuration이 간섭한다면 명시적으로 제외합니다.

```java
// @SpringBootApplication의 exclude 속성
@SpringBootApplication(
    exclude = {
        DataSourceAutoConfiguration.class,
        SecurityAutoConfiguration.class
    }
)
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

또는 `application.yml`에서:

```yaml
spring:
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
```

DataSource 없이 Spring Boot를 구동하거나, Security 자동 설정 대신 직접 설정할 때 자주 씁니다.

## 사용자 빈이 항상 우선

Auto-Configuration은 **항상 사용자 설정보다 나중에 처리**됩니다. `@AutoConfiguration`은 내부적으로 `@Configuration(proxyBeanMethods = false)`이며, 일반 `@Configuration`이 먼저 로딩된 후 Auto-Configuration이 처리됩니다.

```java
// 이 빈이 있으면 DataSourceAutoConfiguration의 빈 등록이 건너뜀
@Configuration
public class MyDataSourceConfig {

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:mysql://custom-host/mydb");
        return ds;
    }
}
```

이 원칙을 이해하면 "Auto-Configuration이 내 설정을 무시한다"는 혼란에서 벗어날 수 있습니다. Auto-Configuration은 **기본값 제공자**입니다. 사용자 설정이 있으면 겸손하게 물러납니다.

## Auto-Configuration 순서 제어

여러 Auto-Configuration 사이의 실행 순서가 중요할 때 `@AutoConfigureBefore`, `@AutoConfigureAfter`를 사용합니다.

```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
public class JpaRepositoriesAutoConfiguration {
    // DataSource가 먼저 등록된 뒤 JPA 설정 진행
}
```

커스텀 Auto-Configuration 스타터를 만들 때 이 애노테이션으로 의존 관계를 명시합니다.

## 정리

- Auto-Configuration = 클래스패스 감지 → `@Conditional` 평가 → 빈 자동 등록
- Boot 3.x: `AutoConfiguration.imports` 파일이 후보 목록 역할
- `@ConditionalOnMissingBean`이 핵심 — 사용자 빈이 있으면 Auto-Configuration이 물러남
- `--debug` 플래그로 Conditions Evaluation Report 확인 → 문제 진단 가능
- `exclude` 속성이나 yml 설정으로 특정 Auto-Configuration 제외 가능

---

**지난 글:** [Spring Boot Profiles 완전 정복](/posts/springboot-profiles/)

**다음 글:** [Spring Boot Starter 구조 완전 정복](/posts/springboot-starter-structure/)

<br>
읽어주셔서 감사합니다. 😊
