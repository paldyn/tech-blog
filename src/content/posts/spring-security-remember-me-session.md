---
title: "Spring Security Remember-Me와 세션 관리"
description: "Spring Security의 Remember-Me 기능(Simple Hash vs Persistent Token)과 세션 고정 공격 방어, 동시 세션 제어, Spring Session을 이용한 분산 세션 관리를 실전 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "RememberMe", "세션관리", "SessionFixation", "PersistentToken", "SpringSession", "동시세션"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-resource-auth-server/)에서 OAuth2 인가 서버와 리소스 서버를 분리해 JWT를 검증하는 방법을 살펴봤습니다. 이번 글에서는 Spring Security의 **Remember-Me 기능**과 **세션 보안 관리**를 다룹니다. "로그인 유지" 체크박스 하나로 편의성을 높이는 것처럼 보이지만, 내부에는 두 가지 구현 방식이 있고 세션 고정 공격이나 동시 세션 제어 같은 보안 사항을 함께 고려해야 합니다.

## Remember-Me 방식 비교

| 방식 | 저장 위치 | 장점 | 단점 |
|------|----------|------|------|
| **Simple Hash-Based** | 쿠키만 (서버 상태 없음) | 설정 간단, DB 불필요 | 쿠키 탈취 시 즉시 취소 불가 |
| **Persistent Token** | DB (+ 쿠키) | 토큰 교체로 탈취 감지 | DB 저장소 필요 |

### Simple Hash-Based Token

`username + password + expiry + key`를 MD5로 해싱해 쿠키에 저장합니다. 구현이 간단하지만, **비밀번호가 변경되면 자동으로 쿠키가 무효화**된다는 특성이 있습니다. 반대로 비밀번호가 유출되면 공격자도 유효한 Remember-Me 토큰을 생성할 수 있습니다.

```java
http.rememberMe(rm -> rm
    .key("uniqueAndSecretKey")   // 서명 키
    .tokenValiditySeconds(1_209_600)  // 14일
    .rememberMeParameter("remember-me")
    .userDetailsService(userDetailsService));
```

### Persistent Token (권장)

로그인 시 `series`(고정) + `token`(매 요청마다 갱신)을 DB에 저장하고, 쿠키에 `series:token` 형태로 발급합니다. 누군가 탈취한 쿠키로 접근하면 `series`는 있지만 `token`이 불일치하므로 **도난을 감지하고 전체 시리즈를 삭제**합니다.

```java
@Bean
public PersistentTokenRepository persistentTokenRepository(
        DataSource dataSource) {
    JdbcTokenRepositoryImpl repo = new JdbcTokenRepositoryImpl();
    repo.setDataSource(dataSource);
    repo.setCreateTableOnStartup(false); // 아래 DDL 직접 실행
    return repo;
}
```

```sql
CREATE TABLE persistent_logins (
    username   VARCHAR(64) NOT NULL,
    series     VARCHAR(64) PRIMARY KEY,
    token      VARCHAR(64) NOT NULL,
    last_used  TIMESTAMP   NOT NULL
);
```

```java
http.rememberMe(rm -> rm
    .tokenRepository(persistentTokenRepository(dataSource))
    .tokenValiditySeconds(1_209_600)
    .userDetailsService(userDetailsService));
```

## Persistent Token 인증 플로우

![Persistent Token Remember-Me 플로우](/assets/posts/spring-security-remember-me-session-flow.svg)

핵심은 **token 교체(rotation)**입니다. 매 성공 요청마다 DB의 token 값이 바뀌고, 새 쿠키가 발급됩니다. 공격자가 이전 쿠키를 탈취해도 최신 token과 일치하지 않아 즉시 도난 감지가 이뤄집니다.

## 세션 고정 공격(Session Fixation) 방어

세션 고정 공격은 공격자가 미리 알고 있는 세션 ID를 피해자가 로그인에 사용하도록 유도해 세션을 하이재킹하는 기법입니다. Spring Security는 **로그인 성공 시 새 세션 ID를 발급**해 이를 막습니다.

![세션 고정 공격 방어](/assets/posts/spring-security-remember-me-session-config.svg)

