---
title: "Spring Boot 로깅 완전 정복: SLF4J와 Logback"
description: "Spring Boot 애플리케이션의 로깅 아키텍처를 깊이 이해합니다. SLF4J 추상화와 Logback 구현체의 관계, logback-spring.xml 구성, 로거 계층과 레벨 상속, Appender(Console/File/Rolling) 설정, 프로파일별 로깅, 그리고 운영 환경에서 필수인 비동기 로깅(AsyncAppender)까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "Logback", "SLF4J", "로깅", "logback-spring.xml", "AsyncAppender", "MDC"]
featured: false
draft: false
---

[지난 글](/posts/springboot-embedded-server/)에서 Spring Boot가 서버를 JAR 안에 포함하는 방식을 살펴봤습니다. 이번에는 모든 애플리케이션에 필수인 **로깅**을 다룹니다. Spring Boot는 별도 설정 없이도 로깅이 동작하지만, 운영 환경에서 제대로 쓰려면 내부 구조를 이해해야 합니다.

## SLF4J와 Logback의 관계

자바 생태계에는 로깅 라이브러리가 많습니다. `java.util.logging`(JUL), Log4j, Log4j 2, Logback이 각자의 API를 가지고 있었습니다. 라이브러리 의존성에 따라 여러 로깅 시스템이 섞이면 설정이 충돌합니다.

**SLF4J(Simple Logging Facade for Java)**는 이 문제를 해결하는 **추상화 레이어**입니다. 개발자는 SLF4J API만 사용하고, 어떤 구현체(Logback, Log4j 2 등)를 쓸지는 의존성 설정으로 결정합니다.

![SLF4J + Logback 아키텍처](/assets/posts/springboot-logback-slf4j-architecture.svg)

Spring Boot는 기본으로 **Logback**을 사용하며, `spring-boot-starter-logging`에 포함되어 있습니다. `spring-boot-starter-web`을 추가하면 `spring-boot-starter-logging`이 자동으로 따라옵니다.

## 로거 선언 방법

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class OrderService {

    // SLF4J Logger — Logback 구현체가 사용됨
    private static final Logger log =
        LoggerFactory.getLogger(OrderService.class);

    public Order placeOrder(OrderRequest req) {
        log.debug("주문 요청: itemId={}, qty={}", req.itemId(), req.qty());
        Order order = createOrder(req);
        log.info("주문 생성 완료: orderId={}", order.id());
        return order;
    }
}
```

Lombok의 `@Slf4j` 어노테이션을 쓰면 `log` 필드 선언을 생략할 수 있습니다.

```java
@Slf4j
@Service
public class OrderService {

    public Order placeOrder(OrderRequest req) {
        log.info("주문 처리 시작: {}", req.itemId());
        // ...
    }
}
```

**중요**: 문자열을 직접 연결하지 말고 `{}` 플레이스홀더를 사용하세요. 로그 레벨이 비활성화된 경우 불필요한 문자열 연산을 방지합니다.

```java
// 나쁜 예 — 로그가 비활성화돼도 문자열 연결이 발생
log.debug("주문: " + req.itemId() + ", qty: " + req.qty());

// 좋은 예 — 실제로 출력될 때만 연산
log.debug("주문: {}, qty: {}", req.itemId(), req.qty());
```

## application.properties로 간단히 설정하기

단순한 수준의 설정은 `application.properties`만으로 충분합니다.

```properties
# 전체 기본 레벨 (기본값: INFO)
logging.level.root=INFO

# 특정 패키지 레벨
logging.level.com.example=DEBUG
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.orm.jdbc.bind=TRACE

# 파일 출력
logging.file.name=logs/app.log
logging.file.path=logs/

# 파일 롤링 (기본값: 10MB, 7일 보관)
logging.logback.rollingpolicy.max-file-size=10MB
logging.logback.rollingpolicy.max-history=30
logging.logback.rollingpolicy.total-size-cap=1GB
```

## logback-spring.xml 고급 설정

운영 환경에서는 `logback-spring.xml`로 세밀하게 제어합니다. (`logback.xml`이 아닌 `logback-spring.xml`을 사용해야 Spring 프로파일 기능을 활용할 수 있습니다.)

![Logback 설정 구조](/assets/posts/springboot-logback-slf4j-config.svg)

```xml
<!-- src/main/resources/logback-spring.xml -->
<configuration>

    <!-- 공통 패턴 프로퍼티 -->
    <property name="LOG_PATTERN"
        value="%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"/>

    <!-- 콘솔 Appender -->
    <appender name="CONSOLE"
        class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>

    <!-- 파일 롤링 Appender -->
    <appender name="FILE"
        class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/app.log</file>
        <rollingPolicy
            class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/app.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <timeBasedFileNamingAndTriggeringPolicy
                class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <maxFileSize>10MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
            <maxHistory>30</maxHistory>
            <totalSizeCap>3GB</totalSizeCap>
        </rollingPolicy>
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>

    <!-- 특정 패키지 설정 -->
    <logger name="com.example.order" level="DEBUG" additivity="false">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="FILE"/>
    </logger>

    <!-- 루트 로거 -->
    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="FILE"/>
    </root>

