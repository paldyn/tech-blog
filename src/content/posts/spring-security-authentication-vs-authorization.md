---
title: "Spring Security 인증과 인가 — Authentication vs Authorization"
description: "Spring Security에서 인증(Authentication)과 인가(Authorization)의 개념적 차이와 내부 구현을 다룹니다. AuthenticationManager·AuthenticationProvider 체계, AuthorizationManager, URL 기반 접근 규칙 설정, 메서드 레벨 보안(@PreAuthorize), 그리고 HTTP 상태코드 401과 403의 의미 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "Authentication", "Authorization", "인증", "인가", "AuthenticationManager", "PreAuthorize"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-architecture/)에서 Spring Security의 필터 체인 구조를 살펴봤습니다. FilterChainProxy 안에서 여러 필터가 순서대로 실행된다는 것을 이해했다면, 이제 그 필터들이 처리하는 두 가지 핵심 개념을 구분해야 합니다. **인증**과 **인가**는 흔히 혼용되지만, 다루는 질문이 근본적으로 다릅니다.

## 핵심 질문의 차이

**인증(Authentication)**은 "당신이 누구입니까?"를 묻습니다. 사용자가 제출한 자격증명(아이디·비밀번호, 토큰 등)을 검증해 **신원을 확인**하는 과정입니다. 인증에 실패하면 HTTP **401 Unauthorized**를 반환합니다.

**인가(Authorization)**는 "당신이 이것을 할 수 있습니까?"를 묻습니다. 이미 인증된 사용자가 특정 리소스나 기능에 **접근할 권한이 있는지 결정**합니다. 인가에 실패하면 HTTP **403 Forbidden**을 반환합니다.

401과 403을 구분하는 것은 API 소비자에게 중요한 신호입니다. 401은 "다시 로그인하세요"이고, 403은 "로그인은 됐지만 권한이 없습니다"입니다.

![인증 vs 인가 개념 흐름](/assets/posts/spring-security-authentication-vs-authorization-concept.svg)

## Spring Security의 인증 처리 계층

Spring Security에서 인증은 `AuthenticationManager` 인터페이스 하나로 추상화됩니다.

```java
public interface AuthenticationManager {
    Authentication authenticate(Authentication authentication)
        throws AuthenticationException;
}
```

기본 구현체 `ProviderManager`는 여러 `AuthenticationProvider`에 인증을 위임합니다. 각 Provider는 특정 인증 방식을 담당합니다.

```java
@Bean
public AuthenticationManager authManager(
        UserDetailsService userDetailsService,
        PasswordEncoder passwordEncoder) {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder);
    return new ProviderManager(provider);
}
```

`DaoAuthenticationProvider`는 `UserDetailsService`로 사용자를 조회하고 `PasswordEncoder`로 비밀번호를 검증합니다. JWT 인증이나 OAuth2를 사용할 때는 별도의 Provider를 구현해 등록합니다.

### Authentication 객체

인증에 성공하면 `Authentication` 객체가 생성됩니다.

```java
Authentication auth = SecurityContextHolder.getContext().getAuthentication();

Object principal  = auth.getPrincipal();     // UserDetails 또는 String
Object credentials = auth.getCredentials();  // 비밀번호 (인증 후 보통 null)
Collection<? extends GrantedAuthority> authorities = auth.getAuthorities();
boolean isAuthenticated = auth.isAuthenticated();
```

`authorities`는 `ROLE_USER`, `ROLE_ADMIN` 같은 권한 목록입니다. `hasRole("ADMIN")`은 내부적으로 `ROLE_ADMIN`을 검사합니다.

## Spring Security의 인가 처리 계층

인가는 Spring Security 5.6부터 `AuthorizationManager` 인터페이스가 담당합니다.

```java
public interface AuthorizationManager<T> {
    AuthorizationDecision check(Supplier<Authentication> authentication, T object);
}
```

