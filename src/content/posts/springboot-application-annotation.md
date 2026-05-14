---
title: "@SpringBootApplication 완전 정복 — 세 애노테이션의 합성과 동작 원리"
description: "@SpringBootApplication이 @SpringBootConfiguration, @EnableAutoConfiguration, @ComponentScan 세 애노테이션을 합성한 구조를 완전히 이해합니다. 각 애노테이션의 역할과 동작 원리, exclude로 Auto-Configuration 제외, scanBasePackages로 스캔 범위 조정, 메인 클래스 위치가 중요한 이유, SpringApplication.run()이 하는 일, 그리고 테스트에서 @SpringBootTest와의 관계까지 실무 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "SpringBootApplication", "EnableAutoConfiguration", "ComponentScan", "SpringBootConfiguration", "메타애노테이션", "SpringApplication"]
featured: false
draft: false
---

[지난 글](/posts/springboot-initializr/)에서 Spring Initializr로 프로젝트 골격을 빠르게 생성하는 방법을 살펴봤습니다. Initializr가 생성한 프로젝트를 열면 메인 클래스에 `@SpringBootApplication`이 붙어 있습니다. 이 애노테이션 하나가 Spring Boot 애플리케이션 전체를 어떻게 동작시키는지 구조적으로 파헤칩니다.

## @SpringBootApplication은 합성 애노테이션

`@SpringBootApplication`은 **메타 애노테이션**(composed annotation)입니다. 세 개의 핵심 애노테이션을 하나로 합쳐 편의성을 제공합니다.

```java
// Spring Boot 내부 정의 (단순화)
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(excludeFilters = {
    @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class)
})
public @interface SpringBootApplication {
    // ...
}
```

![SpringBootApplication 분해 구조](/assets/posts/springboot-application-annotation-concept.svg)

세 애노테이션은 독립적인 역할을 합니다.

## ① @SpringBootConfiguration

```java
@Configuration   // ← @SpringBootConfiguration은 @Configuration을 확장
public @interface SpringBootConfiguration { }
```

`@SpringBootConfiguration`은 `@Configuration`을 상속한 특수 버전입니다. 이 클래스가 Spring ApplicationContext의 **Bean 설정 소스**임을 선언합니다. 내부에 `@Bean` 메서드를 선언해 Bean을 등록할 수 있습니다.

`@Configuration`과 실질적으로 동일하지만, Spring Boot 테스트 인프라가 `@SpringBootConfiguration`이 붙은 클래스를 **기본 설정 클래스**로 인식합니다. `@SpringBootTest`가 테스트 컨텍스트를 구성할 때 이 클래스를 자동으로 찾습니다.

```java
@SpringBootApplication
public class DemoApplication {

    // @Bean 메서드를 메인 클래스에 직접 선언할 수도 있음
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule());
    }

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

실무에서는 Bean 선언이 많아지면 별도 `@Configuration` 클래스로 분리하는 것을 권장합니다. 메인 클래스는 진입점 역할에만 집중하는 것이 가독성에 좋습니다.

## ② @EnableAutoConfiguration

Auto-Configuration을 활성화합니다. Spring Boot가 클래스패스를 분석하고 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`에 등록된 자동 설정 클래스를 로딩해 `@Conditional` 조건을 평가한 뒤 Bean을 등록합니다.

특정 Auto-Configuration을 비활성화해야 할 때는 `exclude` 속성을 사용합니다.

```java
// DataSource Auto-Configuration 제외 — 직접 DataSource를 설정하거나
// DB 없이 실행되어야 하는 경우(배치 등)
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,
    DataSourceTransactionManagerAutoConfiguration.class,
    HibernateJpaAutoConfiguration.class
})
public class BatchOnlyApplication {
    public static void main(String[] args) {
        SpringApplication.run(BatchOnlyApplication.class, args);
    }
}
```

클래스 레퍼런스 없이 문자열로도 제외할 수 있습니다.

```java
@SpringBootApplication(excludeName = {
    "org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration"
})
```

또는 `application.properties`에서 제외 목록을 관리합니다.

```properties
spring.autoconfigure.exclude=\
  org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration
```

## ③ @ComponentScan

`@ComponentScan`은 **현재 패키지와 그 하위 패키지**를 대상으로 `@Component`, `@Service`, `@Repository`, `@Controller`, `@RestController` 등 컴포넌트 계열 클래스를 찾아 Bean으로 등록합니다.

**메인 클래스의 패키지 위치가 곧 스캔 루트**입니다. `com.example.DemoApplication`에 `@SpringBootApplication`이 있다면 `com.example.**` 하위 전체가 스캔됩니다.

```
com.example/
├── DemoApplication.java          ← @SpringBootApplication (스캔 루트)
├── controller/
│   └── UserController.java       ← @RestController → 스캔됨
├── service/
│   └── UserService.java          ← @Service → 스캔됨
└── repository/
    └── UserRepository.java       ← @Repository → 스캔됨
```

메인 클래스를 하위 패키지에 두면 상위 패키지의 Bean이 스캔되지 않습니다.

```
com.example/
├── controller/                   ← 스캔 안 됨!
└── api/
    └── DemoApplication.java      ← 스캔 루트가 com.example.api
```

