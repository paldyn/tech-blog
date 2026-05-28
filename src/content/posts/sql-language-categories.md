---
title: "SQL 언어 분류 — DDL·DML·DCL·TCL"
description: "SQL 명령을 기능에 따라 DDL·DML·DCL·TCL로 분류하고, 특히 DDL의 자동 커밋 특성과 DML 트랜잭션 처리 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQL", "DDL", "DML", "DCL", "TCL", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/sql-client-server-protocol/)에서 SQL이 DBMS 서버에서 처리되는 과정을 살펴봤습니다. 이번에는 SQL 명령 자체를 기능에 따라 분류하는 방법을 정리합니다. DDL과 DML의 트랜잭션 차이는 실수로 데이터를 날리는 흔한 원인이므로 꼭 이해해두어야 합니다.

## 네 가지 분류

SQL 명령은 목적에 따라 네 그룹으로 나뉩니다.

![SQL 언어 범주 개요](/assets/posts/sql-language-categories-map.svg)

## DDL — 구조 정의

**DDL(Data Definition Language)** 은 데이터베이스 객체(테이블·뷰·인덱스·시퀀스 등)의 구조를 정의하거나 변경합니다.

```sql
-- 테이블 생성 (CREATE)
CREATE TABLE products (
    product_id  SERIAL       PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    price       NUMERIC(10, 2)
);

-- 열 추가 (ALTER)
ALTER TABLE products ADD COLUMN stock INT DEFAULT 0;

-- 테이블 삭제 (DROP) — 데이터도 함께 삭제
DROP TABLE products;

-- 데이터만 삭제, 구조 유지 (TRUNCATE)
TRUNCATE TABLE products;
```

**중요**: 대부분의 DBMS에서 DDL은 **즉시 자동 커밋**됩니다. DDL 실행 전에 미처 커밋하지 않은 DML도 함께 커밋되며, DDL 자체는 `ROLLBACK`으로 되돌릴 수 없습니다. PostgreSQL은 예외적으로 DDL도 트랜잭션 안에서 실행·롤백할 수 있습니다.

## DML — 데이터 조작

**DML(Data Manipulation Language)** 은 테이블 안의 데이터를 조회하거나 변경합니다.

```sql
-- 조회 (SELECT)
SELECT product_id, name, price
FROM   products
WHERE  price > 10000
ORDER BY price DESC;

-- 삽입 (INSERT)
INSERT INTO products (name, price, stock)
VALUES ('노트북', 1200000, 50);

-- 수정 (UPDATE)
UPDATE products
SET    price = price * 0.9
WHERE  stock > 100;

-- 삭제 (DELETE)
DELETE FROM products
WHERE  price < 1000;
```

DML은 트랜잭션 안에서 실행되며, `COMMIT` 전까지는 다른 세션에서 변경 내용이 보이지 않고 `ROLLBACK`으로 취소할 수 있습니다.

## DCL — 권한 제어

**DCL(Data Control Language)** 은 사용자와 역할에 대한 권한을 부여하거나 회수합니다.

```sql
-- 권한 부여 (GRANT)
GRANT SELECT, INSERT ON products TO app_user;

-- 역할 기반 권한 관리
CREATE ROLE readonly_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_role;
GRANT readonly_role TO analyst_user;

-- 권한 회수 (REVOKE)
REVOKE INSERT ON products FROM app_user;
```

## TCL — 트랜잭션 제어

**TCL(Transaction Control Language)** 은 DML 작업을 하나의 트랜잭션으로 묶고 결과를 확정하거나 취소합니다.

```sql
BEGIN;  -- 트랜잭션 시작 (START TRANSACTION과 동일)

UPDATE accounts SET balance = balance - 50000 WHERE account_id = 1;
UPDATE accounts SET balance = balance + 50000 WHERE account_id = 2;

-- 조건 검사 후 결정
-- 이상 없으면:
COMMIT;
-- 문제가 있으면:
-- ROLLBACK;

-- 부분 취소가 필요할 때
SAVEPOINT before_adjustment;
UPDATE products SET price = price * 1.1;
-- 잘못됐다면:
ROLLBACK TO SAVEPOINT before_adjustment;
COMMIT;
```

![DDL vs DML 트랜잭션 처리 차이](/assets/posts/sql-language-categories-flow.svg)

## DDL 자동 커밋 주의사항

가장 흔한 실수 중 하나는 트랜잭션 도중 DDL을 실행해 이전 DML이 의도치 않게 커밋되는 경우입니다.

| DBMS | DDL 트랜잭션 지원 |
|------|-----------------|
| Oracle | 불가 (DDL 앞뒤로 암묵적 COMMIT) |
| MySQL / MariaDB | 불가 |
| PostgreSQL | 가능 (DDL도 트랜잭션 내 실행·롤백 가능) |
| SQL Server | 가능 (일부 DDL 한정) |

## DQL — 별도 분류

일부 교재에서는 `SELECT`를 **DQL(Data Query Language)** 로 별도 분류합니다. 데이터를 변경하지 않고 조회만 하기 때문입니다. 그러나 ISO 표준은 DQL이라는 범주를 정의하지 않으며, 대부분의 실무에서는 SELECT를 DML의 일부로 취급합니다.

## 정리

| 분류 | 명령 | 트랜잭션 | 역할 |
|------|------|---------|------|
| DDL | CREATE, ALTER, DROP, TRUNCATE | 대부분 자동 커밋 | 구조 정의 |
| DML | SELECT, INSERT, UPDATE, DELETE, MERGE | COMMIT/ROLLBACK 가능 | 데이터 조작 |
| DCL | GRANT, REVOKE | — | 권한 제어 |
| TCL | COMMIT, ROLLBACK, SAVEPOINT | — | 트랜잭션 제어 |

다음 글에서는 본격적인 DDL의 첫 단계, **CREATE TABLE 기초** 문법을 살펴봅니다.

---

**지난 글:** [클라이언트-서버 프로토콜 — SQL 실행의 여정](/posts/sql-client-server-protocol/)

**다음 글:** [CREATE TABLE 기초 — 테이블 설계의 시작](/posts/sql-create-table-basics/)

<br>
읽어주셔서 감사합니다. 😊
