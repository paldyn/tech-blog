---
title: "Spring이란 무엇인가 — Java 엔터프라이즈 개발의 판도를 바꾼 프레임워크"
description: "Spring Framework가 등장한 배경과 해결하고자 했던 문제, 핵심 철학인 POJO·IoC·DI·AOP의 기본 개념을 알기 쉽게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "Java", "IoC", "DI", "AOP", "POJO", "프레임워크"]
featured: false
draft: false
---

Java로 엔터프라이즈 애플리케이션을 개발해 본 적이 있다면, "코드 한 줄 짜기 위해 설정 파일 열 줄을 써야 하는" 답답함을 느껴본 적이 있을 것이다. Spring Framework는 바로 그 불편함에서 출발했다. 2003년 Rod Johnson이 처음 공개한 이 오픈 소스 프레임워크는 현재 Java 생태계에서 가장 널리 쓰이는 애플리케이션 프레임워크로 자리 잡았으며, Spring Boot·Spring Security·Spring Data 같은 방대한 프로젝트군을 거느리고 있다.

## Spring 이전의 세계: EJB와 J2EE의 무게

2000년대 초반 Java 엔터프라이즈 개발의 표준은 **J2EE(Java 2 Enterprise Edition)**였다. J2EE가 제공하는 EJB(Enterprise JavaBeans)는 트랜잭션·보안·분산 처리 같은 기업용 기능을 규격화했지만, 실제로 쓰기 위해서는 엄청난 양의 XML 설정과 인터페이스 구현이 필요했다. 간단한 비즈니스 로직 하나를 짜기 위해 Home Interface, Remote Interface, Bean Class, Deployment Descriptor까지 최소 4개의 파일을 작성해야 했고, EJB 컨테이너에 종속되어 단위 테스트조차 쉽지 않았다.

Rod Johnson은 저서 『Expert One-on-One J2EE Design and Development』(2002)에서 "대부분의 기업 애플리케이션은 EJB 없이도 충분히 구현 가능하다"고 주장하며, 서적에 포함된 예제 코드를 발전시켜 Spring 프레임워크를 탄생시켰다.

## Spring의 핵심 철학: POJO 기반 개발

Spring의 가장 중요한 원칙은 **POJO(Plain Old Java Object)** 기반 프로그래밍이다. 특정 프레임워크의 클래스를 상속하거나 특수 인터페이스를 구현하지 않아도 되는 평범한 Java 객체를 그대로 사용하자는 것이다.

```java
// POJO: 어떤 프레임워크도 상속하지 않는 순수 Java 클래스
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }
}
```

이 클래스에는 Spring 관련 import가 하나도 없다. 그럼에도 Spring 컨테이너에서 완벽하게 관리·동작한다. 덕분에 테스트 시에도 Spring 컨텍스트 없이 단순히 `new UserService(mockRepo)` 형태로 인스턴스를 만들 수 있다.

## Spring이 해결하는 세 가지 문제

![Spring Framework 계층 구조](/assets/posts/spring-what-is-spring-overview.svg)

### 1. 의존성 관리 복잡성 — IoC / DI

객체가 자신의 의존성을 직접 생성하면, 변경이 생길 때마다 연쇄적으로 코드를 수정해야 한다. Spring은 **IoC(Inversion of Control, 제어 역전)** 컨테이너를 통해 객체 생성·조립 책임을 개발자에서 프레임워크로 넘긴다. 개발자는 "무엇이 필요한지"만 선언하고, "어떻게 만들어줄지"는 Spring이 담당한다. 이 방식이 **DI(Dependency Injection, 의존성 주입)**다.

```java
// Spring이 생성자를 통해 의존성을 자동으로 주입한다
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentClient paymentClient;

    // @Autowired 없이도 생성자 하나면 자동 주입
    public OrderService(OrderRepository orderRepository,
                        PaymentClient paymentClient) {
        this.orderRepository = orderRepository;
        this.paymentClient = paymentClient;
    }
}
```

### 2. 반복 코드 — AOP

로깅, 트랜잭션 처리, 보안 검사처럼 여러 메서드에 걸쳐 반복되는 코드를 **횡단 관심사(Cross-cutting Concern)**라 한다. Spring **AOP(Aspect-Oriented Programming)**는 이를 핵심 비즈니스 로직에서 분리해 별도의 Aspect로 관리한다.

