---
title: "SQL의 역사와 표준 — ANSI/ISO/JIS"
description: "1970년 코드의 논문부터 SQL:2023까지, SQL 표준이 어떤 필요에 의해 만들어지고 어떻게 진화했는지를 연대순으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "표준", "ansi", "iso", "sql92", "sql2003", "역사"]
featured: false
draft: false
---

## SQL은 처음부터 표준이 아니었다

앞선 두 글에서 데이터베이스의 필요성과 관계형 모델의 수학적 기반을 살펴봤다. 이번 글은 그 이론이 실제 언어로 발전하고 표준화되는 과정을 따라간다.

SQL(Structured Query Language)은 처음부터 "표준"으로 만들어진 언어가 아니다. 기업의 연구 프로젝트에서 시작해, 경쟁 제품들이 뒤따라 구현하면서 사실상 표준(de facto standard)이 되었고, 나중에야 공식 표준(de jure standard)이 만들어진다.

---

## 태동기: 1970년대

![SQL 역사 타임라인](/assets/posts/sql-history-and-standard-timeline.svg)

### 1970 — 코드의 논문

IBM의 에드거 F. 코드(Edgar F. Codd)가 *Communications of the ACM*에 논문을 발표한다. 이 논문은 수학적 집합론을 데이터 관리에 적용하는 아이디어를 담고 있으며, 관계형 모델이라는 용어를 처음 사용한다.

당시 IBM은 코드의 아이디어를 처음에 회의적으로 바라봤다. 기존 제품(IMS, 계층형 DB)과 경쟁하기 때문이었다.

### 1974 — SEQUEL (System R)

IBM 산호세 연구소의 도널드 체임벌린(Donald Chamberlin)과 레이먼드 보이스(Raymond Boyce)가 코드의 이론을 구현하는 언어 **SEQUEL**을 개발한다. **S**tructured **E**nglish **QUE**ry **L**anguage의 약자다.

이 언어는 영국 항공사 상표권 문제로 **SQL**로 이름을 바꾼다.

### 1979 — 첫 상업 제품

스타트업 **Oracle**(당시 Relational Software Inc.)이 SQL을 탑재한 최초의 상업용 RDBMS **Oracle v2**를 출시한다. IBM보다 먼저다. 이 시점부터 SQL은 상업 소프트웨어의 언어로 자리잡기 시작한다.

---

## 표준화: 1980~90년대

### 1986/87 — SQL-86 (첫 ANSI/ISO 표준)

수많은 업체가 제각각의 SQL 방언을 구현하면서 호환성 문제가 심각해진다. **ANSI**(미국 국가 표준 협회)가 1986년 SQL의 첫 공식 표준 **ANSI X3.135-1986**을 제정한다. 이듬해 **ISO/IEC 9075:1987**로 채택된다.

SQL-86은 기본 SELECT, FROM, WHERE, INSERT, UPDATE, DELETE, CREATE TABLE을 정의했다. 수준이 낮아 업체들이 독자 확장을 계속했다.

### 1989 — SQL-89

사소한 수정판. NOT NULL 기본값 명확화, 무결성 강화 등 소폭 개정.

### 1992 — SQL-92 (SQL2) — 실질적 기준선

SQL의 역사에서 가장 중요한 이정표다. 오늘날 DBMS가 지원한다고 할 때의 "SQL"은 대부분 SQL-92 기준이다.

```sql
-- SQL-92에서 표준화된 주요 문법들

-- OUTER JOIN
SELECT e.name, d.dept_name
FROM   employees e
LEFT OUTER JOIN departments d ON e.dept_id = d.id;

-- CASE 표현식
SELECT name,
       CASE WHEN salary > 5000 THEN '고액'
            WHEN salary > 3000 THEN '중간'
            ELSE '기본'
       END AS salary_grade
FROM   employees;

-- 서브쿼리 (스칼라, 인라인 뷰)
SELECT name
FROM   employees
WHERE  salary > (SELECT AVG(salary) FROM employees);
```

SQL-92는 Entry, Intermediate, Full 세 가지 준수 수준을 정의했지만, 대부분의 DBMS는 Entry 수준도 완전히 구현하지 않았다.

---

## 현대화: 1999년 이후

### SQL:1999 (SQL3)

SQL:1999부터 연도 표기 방식이 바뀐다(SQL-92 → SQL:1999).

핵심 추가 기능:
- **재귀 CTE** (`WITH RECURSIVE`) — 계층 데이터 순회
- **트리거(TRIGGER)** — 이벤트 기반 자동 실행
- **ROLLUP, CUBE** — 다차원 집계
- 객체지향 기능 (대부분 DBMS에서 외면)

