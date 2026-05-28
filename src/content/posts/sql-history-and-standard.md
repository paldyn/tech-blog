---
title: "SQL 역사와 표준 — SQL-86부터 SQL:2023까지"
description: "SQL의 탄생 배경부터 ISO 표준 SQL-86, SQL-92, SQL:1999, SQL:2003, SQL:2023까지의 진화를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQL", "SQL 표준", "SQL 역사", "ANSI SQL"]
featured: false
draft: false
---

[지난 글](/posts/sql-relational-model/)에서 관계형 모델의 수학적 기반을 살펴봤습니다. 이번에는 그 이론이 어떻게 현실의 SQL 언어로 발전했는지, 표준화 역사를 짚어봅니다. "SQL:2003에서 생긴 기능"이라는 말을 종종 보게 되는데, 각 표준이 어떤 기능을 추가했는지 파악하면 문서를 읽을 때 맥락이 잡힙니다.

## 탄생: SEQUEL에서 SQL로

1970년 IBM 연구소의 에드거 코드가 관계형 모델 논문을 발표한 뒤, IBM은 1973년부터 **System R**이라는 실험적 RDBMS를 개발하기 시작했습니다. 이 프로젝트에서 코드의 이론을 실제로 구현하는 질의 언어가 필요했고, 1974년 **SEQUEL(Structured English Query Language)** 이 만들어졌습니다. 상표권 문제로 이름이 **SQL**로 바뀌었고, 이것이 오늘날 우리가 쓰는 SQL의 기원입니다.

![SQL 표준 역사 타임라인](/assets/posts/sql-history-and-standard-timeline.svg)

## 표준화: ANSI/ISO SQL

SQL이 여러 제품에 구현되면서 방언(dialect) 차이가 커졌고, 1986년 **ANSI**가, 이듬해 **ISO**가 SQL 표준을 발표했습니다.

### SQL-86 (SQL-87)
최초 표준. 기본 SELECT·INSERT·UPDATE·DELETE, 기본 조인, 간단한 서브쿼리를 포함했습니다. 지금 기준으로는 매우 기능이 적었습니다.

### SQL-92 (SQL2)
가장 많이 인용되는 표준. 현재도 "SQL-92 호환"이라는 표현을 씁니다.

```sql
-- SQL-92에서 추가된 OUTER JOIN 예시
SELECT c.name, o.amount
FROM   customers c
LEFT OUTER JOIN orders o ON c.customer_id = o.customer_id;
```

SQL-92 주요 추가 사항: `OUTER JOIN`, `CASE` 표현식, `CAST()`, 다양한 문자열 함수, 서브쿼리 확장, 스키마 정보 뷰(`INFORMATION_SCHEMA`).

### SQL:1999 (SQL3)
객체-관계형 확장과 함께 개발자들이 많이 쓰는 기능이 다수 추가되었습니다.

```sql
-- SQL:1999에서 추가된 재귀 CTE
WITH RECURSIVE org_tree AS (
    SELECT employee_id, manager_id, name, 0 AS depth
    FROM   employees
    WHERE  manager_id IS NULL
    UNION ALL
    SELECT e.employee_id, e.manager_id, e.name, t.depth + 1
    FROM   employees e
    JOIN   org_tree t ON e.manager_id = t.employee_id
)
SELECT * FROM org_tree ORDER BY depth;
```

SQL:1999 주요 추가 사항: `WITH RECURSIVE`(재귀 CTE), `ROLLUP`/`CUBE`/`GROUPING SETS`, 트리거, 사용자 정의 타입(UDT), 저장 프로시저 표준.

### SQL:2003
윈도우 함수와 MERGE가 이 버전에서 표준화되었습니다.

```sql
-- SQL:2003에서 추가된 윈도우 함수
SELECT name, salary,
       RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk
FROM   employees;
```

SQL:2003 주요 추가 사항: `OVER (PARTITION BY ...)` 윈도우 함수, `MERGE`(UPSERT), `IDENTITY` 열, XML 타입.

### SQL:2016 ~ SQL:2023

```sql
-- SQL:2016 JSON 경로 함수 (PostgreSQL 구현 예)
SELECT json_column -> 'address' ->> 'city' AS city
FROM   customers;
```

- **SQL:2016**: JSON 지원(`JSON_VALUE`, `JSON_QUERY`, `JSON_TABLE`), 행 패턴 매칭(`MATCH_RECOGNIZE`)
- **SQL:2019**: 멀티 디멘셔널 배열
- **SQL:2023**: 그래프 테이블(Property Graph), `LISTAGG`, `GREATEST`/`LEAST` 표준화

![주요 RDBMS 표준 준수 현황](/assets/posts/sql-history-and-standard-vendors.svg)

## 방언(Dialect)의 존재

표준이 있다고 모든 제품이 완전히 같지는 않습니다.

| 제품 | 방언 특성 | 비표준 예시 |
|------|-----------|-------------|
| Oracle | PL/SQL, 독자 함수 | `ROWNUM`, `CONNECT BY` |
| PostgreSQL | 표준 준수율 높음 | 배열, JSONB, `COPY` |
| MySQL | 일부 표준 미준수 | `LIMIT n`, `GROUP BY` 완화 |
| SQL Server | T-SQL | `TOP n`, `APPLY` |

이 시리즈는 **표준 SQL을 기준**으로 설명하고, 제품별 차이는 Oracle·PostgreSQL·MySQL·SQL Server 섹션에서 별도로 다룹니다.

## 정리

- SQL은 1974년 IBM의 SEQUEL에서 출발해 1986년 ANSI/ISO 표준이 되었습니다.
- SQL-92는 현재도 기준점으로 인용됩니다.
- SQL:1999에서 재귀 CTE, SQL:2003에서 윈도우 함수·MERGE가 표준화되었습니다.
- 모든 주요 RDBMS는 표준 핵심을 구현하되, 고유 방언과 확장 기능을 가집니다.

다음 글에서는 클라이언트가 DBMS와 통신하는 방식, 즉 **클라이언트-서버 프로토콜**을 살펴봅니다.

---

**지난 글:** [관계형 모델 이론 — 릴레이션, 튜플, 관계 대수](/posts/sql-relational-model/)

**다음 글:** [클라이언트-서버 프로토콜 — SQL 실행의 여정](/posts/sql-client-server-protocol/)

<br>
읽어주셔서 감사합니다. 😊
