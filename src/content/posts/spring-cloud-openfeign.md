---
title: "Spring Cloud OpenFeign: 선언형 HTTP 클라이언트 완전 정복"
description: "인터페이스 선언만으로 마이크로서비스 간 HTTP 통신을 구현하는 Spring Cloud OpenFeign의 설정, 커스터마이징, 회복력 통합까지 실전 코드와 함께 깊이 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["OpenFeign", "Spring Cloud", "HTTP 클라이언트", "MSA", "FeignClient", "LoadBalancer", "Resilience4j"]
featured: false
draft: false
---

[지난 글](/posts/spring-cloud-resilience4j/)에서 Resilience4j로 Circuit Breaker와 재시도를 구현해 연쇄 장애를 막는 방법을 배웠다. 이번 글에서는 MSA 환경에서 서비스 간 HTTP 통신을 가장 우아하게 처리하는 **Spring Cloud OpenFeign**을 다룬다. RestTemplate이나 WebClient를 직접 사용하는 대신, 인터페이스와 어노테이션만으로 HTTP 클라이언트를 선언적으로 정의하는 방식이다.

## OpenFeign이란

Netflix가 개발하고 오픈소스로 공개한 HTTP 클라이언트 라이브러리 Feign을 Spring Cloud가 통합한 것이 **Spring Cloud OpenFeign**이다. 핵심 아이디어는 단순하다. 개발자는 인터페이스에 어노테이션을 붙이기만 하고, 런타임에 Feign이 동적 프록시를 생성해 실제 HTTP 요청을 수행한다.

```java
// RestTemplate 방식 — 반복 코드가 많다
@Service
public class OrderServiceOld {
    private final RestTemplate restTemplate;

    public Product findProduct(Long id) {
        String url = "http://product-service/products/" + id;
        return restTemplate.getForObject(url, Product.class);
    }
}
```

```java
// OpenFeign 방식 — 인터페이스 선언만으로 완성
@FeignClient(name = "product-service")
public interface ProductClient {
    @GetMapping("/products/{id}")
    Product findById(@PathVariable Long id);
}
```

RestTemplate 방식에 비해 코드량이 대폭 줄고, URL 구성이나 응답 역직렬화 같은 반복 작업이 사라진다. Spring MVC 어노테이션을 그대로 사용하므로 학습 비용도 낮다.

![Spring Cloud OpenFeign 아키텍처](/assets/posts/spring-cloud-openfeign-architecture.svg)

## 의존성 추가와 활성화

```groovy
// build.gradle
ext {
    set('springCloudVersion', "2023.0.3")
}

dependencies {
    implementation 'org.springframework.cloud:spring-cloud-starter-openfeign'
    // 서비스 디스커버리 없이 직접 URL 지정 시엔 이것만으로 충분
}

dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:${springCloudVersion}"
    }
}
```

```java
// 메인 애플리케이션 클래스에 @EnableFeignClients 추가
@SpringBootApplication
@EnableFeignClients
public class OrderApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderApplication.class, args);
    }
}
```

`@EnableFeignClients`가 없으면 `@FeignClient` 어노테이션을 붙여도 Spring이 스캔하지 않으니 반드시 추가해야 한다.

## @FeignClient 심층 이해

`@FeignClient`의 주요 속성을 살펴본다.

```java
@FeignClient(
    name = "product-service",           // 서비스 이름 (Eureka 등록명 혹은 URL 식별자)
    url = "${product.service.url}",     // 직접 URL 지정 (서비스 디스커버리 없이)
    path = "/api/v1",                   // 공통 path prefix
    fallback = ProductClientFallback.class,  // 폴백 구현체
    configuration = FeignConfig.class   // 개별 설정 클래스
)
public interface ProductClient {

    @GetMapping("/products/{id}")
    Product findById(@PathVariable("id") Long id);

    @GetMapping("/products")
    Page<Product> findAll(
        @RequestParam int page,
        @RequestParam int size,
        @RequestParam(required = false) String category
    );

    @PostMapping("/products")
    Product create(@RequestBody ProductRequest request);

    @DeleteMapping("/products/{id}")
    void delete(@PathVariable("id") Long id);
}
```

