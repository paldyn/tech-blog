---
title: "Spring 역사 — 탄생부터 Spring 6까지 20년의 여정"
description: "Spring Framework의 탄생 배경부터 Spring Boot의 등장, 그리고 Jakarta EE로의 전환을 담은 Spring 6까지 주요 버전별 변화를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Spring Boot", "Spring 6", "Jakarta EE", "역사", "버전", "마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/spring-ecosystem-map/)에서 Spring 생태계 전체 지도를 살펴봤다. 이번에는 그 지도가 어떻게 만들어졌는지, 즉 Spring의 역사를 따라가 보겠다. 기술의 역사를 이해하면 현재 설계 결정의 이유를 더 잘 파악할 수 있고, 마이그레이션 같은 실무 상황에서도 자신감이 생긴다.

## Spring이 탄생한 맥락: EJB의 시대

2000년대 초반 Java 엔터프라이즈 개발의 표준은 **EJB(Enterprise JavaBeans)**였다. EJB는 분산 트랜잭션, 보안, 원격 호출 같은 기업용 기능을 규격화했지만 실제 사용은 매우 복잡했다.

```java
// EJB 시절의 전형적인 코드 — 단순 비즈니스 로직에도 방대한 의식이 필요
public interface UserServiceHome extends EJBHome {
    UserService create() throws RemoteException, CreateException;
}

public interface UserService extends EJBObject {
    User findById(Long id) throws RemoteException;
}

public class UserServiceBean implements SessionBean {
    private SessionContext ctx;

    public void setSessionContext(SessionContext ctx) {
        this.ctx = ctx;  // EJB 컨테이너 의무 구현
    }
    // ejbCreate, ejbRemove, ejbActivate, ejbPassivate 모두 구현 필수
}
```

이 복잡성에 반기를 들고 2002년 Rod Johnson이 저서 『Expert One-on-One J2EE Design and Development』에서 "POJO만으로도 엔터프라이즈 앱을 만들 수 있다"는 아이디어를 코드로 증명했다. 그 코드가 발전해 2003년 Juergen Hoeller, Yann Caroff와 함께 SourceForge에 **Spring Framework**가 공개되었다.

## 타임라인: 주요 버전 변화

![Spring 역사 타임라인](/assets/posts/spring-history-timeline.svg)

### Spring 1.x (2004): 출발

2004년 3월 Spring 1.0이 공식 릴리스되었다. 핵심은 세 가지였다.

1. **IoC 컨테이너**: XML `<bean>` 설정으로 객체를 선언하고 Spring이 생성·조립
2. **AOP 프레임워크**: 트랜잭션, 로깅을 비즈니스 코드에서 분리
3. **JDBC 추상화**: `JdbcTemplate`으로 반복 코드 제거

```xml
<!-- Spring 1.x XML 설정 -->
<beans>
    <bean id="dataSource" class="org.apache.commons.dbcp.BasicDataSource">
        <property name="driverClassName" value="com.mysql.jdbc.Driver"/>
        <property name="url" value="jdbc:mysql://localhost/mydb"/>
    </bean>

    <bean id="userRepository" class="com.example.UserRepositoryImpl">
        <constructor-arg ref="dataSource"/>
    </bean>
</beans>
```

당시로선 혁명적이었다. EJB 의존 없이 순수 Java로 엔터프라이즈 기능을 구현할 수 있었다.

### Spring 2.x (2006–2007): 어노테이션의 등장

2006년 Spring 2.0은 XML 네임스페이스를 도입해 `<aop:config>`, `<tx:annotation-driven>` 같은 간결한 설정을 가능하게 했다. 2007년 Spring 2.5는 더 큰 변화를 가져왔다.

```java
// Spring 2.5 — @Component, @Autowired 등장
@Repository
public class UserRepositoryImpl implements UserRepository {
    // @Component로 스캔, @Autowired로 주입
    // XML에서 <bean> 선언 불필요
}

@Service
public class UserServiceImpl implements UserService {
    @Autowired
    private UserRepository userRepository;
}
```

