---
title: "Spring의 역사 — 버전별 진화와 철학의 변화"
description: "2003년 Spring 1.0부터 2024년 Spring 6.x/Boot 3.x까지, 버전별 핵심 변경사항과 그 이면의 설계 철학 변화를 정리합니다. Jakarta EE 전환, GraalVM, 가상 스레드까지."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Spring Boot", "Spring 6", "Jakarta EE", "GraalVM", "역사", "버전"]
featured: false
draft: false
---

[지난 글](/posts/spring-ecosystem-map/)에서 Spring 생태계의 전체 지도를 살펴봤습니다. 생태계의 현재 모습이 어떻게 형성되었는지를 이해하면 각 기능의 설계 이유가 명확해집니다. 이번 글에서는 Spring의 20여 년 역사를 버전 단위로 훑으며, 각 버전이 어떤 문제를 해결하려 했는지를 살펴봅니다.

## 탄생 배경 — Rod Johnson과 Expert One-on-One

2002년, Rod Johnson은 *Expert One-on-One J2EE Design and Development*라는 책에서 EJB 없이도 엔터프라이즈 애플리케이션을 잘 만들 수 있다고 주장하며, 그 증거로 30,000줄짜리 코드를 책에 포함했습니다. 이 코드가 Spring Framework의 시초입니다.

2003년 Juergen Hoeller와 Yann Caroff가 Rod Johnson에게 해당 코드를 오픈소스화하자고 제안했고, 같은 해 Apache 라이선스로 최초 배포되었습니다. 이름 "Spring"은 "EJB라는 겨울이 지나고 새로운 봄"이라는 의미를 담았습니다.

![Spring Framework 버전별 역사](/assets/posts/spring-history-timeline.svg)

## Spring 1.x (2003) — 기초의 탄생

Spring 1.0은 오늘날 Spring의 모든 핵심 개념을 담고 있었습니다.

- **BeanFactory / ApplicationContext**: XML 기반 IoC 컨테이너
- **JdbcTemplate**: 반복적인 JDBC 코드를 줄이는 템플릿 패턴
- **AOP Alliance 통합**: 프록시 기반 AOP
- **Transaction 추상화**: `PlatformTransactionManager`

```xml
<!-- Spring 1.x 스타일 XML 설정 -->
<beans>
    <bean id="orderRepository" class="com.example.JpaOrderRepository">
        <property name="dataSource" ref="dataSource"/>
    </bean>
    <bean id="orderService" class="com.example.OrderService">
        <property name="orderRepository" ref="orderRepository"/>
    </bean>
</beans>
```

모든 것이 XML로 표현되었습니다. 번거롭지만 EJB보다는 훨씬 단순했고, 무엇보다 **순수 자바 클래스를 그대로 사용**할 수 있었습니다.

## Spring 2.x (2006) — 어노테이션 시대의 서막

Java 5가 어노테이션을 도입하면서 Spring도 빠르게 적용했습니다.

- `@Transactional`, `@Repository`, `@Service`, `@Controller` 등장
- AspectJ와의 통합으로 AOP 표현력 강화
- XML 네임스페이스로 설정 간소화 (`<tx:annotation-driven/>`)

```java
// Spring 2.x — 어노테이션으로 클래스 역할 명시
@Service
@Transactional
public class OrderService {
    // XML 설정에서 bean으로 등록, 하지만 여전히 명시적 등록 필요
}
```

## Spring 3.x (2009) — Java Config와 REST

Spring 3.0은 XML 없는 순수 자바 설정을 가능하게 했습니다.

- `@Configuration` + `@Bean`: Java 클래스로 완전한 설정 가능
- `@ComponentScan`: 패키지 스캔으로 자동 빈 등록
- `@RequestMapping` + REST 지원 강화
- SpEL(Spring Expression Language)
- `@Async`, `@Scheduled` 도입

```java
// Spring 3.x — XML 없이 순수 Java로 설정
@Configuration
@ComponentScan("com.example")
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:h2:mem:test");
        return ds;
    }
}
```

이 버전에서 "XML 설정 vs Java 설정" 논쟁이 시작되었고, Spring 커뮤니티는 점차 Java Config 쪽으로 기울었습니다.

## Spring 4.x + Spring Boot 1.x (2013~2014) — Boot 혁명

