---
title: "Custom Validator — 커스텀 제약 어노테이션 만들기"
description: "Spring Bean Validation에서 표준 어노테이션으로 처리할 수 없는 비즈니스 규칙을 커스텀 제약 어노테이션으로 구현하는 방법을 다룹니다. @Constraint 어노테이션 선언, ConstraintValidator 구현, 클래스 레벨 제약, Spring Bean 주입, 에러 메시지 커스터마이징까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "CustomValidator", "BeanValidation", "Constraint", "ConstraintValidator", "입력검증", "비즈니스규칙", "클래스레벨검증"]
featured: false
draft: false
---

[지난 글](/posts/spring-validation-groups/)에서 Validation Groups로 상황별 검증 규칙을 분리하는 방법을 살펴봤습니다. `@NotBlank`, `@Email`, `@Min` 같은 표준 어노테이션은 단일 필드의 형식 검증에 강하지만, "전화번호 형식이 010-XXXX-XXXX여야 한다"거나 "이메일이 DB에 이미 존재하면 안 된다"처럼 비즈니스 규칙이 섞인 검증은 직접 만들어야 합니다. Bean Validation은 **커스텀 제약 어노테이션**을 만들 수 있는 확장점을 제공합니다.

## 구성 요소: 어노테이션 + Validator

![Custom Validator 구조](/assets/posts/spring-custom-validator-overview.svg)

커스텀 Validator는 두 부분으로 구성됩니다.

1. **제약 어노테이션**: `@Constraint(validatedBy = ...)` 메타 어노테이션이 붙은 `@interface`
2. **Validator 구현체**: `ConstraintValidator<A, T>` 인터페이스를 구현한 클래스

## 기본 예제: @PhoneNumber

전화번호 형식을 검증하는 커스텀 어노테이션입니다.

### 1단계 — 어노테이션 선언

```java
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = PhoneNumberValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface PhoneNumber {
    String message() default "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

`groups()`와 `payload()`는 Bean Validation 명세에서 요구하는 필수 속성입니다. 빈 배열 기본값으로 선언해두면 됩니다.

### 2단계 — Validator 구현

```java
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PhoneNumberValidator
        implements ConstraintValidator<PhoneNumber, String> {

    private static final String PHONE_PATTERN = "^0\\d{1,2}-\\d{3,4}-\\d{4}$";

    @Override
    public void initialize(PhoneNumber annotation) {
        // 어노테이션 속성 읽기 (필요시)
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) return true;  // null은 @NotNull이 담당
        return value.matches(PHONE_PATTERN);
    }
}
```

`null` 값은 `true`를 반환합니다. null 허용 여부는 `@NotNull`이 담당합니다. Validator는 형식 규칙에만 집중하는 것이 SRP에 맞습니다.

### 3단계 — DTO에 적용

```java
@Getter
@NoArgsConstructor
public class UserRequest {

    @NotBlank
    private String name;

    @PhoneNumber              // 커스텀 어노테이션
    private String phone;

