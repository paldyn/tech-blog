---
title: "Validation Groups — 상황별 유효성 검증 분리"
description: "Spring Bean Validation에서 Validation Groups를 활용해 Create/Update처럼 서로 다른 요청 상황에 다른 검증 규칙을 적용하는 방법을 다룹니다. 그룹 인터페이스 선언, @Validated 어노테이션, 그룹 상속, GroupSequence를 통한 순서 제어를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "Validation", "BeanValidation", "ValidationGroups", "Validated", "GroupSequence", "DTO검증", "입력검증"]
featured: false
draft: false
---

[지난 글](/posts/spring-mapstruct/)에서 MapStruct로 DTO와 Entity 간 변환을 자동화하는 방법을 살펴봤습니다. 이번에는 그 DTO에서 **입력 유효성 검증을 상황에 따라 다르게 적용하는 방법**, 즉 Validation Groups를 다룹니다. 같은 DTO라도 생성 요청과 수정 요청에서 필요한 검증 규칙이 다를 때, Groups를 쓰면 하나의 DTO 클래스로 두 가지 시나리오를 명확하게 처리할 수 있습니다.

## 문제: Create와 Update에서 검증 규칙 충돌

![Validation Groups — 상황별 검증 규칙 분리](/assets/posts/spring-validation-groups-overview.svg)

사용자 등록 API(`POST /users`)와 수정 API(`PUT /users/{id}`)를 같은 `UserRequest` DTO로 처리한다고 가정합니다.

- **Create**: `id`는 서버가 생성하므로 요청에 없어야 함(`@Null`). `name`은 필수(`@NotBlank`).
- **Update**: `id`는 어떤 사용자를 수정할지 알아야 하므로 필수(`@NotNull`). `name`은 선택.

`@NotBlank(name)`과 `@NotNull(id)`를 동시에 붙이면, Create 요청에서는 id가 없어서 실패하고, Update 요청에서는 name이 없어서 실패합니다. 두 규칙이 서로 충돌합니다.

흔한 해결책은 `UserCreateRequest`와 `UserUpdateRequest`를 별도 클래스로 나누는 것입니다. 이것이 대부분의 경우 더 명확한 설계입니다. 그러나 필드 대부분이 겹치고 검증 규칙만 다를 때는 Validation Groups가 코드 중복을 줄이는 대안입니다.

## 그룹 인터페이스 선언

Validation Groups는 단순한 마커 인터페이스입니다. 아무 내용도 없습니다.

```java
public interface OnCreate {}
public interface OnUpdate {}
```

이 인터페이스들을 별도 파일에 두거나, 관련 DTO 안에 중첩 인터페이스로 선언합니다.

```java
// DTO 안에 중첩 선언
public class UserRequest {
    public interface OnCreate {}
    public interface OnUpdate {}

    @Null(groups = OnCreate.class)
    @NotNull(groups = OnUpdate.class)
    private Long id;

    @NotBlank(groups = OnCreate.class)
    @Size(max = 50)
    private String name;

    @Email   // groups 없음 = Default 그룹 — 항상 검증
    private String email;
}
```

`groups`를 지정하지 않은 제약 조건은 `jakarta.validation.groups.Default` 그룹에 속합니다. `@Validated(OnCreate.class)`를 쓰면 Default 그룹 제약은 실행되지 않습니다. Default도 함께 검증하려면 `{OnCreate.class, Default.class}`를 함께 지정하거나, 그룹 상속을 사용합니다.

## Controller에서 @Validated로 그룹 지정

![@Validated — Controller에서 그룹 지정](/assets/posts/spring-validation-groups-code.svg)

