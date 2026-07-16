---
title: "CUBRID Java 연동 완전 가이드 — JDBC부터 Java 저장 프로시저까지"
description: "CUBRID JDBC 드라이버 사용법, PreparedStatement 패턴, 트랜잭션 처리, Java 저장 프로시저 작성 및 등록, Spring 연동 설정을 예제 코드 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["CUBRID", "JDBC", "Java", "저장프로시저", "Spring", "연동"]
featured: false
draft: false
---

[지난 글](/posts/cubrid-architecture/)에서 CUBRID 아키텍처를 살펴봤다. CUBRID는 특히 Java 생태계와의 통합이 잘 돼 있다. 이번 글에서는 CUBRID JDBC 드라이버 사용법, 트랜잭션 관리, Java 저장 프로시저, Spring Boot 연동까지 실전 코드 중심으로 다룬다.

## CUBRID JDBC 연결

CUBRID JDBC 드라이버는 공식 사이트 또는 Maven Central에서 내려받는다.

```xml
<!-- Maven 의존성 -->
<dependency>
    <groupId>us.cubrid</groupId>
    <artifactId>cubrid-jdbc</artifactId>
    <version>11.3.0.0001</version>
</dependency>
```

![CUBRID JDBC 연결 코드](/assets/posts/cubrid-java-jdbc.svg)

### JDBC URL 형식

```text
jdbc:cubrid:<host>:<port>:<dbname>:<user>:<password>:
```

```java
// 기본 연결
String url = "jdbc:cubrid:localhost:33000:testdb:::";
Connection conn = DriverManager.getConnection(url, "dba", "");

// 연결 속성 지정
Properties props = new Properties();
props.setProperty("user", "app_user");
props.setProperty("password", "secret");
props.setProperty("charset", "utf-8");
props.setProperty("autocommit", "false");

Connection conn = DriverManager.getConnection(
    "jdbc:cubrid:localhost:33000:testdb:::", props
);
```

### PreparedStatement와 배치 처리

```java
// 단건 INSERT
String sql = "INSERT INTO orders(order_id, user_id, product, amount) " +
             "VALUES(?, ?, ?, ?)";

try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setInt(1, 1001);
    ps.setInt(2, 42);
    ps.setString(3, "노트북");
    ps.setBigDecimal(4, new BigDecimal("1200000"));
    ps.executeUpdate();
    conn.commit();
}

// 배치 INSERT (대량 데이터)
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    for (Order order : orderList) {
        ps.setInt(1, order.getId());
        ps.setInt(2, order.getUserId());
        ps.setString(3, order.getProduct());
        ps.setBigDecimal(4, order.getAmount());
        ps.addBatch();

        if (orderList.indexOf(order) % 1000 == 999) {
            ps.executeBatch();  // 1000건마다 커밋
            conn.commit();
            ps.clearBatch();
        }
    }
    ps.executeBatch();
    conn.commit();
}
```

## 트랜잭션 관리

```java
conn.setAutoCommit(false);  // 자동 커밋 비활성화

try {
    // 이체: 출금
    try (PreparedStatement debit = conn.prepareStatement(
            "UPDATE accounts SET balance = balance - ? WHERE id = ?")) {
        debit.setBigDecimal(1, amount);
        debit.setInt(2, fromId);
        debit.executeUpdate();
    }

    // 이체: 입금
    try (PreparedStatement credit = conn.prepareStatement(
            "UPDATE accounts SET balance = balance + ? WHERE id = ?")) {
        credit.setBigDecimal(1, amount);
        credit.setInt(2, toId);
        credit.executeUpdate();
    }

    conn.commit();

} catch (SQLException e) {
    conn.rollback();
    throw new RuntimeException("이체 실패", e);
}
```

## Java 저장 프로시저

CUBRID의 독특한 기능은 **서버 내 JVM을 통한 Java 저장 프로시저**다. Java 메서드를 DB 서버 측에서 직접 실행한다.

