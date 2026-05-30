---
title: "Raw SQL vs ORM — 언제 무엇을 쓸까"
description: "Raw SQL과 ORM의 트레이드오프, SQL Mapper·SQL Builder·Full ORM의 추상화 스펙트럼, 실무에서 계층별로 적절히 혼용하는 전략을 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["ORM", "RawSQL", "JPA", "MyBatis", "jOOQ", "SQLAlchemy", "N+1"]
featured: false
draft: false
---

[지난 글](/posts/olap-duckdb/)에서 DuckDB의 임베디드 OLAP 패턴을 살펴봤다. 이번 글부터는 ORM 시리즈를 시작한다. 소프트웨어 개발에서 "Raw SQL을 써야 하는가, ORM을 써야 하는가"는 수십 년째 반복되는 논쟁이다. 정답 없는 선호 싸움처럼 보이지만, 실은 **상황에 따라 분명한 선택 기준**이 있다.

## Raw SQL과 ORM이란

**Raw SQL**은 SQL 문자열을 직접 데이터베이스 드라이버에 전달하는 방식이다. JDBC, psycopg2, database/sql(Go) 같은 저수준 API가 여기에 해당한다.

**ORM(Object-Relational Mapping)**은 테이블과 객체(클래스) 사이의 변환을 자동화하는 레이어다. JPA/Hibernate, Django ORM, ActiveRecord, SQLAlchemy ORM이 대표적이다.

그런데 현실에서는 이 두 극단 사이에 여러 계층이 있다.

![ORM 레이어 구조와 추상화 수준](/assets/posts/orm-raw-sql-vs-orm-layers.svg)

## 추상화 스펙트럼

| 계층 | 대표 도구 | 특징 |
|---|---|---|
| Raw SQL | JDBC, psycopg2 | SQL 문자열 직접 실행 |
| SQL Mapper | MyBatis, Dapper | SQL 직접 작성 + 결과 자동 매핑 |
| SQL Builder | jOOQ, QueryDSL, SQLAlchemy Core | 타입 안전 SQL 생성 |
| Micro ORM | Spring JDBC, sqlx(Go) | SQL + 결과 자동 매핑, 간단 |
| Full ORM | JPA/Hibernate, Django ORM | 객체 중심, SQL 자동 생성 |

## Raw SQL의 강점

Raw SQL은 **SQL 표현력을 100% 활용**할 수 있다. 복잡한 윈도우 함수, 계층적 CTE, 데이터베이스별 특수 기능을 제약 없이 사용한다.

```sql
-- ORM으로 표현하기 어려운 쿼리: 누적 합계 + 이전 행 비교
WITH monthly AS (
  SELECT DATE_TRUNC('month', order_dt) AS month,
         SUM(amount) AS monthly_total
    FROM orders
   WHERE status = 'PAID'
   GROUP BY 1
)
SELECT month,
       monthly_total,
       SUM(monthly_total) OVER (ORDER BY month)            AS cum_total,
       monthly_total - LAG(monthly_total) OVER (ORDER BY month) AS mom_diff
  FROM monthly
 ORDER BY month;
```

이런 쿼리를 JPA JPQL이나 Django ORM으로 표현하려면 네이티브 쿼리(raw SQL)로 탈출해야 한다.

## ORM의 강점

ORM은 **반복적인 CRUD를 자동화**한다. 특히 Java의 Spring Data JPA 같은 프레임워크는 메서드 이름만으로 쿼리를 자동 생성한다.

```java
// Spring Data JPA — SQL 한 줄도 안 쓰고 쿼리 생성
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByCustIdAndStatus(Long custId, String status);
    Optional<Order> findTopByCustIdOrderByCreatedAtDesc(Long custId);
    long countByStatusAndCreatedAtAfter(String status, LocalDateTime since);
}
```

타입 안전성도 강점이다. 컴파일 타임에 객체-컬럼 불일치를 잡을 수 있다.

## ORM의 함정 — N+1 문제

ORM을 부주의하게 사용하면 N+1 문제가 발생한다. 1번의 쿼리로 N개의 결과를 가져온 뒤, 각 결과마다 추가 쿼리를 N번 발행하는 패턴이다.

```java
// N+1 발생 코드 (JPA)
List<Order> orders = orderRepo.findAll();  // 쿼리 1번 (N개 주문)
for (Order o : orders) {
    String name = o.getCustomer().getName();  // 각 주문마다 쿼리 1번 → N번
}
// 결과: 1 + N번 쿼리 실행
```

해결책은 EAGER 로딩이나 JOIN FETCH를 명시하는 것이다.

```java
// JPQL JOIN FETCH로 N+1 해결
@Query("SELECT o FROM Order o JOIN FETCH o.customer WHERE o.status = :status")
List<Order> findWithCustomer(@Param("status") String status);
```

![Raw SQL vs ORM 트레이드오프](/assets/posts/orm-raw-sql-vs-orm-tradeoff.svg)

## 실무 혼용 전략

현실 프로젝트에서 "ORM만" 또는 "Raw SQL만" 사용하는 팀은 드물다. 대부분 **목적에 따라 혼용**한다.

```java
// Spring 프로젝트의 계층별 선택 예시

// 1. 도메인 CRUD → JPA Repository (ORM)
Order order = orderRepo.findById(id).orElseThrow();
orderRepo.save(new Order(...));

// 2. 복잡한 집계 보고서 → @Query 네이티브 SQL
@Query(value = """
    SELECT region, SUM(amount) AS total
      FROM orders
     WHERE order_dt >= :from
     GROUP BY region
     ORDER BY total DESC
    """, nativeQuery = true)
List<RegionSalesDto> getRegionSales(@Param("from") LocalDate from);

// 3. 복잡한 동적 조건 → QueryDSL 또는 jOOQ
QOrder o = QOrder.order;
List<Order> result = queryFactory
    .selectFrom(o)
    .where(o.status.eq("PAID")
           .and(custId != null ? o.custId.eq(custId) : null))
    .fetch();
```

## 언제 무엇을 선택할까

**ORM을 선택해야 할 때**:
- CRUD가 중심인 서비스(관리자 페이지, REST API 백엔드)
- 빠른 프로토타이핑이 필요할 때
- 팀 전체가 도메인 객체 중심으로 생각할 때

**Raw SQL(또는 SQL Mapper/Builder)을 선택해야 할 때**:
- 복잡한 집계·분석 쿼리(보고서, 대시보드)
- 성능이 임계인 배치 처리
- 데이터베이스 특화 기능(파티션, 힌트, 특수 함수) 활용
- 레거시 DB 스키마가 ORM 매핑에 적합하지 않을 때

## 정리

ORM은 만능 도구가 아니다. "ORM은 나쁘다"도 틀렸고 "ORM만 쓰면 된다"도 틀렸다. 프로젝트의 쿼리 복잡도, 팀의 SQL 역량, 성능 요구사항을 기준으로 스펙트럼 위의 적절한 위치를 선택하는 것이 실력이다. 다음 글들에서 JPA/Hibernate, MyBatis, QueryDSL/jOOQ 각각의 동작 원리와 최적화 방법을 구체적으로 살펴본다.

---

**지난 글:** [DuckDB — 임베디드 OLAP 엔진](/posts/olap-duckdb/)

**다음 글:** [JPA/Hibernate가 생성하는 SQL 이해하기](/posts/orm-jpa-hibernate-generated-sql/)

<br>
읽어주셔서 감사합니다. 😊
