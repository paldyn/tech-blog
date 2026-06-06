---
title: "Spring 4 · 5 · 6 핵심 변경사항 총정리"
description: "Spring 4의 @RestController와 WebSocket부터, Spring 5의 WebFlux 리액티브 스택, Spring 6의 Jakarta EE 전환과 GraalVM 네이티브 빌드까지 버전별 핵심 변경사항을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring4", "Spring5", "Spring6", "WebFlux", "Jakarta EE", "GraalVM", "Virtual Threads", "버전업"]
featured: false
draft: false
---

[지난 글](/posts/spring-legacy-xml-to-javaconfig/)에서 XML 설정을 Java Config로 전환하는 방법을 다뤘다. 이번 글에서는 Spring 프레임워크의 메이저 버전별 핵심 변경사항을 정리한다. 업그레이드 결정, 팀 교육, 마이그레이션 계획 수립 모두에 활용할 수 있다.

## 버전 로드맵 한눈에 보기

![Spring 4 · 5 · 6 버전 타임라인](/assets/posts/spring-version-4-5-6-timeline.svg)

Spring 프레임워크는 각 메이저 버전마다 Java 생태계의 진화를 반영했다. Spring 4는 Java 8 람다를 흡수했고, Spring 5는 리액티브 프로그래밍 패러다임을 도입했으며, Spring 6는 Jakarta EE와 클라우드 네이티브를 핵심 지향점으로 삼았다.

## Spring 4 (2013): 현대 Spring의 기초

Spring 4는 Java 8이 출시되기 전에 등장했지만 Java 8과의 호환성을 염두에 두고 설계됐다. 가장 큰 변화는 RESTful API 지원 강화와 WebSocket 도입이었다.

**@RestController 도입**

Spring 3까지는 REST API 컨트롤러에 `@Controller`와 `@ResponseBody`를 함께 붙여야 했다. Spring 4는 이 둘을 합친 `@RestController`를 제공한다.

```java
// Spring 3 방식
@Controller
public class UserController {
    @RequestMapping("/users/{id}")
    @ResponseBody
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}

// Spring 4+ 방식
@RestController
@RequestMapping("/users")
public class UserController {
    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

**@Conditional과 Spring Boot 탄생**

`@Conditional`은 특정 조건이 충족될 때만 빈을 등록하는 어노테이션이다. Spring Boot의 자동 설정(`@ConditionalOnClass`, `@ConditionalOnMissingBean` 등)이 모두 이 메커니즘을 기반으로 동작한다. Spring 4가 없었다면 Spring Boot도 없었다.

**WebSocket 지원**

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }
}
```

이 밖에 Java 8 람다 표현식과 메서드 참조를 Spring 콜백 인터페이스에 활용할 수 있게 됐고, `@CrossOrigin`으로 메서드 수준 CORS 설정이 가능해졌다.

## Spring 5 (2017): 리액티브 혁명

Spring 5의 가장 큰 변화는 **WebFlux**다. 기존 서블릿 기반의 Spring MVC와 별도로, Non-blocking I/O를 기반으로 하는 완전한 리액티브 스택을 제공한다.

**WebFlux와 Reactor**

```java
// Spring MVC (블로킹)
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) {
    return userService.findById(id);  // 블로킹 호출
}

// Spring WebFlux (논블로킹)
@GetMapping("/users/{id}")
public Mono<User> getUser(@PathVariable Long id) {
    return userService.findById(id);  // 논블로킹 반환
}

// 리스트 반환
@GetMapping("/users")
public Flux<User> getAllUsers() {
    return userService.findAll();  // 스트리밍 가능
}
```

`Mono<T>`는 0-1개의 값을 비동기로 반환하고, `Flux<T>`는 0-N개의 값을 스트리밍 방식으로 반환한다.

**Kotlin 퍼스트 클래스 지원**

Spring 5는 Kotlin 확장 함수와 코루틴을 공식 지원하기 시작했다.

```kotlin
// Kotlin DSL로 라우팅 정의
@Configuration
class RouterConfig {
    @Bean
    fun router(userHandler: UserHandler) = coRouter {
        GET("/users/{id}", userHandler::getUser)
        POST("/users", userHandler::createUser)
    }
}
```

**Functional Bean 등록**

`@Configuration` 클래스 없이 람다로 빈을 등록하는 방식도 추가됐다. 이 방식은 리플렉션을 사용하지 않아 GraalVM 네이티브 빌드에서 유리하다.

