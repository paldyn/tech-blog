---
title: "Spring Boot DataSource Auto-configuration 파헤치기"
description: "Spring Boot가 DataSource를 어떻게 자동 구성하는지 내부 동작을 분석합니다. DataSourceAutoConfiguration 소스 분석, HikariCP 기본 선택 이유, 커넥션 풀 핵심 프로퍼티 튜닝, 내장 DB 자동 감지 원리, DataSourceProperties 동작 방식까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "DataSource", "AutoConfiguration", "HikariCP", "ConnectionPool", "JDBC"]
featured: false
draft: false
---

[지난 글](/posts/springboot-custom-autoconfigure-starter/)에서 커스텀 스타터를 만드는 방법을 살펴봤습니다. 이번에는 Spring Boot가 기본으로 제공하는 Auto-configuration 중 가장 핵심적인 `DataSourceAutoConfiguration`을 해부합니다. 의존성에 JDBC 드라이버만 추가하고 `application.yml`에 URL 한 줄을 적으면 커넥션 풀이 자동으로 구성되는 과정을 단계별로 추적합니다.

## DataSourceAutoConfiguration의 역할

`spring-boot-autoconfigure` 라이브러리에는 `DataSourceAutoConfiguration` 클래스가 들어 있습니다. 이 클래스의 핵심 어노테이션은 다음과 같습니다.

```java
@AutoConfiguration(before = SqlInitializationAutoConfiguration.class)
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
@Import({ DataSourcePoolMetadataProvidersConfiguration.class,
          DataSourceInitializationConfiguration.class })
public class DataSourceAutoConfiguration {
    // ...
}
```

세 가지 조건을 모두 만족할 때만 이 설정이 로드됩니다.

1. `DataSource` 클래스가 클래스패스에 있을 것 (`spring-jdbc` 등 포함 시)
2. R2DBC `ConnectionFactory` Bean이 없을 것 (리액티브 전용 시 제외)
3. 사용자가 직접 `DataSource` Bean을 정의하지 않았을 것

![DataSource Auto-configuration 동작 흐름](/assets/posts/springboot-datasource-autoconfigure-flow.svg)

## 커넥션 풀 선택 우선순위

Spring Boot는 클래스패스에서 다음 순서로 커넥션 풀 라이브러리를 감지합니다.

| 우선순위 | 라이브러리 | 클래스 |
|---------|-----------|--------|
| 1 | **HikariCP** | `com.zaxxer.hikari.HikariDataSource` |
| 2 | Apache Tomcat JDBC | `org.apache.tomcat.jdbc.pool.DataSource` |
| 3 | Apache DBCP2 | `org.apache.commons.dbcp2.BasicDataSource` |
| 4 | Oracle UCP | `oracle.ucp.jdbc.PoolDataSource` |

`spring-boot-starter-jdbc`나 `spring-boot-starter-data-jpa`를 추가하면 HikariCP가 전이 의존성으로 자동 포함됩니다. **HikariCP가 기본인 이유**는 단순합니다 — 벤치마크에서 일관되게 가장 높은 처리량을 보여주고, 코드베이스가 간결하며, HikariCP 개발팀이 직접 Spring Boot 팀과 협력해 통합을 최적화했기 때문입니다.

## DataSourceProperties 바인딩

`DataSourceProperties`는 `spring.datasource.*` 프로퍼티를 바인딩하는 클래스입니다.

```java
@ConfigurationProperties(prefix = "spring.datasource")
public class DataSourceProperties implements BeanFactoryAware, InitializingBean {
    private String url;
    private String username;
    private String password;
    private String driverClassName;  // 생략 시 URL에서 자동 추론
    private EmbeddedDatabaseType embeddedDatabaseConnection;
    // ...
}
```

**드라이버 자동 추론**: `spring.datasource.url`에서 `jdbc:mysql:` 접두사를 보고 `com.mysql.cj.jdbc.Driver`를 자동으로 설정합니다. `driverClassName`을 명시할 필요가 없습니다.

**내장 DB 자동 감지**: `url`이 비어 있고 클래스패스에 H2/HSQLDB/Derby가 있으면 내장 DB를 자동 생성합니다. 테스트 환경에서 `spring-boot-starter-test`만 추가해도 H2가 포함되는 이유입니다.

## 핵심 프로퍼티 설정

