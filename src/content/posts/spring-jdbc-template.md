---
title: "Spring JdbcTemplate 완전 정복: 반복 코드 제거와 안전한 DB 접근"
description: "순수 JDBC의 반복 코드 문제를 JdbcTemplate이 어떻게 해결하는지 살펴봅니다. query, queryForObject, update, batchUpdate 메서드, RowMapper와 BeanPropertyRowMapper, NamedParameterJdbcTemplate, 그리고 DataAccessException 예외 변환 체계를 실전 예제 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "JdbcTemplate", "JDBC", "RowMapper", "NamedParameterJdbcTemplate", "DataAccessException", "BeanPropertyRowMapper", "DB접근", "batchUpdate"]
featured: false
draft: false
---

[지난 글](/posts/spring-async-controller/)에서 Callable과 DeferredResult로 HTTP 스레드를 해방시키는 비동기 컨트롤러를 살펴봤습니다. 이번 글부터는 데이터베이스 접근 계층으로 이동합니다. Spring은 순수 JDBC 위에 얇지만 강력한 추상 레이어인 **JdbcTemplate**을 제공합니다. SQL을 직접 제어하면서도 반복 코드 없이 안전하게 DB와 통신하는 방법을 알아봅니다.

## 순수 JDBC의 문제

JDBC를 직접 사용하면 단순 SELECT 하나에도 다음 코드가 필요합니다.

```java
// 순수 JDBC — 15줄짜리 보일러플레이트
Connection conn = null;
PreparedStatement ps = null;
ResultSet rs = null;
try {
    conn = dataSource.getConnection();
    ps = conn.prepareStatement(
            "SELECT id, name FROM users WHERE id = ?");
    ps.setLong(1, userId);
    rs = ps.executeQuery();
    if (rs.next()) {
        return new User(rs.getLong("id"), rs.getString("name"));
    }
    return null;
} catch (SQLException e) {
    throw new RuntimeException(e);
} finally {
    if (rs   != null) try { rs.close();   } catch (SQLException ignored) {}
    if (ps   != null) try { ps.close();   } catch (SQLException ignored) {}
    if (conn != null) try { conn.close(); } catch (SQLException ignored) {}
}
```

실제 비즈니스 로직(`prepareStatement`와 `rs.next()` 사이 단 두 줄)을 위해 자원 획득·해제·예외 처리 코드가 열 배 이상 붙습니다. 이 문제를 **템플릿 메서드 패턴**으로 해결한 것이 JdbcTemplate입니다.

## JdbcTemplate 동작 원리

JdbcTemplate은 "변하지 않는 것(Connection 획득·해제, 예외 변환)"을 템플릿 안에 고정하고, "변하는 것(SQL, 파라미터, 결과 매핑)"만 콜백으로 주입받습니다.

![JdbcTemplate 처리 흐름](/assets/posts/spring-jdbc-template-flow.svg)

Spring Boot 환경에서는 `DataSource`만 설정되어 있으면 `JdbcTemplate`이 자동으로 빈 등록됩니다.

```java
@Repository
public class UserRepository {

    private final JdbcTemplate jdbc;

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }
}
```

## 조회: query / queryForObject

```java
// 단건 조회 — null 반환 가능한 Optional 처리
public Optional<User> findById(long id) {
    List<User> result = jdbc.query(
            "SELECT id, name, email FROM users WHERE id = ?",
            (rs, rowNum) -> new User(
                    rs.getLong("id"),
                    rs.getString("name"),
                    rs.getString("email")),
            id);
    return result.stream().findFirst();
}

// 목록 조회
public List<User> findByDept(String dept) {
    return jdbc.query(
            "SELECT id, name FROM users WHERE dept = ?",
            (rs, rowNum) -> new User(
                    rs.getLong("id"),
                    rs.getString("name")),
            dept);
}

// 스칼라 조회 — 단일 값
public int countByDept(String dept) {
    Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE dept = ?",
            Integer.class, dept);
    return count != null ? count : 0;
}
```

`queryForObject`는 결과가 없으면 `EmptyResultDataAccessException`을 던지므로, 존재 여부가 불확실한 단건 조회는 `query()`로 목록을 받아 처리하는 편이 안전합니다.

## 변경: update / batchUpdate

```java
// INSERT — 생성된 PK 반환
public long insert(User user) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbc.update(con -> {
        PreparedStatement ps = con.prepareStatement(
                "INSERT INTO users(name, email) VALUES(?, ?)",
                Statement.RETURN_GENERATED_KEYS);
        ps.setString(1, user.getName());
        ps.setString(2, user.getEmail());
        return ps;
    }, keyHolder);
    return Objects.requireNonNull(keyHolder.getKey()).longValue();
}

// UPDATE
public int updateEmail(long id, String email) {
    return jdbc.update(
            "UPDATE users SET email = ? WHERE id = ?",
            email, id);
}

// DELETE
public int delete(long id) {
    return jdbc.update("DELETE FROM users WHERE id = ?", id);
}
```

`update()`는 영향받은 행 수(int)를 반환합니다.

```java
// batchUpdate — 대량 처리
public int[] bulkInsert(List<User> users) {
    return jdbc.batchUpdate(
            "INSERT INTO users(name, email) VALUES(?, ?)",
            users,
            500,   // batch size
            (ps, user) -> {
                ps.setString(1, user.getName());
                ps.setString(2, user.getEmail());
            });
}
```

