---
title: "스프링의 역사 — 1.x XML 시대부터 6.x까지"
description: "Spring Framework 1.0부터 6.x, Spring Boot 3.x까지 버전별 핵심 변화와 자바 생태계의 진화를 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["spring", "spring-history", "spring-boot", "jakarta-ee", "spring6"]
featured: false
draft: false
---

[지난 글](/posts/spring-ecosystem-map/)에서 스프링 생태계의 다양한 프로젝트들을 한눈에 정리했습니다. 이번 글에서는 그 생태계가 어떤 경로를 걸어 지금에 이르렀는지 살펴봅니다. 역사를 아는 것은 단순한 교양이 아닙니다. 왜 특정 방식이 레거시로 불리는지, 왜 마이그레이션이 필요한지, 현재의 모범 사례가 왜 그런지를 이해하는 데 역사적 맥락이 필수입니다.

## 2003 — Spring 1.x: XML 설정의 시대

로드 존슨이 2002년 책에서 공개한 코드를 기반으로, 2003년 Apache 라이선스로 스프링 1.0이 출시됩니다. 당시 자바 생태계의 주류는 EJB 2.x였고, 스프링은 그 대안으로 등장했습니다.

Spring 1.x의 특징은 **XML 중심 설정**입니다. 모든 빈 정의와 의존성을 XML로 작성했습니다.

```xml
<!-- Spring 1.x 스타일 applicationContext.xml -->
<beans>
    <bean id="orderRepository"
          class="com.example.JdbcOrderRepository">
        <constructor-arg ref="dataSource"/>
    </bean>

    <bean id="orderService"
          class="com.example.OrderService">
        <property name="orderRepository"
                  ref="orderRepository"/>
    </bean>

    <bean id="dataSource"
          class="org.apache.commons.dbcp.BasicDataSource">
        <property name="driverClassName"
                  value="com.mysql.jdbc.Driver"/>
        <property name="url"
                  value="jdbc:mysql://localhost/mydb"/>
    </bean>
</beans>
```

이 방식은 EJB보다는 훨씬 낫지만, 규모가 커질수록 XML 파일이 수천 줄로 불어났습니다. 컴파일 타임 검증이 없어 오타로 인한 런타임 오류도 자주 발생했습니다.

그럼에도 스프링은 빠르게 인기를 얻었습니다. EJB가 강요하던 복잡성 없이도 트랜잭션 관리, AOP, MVC를 제공했기 때문입니다.

## 2006 — Spring 2.x: 어노테이션의 시작

Java 5가 어노테이션을 도입(2004년)하면서, Spring 2.0은 이를 활용하기 시작합니다.

```java
// Spring 2.x — @Component 어노테이션 도입
@Repository
public class JdbcOrderRepository {
    // 여전히 XML에 <context:component-scan> 선언 필요
}
```

하지만 2.x에서 어노테이션은 보조 수단이었습니다. 여전히 XML이 주설정이었고, 어노테이션은 빈 감지를 쉽게 하는 정도였습니다. 그래도 방향은 분명했습니다. "XML을 줄이자."

## 2009 — Spring 3.x: Java Config 등장

Spring 3.0은 스프링 역사에서 중요한 전환점입니다. **XML 없이 순수 자바 코드로 스프링 설정**이 가능해졌습니다.

```java
// Spring 3.x — @Configuration과 @Bean으로 XML 완전 대체 가능
@Configuration
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        BasicDataSource ds = new BasicDataSource();
        ds.setDriverClassName("com.mysql.jdbc.Driver");
        ds.setUrl("jdbc:mysql://localhost/mydb");
        return ds;
    }

    @Bean
    public OrderRepository orderRepository() {
        return new JdbcOrderRepository(dataSource());
    }

    @Bean
    public OrderService orderService() {
        return new OrderService(orderRepository());
    }
}
```

또한 Spring 3.x는 **RESTful 웹 서비스**에 대한 지원을 크게 강화했습니다. `@RequestBody`, `@ResponseBody`, `@PathVariable` 같은 어노테이션이 이 시기에 등장했습니다.

