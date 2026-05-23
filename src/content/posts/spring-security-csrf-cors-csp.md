---
title: "Spring Security CSRF · CORS · CSP 완전 정리"
description: "Spring Security에서 가장 자주 혼동되는 세 가지 웹 보안 메커니즘 — CSRF 토큰, CORS 정책, Content-Security-Policy — 의 개념 차이와 설정 방법을 실전 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "CSRF", "CORS", "CSP", "보안헤더", "CorsConfigurationSource", "ContentSecurityPolicy"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-formlogin/)에서 폼 로그인의 인증 흐름과 `SecurityFilterChain` 설정을 살펴봤습니다. 이번 글에서는 웹 보안을 다룰 때 가장 자주 혼동되는 세 가지 개념, **CSRF · CORS · CSP**를 각각 명확히 정의하고 Spring Security에서 어떻게 설정하는지 실전 코드로 정리합니다.

## 세 가지 보안 메커니즘 한눈에 보기

CSRF, CORS, CSP는 이름이 비슷하지만 방어하는 공격 벡터가 완전히 다릅니다.

![CSRF · CORS · CSP 보안 메커니즘 비교](/assets/posts/spring-security-csrf-cors-csp-concept.svg)

- **CSRF**: 악성 사이트가 이미 로그인된 사용자의 세션을 이용해 서버에 요청을 위조하는 공격을 막습니다. 서버가 발급한 비밀 토큰을 매 요청에 포함하게 해서, 토큰을 모르는 외부 사이트의 요청을 거부합니다.
- **CORS**: 브라우저의 동일 출처 정책(Same-Origin Policy)으로 인해 교차 출처 요청이 막히는 상황을 서버가 명시적으로 허용하는 메커니즘입니다. 보안을 약화시키는 것이 아니라 "허용 목록을 명시"하는 방식으로 동작합니다.
- **CSP**: HTTP 응답 헤더로 브라우저에게 "이 페이지에서는 어떤 출처의 리소스만 로드·실행을 허용한다"고 알려줍니다. XSS 등 인젝션 공격의 피해를 브라우저 레벨에서 최소화합니다.

## CSRF 설정

### 폼 기반 앱 — 기본값 유지

Spring Security는 기본적으로 CSRF 보호가 **활성화**되어 있습니다. 별도 설정 없이 `formLogin()`을 사용하면 CSRF 필터가 자동으로 작동합니다. Thymeleaf를 사용하면 `th:action`만 써도 CSRF 토큰이 hidden 필드로 자동 삽입됩니다.

```java
// 폼 기반 앱: 별도 설정 불필요 (기본값 활성화)
http.csrf(Customizer.withDefaults())
```

### REST API — 비활성화

JWT 등 토큰 기반 인증을 사용하는 Stateless REST API는 세션 쿠키를 사용하지 않으므로 CSRF 공격 대상이 아닙니다. 이 경우 명시적으로 비활성화합니다.

```java
http
  .csrf(AbstractHttpConfigurer::disable)
  .sessionManagement(s -> s
      .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
```

### CookieCsrfTokenRepository — SPA + 쿠키

React/Vue 같은 SPA에서 CSRF 토큰을 쿠키로 전달하고 JavaScript가 읽어서 헤더에 담아 보내는 패턴을 사용할 때는 `CookieCsrfTokenRepository`를 사용합니다.

```java
http.csrf(csrf -> csrf
    .csrfTokenRepository(
        CookieCsrfTokenRepository.withHttpOnlyFalse()))
```

`withHttpOnlyFalse()`를 써야 JavaScript에서 쿠키를 읽을 수 있습니다. 프론트엔드는 `X-XSRF-TOKEN` 헤더에 쿠키 값을 담아 전송합니다.

## CORS 설정

### CorsConfigurationSource 빈 등록

Spring Security 6에서 CORS를 설정하는 가장 권장되는 방식은 `CorsConfigurationSource` 빈을 등록하고 `SecurityFilterChain`에서 `.cors(Customizer.withDefaults())`를 호출하는 것입니다.

![CSRF · CORS 코드 설정](/assets/posts/spring-security-csrf-cors-csp-config.svg)

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://app.example.com"));
    config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization","Content-Type","X-Requested-With"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);  // Preflight 캐시 시간(초)

    UrlBasedCorsConfigurationSource source =
        new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

