---
title: "Spring Data JPA Repository 완전 정복 — JpaRepository부터 커스텀 쿼리까지"
description: "Spring Data JPA의 Repository 인터페이스 계층 구조를 완전히 이해합니다. Repository·CrudRepository·JpaRepository의 차이, 쿼리 메서드 명명 규칙, @Query 어노테이션을 통한 JPQL·네이티브 쿼리, @Modifying과 벌크 업데이트, Custom Repository 구현 패턴을 실무 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "SpringDataJPA", "Repository", "JpaRepository", "쿼리메서드", "JPQL", "Hibernate"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-inheritance-mapping/)에서 JPA 상속 매핑 전략을 살펴봤습니다. 이번에는 실제 개발에서 가장 많이 마주치는 **Spring Data JPA Repository**를 다룹니다. JPA의 EntityManager를 직접 다루는 대신, Repository 인터페이스 하나만 선언해도 CRUD 메서드가 자동 제공됩니다.

## Repository 계층 구조

Spring Data JPA는 `Repository` 인터페이스를 최상위로 하는 계층 구조를 제공합니다. 하위 인터페이스를 상속할수록 더 풍부한 메서드를 사용할 수 있습니다.

![Spring Data JPA Repository 계층 구조](/assets/posts/spring-data-jpa-repository-hierarchy.svg)

| 인터페이스 | 제공 기능 |
|---|---|
| `Repository<T, ID>` | 마커 인터페이스 — 메서드 없음 |
| `CrudRepository<T, ID>` | save, findById, findAll, delete, count, existsById |
| `ListCrudRepository<T, ID>` | CrudRepository + List 반환 메서드 (Spring Data 3.0+) |
| `PagingAndSortingRepository<T, ID>` | findAll(Sort), findAll(Pageable) |
| `JpaRepository<T, ID>` | 위 전부 + flush, saveAndFlush, deleteAllInBatch |

실무에서는 대부분 **`JpaRepository`** 를 직접 상속합니다. 가장 많은 기능을 제공하면서도 선언이 간단하기 때문입니다.

```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // 빈 인터페이스만으로 기본 CRUD 완성
}
```

```java
// 사용 예시
userRepository.save(new User("hong", "hong@example.com"));  // INSERT/UPDATE
userRepository.findById(1L);                                // SELECT ... WHERE id = ?
userRepository.findAll();                                   // SELECT * FROM users
userRepository.deleteById(1L);                              // DELETE WHERE id = ?
userRepository.count();                                     // SELECT count(*) FROM users
```

## 쿼리 메서드 명명 규칙

Spring Data JPA의 핵심 기능 중 하나는 **메서드 이름으로 쿼리를 자동 생성**하는 것입니다. 규칙에 맞게 메서드 이름을 작성하면, Spring이 파싱해서 JPQL을 생성합니다.

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // WHERE name = :name
    List<User> findByName(String name);

    // WHERE email = :email (결과가 없으면 Optional.empty())
    Optional<User> findByEmail(String email);

    // WHERE age > :age AND status = :status
    List<User> findByAgeGreaterThanAndStatus(int age, String status);

    // WHERE name LIKE '%:name%'
    List<User> findByNameContaining(String name);

    // WHERE created_at BETWEEN :start AND :end ORDER BY created_at DESC
    List<User> findByCreatedAtBetweenOrderByCreatedAtDesc(
            LocalDateTime start, LocalDateTime end);

    // SELECT count(*) WHERE status = :status
    long countByStatus(String status);

    // DELETE WHERE status = :status
    void deleteByStatus(String status);
}
```

![쿼리 메서드 명명 규칙과 @Query](/assets/posts/spring-data-jpa-repository-query-methods.svg)

메서드 이름이 너무 길어지면 오히려 가독성이 나빠집니다. 3개 이상의 조건을 조합해야 할 때는 `@Query`를 사용하는 편이 낫습니다.

## @Query — JPQL 직접 지정

`@Query` 어노테이션으로 JPQL 또는 Native SQL을 직접 작성할 수 있습니다.

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // JPQL (엔티티 클래스명과 필드명 사용 — 테이블명·컬럼명 아님)
    @Query("SELECT u FROM User u WHERE u.status = :status AND u.age >= :minAge")
    List<User> findActiveOldUsers(
            @Param("status") String status,
            @Param("minAge") int minAge);

    // 위치 기반 파라미터 (권장하지 않음 — 순서 의존)
    @Query("SELECT u FROM User u WHERE u.name = ?1 AND u.email = ?2")
    Optional<User> findByNameAndEmail(String name, String email);

    // Native SQL (실제 테이블명·컬럼명 사용)
    @Query(value = "SELECT * FROM users WHERE status = :status LIMIT :limit",
           nativeQuery = true)
    List<User> findByStatusNative(
            @Param("status") String status,
            @Param("limit") int limit);
}
```