```java
// Spring 3.x — REST API 지원 강화
@Controller
@RequestMapping("/api/orders")
public class OrderController {

    @GetMapping("/{id}")
    @ResponseBody
    public Order getOrder(@PathVariable Long id) {
        return orderService.findById(id);
    }
}
```

## 2013~2014 — Spring 4.x & Spring Boot 1.x

### Spring 4.x — Java 8과 웹소켓

Spring 4.0은 **Java 8**과 함께 진화했습니다. 람다식, 스트림, `Optional`을 활용한 API들이 추가됐습니다. 또한 WebSocket, STOMP 지원, 조건부 빈 등록(`@Conditional`)이 도입됐습니다.

```java
// Spring 4.x — @Conditional과 람다 스타일
@Configuration
public class DataConfig {

    @Bean
    @ConditionalOnProperty(name = "db.type",
                           havingValue = "h2")
    public DataSource h2DataSource() {
        return new EmbeddedDatabaseBuilder()
            .setType(EmbeddedDatabaseType.H2)
            .build();
    }
}
```

### Spring Boot 1.x — 패러다임의 전환

2014년 Spring Boot 1.0 출시는 스프링 역사에서 가장 큰 사건 중 하나입니다. "스프링 설정의 복잡함"이라는 오래된 불평이 단번에 해소됐습니다.

```bash
# Spring Boot 이전: 프로젝트 시작까지 30분~1시간
# Spring Boot 이후: start.spring.io에서 프로젝트 생성 후 즉시 실행

$ mvn spring-boot:run
# 혹은
$ ./gradlew bootRun
```

`spring-boot-starter-*`라는 의존성 묶음과 자동 구성(Auto-Configuration)이 핵심이었습니다. 클래스패스를 보고 스프링이 스스로 적절한 빈을 구성하는 "약속에 의한 구성(Convention over Configuration)"이 본격화됐습니다.

## 2017~2018 — Spring 5.x & Spring Boot 2.x

### 리액티브 프로그래밍의 시대

Spring 5.0의 가장 큰 혁신은 **WebFlux**입니다. Reactor 라이브러리 기반의 완전한 비동기·리액티브 웹 프레임워크가 스프링에 공식 통합됐습니다.

```java
// Spring 5.x — WebFlux 리액티브 컨트롤러
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    // Mono: 0 또는 1개의 비동기 결과
    @GetMapping("/{id}")
    public Mono<Order> getOrder(@PathVariable Long id) {
        return orderService.findById(id);
    }

    // Flux: 0개 이상의 비동기 스트림
    @GetMapping
    public Flux<Order> getAllOrders() {
        return orderService.findAll();
    }
}
```

**Kotlin** 공식 지원도 Spring 5에서 이루어졌습니다. Spring Boot 2.x는 Micrometer 기반 메트릭 수집을 내장하고, Actuator를 크게 개선했습니다.

### Spring Boot 2.x 주요 변화

```yaml
# Spring Boot 2.x application.yml — 풍부해진 속성들
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
```

## 2022~ — Spring 6.x & Spring Boot 3.x

![Spring 6 / Boot 3 — javax에서 jakarta로](/assets/posts/spring-history-jakarta-migration.svg)

### Jakarta EE 9+ 전환

2022년 출시된 Spring 6.0 / Spring Boot 3.0은 **가장 큰 브레이킹 체인지**를 포함합니다. Oracle이 Java EE 명세를 Eclipse Foundation에 이관하면서 패키지 네임스페이스가 `javax.*`에서 `jakarta.*`로 변경됐습니다.

```java
// Spring Boot 2.x — javax
import javax.persistence.Entity;
import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

// Spring Boot 3.x — jakarta
import jakarta.persistence.Entity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
```

단순한 import 변경이지만, 수천 줄의 코드가 있는 프로젝트라면 마이그레이션이 쉽지 않습니다.

### JDK 17 최소 요구

