---
title: "QueryDSL 완전 정복 — 타입 세이프 JPA 쿼리 빌더"
description: "QueryDSL로 타입 안전한 JPA 쿼리를 작성하는 방법을 완전히 이해합니다. Q타입 생성 원리, JPAQueryFactory 설정, BooleanExpression을 활용한 동적 쿼리, Projections를 통한 DTO 조회, fetchJoin과 페이징을 실무 코드와 함께 다룹니다. Spring Boot 3.x / Jakarta EE 환경 기준으로 설정 방법도 포함합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "QueryDSL", "동적쿼리", "BooleanExpression", "JPAQueryFactory", "Q타입", "Hibernate"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-jpql-native/)에서 JPQL의 문법과 패턴을 살펴봤습니다. JPQL은 강력하지만 **동적 쿼리**를 작성할 때 문자열 연결로 인한 오류 발생 가능성이 높습니다. 이번에는 그 한계를 극복하는 **QueryDSL**을 다룹니다.

## QueryDSL이란

QueryDSL은 **타입 안전한 쿼리 빌더 라이브러리**입니다. 컴파일 시점에 오류를 잡아주고, IDE 자동완성을 지원합니다. Spring Data JPA와 함께 복잡한 동적 쿼리를 작성하는 실무 표준으로 자리잡았습니다.

```java
// JPQL: 문자열 — 컬럼명 오타를 런타임에야 발견
String jpql = "SELECT u FROM User u WHERE u.nmae = :name";  // 오타: nmae

// QueryDSL: 컴파일 타임에 오류 검출
QUser u = QUser.user;
queryFactory.selectFrom(u)
            .where(u.name.eq(name))  // name 필드 없으면 컴파일 에러
            .fetch();
```

![QueryDSL 동작 원리](/assets/posts/spring-jpa-querydsl-architecture.svg)

## 설정 — Spring Boot 3.x (Jakarta EE)

```groovy
// build.gradle
dependencies {
    // QueryDSL JPA (jakarta 분류자 필수)
    implementation 'com.querydsl:querydsl-jpa:5.1.0:jakarta'
    annotationProcessor 'com.querydsl:querydsl-apt:5.1.0:jakarta'
    annotationProcessor 'jakarta.persistence:jakarta.persistence-api'
    annotationProcessor 'jakarta.annotation:jakarta.annotation-api'
}

// Q타입 생성 경로 소스셋 등록
sourceSets {
    main.java.srcDirs += ['build/generated/sources/annotationProcessor/java/main']
}
```

`./gradlew compileJava`를 실행하면 `build/generated/...` 경로에 `QUser.java` 같은 Q타입 클래스가 생성됩니다. 이 파일은 `.gitignore`에 추가합니다.

## JPAQueryFactory Bean 등록

```java
@Configuration
public class QuerydslConfig {

    @PersistenceContext
    private EntityManager em;

    @Bean
    public JPAQueryFactory jpaQueryFactory() {
        return new JPAQueryFactory(em);
    }
}
```

`JPAQueryFactory`를 Bean으로 등록해두면 Repository 구현체에서 `@Autowired`로 주입받아 사용할 수 있습니다.

## 기본 쿼리 작성

```java
@Repository
@RequiredArgsConstructor
public class UserQueryRepository {

    private final JPAQueryFactory queryFactory;

    public List<User> findAll() {
        QUser u = QUser.user;  // static import 활용 가능

        return queryFactory
                .selectFrom(u)
                .where(u.status.eq("ACTIVE"))
                .orderBy(u.createdAt.desc())
                .fetch();
    }

    public Optional<User> findByEmail(String email) {
        QUser u = QUser.user;
        return Optional.ofNullable(
                queryFactory.selectFrom(u)
                            .where(u.email.eq(email))
                            .fetchOne());
    }
}
```

`fetch()`는 `List<T>` 반환, `fetchOne()`은 단건(`null` 허용), `fetchFirst()`는 첫 번째 결과를 반환합니다.

## 동적 쿼리 — BooleanExpression

QueryDSL의 가장 강력한 기능입니다. `BooleanExpression`을 반환하는 메서드를 만들고 `where()`에 전달하면, **null인 조건은 자동으로 무시**됩니다.

![QueryDSL 동적 쿼리와 DTO Projection](/assets/posts/spring-jpa-querydsl-dynamic-query.svg)