`name` 속성과 `url` 속성을 같이 쓸 때는 `url`이 우선순위를 가진다. 개발 환경에서 `url`을 명시하고 운영 환경에서는 서비스 디스커버리에 맡기는 패턴을 자주 사용한다.

## application.yml 설정

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          default:                   # 모든 FeignClient 기본값
            connect-timeout: 2000
            read-timeout: 5000
            logger-level: BASIC      # NONE / BASIC / HEADERS / FULL
          product-service:           # 특정 클라이언트 개별 설정
            connect-timeout: 1000
            read-timeout: 3000
            logger-level: FULL
      compression:
        request:
          enabled: true
          min-request-size: 2048
        response:
          enabled: true
```

`logger-level: FULL`은 요청/응답 헤더와 바디까지 로깅하므로 디버깅 시 유용하지만, 운영 환경에서는 `BASIC` 또는 `NONE`을 권장한다.

## 로그 레벨 활성화

Feign 로그는 DEBUG 레벨로 출력된다. `application.yml`에서 `logger-level`을 설정해도 해당 인터페이스의 로그 레벨을 DEBUG로 맞춰야 실제 출력된다.

```yaml
logging:
  level:
    com.example.client.ProductClient: DEBUG
```

## RequestInterceptor — 공통 헤더 처리

인증 토큰이나 추적 ID처럼 모든 요청에 공통 헤더를 붙여야 할 때는 `RequestInterceptor`를 구현한다.

```java
@Component
public class BearerTokenInterceptor implements RequestInterceptor {

    private final TokenProvider tokenProvider;

    @Override
    public void apply(RequestTemplate template) {
        String token = tokenProvider.getCurrentToken();
        if (token != null) {
            template.header("Authorization", "Bearer " + token);
        }
        // 분산 추적 헤더 전파
        String traceId = MDC.get("traceId");
        if (traceId != null) {
            template.header("X-Trace-Id", traceId);
        }
    }
}
```

`@Component`로 등록하면 전체 FeignClient에 적용된다. 특정 클라이언트에만 적용하려면 `@FeignClient(configuration = SpecificFeignConfig.class)`로 분리한다.

## ErrorDecoder — 에러 응답 처리

HTTP 4xx/5xx 응답을 비즈니스 예외로 변환하려면 `ErrorDecoder`를 구현한다.

```java
@Component
public class ProductServiceErrorDecoder implements ErrorDecoder {

    private final ErrorDecoder defaultDecoder = new Default();

    @Override
    public Exception decode(String methodKey, Response response) {
        return switch (response.status()) {
            case 404 -> new ProductNotFoundException(
                "Product not found for: " + methodKey
            );
            case 400 -> new InvalidRequestException(
                "Bad request to: " + methodKey
            );
            case 503 -> new ServiceUnavailableException(
                "Product service unavailable"
            );
            default -> defaultDecoder.decode(methodKey, response);
        };
    }
}
```

`ErrorDecoder`가 없으면 기본적으로 `FeignException`이 던져지는데, 이를 잡아서 처리하는 코드가 각 서비스마다 중복된다. `ErrorDecoder`로 한 곳에서 변환하면 서비스 코드가 깔끔해진다.

![OpenFeign 핵심 코드 패턴](/assets/posts/spring-cloud-openfeign-code.svg)

## Resilience4j Circuit Breaker 통합

[지난 글](/posts/spring-cloud-resilience4j/)에서 배운 Resilience4j를 OpenFeign과 통합한다.

```groovy
dependencies {
    implementation 'org.springframework.cloud:spring-cloud-starter-openfeign'
    implementation 'org.springframework.cloud:spring-cloud-starter-circuitbreaker-resilience4j'
}
```

```yaml
spring:
  cloud:
    openfeign:
      circuitbreaker:
        enabled: true
```

```java
// 폴백 클래스 구현
@Component
public class ProductClientFallback implements ProductClient {

    @Override
    public Product findById(Long id) {
        return Product.empty(id);   // 기본값 반환
    }

