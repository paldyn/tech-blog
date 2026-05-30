---
title: "QueryDSL·jOOQ — 타입 안전 SQL 빌더"
description: "컴파일 타임에 SQL 오류를 감지하는 타입 안전 SQL 빌더 QueryDSL과 jOOQ의 코드 생성 방식, 동적 조건 빌드, 윈도우·CTE 지원, 그리고 두 라이브러리의 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["QueryDSL", "jOOQ", "타입안전", "SQL빌더", "동적SQL", "BooleanBuilder"]
featured: false
draft: false
---

[지난 글](/posts/orm-mybatis-dynamic-sql/)에서 MyBatis의 XML 동적 SQL 태그를 살펴봤다. 이번에는 **QueryDSL**과 **jOOQ**를 다룬다. 두 라이브러리는 모두 "타입 안전한 SQL을 Java 코드로 작성"한다는 공통 목표를 가지지만, 접근 방식과 적합한 사용 맥락이 다르다.

## 문자열 SQL의 근본 문제

Raw SQL이나 MyBatis의 최대 약점은 **SQL이 문자열이라는 점**이다. 오타는 런타임까지 발견되지 않고, 컬럼명 변경 시 IDE 리팩토링이 되지 않으며, 동적 조건 조합은 문자열 연결로 처리하게 된다.

타입 안전 SQL 빌더는 이 문제를 컴파일 타임으로 끌어올린다.

![타입 안전 SQL 빌더 비교](/assets/posts/orm-querydsl-jooq-builder.svg)

## QueryDSL

QueryDSL은 **JPA 엔티티로부터 Q-class를 생성**해 JPQL(또는 SQL)을 타입 안전하게 작성한다.

### 설정

```gradle
// build.gradle (Kotlin DSL)
plugins {
    id("com.ewerk.gradle.plugins.querydsl") version "1.0.10"
}
dependencies {
    implementation("com.querydsl:querydsl-jpa:5.1.0:jakarta")
    annotationProcessor("com.querydsl:querydsl-apt:5.1.0:jakarta")
}
```

`@Entity` 클래스에 어노테이션 프로세서가 동작해 `QOrder`, `QCustomer` 같은 Q-class를 자동 생성한다.

### 기본 쿼리

```java
QOrder o = QOrder.order;
QCustomer c = QCustomer.customer;

List<OrderDto> result = queryFactory
    .select(Projections.constructor(OrderDto.class,
        o.orderId, o.status, c.name))
    .from(o)
    .join(o.customer, c).fetchJoin()
    .where(o.status.eq("PAID")
           .and(o.amount.gt(new BigDecimal("10000"))))
    .orderBy(o.amount.desc())
    .offset(0).limit(20)
    .fetch();
```

### 동적 조건 — BooleanBuilder

QueryDSL의 강점이다. 런타임 조건에 따라 WHERE절을 조합할 때 null을 안전하게 처리한다.

```java
public List<Order> search(OrderSearchParam param) {
    QOrder o = QOrder.order;
    BooleanBuilder pred = new BooleanBuilder();

    // null이면 조건 추가 안 함
    if (param.getCustId() != null)
        pred.and(o.custId.eq(param.getCustId()));
    if (param.getStatus() != null)
        pred.and(o.status.eq(param.getStatus()));
    if (param.getFromDate() != null)
        pred.and(o.orderDt.goe(param.getFromDate()));

    return queryFactory.selectFrom(o).where(pred).fetch();
}
```

또는 `Expressions.asBoolean(true).isTrue()`를 기본값으로 쓰는 메서드 분리 패턴도 많이 사용된다.

## jOOQ

jOOQ는 **DB 스키마로부터 코드를 생성**해 SQL 수준의 추상화를 타입 안전하게 제공한다. JPA가 없어도 동작하며, 실제 SQL에 훨씬 가깝다.

### 코드 생성 (Maven 예시)

```xml
<!-- pom.xml -->
<plugin>
  <groupId>org.jooq</groupId>
  <artifactId>jooq-codegen-maven</artifactId>
  <configuration>
    <jdbc>
      <driver>org.postgresql.Driver</driver>
      <url>jdbc:postgresql://localhost/mydb</url>
    </jdbc>
    <generator>
      <target>
        <packageName>com.example.jooq</packageName>
        <directory>src/generated/java</directory>
      </target>
    </generator>
  </configuration>
</plugin>
```

