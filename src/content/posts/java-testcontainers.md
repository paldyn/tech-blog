---
title: "Testcontainers — 진짜 의존성으로 통합 테스트하기"
description: "인메모리 DB로는 운영 환경을 완벽히 흉내 낼 수 없습니다. Testcontainers로 실제 PostgreSQL·Kafka·Redis 컨테이너를 테스트 안에서 띄우고, JUnit 5 통합과 자동 정리, 컨테이너 재사용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-21"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Testcontainers", "통합 테스트", "Docker", "테스트"]
featured: false
draft: false
---

[지난 글](/posts/java-assertj/)에서 AssertJ로 단언을 유창하게 표현하는 법을 살펴봤습니다. 단언이 아무리 정교해도, 테스트가 실제 운영 환경과 다른 가짜 의존성을 검증한다면 신뢰도는 떨어집니다. 특히 데이터베이스가 그렇습니다. 운영에서는 PostgreSQL을 쓰면서 테스트만 H2 인메모리 DB로 돌리면, SQL 방언 차이 때문에 "테스트는 통과했는데 배포 후 깨지는" 일이 생깁니다. **Testcontainers**는 이 간극을 메우기 위해, 테스트 실행 중에 실제 Docker 컨테이너를 띄워 진짜 의존성을 상대로 검증하게 해 줍니다.

## 왜 진짜 의존성인가

![인메모리 대체 vs Testcontainers — 환경 일치 비교](/assets/posts/java-testcontainers-vs-mock.svg)

인메모리 DB는 빠르고 가볍지만, 운영 DB와 완전히 같지는 않습니다. `JSONB` 컬럼, 윈도 함수, 부분 인덱스, 특정 방언의 `ON CONFLICT` 같은 기능은 H2에서 그대로 동작하지 않거나 미묘하게 다릅니다. 테스트가 이런 차이를 가려 버리면, 통합 테스트의 핵심 목적인 "구성 요소 간 실제 연동 검증"이 무의미해집니다.

Testcontainers는 운영에서 쓰는 것과 **동일한 Docker 이미지**를 테스트마다 띄웁니다. 같은 버전의 PostgreSQL을 상대로 쿼리를 실행하므로, 방언 차이로 인한 함정이 사라집니다. 데이터베이스뿐 아니라 Kafka, Redis, Elasticsearch, 심지어 임의의 컨테이너까지 띄울 수 있습니다.

## 생애주기 이해하기

![Testcontainers 테스트 생애주기](/assets/posts/java-testcontainers-lifecycle.svg)

핵심 흐름은 단순합니다. 테스트가 시작되면 컨테이너를 기동하고, 컨테이너가 준비되면 그 주소로 연결해 테스트를 실행하며, 테스트가 끝나면 컨테이너를 자동으로 정리합니다. 이 생애주기를 JUnit 5와 어노테이션으로 선언적으로 묶을 수 있습니다.

## 의존성과 기본 사용

Gradle에 JUnit 5용 모듈과 사용할 데이터베이스 모듈을 추가합니다.

```groovy
testImplementation "org.testcontainers:junit-jupiter:1.19.7"
testImplementation "org.testcontainers:postgresql:1.19.7"
```

가장 기본적인 형태는 컨테이너를 직접 선언하고 거기서 얻은 JDBC 정보로 연결하는 것입니다.

```java
@Testcontainers
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void 사용자를_저장하고_조회한다() throws Exception {
        try (var conn = DriverManager.getConnection(
                postgres.getJdbcUrl(),
                postgres.getUsername(),
                postgres.getPassword())) {
            assertThat(conn.isValid(2)).isTrue();
        }
    }
}
```

`@Testcontainers`가 생애주기를 관리하고, `@Container`가 붙은 필드는 컨테이너 시작·종료를 자동으로 처리합니다. `static`으로 선언하면 클래스의 모든 테스트가 컨테이너 하나를 공유하고, 인스턴스 필드로 두면 테스트마다 새로 띄웁니다.

## 스프링 부트와의 통합

스프링 부트 환경에서는 컨테이너가 동적으로 할당한 주소를 애플리케이션 설정에 주입해야 합니다. `@DynamicPropertySource`가 이 역할을 합니다.

```java
@SpringBootTest
@Testcontainers
class OrderServiceIT {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
```

스프링 부트 3.1부터는 `@ServiceConnection`을 붙이면 이 수동 매핑조차 생략할 수 있어, 컨테이너만 선언해도 데이터소스 설정이 자동으로 연결됩니다.

## 기동 비용과 컨테이너 재사용

Testcontainers의 단점은 명확합니다. Docker 데몬이 필요하고, 컨테이너 기동에 수 초가 걸립니다. 테스트 클래스마다 컨테이너를 새로 띄우면 전체 테스트 시간이 길어집니다. 이를 완화하는 방법이 몇 가지 있습니다.

`static` 필드 공유로 클래스 단위 재사용을 하고, 여러 테스트 클래스가 같은 컨테이너를 쓰도록 싱글톤 패턴이나 공통 베이스 클래스로 묶을 수 있습니다. 로컬 개발에서는 `~/.testcontainers.properties`에 `testcontainers.reuse.enable=true`를 설정하고 컨테이너에 `.withReuse(true)`를 주면, 테스트가 끝나도 컨테이너를 살려 두어 다음 실행에서 재사용합니다.

## 정리

Testcontainers는 테스트 실행 중 실제 Docker 컨테이너를 띄워, 인메모리 대체물이 가리는 환경 차이를 없애고 운영과 동일한 의존성을 상대로 통합 테스트를 수행하게 해 줍니다. `@Testcontainers`와 `@Container`로 생애주기를 선언적으로 관리하고, `@DynamicPropertySource`나 `@ServiceConnection`으로 스프링 설정에 연결하며, 컨테이너 재사용으로 기동 비용을 다스립니다. 단위 테스트는 가벼운 도구로, 의존성 연동이 중요한 통합 테스트는 Testcontainers로 — 이렇게 테스트 종류에 맞춰 도구를 나누면 신뢰도와 속도를 함께 잡을 수 있습니다.

---

**지난 글:** [AssertJ — 유창한 단언의 기술](/posts/java-assertj/)

**다음 글:** [ArchUnit — 아키텍처를 테스트로 강제하기](/posts/java-archunit/)

<br>
읽어주셔서 감사합니다. 😊
