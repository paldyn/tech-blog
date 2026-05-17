---
title: "Spring Boot @Conditional — 조건부 Bean 등록 완전 정복"
description: "Spring Boot Auto-configuration의 핵심 메커니즘인 @Conditional 시리즈를 깊이 이해합니다. @ConditionalOnClass·@ConditionalOnMissingBean·@ConditionalOnProperty 원리와 커스텀 Condition 구현까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "Conditional", "AutoConfiguration", "ConditionalOnClass", "ConditionalOnMissingBean"]
featured: false
draft: false
---

[지난 글](/posts/springboot-configuration-properties/)에서 `@ConfigurationProperties`로 타입 안전하게 외부 설정을 바인딩하는 방법을 살펴봤습니다. 이번 글에서는 Spring Boot Auto-configuration이 어떻게 "필요한 경우에만" Bean을 등록하는지를 결정하는 `@Conditional` 메커니즘을 파헤칩니다. `@ConditionalOnClass` 한 줄이 어떻게 수백 줄의 `if-else` 를 대체하는지 이해하고 나면, Spring Boot의 마법이 사실 매우 논리적인 규칙의 조합임을 알게 됩니다.

## @Conditional이란

`@Conditional`은 특정 조건이 충족될 때만 Bean을 IoC 컨테이너에 등록하도록 지시하는 어노테이션입니다. Spring 4.0에서 도입됐고, Spring Boot는 이를 확장해 다양한 파생 어노테이션을 제공합니다.

```java
// 기본 Condition 인터페이스
@FunctionalInterface
public interface Condition {
    boolean matches(ConditionContext context,
                    AnnotatedTypeMetadata metadata);
}
```

`matches()`가 `true`를 반환하면 Bean이 등록되고, `false`면 조용히 건너뜁니다.

![@Conditional 조건 평가 흐름](/assets/posts/springboot-conditional-bean-flow.svg)

## 핵심 @Conditional 변형 6가지

### @ConditionalOnClass / @ConditionalOnMissingClass

클래스패스에 특정 클래스가 있을(없을) 때만 Bean을 등록합니다.

```java
@Configuration
@ConditionalOnClass(HikariDataSource.class)   // HikariCP가 있을 때만
public class HikariAutoConfiguration {
    // HikariCP 관련 Bean 설정
}
```

라이브러리를 추가하는 것만으로 기능이 활성화되는 "스타터 마법"의 핵심입니다. `spring-boot-starter-data-jpa`를 의존성에 추가하면 Hibernate 클래스가 클래스패스에 올라오고, `HibernateJpaAutoConfiguration`의 `@ConditionalOnClass(LocalContainerEntityManagerFactoryBean.class)`가 `true`가 되어 JPA가 자동으로 설정됩니다.

### @ConditionalOnBean / @ConditionalOnMissingBean

특정 Bean이 컨테이너에 있을(없을) 때만 등록합니다.

```java
@Bean
@ConditionalOnMissingBean(DataSource.class)  // DataSource Bean이 없을 때만
public DataSource defaultDataSource() {
    return new EmbeddedDatabaseBuilder()
        .setType(EmbeddedDatabaseType.H2)
        .build();
}
```

이것이 "사용자 Bean이 우선" 패턴입니다. 개발자가 직접 `DataSource` Bean을 정의하면 Auto-configuration의 기본 `DataSource`는 등록되지 않습니다. 오버라이드하기 위해 XML을 수정하거나 설정을 비활성화할 필요가 없습니다.

### @ConditionalOnProperty

`application.properties` / `application.yml`의 특정 프로퍼티 값에 따라 Bean을 등록합니다.

```yaml
# application.yml
app:
  cache:
    enabled: true
    type: redis
```

```java
@Bean
@ConditionalOnProperty(
    name = "app.cache.enabled",
    havingValue = "true",
    matchIfMissing = false   // 프로퍼티 없으면 false 처리
)
public CacheManager redisCacheManager(RedisConnectionFactory cf) {
    return RedisCacheManager.create(cf);
}
```

`matchIfMissing = true`로 설정하면 프로퍼티가 없을 때도 Bean을 등록합니다. 기능을 선택적으로 끄고 싶을 때 유용합니다.

### @ConditionalOnWebApplication / @ConditionalOnNotWebApplication

