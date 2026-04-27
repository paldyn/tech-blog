---
title: "SQL의 역사와 표준 — ANSI/ISO/JIS"
description: "1970년 Codd 논문부터 SQL:2023까지, SQL이 어떻게 표준화되었는지 알아봅니다. 각 표준 버전의 핵심 추가 기능과 DBMS별 방언(Dialect)의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "ansi", "iso", "표준", "방언", "dialect", "역사"]
featured: false
draft: false
---

지난 [관계형 모델 이론 — 관계·튜플·속성](/posts/sql-relational-model/) 글에서 이어집니다.

관계형 모델의 수학적 기반을 이해했다면, 이제 그 모델을 실제 언어로 구현한 과정을 살펴볼 차례입니다. SQL은 처음부터 완성된 표준어로 등장하지 않았습니다. 수십 년의 경쟁·협력·표준화 과정을 거쳐 오늘의 모습이 됐습니다.

## SQL의 탄생: SEQUEL (1974)

![SQL 역사 타임라인](/assets/posts/sql-history-and-standard-timeline.svg)

IBM의 Donald Chamberlin과 Raymond Boyce는 1974년 Codd의 관계형 모델을 구현하기 위해 **SEQUEL(Structured English QUEry Language)**을 설계했습니다. IBM의 System R 프로젝트에서 사용됐고, 상표권 문제로 이름이 **SQL(Structured Query Language)**로 바뀌었습니다.

당시의 혁신은 "**무엇을**"만 말하고 "**어떻게**"는 DBMS에 맡기는 선언적 방식이었습니다.

```sql
-- 1974년 SEQUEL의 원형 (현대 SQL과 거의 동일)
SELECT name
FROM   employees
WHERE  dept = 'engineering'
ORDER  BY salary DESC;
```

반세기가 지난 지금도 이 문법 구조는 변하지 않았습니다.

## 상용화의 시작 (1979)

1979년 **Oracle(당시 Relational Software Inc.)**이 최초의 상용 SQL 기반 RDBMS인 **Oracle V2**를 출시했습니다. 아이러니하게도 IBM보다 먼저 상용화에 성공했습니다.

같은 시기 Sybase, Ingres, DB2 등이 등장하며 SQL 방언의 씨앗이 뿌려졌습니다. 각 회사가 독자적인 확장 문법을 추가하기 시작했습니다.

## 첫 ANSI 표준: SQL-86

1986년 **ANSI(American National Standards Institute)**가 SQL을 최초로 표준화했습니다. ISO도 1987년 같은 내용을 채택해 국제 표준이 됐습니다. 한국의 KS와 JIS(일본공업규격)도 ANSI/ISO를 따릅니다.

SQL-86은 매우 기초적이었습니다. `SELECT`, `INSERT`, `UPDATE`, `DELETE`와 기본 집계 함수 정도만 포함했고, `JOIN` 문법조차 표준화되지 않았습니다.

## SQL-92: 현재의 기반

1992년 개정된 **SQL-92(SQL2)**는 현재까지도 사실상 "기본 SQL"로 통용되는 버전입니다.

주요 추가 내용:

```sql
-- SQL-92에서 표준화된 JOIN 문법
SELECT e.name, d.dept_name
FROM   employees e
INNER  JOIN departments d ON e.dept_id = d.id;

-- OUTER JOIN
SELECT e.name, d.dept_name
FROM   employees e
LEFT   JOIN departments d ON e.dept_id = d.id;

-- CASE 표현식
SELECT name,
       CASE grade
         WHEN 'GOLD'   THEN '우수 고객'
         WHEN 'SILVER' THEN '일반 고객'
         ELSE               '신규 고객'
       END AS grade_label
FROM   customers;

-- CAST 형변환
SELECT CAST('2026-01-01' AS DATE);
```

SQL-92가 등장하기 전까지는 `JOIN` 문법도 DBMS마다 달랐습니다. Oracle의 `(+)` 표기, Sybase의 `*=` 표기가 혼용되다 SQL-92에서 `LEFT JOIN` 문법으로 통일됐습니다.

## SQL:1999 — 현대적 기능의 시작

**SQL:1999(SQL3)**은 관계형 모델에 없던 기능들을 대거 추가했습니다.