이 문제가 발생하면 `scanBasePackages`로 스캔 대상을 명시합니다.

```java
@SpringBootApplication(scanBasePackages = {"com.example"})
public class DemoApplication { }

// 또는 패키지 마커 클래스 방식
@SpringBootApplication(scanBasePackageClasses = {RootPackageMarker.class})
public class DemoApplication { }
```

![SpringBootApplication 활용 코드 패턴](/assets/posts/springboot-application-annotation-code.svg)

## SpringApplication.run()이 하는 일

`main()` 메서드에서 `SpringApplication.run()`을 호출하면 다음 순서로 초기화됩니다.

```java
public static void main(String[] args) {
    SpringApplication.run(DemoApplication.class, args);
}
```

```
1. SpringApplication 객체 생성
   - 웹 환경 감지 (SERVLET / REACTIVE / NONE)
   - ApplicationContextInitializer 목록 로딩
   - ApplicationListener 목록 로딩

2. ApplicationStartingEvent 발행

3. Environment 준비
   - application.properties / application.yml 로딩
   - 프로파일 활성화

4. ApplicationPreparedEvent 발행

5. ApplicationContext 생성 및 갱신(refresh)
   - @SpringBootConfiguration 클래스 처리 (@Bean 등록)
   - @EnableAutoConfiguration 처리 (자동 Bean 등록)
   - @ComponentScan 처리 (컴포넌트 스캔)
   - 내장 Tomcat 기동 (웹 환경)

6. ApplicationStartedEvent 발행

7. CommandLineRunner / ApplicationRunner 실행

8. ApplicationReadyEvent 발행
   → 애플리케이션 준비 완료
```

`SpringApplication`을 직접 생성해 설정할 수도 있습니다.

```java
public static void main(String[] args) {
    SpringApplication app = new SpringApplication(DemoApplication.class);
    app.setBannerMode(Banner.Mode.OFF);          // 배너 끄기
    app.setDefaultProperties(Map.of(             // 기본 프로퍼티
        "server.port", "8080"
    ));
    app.addListeners(new MyApplicationListener()); // 이벤트 리스너 추가
    app.run(args);
}
```

## @SpringBootTest와의 관계

테스트에서 `@SpringBootTest`를 사용하면 `@SpringBootApplication`(정확히는 `@SpringBootConfiguration`)이 붙은 클래스를 자동으로 찾아 전체 Spring ApplicationContext를 로딩합니다.

```java
@SpringBootTest  // 자동으로 DemoApplication.class를 찾아 전체 컨텍스트 로딩
class DemoApplicationTests {

    @Autowired
    private UserService userService;

    @Test
    void contextLoads() {
        // 컨텍스트가 정상 로딩되면 통과
    }
}
```

`@SpringBootTest(classes = DemoApplication.class)`로 명시할 수도 있습니다. 테스트 속도를 높이려면 `@WebMvcTest`, `@DataJpaTest` 같은 슬라이스 테스트를 사용합니다. 슬라이스 테스트는 필요한 레이어만 부분적으로 로딩하므로 `@SpringBootTest`보다 훨씬 빠릅니다.

## 자주 하는 실수

### 메인 클래스 위치 오류

```
com.example/
├── Application.java          ← 여기에 @SpringBootApplication
└── user/
    ├── UserController.java   ← 스캔됨
    └── UserService.java      ← 스캔됨

# 잘못된 위치
com.example/
└── user/
    ├── Application.java      ← 여기에 @SpringBootApplication이면
    └── UserController.java   ← com.example.user 하위만 스캔
```

### @SpringBootApplication 중복 선언

멀티 모듈 프로젝트에서 각 모듈에 `@SpringBootApplication`을 붙이면 `@ComponentScan`이 겹쳐 Bean 등록이 중복될 수 있습니다. 실행 모듈에만 선언하고 나머지 모듈은 `@Configuration`으로 관리합니다.

### exclude를 properties에서만 사용

`spring.autoconfigure.exclude` 프로퍼티는 런타임 환경(프로파일)마다 다르게 설정할 수 있어 유연합니다. 코드의 `exclude` 속성은 컴파일 타임에 고정됩니다. 환경마다 다른 Auto-Configuration 제외가 필요하다면 프로퍼티 방식을 사용합니다.

## 정리

- `@SpringBootApplication` = `@SpringBootConfiguration` + `@EnableAutoConfiguration` + `@ComponentScan`
- `@SpringBootConfiguration`: Bean 설정 소스 선언 (`@Configuration` 확장)
- `@EnableAutoConfiguration`: 클래스패스 기반 Auto-Configuration 활성화, `exclude`로 제외 가능
- `@ComponentScan`: 현재 패키지 하위 자동 스캔 — 메인 클래스는 최상위 패키지에 위치해야 함
- `SpringApplication.run()`: 환경 준비 → 컨텍스트 생성 → 내장 서버 기동 순으로 초기화
- `@SpringBootTest`는 `@SpringBootConfiguration` 클래스를 자동으로 탐색해 전체 컨텍스트 로딩

---

**지난 글:** [Spring Initializr 완전 정복](/posts/springboot-initializr/)

<br>
읽어주셔서 감사합니다. 😊