`@Component`, `@Service`, `@Repository`, `@Controller` 어노테이션과 컴포넌트 스캔이 도입되어 XML 설정량을 대폭 줄일 수 있게 되었다.

### Spring 3.x (2009–2011): 순수 Java 설정 완성

Spring 3.0은 **Java 5 이상**을 기준으로 삼으며 제네릭, 어노테이션을 본격 활용했다. 가장 중요한 변화는 `@Configuration`과 `@Bean`이다.

```java
// Spring 3.0 — XML 없이 순수 Java로 설정
@Configuration
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:mysql://localhost/mydb");
        return ds;
    }

    @Bean
    public UserRepository userRepository(DataSource ds) {
        return new UserRepositoryImpl(ds);
    }
}
```

XML 한 줄 없이 전체 애플리케이션 설정이 가능해졌다. REST API를 위한 `@RestController`(Spring 3.0 이후)와 SpEL(Spring Expression Language)도 이 시기에 등장했다.

### Spring 4.x (2013): Java 8 준비, 유연성 강화

2013년 발표된 Spring 4.0은 Java 8 호환성을 준비하면서 여러 새 기능을 추가했다.

- `@Conditional`: 조건에 따른 Bean 등록 (Spring Boot 자동 설정의 기반)
- `@RestController`: `@Controller + @ResponseBody` 합성
- WebSocket 지원
- `@Lazy`, Groovy Bean DSL

```java
// @Conditional로 환경에 따라 Bean 조건부 등록
@Bean
@ConditionalOnMissingBean(EmailSender.class)
public EmailSender defaultEmailSender() {
    return new MockEmailSender();  // 프로덕션에 Bean 없으면 Mock 사용
}
```

### Spring Boot 1.0 (2014): 패러다임 전환

2014년 4월은 Spring 역사에서 가장 중요한 분기점이다. **Spring Boot 1.0**이 등장하면서 Spring 사용 방식이 완전히 바뀌었다.

```java
// Spring Boot 이전: web.xml, applicationContext.xml, Tomcat 설치...
// Spring Boot 이후: 이 한 줄로 시작
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

`spring-boot-starter-*` 의존성, Auto-configuration(`@ConditionalOnClass` 기반), 내장 Tomcat 덕분에 "설정 지옥"이 해소되었다. `application.properties` 파일 하나로 대부분의 설정을 처리할 수 있었다.

### Spring 5.x / Boot 2.0 (2017–2018): Reactive 혁명

Spring 5.0은 **Spring WebFlux**를 도입해 Reactive 프로그래밍을 공식 지원했다. Netty 기반의 논블로킹 I/O로 동시 처리 능력을 극적으로 높일 수 있었다.

```java
// Spring WebFlux: 논블로킹 Reactive 스타일
@RestController
public class UserController {

    @GetMapping("/users/{id}")
    public Mono<User> getUser(@PathVariable Long id) {
        return userService.findById(id);  // Mono: 0 or 1개 비동기 결과
    }

    @GetMapping("/users")
    public Flux<User> getAllUsers() {
        return userService.findAll();  // Flux: 0~N개 비동기 스트림
    }
}
```

Kotlin 공식 지원, HTTP/2, JUnit 5 통합도 이 버전에서 이루어졌다. Java 8이 최소 요구사항으로 확정되었다.

### Spring 6.0 / Boot 3.0 (2022): 현재 세대

![Spring Boot 2 vs 3 패키지 변화](/assets/posts/spring-history-migration.svg)

2022년 11월 동시 출시된 Spring 6.0과 Spring Boot 3.0은 가장 큰 breaking change를 포함하고 있다.

**Java 17 기준선**: Spring 6 이상은 Java 17 이상을 필요로 한다. Record, Sealed Class, Text Block 등 최신 언어 기능을 활용한다.

**javax.* → jakarta.*** 패키지 전환: Oracle이 Java EE를 Eclipse Foundation에 기증하면서 패키지 네임스페이스가 바뀌었다. 이는 Spring Boot 2→3 마이그레이션의 가장 큰 작업이다.

```java
// Spring Boot 3.x에서 달라진 주요 import
// 구: import javax.persistence.Entity;
// 신: import jakarta.persistence.Entity;

