---
title: "Spring Security 메서드 보안 — @PreAuthorize · @PostAuthorize 완전 정리"
description: "Spring Security의 메서드 수준 보안을 제공하는 @PreAuthorize, @PostAuthorize, @Secured, @RolesAllowed, @PostFilter를 AOP 프록시 동작 원리와 함께 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "PreAuthorize", "PostAuthorize", "MethodSecurity", "EnableMethodSecurity", "SpEL", "AOP"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-csrf-cors-csp/)에서 CSRF·CORS·CSP 보안 메커니즘을 다뤘습니다. URL 기반 접근 제어(`authorizeHttpRequests`)만으로는 "이 메서드는 게시글 작성자만 호출할 수 있다"와 같은 도메인 로직 수준의 세밀한 권한 제어가 어렵습니다. 이번 글에서는 **메서드 수준에서 동작하는 Spring Security의 메서드 보안**을 AOP 프록시 원리부터 실전 SpEL 표현식까지 정리합니다.

## 메서드 보안이 필요한 이유

URL 기반 보안은 요청 경로와 HTTP 메서드 조합으로 접근을 제어합니다. 하지만 `GET /posts/123`은 누구나 허용하면서, 이 게시글의 **소유자만** 수정/삭제할 수 있어야 한다는 요구는 URL 패턴만으로 표현할 수 없습니다. 이때 서비스 레이어나 리포지토리 레이어의 **메서드 단위**로 권한을 검사하는 것이 메서드 보안입니다.

## 활성화

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {
    // ...
}
```

Spring Security 6에서는 `@EnableMethodSecurity`가 `@EnableGlobalMethodSecurity`를 대체합니다. `prePostEnabled = true`가 기본값이므로 어노테이션만 붙여도 `@PreAuthorize`와 `@PostAuthorize`가 동작합니다. `@Secured`나 `@RolesAllowed`를 쓰려면 각각 `securedEnabled = true`, `jsr250Enabled = true`를 추가합니다.

## AOP 프록시 동작 원리

메서드 보안은 Spring AOP 프록시를 통해 동작합니다.

![메서드 보안 AOP 프록시 동작 흐름](/assets/posts/spring-security-method-security-flow.svg)

컨트롤러가 서비스 빈의 메서드를 호출하면 Spring은 실제 빈 대신 **AOP 프록시**를 통해 호출을 가로챕니다. 프록시는 `AuthorizationManagerBeforeMethodInterceptor`를 실행해 `SecurityContextHolder`에서 현재 인증 정보를 가져오고 SpEL 표현식을 평가합니다. 권한이 있으면 실제 메서드가 실행되고, 없으면 `AccessDeniedException`이 발생해 `ExceptionTranslationFilter`가 403 응답을 반환합니다.

중요한 제약이 하나 있습니다. **같은 클래스 내부에서 자기 자신의 메서드를 호출할 때는 프록시를 거치지 않습니다.** A 메서드에서 `this.B()`를 호출하면 프록시가 개입하지 않아 B의 보안 어노테이션이 무시됩니다. 이 경우 B를 별도 빈으로 분리하거나 `AopContext.currentProxy()`를 사용해야 합니다.

## @PreAuthorize — 메서드 실행 전 검사

메서드가 실행되기 전에 SpEL 표현식을 평가합니다.

```java
@Service
public class PostService {

    // 역할 검사
    @PreAuthorize("hasRole('ADMIN')")
    public void deletePost(Long id) {
        postRepository.deleteById(id);
    }

    // 권한 검사 (Authority)
    @PreAuthorize("hasAuthority('POST_WRITE')")
    public Post createPost(PostRequest req) {
        return postRepository.save(req.toEntity());
    }

    // 인수 참조 (#param)
    @PreAuthorize("#email == authentication.name or hasRole('ADMIN')")
    public UserDto getProfile(String email) {
        return userRepository.findByEmail(email)
            .map(UserDto::from)
            .orElseThrow();
    }

    // 커스텀 빈 메서드 호출
    @PreAuthorize("@postSecurity.isOwner(#postId, authentication)")
    public void updatePost(Long postId, PostRequest req) {
        // ...
    }
}
```

`hasRole('ADMIN')`은 내부적으로 `ROLE_ADMIN` 권한을 확인합니다. `hasAuthority('POST_WRITE')`는 접두사 없이 정확히 일치하는 권한을 확인합니다.

`#param` 형태는 메서드 파라미터를 참조합니다. `-parameters` 컴파일 옵션이나 Spring Boot의 기본 설정으로 파라미터 이름이 보존되어야 합니다.