![DataSource 핵심 설정 프로퍼티](/assets/posts/springboot-datasource-autoconfigure-props.svg)

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb?useSSL=false&serverTimezone=Asia/Seoul
    username: myuser
    password: ${DB_PASSWORD}  # 환경 변수로 주입 권장
    hikari:
      maximum-pool-size: 10       # 최대 커넥션 수
      minimum-idle: 5             # 최소 유휴 커넥션
      connection-timeout: 30000   # 커넥션 획득 대기 시간 (ms)
      idle-timeout: 600000        # 유휴 커넥션 제거 시간 (10분)
      max-lifetime: 1800000       # 커넥션 최대 수명 (30분)
      pool-name: MainHikariPool
      connection-test-query: SELECT 1  # 커넥션 유효성 검사
```

### 커넥션 풀 크기 결정 공식

HikariCP 공식 문서의 권장 공식입니다.

```
pool_size = (core_count × 2) + effective_spindle_count
```

대부분의 웹 서비스에서 `maximum-pool-size`는 10~20 사이가 적당합니다. 너무 크게 설정하면 DB 서버의 스레드가 고갈됩니다.

## DataSource Bean 수동 정의 (Auto-config 비활성화)

Auto-configuration을 완전히 비활성화하고 직접 `DataSource`를 정의할 수 있습니다.

```java
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        config.setUsername("myuser");
        config.setPassword(System.getenv("DB_PASSWORD"));
        config.setMaximumPoolSize(10);
        config.setConnectionTestQuery("SELECT 1");
        return new HikariDataSource(config);
    }
}
```

`@Bean DataSource`를 직접 정의하면 `DataSourceAutoConfiguration`의 `@ConditionalOnMissingBean(DataSource.class)` 조건이 `false`가 되어 자동 구성이 완전히 건너뛰어집니다.

## 스키마 초기화 — schema.sql / data.sql

`DataSourceInitializationConfiguration`이 함께 로드되어 클래스패스의 SQL 파일을 자동 실행합니다.

```yaml
spring:
  sql:
    init:
      mode: always        # always | embedded(기본) | never
      schema-locations: classpath:db/schema.sql
      data-locations: classpath:db/data.sql
      encoding: UTF-8
```

- `mode: embedded` — H2/HSQLDB 같은 내장 DB에서만 실행 (기본값)
- `mode: always` — 모든 DataSource에서 실행 (운영 DB에서 매 기동마다 실행되므로 주의)
- Flyway/Liquibase와 함께 쓸 때는 이 기능을 `never`로 끄는 것이 좋습니다

## DataSource 커스터마이징 — HikariDataSourceBuilderCustomizer

`HikariPropertiesCustomizer` 인터페이스를 구현하면 Bean으로 등록만 해도 Hikari 설정에 적용됩니다.

```java
@Bean
public HikariPropertiesCustomizer hikariCustomizer() {
    return hikariConfig -> {
        hikariConfig.addDataSourceProperty("cachePrepStmts", "true");
        hikariConfig.addDataSourceProperty("prepStmtCacheSize", "250");
        hikariConfig.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
    };
}
```

MySQL 드라이버는 PreparedStatement 캐시를 지원합니다. 이 세 줄의 최적화 설정은 MySQL + HikariCP 조합에서 유의미한 성능 향상을 가져다 줍니다.

## 정리

Spring Boot DataSource Auto-configuration의 핵심 동작 순서는 다음과 같습니다.

1. `DataSource` 클래스가 클래스패스에 있는지 확인
2. 사용자 `DataSource` Bean이 없는지 확인 (`@ConditionalOnMissingBean`)
3. `DataSourceProperties`로 `spring.datasource.*` 바인딩
4. 클래스패스 커넥션 풀 라이브러리 감지 (HikariCP 우선)
5. `DataSource` Bean 생성 → `JdbcTemplate`, `EntityManagerFactory`, `TransactionManager` 연쇄 활성화

다음 글에서는 이 `DataSource`를 두 개 이상 구성하는 멀티 데이터소스 패턴을 다룹니다.

---

**지난 글:** [커스텀 Spring Boot Starter & Auto-configuration 만들기](/posts/springboot-custom-autoconfigure-starter/)

**다음 글:** [Spring Boot 멀티 DataSource 구성 — 읽기/쓰기 분리부터 AbstractRoutingDataSource까지](/posts/springboot-multi-datasource/)

<br>
읽어주셔서 감사합니다. 😊
