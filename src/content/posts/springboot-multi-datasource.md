---
title: "Spring Boot 멀티 DataSource — 읽기/쓰기 분리부터 AbstractRoutingDataSource까지"
description: "Spring Boot에서 두 개 이상의 DataSource를 구성하는 패턴을 다룹니다. @Primary 기반 수동 분리, 별도 JPA 설정, AbstractRoutingDataSource로 @Transactional(readOnly)에 따른 자동 DB 라우팅 구현까지 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "MultiDataSource", "AbstractRoutingDataSource", "ReadWriteSplit", "HikariCP", "JPA"]
featured: false
draft: false
---

[지난 글](/posts/springboot-datasource-autoconfigure/)에서 Spring Boot가 단일 DataSource를 자동 구성하는 과정을 살펴봤습니다. 실제 서비스에서는 Primary DB(쓰기)와 Replica DB(읽기 전용)를 분리하거나, 서로 다른 도메인의 DB를 별도로 연결해야 하는 경우가 많습니다. 이번 글에서는 멀티 DataSource를 구성하는 세 가지 패턴과 `AbstractRoutingDataSource`를 이용한 자동 라우팅 구현을 다룹니다.

## Auto-configuration 비활성화

DataSource를 두 개 이상 직접 정의하려면 먼저 Spring Boot의 DataSource Auto-configuration을 꺼야 합니다.

```java
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,
    DataSourceTransactionManagerAutoConfiguration.class,
    HibernateJpaAutoConfiguration.class
})
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

또는 `application.yml`에서 선택적으로 제외할 수도 있습니다.

```yaml
spring:
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
```

## 패턴 1 — @Primary 기반 수동 분리

가장 단순한 방법입니다. 두 DataSource를 Bean으로 등록하고 기본 Bean에 `@Primary`를 붙입니다.

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    @ConfigurationProperties("app.datasource.primary")
    public DataSourceProperties primaryDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    public DataSource primaryDataSource(
            @Qualifier("primaryDataSourceProperties")
            DataSourceProperties props) {
        return props.initializeDataSourceBuilder()
                    .type(HikariDataSource.class)
                    .build();
    }

    @Bean
    @ConfigurationProperties("app.datasource.replica")
    public DataSourceProperties replicaDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    public DataSource replicaDataSource(
            @Qualifier("replicaDataSourceProperties")
            DataSourceProperties props) {
        return props.initializeDataSourceBuilder()
                    .type(HikariDataSource.class)
                    .build();
    }
}
```

```yaml
app:
  datasource:
    primary:
      url: jdbc:mysql://primary-host:3306/mydb
      username: writer
      password: ${PRIMARY_DB_PASSWORD}
      hikari:
        maximum-pool-size: 10
    replica:
      url: jdbc:mysql://replica-host:3306/mydb
      username: reader
      password: ${REPLICA_DB_PASSWORD}
      hikari:
        maximum-pool-size: 20
```

![멀티 DataSource 아키텍처](/assets/posts/springboot-multi-datasource-architecture.svg)

## 패턴 2 — 별도 JPA 설정 (다른 스키마/DB)

두 DataSource가 완전히 다른 DB(예: 주문 DB + 결제 DB)를 가리킬 때는 JPA 설정도 분리합니다.

```java
@Configuration
@EnableTransactionManagement
@EnableJpaRepositories(
    basePackages = "com.example.order.repository",
    entityManagerFactoryRef = "orderEntityManagerFactory",
    transactionManagerRef = "orderTransactionManager"
)
public class OrderDataSourceConfig {

    @Bean
    @Primary
    public LocalContainerEntityManagerFactoryBean orderEntityManagerFactory(
            @Qualifier("primaryDataSource") DataSource dataSource,
            JpaVendorAdapter jpaVendorAdapter) {
        LocalContainerEntityManagerFactoryBean em =
            new LocalContainerEntityManagerFactoryBean();
        em.setDataSource(dataSource);
        em.setPackagesToScan("com.example.order.domain");
        em.setJpaVendorAdapter(jpaVendorAdapter);
        return em;
    }

    @Bean
    @Primary
    public PlatformTransactionManager orderTransactionManager(
            @Qualifier("orderEntityManagerFactory")
            EntityManagerFactory emf) {
        return new JpaTransactionManager(emf);
    }
}
```

