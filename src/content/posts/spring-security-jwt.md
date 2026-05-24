---
title: "Spring Security JWT 인증 구현"
description: "JWT 토큰 구조부터 Access/Refresh Token 발급, JwtAuthenticationFilter 구현, 토큰 재발급 전략까지 Spring Security에서 JWT 기반 인증을 실전 코드와 함께 단계적으로 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "JWT", "JwtFilter", "AccessToken", "RefreshToken", "JJWT", "토큰인증"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-oauth2-oidc-concept/)에서 OAuth2·OIDC 흐름을 살펴봤습니다. 소셜 로그인은 외부 인가 서버에 인증을 위임하지만, 사내 API 서버나 모바일 앱처럼 **직접 토큰을 발급해야 하는 상황**이라면 JWT 기반 인증이 더 적합합니다. 이번 글에서는 JJWT 라이브러리로 Access Token과 Refresh Token을 생성·검증하고, `JwtAuthenticationFilter`를 Spring Security 필터 체인에 통합하는 방법을 단계별로 구현합니다.

## 세션 방식 vs JWT 방식

Spring Security의 기본 동작은 **세션 기반** 인증입니다. 로그인 성공 시 서버가 `HttpSession`에 `SecurityContext`를 저장하고, 이후 요청마다 세션 ID(쿠키)를 확인해 인증 상태를 복원합니다. 이 방식은 서버 스케일 아웃 시 세션 공유 문제(Sticky Session 또는 Redis Session)가 발생합니다.

JWT(JSON Web Token)는 인증 상태를 **토큰 자체에 포함**합니다. 서버는 토큰에 서명만 검증하면 되므로, 어느 서버 인스턴스에서도 동일하게 처리할 수 있어 **Stateless** 아키텍처에 자연스럽게 어울립니다. 단, 발급한 토큰을 즉시 무효화(취소)하기 어렵다는 트레이드오프가 있습니다.

## JWT 구조

JWT는 세 부분이 `.`으로 구분된 Base64URL 인코딩 문자열입니다.

![JWT 구조 시각화](/assets/posts/spring-security-jwt-structure.svg)

| 파트 | 내용 | 인코딩 |
|------|------|--------|
| Header | 알고리즘(`alg`) + 타입(`typ`) | Base64URL |
| Payload | Claims (sub, iat, exp, role 등) | Base64URL |
| Signature | HMAC-SHA256(Header + "." + Payload, secretKey) | Binary |

Payload는 암호화되지 않으므로 **민감 정보(비밀번호, 주민번호)는 절대 포함하지 않아야** 합니다.

## 프로젝트 설정

### 의존성 추가

```groovy
// build.gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'io.jsonwebtoken:jjwt-api:0.12.5'
    runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.5'
    runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.5'
}
```

### application.yml 설정

```yaml
jwt:
  secret: "MyVeryLongSecretKeyForJWTSigningAtLeast256BitsLong=="
  access-token-expiry: 3600000   # 1시간 (ms)
  refresh-token-expiry: 604800000 # 7일 (ms)
```

## JwtTokenProvider 구현

토큰 생성·검증·클레임 파싱 로직을 `JwtTokenProvider`에 캡슐화합니다.

```java
@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long accessExpiry;
    private final long refreshExpiry;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiry}") long accessExpiry,
            @Value("${jwt.refresh-token-expiry}") long refreshExpiry) {
        this.secretKey = Keys.hmacShaKeyFor(
                Decoders.BASE64.decode(secret));
        this.accessExpiry  = accessExpiry;
        this.refreshExpiry = refreshExpiry;
    }

    public String createAccessToken(String username, String role) {
        return buildToken(username, role, accessExpiry);
    }

    public String createRefreshToken(String username) {
        return buildToken(username, null, refreshExpiry);
    }

    private String buildToken(String sub, String role, long expiry) {
        var builder = Jwts.builder()
                .subject(sub)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiry))
                .signWith(secretKey);
        if (role != null) builder.claim("role", role);
        return builder.compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try { parseClaims(token); return true; }
        catch (JwtException | IllegalArgumentException e) { return false; }
    }
}
```

`Keys.hmacShaKeyFor()`는 256비트 이상의 시크릿 키를 요구합니다. 운영 환경에서는 환경변수 또는 Vault 등으로 시크릿을 주입하세요.

## JwtAuthenticationFilter 구현