| 기능 | 설명 |
|------|------|
| **CTE (WITH 절)** | 서브쿼리에 이름을 붙여 재사용 |
| **재귀 쿼리** | 트리·그래프 탐색 |
| **윈도우 함수** | `OVER()` 절 집계 |
| **트리거** | DML 이벤트 자동 실행 |
| **저장 프로시저** | 서버 사이드 로직 |

```sql
-- SQL:1999 CTE (현재 모든 주요 RDBMS 지원)
WITH regional_sales AS (
  SELECT region, SUM(amount) AS total
  FROM   orders
  GROUP  BY region
)
SELECT region, total
FROM   regional_sales
WHERE  total > 1000000
ORDER  BY total DESC;
```

PostgreSQL 8.4+(2009), Oracle 9i+(2001), SQL Server 2005+에서 지원됩니다. MySQL은 8.0+(2018)에서야 CTE를 지원했습니다.

## SQL:2003 이후 — 세분화된 표준

2003년부터 SQL 표준은 여러 파트로 분리됐습니다.

```
ISO/IEC 9075
  Part 1: Framework
  Part 2: Foundation  ← 핵심 SQL
  Part 4: PSM (저장 프로시저)
  Part 14: XML 관련
  ...
```

**SQL:2003**은 `IDENTITY` 컬럼(자동 증가 PK), `MERGE` 문(UPSERT), XML 지원을 추가했습니다.

**SQL:2016**은 JSON 함수(`JSON_VALUE`, `JSON_QUERY`, `JSON_TABLE`)를 표준화했습니다.

**SQL:2023**은 그래프 패턴 매칭(GQL)과 추가 JSON 함수를 포함합니다.

## DBMS별 방언(Dialect)

![DBMS별 SQL 표준 준수 수준](/assets/posts/sql-history-and-standard-conformance.svg)

어떤 DBMS도 SQL 표준을 100% 구현하지 않습니다. 동시에 표준에 없는 확장 기능을 각자 추가합니다.

```sql
-- 행 수 제한: 4가지 방언

-- Oracle (12c 이전)
SELECT * FROM employees WHERE ROWNUM <= 10;

-- Oracle 12c+ / SQL Server 2012+ / PostgreSQL (표준 준수)
SELECT * FROM employees
FETCH FIRST 10 ROWS ONLY;

-- PostgreSQL / MySQL 비표준
SELECT * FROM employees LIMIT 10;

-- SQL Server (레거시)
SELECT TOP 10 * FROM employees;
```

이식성 있는 코드를 쓰려면 `FETCH FIRST n ROWS ONLY`(SQL:2008 표준)를 사용하는 것이 좋습니다. 단, MySQL 5.x 환경이라면 표준이 동작하지 않으므로 현실과 이상의 균형이 필요합니다.

## 표준을 공부해야 하는 이유

1. **이식성**: 표준 문법을 익히면 어느 DBMS에서든 80% 이상 재사용 가능합니다.
2. **이해의 깊이**: 방언 뒤에 있는 표준 개념을 알면 새 DBMS 학습 시간이 줄어듭니다.
3. **면접·자격증**: 국내 SQLD/SQLP 시험은 SQL-92/SQL:1999 기반입니다.

다만 Oracle에서 근무한다면 `ROWNUM`, `CONNECT BY`, `NVL` 같은 Oracle 방언을 적극 사용하는 것이 실용적입니다. 표준과 방언은 대립이 아니라 **보완 관계**입니다.

## 정리

SQL은 1974년 IBM의 실험적 프로젝트에서 시작해 1986년 ANSI 표준, 1992년 SQL-92 정착, 1999년 이후 현대적 기능 추가를 거쳐 현재 SQL:2023까지 발전했습니다. 핵심은 SQL-92를 기반으로 DBMS별 방언을 레이어로 이해하는 것입니다. 다음 글에서는 SQL 쿼리가 네트워크를 통해 어떻게 전달되는지, **클라이언트-서버 모델과 와이어 프로토콜**을 살펴봅니다.

---

**지난 글:** [관계형 모델 이론 — 관계·튜플·속성](/posts/sql-relational-model/)

**다음 글:** [클라이언트-서버 모델과 와이어 프로토콜](/posts/sql-client-server-protocol/)

<br>
읽어주셔서 감사합니다. 😊
