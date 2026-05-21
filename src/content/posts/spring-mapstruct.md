---
title: "MapStruct — 타입 안전한 객체 매핑 자동화"
description: "Spring 프로젝트에서 MapStruct를 사용해 DTO와 Entity 간 변환 코드를 자동 생성하는 방법을 다룹니다. 기본 Mapper 인터페이스, @Mapping으로 필드 이름 매핑, @Named 커스텀 변환, uses를 활용한 Mapper 재사용, Lombok 통합 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "MapStruct", "DTO", "Entity", "객체매핑", "코드생성", "어노테이션프로세서", "Lombok통합"]
featured: false
draft: false
---

[지난 글](/posts/spring-dto-entity-pattern/)에서 DTO와 Entity를 분리해야 하는 이유와 수동 변환 패턴을 살펴봤습니다. 필드가 적을 때는 `UserResponse.from(user)` 같은 정적 팩토리로 충분하지만, 도메인 모델이 복잡해지면 변환 코드가 수백 줄의 보일러플레이트로 불어납니다. **MapStruct**는 이 문제를 컴파일 타임 코드 생성으로 해결합니다. 인터페이스만 선언하면 APT(Annotation Processing Tool)가 구현 클래스를 자동 생성합니다.

## MapStruct란

![MapStruct — 컴파일 타임 객체 매핑](/assets/posts/spring-mapstruct-overview.svg)

MapStruct는 **컴파일 타임에 매핑 구현 코드를 생성**하는 Java 라이브러리입니다. 런타임 리플렉션을 사용하는 ModelMapper와 달리, 빌드 시 `UserMapperImpl.java` 같은 실제 Java 파일을 만들어냅니다. 덕분에 런타임 오버헤드가 없고, 생성된 코드를 직접 읽고 디버깅할 수 있습니다.

### 의존성 설정

Gradle을 사용할 때 Lombok과 함께 쓰는 경우 선언 순서가 중요합니다.

```groovy
// build.gradle
dependencies {
    implementation 'org.mapstruct:mapstruct:1.5.5.Final'

    // Lombok과 함께 쓸 때: lombok 프로세서를 MapStruct보다 먼저 선언
    annotationProcessor 'org.projectlombok:lombok'
    annotationProcessor 'org.mapstruct:mapstruct-processor:1.5.5.Final'
}
```

Maven이라면 `maven-compiler-plugin`의 `annotationProcessorPaths`에 같은 순서로 추가합니다.

## 기본 Mapper

가장 간단한 형태입니다. 소스와 타겟의 필드 이름이 같으면 어노테이션 없이 자동 매핑됩니다.

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserResponse toResponse(User user);
    User toEntity(UserCreateRequest req);
    List<UserResponse> toResponseList(List<User> users);
}
```

`componentModel = "spring"`으로 설정하면 `UserMapperImpl`이 Spring Bean으로 등록됩니다. Service에서 `@Autowired`(또는 생성자 주입)로 사용할 수 있습니다.

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Transactional(readOnly = true)
    public UserResponse getUser(Long id) {
        User user = userRepository.findById(id).orElseThrow();
        return userMapper.toResponse(user);
    }
}
```

## @Mapping — 필드 이름이 다를 때

![MapStruct 고급 매핑 패턴](/assets/posts/spring-mapstruct-code.svg)

소스와 타겟의 필드 이름이 다를 때 `@Mapping`으로 명시합니다.

```java
@Mapper(componentModel = "spring")
public interface OrderMapper {

    @Mapping(source = "product.name", target = "productName")
    @Mapping(source = "user.id",      target = "userId")
    @Mapping(source = "createdAt",    target = "orderDate")
    @Mapping(target = "status",       constant = "PENDING")  // 상수 주입
    @Mapping(target = "updatedAt",    ignore = true)         // 무시
    OrderResponse toResponse(Order order);
}
```

중첩 객체 필드는 `.`으로 접근합니다(`product.name`). `constant`로 고정값을 주입하거나, `ignore = true`로 특정 필드를 건너뛸 수 있습니다.

## @Named — 커스텀 변환 로직

단순 필드 복사가 아니라 변환 로직이 필요할 때 `@Named`를 사용합니다.

```java
@Mapper(componentModel = "spring")
public abstract class ProductMapper {

    @Mapping(target = "priceDisplay", qualifiedByName = "formatPrice")
    @Mapping(target = "categoryName", qualifiedByName = "upperCase")
    public abstract ProductResponse toResponse(Product product);

    @Named("formatPrice")
    protected String formatPrice(int price) {
        return "₩" + String.format("%,d", price);
    }

    @Named("upperCase")
    protected String toUpperCase(String value) {
        return value == null ? null : value.toUpperCase();
    }
}
```

