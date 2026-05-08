---
title: "Spring Validation: @Valid, @Validated, Bean Validation 완전 정복"
description: "Bean Validation 2.0/3.0의 주요 제약 어노테이션, @Valid와 @Validated의 차이, 중첩 객체 검증, 검증 그룹, 커스텀 ConstraintValidator 구현, MethodArgumentNotValidException 처리까지 Spring에서 입력값 검증의 모든 것을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "Validation", "@Valid", "@Validated", "BeanValidation", "ConstraintValidator", "BindingResult", "HibernateValidator", "입력검증"]
featured: false
draft: false
---

[지난 글](/posts/spring-restcontroller/)에서 `@RestController`와 `ResponseEntity`로 HTTP 응답을 제어하는 방법을 살펴봤습니다. API를 설계하면 반드시 따라오는 과제가 **입력값 검증**입니다. 클라이언트가 보내는 데이터를 신뢰할 수 없으므로, 비즈니스 로직에 진입하기 전에 반드시 걸러야 합니다. Spring은 **Bean Validation** 표준을 기반으로 이 작업을 선언적으로 처리하는 강력한 지원을 제공합니다.

## Bean Validation이란

Bean Validation(Jakarta Bean Validation)은 Java 객체의 필드 제약 조건을 어노테이션으로 표현하는 표준 명세(JSR-303 → JSR-380)입니다. Spring Boot는 `spring-boot-starter-validation`을 통해 **Hibernate Validator** 구현체를 자동으로 포함합니다.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

의존성 하나만 추가하면 어노테이션 기반 검증 인프라가 갖춰집니다.

## 요청 DTO에 제약 어노테이션 선언

```java
public class CreateUserRequest {

    @NotBlank(message = "이름은 필수입니다")
    @Size(min = 2, max = 50, message = "이름은 2~50자여야 합니다")
    private String name;

    @NotBlank
    @Email(message = "올바른 이메일 형식이 아닙니다")
    private String email;

    @NotNull
    @Min(value = 0, message = "나이는 0 이상이어야 합니다")
    @Max(value = 150, message = "나이는 150 이하여야 합니다")
    private Integer age;

    @NotBlank
    @Pattern(regexp = "^010-\\d{4}-\\d{4}$",
             message = "전화번호 형식: 010-0000-0000")
    private String phone;

    // getter / setter 또는 record
}
```

![Bean Validation 처리 흐름](/assets/posts/spring-validation-basics-flow.svg)

## @Valid로 컨트롤러 검증 활성화

컨트롤러 파라미터 앞에 `@Valid` 또는 `@Validated`를 붙이면 Spring이 자동으로 검증을 실행합니다.

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @PostMapping
    public ResponseEntity<UserDto> createUser(
            @Valid @RequestBody CreateUserRequest request) {
        // 이 줄에 도달하면 request는 이미 검증 통과
        UserDto saved = userService.create(request);
        URI location = buildUri(saved.getId());
        return ResponseEntity.created(location).body(saved);
    }
}
```

검증 실패 시 Spring은 `MethodArgumentNotValidException`을 던지고 기본적으로 **400 Bad Request**를 반환합니다. 이 예외는 `@ExceptionHandler`로 가로채 구조화된 오류 응답을 만들 수 있습니다(다음 글에서 다룹니다).

## 검증 실패 응답 직접 처리: BindingResult

REST API에서는 예외 처리 방식이 일반적이지만, 전통적인 MVC 뷰 컨트롤러에서는 `BindingResult`를 파라미터로 선언해 오류를 직접 처리할 수 있습니다.

```java
@PostMapping("/form")
public String submitForm(
        @Valid @ModelAttribute UserForm form,
        BindingResult bindingResult) {   // @Valid 파라미터 바로 다음에 선언
    if (bindingResult.hasErrors()) {
        return "user/form";   // 오류 있으면 폼 재렌더링
    }
    userService.save(form);
    return "redirect:/users";
}
```

`BindingResult`는 반드시 검증 대상 파라미터 **바로 다음**에 선언해야 합니다. 그 위치가 달라지면 예외가 발생합니다.

## @Valid vs @Validated

![Bean Validation 주요 어노테이션](/assets/posts/spring-validation-basics-annotations.svg)

`@Valid`는 Bean Validation 표준 어노테이션이고, `@Validated`는 Spring이 제공하는 확장 어노테이션입니다. 핵심 차이는 **검증 그룹** 지원입니다.

```java
// 검증 그룹 인터페이스 정의
public interface OnCreate {}
public interface OnUpdate {}

public class UserRequest {

