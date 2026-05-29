---
title: "Spring 테스트 슬라이스 — @WebMvcTest·@DataJpaTest·@JsonTest 완전 정복"
description: "Spring Boot의 테스트 슬라이스 애노테이션(@WebMvcTest, @DataJpaTest, @JsonTest, @RestClientTest)이 어떻게 컨텍스트 범위를 한정하고, @MockBean과 조합해 각 레이어를 독립적으로 빠르게 검증하는지 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "테스트 슬라이스", "@WebMvcTest", "@DataJpaTest", "@JsonTest", "@MockBean", "단위 테스트", "Spring Boot Test"]
featured: false
draft: false
---

[지난 글](/posts/spring-test-mockito/)에서 Mockito로 의존 객체를 대체하는 방법을 살펴봤습니다. 이번에는 한 단계 위로 올라가, Spring 컨텍스트를 **부분적으로만** 띄우는 **테스트 슬라이스**를 다룹니다. `@SpringBootTest`로 전체 컨텍스트를 로딩하면 느리고 무겁습니다. 슬라이스 애노테이션은 필요한 레이어 빈만 등록해 테스트를 빠르게 유지하면서도 실제 Spring 인프라에서 검증할 수 있게 해 줍니다.

## 슬라이스 테스트란?

Spring Boot 테스트 슬라이스는 "이 테스트는 어느 레이어를 검증하는가"라는 질문에 대한 답입니다. 각 슬라이스 애노테이션은 해당 레이어에 필요한 자동 구성만 활성화하고, 나머지 빈은 등록하지 않습니다.

![Spring 테스트 슬라이스 전체 구조](/assets/posts/spring-test-slices-overview.svg)

테스트 피라미드의 관점에서 슬라이스 테스트는 단위 테스트와 통합 테스트 사이에 위치합니다. 실제 Spring 컨텍스트를 사용하므로 프레임워크 통합 오류를 잡을 수 있고, 컨텍스트 범위가 좁아 단위 테스트에 가까운 속도를 냅니다.

## @WebMvcTest — Controller 레이어 검증

`@WebMvcTest`는 MVC 관련 빈만 로드합니다. `@Controller`, `@ControllerAdvice`, `@JsonComponent`, `Filter`, `WebMvcConfigurer` 등이 포함되고, `@Service`나 `@Repository`는 포함되지 않습니다.

```java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    UserService userService;  // Service는 Mock으로 대체

    @Test
    void 사용자_조회_성공() throws Exception {
        // given
        given(userService.findById(1L))
            .willReturn(new UserDto(1L, "홍길동", "hong@example.com"));

        // when & then
        mockMvc.perform(get("/api/users/1")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("홍길동"))
            .andExpect(jsonPath("$.email").value("hong@example.com"));
    }

    @Test
    void 사용자_생성_유효성_실패() throws Exception {
        String body = """
            {"name": "", "email": "invalid-email"}
            """;

        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest());
    }
}
```

`MockMvc`는 `@WebMvcTest`가 자동으로 빈으로 등록해 주므로 `@Autowired`만 붙이면 됩니다. `@MockBean`으로 등록된 `UserService`는 Mockito Mock 객체이며, `given().willReturn()`으로 행동을 정의합니다.

### @WebMvcTest에서 Security 처리

Spring Security가 의존성에 있으면 `@WebMvcTest`는 Security 자동 구성도 함께 적용합니다. 보안 설정 없이 컨트롤러만 테스트하려면 다음처럼 비활성화합니다.

```java
@WebMvcTest(
    value = UserController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class
)
```

혹은 `SecurityMockMvcConfigurer`를 사용해 인증된 사용자로 요청을 보낼 수도 있습니다.

```java
mockMvc.perform(get("/api/users/1")
        .with(user("admin").roles("ADMIN")))
    .andExpect(status().isOk());
```

## @DataJpaTest — JPA 레이어 검증

`@DataJpaTest`는 JPA 관련 컴포넌트만 로드합니다. `EntityManager`, `DataSource`, `JdbcTemplate`, `@Repository` 빈이 포함되고, `@Service`, `@Controller`는 제외됩니다. 기본적으로 인메모리 데이터베이스(H2)를 사용하고, 각 테스트는 `@Transactional`로 감싸져 롤백됩니다.

```java
@DataJpaTest
class UserRepositoryTest {

    @Autowired
    UserRepository userRepository;

    @Autowired
    TestEntityManager em;  // JPA EntityManager 래퍼

    @Test
    void 이메일로_사용자_조회() {
        // given — TestEntityManager로 직접 영속화
        User user = new User("홍길동", "hong@example.com");
        em.persistAndFlush(user);
        em.clear();  // 1차 캐시 비우기

        // when
        Optional<User> found = userRepository.findByEmail("hong@example.com");

        // then
        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("홍길동");
    }
}
```

`TestEntityManager`는 `EntityManager`의 편의 래퍼로, `persistAndFlush()`, `find()` 등 테스트에서 자주 쓰는 작업을 간결하게 제공합니다.

### 실제 데이터베이스로 @DataJpaTest 실행

