---
title: "Spring Security OAuth2 · OIDC 개념과 소셜 로그인 구현"
description: "OAuth2 Authorization Code Flow와 OIDC의 차이를 이해하고, Spring Security OAuth2 클라이언트로 Google·Kakao 소셜 로그인을 구현하는 방법을 실전 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "OAuth2", "OIDC", "소셜로그인", "OAuth2Login", "OAuth2UserService", "Google", "Kakao"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-method-security/)에서 AOP 기반 메서드 보안을 살펴봤습니다. 이번 글에서는 현대 웹 서비스에서 가장 흔히 사용되는 인증 방식인 **OAuth2**와 그 위에 인증 레이어를 추가한 **OIDC**의 개념을 정리하고, Spring Security OAuth2 클라이언트 설정으로 Google·Kakao 소셜 로그인을 구현하는 방법을 다룹니다.

## OAuth2 vs OIDC — 핵심 차이

OAuth2와 OIDC는 자주 혼용되지만 목적이 다릅니다.

- **OAuth2** (RFC 6749): **인가(Authorization)** 프레임워크입니다. "이 앱이 내 Google 캘린더에 접근해도 되나요?"처럼 자원(리소스)에 대한 접근 권한을 위임하는 것이 목적입니다. Access Token을 발급하지만, 이 토큰에 사용자 신원 정보가 담겨 있다는 보장이 없습니다.
- **OIDC** (OpenID Connect): OAuth2 Authorization Code Flow 위에 **인증(Authentication)** 레이어를 추가한 표준입니다. Access Token과 함께 **ID Token(JWT)**을 발급하며, 이 JWT에는 사용자 이름, 이메일, 발급자 등 신원 정보(클레임)가 포함됩니다. Google·Kakao·GitHub 등 대부분의 소셜 로그인이 OIDC를 구현합니다.

## Authorization Code Flow 전체 과정

![OAuth2 Authorization Code Flow](/assets/posts/spring-security-oauth2-oidc-concept-flow.svg)

총 8단계로 이루어집니다:

1. 브라우저가 `GET /oauth2/authorization/google`을 앱에 요청합니다.
2. 앱이 인가 서버(Google)의 로그인 페이지로 302 리다이렉트합니다. 이때 `client_id`, `redirect_uri`, `scope`, `state` 파라미터를 포함합니다.
3. 사용자가 Google에서 로그인하고 권한 동의(consent)를 합니다.
4. 인가 서버가 앱의 callback URL(`/login/oauth2/code/google`)으로 Authorization Code를 담아 리다이렉트합니다.
5. 앱이 백채널(브라우저 없이 서버 to 서버)로 인가 서버의 `/token` 엔드포인트에 Authorization Code와 `client_secret`을 보내 토큰을 교환합니다.
6. 인가 서버가 Access Token과 ID Token(OIDC)을 반환합니다.
7. (선택) 앱이 Access Token으로 `/userinfo` 엔드포인트를 호출해 사용자 프로필을 가져옵니다.
8. 앱이 사용자 세션을 생성하고 브라우저를 홈으로 리다이렉트합니다.

**Authorization Code가 짧은 수명을 가지고 백채널 교환을 요구하는 이유**: 브라우저 URL에 노출되는 Code만으로는 토큰을 얻을 수 없고 `client_secret`이 있어야 합니다. `client_secret`은 서버에만 보관되므로 MITM 공격에서 토큰이 탈취되지 않습니다.

## Spring Security OAuth2 클라이언트 의존성

```xml
<!-- Maven -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-oauth2-client</artifactId>
</dependency>
```

```groovy
// Gradle
implementation 'org.springframework.boot:spring-boot-starter-oauth2-client'
```

## application.yml 설정

![Spring Security OAuth2 클라이언트 설정](/assets/posts/spring-security-oauth2-oidc-concept-config.svg)

Google은 Spring Security가 내장 지원(`CommonOAuth2Provider.GOOGLE`)하므로 `client-id`와 `client-secret`만 설정하면 됩니다. Kakao처럼 사용자 정의 공급자는 `provider` 섹션에 엔드포인트를 직접 명시합니다.

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_SECRET}
            scope: openid, profile, email
          kakao:
            client-id: ${KAKAO_CLIENT_ID}
            client-secret: ${KAKAO_SECRET}
            client-authentication-method: client_secret_post
            authorization-grant-type: authorization_code
            redirect-uri: "{baseUrl}/login/oauth2/code/{registrationId}"
            scope: profile_nickname, account_email
        provider:
          kakao:
            authorization-uri: https://kauth.kakao.com/oauth/authorize
            token-uri: https://kauth.kakao.com/oauth/token
            user-info-uri: https://kapi.kakao.com/v2/user/me
            user-name-attribute: id
```

## SecurityFilterChain 설정

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http,
        CustomOAuth2UserService customOAuth2UserService) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/login", "/error").permitAll()
            .anyRequest().authenticated())
        .oauth2Login(oauth2 -> oauth2
            .loginPage("/login")
            .defaultSuccessUrl("/dashboard", true)
            .failureUrl("/login?error")
            .userInfoEndpoint(userInfo -> userInfo
                .userService(customOAuth2UserService)))
        .logout(logout -> logout.logoutSuccessUrl("/"))
        .build();
}
```

