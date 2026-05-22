---
title: "UserDetailsService와 PasswordEncoder — 사용자 인증 구현"
description: "Spring Security에서 사용자 정보를 로드하는 UserDetailsService와 비밀번호를 안전하게 저장·검증하는 PasswordEncoder의 구현 방법을 다룹니다. UserDetails 인터페이스 구현, JPA 엔티티와의 연동, BCryptPasswordEncoder 설정, 그리고 회원가입·로그인 흐름에 대한 실전 예제를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringSecurity", "UserDetailsService", "UserDetails", "PasswordEncoder", "BCrypt", "인증구현", "회원인증"]
featured: false
draft: false
---

[지난 글](/posts/spring-security-authentication-vs-authorization/)에서 인증과 인가의 개념적 차이를 살펴봤습니다. 이번 글에서는 인증 흐름에서 핵심 역할을 하는 두 인터페이스, **`UserDetailsService`**와 **`PasswordEncoder`**를 직접 구현합니다. 이 두 컴포넌트를 올바르게 구현해야 Spring Security가 사용자를 식별하고 비밀번호를 안전하게 검증할 수 있습니다.

## UserDetails 인터페이스

Spring Security는 사용자 정보를 `UserDetails` 인터페이스로 추상화합니다. 이 인터페이스의 7가지 메서드가 인증 프로세스에서 사용됩니다.

![UserDetails 인터페이스와 인증 로딩 흐름](/assets/posts/spring-security-userdetails-passwordencoder-structure.svg)

`getUsername()`과 `getPassword()`가 핵심입니다. 나머지 4개의 `is*()` 메서드는 계정 상태를 나타냅니다. 모두 `true`를 반환하면 활성화된 정상 계정입니다.

## JPA 엔티티에 UserDetails 구현

가장 흔한 패턴은 JPA 엔티티가 직접 `UserDetails`를 구현하는 방식입니다.

```java
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User implements UserDetails {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    private Role role;

    @Builder
    public User(String username, String password, Role role) {
        this.username = username;
        this.password = password;
        this.role = role;
    }

    // UserDetails 메서드
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public boolean isAccountNonExpired()     { return true; }

    @Override
    public boolean isAccountNonLocked()      { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled()               { return true; }
}
```

`role` 필드에서 `ROLE_USER`, `ROLE_ADMIN` 같은 권한 문자열을 생성합니다. `SimpleGrantedAuthority`에 반드시 `ROLE_` 접두사를 붙여야 `hasRole("USER")` 검사가 동작합니다.

엔티티와 UserDetails를 분리하고 싶다면 별도의 `UserPrincipal` 클래스로 래핑하는 방법도 있습니다. 보안과 JPA 관심사를 분리할 수 있지만 변환 코드가 추가됩니다.

## UserDetailsService 구현

`UserDetailsService`는 단 하나의 메서드를 구현합니다.

```java
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "사용자를 찾을 수 없습니다: " + username));
    }
}
```

`UsernameNotFoundException`을 던지면 Spring Security가 이를 `BadCredentialsException`으로 변환해 클라이언트에 반환합니다. 보안상 "이메일이 없습니다" 대신 "아이디 또는 비밀번호가 올바르지 않습니다"처럼 **모호한 메시지**를 외부에 노출해야 합니다.

## PasswordEncoder 설정

비밀번호는 절대 평문으로 저장해서는 안 됩니다. Spring Security는 `PasswordEncoder` 인터페이스를 통해 다양한 해시 알고리즘을 지원합니다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // strength 기본값: 10
    }
}
```

`BCryptPasswordEncoder`는 내부적으로 salt를 생성해 동일한 비밀번호도 매번 다른 해시를 만듭니다. `matches(rawPassword, encodedPassword)` 메서드가 salt를 포함해 비교하므로 별도로 salt를 관리하지 않아도 됩니다.

![UserDetailsService 구현 코드](/assets/posts/spring-security-userdetails-passwordencoder-code.svg)

## 회원가입 흐름 — 비밀번호 인코딩

회원가입 시 비밀번호는 저장 전에 반드시 인코딩합니다.

```java
@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public void register(UserRegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateUsernameException("이미 사용 중인 아이디입니다.");
        }
        User user = User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword())) // ← 인코딩
                .role(Role.USER)
                .build();
        userRepository.save(user);
    }
}
```

`PasswordEncoder.encode()`는 반드시 비즈니스 레이어(서비스)에서 호출합니다. 컨트롤러에서 인코딩하면 이후 계층 어디서도 평문 비밀번호가 흘러가게 됩니다.

## 로그인 테스트

`UserDetailsService`와 `PasswordEncoder`를 모두 구성한 뒤 통합 테스트로 검증합니다.

```java
@SpringBootTest
@AutoConfigureMockMvc
class LoginIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .username("user@test.com")
                .password(passwordEncoder.encode("password123"))
                .role(Role.USER)
                .build());
    }

    @Test
    void 로그인_성공() throws Exception {
        mockMvc.perform(post("/login")
                .param("username", "user@test.com")
                .param("password", "password123")
                .with(csrf()))
                .andExpect(status().is3xxRedirection())  // defaultSuccessUrl 리다이렉트
                .andExpect(redirectedUrl("/dashboard"));
    }

    @Test
    void 비밀번호_오류시_로그인_실패() throws Exception {
        mockMvc.perform(post("/login")
                .param("username", "user@test.com")
                .param("password", "wrongpassword")
                .with(csrf()))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrlPattern("/login?error*"));
    }
}
```

## 자주 발생하는 실수

`PasswordEncoder` 빈이 없으면 Spring Security가 `AbstractUserDetailsAuthenticationProvider`에서 예외를 던집니다. `@Bean`으로 등록했더라도 `SecurityConfig` 밖에서 선언하면 순환 의존성 문제가 생길 수 있으니 `SecurityConfig` 내부나 별도 `PasswordConfig`에 명시적으로 두는 것이 좋습니다.

또한 `UserDetailsService` 구현체가 여러 개라면 어떤 것을 사용할지 `AuthenticationManagerBuilder`에 명시해야 합니다.

```java
@Bean
public AuthenticationManager authManager(
        UserDetailsService uds,
        PasswordEncoder encoder) {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(uds);
    provider.setPasswordEncoder(encoder);
    return new ProviderManager(provider);
}
```

---

**지난 글:** [Spring Security 인증과 인가 — Authentication vs Authorization](/posts/spring-security-authentication-vs-authorization/)

**다음 글:** [Spring Security 폼 로그인 구현](/posts/spring-security-formlogin/)

<br>
읽어주셔서 감사합니다. 😊
