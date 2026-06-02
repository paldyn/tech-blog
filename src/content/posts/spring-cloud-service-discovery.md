---
title: "Spring Cloud 서비스 디스커버리: Eureka 완전 정복"
description: "MSA에서 서비스 디스커버리가 왜 필요한지부터 Eureka Server·Client 구성, FeignClient 통합, Spring Cloud LoadBalancer 활용까지 실전 예제로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring Cloud", "Eureka", "Service Discovery", "FeignClient", "LoadBalancer", "MSA"]
featured: false
draft: false
---

[지난 글](/posts/spring-cloud-monolith-vs-msa/)에서 모놀리스와 MSA의 차이, 그리고 Spring Cloud 생태계의 전체 그림을 살펴봤다. 이번 글에서는 MSA의 핵심 인프라인 **서비스 디스커버리**를 Spring Cloud Netflix Eureka로 구현하는 방법을 다룬다.

## 왜 서비스 디스커버리가 필요한가

모놀리스에서는 모든 컴포넌트가 하나의 프로세스 안에 있어서 메서드 호출로 통신한다. MSA로 전환하면 서비스 간 통신이 네트워크 HTTP 호출이 된다. 그런데 분산 환경에서는 서비스 인스턴스의 IP와 포트가 계속 바뀐다. 컨테이너가 재시작되면 IP가 바뀌고, 오토스케일링으로 인스턴스가 늘고 줄어든다.

이 문제를 **하드코딩**으로 해결하려 하면 금세 한계에 부닥친다.

```yaml
# 이렇게 하면 안 된다
order-service:
  user-service-url: http://192.168.1.101:8082  # 재배포하면 IP가 바뀜
  product-service-url: http://192.168.1.102:8083
```

서비스 디스커버리는 이 문제를 해결한다. 각 서비스는 기동 시 중앙 레지스트리에 자신의 위치를 등록하고, 다른 서비스를 호출할 때는 레지스트리에서 주소를 조회한다. IP 대신 서비스 이름(`order-service`, `user-service`)만 사용하면 된다.

![Spring Cloud 서비스 디스커버리 아키텍처](/assets/posts/spring-cloud-service-discovery-architecture.svg)

## 디스커버리 방식: 클라이언트 사이드 vs 서버 사이드

서비스 디스커버리에는 두 가지 방식이 있다.

**클라이언트 사이드 디스커버리(Client-Side Discovery)**: 서비스 소비자가 직접 레지스트리에서 주소를 조회하고 로드밸런싱까지 수행한다. Spring Cloud Netflix Eureka + Spring Cloud LoadBalancer가 이 방식이다. 소비자 측에 로직이 생기지만 인프라 의존도가 낮다.

**서버 사이드 디스커버리(Server-Side Discovery)**: AWS ALB, Kubernetes Service처럼 로드밸런서가 레지스트리와 통합되어 라우팅을 처리한다. 소비자는 로드밸런서 주소만 알면 된다.

Spring 생태계에서는 클라이언트 사이드가 기본이다. Kubernetes 환경이라면 서버 사이드(k8s Service)를 활용하는 것이 자연스럽다.

## Eureka Server 구성

Eureka Server는 서비스 레지스트리 역할을 한다. 독립 Spring Boot 애플리케이션으로 배포한다.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
</dependency>
```

```java
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
```

```yaml
# application.yml
server:
  port: 8761

spring:
  application:
    name: eureka-server

eureka:
  client:
    register-with-eureka: false   # 서버 자신은 등록 불필요
    fetch-registry: false         # 자신의 레지스트리를 가져올 필요 없음
  server:
    enable-self-preservation: true    # 네트워크 파티션 대비
    eviction-interval-timer-in-ms: 5000
```

`http://localhost:8761`로 접속하면 Eureka Dashboard에서 등록된 서비스 목록을 확인할 수 있다.

![Eureka 서버 및 클라이언트 설정 코드](/assets/posts/spring-cloud-service-discovery-eureka.svg)

## Eureka Client 등록

마이크로서비스 각각에 eureka-client 의존성을 추가한다.

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

Spring Boot 3.x / Spring Cloud 2022.x 이상에서는 `@EnableDiscoveryClient` 어노테이션 없이 의존성만 추가해도 자동 등록된다.

```yaml
# order-service/application.yml
server:
  port: 8081

spring:
  application:
    name: order-service     # Eureka 등록 이름 — 이 이름으로 호출한다

eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka
  instance:
    prefer-ip-address: true
    lease-renewal-interval-in-seconds: 10    # 하트비트 주기 (기본 30)
    lease-expiration-duration-in-seconds: 30 # TTL (기본 90)
```

애플리케이션이 기동하면 `order-service`라는 이름으로 Eureka에 자동 등록된다. `prefer-ip-address: true`로 호스트명 대신 IP를 등록하면 컨테이너 환경에서 DNS 해석 문제를 피할 수 있다.

## FeignClient로 서비스 호출

Eureka에 등록된 서비스를 호출하는 가장 간결한 방법이 **OpenFeign**이다.

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
```

```java
@SpringBootApplication
@EnableFeignClients
public class OrderServiceApplication { ... }
```

```java
// 인터페이스만 선언하면 Spring이 구현체를 자동 생성
@FeignClient(name = "user-service")
public interface UserServiceClient {

    @GetMapping("/api/users/{id}")
    UserDto findById(@PathVariable("id") Long userId);

    @GetMapping("/api/users")
    List<UserDto> findAll();
}
```

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final UserServiceClient userClient;

    public OrderDto createOrder(Long userId, CreateOrderRequest req) {
        UserDto user = userClient.findById(userId);   // Eureka → user-service 자동 조회
        // 주문 생성 로직
        return orderRepository.save(buildOrder(user, req));
    }
}
```

