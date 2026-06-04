---
title: "WebClient: 비동기 HTTP 클라이언트 완전 가이드"
description: "RestTemplate를 대체하는 Spring WebClient의 빌드 방법부터 GET/POST 요청, 에러 처리, 타임아웃·재시도, ExchangeFilter 체인, 테스트까지 실전 코드로 완전히 익힙니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["WebClient", "Spring WebFlux", "HTTP 클라이언트", "RestTemplate 대체", "비동기", "재시도", "ExchangeFilter"]
featured: false
draft: false
---

[지난 글](/posts/spring-webflux-vs-mvc/)에서 Spring MVC와 WebFlux의 선택 기준을 살펴봤다. 이번 글에서는 WebFlux 환경에서 외부 HTTP API를 호출하는 **WebClient**를 깊이 파고든다. `RestTemplate`가 공식적으로 유지 관리 모드로 전환된 만큼, 신규 프로젝트에서는 WebClient가 표준이다.

## WebClient란

`WebClient`는 Spring WebFlux 모듈에 포함된 논블로킹·리액티브 HTTP 클라이언트다. `RestTemplate`과 달리 요청마다 스레드를 점유하지 않는다. 내부적으로 Reactor Netty(혹은 JDK HttpClient)를 사용하며, 요청·응답 파이프라인 전체가 `Mono`/`Flux` 스트림으로 표현된다.

![WebClient 요청·응답 파이프라인](/assets/posts/spring-webflux-webclient-flow.svg)

## WebClient 인스턴스 생성

WebClient는 불변(immutable) 객체다. 한 번 빌드된 인스턴스는 여러 요청에서 재사용한다. Spring Bean으로 등록해 주입받는 것이 일반적이다.

```java
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient userServiceClient() {
        return WebClient.builder()
            .baseUrl("https://user-service.internal")
            .defaultHeader(HttpHeaders.CONTENT_TYPE,
                           MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader(HttpHeaders.ACCEPT,
                           MediaType.APPLICATION_JSON_VALUE)
            .codecs(c -> c.defaultCodecs()
                          .maxInMemorySize(1024 * 1024))   // 1 MB
            .build();
    }
}
```

## GET 요청과 응답 역직렬화

`retrieve()`는 응답 상태 코드를 확인하고 바디를 역직렬화하는 가장 간단한 방법이다.

```java
@Service
public class UserService {

    private final WebClient client;

    public UserService(WebClient userServiceClient) {
        this.client = userServiceClient;
    }

    public Mono<User> findById(Long userId) {
        return client.get()
            .uri("/users/{id}", userId)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError,
                      res -> res.bodyToMono(ErrorResponse.class)
                                .flatMap(err -> Mono.error(
                                    new UserNotFoundException(err.message()))))
            .onStatus(HttpStatusCode::is5xxServerError,
                      res -> Mono.error(new UserServiceException()))
            .bodyToMono(User.class);
    }

    public Flux<User> findAll() {
        return client.get()
            .uri("/users")
            .retrieve()
            .bodyToFlux(User.class);
    }
}
```

`onStatus()`는 상태 코드별로 에러를 세분화한다. `4xx`이면 비즈니스 예외로, `5xx`이면 인프라 예외로 분리하는 것이 좋은 패턴이다.

## POST 요청과 바디 전송

```java
public Mono<User> createUser(CreateUserRequest request) {
    return client.post()
        .uri("/users")
        .bodyValue(request)                         // 객체 → JSON 직렬화
        .retrieve()
        .bodyToMono(User.class);
}

// multipart form 전송
public Mono<String> uploadFile(FilePart file) {
    MultipartBodyBuilder builder = new MultipartBodyBuilder();
    builder.asyncPart("file", file.content(), DataBuffer.class)
           .headers(h -> h.setContentDispositionFormData("file", file.filename()));

    return client.post()
        .uri("/upload")
        .body(BodyInserters.fromMultipartData(builder.build()))
        .retrieve()
        .bodyToMono(String.class);
}
```

## 타임아웃과 재시도

프로덕션 코드에는 반드시 타임아웃과 재시도 정책을 설정해야 한다. WebClient 레벨과 Reactor 레벨 두 곳에 타임아웃이 존재한다.

