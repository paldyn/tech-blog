---
title: "스프링의 역사 — 1.x XML 시대부터 6.x까지"
description: "2003년 Rod Johnson의 도전부터 Spring Boot, 리액티브, Jakarta EE 전환까지. 스프링이 어떻게 진화해왔는지 버전별 핵심 변화를 짚는다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["spring", "history", "spring-boot", "jakarta", "spring6", "evolution"]
featured: false
draft: false
---

[이전 글](/posts/spring-ecosystem-map)에서 스프링 생태계의 지형도를 살펴봤다. 이번에는 그 생태계가 어떻게 탄생하고 성장해왔는지 역사의 흐름을 따라가 본다. 버전별 변화를 이해하면 "왜 이렇게 설계됐는가"라는 질문에 답할 수 있게 된다.

![스프링 버전 타임라인](/assets/posts/spring-history-timeline.svg)

## Spring 1.x (2003) — POJO의 선언

2003년 6월, 세상에 나온 Spring 1.0은 `interface21` 프로젝트에서 시작됐다. Rod Johnson이 저서 *Expert One-on-One J2EE Design and Development*(2002)에 첨부한 예제 코드가 씨앗이었다.

1.0의 핵심은 세 가지였다.

**XML 기반 Bean 정의**: 모든 빈 설정을 `applicationContext.xml`에 작성했다.

```xml
<!-- Spring 1.x 스타일 — XML로 모든 것을 정의 -->
<beans xmlns="http://www.springframework.org/schema/beans">

    <bean id="orderRepository" class="com.example.OrderRepositoryImpl"/>

    <bean id="orderService" class="com.example.OrderServiceImpl">
        <!-- 생성자 주입 -->
        <constructor-arg ref="orderRepository"/>
    </bean>

    <bean id="orderController" class="com.example.OrderController">
        <!-- 세터 주입 -->
        <property name="orderService" ref="orderService"/>
    </bean>

</beans>
```

장황하지만 혁신이었다. EJB의 홈 인터페이스, 배포 서술자, WAS 종속성을 모두 버리고 순수 POJO로 엔터프라이즈 애플리케이션을 만들 수 있었다.

**BeanFactory와 ApplicationContext**: IoC 컨테이너의 원형이 이때 등장했다.

**JdbcTemplate**: JDBC 보일러플레이트(connection 열기, PreparedStatement 생성, 예외 처리, 닫기)를 캡슐화했다.

```java
// Spring 1.x — JdbcTemplate으로 JDBC 단순화
JdbcTemplate jdbc = new JdbcTemplate(dataSource);
List<Order> orders = jdbc.query(
    "SELECT * FROM orders WHERE customer_id = ?",
    new Object[]{customerId},
    new OrderRowMapper()
);
```

## Spring 2.x (2006) — 어노테이션의 시작

자바 5가 출시되며 어노테이션이 언어 기능으로 자리잡자, 스프링 2.0은 이를 적극 활용했다.

```java
// Spring 2.x — 어노테이션으로 트랜잭션 선언
@Transactional
public void placeOrder(Order order) {
    orderRepository.save(order);
    inventoryService.deductStock(order.getItems());
}
```

XML에서 `<tx:advice>`와 AOP 설정으로 트랜잭션을 선언하던 방식을 `@Transactional` 하나로 대체했다. AspectJ 통합도 이 버전에서 크게 강화됐다.

XML 네임스페이스가 도입되어 설정이 한결 간결해졌다.

```xml
<!-- Spring 2.x — XML 네임스페이스로 간결해진 설정 -->
<context:component-scan base-package="com.example"/>
<tx:annotation-driven/>
<aop:aspectj-autoproxy/>
```

## Spring 3.x (2009) — Java Config의 등장

Spring 3.0은 패러다임 전환을 예고했다. **Java Config** — 즉, XML 대신 자바 클래스로 빈을 정의하는 방식이 본격 도입됐다.

```java
// Spring 3.x — @Configuration, @Bean으로 XML 대체
@Configuration
public class AppConfig {

    @Bean
    public OrderRepository orderRepository() {
        return new OrderRepositoryImpl(dataSource());
    }

    @Bean
    public OrderService orderService() {
        return new OrderServiceImpl(orderRepository());
    }

    @Bean
    public DataSource dataSource() {
        // 타입 안전, IDE 자동완성, 리팩터링 가능
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:h2:mem:test");
        return ds;
    }
}
```

XML에서 Java로의 이전을 강하게 권고하기 시작한 시점이다. **Spring Expression Language(SpEL)** 과 REST 지원 강화(`@ResponseBody`, `RestTemplate`)도 3.x의 주요 성과다.

## Spring 4.x (2013) — 모던 자바와 스프링 부트의 탄생

Spring 4.0은 자바 8과 동시에 출발했다. 람다, `Optional`, Stream을 스프링 API 전반에 걸쳐 활용할 수 있게 됐다.

```java
// Spring 4.x — @RestController 도입 (@Controller + @ResponseBody)
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrder(@PathVariable Long id) {
        return orderService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
```

그러나 4.x의 가장 큰 사건은 **2014년 4월 Spring Boot 1.0 출시**였다.

```bash
# Spring Boot 등장 전후
# Before: web.xml + applicationContext.xml + servlet-context.xml + pom.xml 수백 줄
# After:
spring init --dependencies=web,data-jpa,security my-app
cd my-app && ./mvnw spring-boot:run
```

