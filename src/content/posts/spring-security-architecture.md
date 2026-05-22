---
title: "Spring Security 아키텍처 — 필터 체인의 구조와 동작"
description: "Spring Security가 HTTP 요청을 처리하는 내부 구조를 다룹니다. DelegatingFilterProxy에서 FilterChainProxy, SecurityFilterChain까지의 위임 흐름과 각 레이어의 역할, SecurityFilterChain을 코드로 구성하는 방법, 그리고 기본으로 등록되는 주요 필터들을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "FilterChain", "SecurityFilterChain", "DelegatingFilterProxy", "FilterChainProxy", "보안필터", "인증아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/spring-response-envelope/)에서 API 응답을 일관된 봉투 구조로 감싸는 패턴을 살펴봤습니다. 이제 응답을 보내기 전에 *누가 이 요청을 보냈는지*, *그 사람에게 이 요청을 허용해야 하는지*를 결정하는 Spring Security로 넘어갑니다. Spring Security는 서블릿 필터를 기반으로 동작하며, 그 핵심은 **필터 체인(Filter Chain)** 입니다.

## 전체 흐름: 서블릿 컨테이너부터 컨트롤러까지

HTTP 요청이 서버에 도착하면 Tomcat(또는 다른 서블릿 컨테이너)이 가장 먼저 받습니다. Spring Security는 이 단계에서 `Filter` 인터페이스를 활용해 요청을 가로챕니다.

![Spring Security 필터 체인 아키텍처](/assets/posts/spring-security-architecture-overview.svg)

요청은 크게 **세 레이어**를 순서대로 통과합니다.

1. **DelegatingFilterProxy** — 서블릿 컨테이너의 일반 필터로 등록되지만 내부적으로 Spring ApplicationContext에 있는 `FilterChainProxy` 빈에 처리를 위임합니다. 이 구조 덕분에 Spring Security는 서블릿 컨테이너와 완전히 독립된 스프링 빈으로 동작할 수 있습니다.

2. **FilterChainProxy** — 스프링 빈으로 등록된 중앙 디스패처입니다. 요청 URL 패턴을 보고 여러 `SecurityFilterChain` 중 매칭되는 체인을 선택해 처리를 위임합니다.

3. **SecurityFilterChain** — 실제 보안 로직이 담긴 필터들의 목록입니다. 각 필터는 정해진 순서대로 실행됩니다.

## 주요 필터 목록

Spring Security가 기본으로 등록하는 필터들은 `spring-security-config` 모듈의 `FilterOrderRegistration`에 정의돼 있습니다. 전체 목록은 20여 개에 달하지만, 대표적인 4개는 다음과 같습니다.

| 필터 | 역할 |
|---|---|
| `SecurityContextHolderFilter` | 요청 시작에 `SecurityContext`를 복원하고, 응답 후 저장 |
| `UsernamePasswordAuthenticationFilter` | `/login` POST 요청을 가로채 폼 기반 인증 처리 |
| `ExceptionTranslationFilter` | 인증·인가 예외를 HTTP 응답(401/403)으로 변환 |
| `AuthorizationFilter` | `SecurityFilterChain`의 URL 접근 규칙을 기반으로 최종 인가 결정 |

필터 순서가 중요합니다. `SecurityContextHolderFilter`가 먼저 실행돼야 뒤따르는 필터들이 현재 인증된 사용자 정보를 사용할 수 있습니다.

## SecurityFilterChain 구성 코드

Spring Boot 3.x 기준으로 `SecurityFilterChain` 빈을 등록하는 방법입니다.

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/public/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard")
                .permitAll()
            )
            .logout(logout -> logout
                .logoutSuccessUrl("/")
                .permitAll()
            );
        return http.build();
    }
}
```

`HttpSecurity`는 DSL 빌더입니다. 각 메서드가 해당 기능을 담당하는 필터를 체인에 추가합니다. `formLogin()`을 호출하면 `UsernamePasswordAuthenticationFilter`가 등록됩니다.

![SecurityFilterChain 설정 구조](/assets/posts/spring-security-architecture-config.svg)

## 여러 SecurityFilterChain 사용

하나의 애플리케이션에서 `/api/**`는 JWT 기반 인증을, `/admin/**`은 폼 로그인을 쓰는 것처럼 **경로별로 다른 보안 설정**이 필요할 때 여러 `SecurityFilterChain` 빈을 등록합니다.

```java
@Bean
@Order(1)
public SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
    http
        .securityMatcher("/api/**")          // 이 체인은 /api/** 에만 적용
        .authorizeHttpRequests(auth -> auth
            .anyRequest().authenticated()
        )
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        )
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
}

@Bean
@Order(2)
public SecurityFilterChain webFilterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .anyRequest().authenticated()
        )
        .formLogin(Customizer.withDefaults());
    return http.build();
}
```

`@Order`로 우선순위를 지정합니다. `FilterChainProxy`는 숫자가 낮은 체인부터 URL 패턴을 매칭합니다. `securityMatcher`가 없는 체인은 모든 요청에 매칭되므로 가장 높은 순서 번호(낮은 우선순위)에 두어야 합니다.

## 디버깅: 어떤 필터가 실행되는지 확인

필터 체인 실행 순서를 확인하려면 `application.properties`에 로그 레벨을 설정합니다.

```properties
logging.level.org.springframework.security=TRACE
```

`TRACE` 레벨로 설정하면 각 필터의 진입·탈출 로그가 출력됩니다. 개발 단계에서 보안 설정이 의도대로 동작하는지 확인할 때 유용합니다. 운영 환경에서는 반드시 `INFO` 이상으로 되돌려야 합니다.

## SecurityContext와 ThreadLocal

Spring Security는 현재 요청의 인증 정보를 `SecurityContextHolder`에 보관합니다. 기본 전략은 `ThreadLocal`입니다.

```java
// 현재 인증된 사용자 가져오기
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
String username = auth.getName();

// 또는 컨트롤러 파라미터로 주입
@GetMapping("/me")
public UserDto getMe(@AuthenticationPrincipal UserDetails user) {
    return userService.findByUsername(user.getUsername());
}
```

`ThreadLocal` 방식은 같은 스레드에서만 인증 정보에 접근할 수 있습니다. Spring WebFlux 같은 리액티브 환경에서는 `SecurityContextHolder`의 전략을 `MODE_INHERITABLETHREADLOCAL`로 변경하거나, `ReactiveSecurityContextHolder`를 사용해야 합니다.

---

**지난 글:** [API 응답 봉투 패턴 — 일관된 응답 구조 설계](/posts/spring-response-envelope/)

**다음 글:** [Spring Security 인증과 인가의 차이](/posts/spring-security-authentication-vs-authorization/)

<br>
읽어주셔서 감사합니다. 😊