`batchUpdate`는 `BatchPreparedStatementSetter` 또는 람다를 받아 지정된 묶음 크기로 INSERT를 처리합니다. 행 수가 많을 때 네트워크 왕복 횟수를 크게 줄입니다.

## BeanPropertyRowMapper — 자동 매핑

컬럼명이 자바 필드명과 일치(snake_case ↔ camelCase 자동 변환)하면 `BeanPropertyRowMapper`로 매핑 코드를 생략할 수 있습니다.

```java
// BeanPropertyRowMapper — 컬럼명 ↔ 필드명 자동 매핑
private static final RowMapper<User> USER_MAPPER =
        BeanPropertyRowMapper.newInstance(User.class);

public List<User> findAll() {
    return jdbc.query("SELECT id, user_name, email FROM users",
            USER_MAPPER);
    // user_name 컬럼 → userName 필드로 자동 변환
}
```

단, 리플렉션을 사용하므로 컬럼 수가 많거나 성능에 민감한 상황에서는 람다 RowMapper가 더 빠릅니다.

## NamedParameterJdbcTemplate

파라미터가 많아지면 `?` 위치 기반 바인딩은 순서 실수가 잦습니다. **NamedParameterJdbcTemplate**은 `:paramName` 형태로 이름 기반 바인딩을 지원합니다.

![JdbcTemplate 핵심 사용 패턴](/assets/posts/spring-jdbc-template-code.svg)

```java
@Repository
public class ProductRepository {

    private final NamedParameterJdbcTemplate namedJdbc;

    public ProductRepository(NamedParameterJdbcTemplate namedJdbc) {
        this.namedJdbc = namedJdbc;
    }

    public List<Product> search(String category, boolean active,
                                int minPrice) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("category", category)
                .addValue("active", active)
                .addValue("minPrice", minPrice);

        return namedJdbc.query(
                "SELECT * FROM products "
                + "WHERE category = :category "
                + "AND active = :active "
                + "AND price >= :minPrice",
                params,
                BeanPropertyRowMapper.newInstance(Product.class));
    }
}
```

`MapSqlParameterSource` 외에 `Map<String, Object>`나 SqlParameterSource 구현체인 `BeanPropertySqlParameterSource`(도메인 객체 필드 자동 매핑)도 사용할 수 있습니다.

## DataAccessException 예외 변환

JDBC는 `SQLException`을 던지는데, 이는 체크 예외이고 벤더마다 에러 코드가 다릅니다. JdbcTemplate은 모든 `SQLException`을 **Spring의 DataAccessException 계층**(언체크 예외)으로 변환합니다.

```java
// 예외 계층 예시
DataAccessException
 ├── NonTransientDataAccessException
 │    ├── DataIntegrityViolationException  // 제약 위반 (UK, FK...)
 │    ├── BadSqlGrammarException           // SQL 문법 오류
 │    └── EmptyResultDataAccessException  // 결과 없음
 └── TransientDataAccessException
      ├── QueryTimeoutException            // 쿼리 타임아웃
      └── DeadlockLoserDataAccessException // 데드락 패배자
```

```java
public void createUser(User user) {
    try {
        jdbc.update("INSERT INTO users(email) VALUES(?)",
                user.getEmail());
    } catch (DataIntegrityViolationException e) {
        // 이메일 UNIQUE 제약 위반 처리
        throw new DuplicateEmailException(user.getEmail());
    }
}
```

벤더 중립적인 예외 타입 덕분에 MySQL → PostgreSQL 교체 시 catch 블록을 수정하지 않아도 됩니다.

## 언제 JdbcTemplate을 선택하나

| 상황 | 선택 |
|---|---|
| SQL을 직접 제어해야 함 | JdbcTemplate ✓ |
| 복잡한 동적 쿼리 (WHERE 조건 수십 개) | MyBatis 고려 |
| 도메인 모델 중심 개발 | JPA/Spring Data JPA 고려 |
| 레거시 DB 스키마 | JdbcTemplate ✓ |
| 대용량 batchUpdate 성능 필요 | JdbcTemplate ✓ |

JPA와 JdbcTemplate은 배타적이지 않습니다. 같은 애플리케이션 안에서 JPA로 도메인 객체를 관리하고, 복잡한 통계 쿼리나 배치 INSERT는 JdbcTemplate으로 처리하는 조합이 자주 쓰입니다.

## 정리

- JdbcTemplate은 Connection 획득·해제·예외 변환을 템플릿화해 보일러플레이트를 제거
- `query()`는 목록 또는 단건, `update()`는 INSERT/UPDATE/DELETE, `batchUpdate()`는 대량 처리
- RowMapper 람다로 ResultSet → 객체 변환; `BeanPropertyRowMapper`로 매핑 코드 생략 가능
- `NamedParameterJdbcTemplate`으로 이름 기반 파라미터 바인딩 → 가독성·유지보수성 향상
- `DataAccessException`(언체크)으로 벤더 중립적 예외 처리

---

**지난 글:** [Spring MVC 비동기 컨트롤러 완전 정복: Callable·DeferredResult·SseEmitter](/posts/spring-async-controller/)

**다음 글:** [Spring HikariCP 커넥션 풀 완전 정복: 원리·설정·모니터링](/posts/spring-connection-pool-hikari/)

<br>
읽어주셔서 감사합니다. 😊