커스텀 로직이 있을 때는 `interface` 대신 `abstract class`를 사용하고, 변환 메서드를 `protected`로 선언합니다.

## uses — 다른 Mapper 재사용

복잡한 객체 그래프를 매핑할 때 Mapper를 조합합니다.

```java
@Mapper(componentModel = "spring")
public interface AddressMapper {
    AddressDto toDto(Address address);
}

@Mapper(componentModel = "spring", uses = {AddressMapper.class})
public interface CustomerMapper {
    // Address → AddressDto 변환은 AddressMapper에 위임
    CustomerResponse toResponse(Customer customer);
}
```

`uses`에 등록된 Mapper는 MapStruct가 타입을 자동으로 연결해줍니다.

## 업데이트 매핑 (@MappingTarget)

기존 객체의 필드를 업데이트할 때 `@MappingTarget`을 사용합니다.

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserResponse toResponse(User user);

    // 기존 엔티티에 DTO 값을 덮어씀 (null 필드는 무시)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateFromRequest(UserUpdateRequest request, @MappingTarget User user);
}
```

```java
@Transactional
public UserResponse updateUser(Long id, UserUpdateRequest req) {
    User user = userRepository.findById(id).orElseThrow();
    userMapper.updateFromRequest(req, user);  // null 필드는 유지
    return userMapper.toResponse(user);
}
```

`NullValuePropertyMappingStrategy.IGNORE`를 설정하면 null 필드는 기존 값을 그대로 둡니다. PATCH 시맨틱 구현에 유용합니다.

## Lombok 통합 주의사항

Lombok과 MapStruct를 함께 쓸 때 발생하는 가장 흔한 문제는 APT 처리 순서입니다. MapStruct 프로세서가 먼저 실행되면 Lombok이 생성하는 getter/setter/builder를 아직 인식하지 못해 매핑이 실패합니다.

해결책:
- Gradle: `annotationProcessor` 선언에서 lombok을 mapstruct-processor보다 먼저 선언
- Maven: `maven-compiler-plugin`의 `annotationProcessorPaths`에서 lombok을 먼저 선언
- IntelliJ: Settings → Build Tools → Gradle → "Build and run using: IntelliJ IDEA" 대신 Gradle 유지

## 생성된 코드 확인

MapStruct가 무엇을 만들었는지 확인하려면 `build/generated/sources/annotationProcessor/java/main/` 아래에서 `UserMapperImpl.java`를 찾으면 됩니다.

```java
// 자동 생성된 UserMapperImpl (읽기 전용 참고)
@Component
public class UserMapperImpl implements UserMapper {
    @Override
    public UserResponse toResponse(User user) {
        if (user == null) return null;
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .build();
    }
}
```

생성 코드를 보면 매핑이 어떻게 이루어지는지 정확히 알 수 있습니다.

## ModelMapper와 비교

| 항목 | MapStruct | ModelMapper |
|---|---|---|
| 코드 생성 시점 | 컴파일 타임 | 런타임 |
| 리플렉션 사용 | 없음 | 있음 |
| 성능 | 직접 getter/setter 호출 수준 | 리플렉션 오버헤드 |
| 타입 안전 | 컴파일 오류 즉시 감지 | 런타임에서야 오류 발견 |
| 설정 방식 | 어노테이션 기반 | 코드 기반 TypeMap |

## 정리

MapStruct는 DTO/Entity 변환 보일러플레이트를 컴파일 타임 코드 생성으로 제거합니다. 인터페이스에 매핑 메서드를 선언하면 APT가 타입 안전한 구현 클래스를 자동으로 만들어주므로, 필드 이름을 바꾸거나 타입이 맞지 않을 때 컴파일 에러로 즉시 알 수 있습니다. 기본 필드 복사는 어노테이션 없이, 이름이 다른 필드는 `@Mapping`, 커스텀 변환은 `@Named`, PATCH 업데이트는 `@MappingTarget`으로 처리합니다. Lombok과 함께 쓸 때 APT 순서를 꼭 확인하세요.

---

**지난 글:** [DTO와 Entity 패턴 — 계층 간 데이터 분리 설계](/posts/spring-dto-entity-pattern/)

**다음 글:** [Validation Groups — 상황별 유효성 검증 분리](/posts/spring-validation-groups/)

<br>
읽어주셔서 감사합니다. 😊