    @Email
    @NotBlank
    private String email;
}
```

## 어노테이션 속성 파라미터화

어노테이션에 속성을 추가하면 규칙을 파라미터화할 수 있습니다.

```java
@Documented
@Constraint(validatedBy = AllowedValuesValidator.class)
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
public @interface AllowedValues {
    String[] values();   // 허용 값 목록을 어노테이션에서 지정
    String message() default "허용되지 않는 값입니다";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

```java
public class AllowedValuesValidator
        implements ConstraintValidator<AllowedValues, String> {

    private Set<String> allowed;

    @Override
    public void initialize(AllowedValues annotation) {
        this.allowed = Set.of(annotation.values());
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext ctx) {
        return value == null || allowed.contains(value);
    }
}
```

```java
// 사용: 허용 상태 값만 입력 가능
@AllowedValues(values = {"ACTIVE", "INACTIVE", "PENDING"})
private String status;
```

## Spring Bean 주입 — DB 연동 Validator

![클래스 레벨 검증 &amp; DB 연동 Validator](/assets/posts/spring-custom-validator-code.svg)

`@Component`로 Validator를 Bean으로 등록하면 `@Autowired`로 Repository 등 다른 Bean을 주입받을 수 있습니다.

```java
@Documented
@Constraint(validatedBy = UniqueEmailValidator.class)
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
public @interface UniqueEmail {
    String message() default "이미 사용 중인 이메일입니다";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

```java
@Component
public class UniqueEmailValidator
        implements ConstraintValidator<UniqueEmail, String> {

    private final UserRepository userRepository;

    public UniqueEmailValidator(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public boolean isValid(String email, ConstraintValidatorContext ctx) {
        if (email == null) return true;
        return !userRepository.existsByEmail(email);
    }
}
```

> **주의**: DB를 조회하는 Validator는 비용이 큽니다. 앞 글의 `GroupSequence`를 활용해 기본 형식 검증이 통과한 후에만 실행되도록 순서를 지정하세요.

## 클래스 레벨 제약 — 필드 간 검증

여러 필드를 조합해야 하는 규칙은 `@Target(TYPE)`으로 클래스 레벨에 붙입니다.

```java
@Documented
@Constraint(validatedBy = PasswordMatchValidator.class)
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface PasswordMatch {
    String message() default "비밀번호가 일치하지 않습니다";
    String passwordField() default "password";
    String confirmField() default "confirmPassword";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

```java
public class PasswordMatchValidator
        implements ConstraintValidator<PasswordMatch, Object> {

    private String passwordField;
    private String confirmField;

    @Override
    public void initialize(PasswordMatch annotation) {
        this.passwordField = annotation.passwordField();
        this.confirmField  = annotation.confirmField();
    }

    @Override
    public boolean isValid(Object obj, ConstraintValidatorContext ctx) {
        try {
            Object pw = new BeanWrapperImpl(obj).getPropertyValue(passwordField);
            Object cf = new BeanWrapperImpl(obj).getPropertyValue(confirmField);

            boolean match = pw != null && pw.equals(cf);
            if (!match) {
                // 특정 필드에 에러 바인딩
                ctx.disableDefaultConstraintViolation();
                ctx.buildConstraintViolationWithTemplate(ctx.getDefaultConstraintMessageTemplate())
                   .addPropertyNode(confirmField)
                   .addConstraintViolation();
            }
            return match;
        } catch (Exception e) {
            return false;
        }
    }
}
```

```java
@PasswordMatch    // 클래스 레벨 어노테이션
@Getter
@NoArgsConstructor
public class SignUpRequest {
    @NotBlank
    private String password;

    @NotBlank
    private String confirmPassword;
}
```

## 메시지 국제화 (i18n)

`message()`에 `{}`로 감싼 키를 지정하면 `ValidationMessages.properties`에서 메시지를 찾습니다.

```java
// @PhoneNumber 어노테이션
String message() default "{validation.phone.invalid}";
```

```properties
# src/main/resources/ValidationMessages.properties
validation.phone.invalid=올바른 전화번호 형식이 아닙니다
```

영문 메시지는 `ValidationMessages_en.properties`에 추가합니다.

## Validator 단위 테스트

```java
@ExtendWith(MockitoExtension.class)
class PhoneNumberValidatorTest {

    private final PhoneNumberValidator validator = new PhoneNumberValidator();
    private final ConstraintValidatorContext ctx = mock(ConstraintValidatorContext.class);

    @Test
    void 유효한_전화번호() {
        assertThat(validator.isValid("010-1234-5678", ctx)).isTrue();
        assertThat(validator.isValid("02-123-4567",   ctx)).isTrue();
    }

    @Test
    void 잘못된_형식() {
        assertThat(validator.isValid("01012345678",  ctx)).isFalse();
        assertThat(validator.isValid("010-12-5678",  ctx)).isFalse();
    }

    @Test
    void null은_valid() {
        assertThat(validator.isValid(null, ctx)).isTrue();
    }
}
```

Validator 로직 자체는 Spring 컨텍스트 없이 단위 테스트할 수 있습니다. DB 연동 Validator는 Repository를 Mock으로 대체합니다.

## 정리

커스텀 Validator는 `@Constraint` 어노테이션 + `ConstraintValidator<A,T>` 구현체 두 부분으로 만듭니다. 단일 필드 형식 검증은 `@Target(FIELD)`, 여러 필드를 비교하는 규칙은 `@Target(TYPE)`으로 클래스 레벨에 붙입니다. Validator를 Spring `@Component`로 등록하면 Repository 같은 Bean을 주입해 DB 연동 검증도 가능합니다. 비용이 큰 DB 조회 Validator는 `GroupSequence`로 뒤로 미뤄 불필요한 쿼리를 줄이세요. 커스텀 어노테이션을 도입하면 검증 로직을 한 곳에 모아 재사용하고, DTO는 선언적으로 읽히게 만들 수 있습니다.

---

**지난 글:** [Validation Groups — 상황별 유효성 검증 분리](/posts/spring-validation-groups/)

<br>
읽어주셔서 감사합니다. 😊