```java
@Aspect
@Component
public class LoggingAspect {

    @Around("execution(* com.example.service.*.*(..))")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint)
            throws Throwable {
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long elapsed = System.currentTimeMillis() - start;
        System.out.println(joinPoint.getSignature() + " : " + elapsed + "ms");
        return result;
    }
}
```

서비스 코드에는 로깅 한 줄 없지만, 모든 서비스 메서드 실행 시간이 자동으로 기록된다.

### 3. 반복적인 인프라 코드 — 템플릿 패턴

JDBC로 데이터를 조회할 때마다 Connection 열기 → Statement 생성 → ResultSet 처리 → 예외 변환 → Connection 닫기를 반복해야 했다. Spring의 `JdbcTemplate`은 이 보일러플레이트를 제거한다.

```java
// JdbcTemplate: try-catch, Connection 관리 없이 쿼리 실행
@Repository
public class UserRepository {

    private final JdbcTemplate jdbcTemplate;

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public User findById(Long id) {
        return jdbcTemplate.queryForObject(
            "SELECT id, name FROM users WHERE id = ?",
            (rs, rowNum) -> new User(rs.getLong("id"), rs.getString("name")),
            id
        );
    }
}
```

## Spring Framework vs Spring Boot

처음 Spring을 접할 때 "Spring이요? Spring Boot요?" 라는 질문이 자주 나온다. 간단하게 정리하면:

| | Spring Framework | Spring Boot |
|---|---|---|
| 성격 | 핵심 프레임워크 | Spring 기반 생산성 도구 |
| 설정 | 개발자가 직접 | 자동 설정(Auto-configuration) |
| 서버 | 외부 WAS 필요 | 내장 Tomcat/Undertow |
| 진입 장벽 | 높음 | 낮음 |

Spring Boot는 Spring Framework의 **대체재가 아니라 상위 레이어**다. Spring Boot를 쓰더라도 내부는 Spring Framework가 동작하므로, Spring의 핵심 개념(IoC, DI, AOP)을 먼저 이해해야 한다. 이 시리즈는 그 순서를 따른다.

## Spring의 구성 모듈 개요

![Spring 이전 vs Spring 도입](/assets/posts/spring-what-is-spring-problem.svg)

Spring Framework는 단일 JAR가 아니라 모듈 집합으로 설계되어 있어 필요한 기능만 선택해 사용할 수 있다. 주요 모듈은 다음과 같다.

- **spring-core / spring-beans**: IoC 컨테이너의 핵심. `BeanFactory`와 `ApplicationContext` 포함
- **spring-context**: 국제화(i18n), 이벤트 발행/구독, 리소스 로딩 등 확장 기능
- **spring-aop / spring-aspects**: AOP 프록시 기반 구현
- **spring-webmvc**: MVC 패턴 기반 웹 계층 (DispatcherServlet)
- **spring-jdbc / spring-tx**: JDBC 추상화, 선언적 트랜잭션
- **spring-test**: JUnit 통합, Mock 지원

오늘날 프로젝트에서는 이 모듈들을 Maven/Gradle 의존성으로 선언하면 자동으로 가져온다.

## 왜 지금도 Spring인가

다양한 JVM 프레임워크(Quarkus, Micronaut, Vert.x)가 등장했음에도 Spring이 여전히 지배적인 이유는 다음과 같다.

1. **성숙한 생태계**: 20년 이상 축적된 문서, 레퍼런스, 커뮤니티
2. **엔터프라이즈 통합**: Spring Security, Spring Data, Spring Batch, Spring Cloud 등 검증된 확장 라이브러리
3. **표준 호환**: Jakarta EE 표준을 충실히 따르면서 생산성을 더함
4. **Spring Boot의 개발 경험**: 프로젝트 시작에서 배포까지 일관된 개발 방식 제공

다음 글에서는 Spring이 강조하는 핵심 원칙인 **4대 특성(IoC, DI, AOP, PSA)**을 각각 코드 예제와 함께 자세히 살펴본다.

---

**다음 글:** [Spring의 4대 특성 — IoC·DI·AOP·PSA 완전 정복](/posts/spring-four-pillars/)

<br>
읽어주셔서 감사합니다. 😊