`@beanName.method()` 형태로 스프링 빈의 메서드를 호출해 복잡한 로직을 SpEL 밖으로 꺼낼 수 있습니다.

```java
@Component("postSecurity")
public class PostSecurityService {

    private final PostRepository postRepository;

    public boolean isOwner(Long postId, Authentication auth) {
        return postRepository.findById(postId)
            .map(post -> post.getAuthor().equals(auth.getName()))
            .orElse(false);
    }
}
```

## @PostAuthorize — 메서드 실행 후 반환값 검사

메서드가 실행된 이후에 반환값(`returnObject`)을 기준으로 권한을 검사합니다.

```java
@PostAuthorize("returnObject.ownerId == authentication.principal.id or hasRole('ADMIN')")
public Document findById(Long id) {
    return documentRepository.findById(id).orElseThrow();
}
```

`@PreAuthorize`와 달리 메서드 본체가 먼저 실행되므로 DB 조회가 먼저 일어납니다. 데이터를 조회한 후 소유권을 검증할 때 유용합니다. 다만 조회 자체는 항상 발생하므로 성능 비용을 고려해야 합니다.

## 어노테이션 전체 비교

![메서드 보안 어노테이션 실전 예제](/assets/posts/spring-security-method-security-annotations.svg)

| 어노테이션 | 실행 시점 | 표현식 | 특징 |
|---|---|---|---|
| `@PreAuthorize` | 메서드 실행 전 | SpEL | 파라미터 참조 가능 |
| `@PostAuthorize` | 메서드 실행 후 | SpEL | returnObject 참조 가능 |
| `@Secured` | 실행 전 | 역할 문자열 배열 | SpEL 미지원, 단순 역할 전용 |
| `@RolesAllowed` | 실행 전 | 역할 문자열 배열 | JSR-250 표준 |
| `@PreFilter` | 실행 전 | SpEL | 입력 컬렉션 필터링 |
| `@PostFilter` | 실행 후 | SpEL | 반환 컬렉션 필터링 |

### @PostFilter — 반환 컬렉션 필터링

```java
@PostFilter("filterObject.owner == authentication.name")
public List<Document> findAllDocuments() {
    return documentRepository.findAll();  // 전체 조회 후 필터링
}
```

전체 컬렉션을 조회한 후 현재 사용자 소유의 항목만 남깁니다. 대규모 데이터에서는 DB 쿼리 레벨에서 필터링하는 것이 성능상 낫습니다.

## SpEL 주요 표현식 정리

```java
// 인증 여부
@PreAuthorize("isAuthenticated()")

// 역할 복수 조건
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")

// 권한 + 논리 연산
@PreAuthorize("hasRole('USER') and #userId == authentication.principal.id")

// 익명 허용
@PreAuthorize("isAnonymous()")

// principal 속성 접근
@PreAuthorize("authentication.principal.department == 'IT'")
```

`authentication.principal`은 `UserDetails` 구현체를 가리킵니다. 커스텀 `UserDetails`에 추가한 필드를 직접 참조할 수 있어 유연한 권한 로직이 가능합니다.

## 주의사항 — 트랜잭션과 메서드 보안

`@Transactional`과 `@PreAuthorize`를 같은 메서드에 함께 사용하면 두 개의 프록시가 중첩됩니다. 내부 호출 문제와 프록시 순서에 주의해야 합니다. 기본적으로 `@PreAuthorize`가 먼저 실행되어 트랜잭션 시작 전에 권한을 확인하므로 의미상 올바릅니다. 반대로 `@PostAuthorize`와 `@Transactional`을 함께 쓰면 메서드 완료 후 권한 검사 과정에서 `AccessDeniedException`이 발생해도 트랜잭션이 이미 커밋될 수 있으므로 주의가 필요합니다.

---

**지난 글:** [Spring Security CSRF · CORS · CSP 설정](/posts/spring-security-csrf-cors-csp/)

**다음 글:** [Spring Security OAuth2 · OIDC 개념](/posts/spring-security-oauth2-oidc-concept/)

<br>
읽어주셔서 감사합니다. 😊