JPQL은 **엔티티 클래스명**과 **필드명**을 사용합니다. 테이블명이나 컬럼명이 다르더라도 항상 자바 필드 이름으로 작성해야 합니다.

## @Modifying — 벌크 업데이트·삭제

`SELECT` 가 아닌 `UPDATE`, `DELETE` 쿼리는 `@Modifying`을 추가해야 합니다.

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // 벌크 업데이트 (영속성 컨텍스트 우회 — flush/clear 필요)
    @Modifying
    @Query("UPDATE User u SET u.status = :newStatus WHERE u.status = :oldStatus")
    int bulkUpdateStatus(
            @Param("oldStatus") String oldStatus,
            @Param("newStatus") String newStatus);

    // 영속성 컨텍스트와 DB 상태 불일치를 방지하려면:
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM User u WHERE u.createdAt < :cutoff")
    int deleteOldUsers(@Param("cutoff") LocalDateTime cutoff);
}
```

`@Modifying`만으로는 부족합니다. 벌크 쿼리는 영속성 컨텍스트를 우회해 DB에 직접 반영되므로, 이후 같은 엔티티를 조회하면 **캐시된 이전 값**을 돌려줄 수 있습니다. `clearAutomatically = true` 옵션을 사용하거나, 서비스 레이어에서 벌크 연산 후 `EntityManager.clear()`를 호출해 1차 캐시를 비워야 합니다.

## Custom Repository 구현

기본 CRUD와 @Query만으로 해결하기 어려운 복잡한 쿼리는 **Custom Repository** 패턴을 사용합니다.

```java
// 1. 커스텀 인터페이스 정의
public interface UserRepositoryCustom {
    List<User> searchByCondition(String name, Integer minAge, String status);
}

// 2. 구현 클래스 (이름 규칙: {Repository명}Impl)
@RequiredArgsConstructor
public class UserRepositoryCustomImpl implements UserRepositoryCustom {

    private final EntityManager em;

    @Override
    public List<User> searchByCondition(
            String name, Integer minAge, String status) {
        // 동적 쿼리 구성
        StringBuilder jpql = new StringBuilder(
                "SELECT u FROM User u WHERE 1=1");
        if (name != null) jpql.append(" AND u.name LIKE :name");
        if (minAge != null) jpql.append(" AND u.age >= :minAge");
        if (status != null) jpql.append(" AND u.status = :status");

        TypedQuery<User> query = em.createQuery(jpql.toString(), User.class);
        if (name != null) query.setParameter("name", "%" + name + "%");
        if (minAge != null) query.setParameter("minAge", minAge);
        if (status != null) query.setParameter("status", status);
        return query.getResultList();
    }
}

// 3. 메인 Repository에서 두 인터페이스 동시 상속
public interface UserRepository
        extends JpaRepository<User, Long>, UserRepositoryCustom {
    // Spring이 자동으로 Impl 클래스와 연결
}
```

실무에서는 이 패턴 대신 **QueryDSL**을 사용하면 타입 안전한 동적 쿼리를 훨씬 간결하게 작성할 수 있습니다. QueryDSL은 다음 글에서 자세히 다룹니다.

## Projection — 필요한 필드만 조회

엔티티 전체가 아닌 일부 필드만 필요할 때는 Projection을 사용합니다.

```java
// 인터페이스 기반 Projection (Spring이 프록시로 구현)
public interface UserSummary {
    Long getId();
    String getName();
    String getEmail();
}

public interface UserRepository extends JpaRepository<User, Long> {
    // SELECT id, name, email FROM users (불필요한 컬럼 제외)
    List<UserSummary> findByStatus(String status);
}
```

인터페이스 Projection은 선언만 하면 되므로 간편하지만, JOIN이 복잡하거나 계산 필드가 필요하면 DTO Projection(`@Query` + JPQL 생성자 표현식)을 사용합니다.

## 정리

- `JpaRepository<T, ID>` 상속으로 기본 CRUD 자동 제공
- 메서드 명명 규칙: `findBy`, `And`, `Or`, `GreaterThan`, `Like`, `Between` 등 키워드 조합
- `@Query`: 복잡한 조건은 JPQL 직접 작성, 테이블 기반은 `nativeQuery = true`
- `@Modifying`: UPDATE/DELETE 벌크 쿼리 필수 — `clearAutomatically = true`로 1차 캐시 정합성 보장
- Custom Repository: `{Repository}Impl` 명명 규칙으로 복잡한 쿼리 분리
- Projection: 필요한 필드만 조회해 성능 최적화

---

**지난 글:** [JPA 상속 매핑 전략 완전 정복](/posts/spring-jpa-inheritance-mapping/)

**다음 글:** [JPQL과 Native Query 완전 정복](/posts/spring-jpa-jpql-native/)

<br>
읽어주셔서 감사합니다. 😊