`@Valid` 대신 Spring의 `@Validated`를 사용하면 그룹을 지정할 수 있습니다.

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping
    public ResponseEntity<UserResponse> create(
            @Validated(UserRequest.OnCreate.class) @RequestBody UserRequest req) {
        // OnCreate 그룹 제약만 검증
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> update(
            @PathVariable Long id,
            @Validated(UserRequest.OnUpdate.class) @RequestBody UserRequest req) {
        // OnUpdate 그룹 제약만 검증
        return ResponseEntity.ok(userService.update(id, req));
    }
}
```

`@Validated`는 `@Valid`와 달리 javax.validation이 아니라 `org.springframework.validation.annotation.Validated`입니다. Spring AOP 기반으로 동작하므로 Controller 외에 Service 메서드에도 적용할 수 있습니다.

## 그룹 상속 — Default도 함께 검증

`OnCreate`가 `Default`를 상속하면 `@Validated(OnCreate.class)` 시 Default 그룹 제약도 함께 실행됩니다.

```java
import jakarta.validation.groups.Default;

public interface OnCreate extends Default {}
public interface OnUpdate extends Default {}
```

이렇게 하면 `groups`를 지정하지 않은 `@Email` 같은 제약도 Create/Update 요청에서 항상 검증됩니다.

## GroupSequence — 검증 순서 제어

그룹 간 순서를 정해야 할 때 `@GroupSequence`를 사용합니다. 앞 그룹 검증이 실패하면 뒷 그룹은 검증하지 않습니다.

```java
import jakarta.validation.GroupSequence;
import jakarta.validation.groups.Default;

@GroupSequence({Default.class, ExpensiveChecks.class})
public interface CreateSequence {}

// ExpensiveChecks: DB 조회가 필요한 검증 등 비용이 큰 검증
public interface ExpensiveChecks {}
```

```java
public class UserRequest {
    @NotBlank                               // Default 그룹 — 먼저 검증
    private String email;

    @UniqueEmail(groups = ExpensiveChecks.class)  // DB 중복 체크 — 나중에 검증
    private String email;
}
```

`Default` 그룹이 실패하면 `ExpensiveChecks`는 실행되지 않으므로 불필요한 DB 조회를 줄일 수 있습니다.

## 검증 오류 처리

`@Validated`가 실패하면 `MethodArgumentNotValidException`이 발생합니다. `@ExceptionHandler`로 처리합니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex) {
        List<FieldError> fieldErrors = ex.getBindingResult().getFieldErrors()
                .stream()
                .map(e -> new FieldError(e.getField(), e.getDefaultMessage()))
                .collect(Collectors.toList());

        return ResponseEntity.badRequest()
                .body(new ErrorResponse("VALIDATION_FAILED", fieldErrors));
    }
}
```

## 언제 Groups, 언제 별도 DTO?

| 상황 | 권장 방식 |
|---|---|
| 필드 대부분 겹치고 검증만 다를 때 | Validation Groups |
| Create/Update 요청 구조 자체가 다를 때 | 별도 DTO 클래스 |
| 팀 규모가 크고 가독성이 중요할 때 | 별도 DTO 클래스 |
| 하나의 폼으로 여러 단계 Wizard | GroupSequence |

Validation Groups는 강력하지만 DTO가 하나인데 그룹 분기가 많아지면 읽기 어려워집니다. 필드가 5개 이상 다르거나 팀 코드 리뷰 비용이 높다면 별도 DTO를 선택하는 것이 더 유지보수하기 쉽습니다.

## 정리

Validation Groups를 사용하면 하나의 DTO 클래스에서 Create/Update처럼 서로 다른 요청 상황에 다른 검증 규칙을 적용할 수 있습니다. `@Validated(OnCreate.class)`로 Controller에서 그룹을 지정하고, 그룹 인터페이스를 `Default`에서 상속하면 공통 제약도 함께 검증됩니다. 비용이 큰 검증은 `@GroupSequence`로 순서를 정해 뒤로 미룰 수 있습니다. 단, 그룹 분기가 복잡해지기 시작하면 별도 DTO 분리를 먼저 고려하세요.

---

**지난 글:** [MapStruct — 타입 안전한 객체 매핑 자동화](/posts/spring-mapstruct/)

**다음 글:** [Custom Validator — 커스텀 제약 어노테이션 만들기](/posts/spring-custom-validator/)

<br>
읽어주셔서 감사합니다. 😊
