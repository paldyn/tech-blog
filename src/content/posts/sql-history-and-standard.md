---
title: "SQL의 역사와 표준 — SQL-86부터 SQL:2023까지"
description: "SEQUEL에서 시작된 SQL의 탄생 배경, ANSI/ISO 표준 버전별 주요 기능, 그리고 Oracle·MySQL·PostgreSQL이 표준을 어떻게 확장·변형했는지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQL역사", "SQL표준", "ANSI", "SQL-92", "SQL2003", "윈도우함수", "CTE", "SQL방언"]
featured: false
draft: false
---

[지난 글](/posts/sql-relational-model/)에서 관계형 모델의 수학적 기초를 다뤘다. 이번 글에서는 그 이론이 어떻게 실제 언어로 구현되었는지, SQL이 어떤 역사적 흐름을 거쳐 현재의 모습이 되었는지를 살펴본다.

## SQL의 탄생: SEQUEL에서 SQL로

1974년 IBM 연구소의 도널드 체임벌린(Donald D. Chamberlin)과 레이먼드 보이스(Raymond F. Boyce)는 코드의 관계형 모델을 구현하기 위한 언어 **SEQUEL(Structured English Query Language)**을 발표했다. 상표권 문제로 이름을 SQL(Structured Query Language)로 바꾸어 IBM의 시스템 R 프로젝트에 적용했다.

1979년 오라클(당시 Relational Software Inc.)이 최초의 상용 SQL 데이터베이스를 출시했고, IBM도 1981년 SQL/DS, 1983년 DB2를 릴리즈하며 SQL은 관계형 데이터베이스의 사실상 표준 언어로 자리 잡았다.

```sql
-- SQL의 핵심 철학: 선언형(Declarative)
-- "어떻게"가 아닌 "무엇을"만 기술
SELECT dept, AVG(salary) AS avg_sal
FROM   employees
WHERE  hire_date >= '2020-01-01'
GROUP  BY dept
HAVING AVG(salary) > 50000;
```

## ANSI/ISO SQL 표준 역사

![SQL 표준 역사 타임라인](/assets/posts/sql-history-timeline.svg)

### SQL-86 (SQL1): 첫 번째 ANSI 표준

1986년 ANSI가 처음으로 SQL을 표준으로 채택했다. 기본적인 DDL(`CREATE TABLE`, `DROP TABLE`)과 DML(`SELECT`, `INSERT`, `UPDATE`, `DELETE`)이 정의되었다. 당시 표준은 매우 제한적이어서 각 벤더가 자체 확장을 추가했고, 방언(Dialect) 문제가 심각해졌다.

### SQL-92 (SQL2): 현대 SQL의 기준선

1992년 개정된 표준이 사실상 현대 SQL의 기준선이다. `OUTER JOIN`, `CASE` 표현식, `CAST`, 서브쿼리 표준화, 트랜잭션 격리 수준이 이때 정의되었다. 대부분의 DBMS가 SQL-92를 기본 지원한다.

### SQL:1999 (SQL3): 절차적 확장과 CTE

```sql
-- SQL:1999에서 추가된 WITH 절(비재귀 CTE)
WITH dept_stats AS (
    SELECT dept_id, AVG(salary) AS avg_sal
    FROM   employees
    GROUP  BY dept_id
)
SELECT d.dept_name, s.avg_sal
FROM   departments d
JOIN   dept_stats s ON d.dept_id = s.dept_id;
```

재귀 CTE, BOOLEAN 타입, 사용자 정의 타입(UDT), 트리거, OLAP 확장이 추가되었다. 또한 객체지향 개념이 부분적으로 도입되었다.

### SQL:2003: 윈도우 함수의 표준화

```sql
-- SQL:2003 윈도우 함수
SELECT name, dept, salary,
       RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS dept_rank,
       SUM(salary) OVER (ORDER BY hire_date ROWS UNBOUNDED PRECEDING) AS cum_sal
FROM   employees;
```

