---
title: "Spring REST API 페이징·필터·정렬 — Pageable과 Page 완전 가이드"
description: "Spring Data의 Pageable 인터페이스로 페이징·필터·정렬을 구현하는 방법을 다룹니다. @PageableDefault 설정, Page vs Slice 선택 기준, Specification으로 동적 필터, 커스텀 응답 DTO 설계, HATEOAS 없이 페이지 메타데이터를 전달하는 실무 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "SpringData", "Pageable", "Page", "Slice", "페이징", "정렬", "JPA", "Specification"]
featured: false
draft: false
---

[지난 글](/posts/spring-rest-http-status/)에서 HTTP 상태 코드를 올바르게 사용하는 방법을 살펴봤습니다. 목록 API를 설계할 때 반드시 고려해야 하는 것이 **페이징**입니다. 전체 데이터를 한 번에 반환하면 DB 부하와 네트워크 비용이 급격히 증가합니다. Spring Data는 `Pageable` 인터페이스를 통해 페이징·정렬·필터를 선언적으로 처리하는 강력한 지원을 제공합니다. 이 글에서는 `Pageable`의 동작 원리부터 실무에서 자주 쓰는 패턴까지 체계적으로 정리합니다.

## Pageable 처리 흐름

HTTP 쿼리 파라미터가 `Pageable` 객체로 자동 변환되고, `Page<T>` 형태의 응답이 반환되는 흐름을 이해하면 각 레이어의 역할이 명확해집니다.

![Pageable 처리 흐름](/assets/posts/spring-rest-paging-filter-sort-flow.svg)

클라이언트는 `?page=0&size=20&sort=name,asc` 형식으로 페이징 조건을 쿼리 파라미터로 보냅니다. Spring MVC의 `PageableHandlerMethodArgumentResolver`가 이 파라미터를 `Pageable` 구현체인 `PageRequest`로 자동 변환합니다. Repository는 `Pageable`을 받아 SQL `LIMIT`/`OFFSET` 쿼리를 생성하고, `Page<T>` 형태로 결과와 메타데이터를 함께 반환합니다.

## Controller — @PageableDefault 설정

`@PageableDefault`로 기본값을 설정하면 클라이언트가 파라미터를 생략했을 때 안전한 기본 동작이 보장됩니다.

![페이징·필터·정렬 구현 코드](/assets/posts/spring-rest-paging-filter-sort-code.svg)

```java
@GetMapping("/users")
public Page<UserDto> listUsers(
        @PageableDefault(size = 20,
                         sort = "createdAt",
                         direction = Sort.Direction.DESC)
        Pageable pageable,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String status) {
    return userService.search(keyword, status, pageable)
                      .map(UserDto::from);
}
```

`@PageableDefault`가 없으면 기본값이 `page=0, size=20, sort=[]`이지만, 정렬 기준이 없으면 DB 구현마다 순서가 달라질 수 있습니다. **항상 정렬 기준을 명시하는 것**을 권장합니다.

HTTP 요청 예시입니다.

```
GET /users?page=0&size=10&sort=name,asc
GET /users?page=2&size=5&sort=createdAt,desc&sort=name,asc
GET /users?keyword=spring&status=ACTIVE&page=0&size=20
```

`sort` 파라미터를 여러 번 사용하면 다중 정렬이 적용됩니다.

## Repository — JpaRepository에서 페이징

`JpaRepository`를 상속하면 별도 구현 없이 `findAll(Pageable)` 메서드가 자동 제공됩니다.

```java
public interface UserRepository extends JpaRepository<User, Long> {
    // 단일 조건 필터 + 페이징
    Page<User> findByStatus(String status, Pageable pageable);

    // 키워드 검색 + 페이징
    Page<User> findByNameContainingIgnoreCase(String keyword, Pageable pageable);

    // 조건 조합 (JPQL)
    @Query("SELECT u FROM User u WHERE " +
           "(:keyword IS NULL OR u.name LIKE %:keyword%) AND " +
           "(:status IS NULL OR u.status = :status)")
    Page<User> searchByKeywordAndStatus(
            @Param("keyword") String keyword,
            @Param("status") String status,
            Pageable pageable);
}
```

## 동적 필터 — Specification 활용

조건이 여러 개이고 동적으로 조합해야 한다면 `JpaSpecificationExecutor`와 `Specification`을 활용합니다.

