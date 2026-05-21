---
title: "DTO와 Entity 패턴 — 계층 간 데이터 분리 설계"
description: "Spring 애플리케이션에서 DTO(Data Transfer Object)와 Entity를 분리해야 하는 이유와 실전 설계 패턴을 다룹니다. RequestDTO·ResponseDTO·Entity의 역할 구분, 변환 로직 위치, 설계 안티패턴, 레이어드 아키텍처에서의 데이터 흐름을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "DTO", "Entity", "레이어드아키텍처", "데이터변환", "RequestDTO", "ResponseDTO", "설계패턴", "클린아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/spring-jackson-deepdive/)에서 Jackson이 Java 객체와 JSON 사이를 어떻게 변환하는지 살펴봤습니다. 이번에는 그 객체 자체를 어떻게 설계해야 하는지, 즉 **DTO와 Entity를 왜 분리하는지, 어떻게 변환하는지**를 다룹니다. 실무에서 Entity를 그대로 API 응답으로 내보내다가 생기는 문제들은 매우 흔합니다. DTO/Entity 분리 패턴을 이해하면 그 문제들을 구조적으로 예방할 수 있습니다.

## DTO와 Entity의 역할

![DTO ↔ Entity 패턴 — 계층별 역할 분리](/assets/posts/spring-dto-entity-pattern-overview.svg)

**Entity**는 도메인 모델입니다. JPA가 관리하는 영속성 객체로, 데이터베이스 테이블과 1:1로 매핑됩니다. 비즈니스 불변식과 도메인 로직을 포함하며, `passwordHash`, `createdAt`, `deletedAt` 같은 내부 관리 필드도 포함합니다.

**DTO(Data Transfer Object)**는 계층 간 데이터 전달 전용 객체입니다. 외부에 노출할 필드만 선택적으로 담고, 입력 검증 어노테이션(`@NotBlank`, `@Email` 등)을 붙입니다. 크게 두 종류로 나뉩니다.

- **RequestDTO**: 클라이언트 입력을 수신. 유효성 검증 어노테이션 포함
- **ResponseDTO**: 클라이언트에 반환하는 응답. 필요한 필드만 선택

## Entity를 직접 노출하면 생기는 문제

Entity를 `@ResponseBody`로 그대로 반환하면 여러 문제가 발생합니다.

**1. 민감 정보 노출**

```java
// 위험: passwordHash, 내부 상태 필드가 JSON으로 노출
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) {
    return userRepository.findById(id).orElseThrow();
}
```

**2. 양방향 연관관계 무한 순환**

```java
@Entity
public class Order {
    @ManyToOne
    User user;       // User → Order → User → ... StackOverflowError
}
```

**3. 지연 로딩(Lazy Loading) 예외**

트랜잭션이 닫힌 뒤 Jackson이 지연 로딩 컬렉션을 직렬화하려 할 때 `LazyInitializationException`이 발생합니다.

**4. API 계약 결합**

Entity 필드명을 바꾸면 API 응답 JSON이 즉시 변경됩니다. Entity 내부 구현 변경이 외부 API 스펙 변경으로 전파됩니다.

## 변환 패턴 실전

![DTO/Entity 변환 패턴](/assets/posts/spring-dto-entity-pattern-code.svg)

변환 로직을 어디에 두느냐에 따라 세 가지 패턴이 있습니다.

### 패턴 1: DTO 내부 정적 팩토리 메서드

```java
@Getter
@Builder
public class UserResponse {
    private Long id;
    private String name;
    private String email;

    public static UserResponse from(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .build();
    }
}
```

`from(entity)` 정적 메서드를 DTO 안에 두면, 호출부가 `UserResponse.from(user)`로 명확합니다. DTO가 Entity에 의존하므로 단방향 의존성이 유지됩니다(Entity → DTO 방향이 아닌, DTO가 Entity를 참조).

### 패턴 2: Entity 내부 변환 메서드

```java
@Entity
public class User {
    // ...
    public UserResponse toResponse() {
        return UserResponse.builder()
                .id(this.id)
                .name(this.name)
                .email(this.email)
                .build();
    }
}
```