    @Override
    public Page<Product> findAll(int page, int size, String category) {
        return Page.empty();
    }
}
```

```java
@FeignClient(
    name = "product-service",
    fallback = ProductClientFallback.class
)
public interface ProductClient {
    // ...
}
```

폴백이 등록되면 Circuit Breaker가 열렸을 때나 타임아웃이 발생했을 때 자동으로 폴백 메서드가 호출된다.

## Spring Cloud LoadBalancer 통합

Eureka 같은 서비스 디스커버리가 있을 때 OpenFeign은 `spring-cloud-starter-loadbalancer`와 자동 통합된다.

```groovy
dependencies {
    implementation 'org.springframework.cloud:spring-cloud-starter-openfeign'
    implementation 'org.springframework.cloud:spring-cloud-starter-netflix-eureka-client'
    // spring-cloud-starter-loadbalancer 는 위 두 의존성이 포함
}
```

```yaml
# Eureka 서버 주소
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/

# 로드밸런서 전략 (기본: RoundRobin)
spring:
  cloud:
    loadbalancer:
      ribbon:
        enabled: false  # Ribbon 제거 후 Spring Cloud LB 사용
```

`@FeignClient(name = "product-service")`에서 `name`이 Eureka에 등록된 서비스 이름과 일치하면, 자동으로 인스턴스 목록을 가져와 라운드로빈으로 분산한다.

## 실전 패턴 — FeignClient 분리와 테스트

```java
// 테스트에서 FeignClient를 목킹하는 방법
@SpringBootTest
@AutoConfigureMockMvc
class OrderServiceTest {

    @MockBean
    private ProductClient productClient;

    @Test
    void createOrder_ShouldReturnOrder() {
        // given
        Product mockProduct = new Product(1L, "노트북", 1_500_000);
        given(productClient.findById(1L)).willReturn(mockProduct);

        // when & then
        // ...
    }
}
```

`@MockBean`으로 `ProductClient`를 모킹하면 실제 HTTP 요청 없이 단위 테스트를 작성할 수 있다. WireMock을 이용하면 통합 테스트에서 실제 HTTP 응답을 시뮬레이션할 수 있다.

## 자주 발생하는 문제와 해결

**문제 1: `@PathVariable`에 이름 명시 누락**

```java
// 틀린 예 — Spring MVC에서는 생략 가능하지만 Feign에서는 안 됨
@GetMapping("/products/{id}")
Product findById(@PathVariable Long id);  // 컴파일은 되지만 런타임 오류 가능

// 올바른 예
@GetMapping("/products/{id}")
Product findById(@PathVariable("id") Long id);
```

**문제 2: `Page<T>` 응답 역직렬화 실패**

```java
// Page<Product>는 Jackson이 바로 역직렬화 못 함
// 커스텀 PageImpl 래퍼 or SpringDataWebAutoConfiguration 설정 필요
@GetMapping("/products")
RestPage<Product> findAll(@SpringQueryMap Pageable pageable);
```

**문제 3: FeignClient 빈 중복 등록**

같은 `name`으로 여러 `@FeignClient`를 선언하면 빈 이름 충돌이 난다. `contextId` 속성으로 구분한다.

```java
@FeignClient(name = "product-service", contextId = "productReadClient", path = "/api/read")
public interface ProductReadClient { ... }

@FeignClient(name = "product-service", contextId = "productWriteClient", path = "/api/write")
public interface ProductWriteClient { ... }
```

## OpenFeign vs WebClient

| 항목 | OpenFeign | WebClient |
|---|---|---|
| 프로그래밍 모델 | 선언형 (인터페이스) | 명령형/리액티브 |
| 코드 간결성 | 매우 높음 | 중간 |
| 리액티브 지원 | feign-reactor 필요 | 기본 지원 |
| MSA 통합 | Spring Cloud 최적화 | 수동 설정 필요 |
| 테스트 용이성 | @MockBean 간편 | 상대적으로 복잡 |
| 추천 시나리오 | Spring MVC 기반 MSA | WebFlux 기반 또는 스트리밍 |

Spring MVC 기반 서비스에서 다른 마이크로서비스를 호출할 때는 OpenFeign이, WebFlux 기반이거나 리액티브 스트리밍이 필요할 때는 WebClient가 더 적합하다.

---

**지난 글:** [Spring Cloud Resilience4j: 장애 격리와 Circuit Breaker](/posts/spring-cloud-resilience4j/)

**다음 글:** [분산 트랜잭션과 Saga 패턴](/posts/spring-cloud-saga-pattern/)

<br>
읽어주셔서 감사합니다. 😊
