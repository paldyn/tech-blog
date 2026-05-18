---
title: "Spring Boot 쿼리 로깅 — SQL·파라미터·성능 측정"
description: "Spring Boot에서 Hibernate 쿼리를 로깅하는 여러 방법을 비교합니다. show-sql의 한계, Hibernate 로거 설정, p6spy와 datasource-proxy를 이용한 파라미터 치환 쿼리 출력과 슬로우 쿼리 감지까지 실전 구성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "QueryLogging", "Hibernate", "p6spy", "datasource-proxy", "SlowQuery"]
featured: false
draft: false
---

[지난 글](/posts/springboot-h2-console/)에서 H2 인메모리 DB로 빠른 개발 환경을 구성하는 방법을 살펴봤습니다. 개발하다 보면 Hibernate가 어떤 SQL을 어떤 파라미터로 보내는지 확인해야 하는 순간이 생깁니다. 기본 `show-sql` 옵션만으로는 `?`로 가려진 파라미터를 볼 수 없습니다. 이 글에서는 쿼리 로깅 방법을 단계별로 살펴보고 실전 환경에 맞는 선택지를 설명합니다.

## 방법 1 — show-sql (가장 단순, 권장하지 않음)

```yaml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
```

빠르게 켤 수 있지만 두 가지 치명적 단점이 있습니다.

- **파라미터 바인딩이 보이지 않습니다.** `where id = ?` 형태로만 출력되어 실제 값을 알 수 없습니다.
- **`System.out`으로 출력됩니다.** Logback·Log4j 같은 로깅 프레임워크를 우회하므로 운영 로그와 섞이고 파일로 리다이렉트할 수 없습니다.

## 방법 2 — Hibernate Logging

Logback 설정으로 Hibernate 내부 로거를 활성화합니다.

```yaml
# application.yml
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE
```

```xml
<!-- logback-spring.xml (파일에 남기고 싶을 때) -->
<logger name="org.hibernate.SQL" level="DEBUG" additivity="false">
  <appender-ref ref="FILE"/>
</logger>
<logger name="org.hibernate.orm.jdbc.bind" level="TRACE" additivity="false">
  <appender-ref ref="FILE"/>
</logger>
```

`org.hibernate.SQL`은 SQL 구문, `org.hibernate.orm.jdbc.bind`는 파라미터 바인딩을 각각 출력합니다. 두 줄이 분리되어 출력되기 때문에 읽기 불편하고, 고트래픽 환경에서는 TRACE 레벨이 과도한 로그를 생성합니다.

> **Hibernate 6(Spring Boot 3.x) 변경사항**: 이전 버전에서는 `org.hibernate.type.descriptor.sql.BasicBinder`였으나 6부터 `org.hibernate.orm.jdbc.bind`로 패키지가 이동했습니다.

## 방법 3 — p6spy (권장)

p6spy는 JDBC 드라이버를 프록시로 감싸 파라미터가 치환된 **완성된 쿼리**를 출력합니다. `?` 없이 실제 값이 들어간 SQL을 그대로 복사해 DB 클라이언트에서 실행할 수 있습니다.

### 의존성 추가

```xml
<!-- pom.xml -->
<dependency>
  <groupId>com.github.gavlyukovskiy</groupId>
  <artifactId>p6spy-spring-boot-starter</artifactId>
  <version>1.9.2</version>
</dependency>
```

```gradle
// build.gradle
implementation 'com.github.gavlyukovskiy:p6spy-spring-boot-starter:1.9.2'
```

Spring Boot Auto-configuration과 통합된 스타터를 사용합니다. 직접 `p6spy` 의존성을 추가하는 것보다 설정이 훨씬 간단합니다.

### JDBC URL 변경

```yaml
spring:
  datasource:
    url: jdbc:p6spy:mysql://localhost:3306/mydb?useSSL=false
    driver-class-name: com.p6spy.engine.spy.P6SpyDriver
```

`jdbc:` 다음에 `p6spy:`를 추가하고 드라이버를 `P6SpyDriver`로 변경합니다. 실제 MySQL 드라이버는 `spy.properties`에서 지정합니다.

### spy.properties 설정

![p6spy 설정 — spy.properties](/assets/posts/springboot-query-logging-config.svg)

```properties
# src/main/resources/spy.properties
driverlist=com.mysql.cj.jdbc.Driver
appender=com.p6spy.engine.spy.appender.Slf4JLogger
logMessageFormat=com.p6spy.engine.spy.appender.CustomLineFormat
customLogMessageFormat=%(currentTime) | %(executionTime)ms | %(category) | connection %(connectionId) | %(sqlSingleLine)
executionThreshold=100
```

