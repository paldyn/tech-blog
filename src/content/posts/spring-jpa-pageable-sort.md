---
title: "Spring Data JPA Pageable·Sort 완전 정복 — 페이징과 정렬"
description: "Spring Data JPA의 Pageable과 Sort를 사용해 효율적인 페이징과 정렬을 구현하는 방법을 완전히 이해합니다. PageRequest 생성, Page와 Slice의 차이와 선택 기준, @PageableDefault 기본값 설정, 컬렉션 JOIN FETCH와 페이징 충돌 해결, 커서 기반 페이징 전환 시점을 실무 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "Pageable", "Sort", "Pagination", "Page", "Slice", "SpringDataJPA", "PageRequest"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-querydsl/)에서 QueryDSL로 타입 안전한 동적 쿼리를 작성하는 방법을 살펴봤습니다. 이번에는 API 개발에서 항상 필요한 **페이징과 정렬**을 다룹니다. Spring Data JPA의 `Pageable`을 활용하면 단 몇 줄로 페이징·정렬을 처리할 수 있습니다.

## 페이징이 필요한 이유

데이터가 수만 건이 넘는 테이블에서 `SELECT * FROM users`를 실행하면 모든 데이터를 메모리에 올립니다. 이는 OOM(Out of Memory)과 느린 응답 속도를 유발합니다. 페이징은 **한 번에 필요한 양만 조회**해 이 문제를 해결합니다.

```sql
-- 페이징 없는 전체 조회
SELECT * FROM users ORDER BY created_at DESC;  -- 수십만 건 반환

-- 페이징 적용 (1페이지, 10건)
SELECT * FROM users ORDER BY created_at DESC LIMIT 10 OFFSET 0;
```

Spring Data JPA는 `Pageable` 인터페이스 하나로 이 처리를 추상화합니다.

## Pageable 인터페이스와 PageRequest

`Pageable`은 페이지 번호(0-based), 페이지 크기, 정렬 정보를 담는 인터페이스입니다. `PageRequest.of()`로 생성합니다.

```java
// 기본 생성 — 1페이지, 10건
Pageable pageable = PageRequest.of(0, 10);

// 정렬 포함
Pageable pageable2 = PageRequest.of(
        0,   // page: 0이 첫 번째 페이지
        20,  // size: 한 페이지 당 건수
        Sort.by(Sort.Direction.DESC, "createdAt"));

// 여러 필드 정렬 (createdAt 내림차순 → name 오름차순)
Sort multiSort = Sort.by(
        Sort.Order.desc("createdAt"),
        Sort.Order.asc("name"));
Pageable pageable3 = PageRequest.of(0, 20, multiSort);
```

`page`는 **0-based**입니다. UI에서 1페이지를 요청하면 `page=0`으로 변환해야 합니다.

## Repository에서 Pageable 사용

`JpaRepository`를 상속한 Repository에서 `Pageable` 파라미터를 추가하면 자동으로 페이징 쿼리가 실행됩니다.

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // Page<T> — 전체 건수 count 쿼리 포함
    Page<User> findAll(Pageable pageable);

    // 조건 + 페이징
    Page<User> findByStatus(String status, Pageable pageable);

    // Slice<T> — count 쿼리 없음 (무한 스크롤 최적화)
    Slice<User> findByStatus(String status, Pageable pageable);

    // 정렬만 (페이징 없이) — Sort 파라미터 사용
    List<User> findByStatus(String status, Sort sort);
}
```

![Pageable 처리 흐름](/assets/posts/spring-jpa-pageable-sort-flow.svg)

## Page vs Slice — 선택 기준

`Page<T>`와 `Slice<T>`는 모두 페이징 결과를 담지만 중요한 차이가 있습니다.

**Page\<T\>** — 번호 기반 페이징 (게시판, 검색 결과)

```java
Page<User> page = userRepository.findAll(pageable);

page.getContent();         // List<User> — 현재 페이지 데이터
page.getTotalElements();   // 120 — 전체 건수 (count 쿼리 실행)
page.getTotalPages();      // 12 — 전체 페이지 수
page.getNumber();          // 0 — 현재 페이지 번호
page.getSize();            // 10 — 페이지 크기
page.isFirst();            // true
page.isLast();             // false
page.hasNext();            // true
```

**Slice\<T\>** — 무한 스크롤 (모바일 앱, 피드)

```java
Slice<User> slice = userRepository.findByStatus("ACTIVE", pageable);