```java
public List<User> searchUsers(String name, Integer minAge, String status) {
    QUser u = QUser.user;

    return queryFactory
            .selectFrom(u)
            .where(
                nameEq(name),       // null이면 조건 제외
                ageGoe(minAge),     // null이면 조건 제외
                statusEq(status)    // null이면 조건 제외
            )
            .fetch();
}

private BooleanExpression nameEq(String name) {
    return name != null ? QUser.user.name.eq(name) : null;
}

private BooleanExpression ageGoe(Integer minAge) {
    return minAge != null ? QUser.user.age.goe(minAge) : null;
}

private BooleanExpression statusEq(String status) {
    return status != null ? QUser.user.status.eq(status) : null;
}
```

이 패턴의 장점은 각 조건을 **독립적으로 조합**할 수 있다는 것입니다. 조건 메서드를 재사용하거나, `and()`로 체인 연결도 가능합니다.

```java
// 조건 조합 예시
BooleanExpression activeAdult = statusEq("ACTIVE").and(ageGoe(18));
queryFactory.selectFrom(QUser.user).where(activeAdult).fetch();
```

## DTO Projection

엔티티 전체가 아닌 일부 필드만 조회할 때는 `Projections`를 사용합니다.

```java
// 생성자 기반 Projection
public record UserSummaryDto(Long id, String name, String email) {}

public List<UserSummaryDto> findSummaries() {
    QUser u = QUser.user;
    return queryFactory
            .select(Projections.constructor(
                    UserSummaryDto.class,
                    u.id, u.name, u.email))
            .from(u)
            .where(u.status.eq("ACTIVE"))
            .fetch();
}
```

`Projections.constructor`는 DTO 생성자의 파라미터 순서와 Q타입 필드를 매핑합니다. `@QueryProjection` 어노테이션을 DTO 생성자에 추가하면 Q타입이 생성되어 더 타입 안전한 방식으로 사용할 수 있습니다.

## JOIN과 fetchJoin

```java
public List<User> findUsersWithOrders(String status) {
    QUser u = QUser.user;
    QOrder o = QOrder.order;

    return queryFactory
            .selectFrom(u)
            .join(u.orders, o).fetchJoin()  // N+1 해결
            .where(u.status.eq(status))
            .distinct()  // 컬렉션 JOIN 시 중복 제거
            .fetch();
}
```

## 페이징

```java
public Page<User> findPaged(Pageable pageable) {
    QUser u = QUser.user;

    List<User> content = queryFactory
            .selectFrom(u)
            .where(u.status.eq("ACTIVE"))
            .orderBy(u.createdAt.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

    // count 쿼리 분리 (총 개수가 필요한 경우)
    JPAQuery<Long> countQuery = queryFactory
            .select(u.count())
            .from(u)
            .where(u.status.eq("ACTIVE"));

    return PageableExecutionUtils.getPage(content, pageable, countQuery::fetchOne);
}
```

`PageableExecutionUtils.getPage()`를 사용하면 마지막 페이지처럼 count 쿼리가 불필요한 경우 자동으로 생략합니다.

## Custom Repository 패턴과의 결합

실무에서는 Spring Data JPA Repository에 QueryDSL을 결합합니다.

```java
// 1. Custom 인터페이스
public interface UserRepositoryCustom {
    List<User> searchByCondition(String name, Integer minAge);
    Page<UserSummaryDto> findSummaryPaged(Pageable pageable);
}

// 2. QueryDSL 구현체
@RequiredArgsConstructor
public class UserRepositoryCustomImpl implements UserRepositoryCustom {
    private final JPAQueryFactory queryFactory;
    // 위 예시 코드 구현...
}

// 3. 메인 Repository — JPA + QueryDSL 동시 제공
public interface UserRepository
        extends JpaRepository<User, Long>, UserRepositoryCustom {
}
```

이 구조로 기본 CRUD는 `JpaRepository`가, 복잡한 동적 쿼리는 `UserRepositoryCustomImpl`이 담당합니다.

## 정리

- QueryDSL: JPQL을 **타입 안전하게** 빌더 방식으로 작성
- Q타입: APT(Annotation Processing Tool)가 `@Entity`를 분석해 자동 생성
- `JPAQueryFactory` Bean 등록 후 주입받아 사용
- `BooleanExpression` + null 반환 패턴으로 **동적 쿼리** 간결하게 작성
- `Projections.constructor`: DTO 직접 조회
- `fetchJoin()` + `distinct()`: 컬렉션 연관관계 N+1 해결
- `PageableExecutionUtils.getPage()`: 불필요한 count 쿼리 자동 최적화

---

**지난 글:** [JPQL과 Native Query 완전 정복](/posts/spring-jpa-jpql-native/)

**다음 글:** [Spring Data JPA Pageable·Sort 완전 정복](/posts/spring-jpa-pageable-sort/)

<br>
읽어주셔서 감사합니다. 😊
