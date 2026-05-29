---
title: "SQL의 역사와 표준 — ANSI/ISO SQL이 만들어진 이유"
description: "1970년 Codd 논문부터 최신 SQL:2023까지, SQL이 어떻게 표준화되었고 각 DBMS가 어떤 방언을 사용하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQL", "SQL 표준", "ANSI SQL", "SQL 역사", "방언"]
featured: false
draft: false
---

[지난 글](/posts/sql-relational-model/)에서 관계형 모델의 수학적 토대를 살펴봤습니다. 이번 글은 그 이론이 실제 언어인 SQL로 어떻게 구체화되었는지, 그리고 왜 "표준 SQL"이 존재하는지를 역사적 맥락에서 짚어봅니다.

## SEQUEL에서 SQL로

1970년 Edgar F. Codd가 IBM 연구소에서 관계형 모델을 제안한 이후, IBM 연구팀은 이 이론을 구현하는 언어를 개발하기 시작합니다. 1974년 Donald Chamberlin과 Raymond Boyce는 **SEQUEL(Structured English QUEry Language)**을 발표합니다. 상표권 문제로 이름이 **SQL**로 바뀌었지만 발음은 아직도 두 가지가 혼용됩니다.

1979년 Relational Software Inc.(후의 Oracle)가 최초로 상용 RDBMS를 출시하면서 SQL은 사실상 업계 표준으로 자리잡기 시작합니다. IBM도 같은 해 DB2 전신인 System R을 출시합니다.

## ANSI/ISO 표준화 역사

![SQL 역사 타임라인](/assets/posts/sql-history-and-standard-timeline.svg)

각 표준의 핵심 기여를 정리하면 다음과 같습니다.

**SQL-86 (SQL1)**: ANSI가 처음으로 채택한 표준. SELECT, INSERT, UPDATE, DELETE 기본 구문을 정의했습니다. 현재 기준으로는 매우 제한적이었습니다.

**SQL-92 (SQL2)**: 가장 폭넓게 구현된 표준입니다. JOIN의 명시적 문법(`INNER JOIN`, `LEFT OUTER JOIN`), 서브쿼리, `CASE` 표현식, `CAST`, 문자열 함수가 추가되었습니다. 지금도 "SQL"이라고 하면 많은 사람이 이 버전을 떠올립니다.

**SQL:1999 (SQL3)**: 패러다임을 바꾼 버전입니다. `WITH` 절(CTE), 재귀 쿼리, 윈도우 함수, 사용자 정의 타입, 트리거, 저장 프로시저가 표준에 포함됩니다.

**SQL:2003**: `MERGE`, `SEQUENCE`, XML 지원, `ROW_NUMBER()` 등이 추가됩니다.

**SQL:2016 이후**: JSON 함수, 행 패턴 인식(`MATCH_RECOGNIZE`), 다형적 테이블 함수가 추가되며 현재까지 이어집니다.

## 방언(Dialect): 표준을 벗어나는 확장

표준이 있어도 각 DBMS는 표준을 부분적으로만 구현하고, 독자적인 확장을 추가합니다. 이를 **SQL 방언**이라 부릅니다.

![SQL 방언 비교](/assets/posts/sql-history-and-standard-dialect.svg)

자주 마주치는 방언 차이를 예시로 보면 다음과 같습니다.

```sql
-- 상위 3행 가져오기
-- ANSI SQL:2008+
SELECT * FROM products ORDER BY price FETCH FIRST 3 ROWS ONLY;

-- MySQL / MariaDB
SELECT * FROM products ORDER BY price LIMIT 3;

-- SQL Server (T-SQL)
SELECT TOP 3 * FROM products ORDER BY price;

-- Oracle (12c 이전)
SELECT * FROM (
    SELECT * FROM products ORDER BY price
) WHERE ROWNUM <= 3;
```

같은 결과를 얻는데 문법이 네 가지입니다. 이 때문에 ORM이나 마이그레이션 도구가 방언 추상화를 맡는 경우가 많습니다.

## 표준을 배워야 하는 이유

방언 차이가 크더라도 표준 SQL을 먼저 익히는 것이 중요합니다.

1. **이식성**: 표준 문법은 어떤 DBMS에서도 동작하거나 최소한 해석 가능합니다.
2. **이해력**: 방언을 이해하려면 표준이 기준점이 되어야 합니다.
3. **미래 대비**: DBMS들은 시간이 지나면서 표준 쪽으로 수렴하는 경향이 있습니다(예: MySQL 8.0의 윈도우 함수 지원).

이 시리즈는 특정 DBMS에 치우치지 않고 표준 SQL을 기반으로 설명하되, 벤더별 차이가 중요한 지점에서는 명시적으로 표기합니다.

## 정리

SQL은 이론(관계형 모델) → 실험적 구현(SEQUEL) → 상용화 → 표준화의 경로를 거쳐 지금에 이르렀습니다. 표준은 50년에 걸쳐 꾸준히 확장되었고, 각 DBMS는 표준을 부분 구현하면서 독자 기능을 추가했습니다. 다음 글에서는 클라이언트가 SQL을 DBMS로 전달하는 프로토콜 계층을 살펴봅니다.

---

**지난 글:** [관계형 모델의 핵심 — 테이블, 키, 그리고 관계](/posts/sql-relational-model/)

**다음 글:** [클라이언트-서버 프로토콜 — SQL이 전달되는 방식](/posts/sql-client-server-protocol/)

<br>
읽어주셔서 감사합니다. 😊
