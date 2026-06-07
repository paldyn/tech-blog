---
title: "SQL의 역사와 표준 — ISO SQL이 중요한 이유"
description: "SQL이 어떻게 탄생하고 표준화되었는지, SQL-86부터 SQL:2023까지의 역사와 각 DBMS 방언의 차이를 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQL", "표준SQL", "SQL역사", "ANSI", "ISO"]
featured: false
draft: false
---

[지난 글](/posts/sql-relational-model/)에서 관계형 모델의 수학적 기초를 살펴봤다. 이번에는 그 이론이 어떻게 실제 언어로 구현되었는지, SQL이 탄생하고 표준화되는 과정을 짚는다. 역사를 알면 왜 특정 문법이 그 모양인지, 왜 DBMS마다 조금씩 다른지가 이해된다.

## SEQUEL에서 SQL로

1970년 에드거 F. 코드가 관계형 모델 논문을 발표한 후, IBM 연구소의 도널드 챔벌린(Donald Chamberlin)과 레이먼드 보이스(Raymond Boyce)가 1974년 코드의 이론을 실제로 사용 가능한 언어로 구현했다. 처음 이름은 **SEQUEL(Structured English Query Language)**. "영어처럼 읽히는 쿼리 언어"를 목표로 했다.

상표권 문제로 이름이 **SQL(Structured Query Language)**로 바뀌었고, IBM의 System R 프로젝트에서 실제 동작하는 구현체가 만들어졌다. 1979년에는 오라클(당시 SDL)이 System R을 참고해 최초의 상용 관계형 데이터베이스인 Oracle v2를 출시했다.

![SQL 역사 타임라인](/assets/posts/sql-history-and-standard-timeline.svg)

## SQL 표준의 진화

### SQL-86 / SQL-89 (SQL1)

1986년 ANSI, 1987년 ISO에서 첫 표준이 채택되었다. `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WHERE`, `GROUP BY`, `HAVING`이 이 시기에 정의되었다. 지금도 가장 많이 쓰는 핵심 문법들이다.

### SQL-92 (SQL2)

현재도 "SQL 기본"으로 불리는 버전이다. `OUTER JOIN`, `CASE` 표현식, `CAST`, 서브쿼리, 트랜잭션 격리 수준(READ COMMITTED 등), `CREATE TABLE`, `ALTER TABLE`이 표준화되었다. 이 버전을 잘 구현한 DBMS가 **"ANSI SQL 호환"**이라고 표시한다.

### SQL:1999 (SQL3)

OOP 개념 추가와 함께 **CTE(WITH 절)**, **재귀 쿼리**, 트리거, 저장 루틴, 다차원 데이터 타입이 도입되었다. 콜론(:) 구분자 도입도 이때부터다(SQL-92까지는 하이픈).

### SQL:2003~2016

**윈도우 함수**(`OVER`, `PARTITION BY`), **MERGE**, **XML** 지원, **SEQUENCE**가 2003년에 들어왔다. 2016년에는 **JSON 함수**(`JSON_VALUE`, `JSON_OBJECT`)와 **행 패턴 인식(MATCH_RECOGNIZE)**이 추가되었다.

### SQL:2023

그래프 데이터를 SQL에서 직접 다루기 위한 **GQL(Graph Query Language)** 통합이 가장 큰 변화다. `UNIQUE` 제약의 NULL 처리 개선, 다중 파라미터 GREATEST/LEAST도 포함된다.

## DBMS별 방언(Dialect)

표준이 있어도 각 DBMS는 독자 확장을 추가한다. 표준을 앞서가거나, 상업적 차별화가 목적이거나, 역사적 이유로 이미 굳어진 경우다.

```sql
-- 페이지네이션: 같은 목적, 다른 문법
-- Standard SQL:2008+ (PostgreSQL, MySQL 8+)
SELECT * FROM 고객 ORDER BY 고객ID FETCH FIRST 10 ROWS ONLY;

-- MySQL / MariaDB
SELECT * FROM 고객 ORDER BY 고객ID LIMIT 10;

-- SQL Server (T-SQL)
SELECT TOP 10 * FROM 고객 ORDER BY 고객ID;

-- Oracle (12c 이전)
SELECT * FROM 고객 WHERE ROWNUM <= 10 ORDER BY 고객ID;
```

![DBMS별 SQL 방언 비교](/assets/posts/sql-history-and-standard-dialects.svg)

## 표준을 배워야 하는 이유

방언을 먼저 배우면 특정 DBMS에 종속된다. 표준 SQL을 기반으로 익히면:

- **이식성**: MySQL에서 PostgreSQL로 이전할 때 코드 수정이 최소화된다.
- **일관된 이해**: 동일 개념이 왜 다른 문법으로 표현되는지 이해할 수 있다.
- **최적화 사고**: 실행 계획 이해, 쿼리 재작성 등은 표준 개념 위에서 이루어진다.

이 시리즈는 **ISO SQL 표준**을 기준으로 설명하고, DBMS별로 중요한 차이가 있을 때만 별도로 표기한다.

## 표준 준수 수준

표준을 "완전히" 구현한 DBMS는 없다. ISO 표준은 Core SQL과 여러 Feature로 나뉘며, DBMS마다 구현 수준이 다르다. PostgreSQL이 표준 준수율이 가장 높은 것으로 알려져 있고, Oracle과 SQL Server는 각자의 확장이 풍부하다. MySQL/MariaDB는 실용성 중심으로 발전했다.

표준 문법이 동작하지 않을 때는 해당 DBMS 문서의 "Compatibility" 또는 "Non-standard extension" 섹션을 확인하면 대안을 찾을 수 있다.

---

**지난 글:** [관계형 모델의 수학적 기초 — 릴레이션과 집합 이론](/posts/sql-relational-model/)

**다음 글:** [SQL 클라이언트-서버 프로토콜 — 쿼리가 실행되는 과정](/posts/sql-client-server-protocol/)

<br>
읽어주셔서 감사합니다. 😊
