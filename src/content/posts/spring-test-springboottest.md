---
title: "Spring 테스트 — @SpringBootTest 통합 테스트 완전 정복"
description: "@SpringBootTest의 webEnvironment 옵션, ApplicationContext 캐시 메커니즘, TestRestTemplate·MockMvc 선택 기준, @ActiveProfiles·properties 조합, @DirtiesContext 남용 회피까지 Spring Boot 통합 테스트의 모든 것을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "@SpringBootTest", "통합 테스트", "TestRestTemplate", "MockMvc", "ApplicationContext", "@ActiveProfiles", "@DirtiesContext"]
featured: false
draft: false
---

[지난 글](/posts/spring-test-slices/)에서 슬라이스 테스트로 레이어를 좁혀 빠르게 검증하는 방법을 알아봤습니다. 슬라이스 테스트가 레이어 하나를 집중 검증한다면, `@SpringBootTest`는 전체 애플리케이션 컨텍스트를 올려 실제 운영 환경에 가까운 상태를 검증합니다. 이번 글에서는 `@SpringBootTest`의 세부 옵션과 올바른 사용법을 살펴봅니다.

## @SpringBootTest 기본 동작

`@SpringBootTest`는 `@SpringBootApplication`이 붙은 기본 설정 클래스를 기준으로 전체 빈을 등록합니다. 기본적으로 `webEnvironment = MOCK`이 적용되어 서블릿 컨테이너 없이 MockMvc 환경으로 동작합니다.

```java
@SpringBootTest  // webEnvironment = MOCK (기본값)
@AutoConfigureMockMvc
class UserServiceIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void 회원가입_후_조회_성공() throws Exception {
        // DB에 직접 저장 후 API 호출
        userRepository.save(new User("홍길동", "hong@example.com"));

        mockMvc.perform(get("/api/users")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));
    }
}
```

슬라이스 테스트와 달리 `@Service`, `@Repository`, 외부 연동 빈까지 모두 실제로 올라옵니다. 따라서 Controller → Service → Repository 전체 흐름을 하나의 테스트에서 검증할 수 있습니다.

## webEnvironment 옵션

![webEnvironment 옵션과 컨텍스트 캐시](/assets/posts/spring-test-springboottest-overview.svg)

### MOCK (기본값)

MockMvc 기반의 서블릿 환경을 사용합니다. 실제 HTTP 서버를 띄우지 않아 빠르고, 대부분의 통합 테스트에 권장합니다.

```java
@SpringBootTest
@AutoConfigureMockMvc
class MockEnvTest {
    @Autowired MockMvc mockMvc;
}
```

`@AutoConfigureMockMvc`를 붙이면 MockMvc가 자동 구성됩니다. Security, Filter 등 서블릿 레이어 전체가 적용됩니다.

### RANDOM_PORT

실제 내장 서버(Tomcat 등)를 랜덤 포트로 띄웁니다. `TestRestTemplate` 또는 `WebTestClient`로 실제 HTTP 요청을 보냅니다.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealServerTest {

    @Autowired
    TestRestTemplate restTemplate;

    @LocalServerPort
    int port;

    @Test
    void 실제_HTTP_요청_테스트() {
        ResponseEntity<UserDto> response = restTemplate
            .getForEntity("/api/users/1", UserDto.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getName()).isEqualTo("홍길동");
    }
}
```

포트 충돌 없이 병렬 테스트 실행이 가능하고, 쿠키·리다이렉트 같은 HTTP 수준 동작도 검증할 수 있습니다.

### WebTestClient 사용 (Reactive)

Spring WebFlux 프로젝트나 MVC에서 `@AutoConfigureWebTestClient`를 추가하면 WebTestClient를 사용할 수 있습니다.

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@AutoConfigureWebTestClient
class WebTestClientTest {

    @Autowired
    WebTestClient webTestClient;

    @Test
    void 사용자_목록_조회() {
        webTestClient.get().uri("/api/users")
            .exchange()
            .expectStatus().isOk()
            .expectBodyList(UserDto.class)
            .hasSize(1)
            .contains(new UserDto(1L, "홍길동", "hong@example.com"));
    }
}
```

## ApplicationContext 캐시

Spring 테스트 프레임워크는 동일한 설정의 컨텍스트를 JVM 내에서 캐시합니다. 같은 설정을 공유하는 테스트 클래스들이 컨텍스트를 재사용하므로 전체 테스트 시간이 크게 줄어듭니다.

컨텍스트 캐시 키는 다음 설정들의 조합으로 결정됩니다:
- `@SpringBootTest` 속성 (webEnvironment, classes, properties 등)
- `@ActiveProfiles` 값
- `@MockBean`, `@SpyBean` 목록
- `@TestPropertySource` 설정
- 컨텍스트 로더 종류