`OVER()` 절을 이용한 윈도우 함수, `MERGE` 문(UPSERT), `SEQUENCE`, XML 타입이 이 버전에서 정의되었다. 윈도우 함수는 현재 분석 쿼리에서 가장 중요한 기능 중 하나다.

### SQL:2016과 SQL:2023: 현대적 확장

![SQL 버전별 주요 기능](/assets/posts/sql-history-standards-table.svg)

SQL:2016은 JSON 처리 함수(`JSON_VALUE`, `JSON_QUERY`, `JSON_TABLE`)를 표준화하여 NoSQL과의 경계를 일부 허물었다. SQL:2023은 그래프 쿼리 확장(GQL), `ANY_VALUE` 집계 함수, `UNIQUE NULLS DISTINCT` 등 최신 데이터 처리 패턴을 반영했다.

## 표준과 방언(Dialect)의 현실

표준이 있어도 각 DBMS는 독자적인 확장을 제공한다. 이를 **SQL 방언(Dialect)**이라 한다.

| 기능 | SQL 표준 | Oracle | PostgreSQL | MySQL |
|------|---------|--------|-----------|-------|
| 페이지 처리 | `FETCH FIRST n ROWS` | `ROWNUM` / `FETCH` | `LIMIT/OFFSET` | `LIMIT` |
| 문자열 연결 | `\|\|` | `\|\|` | `\|\|` | `CONCAT()` |
| 날짜 차이 | `TIMESTAMPDIFF` | `날짜 빼기` | `DATE_PART` | `DATEDIFF` |
| 자동 증가 | `GENERATED ALWAYS AS IDENTITY` | `SEQUENCE` + 기본값 | `SERIAL` / `IDENTITY` | `AUTO_INCREMENT` |
| NULL 처리 | `COALESCE` | `NVL` / `COALESCE` | `COALESCE` | `IFNULL` / `COALESCE` |

```sql
-- 동일한 결과, 다른 문법 (상위 5개 조회)
-- SQL 표준
SELECT * FROM employees FETCH FIRST 5 ROWS ONLY;
-- MySQL/PostgreSQL
SELECT * FROM employees LIMIT 5;
-- Oracle 구버전
SELECT * FROM employees WHERE ROWNUM <= 5;
```

## 실무에서 알아야 할 것

1. **SQL-92 + SQL:1999(CTE) + SQL:2003(윈도우 함수)**를 마스터하면 현업 대부분의 쿼리를 작성할 수 있다
2. 사용하는 DBMS의 공식 문서에서 해당 버전이 어느 SQL 표준을 지원하는지 확인한다
3. 팀 내 다수의 DBMS를 사용한다면 가능한 한 표준 문법을 우선 사용해 이식성을 높인다
4. 방언을 써야 할 때는 주석으로 명시하거나 추상화 레이어(ORM)를 활용한다

## 정리

- SQL은 1974년 IBM의 **SEQUEL**에서 출발, 1986년 ANSI 표준화
- **SQL-92**: JOIN·서브쿼리 표준화 — 현재 기준선
- **SQL:1999**: CTE(WITH 절), 재귀 쿼리 — 복잡한 계층 쿼리 가능
- **SQL:2003**: 윈도우 함수(OVER/PARTITION BY) — 분석 쿼리 혁신
- **SQL:2016+**: JSON, 그래프 — 현대 데이터 형식 지원
- 표준과 방언은 공존하며, DBMS마다 지원 범위가 다르다

---

**지난 글:** [관계형 모델 이론 — 릴레이션, 튜플, 속성의 수학적 기초](/posts/sql-relational-model/)

**다음 글:** [DB 클라이언트-서버 프로토콜 — 연결부터 결과 반환까지](/posts/sql-client-server-protocol/)

<br>
읽어주셔서 감사합니다. 😊