`oauth2Login()`을 추가하는 것만으로 Spring Security가 OAuth2 관련 엔드포인트(`/oauth2/authorization/{registrationId}`, `/login/oauth2/code/{registrationId}`)를 자동으로 등록합니다.

## OAuth2UserService 커스텀 — 소셜 사용자 DB 저장

소셜 로그인 사용자를 DB에 저장하거나 업데이트하려면 `OAuth2UserService`를 구현합니다.

```java
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService
        implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) {
        OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate =
            new DefaultOAuth2UserService();
        OAuth2User oAuth2User = delegate.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        String userNameAttribute = userRequest.getClientRegistration()
            .getProviderDetails()
            .getUserInfoEndpoint()
            .getUserNameAttributeName();

        OAuthAttributes attributes = OAuthAttributes.of(
            registrationId, userNameAttribute, oAuth2User.getAttributes());

        User user = saveOrUpdate(attributes);

        return new DefaultOAuth2User(
            Collections.singleton(new SimpleGrantedAuthority(user.getRole())),
            attributes.getAttributes(),
            attributes.getNameAttributeKey());
    }

    private User saveOrUpdate(OAuthAttributes attributes) {
        User user = userRepository.findByEmail(attributes.getEmail())
            .map(u -> u.updateProfile(attributes.getName(), attributes.getPicture()))
            .orElse(attributes.toEntity());
        return userRepository.save(user);
    }
}
```

`OAuthAttributes`는 공급자마다 다른 응답 구조를 통일하는 DTO입니다. Google은 `name`, `email`, `picture` 키를 직접 반환하지만, Kakao는 `kakao_account.email`처럼 중첩 구조입니다.

```java
@Getter
public class OAuthAttributes {
    private Map<String, Object> attributes;
    private String nameAttributeKey;
    private String name;
    private String email;
    private String picture;

    public static OAuthAttributes of(String registrationId,
            String nameAttrKey, Map<String, Object> attributes) {
        if ("kakao".equals(registrationId)) {
            return ofKakao(nameAttrKey, attributes);
        }
        return ofGoogle(nameAttrKey, attributes);
    }

    private static OAuthAttributes ofGoogle(
            String nameAttrKey, Map<String, Object> attrs) {
        return OAuthAttributes.builder()
            .name((String) attrs.get("name"))
            .email((String) attrs.get("email"))
            .picture((String) attrs.get("picture"))
            .attributes(attrs)
            .nameAttributeKey(nameAttrKey)
            .build();
    }

    @SuppressWarnings("unchecked")
    private static OAuthAttributes ofKakao(
            String nameAttrKey, Map<String, Object> attrs) {
        Map<String, Object> kakaoAccount =
            (Map<String, Object>) attrs.get("kakao_account");
        Map<String, Object> profile =
            (Map<String, Object>) kakaoAccount.get("profile");
        return OAuthAttributes.builder()
            .name((String) profile.get("nickname"))
            .email((String) kakaoAccount.get("email"))
            .picture((String) profile.get("profile_image_url"))
            .attributes(attrs)
            .nameAttributeKey(nameAttrKey)
            .build();
    }
}
```

## 현재 로그인 사용자 정보 접근

OAuth2로 로그인한 사용자 정보는 `@AuthenticationPrincipal`로 주입받습니다.

```java
@GetMapping("/profile")
public String profile(@AuthenticationPrincipal OAuth2User principal, Model model) {
    model.addAttribute("name", principal.getAttribute("name"));
    model.addAttribute("email", principal.getAttribute("email"));
    return "profile";
}
```

커스텀 `UserDetails`와 OAuth2를 함께 쓰는 경우 공통 인터페이스를 구현하거나 `OidcUser`/`OAuth2User`를 래핑하는 어댑터 패턴을 사용합니다.

## OIDC ID Token 활용

`openid` scope를 포함하면 OIDC ID Token(JWT)이 발급됩니다. `OidcUserService`를 사용하면 `OidcUser`로 ID Token의 클레임에 직접 접근할 수 있습니다.

```java
userInfoEndpoint(userInfo -> userInfo
    .oidcUserService(customOidcUserService))
```

```java
public class CustomOidcUserService
        implements OAuth2UserService<OidcUserRequest, OidcUser> {
    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) {
        OidcUserService delegate = new OidcUserService();
        OidcUser oidcUser = delegate.loadUser(userRequest);

        String email = oidcUser.getEmail();  // ID Token 클레임
        String sub   = oidcUser.getSubject(); // 사용자 고유 ID
        // ... DB 저장 로직
        return oidcUser;
    }
}
```

---

**지난 글:** [Spring Security 메서드 보안 — @PreAuthorize · @PostAuthorize](/posts/spring-security-method-security/)

**다음 글:** [Spring Security JWT 인증 구현](/posts/spring-security-jwt/)

<br>
읽어주셔서 감사합니다. 😊