```java
// Reactor Netty 연결·응답 타임아웃 (WebClient 빌드 시)
HttpClient httpClient = HttpClient.create()
    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 3_000)
    .responseTimeout(Duration.ofSeconds(10));

WebClient client = WebClient.builder()
    .clientConnector(new ReactorClientHttpConnector(httpClient))
    .build();

// 응답 스트림 레벨 타임아웃 + 지수 백오프 재시도
public Mono<Order> getOrderWithRetry(Long orderId) {
    return client.get()
        .uri("/orders/{id}", orderId)
        .retrieve()
        .bodyToMono(Order.class)
        .timeout(Duration.ofSeconds(5))
        .retryWhen(Retry.backoff(3, Duration.ofMillis(200))
                        .filter(ex -> ex instanceof WebClientRequestException));
}
```

![WebClient 주요 패턴 코드](/assets/posts/spring-webflux-webclient-code.svg)

## ExchangeFilter: 공통 관심사 분리

`ExchangeFilterFunction`은 모든 요청/응답에 공통 로직을 적용하는 미들웨어다. 인증 토큰 추가, 로깅, 메트릭 수집에 활용한다.

```java
// 인증 헤더 필터
ExchangeFilterFunction authFilter = ExchangeFilterFunction.ofRequestProcessor(
    request -> Mono.just(
        ClientRequest.from(request)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.getToken())
            .build()
    )
);

// 요청/응답 로깅 필터
ExchangeFilterFunction loggingFilter = (request, next) -> {
    log.debug("→ {} {}", request.method(), request.url());
    return next.exchange(request)
               .doOnNext(res -> log.debug("← {}", res.statusCode()));
};

WebClient client = WebClient.builder()
    .filter(authFilter)
    .filter(loggingFilter)
    .build();
```

## exchangeToMono vs retrieve

`retrieve()`는 대부분의 케이스에 충분하지만, 응답 헤더에도 접근해야 할 때는 `exchangeToMono()`를 사용한다.

```java
public Mono<ResponseEntity<User>> getWithHeaders(Long id) {
    return client.get()
        .uri("/users/{id}", id)
        .exchangeToMono(response -> {
            if (response.statusCode().is2xxSuccessful()) {
                return response.toEntity(User.class);
            }
            // 에러 상황에서 본문을 직접 읽고 예외 생성
            return response.bodyToMono(String.class)
                           .flatMap(body -> Mono.error(
                               new ApiException(response.statusCode(), body)));
        });
}
```

> **주의**: `exchangeToMono()`는 응답 본문을 반드시 소비해야 한다. 소비하지 않으면 연결이 누수된다.

## 테스트: MockServer와 WebTestClient

WebClient 코드는 `MockWebServer`(OkHttp)나 Spring의 `MockServer`로 단위 테스트할 수 있다.

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    MockWebServer mockServer;
    UserService userService;

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();
        WebClient client = WebClient.builder()
            .baseUrl(mockServer.url("/").toString())
            .build();
        userService = new UserService(client);
    }

    @Test
    void findById_success() throws Exception {
        mockServer.enqueue(new MockResponse()
            .setBody("""
                {"id": 1, "name": "Alice"}
                """)
            .addHeader("Content-Type", "application/json"));

        StepVerifier.create(userService.findById(1L))
            .assertNext(u -> assertThat(u.name()).isEqualTo("Alice"))
            .verifyComplete();
    }
}
```

## RestTemplate → WebClient 마이그레이션

```java
// Before: RestTemplate (블로킹)
User user = restTemplate.getForObject("/users/{id}", User.class, userId);

// After: WebClient (논블로킹)
Mono<User> userMono = webClient.get()
    .uri("/users/{id}", userId)
    .retrieve()
    .bodyToMono(User.class);

// Spring MVC 환경에서 WebClient를 블로킹하게 사용해야 할 때
User user = webClient.get()
    .uri("/users/{id}", userId)
    .retrieve()
    .bodyToMono(User.class)
    .block();  // 이벤트 루프 스레드에서 호출 금지
```

MVC 앱에서 RestTemplate를 점진적으로 WebClient로 교체할 때는 `.block()`으로 일시적 브리지를 만들 수 있다. 단, WebFlux 앱의 이벤트 루프 스레드에서 `.block()`은 데드락을 유발하므로 절대 사용하면 안 된다.

---

**지난 글:** [Spring MVC vs WebFlux: 언제 무엇을 선택해야 하는가](/posts/spring-webflux-vs-mvc/)

**다음 글:** [R2DBC: 리액티브 관계형 DB 접근](/posts/spring-webflux-r2dbc/)

<br>
읽어주셔서 감사합니다. 😊