```java
GenericApplicationContext ctx = new GenericApplicationContext();
ctx.registerBean(UserService.class, () -> new UserServiceImpl());
ctx.refresh();
```

## Spring 6 (2022): 클라우드 네이티브와 현대 Java

![Spring 6 핵심 신기능](/assets/posts/spring-version-4-5-6-features.svg)

Spring 6는 Java 17을 최소 버전으로 요구하고, Jakarta EE 9+로 완전히 전환한다는 두 가지 파격적인 결정을 내렸다.

**Jakarta EE 전환 (javax → jakarta)**

Oracle이 Java EE 상표권을 Eclipse Foundation에 양도하면서 패키지 이름이 변경됐다.

```java
// Spring 5 (javax.*)
import javax.servlet.http.HttpServletRequest;
import javax.persistence.Entity;
import javax.validation.Valid;

// Spring 6 (jakarta.*)
import jakarta.servlet.http.HttpServletRequest;
import jakarta.persistence.Entity;
import jakarta.validation.Valid;
```

단순 import 변경이지만 코드베이스 전체에 걸쳐 있어 대규모 프로젝트에서는 수백 곳을 수정해야 할 수 있다. OpenRewrite를 사용하면 자동화할 수 있다.

**HTTP Interface Client**

Spring 6에서 가장 환영받는 신기능 중 하나다. `@HttpExchange` 어노테이션으로 인터페이스를 선언하면 Spring이 구현체를 자동 생성한다. Feign과 유사하지만 Spring 생태계에 완전히 통합된다.

```java
@HttpExchange("https://api.github.com")
public interface GitHubApi {

    @GetExchange("/users/{username}")
    GitHubUser getUser(@PathVariable String username);

    @GetExchange("/users/{username}/repos")
    List<Repo> getRepos(@PathVariable String username,
                        @RequestParam int perPage);
}

// Bean 등록
@Bean
public GitHubApi gitHubApi(WebClient.Builder builder) {
    WebClient client = builder.baseUrl("https://api.github.com").build();
    HttpServiceProxyFactory factory = HttpServiceProxyFactory
        .builderFor(WebClientAdapter.create(client)).build();
    return factory.createClient(GitHubApi.class);
}
```

**GraalVM 네이티브 이미지**

Spring Boot 3과 함께 Spring 6는 GraalVM 네이티브 빌드를 공식 지원한다. 별도 힌트 파일 없이도 Spring AOT 처리기가 리플렉션, 프록시, 직렬화 힌트를 자동으로 생성한다.

```bash
# Maven으로 네이티브 빌드
./mvnw -Pnative native:compile

# 실행 (시작 시간 수십ms)
./target/myapp
```

**Virtual Threads (Project Loom)**

JDK 21의 Virtual Threads를 한 줄 설정으로 활성화할 수 있다.

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

기존 Spring MVC 코드를 전혀 수정하지 않고도 수만 개의 동시 요청을 처리할 수 있게 된다.

**RFC 7807 Problem Details**

표준 오류 응답 형식을 내장 지원한다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ProblemDetail handleNotFound(EntityNotFoundException ex) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        detail.setTitle("Resource Not Found");
        detail.setDetail(ex.getMessage());
        return detail;
    }
}
```

## 버전 선택 가이드

| 상황 | 권장 버전 |
|---|---|
| 신규 프로젝트 | Spring Boot 3.x (Spring 6) |
| Java 8 환경 유지 | Spring Boot 2.7.x (Spring 5, LTS 종료 주의) |
| 레거시 전환 준비 중 | Spring Boot 2.7 → 3.0 단계적 업그레이드 |
| GraalVM/Serverless | Spring Boot 3.x 필수 |

Spring 5.x는 2024년 EOL을 맞았다. 현재 운영 중인 Spring Boot 2.x 프로젝트는 가능한 빨리 Boot 3 마이그레이션을 준비하는 것이 좋다.

---

**지난 글:** [XML 설정에서 Java Config로: Spring 레거시 현대화 완전 가이드](/posts/spring-legacy-xml-to-javaconfig/)

**다음 글:** [Spring Boot 2 → 3 마이그레이션 실전 가이드](/posts/springboot-2-to-3-migration/)

<br>
읽어주셔서 감사합니다. 😊
