---
title: "SQL 언어 분류 — DDL, DML, DCL, TCL 완전 정복"
description: "SQL을 DDL/DML/DCL/TCL로 분류하는 이유와 각 카테고리의 명령어, DDL 자동 COMMIT 함정, 트랜잭션과 DML의 관계를 예제 코드와 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["DDL", "DML", "DCL", "TCL", "SQL분류", "COMMIT", "ROLLBACK", "트랜잭션", "GRANT"]
featured: false
draft: false
---

[지난 글](/posts/sql-client-server-protocol/)에서 SQL이 클라이언트-서버 간에 어떻게 처리되는지 살펴봤다. 이제 SQL 자체를 분류해 보자. SQL 명령어는 수십 가지가 있지만, 목적에 따라 크게 네 범주로 나뉜다. 이 분류를 알면 명령어마다 다른 트랜잭션 동작을 예측할 수 있다.

## 네 가지 분류 체계

![SQL 언어 분류 체계](/assets/posts/sql-language-categories-map.svg)

| 분류 | 영문 | 대표 명령어 | COMMIT 필요 |
|------|------|-----------|------------|
| **DDL** | Data Definition Language | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` | 자동 COMMIT |
| **DML** | Data Manipulation Language | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE` | 명시 COMMIT 필요 |
| **DCL** | Data Control Language | `GRANT`, `REVOKE` | 자동 COMMIT |
| **TCL** | Transaction Control Language | `COMMIT`, `ROLLBACK`, `SAVEPOINT` | 해당 없음 |

## DDL — 구조를 정의한다

DDL(Data Definition Language)은 테이블·인덱스·뷰·시퀀스 등 데이터베이스 **객체의 구조**를 정의하거나 변경하는 명령어다.

```sql
-- 테이블 생성
CREATE TABLE products (
    product_id   INT           PRIMARY KEY,
    product_name VARCHAR(100)  NOT NULL,
    price        DECIMAL(12,2) DEFAULT 0
);

-- 컬럼 추가
ALTER TABLE products ADD COLUMN stock INT DEFAULT 0;

-- 테이블 구조는 유지하되 모든 데이터 삭제 (빠름)
TRUNCATE TABLE products;

-- 테이블 완전 삭제
DROP TABLE products;
```

**중요**: Oracle, MySQL에서 DDL은 **자동 COMMIT**을 발생시킨다. 따라서 DDL을 실행하면 그 시점까지 진행 중인 모든 DML도 함께 COMMIT된다. PostgreSQL은 예외적으로 DDL도 트랜잭션 내에서 실행할 수 있다.

## DML — 데이터를 다룬다

![DDL vs DML 동작 방식](/assets/posts/sql-language-ddl-vs-dml.svg)

DML(Data Manipulation Language)은 실제 데이터를 다루는 명령어다. 트랜잭션 내에서 실행되므로 `COMMIT` 전까지 다른 세션에서 변경 내용이 보이지 않는다.

```sql
-- INSERT: 새 행 추가
INSERT INTO products (product_id, product_name, price)
VALUES (1, '노트북', 1200000);

-- UPDATE: 기존 행 수정
UPDATE products
SET    price = 1100000
WHERE  product_id = 1;

-- DELETE: 행 삭제 (TRUNCATE와 달리 ROLLBACK 가능)
DELETE FROM products WHERE product_id = 1;

-- SELECT: 데이터 조회 (DML에 포함, 데이터 변경 없음)
SELECT product_name, price FROM products ORDER BY price DESC;
```

### SELECT는 DML인가?

표준 분류에서 `SELECT`는 DML에 포함되지만, **읽기 전용**이므로 `COMMIT`/`ROLLBACK`과 무관하다. 일부 교재에서 SELECT를 별도 범주(DQL, Data Query Language)로 분류하기도 하지만 표준 분류는 DML이다.

## DCL — 권한을 제어한다

```sql
-- GRANT: 권한 부여
GRANT SELECT, INSERT ON products TO app_user;
GRANT ALL PRIVILEGES ON DATABASE mydb TO admin_user;

-- WITH GRANT OPTION: 권한 위임 가능하게 부여
GRANT SELECT ON products TO manager WITH GRANT OPTION;

-- REVOKE: 권한 회수
REVOKE INSERT ON products FROM app_user;
```

DCL도 자동 COMMIT이다. 권한 변경은 즉시 효과를 발휘한다.

## TCL — 트랜잭션을 제어한다

```sql
-- 트랜잭션 시작 (명시적, DB마다 문법 다름)
BEGIN;               -- PostgreSQL/MySQL
BEGIN TRANSACTION;   -- SQL Server
-- Oracle은 첫 DML 실행 시 자동 시작

-- SAVEPOINT: 중간 저장점
SAVEPOINT sp1;
UPDATE products SET price = 900000 WHERE product_id = 1;

-- 부분 롤백
ROLLBACK TO SAVEPOINT sp1;

-- 전체 확정
COMMIT;

-- 전체 취소
ROLLBACK;
```

`SAVEPOINT`는 트랜잭션 전체를 롤백하지 않고 특정 시점까지만 롤백할 수 있게 해준다. 긴 배치 처리에서 유용하다.

## 실무에서 자주 생기는 실수

DDL 자동 COMMIT 함정이 특히 위험하다.

```sql
-- Oracle/MySQL에서 위험한 패턴!
BEGIN;
UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
UPDATE accounts SET balance = balance + 1000 WHERE id = 2;

-- 이 사이에 실수로 DDL 실행 시 위 UPDATE가 자동 COMMIT됨
ALTER TABLE accounts ADD COLUMN memo VARCHAR(200);
-- ^ 위 두 UPDATE가 즉시 COMMIT! ROLLBACK 불가

ROLLBACK;  -- 너무 늦었다
```

배포 스크립트에서 DDL과 DML을 섞을 때 반드시 순서에 주의해야 한다. PostgreSQL에서도 DDL 트랜잭션을 지원하지만, 일부 DDL(`VACUUM`, `CREATE DATABASE`)은 트랜잭션 외부에서만 실행된다.

## 정리

- **DDL**: 스키마 구조 정의/변경 — 자동 COMMIT, 롤백 불가 (Oracle/MySQL)
- **DML**: 데이터 조회/변경 — 트랜잭션 내 실행, `COMMIT`/`ROLLBACK` 제어 가능
- **DCL**: 권한 부여/회수 — 자동 COMMIT, 즉시 효과
- **TCL**: 트랜잭션 경계 제어 — `COMMIT`, `ROLLBACK`, `SAVEPOINT`
- DDL + DML 혼용 스크립트는 **DDL 자동 COMMIT 함정** 주의

---

**지난 글:** [DB 클라이언트-서버 프로토콜 — 연결부터 결과 반환까지](/posts/sql-client-server-protocol/)

**다음 글:** [CREATE TABLE 기초 — 테이블을 올바르게 만드는 법](/posts/sql-create-table-basics/)

<br>
읽어주셔서 감사합니다. 😊