Entity가 DTO를 알게 되므로, 도메인 레이어가 프레젠테이션 레이어에 의존하는 역전이 생깁니다. 일반적으로 권장하지 않습니다.

### 패턴 3: Service에서 직접 변환

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    @Transactional
    public UserResponse createUser(UserCreateRequest req) {
        User user = User.builder()
                .name(req.getName())
                .email(req.getEmail())
                .age(req.getAge())
                .build();
        User saved = userRepository.save(user);
        return UserResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public UserResponse getUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + id));
        return UserResponse.from(user);
    }
}
```

Service가 변환 책임을 갖습니다. 단순한 프로젝트에서는 이 방식이 직관적이지만, 변환 로직이 복잡해지면 MapStruct나 별도 Mapper 클래스를 도입합니다.

## RequestDTO 설계

RequestDTO는 입력 유효성 검증 어노테이션을 포함합니다.

```java
@Getter
@NoArgsConstructor
public class UserCreateRequest {

    @NotBlank(message = "이름은 필수입니다")
    @Size(min = 2, max = 50)
    private String name;

    @NotBlank
    @Email(message = "올바른 이메일 형식이 아닙니다")
    private String email;

    @Min(value = 0, message = "나이는 0 이상이어야 합니다")
    @Max(value = 150)
    private int age;
}
```

Controller에서 `@Valid`를 붙이면 Bean Validation이 자동으로 적용됩니다.

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @PostMapping
    public ResponseEntity<UserResponse> create(@Valid @RequestBody UserCreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userService.createUser(req));
    }

    @GetMapping("/{id}")
    public UserResponse get(@PathVariable Long id) {
        return userService.getUser(id);
    }
}
```

## 업데이트용 DTO 분리

Create / Update 요청을 별도 DTO로 분리하는 것이 좋습니다.

```java
// 생성 요청: 모든 필드 필수
public class UserCreateRequest { /* name, email, age — @NotBlank 등 */ }

// 수정 요청: 일부 필드만 변경 가능 (null이면 변경하지 않음)
public class UserUpdateRequest {
    @Size(min = 2, max = 50)
    private String name;   // null 허용 — 변경 원할 때만 포함

    @Min(0)
    private Integer age;   // int 대신 Integer (null 구분 가능)
}
```

PATCH 시맨틱은 null 필드를 무시하는 방식으로 구현합니다.

```java
@Transactional
public UserResponse updateUser(Long id, UserUpdateRequest req) {
    User user = userRepository.findById(id).orElseThrow();
    if (req.getName() != null) user.updateName(req.getName());
    if (req.getAge() != null)  user.updateAge(req.getAge());
    return UserResponse.from(user);
}
```

## 안티패턴

| 안티패턴 | 문제 |
|---|---|
| Entity를 API 응답으로 직접 반환 | 민감 필드 노출, 무한 순환, LazyInit 예외 |
| Entity에 `@JsonIgnore` 남발 | 도메인에 프레젠테이션 관심사 침투 |
| 하나의 DTO를 Create/Update 겸용 | 필드 null 처리 복잡, 검증 어노테이션 충돌 |
| DTO에 비즈니스 로직 포함 | DTO 비대화, 테스트 어려움 |

## 정리

DTO와 Entity를 분리하면 레이어 간 결합을 낮추고 각 객체가 한 가지 책임만 갖도록 설계할 수 있습니다. RequestDTO는 외부 입력 수신과 검증에, ResponseDTO는 출력 필드 제어에, Entity는 도메인 로직과 영속성에 집중합니다. 변환 로직은 `ResponseDTO.from(entity)` 정적 팩토리 패턴이 가장 일반적이며, 변환 코드가 반복·복잡해질 때는 다음 글에서 다룰 MapStruct를 도입하면 보일러플레이트를 대폭 줄일 수 있습니다.

---

**다음 글:** [MapStruct — 타입 안전한 객체 매핑 자동화](/posts/spring-mapstruct/)

<br>
읽어주셔서 감사합니다. 😊
