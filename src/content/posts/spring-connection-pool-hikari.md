---
title: "Spring HikariCP 커넥션 풀 완전 정복: 원리·설정·모니터링"
description: "커넥션 풀이 필요한 이유부터 HikariCP가 Spring Boot 기본 풀로 선택된 배경, maximumPoolSize·connectionTimeout·maxLifetime 등 핵심 설정의 의미와 권장값, 트랜잭션 동기화와의 관계, Actuator·Micrometer를 통한 모니터링까지 실전 운영 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "HikariCP", "커넥션풀", "DataSource", "maximumPoolSize", "connectionTimeout", "maxLifetime", "Actuator", "Micrometer", "트랜잭션동기화"]
featured: false
draft: false
---

[지난 글](/posts/spring-jdbc-template/)에서 JdbcTemplate이 Connection 획득과 반납을 자동으로 처리한다고 설명했습니다. 그 Connection이 어디서 오는지, 어떻게 재사용되는지를 담당하는 것이 **커넥션 풀**입니다. Spring Boot는 기본 커넥션 풀로 **HikariCP**를 채택하고 있으며, 설정 하나가 애플리케이션 전체 처리량과 안정성을 좌우합니다.

## 커넥션 풀이 필요한 이유

DB Connection 하나를 만들려면 TCP 핸드셰이크, 인증, 세션 초기화가 필요합니다. 이 과정은 수 밀리초에서 수십 밀리초가 걸립니다. 초당 수백 건의 요청이 들어오는 서버에서 매 요청마다 Connection을 새로 생성하면 응답 지연이 누적되고 DB 서버도 과부하를 받습니다.

커넥션 풀은 애플리케이션 시작 시 미리 Connection을 만들어 놓고, 요청이 들어올 때 빌려주고, 처리가 끝나면 반납받아 재사용합니다. `Connection.close()`를 호출해도 실제 TCP 연결은 끊어지지 않고 풀로 돌아갑니다.

## HikariCP 동작 원리

![HikariCP 커넥션 풀 동작 원리](/assets/posts/spring-connection-pool-hikari-flow.svg)

HikariCP는 ConcurrentBag이라는 독자적인 데이터 구조로 Connection을 관리합니다. 스레드 로컬 캐싱과 CAS(Compare-And-Swap) 기반 잠금 없는 알고리즘으로 경쟁 상황에서 다른 풀 구현체보다 우수한 처리량을 보입니다.

Spring Boot 의존성에 `spring-boot-starter-data-jpa` 또는 `spring-boot-starter-jdbc`가 있으면 HikariCP가 자동으로 구성됩니다.

```xml
<!-- HikariCP 의존성 (spring-boot-starter-jdbc에 포함) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
```

## 핵심 설정 속성

![HikariCP 핵심 설정 & 트러블슈팅](/assets/posts/spring-connection-pool-hikari-config.svg)

### 풀 크기: maximumPoolSize와 minimumIdle

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 20   # = maximumPoolSize 권장
```

**풀 크기 = CPU 코어 수 × 2 + 유효 스핀들 수**라는 공식이 알려져 있지만, 실제로는 워크로드에 따라 다릅니다. I/O 바운드 작업이 많은 API 서버는 코어 수보다 더 많은 Connection이 필요합니다. 처음에는 코어 수의 2~3배로 시작하고 부하 테스트로 조정하는 것이 현실적입니다.

`minimumIdle`을 `maximumPoolSize`와 같게 설정하면 풀 크기가 고정됩니다(권장). 다르게 설정하면 HikariCP가 유휴 Connection을 반납하고 필요할 때 다시 생성하는데, 이 과정 자체가 지연을 유발합니다.

### 타임아웃: connectionTimeout

```yaml
hikari:
  connection-timeout: 30000   # ms, 기본 30초
```

풀에서 Connection을 가져오지 못했을 때 기다리는 최대 시간입니다. 이 시간 초과 시 `SQLTransientConnectionException`이 발생합니다. 값이 너무 길면 요청이 큐에서 대기하며 서버 메모리를 소비합니다. 5~10초로 줄이고 스로틀링 로직을 앞단에 두는 설계가 일반적입니다.

### 수명 관리: maxLifetime과 idleTimeout

```yaml
hikari:
  max-lifetime: 1800000      # ms, 기본 30분
  idle-timeout: 600000       # ms, 기본 10분
  keepalive-time: 60000      # ms, 기본 0(비활성)
```

`maxLifetime`은 Connection이 생성된 후 강제로 교체되는 시간입니다. **MySQL의 `wait_timeout`(기본 8시간)보다 반드시 짧게 설정**해야 합니다. DB가 먼저 끊으면 애플리케이션은 유효하지 않은 Connection을 사용하려다 오류가 납니다.

`keepalive-time`은 유휴 Connection에 주기적으로 테스트 쿼리(`SELECT 1`)를 날려 살아있음을 확인합니다. 방화벽이나 로드밸런서가 유휴 TCP 연결을 끊는 환경에서 필수입니다.

## Java 코드로 직접 구성

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        config.setUsername("user");
        config.setPassword("pass");
        config.setMaximumPoolSize(20);
        config.setMinimumIdle(20);
        config.setConnectionTimeout(30_000);
        config.setMaxLifetime(1_800_000);
        config.setKeepaliveTime(60_000);
        config.setPoolName("MainPool");
        return new HikariDataSource(config);
    }
}
```