### SQL:2003

실무자들이 가장 자주 참조하는 버전이다.

- **윈도우 함수** (`ROW_NUMBER`, `RANK`, `DENSE_RANK`, `OVER`)
- **MERGE 문** (UPSERT)
- **생성 컬럼** (`GENERATED ALWAYS AS`)
- XML 타입 지원

```sql
-- SQL:2003 윈도우 함수 (현재 모든 주요 DBMS 지원)
SELECT
  dept_id,
  name,
  salary,
  RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dept_rank
FROM employees;
```

### SQL:2011

- **임시 테이블(Temporal Tables)** — 데이터 이력 자동 관리
- `PERIOD FOR SYSTEM_TIME` — 유효 기간 관리
- `FETCH FIRST n ROWS ONLY` 표준화

### SQL:2016

- **JSON 함수** (`JSON_VALUE`, `JSON_QUERY`, `JSON_TABLE`)
- ISO 표준에서 JSON을 공식 지원

### SQL:2023 (최신)

- **속성 그래프 쿼리(Property Graph Query, GQL)** — 관계 탐색
- `UUID` 생성 함수 표준화
- `LOG(base, x)`, 삼각함수 추가
- `LISTAGG` (문자열 집계)

---

## ANSI · ISO · JIS의 관계

![SQL 표준별 주요 기능](/assets/posts/sql-history-and-standard-features.svg)

세 기관이 SQL 표준을 관리한다.

| 기관 | 표준 번호 | 역할 |
|------|----------|------|
| ANSI | X3.135 (구식), INCITS 135 | 미국 국가 표준 |
| ISO/IEC | ISO/IEC 9075 | 국제 표준 (주도) |
| JIS | JIS X 3005 | 일본 국가 표준 (ISO 번역) |

실질적으로는 **ISO/IEC 9075**가 기준이고, ANSI와 JIS는 이를 국가 표준으로 채택한다. ISO 9075는 총 14개의 파트로 구성되며, 핵심은 파트 1(프레임워크), 파트 2(기초)다.

---

## DBMS별 표준 준수 현실

표준은 있지만 DBMS가 100% 준수하는 경우는 없다.

```text
공통 현실:
  ✓ SQL-92 핵심 문법: 모든 주요 DBMS 지원
  ✓ SQL:2003 윈도우 함수: 주요 DBMS 지원
  △ SQL:2011 임시 테이블: MariaDB, MSSQL 지원, MySQL 미지원
  △ SQL:2016 JSON: 각자 방언으로 구현 (함수명 다름)
  △ SQL:2023: 아직 도입 중

방언 예시:
  LIMIT 100           -- MySQL, PostgreSQL
  FETCH FIRST 100 ROWS ONLY  -- SQL:2008 표준, Oracle 12c+, DB2
  TOP 100             -- SQL Server (비표준)
  ROWNUM <= 100       -- Oracle 구식 (비표준)
```

이 시리즈의 Part I(공통 기반)은 ANSI SQL 표준을 기준으로 설명하되, 주요 DBMS의 방언을 각주처럼 언급한다. DBMS별 세부 사항은 Part II~VI에서 심층적으로 다룬다.

---

## 표준 문서를 직접 읽으려면

ISO/IEC 9075는 유료 문서다. 무료 대안으로:
- **PostgreSQL 문서의 표준 준수 표** — 어떤 기능이 표준인지 가장 잘 정리되어 있다.
- **SQLite 문서의 SQL 방언 비교** — 표준과 구현 차이를 솔직하게 설명.

---

## 정리

- SQL은 1970년 코드의 논문 → IBM의 SEQUEL → 1986년 첫 ANSI 표준 순으로 탄생.
- **SQL-92**가 현재 SQL의 기본 문법 기준선이다.
- **SQL:2003**이 윈도우 함수를 완성하며 분석 쿼리의 새 시대를 열었다.
- ISO/IEC 9075가 국제 표준을 주도하며, ANSI와 JIS는 이를 국가 표준으로 채택.
- DBMS는 표준을 완전히 준수하지 않으며, 방언(dialect)이 존재한다.

**다음 글:** 클라이언트-서버 모델과 와이어 프로토콜 — SQL 명령이 어떻게 DBMS에 도달해 처리되고 결과가 돌아오는지를 네트워크 수준에서 추적합니다.

<br>
읽어주셔서 감사합니다. 😊