`@FeignClient(name = "user-service")`의 `name`이 Eureka에 등록된 `spring.application.name`과 일치하면 된다. 실제 IP와 포트는 Spring Cloud LoadBalancer가 Eureka에서 조회해 자동으로 채운다.

## Spring Cloud LoadBalancer

과거에는 Netflix Ribbon이 클라이언트 사이드 로드밸런싱을 담당했지만, Ribbon은 2020년 이후 유지 관리가 중단되었다. Spring Cloud 2020.0 이후에는 **Spring Cloud LoadBalancer**가 기본이다.

```xml
<!-- ribbon 대신 loadbalancer 사용 -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

`RestTemplate`을 통해 로드밸런싱을 사용할 때는 `@LoadBalanced` 빈을 등록한다.

```java
@Configuration
public class RestTemplateConfig {

    @Bean
    @LoadBalanced   // 서비스명을 Eureka에서 조회하도록 인터셉터 추가
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}

@Service
@RequiredArgsConstructor
public class ProductService {

    private final RestTemplate restTemplate;

    public ProductDto getProduct(Long id) {
        // http://product-service 를 Eureka에서 실제 주소로 변환
        return restTemplate.getForObject(
            "http://product-service/api/products/" + id,
            ProductDto.class
        );
    }
}
```

WebClient를 사용하는 경우에도 동일하게 적용된다.

```java
@Bean
@LoadBalanced
public WebClient.Builder webClientBuilder() {
    return WebClient.builder();
}
```

기본 로드밸런싱 전략은 **라운드 로빈**이다. 랜덤 전략으로 변경하려면 아래와 같이 커스터마이징한다.

```java
@Configuration
@LoadBalancerClient(name = "order-service",
                    configuration = OrderServiceLBConfig.class)
public class LoadBalancerConfig {}

public class OrderServiceLBConfig {

    @Bean
    public ReactorLoadBalancer<ServiceInstance> randomLoadBalancer(
            Environment env,
            LoadBalancerClientFactory factory) {
        String name = env.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
        return new RandomLoadBalancer(
            factory.getLazyProvider(name, ServiceInstanceListSupplier.class), name);
    }
}
```

## 헬스체크와 Self-Preservation Mode

Eureka는 클라이언트로부터 **하트비트**(기본 30초 간격)를 받아 서비스 생사를 판단한다. TTL(기본 90초) 안에 하트비트가 오지 않으면 레지스트리에서 해당 인스턴스를 제거한다.

Spring Boot Actuator가 있으면 Eureka가 `/actuator/health` 엔드포인트를 이용해 좀 더 상세한 헬스체크를 수행한다.

```yaml
# 헬스체크 통합 활성화
eureka:
  client:
    healthcheck:
      enabled: true

management:
  endpoints:
    web:
      exposure:
        include: health, info
```

**Self-Preservation Mode**는 Eureka Server의 방어 기제다. 짧은 시간에 많은 인스턴스가 하트비트를 보내지 않으면, Eureka는 네트워크 파티션이 발생했다고 판단하고 레지스트리를 함부로 비우지 않는다. 이 덕분에 일시적인 네트워크 장애에도 기존에 등록된 서비스 정보가 유지된다.

개발 환경에서는 종종 혼란을 유발하므로 비활성화하기도 한다.

```yaml
eureka:
  server:
    enable-self-preservation: false  # 개발 환경에서만
```

## 멀티 인스턴스와 Zone 설정

같은 서비스를 여러 인스턴스로 기동하면 Eureka가 자동으로 목록을 관리한다. 서로 다른 포트로 여러 인스턴스를 띄우면 LoadBalancer가 라운드 로빈으로 호출을 분배한다.

```bash
# 포트를 달리해 2개 인스턴스 기동
java -jar order-service.jar --server.port=8081
java -jar order-service.jar --server.port=8084
```

AWS나 Kubernetes 멀티 존 환경에서는 Zone-Affinity 설정으로 같은 존 안에서 먼저 라우팅하도록 최적화할 수 있다.

```yaml
eureka:
  instance:
    metadata-map:
      zone: zone-a
  client:
    prefer-same-zone-eureka: true
```

## 실무 체크리스트

- **단일 장애 점(SPOF) 방지**: 운영 환경에서는 Eureka 서버를 2~3대로 클러스터링한다. `eureka.client.serviceUrl.defaultZone`에 복수 URL을 쉼표로 나열한다.
- **타임아웃 설정**: FeignClient에 커넥션 타임아웃과 읽기 타임아웃을 명시한다.
- **Circuit Breaker 결합**: Resilience4j와 함께 사용해 서비스 장애가 전파되지 않도록 한다.
- **Kubernetes 환경**: k8s에서는 Eureka 대신 k8s Service를 디스커버리로 쓰고, `spring-cloud-kubernetes-discovery`로 통합하는 것이 더 자연스럽다.

```yaml
# Eureka 클러스터 설정 예시 (2대)
eureka:
  client:
    service-url:
      defaultZone: http://eureka1:8761/eureka,http://eureka2:8761/eureka
```

서비스 디스커버리는 MSA의 기반 인프라다. Eureka를 제대로 구성해두면 이후 Gateway, Resilience4j, Config Server를 쌓을 때 일관된 서비스 이름 기반의 통신 체계를 갖출 수 있다.

---

**지난 글:** [Spring Cloud: 모놀리스에서 마이크로서비스로](/posts/spring-cloud-monolith-vs-msa/)

**다음 글:** [Spring Cloud Gateway: API 진입점 완전 정복](/posts/spring-cloud-gateway/)

<br>
읽어주셔서 감사합니다. 😊
