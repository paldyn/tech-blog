---
title: "SQL 언어 분류 — DDL, DML, DCL, TCL 완전 정리"
description: "SQL을 기능별로 분류하는 DDL, DML, DCL, TCL의 차이와 각 구문의 역할, 트랜잭션과의 관계를 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQL", "DDL", "DML", "DCL", "TCL", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/sql-client-server-protocol/)에서 SQL이 서버에서 처리되는 내부 흐름을 살펴봤다. 이번에는 SQL 구문을 기능에 따라 분류하는 방법을 정리한다. 단순 암기가 아니라, 각 분류가 **트랜잭션과 어떻게 다르게 동작하는지**를 이해하는 것이 핵심이다.

## 4가지 분류

SQL 구문은 목적에 따라 네 범주로 나뉜다.

| 분류 | 영문 | 대표 구문 | 주요 특성 |
|---|---|---|---|
| DDL | Data Definition Language | CREATE, ALTER, DROP, TRUNCATE | 구조 정의, 대부분 DBMS에서 자동 커밋 |
| DML | Data Manipulation Language | SELECT, INSERT, UPDATE, DELETE | 데이터 조작, 트랜잭션 안에서 실행 |
| DCL | Data Control Language | GRANT, REVOKE | 권한 관리 |
| TCL | Transaction Control Language | COMMIT, ROLLBACK, SAVEPOINT | 트랜잭션 경계 제어 |

![SQL 언어 분류 개요](/assets/posts/sql-language-categories-overview.svg)

## DDL — 데이터 정의어

데이터베이스 **구조**를 다루는 명령이다. 테이블, 인덱스, 뷰, 시퀀스를 만들고 수정하고 삭제한다.

```sql
-- 테이블 생성
CREATE TABLE 주문 (
    주문ID    INTEGER     PRIMARY KEY,
    고객ID   VARCHAR(10) NOT NULL,
    주문일   DATE        NOT NULL DEFAULT CURRENT_DATE,
    금액     NUMERIC(12,2)
);

-- 컬럼 추가
ALTER TABLE 주문 ADD COLUMN 배송지 VARCHAR(200);

-- 테이블 완전 삭제
DROP TABLE 주문;
```

**주의**: Oracle, MySQL에서는 DDL이 실행되면 암묵적 커밋이 발생한다. 실행 중이던 트랜잭션이 강제 커밋되므로 주의가 필요하다. PostgreSQL은 DDL도 트랜잭션으로 감쌀 수 있어 `BEGIN; ALTER TABLE ...; ROLLBACK;`이 가능하다.

## DML — 데이터 조작어

데이터 **내용**을 읽고 쓰는 명령이다. `SELECT`는 읽기, 나머지(`INSERT`, `UPDATE`, `DELETE`)는 쓰기다.

```sql
-- 조회
SELECT 이름, 나이 FROM 고객 WHERE 도시 = '서울';

-- 삽입
INSERT INTO 고객 (고객ID, 이름, 나이) VALUES ('C004', '신사임당', 38);

-- 수정
UPDATE 고객 SET 나이 = 39 WHERE 고객ID = 'C004';

-- 삭제
DELETE FROM 고객 WHERE 고객ID = 'C004';
```

DML은 트랜잭션 안에서 실행된다. ROLLBACK으로 취소할 수 있다. 단, 대부분의 도구는 기본적으로 **자동 커밋(autocommit)** 모드이므로, 명시적으로 `BEGIN`을 선언하지 않으면 각 구문이 즉시 커밋된다.

## TCL — 트랜잭션 제어어

DML 변경 사항을 확정하거나 취소하는 명령이다. 트랜잭션은 **ACID**를 보장하는 작업의 논리적 단위다.

```sql
BEGIN;  -- 트랜잭션 시작 (MySQL: START TRANSACTION)

UPDATE 계좌 SET 잔액 = 잔액 - 10000 WHERE 계좌ID = 'A001';
SAVEPOINT after_debit;  -- 중간 저장점

UPDATE 계좌 SET 잔액 = 잔액 + 10000 WHERE 계좌ID = 'A002';

-- 오류 발생 시 두 번째 UPDATE만 취소
ROLLBACK TO after_debit;

COMMIT;  -- 또는 ROLLBACK으로 전체 취소
```

`SAVEPOINT`는 긴 트랜잭션에서 부분 롤백을 가능하게 한다. 예를 들어 100개 행을 처리하다가 50번째에서 오류가 나면, 전체가 아닌 51~100번째만 롤백할 수 있다.

## DCL — 데이터 제어어

사용자나 역할(Role)에 대한 **권한**을 관리한다.

```sql
-- 권한 부여
GRANT SELECT, INSERT, UPDATE ON 고객 TO app_user;

-- 역할(Role) 생성 후 부여
CREATE ROLE read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only;
GRANT read_only TO analyst_user;

-- 권한 회수
REVOKE INSERT, UPDATE ON 고객 FROM app_user;
```

보안 원칙인 **최소 권한(Principle of Least Privilege)**에 따라, 애플리케이션 계정에는 필요한 권한만 부여한다. SELECT 전용 리포팅 계정이 실수로 `DELETE`를 실행할 수 없도록 막는다.

![DDL/DML/TCL/DCL 예시 코드](/assets/posts/sql-language-categories-examples.svg)

## DDL과 DML의 트랜잭션 차이

| 항목 | DDL | DML |
|---|---|---|
| 트랜잭션 감쌀 수 있나? | Oracle/MySQL: 불가 (암묵적 커밋) / PostgreSQL: 가능 | 항상 가능 |
| ROLLBACK 대상 | 대부분 불가 | 가능 |
| 실행 후 효과 | 즉시 영구 반영(Oracle/MySQL) | COMMIT 전까지 해당 세션에만 보임 |

Oracle과 MySQL에서 마이그레이션 스크립트를 짤 때 `CREATE TABLE` 다음에 `INSERT`를 하고 `ROLLBACK`을 해도 테이블은 남아 있다. 이 차이를 모르면 데이터 유실이나 의도치 않은 스키마 변경이 생긴다.

---

**지난 글:** [SQL 클라이언트-서버 프로토콜 — 쿼리가 실행되는 과정](/posts/sql-client-server-protocol/)

**다음 글:** [CREATE TABLE 기초 — 테이블 설계의 시작](/posts/sql-create-table-basics/)

<br>
읽어주셔서 감사합니다. 😊
