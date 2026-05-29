---
title: "Spring 테스트 — Testcontainers로 실제 DB 테스트 완전 정복"
description: "Testcontainers로 PostgreSQL·MySQL·Redis·Kafka 컨테이너를 테스트에서 제어하는 방법, @DynamicPropertySource 연동, 컨테이너 재사용(withReuse) 전략, Spring Boot 3.1+ 서비스 커넥션 자동 구성, Flyway 마이그레이션 통합까지 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Testcontainers", "통합 테스트", "PostgreSQL", "@DynamicPropertySource", "Docker", "Redis", "Kafka", "@ServiceConnection"]
featured: false
draft: false
---

[지난 글](/posts/spring-test-mockmvc/)에서 MockMvc로 Controller 레이어를 세밀하게 검증하는 방법을 알아봤습니다. Controller는 MockMvc로 충분히 검증할 수 있지만, Repository 레이어는 H2 인메모리 DB와 실제 PostgreSQL이 미묘하게 다를 수 있습니다. **Testcontainers**는 테스트 실행 시 실제 Docker 컨테이너를 제어해 이 간격을 없애줍니다.

## Testcontainers란?

Testcontainers는 JUnit 5와 통합되어 테스트 생명주기에 맞게 Docker 컨테이너를 시작·종료합니다. PostgreSQL, MySQL, Redis, Kafka, Elasticsearch 등 수십 종의 컨테이너 모듈을 제공하며, 임의 이미지(`GenericContainer`)도 사용할 수 있습니다.

```xml
<!-- Maven 의존성 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
</dependency>
```

Spring Boot 3.1+ 이상은 `spring-boot-testcontainers`가 BOM에 포함되어 버전 관리를 자동 처리합니다.

## 기본 사용법

### @DataJpaTest + PostgreSQL 컨테이너

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)  // H2 자동 교체 비활성화
@Testcontainers
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    UserRepository userRepository;

    @Test
    void JSON_타입_컬럼_쿼리() {
        // PostgreSQL 전용 JSON 연산자 테스트
        User user = new User("홍길동", Map.of("theme", "dark", "lang", "ko"));
        userRepository.save(user);

        List<User> found = userRepository.findByPreference("theme", "dark");
        assertThat(found).hasSize(1);
    }
}
```

`@Container static`으로 선언하면 테스트 클래스 전체에서 컨테이너를 공유합니다. `static` 없이 인스턴스 필드로 선언하면 테스트 메서드마다 재생성되어 느려집니다.

## Testcontainers 동작 구조

![Testcontainers 동작 구조와 컨테이너 모듈](/assets/posts/spring-test-testcontainers-arch.svg)

## Spring Boot 3.1+ @ServiceConnection

Spring Boot 3.1부터 `@ServiceConnection`을 사용하면 `@DynamicPropertySource` 없이도 자동으로 DataSource 설정이 연결됩니다.

```java
@SpringBootTest
@Testcontainers
class ServiceConnectionTest {

    @Container
    @ServiceConnection  // 자동으로 spring.datasource.* 설정
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16");

    @Container
    @ServiceConnection  // 자동으로 spring.data.redis.* 설정
    static GenericContainer<?> redis =
        new GenericContainer<>("redis:7")
            .withExposedPorts(6379);

    @Autowired
    UserRepository userRepository;

    @Autowired
    StringRedisTemplate redisTemplate;
}
```

`@ServiceConnection`은 컨테이너 타입을 인식해 적절한 프로퍼티 키를 자동 매핑합니다. `PostgreSQLContainer`는 `spring.datasource.*`, `RedisContainer`는 `spring.data.redis.*` 등.

## 컨테이너 재사용 전략

### withReuse(true) — JVM 수준 재사용

```java
@Container
static PostgreSQLContainer<?> postgres =
    new PostgreSQLContainer<>("postgres:16")
        .withReuse(true);  // 컨테이너를 JVM 종료까지 유지
```

`withReuse(true)`를 사용하려면 `~/.testcontainers.properties`에 다음을 추가해야 합니다.

```properties
testcontainers.reuse.enable=true
```

컨테이너가 이미 실행 중이면 새로 시작하지 않아 전체 테스트 스위트 실행 시간이 대폭 줄어듭니다.

### 공유 기반 클래스 — 여러 테스트에서 재사용

```java
@SpringBootTest
@Testcontainers
@ActiveProfiles("integration")
abstract class IntegrationTestBase {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16")
            .withReuse(true);

