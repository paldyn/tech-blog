---
title: "SQL의 역사와 표준: ANSI SQL에서 SQL:2023까지"
description: "1970년 Codd의 논문부터 SQL:2023까지, SQL 표준의 역사와 각 버전에서 추가된 핵심 기능, 주요 RDBMS의 표준 구현도를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQL역사", "SQL표준", "ANSI", "SQL:2023", "SQL:1999", "SQL방언"]
featured: false
draft: false
---

[지난 글](/posts/sql-relational-model/)에서 관계 모델의 수학적 토대를 살펴봤다. 이번에는 그 이론이 어떻게 SQL이라는 언어로 구현되어 표준화되었는지, 그리고 수십 년의 역사 속에서 어떤 기능이 추가되었는지 살펴본다.

## SQL의 탄생: 1970~1979

1970년 코드가 관계 모델을 제안한 직후, IBM은 San Jose Research Lab에서 이 모델을 구현하는 프로토타입을 만들기 시작했다. 1974년 도널드 챔벌린(Donald Chamberlin)과 레이먼드 보이스(Raymond Boyce)는 **SEQUEL(Structured English QUEry Language)**이라는 이름의 언어를 발표했다. 상표 문제로 이름이 SQL로 줄었지만, 여전히 "씨퀄"이라고 읽는 관습이 남아 있다.

1979년 Oracle(당시 Relational Software Inc.)이 최초의 상용 SQL RDBMS인 Oracle Version 2를 출시했다. IBM이 자체 제품(DB2) 출시를 미루는 사이 Oracle이 시장을 선점했다.

## 표준화의 시작: SQL-86과 SQL-92

![SQL 역사 타임라인](/assets/posts/sql-history-and-standard-timeline.svg)

**SQL-86(SQL-87)**은 ANSI가 채택한 최초의 SQL 표준이다. 기본 SELECT/INSERT/UPDATE/DELETE, 간단한 WHERE 조건, 무결성 제약(NOT NULL, UNIQUE)을 포함했다.

**SQL-92(SQL2)**는 현재 많은 교과서가 "기본 SQL"로 가르치는 내용의 대부분을 담고 있다.

- `INNER JOIN`, `LEFT OUTER JOIN` 등 조인 구문 표준화
- 서브쿼리(subquery) 공식 지원
- `CASE` 표현식
- `CAST` 타입 변환
- `INFORMATION_SCHEMA` (스키마 메타데이터 조회)
- `CREATE TABLE AS SELECT`

```sql
-- SQL-92에서 표준화된 명시적 JOIN 구문
SELECT e.name, d.dept_name
FROM   employees e
  INNER JOIN departments d ON e.dept_id = d.id
WHERE  d.location = 'Seoul';
```

SQL-92 이전에는 FROM 절에 테이블을 나열하고 WHERE에서 조인 조건을 쓰는 묵시적 조인이 일반적이었다. 명시적 JOIN이 가독성과 의미 명확성 면에서 훨씬 우수하다.

## 현대 SQL의 토대: SQL:1999~2003

**SQL:1999(SQL3)**는 SQL에 여러 중요한 기능을 추가했다.

- **CTE(Common Table Expression)**: `WITH` 절로 임시 이름을 가진 서브쿼리 작성
- **재귀 쿼리(Recursive CTE)**: 계층 구조 데이터 탐색
- **사용자 정의 타입(UDT)**: 도메인 특화 타입 정의
- **트리거(Trigger)**: 이벤트 기반 자동 실행

```sql
-- SQL:1999 CTE
WITH dept_tree AS (
    SELECT id, name, parent_id, 1 AS depth
    FROM   departments
    WHERE  parent_id IS NULL
    UNION ALL
    SELECT d.id, d.name, d.parent_id, t.depth + 1
    FROM   departments d
      JOIN dept_tree t ON d.parent_id = t.id
)
SELECT * FROM dept_tree ORDER BY depth, name;
```

**SQL:2003**에서는 **윈도우 함수(Window Functions)**가 추가되었다. `ROW_NUMBER()`, `RANK()`, `SUM() OVER()` 같은 분석 함수들이 이 버전에서 표준이 되었다. 현대 데이터 분석 쿼리의 핵심 도구다.

## 최근 표준: SQL:2011~2023

| 버전 | 주요 추가 기능 |
|------|--------------|
| SQL:2008 | `TRUNCATE`, `FETCH FIRST n ROWS ONLY` |
| SQL:2011 | Temporal Table (시간 이력 관리), `WITH SYSTEM TIME` |
| SQL:2016 | JSON 함수 표준화, Row Pattern Matching |
| SQL:2019 | Graph Query Language (GQL) 개념 도입 |
| SQL:2023 | GQL 확정, JSON 함수 확장, UNIQUE NULL 처리 |

**SQL:2023**의 가장 큰 변화는 **ISO/IEC 39075 GQL(Graph Query Language)**의 SQL 통합이다. 관계형 데이터와 그래프 데이터를 단일 쿼리 언어로 다룰 수 있게 되었다.

## 표준과 방언의 현실

![SQL 표준 구현도](/assets/posts/sql-history-and-standard-versions.svg)

이론상 "ANSI SQL을 쓰면 어디서나 돌아간다"지만 현실은 다르다.

**방언(dialect)이 생기는 이유:**
1. 표준이 제정되기 전에 이미 각 DB가 독자 구현을 먼저 출시했다
2. 표준 준수 범위를 DB 벤더가 결정한다 (어떤 수준까지 구현할지)
3. 성능 최적화를 위해 표준 외 확장을 추가한다

**대표적인 방언 차이:**

```sql
-- 문자열 이어붙이기 (String Concatenation)
-- PostgreSQL / SQL Server / Oracle: 표준 ||
SELECT 'Hello' || ' World';

-- MySQL: CONCAT 함수만 지원 (|| 은 OR 연산자)
SELECT CONCAT('Hello', ' World');

-- 현재 날짜/시간
-- 표준: CURRENT_TIMESTAMP
-- MySQL: NOW()
-- Oracle: SYSDATE
-- SQL Server: GETDATE()
```

이 시리즈는 표준 SQL을 기준으로 설명하되, 주요 DB의 방언 차이를 필요할 때 명시한다.

## SQL 표준 문서 읽기

SQL 표준은 ISO/IEC 9075 시리즈로 관리된다. 총 14개 파트로 나뉘어 있으며, 가장 많이 참조되는 건 Part 2 (Foundation)다. 공개 무료 버전은 없지만, 각 표준 초안(draft)은 여러 곳에서 찾을 수 있다.

실무에서 표준을 직접 읽는 경우는 드물지만, PostgreSQL·MySQL의 공식 문서는 기능마다 지원하는 SQL 표준 버전을 명시해 두어 유용하다.

---

**지난 글:** [관계 모델: 집합론 위에 세운 데이터 구조](/posts/sql-relational-model/)

**다음 글:** [SQL 클라이언트-서버 프로토콜과 쿼리 처리 흐름](/posts/sql-client-server-protocol/)

<br>
읽어주셔서 감사합니다. 😊
