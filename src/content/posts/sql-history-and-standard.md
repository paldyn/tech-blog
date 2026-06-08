---
title: "SQL의 역사와 표준 — ANSI SQL부터 SQL:2023까지"
description: "1970년 Codd의 논문에서 시작해 SQL-86, SQL-92, SQL:1999, SQL:2023까지 표준의 진화를 정리하고, Oracle·PostgreSQL·MySQL·SQL Server가 왜 서로 다른 방언을 갖는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQL", "ANSI SQL", "SQL표준", "SQL역사", "SQL방언", "SQL92", "SQL2023"]
featured: false
draft: false
---

[지난 글](/posts/sql-relational-model/)에서 관계 모델의 수학적 기초를 다뤘다. 이론은 아름답지만, 실제로 우리가 쓰는 SQL은 그 이론이 수십 년에 걸쳐 표준화위원회, 상용 DBMS 벤더, 오픈소스 커뮤니티를 거치며 진화한 결과다. SQL의 역사를 알면 왜 Oracle의 `ROWNUM`이 PostgreSQL에서 안 되고, 왜 MySQL과 SQL Server가 `LIMIT`와 `TOP`으로 갈리는지 이해할 수 있다.

## SEQUEL에서 SQL로

1974년 IBM 산호세 연구소의 Donald Chamberlin과 Raymond Boyce는 Codd의 관계 모델을 구현하기 위한 언어인 **SEQUEL(Structured English Query Language)**을 발표했다. 이후 상표권 문제로 **SQL(Structured Query Language)**로 이름을 바꿨다. IBM은 이를 System R라는 프로토타입에 적용했다.

1979년 Larry Ellison이 이 연구를 참조해 Oracle(당시 Relational Software)에서 최초의 상용 SQL RDBMS를 출시했다. IBM도 1981년 SQL/DS, 1983년 DB2를 출시했다. 시장이 형성되면서 표준화의 필요성이 대두되었다.

## ANSI/ISO 표준의 역사

![SQL 역사 타임라인](/assets/posts/sql-history-and-standard-timeline.svg)

### SQL-86 (SQL-87)

1986년 ANSI, 1987년 ISO가 SQL의 첫 번째 공식 표준을 발표했다. 기본 `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`이 포함되었다. 하지만 이 표준은 너무 기초적이어서 실제 DBMS는 이미 각자 확장을 개발한 뒤였다.

### SQL-92 (SQL2)

1992년 발표된 SQL-92는 현재도 "호환성의 기준선"으로 불린다. 오늘날 모든 주요 RDBMS가 이 표준을 지원한다. `OUTER JOIN`, `CASE` 표현식, 서브쿼리, `CAST`, 날짜/시간 타입, 국제 문자 집합 등이 추가되었다.

### SQL:1999 (SQL3)

SQL:1999는 절차적 요소와 객체 지향 개념을 도입했다. `WITH` 절(CTE)과 재귀 쿼리의 초안, 그리고 윈도우 함수의 개념이 포함되었다. 이후 SQL:2003에서 윈도우 함수가 최종 확정되었다.

### SQL:2003 ~ SQL:2016

SQL:2003은 `OVER()` 문법으로 윈도우 함수를 확정하고, `SEQUENCE` 객체, XML 통합을 추가했다. SQL:2008은 `FETCH FIRST n ROWS ONLY` 구문을 표준화했다(LIMIT/TOP의 표준 대안). SQL:2016은 JSON 관련 함수를 도입했다.

### SQL:2023

가장 최근 표준은 **Property Graph Query(GQL)**, JSON 타입 강화, `CALL` 문법, `ANY_VALUE` 집계 함수 등을 포함한다. 그래프 데이터를 SQL로 쿼리하는 기능이 표준에 편입된 것이 큰 변화다.

## 방언(Dialect)이 생기는 이유

각 DBMS 벤더는 표준 위원회의 결정을 기다리지 않고 먼저 기능을 구현했다. 표준이 나오더라도 하위 호환성 때문에 기존 방언을 제거하기 어렵다. 그 결과 같은 기능이 DBMS마다 다른 문법을 가지게 되었다.

페이지네이션이 대표적인 예다.

![DBMS별 방언 비교](/assets/posts/sql-history-and-standard-dialect.svg)

### 문자열 연결

```sql
-- Oracle, PostgreSQL (ANSI 표준 ||)
SELECT first_name || ' ' || last_name FROM employees;

-- SQL Server
SELECT first_name + ' ' + last_name FROM employees;
-- 또는 표준 함수
SELECT CONCAT(first_name, ' ', last_name) FROM employees;

-- MySQL (|| 는 기본적으로 OR 연산자 — CONCAT 권장)
SELECT CONCAT(first_name, ' ', last_name) FROM employees;
```

### 자동 증가 키

```sql
-- MySQL / MariaDB
CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY);

-- PostgreSQL
CREATE TABLE t (id SERIAL PRIMARY KEY);
-- 또는 표준 방식 (PostgreSQL 10+)
CREATE TABLE t (id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY);

-- Oracle (12c+)
CREATE TABLE t (id NUMBER GENERATED ALWAYS AS IDENTITY);

-- SQL Server
CREATE TABLE t (id INT IDENTITY(1,1) PRIMARY KEY);
```

## 표준 준수 수준

ANSI SQL은 Entry, Intermediate, Full 세 등급으로 준수 수준을 나눈다. 실제로 Full 수준을 완벽히 구현하는 DBMS는 없다. 표준 준수 수준이 높을수록 이식성이 좋지만, 벤더 고유 기능을 쓸수록 성능 최적화 여지가 커진다.

실무에서 중요한 원칙은 이렇다. **공통 기능은 표준 SQL로, DBMS 고유 최적화가 필요한 부분만 방언을 쓴다.** 예를 들어 기본 CRUD와 조인은 표준 SQL로 작성해 이식성을 확보하고, 파티셔닝이나 인덱스 힌트처럼 성능에 직결되는 부분은 DBMS별 문법을 허용한다.

이 시리즈는 SQL-92 이상의 표준을 기준으로, 각 DBMS의 방언은 차이가 있을 때 명시적으로 표기한다.

---

**지난 글:** [관계 모델의 수학적 기초 — 릴레이션, 속성, 튜플](/posts/sql-relational-model/)

**다음 글:** [클라이언트-서버 프로토콜과 커넥션 관리](/posts/sql-client-server-protocol/)

<br>
읽어주셔서 감사합니다. 😊