결제 DataSource도 동일한 구조로 `PaymentDataSourceConfig`를 만들고, `@EnableJpaRepositories`의 `basePackages`를 `com.example.payment.repository`로 지정합니다.

## 패턴 3 — AbstractRoutingDataSource (자동 라우팅)

가장 우아한 방법입니다. `@Transactional(readOnly = true)` 어노테이션 하나만 보고 자동으로 Replica를 선택합니다.

![AbstractRoutingDataSource 자동 라우팅](/assets/posts/springboot-multi-datasource-routing.svg)

### RoutingDataSource 구현

```java
public class RoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        // 현재 트랜잭션의 readOnly 여부를 확인
        boolean isReadOnly =
            TransactionSynchronizationManager.isCurrentTransactionReadOnly();
        return isReadOnly ? "replica" : "primary";
    }
}
```

### Bean 등록

```java
@Configuration
public class RoutingDataSourceConfig {

    @Bean
    public DataSource routingDataSource(
            @Qualifier("primaryDataSource") DataSource primary,
            @Qualifier("replicaDataSource") DataSource replica) {

        Map<Object, Object> targets = new HashMap<>();
        targets.put("primary", primary);
        targets.put("replica", replica);

        RoutingDataSource routing = new RoutingDataSource();
        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(primary);  // 기본값: primary
        return routing;
    }

    // LazyConnectionDataSourceProxy로 트랜잭션 시작 후 실제 커넥션 획득
    @Bean
    @Primary
    public DataSource dataSource(
            @Qualifier("routingDataSource") DataSource routing) {
        return new LazyConnectionDataSourceProxy(routing);
    }
}
```

`LazyConnectionDataSourceProxy`가 중요합니다. 이것을 감싸지 않으면 `determineCurrentLookupKey()`가 트랜잭션 시작 전에 호출되어 `readOnly` 플래그를 읽지 못합니다.

### 서비스 레이어 사용

```java
@Service
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;

    // readOnly=true → RoutingDataSource가 Replica 선택
    @Transactional(readOnly = true)
    public List<Order> findAllOrders() {
        return orderRepository.findAll();
    }

    // readOnly=false (기본) → Primary 선택
    public Order createOrder(OrderRequest request) {
        return orderRepository.save(Order.from(request));
    }
}
```

## 주의사항

| 항목 | 내용 |
|------|------|
| 복제 지연 | Replica에는 최신 데이터가 없을 수 있음. 직후 조회 필요 시 `readOnly = false` 사용 |
| 트랜잭션 경계 | `@Transactional` 진입 시점에 DataSource 결정. 중간 변경 불가 |
| LazyConnectionDataSourceProxy | 반드시 사용. 없으면 readOnly 플래그 인식 실패 |
| 분산 트랜잭션 | 두 DataSource에 걸친 원자적 트랜잭션은 XA 트랜잭션 또는 Saga 패턴 필요 |

## 정리

| 패턴 | 적합한 상황 |
|------|------------|
| `@Primary` 수동 분리 | 특정 레이어가 명시적으로 Replica를 주입받는 경우 |
| 별도 JPA 설정 | 완전히 다른 스키마/DB를 가진 도메인 분리 |
| `AbstractRoutingDataSource` | `@Transactional(readOnly)` 기반 투명한 읽기/쓰기 분리 |

세 번째 패턴이 가장 투명하고 비즈니스 코드에 대한 침투성이 가장 낮습니다. `@Transactional(readOnly = true)`를 습관처럼 붙이는 것만으로 읽기 부하가 Replica로 분산됩니다.

---

**지난 글:** [Spring Boot DataSource Auto-configuration 파헤치기](/posts/springboot-datasource-autoconfigure/)

**다음 글:** [Spring Boot Flyway & Liquibase — DB 마이그레이션 자동화](/posts/springboot-flyway-liquibase/)

<br>
읽어주셔서 감사합니다. 😊