slice.getContent();   // List<User>
slice.hasNext();      // true/false (size+1 건 조회로 판단)
// getTotalElements(), getTotalPages() 없음 — count 쿼리 미실행
```

`Slice`는 내부적으로 `size + 1`건을 조회해서 다음 페이지 존재 여부만 판단합니다. count 쿼리가 없으므로 **무한 스크롤처럼 "다음이 있는지"만 필요한 경우** 성능 이점이 있습니다.

## REST Controller에서 Pageable 수신

Spring MVC는 `PageableHandlerMethodArgumentResolver`를 통해 HTTP 쿼리 파라미터를 `Pageable` 객체로 자동 변환합니다.

```java
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    // GET /api/users?page=0&size=10&sort=name,desc
    @GetMapping
    public ResponseEntity<Page<UserDto>> getUsers(
            // @PageableDefault: 파라미터 없을 때의 기본값
            @PageableDefault(size = 20, sort = "createdAt",
                             direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ResponseEntity.ok(userService.getUsers(pageable));
    }
}
```

HTTP 요청 예시:
- `GET /api/users` → page=0, size=20, sort=createdAt,DESC (기본값)
- `GET /api/users?page=2&size=5&sort=name,asc` → page=2, size=5, sort=name,ASC
- `GET /api/users?sort=name,asc&sort=createdAt,desc` → 다중 정렬

![Pageable REST API 설계 패턴](/assets/posts/spring-jpa-pageable-sort-code.svg)

## Service 레이어에서 DTO 변환

`Page<Entity>`를 그대로 응답으로 내보내면 불필요한 필드가 노출됩니다. `Page.map()`으로 DTO로 변환합니다.

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public Page<UserDto> getUsers(Pageable pageable) {
        return userRepository.findAll(pageable)
                .map(UserDto::from);  // Page<User> → Page<UserDto>
    }

    // 조건 + 페이징
    public Page<UserDto> searchByStatus(String status, Pageable pageable) {
        return userRepository.findByStatus(status, pageable)
                .map(user -> new UserDto(user.getId(), user.getName()));
    }
}
```

`Page.map()`은 페이징 메타데이터(totalElements, totalPages 등)를 그대로 유지하면서 내용만 변환합니다.

## 실무 주의사항

### 컬렉션 JOIN FETCH + 페이징 충돌

```java
// 위험: 컬렉션(orders)에 JOIN FETCH + 페이징 조합
@Query("SELECT u FROM User u JOIN FETCH u.orders")
Page<User> findAllWithOrders(Pageable pageable);
```

이 경우 Hibernate는 모든 데이터를 메모리에 로딩한 후 애플리케이션 레벨에서 페이징합니다. 데이터가 많을 때 OOM을 유발하고 `HHH90003004` 경고가 출력됩니다.

해결 방법 — 2단계 조회:

```java
// 1단계: ID만 페이징으로 조회
Page<Long> userIdPage = userRepository.findIdsByStatus(status, pageable);

// 2단계: 조회된 ID로 연관관계 포함 일괄 조회 (IN 절)
List<User> users = userRepository.findByIdIn(userIdPage.getContent());

// Page 재조립
return new PageImpl<>(users, pageable, userIdPage.getTotalElements());
```

### 정렬 컬럼 인덱스 확인

페이징 쿼리에서 `ORDER BY` 컬럼에 인덱스가 없으면 전체 정렬이 발생합니다. `page`가 커질수록 `OFFSET` 성능이 저하됩니다.

```sql
-- OFFSET이 클수록 느림 (앞 데이터를 읽고 버림)
SELECT * FROM users ORDER BY created_at DESC LIMIT 10 OFFSET 99990;
```

데이터가 수백만 건이 넘고 깊은 페이지 조회가 잦다면 **커서 기반 페이징**으로 전환을 고려합니다.

```java
// 커서 기반 — 마지막 ID 기준으로 다음 N건 조회
@Query("SELECT u FROM User u WHERE u.id < :lastId ORDER BY u.id DESC")
List<User> findNextPage(
        @Param("lastId") Long lastId,
        Pageable pageable);  // size만 사용
```

## 정리

- `PageRequest.of(page, size, sort)`: 0-based 페이지 번호
- `Page<T>`: count 쿼리 포함, 전체 페이지 수 제공 → 번호 기반 페이징
- `Slice<T>`: count 쿼리 없음, hasNext() 만 → 무한 스크롤
- `@PageableDefault`: 파라미터 미전달 시 기본값 지정
- `Page.map(dto::from)`: 엔티티 → DTO 변환하면서 페이징 메타 유지
- 컬렉션 `JOIN FETCH` + 페이징 금지 — 2-step 쿼리로 해결
- 깊은 OFFSET 성능 이슈는 커서 기반 페이징으로 전환

---

**지난 글:** [QueryDSL 완전 정복](/posts/spring-jpa-querydsl/)

**다음 글:** [Spring Data JPA Auditing 완전 정복](/posts/spring-jpa-auditing/)

<br>
읽어주셔서 감사합니다. 😊