Spring 4.0은 Java 8의 람다와 스트림을 지원했지만, 이 시기의 진짜 혁명은 **2014년 Spring Boot 1.0 출시**였습니다.

```java
// Spring Boot 1.x — 이제 main 메서드 하나로 시작
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

`@SpringBootApplication` 하나가 `@Configuration` + `@ComponentScan` + `@EnableAutoConfiguration` 세 개를 합친 것입니다. `spring-boot-starter-web` 의존성 하나만 추가하면 Tomcat이 내장되고, DispatcherServlet이 등록되고, Jackson이 설정됩니다.

Spring Boot는 "관례 기반 설정(Convention over Configuration)" 철학을 Java 생태계에 강력하게 이식했습니다.

## Spring 5.x + Spring Boot 2.x (2017~2018) — 리액티브

Spring 5.0의 가장 큰 변화는 **Spring WebFlux**와 리액티브 프로그래밍 지원입니다.

- **Project Reactor** 기반 논블로킹 비동기 웹 레이어
- `Mono<T>`, `Flux<T>` 타입 시스템 전반에 적용
- Kotlin 일급 시민 지원
- JDK 9+ 모듈 시스템 대응

```java
// Spring 5.x WebFlux — 리액티브 컨트롤러
@RestController
public class OrderController {

    @GetMapping("/orders/{id}")
    public Mono<Order> getOrder(@PathVariable Long id) {
        return orderService.findById(id); // 비동기, 논블로킹
    }

    @GetMapping("/orders")
    public Flux<Order> getOrders() {
        return orderService.findAll(); // 스트림 응답
    }
}
```

Spring Boot 2.0은 이 리액티브 스택을 자동 설정으로 지원하고, Micrometer 메트릭 통합을 추가했습니다.

## Spring 6.x + Spring Boot 3.x (2022) — 현대의 기준

![Spring 6.x / Boot 3.x 주요 변경사항](/assets/posts/spring-history-v6-changes.svg)

Spring 6.0은 세 가지 큰 결단을 했습니다.

**Java 17 최소 요구**: Java 17 LTS는 sealed classes, records, text blocks, pattern matching 등 현대적 기능을 포함합니다. Spring 6는 이를 적극 활용합니다.

**Jakarta EE 10 전환**: Oracle이 JavaEE 상표권을 이클립스 재단에 넘기면서 `javax.*` 패키지가 `jakarta.*`로 바뀌었습니다. Spring Boot 2 → 3 마이그레이션의 가장 큰 변경점입니다.

```java
// Boot 2.x
import javax.persistence.Entity;
import javax.servlet.http.HttpServletRequest;

// Boot 3.x — 패키지명만 변경, 기능은 동일
import jakarta.persistence.Entity;
import jakarta.servlet.http.HttpServletRequest;
```

**GraalVM Native Image**: AOT(Ahead-of-Time) 컴파일로 JVM 없이 실행 가능한 네이티브 바이너리 생성. 시작 시간이 밀리초 단위로 줄어들고 메모리 사용량이 대폭 감소합니다.

```bash
# Gradle로 네이티브 이미지 빌드
./gradlew nativeCompile

# JVM 없이 실행, 시작 시간 ~100ms
./build/native/nativeCompile/myapp
```

Java 21의 **Virtual Threads(가상 스레드)** 도 Spring Boot 3.2에서 공식 지원됩니다. `spring.threads.virtual.enabled=true` 설정만으로 Tomcat이 가상 스레드를 사용합니다.

## 버전 선택 가이드

| 상황 | 권장 버전 |
|---|---|
| 신규 프로젝트 | Spring Boot 3.x (Spring 6.x) + Java 21 |
| Java 8/11 유지 필요 | Spring Boot 2.7.x (EOL 2023년 11월 이후 보안 패치 없음) |
| 기존 Boot 2 → 3 마이그레이션 | openrewrite 플러그인으로 자동화 권장 |
| GraalVM/Virtual Thread 활용 | Spring Boot 3.2+ + Java 21 |

이 시리즈는 **Spring Boot 3.x (Spring Framework 6.x)** 를 기준으로 진행됩니다. Spring Boot 2 사용자도 개념은 동일하며, 필요한 곳에 버전 차이를 명시합니다.

---

**지난 글:** [Spring 생태계 지도 — 프로젝트 전체 구조 한눈에 보기](/posts/spring-ecosystem-map/)

<br>
읽어주셔서 감사합니다. 😊