`@ConfigurationProperties`를 같이 선언하면 `application.yml`의 `spring.datasource.hikari.*` 속성이 빈 설정을 덮어씁니다. 코드와 설정 파일 두 곳에서 동시에 관리할 수 있습니다.

## 트랜잭션 동기화와의 관계

`@Transactional` 메서드가 시작되면 Spring의 `TransactionSynchronizationManager`가 현재 스레드에 Connection을 바인딩합니다. 같은 트랜잭션 안의 모든 JdbcTemplate 호출은 **동일한 Connection**을 사용하기 때문에 트랜잭션이 보장됩니다.

```java
@Service
@Transactional
public class OrderService {

    public void placeOrder(Order order) {
        // 아래 두 호출은 같은 Connection을 사용
        orderRepository.save(order);          // jdbc.update(...)
        inventoryRepository.decrease(order);  // jdbc.update(...)
        // 메서드 종료 시 커밋 or 예외 시 롤백 후 Connection 반납
    }
}
```

트랜잭션이 없으면 JdbcTemplate은 매 호출마다 풀에서 Connection을 빌리고 바로 반납합니다. 짧은 조회 쿼리가 많은 경우 이 방식이 오히려 효율적입니다.

## 커넥션 누수 감지

```yaml
hikari:
  leak-detection-threshold: 5000   # ms, 0=비활성
```

Connection을 빌린 뒤 5초 안에 반납되지 않으면 경고 로그를 출력합니다. 개발·스테이징 환경에서 활성화하면 누수 위치를 스택 트레이스로 확인할 수 있습니다. 운영 환경에서는 `connectionTimeout`보다 크게 설정하거나 비활성화합니다.

```java
// 누수 예시 — try-with-resources 없이 Connection 직접 사용
Connection conn = dataSource.getConnection();
// ... 처리 도중 예외 발생 시 conn.close()가 호출되지 않음 → 누수
```

JdbcTemplate을 사용하면 이런 누수가 발생하지 않습니다. 하지만 `DataSource.getConnection()`을 직접 호출하는 레거시 코드에는 누수 감지가 유효합니다.

## Actuator로 풀 상태 모니터링

```yaml
management:
  endpoint:
    metrics:
      enabled: true
  metrics:
    enable:
      hikaricp: true
```

`/actuator/metrics/hikaricp.connections` 엔드포인트에서 다음 지표를 조회할 수 있습니다.

```json
{
  "name": "hikaricp.connections",
  "measurements": [
    {"statistic": "VALUE", "value": 20.0}
  ],
  "availableTags": [
    {"tag": "pool", "values": ["MainPool"]}
  ]
}
```

주요 메트릭:
- `hikaricp.connections` — 전체 Connection 수
- `hikaricp.connections.active` — 현재 사용 중인 수
- `hikaricp.connections.idle` — 유휴 수
- `hikaricp.connections.pending` — 대기 중인 스레드 수
- `hikaricp.connections.acquire` — 평균 획득 시간

Prometheus + Grafana 환경에서는 `hikaricp.connections.pending`이 지속적으로 0보다 크면 풀 부족 신호입니다.

## 멀티 DataSource 설정

```yaml
spring:
  datasource:
    primary:
      url: jdbc:mysql://primary/main
      hikari:
        maximum-pool-size: 20
        pool-name: PrimaryPool
    secondary:
      url: jdbc:mysql://secondary/report
      hikari:
        maximum-pool-size: 5
        pool-name: ReportPool
```

```java
@Primary
@Bean
@ConfigurationProperties("spring.datasource.primary.hikari")
public DataSource primaryDataSource() {
    return DataSourceBuilder.create()
            .type(HikariDataSource.class).build();
}

@Bean
@ConfigurationProperties("spring.datasource.secondary.hikari")
public DataSource secondaryDataSource() {
    return DataSourceBuilder.create()
            .type(HikariDataSource.class).build();
}
```

풀 이름을 다르게 지정하면 Actuator 메트릭에서 두 풀을 구분해 모니터링할 수 있습니다.

## 정리

- 커넥션 풀은 Connection 생성 비용을 제거하고 DB 연결 수를 제한해 처리량을 높임
- HikariCP는 Spring Boot 기본 풀: `maximum-pool-size`를 `minimum-idle`과 동일하게 고정 풀로 운영 권장
- `max-lifetime`은 DB `wait_timeout`보다 반드시 짧게, `keepalive-time`으로 방화벽 연결 차단 방어
- `leak-detection-threshold`로 개발 단계 누수 조기 발견
- Actuator `hikaricp.connections.pending`이 지속적으로 양수이면 풀 크기 증설 검토

---

**지난 글:** [Spring JdbcTemplate 완전 정복: 반복 코드 제거와 안전한 DB 접근](/posts/spring-jdbc-template/)

**다음 글:** [Spring PlatformTransactionManager 완전 정복: 트랜잭션 추상화와 동기화](/posts/spring-platform-transaction-manager/)

<br>
읽어주셔서 감사합니다. 😊