    @Container
    static GenericContainer<?> redis =
        new GenericContainer<>("redis:7")
            .withExposedPorts(6379)
            .withReuse(true);

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port",
            () -> redis.getMappedPort(6379));
    }
}
```

이 기반 클래스를 상속하는 모든 테스트가 같은 컨테이너와 Spring ApplicationContext를 재사용합니다. `@MockBean`이 없으면 캐시 키가 동일해 컨텍스트도 재사용됩니다.

![Testcontainers 실전 코드 패턴](/assets/posts/spring-test-testcontainers-code.svg)

## Kafka 통합 테스트

```java
@SpringBootTest
@Testcontainers
class OrderEventTest extends IntegrationTestBase {

    @Container
    static KafkaContainer kafka =
        new KafkaContainer(DockerImageName.parse(
            "confluentinc/cp-kafka:7.6.0"));

    @DynamicPropertySource
    static void kafkaProps(DynamicPropertyRegistry registry) {
        registry.add("spring.kafka.bootstrap-servers",
            kafka::getBootstrapServers);
    }

    @Autowired
    KafkaTemplate<String, OrderEvent> kafkaTemplate;

    @Autowired
    OrderEventConsumer consumer;

    @Test
    void 주문_이벤트_발행_소비() throws Exception {
        kafkaTemplate.send("orders",
            new OrderEvent("ORD-001", OrderStatus.PLACED));

        // 컨슈머가 메시지를 처리할 때까지 대기
        assertThat(consumer.getLatch().await(10, TimeUnit.SECONDS))
            .isTrue();
        assertThat(consumer.getLastEvent().getOrderId())
            .isEqualTo("ORD-001");
    }
}
```

## Flyway와 함께 사용

Testcontainers + Flyway 조합은 마이그레이션 스크립트가 실제 DB에서 올바르게 동작하는지 검증하는 강력한 방법입니다.

```java
@SpringBootTest
@Testcontainers
class FlywayMigrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16");

    @Autowired
    Flyway flyway;

    @Test
    void 마이그레이션_실행_성공() {
        MigrationInfoService info = flyway.info();

        assertThat(info.pending()).isEmpty();
        assertThat(info.applied()).isNotEmpty();
        assertThat(info.current().getVersion().toString())
            .isNotEmpty();
    }
}
```

## 테스트 데이터 격리

Testcontainers 환경에서는 컨테이너가 공유되므로 테스트 간 데이터 격리가 중요합니다.

```java
abstract class IntegrationTestBase {
    // ... 컨테이너 설정

    @BeforeEach
    void cleanDatabase(@Autowired DataSource dataSource) throws Exception {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            // 모든 테이블 트런케이트
            stmt.execute("TRUNCATE TABLE users, orders RESTART IDENTITY CASCADE");
        }
    }
}
```

또는 `@Sql`로 각 테스트마다 초기 데이터를 넣고 정리합니다.

```java
@Test
@Sql("/sql/insert-users.sql")
@Sql(scripts = "/sql/cleanup.sql",
     executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
void 사용자_이메일_검색() {
    List<User> found = userRepository.findByEmailDomain("example.com");
    assertThat(found).hasSize(2);
}
```

## Testcontainers Desktop

로컬 개발 시 Testcontainers Desktop 앱을 설치하면 컨테이너 상태를 GUI로 확인하고, 고정 포트로 컨테이너를 노출해 디버깅할 수 있습니다. 컨테이너가 예상대로 시작되지 않을 때 특히 유용합니다.

## 성능 최적화 체크리스트

| 항목 | 설명 |
|---|---|
| `static @Container` | 클래스당 1개 컨테이너 공유 |
| `withReuse(true)` | JVM 수준 재사용으로 시작 오버헤드 제거 |
| 공유 기반 클래스 | Spring Context 캐시 키 통일 → 재사용 |
| `@MockBean` 최소화 | Context 캐시 무효화 방지 |
| 병렬 테스트 실행 | JUnit 5 parallel execution 활성화 |

H2로 빠른 단위 수준 Repository 테스트를 하고, Testcontainers로 통합 테스트를 분리하는 전략이 실무에서 가장 효율적입니다.

---

**지난 글:** [Spring 테스트 — MockMvc 심화 완전 정복](/posts/spring-test-mockmvc/)

<br>
읽어주셔서 감사합니다. 😊
