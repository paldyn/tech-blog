---
title: "Spring Data JPA Auditing 완전 정복 — 생성·수정 시각과 작성자 자동 기록"
description: "Spring Data JPA Auditing으로 엔티티의 생성·수정 시각과 작성자 정보를 자동으로 기록하는 방법을 완전히 이해합니다. @EnableJpaAuditing 활성화, @EntityListeners와 AuditingEntityListener 연결, @CreatedDate/@LastModifiedDate/@CreatedBy/@LastModifiedBy 필드 선언, AuditorAware로 로그인 사용자 주입, BaseEntity 설계 패턴, 테스트 시 AuditorAware Mocking 방법을 실무 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "Auditing", "SpringDataJPA", "EntityListeners", "AuditorAware", "CreatedDate", "LastModifiedDate", "BaseEntity"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-pageable-sort/)에서 `Pageable`과 `Sort`를 활용해 효율적인 페이징과 정렬을 구현하는 방법을 살펴봤습니다. 이번 글에서는 실무에서 거의 모든 테이블에 붙는 **생성 시각·수정 시각·작성자 정보를 자동으로 기록**하는 Spring Data JPA Auditing을 다룹니다.

## 왜 Auditing이 필요한가

관계형 데이터베이스에서 운영 테이블의 대부분은 `created_at`, `updated_at`, `created_by`, `updated_by` 같은 컬럼을 가집니다. 이 값들을 서비스 코드에서 직접 채우면 두 가지 문제가 생깁니다. 첫째, 모든 저장 로직마다 `entity.setCreatedAt(LocalDateTime.now())`를 빠짐없이 호출해야 하므로 실수가 발생합니다. 둘째, 시각 계산 로직이 여러 서비스에 흩어져 유지보수가 어려워집니다.

Spring Data JPA Auditing은 JPA EntityListener 이벤트 훅을 이용해 **persist 직전에 생성 시각과 작성자를, update 직전에 수정 시각과 수정자를 자동으로 설정**합니다. 서비스 코드에 시각 기록 로직이 전혀 없어도 데이터베이스에 정확한 값이 저장됩니다.

## 전체 아키텍처

![Spring Data JPA Auditing 아키텍처](/assets/posts/spring-jpa-auditing-concept.svg)

핵심 구성 요소는 세 가지입니다.

1. **`@EnableJpaAuditing`** — Auditing 기능을 활성화하는 설정 애노테이션. `@Configuration` 클래스에 붙입니다.
2. **`AuditingEntityListener`** — `@PrePersist`/`@PreUpdate` 이벤트를 받아 시각·사용자 정보를 채우는 JPA EntityListener.
3. **`AuditorAware<T>`** — 현재 로그인한 사용자 정보를 `Optional<T>` 형태로 반환하는 Bean. `@CreatedBy`와 `@LastModifiedBy` 필드에 주입됩니다.

## @EnableJpaAuditing 설정

`@SpringBootApplication`이 붙은 메인 클래스에 직접 추가하는 경우가 많지만, **별도 `@Configuration` 클래스에 분리**하는 것이 테스트 격리 측면에서 유리합니다.

```java
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> {
            Authentication auth = SecurityContextHolder.getContext()
                    .getAuthentication();
            if (auth == null || !auth.isAuthenticated()
                    || auth instanceof AnonymousAuthenticationToken) {
                return Optional.empty();
            }
            return Optional.of(auth.getName()); // Principal의 username
        };
    }
}
```

`auditorAwareRef`는 `AuditorAware` Bean의 **이름**을 가리킵니다. `@Bean` 메서드 이름 `auditorProvider`가 Bean 이름이 됩니다.

Spring Security를 사용하지 않는 경우에는 ThreadLocal, MDC, 또는 요청 스코프 Bean으로 사용자 정보를 관리하고 `AuditorAware`에서 꺼내면 됩니다.

## BaseEntity 설계

모든 엔티티에 Auditing 애노테이션을 반복 선언하면 중복이 심해집니다. `@MappedSuperclass`로 공통 상위 클래스를 만들고 상속시키는 것이 표준 패턴입니다.

```java
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(updatable = false)  // INSERT 시에만 값을 설정, 이후 변경 금지
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;
}
```

`@Column(updatable = false)`는 `createdAt`과 `createdBy`가 첫 저장 이후 수정되지 않도록 보호합니다. 데이터베이스 레벨에서 업데이트 쿼리의 `SET` 절에 해당 컬럼이 포함되지 않습니다.