H2 대신 실제 데이터베이스(PostgreSQL 등)를 사용하려면 자동 교체를 비활성화합니다.

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
class UserRepositoryIntegrationTest {
    // 실제 DB 사용
}
```

이 경우 Testcontainers와 조합해 실제 DB를 컨테이너로 띄우는 것이 일반적입니다.

## @JsonTest — JSON 직렬화 검증

`@JsonTest`는 Jackson 직렬화/역직렬화만 검증하는 슬라이스입니다. `ObjectMapper`와 `JacksonTester`가 자동 구성됩니다.

```java
@JsonTest
class UserDtoJsonTest {

    @Autowired
    JacksonTester<UserDto> json;

    @Test
    void 직렬화_검증() throws Exception {
        UserDto dto = new UserDto(1L, "홍길동", "hong@example.com");

        JsonContent<UserDto> result = json.write(dto);

        assertThat(result).hasJsonPathNumberValue("$.id", 1);
        assertThat(result).hasJsonPathStringValue("$.name", "홍길동");
        assertThat(result).doesNotHaveJsonPath("$.password");  // 민감 필드 제외 확인
    }

    @Test
    void 역직렬화_검증() throws Exception {
        String content = """
            {"id": 1, "name": "홍길동", "email": "hong@example.com"}
            """;

        UserDto dto = json.parseObject(content);

        assertThat(dto.getId()).isEqualTo(1L);
        assertThat(dto.getName()).isEqualTo("홍길동");
    }
}
```

`@JsonIgnore`, `@JsonProperty`, 커스텀 직렬화기가 예상대로 동작하는지 빠르게 검증할 수 있습니다.

## @RestClientTest — HTTP 클라이언트 검증

외부 API를 호출하는 `RestTemplate` 또는 `RestClient` 빈을 테스트합니다.

```java
@RestClientTest(WeatherClient.class)
class WeatherClientTest {

    @Autowired
    WeatherClient client;

    @Autowired
    MockRestServiceServer server;  // 가짜 HTTP 서버

    @Test
    void 날씨_조회_성공() {
        server.expect(requestTo("/weather?city=Seoul"))
            .andRespond(withSuccess(
                """{"city":"Seoul","temp":22}""",
                MediaType.APPLICATION_JSON));

        WeatherDto result = client.getWeather("Seoul");

        assertThat(result.getCity()).isEqualTo("Seoul");
        assertThat(result.getTemp()).isEqualTo(22);
    }
}
```

## 슬라이스 코드 패턴 한눈에 보기

![슬라이스 테스트 코드 패턴](/assets/posts/spring-test-slices-code.svg)

## @MockBean vs @Mock

슬라이스 테스트에서 의존 객체를 대체할 때 두 가지 선택지가 있습니다.

| 구분 | `@MockBean` | `@Mock` |
|---|---|---|
| 등록 위치 | Spring ApplicationContext | 순수 Mockito |
| 사용 위치 | `@WebMvcTest`, `@DataJpaTest` 등 | `@ExtendWith(MockitoExtension.class)` |
| 목적 | Spring 빈을 Mock으로 교체 | 순수 단위 테스트 |
| 컨텍스트 | 재생성 유발 (캐시 깨짐) | 컨텍스트 무관 |

`@MockBean`을 남용하면 매 테스트 클래스마다 ApplicationContext가 재생성되어 전체 테스트가 느려집니다. 같은 슬라이스 설정을 공유하는 기반 클래스를 만들어 컨텍스트 캐시를 활용하는 것이 좋습니다.

```java
// 공통 기반 클래스로 컨텍스트 캐시 재사용
@WebMvcTest
@Import(SecurityTestConfig.class)
abstract class ControllerTestBase {

    @Autowired
    protected MockMvc mockMvc;

    @MockBean
    protected UserService userService;
}
```

## 커스텀 슬라이스 정의

기본 제공 슬라이스 외에 팀만의 커스텀 슬라이스를 정의할 수 있습니다.

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@BootstrapWith(DataJpaTestContextBootstrapper.class)
@ExtendWith(SpringExtension.class)
@OverrideAutoConfiguration(enabled = false)
@TypeExcludeFilters(DataJpaTypeExcludeFilter.class)
@AutoConfigureCache
@AutoConfigureDataJpa
@AutoConfigureTestDatabase
@AutoConfigureTestEntityManager
@ImportAutoConfiguration
public @interface MyServiceTest {
    // Service 레이어 전용 슬라이스
}
```

실무에서는 Service + Repository 조합을 자주 테스트하는 경우 이런 커스텀 슬라이스를 만들어 재사용합니다.

## 언제 어떤 슬라이스를 쓸까

- **@WebMvcTest**: HTTP 요청/응답 매핑, 유효성 검사, 응답 포맷, Security 규칙 검증
- **@DataJpaTest**: 쿼리 메서드, JPQL, Native Query, 연관관계, 페이지네이션 검증
- **@JsonTest**: DTO 직렬화/역직렬화, 필드 노출 정책, 날짜 포맷 검증
- **@RestClientTest**: 외부 API 클라이언트의 요청 구성, 응답 파싱 검증
- **@SpringBootTest**: 전 레이어 관통 플로우, 실제 DB 연동, 성능 측정

---

**지난 글:** [Spring 테스트 — Mockito 완전 정복](/posts/spring-test-mockito/)

**다음 글:** [Spring 테스트 — @SpringBootTest 통합 테스트](/posts/spring-test-springboottest/)

<br>
읽어주셔서 감사합니다. 😊