Spring Boot 3.x는 **JDK 17을 최소 요구 버전**으로 합니다. JDK 17의 주요 기능들(레코드, 봉인 클래스, 텍스트 블록, 패턴 매칭)을 스프링이 활용합니다.

```java
// Java 17 Record — DTO로 활용
public record OrderRequest(
    Long itemId,
    int quantity,
    String shippingAddress
) {}

// Spring MVC에서 바로 사용
@PostMapping("/orders")
public ResponseEntity<Order> createOrder(
        @RequestBody @Valid OrderRequest request) {
    // request.itemId(), request.quantity() 등 접근자 자동 생성
    return ResponseEntity.ok(orderService.place(request));
}
```

### GraalVM Native Image

Spring Boot 3.x의 또 다른 핵심은 **GraalVM Native Image** 공식 지원입니다. JVM 없이 네이티브 바이너리로 컴파일해 JVM 시작 시간(수백ms)을 수ms로 단축할 수 있습니다. 특히 서버리스, 컨테이너 환경에서 유용합니다.

```bash
# Spring Boot 3.x — 네이티브 이미지 빌드
$ ./gradlew nativeCompile

# 결과: JVM 없이 바로 실행 가능한 바이너리
$ ./build/native/nativeCompile/myapp
Started MyApplication in 0.083 seconds
```

### 가상 스레드 (Project Loom)

JDK 21에서 정식 도입된 **가상 스레드**를 Spring Boot 3.2+에서 쉽게 활성화할 수 있습니다.

```yaml
# application.yml — 가상 스레드 한 줄로 활성화 (Spring Boot 3.2+)
spring:
  threads:
    virtual:
      enabled: true
```

가상 스레드를 활성화하면 기존 블로킹 코드(JdbcTemplate, RestTemplate 등)를 그대로 쓰면서도 동시성이 대폭 향상됩니다.

## 버전 선택 가이드

![스프링 역사 타임라인](/assets/posts/spring-history-timeline.svg)

| 상황 | 권장 버전 |
|------|-----------|
| 신규 프로젝트 | Spring Boot 3.3+, JDK 21+ |
| JDK 8/11 유지 필요 | Spring Boot 2.7.x (2026년 EOL) |
| 레거시 유지보수 | 현 버전 유지, 마이그레이션 계획 수립 |
| Spring Boot 2→3 마이그레이션 | `javax→jakarta` 일괄 치환, JDK 17 업그레이드 |

Spring Boot 2.7.x는 2026년에 OSS 지원이 종료됩니다. 가능하면 Spring Boot 3.x로 이전하는 것을 권장합니다. 마이그레이션 방법은 Chapter 23에서 자세히 다룹니다.

## 이 시리즈의 기준

이 시리즈는 **Spring Boot 3.x(Jakarta EE 9+ 기반)** 를 기준으로 작성합니다. 레거시와 명시적 비교가 필요한 챕터(XML 설정, 마이그레이션 등)에서만 구버전 코드를 병기합니다. 독자 여러분이 코드를 직접 실행해 볼 때 JDK 17 이상을 사용하시길 권장합니다.

## 정리

스프링은 EJB의 복잡성에 대한 반발로 태어나, XML 설정 → 어노테이션 → Java Config → 자동 구성의 방향으로 꾸준히 진화했습니다. 각 세대의 변화는 "더 적은 설정, 더 좋은 개발자 경험"이라는 일관된 방향을 향해 있었습니다. Spring 6.x / Boot 3.x는 그 여정의 현재 최신판이며, 가상 스레드와 GraalVM Native라는 두 가지 큰 변화를 끌어안고 있습니다.

다음 Chapter 2부터는 실제로 스프링 프로젝트를 만들기 위한 환경 구성부터 시작합니다.

---

**지난 글:** [스프링 생태계 지도 — Framework, Boot, Data, Security, Cloud](/posts/spring-ecosystem-map/)

**다음 글:** [JDK·IDE·빌드도구 한눈에 — 스프링 개발 환경 구축](/posts/spring-environment-jdk-ide-build/)

<br>
읽어주셔서 감사합니다. 😊