    @Null(groups = OnCreate.class)        // 생성 시 null
    @NotNull(groups = OnUpdate.class)     // 수정 시 필수
    private Long id;

    @NotBlank(groups = {OnCreate.class, OnUpdate.class})
    private String name;
}

@RestController
public class UserController {

    @PostMapping
    public ResponseEntity<UserDto> create(
            @Validated(OnCreate.class) @RequestBody UserRequest req) { ... }

    @PutMapping("/{id}")
    public ResponseEntity<UserDto> update(
            @Validated(OnUpdate.class) @RequestBody UserRequest req) { ... }
}
```

생성과 수정에서 서로 다른 검증 규칙을 적용해야 할 때 그룹이 유용합니다. 그룹 없이 사용하면 `@Valid`와 동작이 동일합니다.

## 중첩 객체 검증

DTO 안에 중첩 객체가 있으면 `@Valid`를 해당 필드에 추가해야 재귀 검증이 동작합니다.

```java
public class OrderRequest {

    @NotNull
    @Valid   // ShippingInfo 내부 필드도 검증
    private ShippingInfo shippingInfo;

    @NotEmpty
    @Valid   // 컬렉션 각 원소 검증
    private List<OrderItemRequest> items;
}

public class ShippingInfo {

    @NotBlank
    private String address;

    @NotBlank
    @Pattern(regexp = "^\\d{5}$")
    private String zipCode;
}
```

`@Valid`를 빠뜨리면 중첩 객체의 필드 제약이 무시됩니다.

## 커스텀 ConstraintValidator

표준 어노테이션으로 표현할 수 없는 도메인 규칙은 커스텀 제약으로 캡슐화합니다.

```java
// 1. 어노테이션 정의
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PhoneNumberValidator.class)
public @interface ValidPhoneNumber {
    String message() default "올바른 국내 전화번호 형식이 아닙니다";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// 2. 검증 로직 구현
public class PhoneNumberValidator
        implements ConstraintValidator<ValidPhoneNumber, String> {

    private static final Pattern PATTERN =
            Pattern.compile("^0\\d{1,2}-\\d{3,4}-\\d{4}$");

    @Override
    public boolean isValid(String value,
                           ConstraintValidatorContext context) {
        if (value == null) return true;  // @NotNull이 null 처리
        return PATTERN.matcher(value).matches();
    }
}

// 3. 사용
public class ContactRequest {

    @ValidPhoneNumber
    private String phone;
}
```

`ConstraintValidator` 구현체는 Spring 빈으로 등록할 수 있어 DI를 통해 서비스나 리포지터리를 주입받아 DB 조회 같은 로직도 실행할 수 있습니다.

## 서비스 레이어 검증: @Validated + AOP

컨트롤러를 거치지 않는 서비스 메서드에도 검증을 적용하려면 클래스에 `@Validated`를 선언합니다.

```java
@Service
@Validated   // AOP 프록시가 메서드 파라미터 검증
public class UserService {

    public UserDto create(@Valid CreateUserRequest request) {
        // request 검증 통과 보장
        return userRepository.save(request.toEntity());
    }
}
```

이 경우 검증 실패 시 `ConstraintViolationException`이 발생합니다(컨트롤러의 `MethodArgumentNotValidException`과 다릅니다). 두 예외를 모두 처리하는 전역 핸들러를 구성해야 일관된 오류 응답을 만들 수 있습니다.

## 오류 메시지 국제화

`src/main/resources/ValidationMessages.properties` 파일을 생성하면 어노테이션의 `message` 속성에서 키를 참조할 수 있습니다.

```properties
# ValidationMessages.properties
user.name.notblank=이름은 필수입니다
user.email.invalid=올바른 이메일 형식이 아닙니다
```

```java
@NotBlank(message = "{user.name.notblank}")
private String name;
```

## 정리

- Bean Validation은 DTO 필드에 어노테이션으로 제약을 선언하는 표준 명세
- `@Valid`: 표준, 그룹 불가 / `@Validated`: Spring 확장, 그룹 지원
- 중첩 객체 검증은 필드에 `@Valid` 추가 필요
- 검증 실패 → `MethodArgumentNotValidException` (컨트롤러) / `ConstraintViolationException` (서비스)
- 재사용 가능한 도메인 규칙은 커스텀 `ConstraintValidator`로 캡슐화

---

**지난 글:** [Spring @RestController 완전 정복: @Controller와 차이, ResponseEntity 활용법](/posts/spring-restcontroller/)

**다음 글:** [Spring 예외 처리 완전 정복: @ExceptionHandler, @ControllerAdvice, RFC 7807](/posts/spring-exception-handler/)

<br>
읽어주셔서 감사합니다. 😊