URL 기반 인가는 `HttpSecurity.authorizeHttpRequests()` DSL로 설정합니다.

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.GET, "/api/posts/**").permitAll()
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .requestMatchers("/api/users/{id}/**")
        .access(new WebExpressionAuthorizationManager(
            "#id == authentication.principal.id"))
    .anyRequest().authenticated()
);
```

규칙은 **선언 순서대로** 매칭됩니다. 더 구체적인 규칙을 위에, 광범위한 규칙(`anyRequest()`)을 마지막에 두어야 합니다.

## 메서드 레벨 보안

URL 규칙 외에도 서비스 메서드에 직접 인가 로직을 붙일 수 있습니다. `@EnableMethodSecurity`를 활성화하면 됩니다.

```java
@Configuration
@EnableMethodSecurity   // @EnableGlobalMethodSecurity 대체 (Boot 3.x)
public class MethodSecurityConfig {}
```

```java
@Service
public class PostService {

    @PreAuthorize("hasRole('ADMIN') or #authorId == authentication.principal.id")
    public void deletePost(Long postId, Long authorId) {
        // ADMIN이거나 본인 게시글만 삭제 가능
        postRepository.deleteById(postId);
    }

    @PostAuthorize("returnObject.authorId == authentication.principal.id")
    public Post getPost(Long postId) {
        // 반환된 게시글의 작성자만 조회 가능 (SpEL)
        return postRepository.findById(postId).orElseThrow();
    }

    @PreAuthorize("hasAuthority('POST_WRITE')")
    public Post createPost(PostRequest request) {
        return postRepository.save(request.toEntity());
    }
}
```

`@PreAuthorize`는 메서드 **실행 전**, `@PostAuthorize`는 **실행 후** 반환값을 기준으로 검사합니다. SpEL(Spring Expression Language)을 사용하므로 `#paramName`으로 파라미터를, `authentication`으로 현재 인증 정보에 접근할 수 있습니다.

![인증·인가 설정 코드](/assets/posts/spring-security-authentication-vs-authorization-code.svg)

## 예외 처리: 401 vs 403

Spring Security는 인증·인가 예외를 `ExceptionTranslationFilter`가 HTTP 응답으로 변환합니다.

```java
http.exceptionHandling(ex -> ex
    // 미인증 → 401 처리 (기본: 로그인 페이지 리다이렉트)
    .authenticationEntryPoint((request, response, authException) -> {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.getWriter().write("{\"error\":\"인증이 필요합니다\"}");
    })
    // 권한 없음 → 403 처리
    .accessDeniedHandler((request, response, accessDeniedException) -> {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.getWriter().write("{\"error\":\"접근 권한이 없습니다\"}");
    })
);
```

REST API에서는 로그인 페이지로 리다이렉트하는 대신 JSON 오류 응답을 반환해야 합니다. `AuthenticationEntryPoint`와 `AccessDeniedHandler`를 커스터마이징하면 앞서 만든 `ApiResponse` 형식과 일관성을 유지할 수 있습니다.

## 정리: 두 개념의 위치

| | 인증 (Authentication) | 인가 (Authorization) |
|---|---|---|
| **질문** | 누구인가 | 무엇을 할 수 있는가 |
| **실패 코드** | 401 | 403 |
| **주요 인터페이스** | `AuthenticationManager` | `AuthorizationManager` |
| **Spring 컴포넌트** | `UsernamePasswordAuthFilter` | `AuthorizationFilter` |
| **설정 위치** | `formLogin()`, `oauth2Login()` | `authorizeHttpRequests()`, `@PreAuthorize` |

인증 없이 인가가 의미 없고, 인가 없는 인증은 절반의 보안입니다. 두 단계가 모두 올바르게 설정돼야 Spring Security가 의도한 대로 동작합니다.

---

**지난 글:** [Spring Security 아키텍처 — 필터 체인의 구조와 동작](/posts/spring-security-architecture/)

**다음 글:** [UserDetailsService와 PasswordEncoder 구현](/posts/spring-security-userdetails-passwordencoder/)

<br>
읽어주셔서 감사합니다. 😊
