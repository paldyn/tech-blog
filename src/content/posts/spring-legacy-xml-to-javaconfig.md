---
title: "XML 설정에서 Java Config로: Spring 레거시 현대화 완전 가이드"
description: "applicationContext.xml 기반의 레거시 Spring 프로젝트를 @Configuration Java Config로 안전하게 전환하는 4단계 마이그레이션 전략과 실전 코드를 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "Java Config", "XML설정", "레거시마이그레이션", "@Configuration", "@ImportResource", "현대화"]
featured: false
draft: false
---

[지난 글](/posts/spring-ai-intro/)에서 Spring AI를 통해 생성형 AI를 Spring 생태계에 통합하는 방법을 살펴봤다. 이번 글에서는 시리즈의 마무리로 여전히 많은 현장에서 만나는 레거시 XML 설정 코드를 현대적인 Java Config로 안전하게 전환하는 방법을 다룬다.

## 왜 아직도 XML 설정 코드가 남아 있는가

Spring은 2003년 탄생 이후 오랜 기간 XML을 설정의 기본 수단으로 사용했다. 프로젝트가 2010년대 이전에 시작됐거나, 외부 라이브러리가 XML 기반 설정을 제공했거나, 팀의 관성이 강한 경우 XML 설정 파일이 수십~수백 개에 달하는 레거시 코드베이스가 여전히 운영 환경을 지탱하고 있다.

XML 설정이 나쁜 것은 아니다. 하지만 세 가지 명확한 단점이 있다. 첫째, 타입 안전성이 없어 오타로 인한 런타임 오류가 발생한다. 둘째, IDE의 리팩토링 지원이 제한적이다. 셋째, Spring Boot와의 통합이 불편하다. Java Config로 전환하면 이 세 가지를 모두 해결할 수 있다.

## XML vs Java Config: 무엇이 달라지나

![XML 설정 vs Java Config 비교](/assets/posts/spring-legacy-xml-to-javaconfig-comparison.svg)

동일한 빈 설정을 XML과 Java Config로 표현하면 차이가 극명하다.

```xml
<!-- applicationContext.xml (XML 방식) -->
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="...">

    <bean id="userService" class="com.example.UserServiceImpl">
        <property name="userRepository" ref="userRepository"/>
    </bean>

    <bean id="userRepository" class="com.example.JpaUserRepository">
        <property name="dataSource" ref="dataSource"/>
    </bean>
</beans>
```

```java
// AppConfig.java (Java Config 방식)
@Configuration
public class AppConfig {

    @Bean
    public UserService userService() {
        return new UserServiceImpl(userRepository());
    }

    @Bean
    public UserRepository userRepository() {
        return new JpaUserRepository(dataSource());
    }
}
```

Java Config에서 빈 간 의존성은 메서드 호출로 표현된다. Spring은 `@Bean` 메서드를 프록시로 감싸기 때문에 `userRepository()`를 여러 번 호출해도 항상 동일한 싱글턴 인스턴스가 반환된다.

## 4단계 마이그레이션 전략

![XML → Java Config 마이그레이션 단계](/assets/posts/spring-legacy-xml-to-javaconfig-migration.svg)

대규모 레거시 코드베이스를 한 번에 전환하는 것은 위험하다. 아래 4단계 점진적 전환 전략을 사용하면 리스크를 최소화할 수 있다.

### Step 1: 현황 파악

마이그레이션 전에 전체 XML 파일 목록, 빈 의존 관계, 현재 테스트 커버리지를 문서화한다.

```bash
# XML 설정 파일 목록 추출
find src/main/resources -name "*.xml" | grep -v "mapper"

# 각 XML의 빈 개수 확인
grep -c "<bean" src/main/resources/applicationContext*.xml
```

테스트 커버리지가 낮다면 마이그레이션 전에 먼저 테스트를 보강한다. 마이그레이션 후 동작 변화를 검증할 수 없으면 안전한 전환이 불가능하다.

### Step 2: @ImportResource로 공존 단계 구성

Java Config 클래스를 만들되, 기존 XML을 `@ImportResource`로 임포트한다. 이 단계에서는 XML과 Java Config가 공존한다.