</configuration>
```

## 프로파일별 로그 설정

`logback-spring.xml`의 `<springProfile>` 태그를 사용하면 환경별로 다른 설정을 적용할 수 있습니다.

```xml
<configuration>
    <!-- 개발 환경: 콘솔만, DEBUG 레벨 -->
    <springProfile name="local,dev">
        <root level="DEBUG">
            <appender-ref ref="CONSOLE"/>
        </root>
    </springProfile>

    <!-- 운영 환경: 파일 저장, INFO 레벨 -->
    <springProfile name="prod">
        <root level="INFO">
            <appender-ref ref="FILE_ASYNC"/>
        </root>
    </springProfile>
</configuration>
```

## AsyncAppender — 운영 환경 필수 설정

로그를 동기로 파일에 쓰면 I/O 블로킹이 발생해 응답 시간이 늘어납니다. `AsyncAppender`는 별도 스레드에서 로그를 비동기로 처리합니다.

```xml
<!-- 비동기 Appender 래핑 -->
<appender name="FILE_ASYNC"
    class="ch.qos.logback.classic.AsyncAppender">
    <!-- 큐가 80% 이상 차면 TRACE/DEBUG/INFO를 버림 -->
    <discardingThreshold>20</discardingThreshold>
    <!-- 큐 크기 (기본: 256) -->
    <queueSize>512</queueSize>
    <!-- 큐가 가득 찰 때 블로킹 대신 버림 -->
    <neverBlock>false</neverBlock>
    <appender-ref ref="FILE"/>
</appender>
```

`discardingThreshold=20`은 큐가 80% 이상 차면 INFO 이하 로그를 버린다는 의미입니다. WARN/ERROR는 항상 보존됩니다.

## MDC — 요청 추적

MDC(Mapped Diagnostic Context)는 스레드 로컬 저장소에 값을 넣어 로그에 자동으로 포함시키는 기능입니다. 요청 ID 추적에 유용합니다.

```java
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = UUID.randomUUID().toString().substring(0, 8);
        MDC.put("requestId", requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.clear(); // 스레드 풀 재사용 시 누수 방지
        }
    }
}
```

```xml
<!-- 로그 패턴에 MDC 값 포함 -->
<property name="LOG_PATTERN"
    value="%d{HH:mm:ss} [%X{requestId}] %-5level %logger{36} - %msg%n"/>
```

출력 예: `14:23:01 [a1b2c3d4] INFO  OrderService - 주문 처리 시작`

## 구조화 로깅 (JSON)

ELK Stack(Elasticsearch + Logstash + Kibana)이나 클라우드 로깅 플랫폼에 로그를 보낼 때는 JSON 형식이 유리합니다.

```xml
<!-- logstash-logback-encoder 라이브러리 사용 -->
<appender name="JSON_CONSOLE"
    class="ch.qos.logback.core.ConsoleAppender">
    <encoder
        class="net.logstash.logback.encoder.LogstashEncoder"/>
</appender>
```

```kotlin
// build.gradle.kts
implementation("net.logstash.logback:logstash-logback-encoder:7.4")
```

## 정리

Spring Boot 로깅의 핵심은 두 가지입니다. 첫째, SLF4J API만 사용해 구현체에 종속되지 않는 코드를 작성합니다. 둘째, 운영 환경에서는 `logback-spring.xml`로 AsyncAppender와 롤링 파일 정책을 설정합니다. 다음 글에서는 개발 생산성을 크게 높여주는 **Spring Boot DevTools와 LiveReload**를 살펴봅니다.

---

**지난 글:** [Spring Boot 내장 서버: Tomcat을 JAR 안에 품는 방법](/posts/springboot-embedded-server/)

**다음 글:** [Spring Boot DevTools & LiveReload로 개발 생산성 높이기](/posts/springboot-devtools-livereload/)

<br>
읽어주셔서 감사합니다. 😊