웹 컨텍스트(Servlet, Reactive) 여부에 따라 등록을 결정합니다.

```java
@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class WebMvcAutoConfiguration {
    // Servlet 기반 웹 애플리케이션에서만 MVC 설정
}
```

### @ConditionalOnResource

클래스패스 또는 파일 시스템에 특정 리소스가 있을 때만 등록합니다.

```java
@ConditionalOnResource(resources = "classpath:mybatis-config.xml")
```

## 커스텀 Condition 구현

내장 어노테이션으로 부족하다면 `Condition` 인터페이스를 직접 구현합니다.

```java
public class OnProductionCondition implements Condition {

    @Override
    public boolean matches(ConditionContext context,
                           AnnotatedTypeMetadata metadata) {
        String profile = context.getEnvironment()
            .getProperty("spring.profiles.active", "");
        return profile.contains("prod");
    }
}

// 사용
@Bean
@Conditional(OnProductionCondition.class)
public AlertService prodAlertService() {
    return new PagerDutyAlertService();
}
```

`ConditionContext`를 통해 `Environment`(프로퍼티), `BeanFactory`(이미 등록된 Bean), `ClassLoader`(클래스 존재 여부), `ResourceLoader`(리소스)에 모두 접근할 수 있습니다.

## 메타 어노테이션으로 재사용 가능한 조건 만들기

```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Conditional(OnProductionCondition.class)
public @interface ConditionalOnProduction {
    // 아무 속성도 없어도 됨
}

// 이제 @ConditionalOnProduction으로 간단히 사용
@Bean
@ConditionalOnProduction
public AlertService alertService() { ... }
```

![@Conditional 활용 패턴](/assets/posts/springboot-conditional-bean-code.svg)

## 조건 평가 순서와 주의사항

`@ConditionalOnBean` / `@ConditionalOnMissingBean`은 Bean 등록 순서에 민감합니다. Auto-configuration 클래스는 사용자 정의 `@Configuration` 이후에 처리되므로 대부분의 경우 안전하지만, Auto-configuration끼리 순서를 지정할 때는 `@AutoConfigureBefore` / `@AutoConfigureAfter`를 사용합니다.

```java
@AutoConfigureAfter(DataSourceAutoConfiguration.class)
@AutoConfigureBefore(JpaAutoConfiguration.class)
public class MyDataAutoConfiguration { ... }
```

## 디버깅 — 어떤 조건이 실패했는지 확인하기

```bash
# application.properties
debug=true

# 또는 JVM 옵션
-Ddebug
```

실행 시 콘솔에 **Conditions Evaluation Report**가 출력됩니다.

```
============================
CONDITIONS EVALUATION REPORT
============================

Positive matches:
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required classes ...

Negative matches:
-----------------
   ActiveMQAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required class
           'jakarta.jms.ConnectionFactory' (OnClassCondition)
```

어떤 Auto-configuration이 왜 등록됐고 왜 건너뛰어졌는지 한눈에 파악할 수 있습니다.

## 정리

| 어노테이션 | 조건 |
|-----------|------|
| `@ConditionalOnClass` | 클래스패스에 클래스 존재 |
| `@ConditionalOnMissingClass` | 클래스패스에 클래스 없음 |
| `@ConditionalOnBean` | 컨테이너에 Bean 존재 |
| `@ConditionalOnMissingBean` | 컨테이너에 Bean 없음 |
| `@ConditionalOnProperty` | 프로퍼티 값 일치 |
| `@ConditionalOnWebApplication` | 웹 컨텍스트 |
| `@ConditionalOnResource` | 리소스 존재 |
| `@Conditional(MyCondition.class)` | 커스텀 로직 |

`@ConditionalOnMissingBean`의 "사용자 Bean이 없을 때만" 패턴을 이해하면 Spring Boot 자동 설정의 99%가 설명됩니다. 다음 글에서는 이 원리를 활용해 직접 커스텀 스타터와 Auto-configuration을 만들어 봅니다.

---

**지난 글:** [Spring Boot @ConfigurationProperties 완전 정복](/posts/springboot-configuration-properties/)

**다음 글:** [커스텀 Spring Boot Starter & Auto-configuration 만들기](/posts/springboot-custom-autoconfigure-starter/)

<br>
읽어주셔서 감사합니다. 😊
