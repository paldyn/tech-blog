---
title: "관계형 데이터베이스란 무엇인가"
description: "관계형 데이터베이스의 핵심 개념인 릴레이션, 튜플, 속성, 무결성 제약, ACID 트랜잭션을 설명하고, 파일 시스템 대비 RDBMS가 왜 등장했는지 그 역사적 맥락을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["SQL", "RDB", "관계형데이터베이스", "RDBMS", "ACID", "릴레이션", "무결성"]
featured: false
draft: false
---

데이터베이스를 처음 배우는 사람이 가장 먼저 만나는 개념이 **관계형 데이터베이스(Relational Database)**다. 오늘날 기업용 시스템의 압도적 다수가 여기에 의존한다. Oracle, MySQL, PostgreSQL, SQL Server, SQLite — 이름만 다를 뿐, 모두 1970년 E. F. Codd가 IBM 연구소에서 제안한 **관계 모델(Relational Model)**을 구현한다. 이 시리즈의 첫 글로, 관계형 데이터베이스가 무엇인지, 왜 지금처럼 보편화되었는지, 그리고 핵심 구성 요소를 차근차근 짚어본다.

## 파일 시스템의 한계

관계형 데이터베이스가 등장하기 이전, 데이터는 파일 시스템에 저장되었다. 각 응용 프로그램이 자신만의 파일 포맷을 정의했고, 같은 고객 정보가 주문 시스템 파일, 배송 시스템 파일, 회계 시스템 파일에 각각 따로 저장되었다. 문제는 세 가지였다.

첫째, **데이터 중복**. 동일한 데이터가 여러 파일에 흩어져 있으니 하나를 수정해도 나머지는 그대로였다. 둘째, **데이터 불일치**. 주문 시스템의 고객 주소와 배송 시스템의 주소가 다른 상황이 발생했다. 셋째, **무결성 보장 불가**. 존재하지 않는 고객을 가리키는 주문 레코드가 만들어져도 시스템은 전혀 알지 못했다.

Codd는 이 문제를 해결하기 위해 수학의 집합론(Set Theory)과 술어 논리(Predicate Logic)를 데이터 관리에 적용했다.

## 릴레이션과 테이블

관계 모델의 기본 단위는 **릴레이션(Relation)**이다. 실제 DBMS에서는 **테이블(Table)**로 구현된다. 릴레이션은 헤더와 바디로 구성된다.

- **헤더(Header)**: 열(Column)의 집합. 각 열은 이름과 도메인(허용 값의 집합)을 가진다. 이를 **속성(Attribute)**이라 부른다.
- **바디(Body)**: 행(Row)의 집합. 각 행은 각 속성에 대한 값을 갖는 **튜플(Tuple)**이다.

![관계형 데이터베이스 핵심 개념](/assets/posts/sql-what-is-rdb-concept.svg)

중요한 점은 릴레이션의 바디가 **집합(Set)**이라는 것이다. 집합에는 중복된 원소가 없다. 따라서 관계 모델에서는 중복된 행이 허용되지 않는다. 이를 구현하는 것이 기본 키(Primary Key)다.

## 핵심 특성

### 데이터 독립성

관계 모델은 물리적 저장 방식과 논리적 구조를 분리한다. 인덱스를 추가하거나 스토리지를 변경해도 SQL 쿼리는 바꾸지 않아도 된다. 이를 **데이터 독립성(Data Independence)**이라 한다.

### 무결성 제약

테이블에 저장되는 데이터는 항상 일정한 규칙을 만족해야 한다.

```sql
CREATE TABLE users (
    user_id   INT          PRIMARY KEY,       -- 기본 키: 중복 없음, NULL 없음
    email     VARCHAR(255) NOT NULL UNIQUE,   -- NOT NULL + 유일성
    age       INT          CHECK (age >= 0),  -- 값 범위 제약
    dept_id   INT          REFERENCES departments(dept_id)  -- 참조 무결성
);
```

`PRIMARY KEY`는 각 행을 고유하게 식별한다. `REFERENCES`는 다른 테이블의 행을 가리키는 **외래 키(Foreign Key)**로, 존재하지 않는 부서를 가리키는 사원 레코드가 삽입되지 못하도록 막는다.

### 집합 기반 연산

관계형 DB의 가장 강력한 특징 중 하나는 **집합 기반 연산**이다. 프로그래밍 언어에서는 루프를 돌며 행을 하나씩 처리하지만, SQL은 조건에 맞는 행의 집합 전체를 한 번에 처리한다.

```sql
-- 집합 기반: 조건에 맞는 행 전체를 한 번에 갱신
UPDATE orders
SET status = 'shipped'
WHERE created_at < '2024-01-01';
```

### ACID 트랜잭션

여러 SQL 문을 묶어 하나의 **트랜잭션(Transaction)**으로 처리할 수 있다. RDBMS는 ACID 특성을 보장한다.

| 특성 | 의미 |
|---|---|
| **A**tomicity | 트랜잭션 내 모든 작업이 전부 성공하거나 전부 실패 |
| **C**onsistency | 트랜잭션 전후 데이터베이스는 항상 유효한 상태 유지 |
| **I**solation | 동시 실행 트랜잭션 간 서로 간섭하지 않음 |
| **D**urability | 커밋된 데이터는 장애가 나도 유지됨 |

```sql
BEGIN;
    UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
    UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;  -- 둘 다 성공해야 반영, 하나라도 실패하면 전부 취소
```

## RDBMS의 3계층 구조

실제 RDBMS는 크게 세 계층으로 나뉜다.

![RDBMS 3계층 구조](/assets/posts/sql-what-is-rdb-architecture.svg)

1. **클라이언트 계층**: Java, Python 같은 애플리케이션이 SQL을 작성해 DBMS에 전송한다.
2. **DBMS 엔진**: SQL을 파싱(Parsing)하고, 옵티마이저가 최적 실행 계획을 수립한 뒤, 실행 엔진이 데이터를 읽고 쓴다.
3. **스토리지 계층**: 데이터 파일, 인덱스 파일, 트랜잭션 로그(WAL/Redo Log)가 디스크에 저장된다.

이 계층 분리 덕분에 애플리케이션 개발자는 "어떻게 저장할지"가 아니라 "무엇을 원하는지"만 SQL로 표현하면 된다.

## NoSQL과의 비교

최근 MongoDB, Cassandra 같은 NoSQL 데이터베이스가 주목받고 있다. NoSQL은 스키마 유연성, 수평 확장, 특정 접근 패턴 최적화에 강점이 있다. 하지만 복잡한 조인, 강한 일관성, 표준화된 쿼리 언어가 필요한 도메인에서는 여전히 RDBMS가 압도적이다. 대부분의 비즈니스 애플리케이션은 관계형 DB에서 시작하는 것이 안전하다.

## 어떤 RDBMS를 배워야 할까

이 시리즈는 표준 SQL을 중심으로, Oracle, PostgreSQL, MySQL/MariaDB, SQL Server의 주요 차이를 함께 다룬다. 개념을 이해하면 특정 DBMS 문법은 쉽게 전환된다. 기초를 제대로 쌓는 것이 목표다.

---

**다음 글:** [관계 모델의 수학적 기초 — 릴레이션, 속성, 튜플](/posts/sql-relational-model/)

<br>
읽어주셔서 감사합니다. 😊