매 HTTP 요청마다 `Authorization: Bearer {token}` 헤더를 파싱하여 `SecurityContext`에 인증 정보를 등록합니다.

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String token = resolveToken(req);

        if (token != null && tokenProvider.isValid(token)) {
            Claims claims = tokenProvider.parseClaims(token);
            String username = claims.getSubject();

            UserDetails user = userDetailsService
                    .loadUserByUsername(username);
            var auth = new UsernamePasswordAuthenticationToken(
                    user, null, user.getAuthorities());
            auth.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(req));
            SecurityContextHolder.getContext()
                    .setAuthentication(auth);
        }
        chain.doFilter(req, res);
    }

    private String resolveToken(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

`OncePerRequestFilter`를 상속하면 포워드·인클루드 요청에서 필터가 중복 실행되지 않습니다.

## SecurityFilterChain 설정

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http)
            throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(
                    SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/auth/**").permitAll()
                    .anyRequest().authenticated())
            .addFilterBefore(jwtFilter,
                    UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

`SessionCreationPolicy.STATELESS`로 설정하면 Spring Security가 세션을 생성·조회하지 않습니다. JWT 인증에서는 이 설정이 필수입니다.

## 로그인 엔드포인트 — 토큰 발급

```java
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtTokenProvider tokenProvider;

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(
            @RequestBody LoginRequest req) {

        var auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        req.username(), req.password()));

        String username = auth.getName();
        String role = auth.getAuthorities().stream()
                .findFirst()
                .map(GrantedAuthority::getAuthority)
                .orElse("ROLE_USER");

        return ResponseEntity.ok(new TokenResponse(
                tokenProvider.createAccessToken(username, role),
                tokenProvider.createRefreshToken(username)));
    }
}
```

## JWT 인증 전체 플로우

![JWT 인증 플로우](/assets/posts/spring-security-jwt-flow.svg)

로그인 성공 후 클라이언트는 Access Token을 `Authorization: Bearer {token}` 헤더에 담아 API를 호출합니다. `JwtAuthenticationFilter`가 헤더를 추출해 서명을 검증하고, 유효하면 `SecurityContext`에 인증 정보를 등록합니다. 이후 컨트롤러는 `@AuthenticationPrincipal`로 현재 사용자를 바로 주입받을 수 있습니다.

## Access Token + Refresh Token 전략

Access Token의 만료 시간을 짧게(15분~1시간) 설정하면 탈취되더라도 유효 시간이 제한됩니다. 만료 시 클라이언트는 Refresh Token으로 새 Access Token을 요청합니다.

```java
@PostMapping("/refresh")
public ResponseEntity<TokenResponse> refresh(
        @RequestBody RefreshRequest req) {

    String refreshToken = req.refreshToken();
    if (!tokenProvider.isValid(refreshToken)) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    String username = tokenProvider.parseClaims(refreshToken)
            .getSubject();
    UserDetails user = userDetailsService.loadUserByUsername(username);
    String role = user.getAuthorities().stream()
            .findFirst()
            .map(GrantedAuthority::getAuthority)
            .orElse("ROLE_USER");

    return ResponseEntity.ok(new TokenResponse(
            tokenProvider.createAccessToken(username, role),
            tokenProvider.createRefreshToken(username)));
}
```

## 주의사항 — JWT 취소의 어려움

JWT는 서버가 상태를 저장하지 않기 때문에 **발급 후 즉시 취소(로그아웃, 강제 만료)**가 어렵습니다. 이를 해결하는 대표적인 전략은 두 가지입니다.

**블랙리스트 방식**: 로그아웃 시 해당 토큰(또는 jti 클레임)을 Redis에 저장합니다. 필터에서 매 요청마다 블랙리스트를 조회해 무효화된 토큰을 거부합니다. 단, Redis I/O가 추가됩니다.

**단기 Access Token + Refresh Token 회전**: Access Token 수명을 15분으로 줄이고, Refresh Token을 사용할 때마다 새 Refresh Token으로 교체(Rotation)합니다. 도난 감지가 쉬워지고 Redis 의존 없이도 어느 정도 보안을 유지할 수 있습니다.

실무에서는 두 전략을 혼용하는 경우가 많습니다. Access Token을 15~30분으로 짧게 잡고, Refresh Token에만 블랙리스트를 적용해 로그아웃 시 Refresh Token만 Redis에 등록합니다.

---

**지난 글:** [Spring Security OAuth2 · OIDC 개념과 소셜 로그인 구현](/posts/spring-security-oauth2-oidc-concept/)

**다음 글:** [Spring Security 리소스 서버와 인가 서버 구현](/posts/spring-security-resource-auth-server/)

<br>
읽어주셔서 감사합니다. 😊