```java
@Configuration
@ImportResource("classpath:applicationContext.xml")
public class MigrationConfig {

    // XML에서 관리하는 빈도 @Autowired로 주입받을 수 있다
    @Autowired
    private DataSource dataSource;

    // 새로 추가하는 빈은 @Bean으로 정의
    @Bean
    public UserEventListener userEventListener() {
        return new UserEventListener();
    }
}
```

이 단계에서 애플리케이션이 정상 동작하는지 확인한다. 문제가 없으면 Step 3로 진행한다.

### Step 3: 모듈별 빈 마이그레이션

XML 빈을 하나씩, 또는 관련 빈 묶음 단위로 `@Bean` 메서드로 이전한다. 이전한 빈은 XML에서 제거하고, 회귀 테스트를 실행해 동작을 검증한다.

```java
@Configuration
public class DataConfig {

    @Value("${spring.datasource.url}")
    private String url;

    @Value("${spring.datasource.username}")
    private String username;

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(url);
        ds.setUsername(username);
        return ds;
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
}
```

XML 파일의 `<bean>` 수가 0이 될 때까지 반복한다.

### Step 4: XML 완전 제거

모든 빈이 Java Config로 이전되면 `@ImportResource` 어노테이션과 XML 파일을 삭제한다. `AnnotationConfigApplicationContext`만으로 컨텍스트를 구동한다.

```java
// 이전: XML 기반 부트스트랩
ApplicationContext ctx =
    new ClassPathXmlApplicationContext("applicationContext.xml");

// 이후: Java Config 기반 부트스트랩
ApplicationContext ctx =
    new AnnotationConfigApplicationContext(AppConfig.class);
```

Spring Boot 환경이라면 별도 컨텍스트 생성 코드 없이 `@SpringBootApplication`이 자동으로 모든 `@Configuration` 클래스를 스캔한다.

## 자주 마주치는 함정

**1. 순환 참조 오류**

XML에서는 숨겨져 있던 빈 간 순환 참조가 Java Config 전환 후 명시적 메서드 호출로 인해 컴파일 타임에 발견되는 경우가 있다. 이는 좋은 일이다. 인터페이스 추출이나 `@Lazy` 어노테이션으로 해결한다.

**2. 빈 이름 불일치**

XML의 `id` 속성이 빈 이름이었지만, Java Config에서는 메서드 이름이 빈 이름이 된다. 다른 모듈에서 `@Qualifier("beanName")`으로 참조하는 코드가 있다면 이름이 일치하는지 확인한다.

```java
// 빈 이름을 명시적으로 지정하려면
@Bean("userService")  // XML의 id="userService"와 동일하게
public UserService userServiceBean() {
    return new UserServiceImpl();
}
```

**3. PropertyPlaceholder 설정**

XML에서 `<context:property-placeholder location="classpath:app.properties"/>`로 처리하던 것은 Java Config에서 `@PropertySource`로 대체한다.

```java
@Configuration
@PropertySource("classpath:app.properties")
public class AppConfig {

    @Value("${api.timeout:5000}")
    private int apiTimeout;
}
```

Spring Boot라면 `application.properties`가 자동으로 로드되므로 별도 `@PropertySource`가 필요 없다.

## 마이그레이션 효과 측정

전환 완료 후 다음 지표를 비교해 마이그레이션의 가치를 확인한다.

- **컴파일 타임 오류 검출**: IDE에서 빈 이름 오타, 타입 불일치를 즉시 발견
- **리팩토링 용이성**: 클래스 이름 변경 시 XML 파일 검색 불필요
- **IDE 자동완성**: `@Autowired` 주입 시 IDE가 후보 빈 목록을 제안
- **Spring Boot 통합**: 자동 설정, 조건부 빈, 프로파일 관리가 자연스럽게 연동

XML 설정 코드베이스를 Java Config로 전환하는 것은 단순한 형식 변경이 아니다. 타입 안전성, 리팩토링 용이성, 현대 Spring 생태계와의 통합이라는 세 가지 구조적 개선을 동시에 얻는 투자다.

---

**지난 글:** [Spring AI 입문: ChatClient, RAG, 도구 호출까지](/posts/spring-ai-intro/)

**다음 글:** [Spring 4 · 5 · 6 핵심 변경사항 총정리](/posts/spring-version-4-5-6-changes/)

<br>
읽어주셔서 감사합니다. 😊
