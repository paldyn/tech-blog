---
title: "MyBatis 동적 SQL — 유연한 쿼리 빌드"
description: "MyBatis의 SQL Mapper 아키텍처, XML 동적 SQL 태그(if·where·foreach·choose), ResultMap 중첩 매핑, #{} vs ${} 차이와 SQL 인젝션 방어를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["MyBatis", "동적SQL", "SQLMapper", "foreach", "ResultMap", "SQL인젝션"]
featured: false
draft: false
---

[지난 글](/posts/orm-jpa-hibernate-generated-sql/)에서 JPA/Hibernate의 영속성 컨텍스트와 SQL 발행 원리를 살펴봤다. 이번에는 한국 SI·공공기관 프로젝트에서 사실상 표준으로 자리 잡은 **MyBatis**를 다룬다. MyBatis는 SQL을 직접 작성하면서도 결과 매핑을 자동화해주는 **SQL Mapper** 계층에 속한다. JPA보다 학습 곡선이 낮고, 복잡한 SQL을 그대로 작성할 수 있다는 장점 덕분에 레거시 스키마가 많은 환경에서 꾸준히 선택된다.

## MyBatis 아키텍처

![MyBatis SQL 맵핑 아키텍처](/assets/posts/orm-mybatis-dynamic-sql-flow.svg)

MyBatis의 실행 흐름은 단순하다.

1. **Mapper Interface**: Java 메서드 호출이 MyBatis에 위임된다.
2. **XML Mapper**: 메서드와 매핑된 SQL 문이 동적으로 조합된다.
3. **SQL Executor**: `#{}` 파라미터가 `PreparedStatement`로 바인딩되어 실행된다.
4. **ResultMap**: ResultSet이 지정된 DTO 또는 Map으로 자동 매핑된다.

```java
// Mapper Interface
public interface OrderMapper {
    List<OrderDto> searchOrders(OrderSearchParam param);
    int insertBatch(@Param("orders") List<Order> orders);
}
```

```xml
<!-- mybatis-config.xml에 등록 후 OrderMapper.xml 작성 -->
```

## 동적 SQL 태그

MyBatis의 핵심 기능이다. 런타임 파라미터 값에 따라 SQL 조각을 조합할 수 있다.

### `<if>` — 조건부 SQL

```xml
<select id="searchOrders" resultType="OrderDto">
  SELECT order_id, cust_id, status, amount
    FROM orders
  <where>
    <if test="custId != null">
      AND cust_id = #{custId}
    </if>
    <if test="status != null and status != ''">
      AND status = #{status}
    </if>
    <if test="fromDate != null">
      AND order_dt >= #{fromDate}
    </if>
  </where>
</select>
```

`<where>` 태그는 내부에 조건이 하나라도 있으면 `WHERE`를 추가하고, 첫 번째 `AND`/`OR`를 자동으로 제거한다.

### `<foreach>` — IN절과 다건 INSERT

```xml
<!-- IN절 -->
<select id="findByIds" resultType="Order">
  SELECT * FROM orders
  WHERE id IN
  <foreach collection="list" item="id"
           open="(" separator="," close=")">
    #{id}
  </foreach>
</select>

<!-- 다건 INSERT (MySQL 배치) -->
<insert id="insertBatch">
  INSERT INTO orders (cust_id, status, amount)
  VALUES
  <foreach collection="orders" item="o" separator=",">
    (#{o.custId}, #{o.status}, #{o.amount})
  </foreach>
</insert>
```

### `<choose>` — switch-case

```xml
<select id="findOrdered" resultType="Order">
  SELECT * FROM orders
  ORDER BY
  <choose>
    <when test="sortBy == 'amount'">amount DESC</when>
    <when test="sortBy == 'date'">order_dt DESC</when>
    <otherwise>order_id DESC</otherwise>
  </choose>
</select>
```

### `<set>` — 동적 UPDATE

```xml
<update id="updateOrder">
  UPDATE orders
  <set>
    <if test="status != null">status = #{status},</if>
    <if test="amount != null">amount = #{amount},</if>
  </set>
  WHERE order_id = #{orderId}
</update>
```

