---
title: "RDB란 무엇인가: 관계형 데이터베이스의 본질"
description: "관계형 데이터베이스(RDB)의 핵심 개념인 테이블·행·열·기본 키를 명확히 정리하고, RDBMS가 SQL 쿼리를 처리하는 흐름을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["RDB", "관계형데이터베이스", "RDBMS", "SQL기초", "테이블구조"]
featured: false
draft: false
---

데이터를 다루는 직군이라면 "RDB를 쓴다"는 말을 하루에도 수십 번 듣는다. 그런데 RDB가 정확히 어떤 구조로 데이터를 저장하고, RDBMS가 SQL을 받아 어떻게 결과를 돌려주는지 한 번이라도 제대로 살펴본 사람은 의외로 드물다. 이 시리즈의 첫 번째 글에서는 바로 그 질문에 답한다.

## 관계형 데이터베이스란

RDB(Relational Database)는 **데이터를 테이블(table) 형태로 저장**하고, 테이블 간 관계(relation)를 키(key)로 연결하는 데이터베이스다. 1970년 IBM 연구원 에드거 코드(Edgar F. Codd)가 집합론을 토대로 제안한 **관계 모델**을 구현한 것이다.

핵심 특징은 세 가지다.

- **구조화된 스키마**: 데이터를 저장하기 전에 열(column)의 이름과 타입을 미리 정의한다.
- **SQL 인터페이스**: 데이터 조회·조작·정의를 표준화된 SQL 언어 하나로 수행한다.
- **참조 무결성**: 외래 키(FK)를 통해 테이블 간 데이터 일관성을 데이터베이스가 자동으로 보장한다.

## 테이블의 해부학

![관계형 테이블 구조](/assets/posts/sql-what-is-rdb-structure.svg)

RDB에서 데이터의 기본 단위는 **테이블(table)**이다. 수학적으로는 릴레이션(relation)이라고 부른다.

| 용어 | 다른 이름 | 설명 |
|------|-----------|------|
| 테이블 | 릴레이션(relation) | 행과 열의 2차원 구조 |
| 열(column) | 속성(attribute) | 테이블이 저장하는 데이터 항목 |
| 행(row) | 튜플(tuple), 레코드 | 하나의 완전한 데이터 단위 |
| 셀(cell) | 값(value) | 특정 행·열의 교차점에 저장된 값 |
| 기본 키(PK) | Primary Key | 각 행을 유일하게 식별하는 열 |

**도메인(domain)**은 특정 열이 가질 수 있는 값의 집합이다. 예를 들어 `age` 열의 도메인은 0 이상의 정수다. 도메인에 맞지 않는 값은 RDBMS가 거부한다.

**카디널리티(cardinality)**는 테이블이 가진 행의 수, **차수(degree)**는 열의 수를 뜻한다.

## 왜 파일 시스템이 아닌 RDB인가

파일에 데이터를 저장하면 안 되는 이유는 크게 세 가지다.

**첫째, 중복(redundancy).** 파일마다 같은 데이터를 복사하면 수정 시 한 곳만 바뀌고 다른 곳은 구식이 된다.

**둘째, 무결성 보장 불가.** 프로그래머가 직접 유효성 검사 코드를 작성해야 하며, 팀이 커질수록 규칙이 제각각이 된다.

**셋째, 동시성 처리.** 여러 사용자가 같은 파일을 동시에 쓰면 데이터가 깨진다. RDBMS는 트랜잭션과 잠금(lock)으로 이를 자동 관리한다.

## RDBMS의 SQL 처리 흐름

![RDBMS 쿼리 처리 흐름](/assets/posts/sql-what-is-rdb-rdbms.svg)

클라이언트가 SQL을 보내면 RDBMS 내부에서 다음 단계를 거친다.

1. **파서(Parser)**: SQL 문자열을 토큰으로 분리하고 구문 트리를 만든다. 문법 오류가 있으면 이 단계에서 에러가 반환된다.
2. **옵티마이저(Optimizer)**: 통계 정보를 바탕으로 가장 효율적인 실행 계획(execution plan)을 선택한다. 인덱스를 쓸지, 어떤 조인 알고리즘을 쓸지 결정한다.
3. **실행기(Executor)**: 실행 계획대로 스토리지 관리자를 호출해 데이터를 읽거나 쓴다.
4. **스토리지 관리자**: 버퍼 캐시를 확인하고, 캐시 미스 시 디스크 I/O를 수행한다.

```sql
-- 가장 단순한 RDB 예시
CREATE TABLE employees (
    id        INTEGER     PRIMARY KEY,
    name      VARCHAR(50) NOT NULL,
    email     VARCHAR(100) UNIQUE,
    dept_id   INTEGER
);

INSERT INTO employees VALUES (1, '김철수', 'chulsoo@corp.io', 10);

SELECT name, email
FROM   employees
WHERE  dept_id = 10;
```

위 세 문장이 각각 DDL(테이블 정의), DML(데이터 삽입), DQL(데이터 조회)에 해당한다. SQL 분류는 이후 글에서 자세히 다룬다.

## 주요 RDBMS 비교

| RDBMS | 라이선스 | 주요 특징 |
|-------|----------|-----------|
| PostgreSQL | 오픈소스 | 표준 준수, 확장성, JSON 지원 |
| MySQL / MariaDB | 오픈소스 | 웹 서비스에 광범위 채용 |
| Oracle | 상용 | 엔터프라이즈, RAC, 파티셔닝 |
| SQL Server | 상용 | Windows 생태계, T-SQL |
| SQLite | 오픈소스 | 임베디드, 단일 파일 |

이 시리즈는 표준 SQL을 중심으로 진행하되, PostgreSQL·MySQL·Oracle·SQL Server의 방언(dialect) 차이를 필요할 때마다 짚어준다.

## 정리

RDB는 데이터를 테이블로 저장하고 SQL로 다루는 데이터베이스다. 테이블 = 릴레이션, 행 = 튜플, 열 = 속성이라는 수학적 용어를 익혀두면 이후 관계 모델 이론을 읽을 때 훨씬 수월하다. RDBMS는 SQL을 파서 → 옵티마이저 → 실행기 → 스토리지 순으로 처리한다.

---

**다음 글:** [관계 모델: 집합론 위에 세운 데이터 구조](/posts/sql-relational-model/)

<br>
읽어주셔서 감사합니다. 😊
