---
title: "SQL 언어 분류 — DDL, DML, DCL, TCL"
description: "SQL 명령어를 DDL(데이터 정의어), DML(데이터 조작어), DCL(데이터 제어어), TCL(트랜잭션 제어어)로 분류하고, 각 범주의 핵심 명령어와 암묵적 커밋 등 실무에서 놓치기 쉬운 동작 방식을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQL", "DDL", "DML", "DCL", "TCL", "CREATE", "INSERT", "GRANT", "COMMIT"]
featured: false
draft: false
---

[지난 글](/posts/sql-client-server-protocol/)에서 SQL이 네트워크를 통해 DBMS로 전달되는 과정을 살펴봤다. 이번에는 SQL 명령어 자체를 체계적으로 분류한다. SQL은 용도에 따라 크게 네 가지 범주로 나뉜다. 이 분류를 이해하면 "DDL은 롤백이 안 되는데 왜 그럴까?", "GRANT는 트랜잭션 안에서 써야 할까?" 같은 실무 질문에 답할 수 있다.

## 4가지 언어 분류

![SQL 언어 분류 체계](/assets/posts/sql-language-categories-overview.svg)

## DDL — 데이터 정의어

**DDL(Data Definition Language)**은 데이터베이스 객체(테이블, 인덱스, 뷰, 시퀀스 등)의 구조를 정의한다. 핵심 명령어는 `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`이다.

```sql
-- 테이블 생성
CREATE TABLE categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 열 추가
ALTER TABLE categories ADD COLUMN description TEXT;

-- 테이블 전체 삭제 (구조 보존)
TRUNCATE TABLE categories;

-- 테이블 구조 및 데이터 모두 삭제
DROP TABLE IF EXISTS categories;
```

### DDL의 암묵적 커밋

DDL의 중요한 특성은 **암묵적 커밋(Implicit COMMIT)**이다. Oracle, MySQL, SQL Server, PostgreSQL 모두 DDL 문이 실행되면 현재 트랜잭션이 즉시 커밋된다. 이는 DDL 작업을 롤백할 수 없음을 의미한다.

> 예외: PostgreSQL은 DDL도 트랜잭션 안에서 롤백 가능하다. `BEGIN; CREATE TABLE t ...; ROLLBACK;`이 동작한다. 하지만 Oracle, MySQL은 그렇지 않다.

## DML — 데이터 조작어

**DML(Data Manipulation Language)**은 데이터 자체를 읽고 쓰는 명령어다. `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`가 여기 속한다.

DML은 트랜잭션 안에서 실행되며 `COMMIT`이나 `ROLLBACK`으로 결과를 확정하거나 취소할 수 있다.

```sql
-- INSERT: 단건 삽입
INSERT INTO products (name, price) VALUES ('마우스', 45000);

-- INSERT ... SELECT: 조회 결과 삽입
INSERT INTO product_archive
SELECT * FROM products WHERE created_at < '2023-01-01';

-- UPDATE: 조건부 갱신
UPDATE products SET stock = stock - 1 WHERE id = 42 AND stock > 0;

-- DELETE: 조건부 삭제
DELETE FROM orders WHERE status = 'cancelled' AND created_at < NOW() - INTERVAL '90 days';
```

`SELECT`는 데이터를 변경하지 않아 **DQL(Data Query Language)**로 따로 분류하기도 한다. 그러나 SQL 표준 분류에서는 DML의 일부다.

## DCL — 데이터 제어어

**DCL(Data Control Language)**은 데이터베이스 접근 권한을 관리한다. `GRANT`와 `REVOKE`가 전부다.

```sql
-- 권한 부여
GRANT SELECT, INSERT, UPDATE ON products TO app_user;
GRANT ALL PRIVILEGES ON DATABASE mydb TO admin_user;

-- 권한 회수
REVOKE INSERT ON products FROM app_user;

-- 롤(Role) 기반 권한 관리 (권장)
CREATE ROLE readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
GRANT readonly TO reporting_user;
```

최신 RDBMS에서는 `GRANT`를 직접 사용자에게 부여하기보다 **Role**을 만들어 권한 집합을 관리하는 것이 일반적이다.

## TCL — 트랜잭션 제어어

**TCL(Transaction Control Language)**은 트랜잭션의 경계를 제어한다.

```sql
-- 트랜잭션 시작
BEGIN;  -- PostgreSQL/MySQL
-- 또는
START TRANSACTION;  -- MySQL 표준

-- 커밋
COMMIT;

-- 롤백
ROLLBACK;

-- 저장점(Savepoint)
BEGIN;
    INSERT INTO orders (id, amount) VALUES (1, 50000);
    SAVEPOINT sp1;
    INSERT INTO order_items (order_id, product_id) VALUES (1, 99);
    -- 아이템 삽입만 취소, 주문 삽입은 유지
    ROLLBACK TO SAVEPOINT sp1;
COMMIT;
```

### autocommit 설정

MySQL은 기본적으로 `autocommit=1`이다. 각 DML 문이 자동으로 커밋된다. `BEGIN` 또는 `START TRANSACTION`으로 명시적 트랜잭션을 시작하면 autocommit이 일시적으로 비활성화된다.

PostgreSQL도 `autocommit`이 기본 ON이지만, `BEGIN`으로 묶으면 명시적 트랜잭션이 된다.

```sql
-- MySQL: autocommit 확인/변경
SELECT @@autocommit;
SET autocommit = 0;  -- 세션 범위 변경

-- PostgreSQL: 기본 autocommit 상태
-- BEGIN 없이 실행 시 각 문장이 자동 커밋
-- BEGIN 이후에는 COMMIT/ROLLBACK 명시 필요
```

## 실무 체크리스트

| 상황 | 주의할 점 |
|---|---|
| DDL 실행 전 | 현재 트랜잭션이 있으면 DDL 전에 커밋됨 (Oracle/MySQL) |
| TRUNCATE vs DELETE | TRUNCATE는 DDL이라 롤백 안 됨 (PostgreSQL 제외) |
| GRANT 범위 | 신규 테이블에 권한 필요 시 `ON FUTURE TABLES` (Snowflake) 또는 재부여 필요 |
| autocommit 확인 | MySQL에서 DML 후 커밋 없이 접속 종료 시 자동 롤백 |

![분류별 SQL 예시](/assets/posts/sql-language-categories-examples.svg)

다음 글부터는 DDL의 핵심인 `CREATE TABLE`부터 시작해 테이블 설계와 데이터 타입을 구체적으로 다룬다.

---

**지난 글:** [클라이언트-서버 프로토콜과 커넥션 관리](/posts/sql-client-server-protocol/)

**다음 글:** [CREATE TABLE 기초 — 테이블 생성과 구조 설계](/posts/sql-create-table-basics/)

<br>
읽어주셔서 감사합니다. 😊