`<set>` 태그는 마지막 콤마를 자동으로 제거한다.

![MyBatis 동적 SQL 예제](/assets/posts/orm-mybatis-dynamic-sql-xml.svg)

## `#{}` vs `${}` — SQL 인젝션 위험

MyBatis에서 파라미터를 삽입하는 방법은 두 가지다.

```xml
<!-- #{}: PreparedStatement 파라미터 바인딩 (안전) -->
AND cust_id = #{custId}
-- 발행: AND cust_id = ?  (바인딩)

<!-- ${}: 문자열 직접 치환 (SQL 인젝션 위험!) -->
ORDER BY ${sortColumn}
-- 발행: ORDER BY cust_id  (그대로 삽입)
```

`${}`는 컬럼 이름이나 테이블 이름처럼 PreparedStatement로 바인딩할 수 없는 경우에만 사용하고, 반드시 화이트리스트 검증을 선행해야 한다.

```java
// ${} 사용 시 화이트리스트 검증 필수
private static final Set<String> VALID_SORT_COLS =
    Set.of("order_id", "amount", "order_dt");

if (!VALID_SORT_COLS.contains(sortColumn)) {
    throw new IllegalArgumentException("Invalid sort column: " + sortColumn);
}
```

## ResultMap — 복잡한 결과 매핑

단순 컬럼-필드 매핑은 `resultType`으로 충분하다. 1:1이나 1:N 관계를 포함한 복잡한 결과는 `resultMap`을 쓴다.

```xml
<resultMap id="orderResultMap" type="OrderDto">
  <id property="orderId" column="order_id"/>
  <result property="status" column="status"/>
  <!-- 1:1 관계 -->
  <association property="customer" javaType="CustomerDto">
    <id property="custId" column="cust_id"/>
    <result property="name" column="cust_name"/>
  </association>
  <!-- 1:N 관계 -->
  <collection property="items" ofType="OrderItemDto">
    <id property="itemId" column="item_id"/>
    <result property="sku" column="sku"/>
    <result property="qty" column="qty"/>
  </collection>
</resultMap>

<select id="findOrderWithItems" resultMap="orderResultMap">
  SELECT o.order_id, o.status,
         c.cust_id, c.name AS cust_name,
         i.item_id, i.sku, i.qty
    FROM orders o
    JOIN customers c ON c.cust_id = o.cust_id
    JOIN order_items i ON i.order_id = o.order_id
   WHERE o.order_id = #{orderId}
</select>
```

## 공통 SQL 조각 재사용

```xml
<sql id="baseColumns">
  order_id, cust_id, status, amount, created_at
</sql>

<select id="findAll" resultType="Order">
  SELECT <include refid="baseColumns"/>
    FROM orders
   ORDER BY order_id DESC
</select>
```

## MyBatis와 Spring 연동

Spring Boot에서는 `mybatis-spring-boot-starter` 의존성 하나로 연동된다.

```yaml
# application.yml
mybatis:
  mapper-locations: classpath:mappers/**/*.xml
  configuration:
    map-underscore-to-camel-case: true    # order_id → orderId 자동 변환
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl  # SQL 로깅
```

## 정리

MyBatis는 "SQL을 코드에서 분리해 XML에서 관리하면서 결과 매핑을 자동화"한다. 동적 SQL 태그는 복잡한 검색 조건을 깔끔하게 표현할 수 있는 강력한 도구다. 핵심 주의사항은 두 가지다: `${}`는 SQL 인젝션 위험이 있으므로 최소화하고, `<foreach>`에 대용량 리스트를 그대로 넘기면 IN절이 너무 길어져 성능이 떨어지므로 100~1000개 단위로 청크 처리해야 한다.

---

**지난 글:** [JPA/Hibernate가 생성하는 SQL 이해하기](/posts/orm-jpa-hibernate-generated-sql/)

**다음 글:** [QueryDSL·jOOQ — 타입 안전 SQL 빌더](/posts/orm-querydsl-jooq/)

<br>
읽어주셔서 감사합니다. 😊
