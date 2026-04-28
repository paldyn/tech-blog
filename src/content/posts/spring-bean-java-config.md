---
title: "자바로 빈 설정하기 — @Configuration과 @Bean"
description: "XML 없이 순수 자바 코드로 스프링 빈을 정의하는 방법을 알아봅니다. @Configuration의 CGLIB 프록시 동작 원리, @Bean 옵션, @Import, @Profile, proxyBeanMethods 등을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["spring", "configuration", "bean", "java-config", "cglib", "proxy", "import"]
featured: false
draft: false
---

[지난 글](/posts/spring-bean-xml-config/)에서 XML로 빈을 설정하는 방법을 살펴봤습니다. 이번에는 스프링 3.0에서 도입되고 Spring Boot가 전면 채택한 **자바 기반 설정**을 정리합니다. 타입 안전성, IDE 자동완성, 리팩터링 지원 등 XML이 줄 수 없는 이점이 이유입니다.

## @Configuration과 @Bean 기초

`@Configuration` 클래스는 스프링 컨테이너의 설정 지시서입니다. 내부 `@Bean` 메서드가 하나의 빈 정의에 해당합니다.

```java
@Configuration
public class AppConfig {

    @Bean
    public OrderService orderService() {
        // 생성자 주입: discountPolicy() 메서드 호출
        return new OrderServiceImpl(discountPolicy());
    }

    @Bean
    public DiscountPolicy discountPolicy() {
        return new RateDiscountPolicy();
    }
}
```

```java
// 컨테이너 생성 및 빈 사용
ApplicationContext ctx =
    new AnnotationConfigApplicationContext(AppConfig.class);

OrderService svc = ctx.getBean(OrderService.class);
svc.order("item-1", 10_000);
```

메서드 이름이 빈의 기본 이름이 됩니다. `discountPolicy()` 메서드는 빈 이름 `"discountPolicy"`로 등록됩니다.

## CGLIB 프록시 — 싱글톤을 보장하는 방법

`orderService()` 내부에서 `discountPolicy()`를 직접 호출한다면, 매 호출마다 `new RateDiscountPolicy()`가 실행될 것 같지만 실제로는 그렇지 않습니다.

![@Configuration CGLIB 프록시 동작 원리](/assets/posts/spring-bean-java-config-proxy.svg)

스프링은 `@Configuration` 클래스를 CGLIB으로 상속한 **프록시 서브클래스**를 실제로 컨테이너에 등록합니다. 이 프록시는 모든 `@Bean` 메서드 호출을 가로채어 컨테이너 캐시를 먼저 확인합니다.

- 캐시에 없으면 → 원본 메서드를 실행해 빈을 생성하고 등록
- 캐시에 있으면 → 새 인스턴스를 만들지 않고 캐시된 빈 반환

따라서 `discountPolicy()`를 몇 번 호출해도 항상 같은 싱글톤 인스턴스가 반환됩니다.

### proxyBeanMethods = false (Lite Mode)

프록시 오버헤드 없이 빠른 기동이 필요하면 `proxyBeanMethods=false`를 설정합니다.

```java
@Configuration(proxyBeanMethods = false)  // Lite Mode
public class InfraConfig {

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:h2:mem:testdb");
        return ds;
    }
}
```

이 경우 `@Bean` 메서드 간 내부 호출로는 싱글톤이 보장되지 않습니다. 빈끼리 의존 관계가 없는 인프라 설정(`DataSource`, `RestTemplate` 등)에만 사용하세요. Spring Boot의 `AutoConfiguration` 클래스 대부분이 Lite Mode를 씁니다.

## Java Config vs XML Config

![Java Config vs XML Config 비교](/assets/posts/spring-bean-java-config-vs-xml.svg)

## @Bean 세부 옵션

```java
@Bean(
    name       = {"orderSvc", "orderService"},  // 빈 이름 (복수)
    initMethod = "init",          // 초기화 메서드
    destroyMethod = "cleanup"     // 소멸 메서드
)
@Scope("prototype")               // 스코프 지정
@Lazy                             // 지연 초기화
public OrderService orderService() {
    return new OrderServiceImpl(discountPolicy());
}
```

`@Bean`의 `destroyMethod`는 기본값이 `"(inferred)"`입니다. `close` 또는 `shutdown` 이름의 메서드를 자동으로 소멸 콜백으로 감지합니다. 이를 막으려면 `destroyMethod = ""`로 명시합니다.

## 설정 클래스 분리와 @Import

설정을 도메인별로 나누고 `@Import`로 합칩니다.

```java
@Configuration
public class DataSourceConfig {
    @Bean
    public DataSource dataSource() { ... }
}

@Configuration
public class ServiceConfig {
    @Bean
    public OrderService orderService(
            DiscountPolicy discountPolicy) { // 파라미터로 의존성 주입
        return new OrderServiceImpl(discountPolicy);
    }
}

// 루트 설정 클래스에서 합치기
@Configuration
@Import({DataSourceConfig.class, ServiceConfig.class})
public class AppConfig {
}
```

`@Bean` 메서드에 파라미터를 선언하면 스프링이 해당 타입의 빈을 자동으로 주입합니다. 이 방식은 `@Configuration` 간 직접 메서드 호출 없이 의존성을 연결하므로 Lite Mode에서도 안전합니다.

## @Profile로 환경별 빈 교체

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @Profile("local")
    public DataSource h2DataSource() {
        return new EmbeddedDatabaseBuilder()
            .setType(EmbeddedDatabaseType.H2)
            .build();
    }

    @Bean
    @Profile("prod")
    public DataSource hikariDataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(System.getenv("DB_URL"));
        return ds;
    }
}
```

활성 프로파일은 `spring.profiles.active=prod`(application.properties) 또는 JVM 옵션 `-Dspring.profiles.active=prod`로 지정합니다.

## @PropertySource로 외부 프로퍼티 로드

```java
@Configuration
@PropertySource("classpath:app.properties")
public class AppConfig {

    @Value("${smtp.host}")
    private String smtpHost;

    @Bean
    public EmailSender emailSender() {
        return new EmailSender(smtpHost);
    }
}
```

`@PropertySource`는 지정한 파일을 `Environment`에 추가합니다. `${...}` 플레이스홀더는 `PropertySourcesPlaceholderConfigurer` 빈이 처리하는데, Spring Boot는 이 빈을 자동으로 등록합니다.

## 정리

- `@Configuration` + `@Bean`은 XML을 대체하는 타입 안전한 자바 설정 방식입니다.
- `@Configuration`에는 CGLIB 프록시가 적용돼 `@Bean` 메서드 간 호출에서도 싱글톤이 보장됩니다.
- `proxyBeanMethods=false`(Lite Mode)는 프록시 없이 빠르게 기동하지만 메서드 간 호출로 싱글톤을 보장받을 수 없습니다.
- `@Import`로 설정 클래스를 조합하고, `@Profile`로 환경별 빈을 교체합니다.
- Spring Boot에서는 대부분 `@SpringBootApplication` 아래에 `@Configuration`이 자동으로 활성화됩니다.

---

**지난 글:** [XML로 빈 설정하기 — \<bean\> 태그 완전 정복](/posts/spring-bean-xml-config/)

**다음 글:** [컴포넌트 스캔 — @ComponentScan과 스테레오타입 애노테이션](/posts/spring-component-scan/)

<br>
읽어주셔서 감사합니다. 😊