DB의 `orders` 테이블로부터 `Tables.ORDERS`, `ORDERS.ORDER_ID`, `ORDERS.STATUS` 같은 클래스가 생성된다. 컬럼명을 바꾸면 컴파일 오류로 즉시 알 수 있다.

### 기본 쿼리

```java
DSLContext dsl = DSL.using(dataSource, SQLDialect.POSTGRES);

List<OrderDto> orders = dsl
    .select(ORDERS.ORDER_ID, ORDERS.STATUS, CUSTOMERS.NAME)
    .from(ORDERS)
    .join(CUSTOMERS).on(CUSTOMERS.CUST_ID.eq(ORDERS.CUST_ID))
    .where(ORDERS.STATUS.eq("PAID"))
    .orderBy(ORDERS.AMOUNT.desc())
    .fetchInto(OrderDto.class);
```

![QueryDSL 동적 조건과 jOOQ 고급 SQL](/assets/posts/orm-querydsl-jooq-dynamic.svg)

### jOOQ 고급 SQL — 윈도우·CTE·RETURNING

jOOQ의 진짜 강점은 고급 SQL 구문을 타입 안전하게 표현할 수 있다는 점이다.

```java
// CTE with jOOQ
var monthly = name("monthly").fields("month", "total").as(
    dsl.select(trunc(ORDERS.ORDER_DT, "month").as("month"),
               sum(ORDERS.AMOUNT).as("total"))
       .from(ORDERS)
       .groupBy(trunc(ORDERS.ORDER_DT, "month"))
);

dsl.with(monthly)
   .select()
   .from(monthly)
   .orderBy(field(name("monthly", "month")))
   .fetch();

// INSERT ... RETURNING (PostgreSQL)
OrdersRecord inserted = dsl
    .insertInto(ORDERS, ORDERS.CUST_ID, ORDERS.STATUS, ORDERS.AMOUNT)
    .values(1001L, "PENDING", new BigDecimal("50000"))
    .returning(ORDERS.ORDER_ID)
    .fetchOne();
```

## 두 라이브러리 선택 기준

| 기준 | QueryDSL | jOOQ |
|---|---|---|
| 코드 생성 기반 | JPA @Entity | DB 스키마 |
| JPA 의존성 | 있음 | 없음 |
| SQL 표현 수준 | JPQL 수준 | SQL 수준 |
| 고급 SQL (CTE·Window) | 제한적 | 완전 지원 |
| DB 특화 기능 | 어려움 | 기본 지원 |
| 라이선스 | Apache 2.0 | 상용(OSS 플랜 있음) |
| 한국 사용 빈도 | 높음 | 낮음 |

## 실전 선택 패턴

가장 흔한 패턴은 **JPA + QueryDSL 조합**이다. Spring Data JPA로 단순 CRUD를 처리하고, 복잡한 동적 검색 쿼리는 QueryDSL로 작성한다. 여기에 집계·보고서 쿼리는 QueryDSL의 네이티브 SQL 기능 또는 MyBatis로 처리하는 3-계층 혼용이 실무에서 자주 보인다.

jOOQ는 JPA 없이 순수 SQL 위주로 작업하거나, CTE·윈도우·ON CONFLICT 같은 DB 특화 기능을 타입 안전하게 사용해야 하는 경우에 선택한다.

## 정리

QueryDSL과 jOOQ는 모두 "SQL을 문자열에서 꺼내 컴파일 타임 검증 영역으로 가져온다"는 목표를 공유한다. 프로젝트가 JPA 기반이고 동적 검색 조건이 많다면 QueryDSL, JPA 없이 SQL 수준의 제어가 필요하다면 jOOQ가 자연스러운 선택이다. 중요한 것은 어떤 도구를 쓰든 발행되는 SQL을 항상 모니터링하고, 성능 병목이 DB 레이어에 있는지 확인하는 습관이다.

---

**지난 글:** [MyBatis 동적 SQL — 유연한 쿼리 빌드](/posts/orm-mybatis-dynamic-sql/)

**다음 글:** [Sequelize·Prisma·TypeORM — Node.js ORM](/posts/orm-sequelize-prisma-typeorm/)

<br>
읽어주셔서 감사합니다. 😊