// 구: import javax.servlet.http.HttpServletRequest;
// 신: import jakarta.servlet.http.HttpServletRequest;

// 구: import javax.validation.Valid;
// 신: import jakarta.validation.Valid;
```

**GraalVM Native Image**: AOT(Ahead-of-Time) 컴파일로 JVM 없이 실행 가능한 네이티브 바이너리를 생성할 수 있다. 시작 시간이 밀리초 단위로 줄어든다.

**Problem Details (RFC 7807)**: 표준화된 오류 응답 형식을 `ProblemDetail` 클래스로 기본 지원한다.

**HTTP Interface Client**: `@HttpExchange` 어노테이션으로 HTTP 클라이언트를 인터페이스 선언만으로 구현한다(Feign 유사).

## Spring Boot 2 → 3 마이그레이션 체크리스트

현업에서 레거시 프로젝트를 Spring Boot 3으로 올리는 작업이 빈번하다. 핵심 체크 포인트는 다음과 같다.

| 항목 | Spring Boot 2.x | Spring Boot 3.x |
|---|---|---|
| Java 최소 버전 | Java 8 | Java 17 |
| 패키지 네임스페이스 | `javax.*` | `jakarta.*` |
| Spring Security Config | `WebSecurityConfigurerAdapter` (deprecated) | `SecurityFilterChain` Bean |
| Actuator 경로 | `/actuator/env` 기본 노출 | 기본 비노출, 명시 허용 |
| Properties 처리 | `@ConfigurationProperties` 완화 바인딩 | 엄격한 바인딩 기본 |

```java
// Spring Security 설정 — Boot 2 방식 (deprecated)
// @Configuration
// public class SecurityConfig extends WebSecurityConfigurerAdapter {
//     @Override
//     protected void configure(HttpSecurity http) { ... }
// }

// Spring Security 설정 — Boot 3 방식 (현재)
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http)
            throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .formLogin(Customizer.withDefaults());
        return http.build();
    }
}
```

## 앞으로의 방향

Spring 팀은 **Virtual Threads(Java 21, Project Loom)** 통합을 적극적으로 추진하고 있다. Spring Boot 3.2부터 WebMVC에서 Virtual Thread를 활성화할 수 있어, 기존 동기식 코드를 유지하면서도 Reactive에 버금가는 동시 처리 능력을 얻을 수 있다.

```yaml
# application.yml — Spring Boot 3.2+ Virtual Thread 활성화
spring:
  threads:
    virtual:
      enabled: true
```

또한 Spring AI, GraalVM Native Image 최적화, HTTP/3 지원이 주요 로드맵에 포함되어 있다.

## 정리

Spring의 역사를 한 줄로 요약하면, "복잡성을 줄이는 방향으로의 일관된 진화"다. EJB 시절의 복잡한 XML 설정에서 어노테이션으로, 다시 자동 설정으로, 그리고 이제 Native Image로 이어지는 흐름은 항상 개발자 생산성과 운영 효율을 높이는 방향을 향하고 있다.

다음 글에서는 실제 개발 환경을 구성하는 방법을 다룬다. JDK 17/21 설치, IntelliJ IDEA 설정, Maven과 Gradle 선택 기준, 첫 Spring Boot 프로젝트 생성까지 순서대로 안내한다.

---

**지난 글:** [Spring 생태계 맵 — 프로젝트 전체 지형도](/posts/spring-ecosystem-map/)

<br>
읽어주셔서 감사합니다. 😊