```java
// 이 두 클래스는 같은 컨텍스트를 공유 → 캐시 히트
@SpringBootTest
@ActiveProfiles("test")
class UserTest { ... }

@SpringBootTest
@ActiveProfiles("test")
class OrderTest { ... }

// 이 클래스는 @MockBean이 다름 → 새 컨텍스트 생성
@SpringBootTest
@ActiveProfiles("test")
class PaymentTest {
    @MockBean PaymentGateway gateway;  // 다른 컨텍스트!
}
```

### @MockBean과 컨텍스트 캐시

`@MockBean`은 ApplicationContext에 Mock 빈을 주입하므로 컨텍스트 설정이 변경됩니다. 따라서 `@MockBean` 조합이 다른 테스트마다 새 컨텍스트가 생성됩니다.

컨텍스트 재사용을 극대화하려면 공통 `@MockBean` 설정을 기반 클래스로 추출합니다.

```java
// 모든 통합 테스트의 기반 클래스
@SpringBootTest
@ActiveProfiles("test")
abstract class IntegrationTestBase {
    @MockBean
    EmailService emailService;  // 공통 Mock

    @MockBean
    SlackNotifier slackNotifier;  // 공통 Mock
}

// 같은 컨텍스트 캐시 사용
class UserIntegrationTest extends IntegrationTestBase { ... }
class OrderIntegrationTest extends IntegrationTestBase { ... }
```

## 테스트 데이터 격리

`@SpringBootTest`는 기본적으로 `@Transactional`이 없으므로 각 테스트가 DB를 오염시킬 수 있습니다. 격리 전략은 세 가지입니다.

### 전략 1: @Transactional 롤백

```java
@SpringBootTest
@Transactional  // 각 테스트 종료 후 롤백
class UserTransactionalTest {

    @Autowired
    UserRepository repository;

    @Test
    void 저장_후_조회() {
        repository.save(new User("홍길동", "hong@example.com"));
        // 테스트 종료 시 자동 롤백
    }
}
```

단, `RANDOM_PORT` 환경에서는 서버 스레드와 테스트 스레드가 달라 `@Transactional`이 동작하지 않습니다.

### 전략 2: @BeforeEach / @AfterEach에서 정리

```java
@BeforeEach
void setUp() {
    userRepository.deleteAll();
    orderRepository.deleteAll();
}
```

### 전략 3: @Sql 스크립트

```java
@SpringBootTest
@Sql(scripts = "/test-data.sql",
     executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/cleanup.sql",
     executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class SqlScriptTest { ... }
```

## 테스트 환경 설정 분리

### application-test.yml

`src/test/resources/application-test.yml`에 테스트 전용 설정을 둡니다.

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=PostgreSQL
    driver-class-name: org.h2.Driver
  jpa:
    hibernate:
      ddl-auto: create-drop
    show-sql: true
  mail:
    host: localhost  # 가짜 메일 서버
```

```java
@SpringBootTest
@ActiveProfiles("test")
class ProfileTest { ... }
```

### properties 인라인 오버라이드

특정 테스트에서만 일부 설정을 바꾸려면 `properties` 속성을 사용합니다.

```java
@SpringBootTest(properties = {
    "app.feature.payment=false",
    "spring.cache.type=none"
})
class FeatureFlagTest { ... }
```

## @DirtiesContext 주의

`@DirtiesContext`는 해당 테스트 후 컨텍스트를 강제 폐기합니다. 다음 테스트에서 새 컨텍스트를 생성하므로 캐시가 무의미해집니다.

```java
// 가급적 사용하지 말 것
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class BadPracticeTest { ... }
```

`@DirtiesContext`가 필요한 상황처럼 보여도 대부분 `@Transactional` 롤백이나 `@BeforeEach` 정리로 해결됩니다. 정말 컨텍스트 레벨 상태(static 필드, 싱글톤 초기화 등)를 리셋해야 할 때만 사용합니다.

## @SpringBootTest 코드 패턴 모음

![@SpringBootTest 실전 코드 패턴](/assets/posts/spring-test-springboottest-code.svg)

## @SpringBootTest vs 슬라이스 선택 기준

| 상황 | 권장 |
|---|---|
| Controller 요청/응답 매핑 검증 | `@WebMvcTest` |
| JPA 쿼리 검증 | `@DataJpaTest` |
| Controller → Service → DB 전체 흐름 | `@SpringBootTest` |
| 외부 API 클라이언트 검증 | `@RestClientTest` |
| Security 필터 체인 E2E | `@SpringBootTest(RANDOM_PORT)` |
| 메시지 직렬화 검증 | `@JsonTest` |

---

**지난 글:** [Spring 테스트 슬라이스 — @WebMvcTest·@DataJpaTest·@JsonTest 완전 정복](/posts/spring-test-slices/)

**다음 글:** [Spring 테스트 — MockMvc 심화](/posts/spring-test-mockmvc/)

<br>
읽어주셔서 감사합니다. 😊