```java
http.sessionManagement(session -> session
    .sessionFixation(sf -> sf.migrateSession()));
```

`migrateSession()`(기본값)은 기존 세션의 속성을 새 세션으로 복사하고 세션 ID를 교체합니다. `newSession()`은 속성 복사 없이 새 세션만 생성하므로 더 엄격하지만, 기존 세션 속성이 필요한 경우 주의가 필요합니다.

## 동시 세션 제어

```java
@Bean
public HttpSessionEventPublisher httpSessionEventPublisher() {
    return new HttpSessionEventPublisher();
}

// SecurityFilterChain 내부
http.sessionManagement(session -> session
    .maximumSessions(1)
    .maxSessionsPreventsLogin(false)  // false: 기존 세션 만료
    .expiredUrl("/login?expired"));   // true: 새 로그인 차단
```

`HttpSessionEventPublisher`는 세션 생성·소멸 이벤트를 `SessionRegistry`에 전달합니다. `maximumSessions(1)`로 하나의 계정에 동시 세션을 1개로 제한할 수 있습니다.

`maxSessionsPreventsLogin(false)`: 새 로그인이 성공하면 기존 세션이 만료됩니다. 보안보다 UX 편의성을 우선할 때 사용합니다.

`maxSessionsPreventsLogin(true)`: 이미 세션이 있으면 새 로그인을 거부합니다. 금융·결제처럼 엄격한 보안이 필요할 때 사용합니다.

## 세션 속성 접근

Spring Security는 인증된 사용자 정보를 세션의 `SecurityContext`에 저장합니다. 직접 세션에 접근할 때는 `HttpSession`을 인자로 받거나 `HttpServletRequest.getSession()`을 사용합니다.

```java
@GetMapping("/profile")
public String profile(HttpSession session,
        @AuthenticationPrincipal UserDetails user) {
    session.setAttribute("lastVisit", LocalDateTime.now());
    return user.getUsername();
}
```

세션 타임아웃 설정:

```yaml
server:
  servlet:
    session:
      timeout: 30m   # 기본 30분, 비활성 세션 자동 만료
```

## 분산 환경 — Spring Session + Redis

다중 인스턴스 환경에서 세션을 공유하려면 **Spring Session**을 사용합니다. HTTP 세션을 Redis(또는 JDBC)로 투명하게 교체해줍니다.

```groovy
implementation 'org.springframework.session:spring-session-data-redis'
implementation 'org.springframework.boot:spring-boot-starter-data-redis'
```

```yaml
spring:
  session:
    store-type: redis
    redis:
      flush-mode: on-save    # 응답 시점에 Redis 저장
      namespace: "myapp:session"
  data:
    redis:
      host: localhost
      port: 6379
```

`@EnableRedisHttpSession` 어노테이션이나 자동 구성으로 활성화되면, `HttpSession` 구현체가 Redis 기반으로 바뀝니다. 기존 코드 변경 없이 세션 공유가 가능합니다.

## Remember-Me + JWT 혼용 시 주의사항

JWT 기반 API 서버(`SessionCreationPolicy.STATELESS`)에 Remember-Me를 함께 사용하는 것은 **적합하지 않습니다**. Remember-Me는 세션 기반 인증의 연장선이기 때문입니다. JWT 환경에서 장기 인증을 유지하려면 Refresh Token의 만료 기간을 늘리거나, Refresh Token을 쿠키(HttpOnly, Secure)에 저장하는 방식을 사용합니다.

## 마무리

Spring Security의 Remember-Me는 Simple Hash 방식과 Persistent Token 방식 중 **운영 환경에서는 Persistent Token**을 권장합니다. 세션 보안 설정에서는 세션 고정 방어(기본 활성화)와 동시 세션 제어를 적절히 구성하고, 분산 환경에서는 Spring Session으로 세션 저장소를 Redis로 이전하는 것이 일반적입니다.

---

**지난 글:** [Spring Security 리소스 서버와 인가 서버 구현](/posts/spring-security-resource-auth-server/)

**다음 글:** [Spring Cache 추상화 — @Cacheable · @CacheEvict 완전 정복](/posts/spring-cache-abstraction/)

<br>
읽어주셔서 감사합니다. 😊