`setAllowCredentials(true)` 설정 시 `setAllowedOrigins("*")`(와일드카드)는 사용할 수 없습니다. 반드시 구체적인 출처를 명시해야 합니다.

### SecurityFilterChain에 CORS 연결

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .cors(Customizer.withDefaults())  // CorsConfigurationSource 빈 자동 사용
        .csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .build();
}
```

### @CrossOrigin 어노테이션과의 차이

컨트롤러 또는 메서드에 `@CrossOrigin`을 달아도 CORS가 동작하지만, 이 방식은 MVC 레이어에서만 처리되고 Security 필터 체인보다 늦게 실행됩니다. 전역 CORS 정책은 `CorsConfigurationSource`를 통해 Security 레벨에서 관리하는 것이 권장됩니다.

## CSP 설정

### 기본 CSP 헤더 추가

```java
http.headers(headers -> headers
    .contentSecurityPolicy(csp ->
        csp.policyDirectives(
            "default-src 'self'; " +
            "script-src 'self' https://cdn.jsdelivr.net; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src * data:; " +
            "frame-ancestors 'none'")))
```

`default-src 'self'`는 기본적으로 현재 출처의 리소스만 허용합니다. 개별 지시어로 세밀하게 재정의할 수 있습니다.

### 주요 CSP 지시어

| 지시어 | 역할 |
|---|---|
| `default-src` | 명시되지 않은 모든 소스의 기본값 |
| `script-src` | JavaScript 허용 출처 |
| `style-src` | CSS 허용 출처 |
| `img-src` | 이미지 허용 출처 |
| `connect-src` | fetch/XHR/WebSocket 허용 출처 |
| `frame-ancestors` | 이 페이지를 iframe에 삽입 허용 출처 |
| `report-uri` | 위반 보고 엔드포인트 |

### 보고 전용 모드 (Content-Security-Policy-Report-Only)

정책을 먼저 차단 없이 테스트하고 싶을 때는 보고 전용 모드를 사용합니다. 실제 차단은 하지 않고 위반 내용을 `report-uri`로 전송합니다.

```java
csp.policyDirectives("default-src 'self'; report-uri /csp-report")
   .reportOnly(true)
```

프로덕션 배포 전 이 모드로 충분히 테스트한 후 `reportOnly(false)`로 전환하는 것이 권장됩니다.

## 보안 헤더 전체 설정

Spring Security는 CSRF·CORS·CSP 외에도 다양한 보안 헤더를 기본 제공합니다.

```java
http.headers(headers -> headers
    .xssProtection(xss -> xss.headerValue(
        XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
    .contentTypeOptions(Customizer.withDefaults())
    .frameOptions(frame -> frame.sameOrigin())
    .httpStrictTransportSecurity(hsts -> hsts
        .includeSubDomains(true)
        .maxAgeInSeconds(31536000))
    .contentSecurityPolicy(csp ->
        csp.policyDirectives("default-src 'self'")))
```

- **X-XSS-Protection**: 구형 브라우저의 반사형 XSS 필터 활성화
- **X-Content-Type-Options: nosniff**: MIME 타입 추측 방지
- **X-Frame-Options**: 클릭재킹 방지 (`DENY` 또는 `SAMEORIGIN`)
- **Strict-Transport-Security**: HTTPS 강제 (HSTS)

## 정리 — 어떤 상황에서 무엇을 끄나?

| 상황 | CSRF | CORS | CSP |
|---|---|---|---|
| 전통적인 MVC + Thymeleaf | 유지 (기본값) | 불필요 (동일 출처) | 권장 |
| REST API + JWT | **비활성화** | 필요 (SPA 분리) | 권장 |
| REST API + 세션 쿠키 | 유지 | 필요 | 권장 |
| SPA (React/Vue) + 쿠키 | CookieCsrf | 필요 | 권장 |

CSRF는 **세션 쿠키 기반 인증에만 의미 있습니다**. JWT 헤더 인증은 브라우저가 자동으로 첨부하지 않으므로 위조 요청이 애초에 불가능합니다.

---

**지난 글:** [Spring Security 폼 로그인 구현](/posts/spring-security-formlogin/)

**다음 글:** [Spring Security 메서드 보안 — @PreAuthorize · @PostAuthorize](/posts/spring-security-method-security/)

<br>
읽어주셔서 감사합니다. 😊