![CUBRID Java 저장 프로시저 구조](/assets/posts/cubrid-java-sp.svg)

```java
// OrderUtils.java — 서버 측에서 실행될 Java 클래스
import java.sql.*;

public class OrderUtils {

    // static 메서드 필수
    public static int countOrders(String userId) throws Exception {
        // "jdbc:default:connection:" + DB명 으로 서버 내부 연결
        try (Connection conn = DriverManager.getConnection(
                    "jdbc:default:connection:testdb");
             PreparedStatement ps = conn.prepareStatement(
                    "SELECT COUNT(*) FROM orders WHERE user_id = ?")) {
            ps.setString(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    public static String formatAmount(long amount) {
        return String.format("%,d원", amount);
    }
}
```

```sql
-- 1. .jar 파일 서버에 등록
LOAD JAVA 'order_utils.jar';

-- 2. SQL 함수로 등록
CREATE FUNCTION count_orders(uid VARCHAR)
RETURN INTEGER
AS LANGUAGE JAVA
NAME 'OrderUtils.countOrders(java.lang.String) return int';

CREATE FUNCTION format_amount(amt BIGINT)
RETURN VARCHAR
AS LANGUAGE JAVA
NAME 'OrderUtils.formatAmount(long) return java.lang.String';

-- 3. SQL에서 호출
SELECT user_id,
       count_orders(CAST(user_id AS VARCHAR)) AS order_count,
       format_amount(total_spent) AS formatted_amount
FROM   user_stats;
```

## Spring Boot 연동

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:cubrid:localhost:33000:testdb:::
    username: app_user
    password: secret
    driver-class-name: cubrid.jdbc.driver.CUBRIDDriver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
```

```java
// Repository 예시
@Repository
public class OrderRepository {

    private final JdbcTemplate jdbcTemplate;

    public OrderRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Order> findByUserId(int userId) {
        String sql = "SELECT order_id, product, amount, order_date " +
                     "FROM orders WHERE user_id = ? " +
                     "ORDER BY order_date DESC LIMIT 20";

        return jdbcTemplate.query(sql,
            (rs, rowNum) -> Order.builder()
                .orderId(rs.getInt("order_id"))
                .product(rs.getString("product"))
                .amount(rs.getBigDecimal("amount"))
                .orderDate(rs.getDate("order_date").toLocalDate())
                .build(),
            userId
        );
    }

    @Transactional
    public void placeOrder(Order order) {
        String sql = "INSERT INTO orders(user_id, product, amount, order_date) " +
                     "VALUES(?, ?, ?, ?)";
        jdbcTemplate.update(sql,
            order.getUserId(),
            order.getProduct(),
            order.getAmount(),
            order.getOrderDate()
        );
    }
}
```

## CUBRID Manager Java API

CUBRID는 관리 목적의 Java API도 제공한다.

```java
// 테이블 스키마 조회
try (Connection conn = DriverManager.getConnection(url, "dba", "");
     Statement stmt = conn.createStatement();
     ResultSet rs = stmt.executeQuery(
         "SELECT class_name, class_type FROM db_class " +
         "WHERE is_system_class = 'NO' ORDER BY class_name")) {

    while (rs.next()) {
        System.out.printf("%-30s %s%n",
            rs.getString("class_name"),
            rs.getString("class_type"));
    }
}
```

CUBRID는 JDBC 표준을 완전히 준수하므로 MyBatis, Hibernate, JPA 같은 Java ORM 프레임워크와도 호환된다. JPA 사용 시 dialect로 `CUBRIDDialect`를 지정하면 된다.

---

**지난 글:** [CUBRID 아키텍처와 특징](/posts/cubrid-architecture/)

**다음 글:** [분산 SQL에서 CAP 이론의 위치](/posts/distsql-cap-sql-position/)

<br>
읽어주셔서 감사합니다. 😊