```java
// Repository에 JpaSpecificationExecutor 추가
public interface UserRepository
        extends JpaRepository<User, Long>,
                JpaSpecificationExecutor<User> { }

// Specification 팩토리 메서드
public class UserSpecification {

    public static Specification<User> hasKeyword(String keyword) {
        return (root, query, cb) ->
            keyword == null ? null :
            cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<User> hasStatus(String status) {
        return (root, query, cb) ->
            status == null ? null :
            cb.equal(root.get("status"), status);
    }
}

// Service에서 조합
public Page<User> search(String keyword, String status, Pageable pageable) {
    Specification<User> spec = Specification
            .where(UserSpecification.hasKeyword(keyword))
            .and(UserSpecification.hasStatus(status));
    return userRepository.findAll(spec, pageable);
}
```

`null`을 반환하는 `Specification`은 조건에서 제외됩니다. 조건이 없으면 전체 조회가 됩니다.

## Page vs Slice — 성능 트레이드오프

`Page<T>`는 전체 건수(`totalElements`)와 전체 페이지 수(`totalPages`)를 알기 위해 `COUNT(*)` 쿼리를 추가로 실행합니다. 데이터가 많을수록 `COUNT` 쿼리가 느려집니다.

`Slice<T>`는 `COUNT` 쿼리를 실행하지 않고 **다음 페이지 존재 여부**만 반환합니다. "더보기" 버튼 방식의 무한 스크롤 UI에 적합합니다.

```java
// Page — 전체 건수 필요할 때 (총 N건, N/20 페이지)
Page<User> findAll(Pageable pageable);

// Slice — 무한 스크롤, "더보기" 방식 (COUNT 쿼리 없음)
Slice<User> findByStatus(String status, Pageable pageable);
```

```java
// Slice 응답 예시 — hasNext로 다음 페이지 존재 여부만 판단
{
  "content": [ ... ],
  "page": 0,
  "size": 20,
  "hasNext": true     // totalPages, totalElements 없음
}
```

## 커스텀 페이징 응답 DTO

Spring Data의 `Page<T>`를 그대로 직렬화하면 `pageable`, `sort` 등 내부 구현 필드까지 노출됩니다. 클라이언트 계약에 필요한 필드만 담은 커스텀 DTO를 사용하는 것이 좋습니다.

```java
// 응답 DTO
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }
}

// Controller에서 변환
@GetMapping("/users")
public PageResponse<UserDto> listUsers(Pageable pageable) {
    Page<User> page = userRepository.findAll(pageable);
    return PageResponse.of(page.map(UserDto::from));
}
```

응답 JSON 예시입니다.

```json
{
  "content": [
    { "id": 1, "name": "김철수", "status": "ACTIVE" },
    { "id": 2, "name": "이영희", "status": "ACTIVE" }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 142,
  "totalPages": 8,
  "first": true,
  "last": false
}
```

## 최대 페이지 크기 제한

클라이언트가 `size=10000` 같은 비정상 값을 보낼 수 있습니다. `PageableHandlerMethodArgumentResolverCustomizer`로 최대 크기를 제한합니다.

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addArgumentResolvers(
            List<HandlerMethodArgumentResolver> resolvers) {
        PageableHandlerMethodArgumentResolver resolver =
                new PageableHandlerMethodArgumentResolver();
        resolver.setMaxPageSize(100);      // 최대 100건
        resolver.setOneIndexedParameters(false); // 0부터 시작 (기본값)
        resolvers.add(resolver);
    }
}
```

또는 Spring Boot 2.7+에서는 `spring.data.web.pageable.max-page-size=100` 프로퍼티로 설정할 수 있습니다.

## 정렬 보안 — 허용 필드 제한

클라이언트가 `sort=password,asc` 같은 민감한 필드로 정렬을 시도할 수 있습니다. 허용 정렬 필드를 화이트리스트로 관리합니다.

```java
// 허용 정렬 필드 검증
private static final Set<String> ALLOWED_SORT_FIELDS =
        Set.of("id", "name", "createdAt", "status");

@GetMapping("/users")
public Page<UserDto> listUsers(Pageable pageable) {
    pageable.getSort().forEach(order -> {
        if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
            throw new IllegalArgumentException(
                    "정렬 불가 필드: " + order.getProperty());
        }
    });
    return userRepository.findAll(pageable).map(UserDto::from);
}
```

다음 글에서는 API가 변경될 때 기존 클라이언트와의 호환성을 유지하는 **REST API 버전 관리** 전략을 다룹니다.

---

**지난 글:** [REST API HTTP 상태 코드 — 언제 무엇을 반환해야 하는가](/posts/spring-rest-http-status/)

**다음 글:** [REST API 버전 관리 — URI·헤더·Content-Type 전략 비교](/posts/spring-rest-versioning/)

<br>
읽어주셔서 감사합니다. 😊