`executionThreshold`는 밀리초 단위로, 이 값을 초과하는 쿼리만 WARN 레벨로 출력합니다. 100ms로 설정하면 슬로우 쿼리를 자동으로 감지할 수 있습니다.

## 방법 4 — datasource-proxy (슬로우 쿼리·N+1 감지)

`datasource-proxy`는 `DataSource` 빈 자체를 프록시로 감싸는 방식입니다. 쿼리 인터셉터를 통해 실행 시간 측정, 슬로우 쿼리 WARN 출력, N+1 패턴 감지 등 고급 기능을 제공합니다.

```xml
<dependency>
  <groupId>com.github.gavlyukovskiy</groupId>
  <artifactId>datasource-proxy-spring-boot-starter</artifactId>
  <version>1.9.2</version>
</dependency>
```

```yaml
spring:
  datasource-proxy:
    slow-query:
      enable-logging: true
      count: 1
      threshold: 300    # ms
    query:
      enable-logging: true
      log-level: DEBUG
      logger-name: sqlLogger
```

```java
// 커스텀 슬로우 쿼리 리스너
@Component
public class SlowQueryDetector implements QueryExecutionListener {

    private static final long THRESHOLD_MS = 200;

    @Override
    public void afterQuery(ExecutionInfo info,
                           List<QueryInfo> queries) {
        long elapsed = info.getElapsedTime();
        if (elapsed > THRESHOLD_MS) {
            String sql = queries.get(0).getQuery();
            log.warn("SLOW QUERY ({}ms): {}", elapsed, sql);
        }
    }
}
```

## 쿼리 로깅 방법 비교

![쿼리 로깅 레이어 비교](/assets/posts/springboot-query-logging-flow.svg)

세 방법의 핵심 차이를 정리합니다.

| 방법 | 파라미터 치환 | 실행 시간 | 운영 적합성 |
|------|-------------|---------|------------|
| show-sql | ✗ | ✗ | 비권장 |
| Hibernate Logging | △ (별도 줄) | ✗ | 개발만 |
| p6spy | ✓ | ✓ | 개발·QA |
| datasource-proxy | ✓ | ✓ | 개발·QA·스테이징 |

## 운영 환경 쿼리 로깅

운영 환경에서는 로그 볼륨이 커서 모든 쿼리를 남기기 어렵습니다. 슬로우 쿼리만 선택적으로 남기는 것이 현실적입니다.

```yaml
# application-prod.yml
spring:
  datasource-proxy:
    slow-query:
      enable-logging: true
      threshold: 500   # 0.5초 이상만
    query:
      enable-logging: false  # 일반 쿼리는 꺼둠
```

MySQL 자체의 슬로우 쿼리 로그(`slow_query_log=ON`, `long_query_time=1`)와 병행하면 DB 레벨과 앱 레벨 두 곳에서 성능 회귀를 조기에 잡을 수 있습니다.

## 테스트에서 쿼리 횟수 검증

```java
@SpringBootTest
class OrderServiceQueryTest {

    @Autowired
    private OrderService orderService;

    @PersistenceContext
    private EntityManager em;

    @Test
    void 주문_목록_조회시_N_플러스_1_없음() {
        // given: 주문 5개, 각각 다른 사용자
        // when
        List<Order> orders = orderService.findAllWithUser();
        // then: 쿼리 1번 (JOIN FETCH)으로 처리되는지 p6spy 로그로 확인
        assertThat(orders).hasSize(5);
    }
}
```

테스트에서 p6spy 로그를 보면서 N+1이 발생하는지 육안으로 확인합니다. 더 엄격하게 하려면 `datasource-proxy`의 `QueryCountHolder`를 활용합니다.

```java
QueryCountHolder.clear();
orderService.findAllWithUser();
QueryCount count = QueryCountHolder.getGrandTotal();
assertThat(count.getSelect()).isEqualTo(1);
```

---

**지난 글:** [Spring Boot H2 콘솔 — 인메모리 DB로 빠른 개발 환경 구성](/posts/springboot-h2-console/)

**다음 글:** [Spring Boot 트랜잭션 베스트 프랙티스 — @Transactional 실전 가이드](/posts/springboot-transaction-best-practice/)

<br>
읽어주셔서 감사합니다. 😊