"30초 만에 실행 가능한 스프링 애플리케이션"이라는 슬로건은 과장이 아니었다. 임베디드 톰캣, 자동 구성, 스타터 의존성이 스프링 개발의 모습을 완전히 바꿨다.

WebSocket 지원, 조건부 빈(`@Conditional`), 제네릭 타입 의존성 주입도 4.x에서 추가됐다.

## Spring 5.x (2017) — 리액티브의 도전

**Spring 5.0**은 스프링 역사에서 가장 과감한 아키텍처 변화를 담았다. **리액티브 프로그래밍 모델(WebFlux)** 이 공식 지원으로 편입됐다.

```java
// Spring 5.x — WebFlux, Reactive API
@RestController
public class ReactiveOrderController {

    @GetMapping("/api/orders/{id}")
    public Mono<Order> getOrder(@PathVariable Long id) {
        return orderRepository.findById(id);  // Mono = 0 or 1개의 비동기 결과
    }

    @GetMapping("/api/orders")
    public Flux<Order> getAllOrders() {
        return orderRepository.findAll();     // Flux = N개의 비동기 스트림
    }
}
```

기존 MVC(서블릿 기반, 스레드당 요청)와 WebFlux(이벤트 루프, 논블로킹)가 공존하는 이중 스택 구조가 됐다. 언제 무엇을 써야 하는지는 Chapter 21에서 자세히 다룬다.

**Kotlin 공식 지원** 도 5.x의 주요 성과다. 스프링 팀이 자체 프로젝트 일부를 Kotlin으로 작성할 만큼 적극적이었다.

Spring Boot 2.x도 5.x 위에서 동작하며, 2019년부터는 Spring Boot가 사실상 스프링의 기본 접근 방식으로 자리잡았다.

## Spring 6.x (2022) — Jakarta EE와 현대 자바

2022년 11월 출시된 **Spring 6.0** 은 역사적인 패키지 네임스페이스 전환을 단행했다.

![javax에서 jakarta로 패키지 전환](/assets/posts/spring-history-jakarta-migration.svg)

### javax → jakarta: 왜 바뀌었나

Oracle이 Java EE를 Eclipse Foundation에 기증하면서 "Java" 상표 사용권을 넘기지 않았다. 결과적으로 Eclipse Foundation은 패키지명을 `javax.*`에서 `jakarta.*`로 변경해야 했다. Jakarta EE 9(2020)부터 적용됐고, Spring 6는 이를 필수 기반으로 채택했다.

```java
// Spring Boot 2.x → 3.x 마이그레이션 핵심 변경
// Before (Boot 2.x, Spring 5)
import javax.persistence.Entity;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.NotBlank;

// After (Boot 3.x, Spring 6)
import jakarta.persistence.Entity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
```

단순한 문자열 교체처럼 보이지만, 사용하는 모든 라이브러리가 Jakarta EE 9+ 호환 버전으로 업그레이드돼야 한다. Hibernate 6.x, Tomcat 10.x, WildFly 27+ 등.

### Spring 6.x의 다른 주요 변화

**GraalVM Native Image 지원**: AOT(Ahead-of-Time) 처리를 통해 스프링 애플리케이션을 네이티브 실행 파일로 컴파일한다. JVM 없이 실행되므로 시작 시간이 수백 밀리초에서 수십 밀리초로 단축된다.

```bash
# GraalVM으로 네이티브 이미지 빌드 (Spring Boot 3.x)
./mvnw -Pnative native:compile

# 실행 — JVM 불필요
./target/my-app
# Started MyApplication in 0.043 seconds
```

**가상 스레드 (Project Loom)**: JDK 21의 가상 스레드를 스프링 MVC에서 활용할 수 있다. 기존 블로킹 코드를 리팩터링 없이 높은 동시성으로 운영 가능하다.

```yaml
# application.yml — 가상 스레드 활성화
spring:
  threads:
    virtual:
      enabled: true
```

**Java 17 최소 요구**: Spring 6.x와 Spring Boot 3.x는 Java 17 이상을 요구한다. Record, Sealed Class, Text Block, Pattern Matching 등 현대 자바 문법을 활용한다.

## 버전 로드맵 한눈에

| 버전 | 출시 | 최소 Java | 베이스 | 비고 |
|------|------|-----------|--------|------|
| Spring 1.x | 2003 | Java 1.3+ | J2EE | POJO 철학의 시작 |
| Spring 2.x | 2006 | Java 5+ | J2EE | @Transactional, AspectJ |
| Spring 3.x | 2009 | Java 5+ | Java EE 5 | Java Config, SpEL |
| Spring 4.x | 2013 | Java 6+ | Java EE 6 | Spring Boot 1.x 출시 |
| Spring 5.x | 2017 | Java 8+ | Java EE 7 | WebFlux, Kotlin |
| Spring 6.x | 2022 | **Java 17+** | **Jakarta EE 9+** | GraalVM, 가상 스레드 |

## 이 시리즈의 기준

이 *Spring 완전 정복* 시리즈는 **Spring Boot 3.x + Spring Framework 6.x + Java 21** 기준으로 모든 예제를 작성한다. Jakarta EE 패키지명을 사용하고, 레거시 패턴(XML 설정, EJB 스타일)은 해당 챕터에서 별도로 명시한다.

Chapter 2부터는 실제 환경 구축에 들어간다. JDK 설치부터 IDE, 빌드 도구까지 순서대로 설정해보자.

---

**지난 글:** [스프링 생태계 지도 — Framework, Boot, Data, Security, Cloud](/posts/spring-ecosystem-map/)

<br>
읽어주셔서 감사합니다. 😊