비즈니스 엔티티는 `BaseEntity`를 상속하기만 하면 됩니다.

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Post extends BaseEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String content;

    public static Post create(String title, String content) {
        Post post = new Post();
        post.title = title;
        post.content = content;
        return post;
    }
}
```

![BaseEntity · AuditorAware 구현 예시](/assets/posts/spring-jpa-auditing-code.svg)

## 주요 애노테이션

| 애노테이션 | 트리거 | 타입 |
|---|---|---|
| `@CreatedDate` | `@PrePersist` | `LocalDateTime`, `Instant`, `Long` |
| `@LastModifiedDate` | `@PreUpdate` | `LocalDateTime`, `Instant`, `Long` |
| `@CreatedBy` | `@PrePersist` | `AuditorAware<T>`의 `T` |
| `@LastModifiedBy` | `@PreUpdate` | `AuditorAware<T>`의 `T` |

시각 타입은 `LocalDateTime` 외에 `Instant`, `ZonedDateTime`, `Date`, `Long`(epoch millis)도 지원합니다. 타임존 문제가 있는 환경에서는 `Instant`를 사용하는 것이 안전합니다.

## Auditing이 실제로 동작하는 시점

`EntityManager.persist()` 호출 시 `@PrePersist`가 발생해 `createdAt`과 `createdBy`가 채워집니다. `EntityManager.merge()` 또는 더티 체킹에 의한 UPDATE 시에는 `@PreUpdate`가 발생해 `updatedAt`과 `updatedBy`가 갱신됩니다.

```java
// persist — createdAt, createdBy, updatedAt, updatedBy 모두 설정
Post post = Post.create("제목", "본문");
postRepository.save(post); // INSERT

System.out.println(post.getCreatedAt());  // 2026-05-14T10:30:00
System.out.println(post.getCreatedBy()); // "alice"

// merge (더티 체킹) — updatedAt, updatedBy만 갱신
post.updateTitle("수정된 제목");
// 트랜잭션 종료 시 UPDATE 실행
System.out.println(post.getUpdatedAt());  // 2026-05-14T11:00:00
```

`save()` 직후 바로 Auditing 필드를 읽으려면 `@Transactional` 경계 안에 있어야 합니다. 트랜잭션 밖에서 읽으면 `flush()`와 `@PrePersist`가 아직 호출되지 않아 `null`이 반환될 수 있습니다.

## 테스트에서 AuditorAware 처리

`@DataJpaTest`는 Spring Security 컨텍스트가 없기 때문에 `SecurityContextHolder`에서 사용자를 꺼내는 `AuditorAware`가 `Optional.empty()`를 반환합니다. 이 경우 `createdBy`와 `updatedBy`는 `null`로 저장됩니다. 이를 방지하려면 두 가지 방법이 있습니다.

**방법 1 — `@MockBean`으로 대체**

```java
@DataJpaTest
@Import(JpaAuditingConfig.class)
class PostRepositoryTest {

    @MockBean
    AuditorAware<String> auditorProvider;

    @BeforeEach
    void setUp() {
        given(auditorProvider.getCurrentAuditor())
                .willReturn(Optional.of("test-user"));
    }

    @Test
    void audit_fields_are_set() {
        Post post = postRepository.save(Post.create("제목", "내용"));
        assertThat(post.getCreatedBy()).isEqualTo("test-user");
        assertThat(post.getCreatedAt()).isNotNull();
    }
}
```

**방법 2 — `@WithMockUser` + Spring Security 테스트 슬라이스**

```java
@SpringBootTest
@WithMockUser(username = "alice")
class PostServiceTest {

    @Test
    void createPost_sets_createdBy() {
        Post post = postService.createPost("제목", "내용");
        assertThat(post.getCreatedBy()).isEqualTo("alice");
    }
}
```

`@DataJpaTest`에서는 `@Import(JpaAuditingConfig.class)`를 빠뜨리면 `@EnableJpaAuditing`이 활성화되지 않아 Auditing 자체가 동작하지 않습니다.

## BaseEntity 분리 전략

모든 테이블에 `createdBy`/`updatedBy`가 필요하지 않을 수 있습니다. 예를 들어 코드 테이블(공통 코드, 설정값)은 사용자 정보가 의미 없습니다. 이 경우 상위 클래스를 두 단계로 나눕니다.

```java
// 시각만 필요한 엔티티용
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class TimeBaseEntity {
    @CreatedDate @Column(updatable = false)
    private LocalDateTime createdAt;
    @LastModifiedDate
    private LocalDateTime updatedAt;
}

// 시각 + 작성자 모두 필요한 엔티티용
@MappedSuperclass
public abstract class BaseEntity extends TimeBaseEntity {
    @CreatedBy @Column(updatable = false)
    private String createdBy;
    @LastModifiedBy
    private String updatedBy;
}
```

비즈니스 엔티티는 필요한 단계의 상위 클래스를 선택해 상속합니다.

## 정리

- `@EnableJpaAuditing`으로 Auditing 활성화, 별도 `@Configuration`에 분리 권장
- `BaseEntity`에 `@MappedSuperclass` + `@EntityListeners(AuditingEntityListener.class)` 선언
- `@CreatedDate`/`@LastModifiedDate` — JPA 이벤트 기반 시각 자동 기록
- `@CreatedBy`/`@LastModifiedBy` — `AuditorAware<T>.getCurrentAuditor()` 값 주입
- `@Column(updatable = false)` — 생성 관련 필드 수정 방지
- 테스트 시 `@MockBean AuditorAware`로 사용자 주입 또는 `@WithMockUser` 활용

---

**지난 글:** [Spring Data JPA Pageable·Sort 완전 정복](/posts/spring-jpa-pageable-sort/)

**다음 글:** [Spring Boot 4가지 핵심 특징 완전 정복](/posts/springboot-four-features/)

<br>
읽어주셔서 감사합니다. 😊
