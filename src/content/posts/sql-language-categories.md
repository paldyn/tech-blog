---
title: "SQL 언어 분류 — DDL · DML · DCL · TCL"
description: "SQL 명령어를 DDL, DML, DCL, TCL 네 범주로 나누어 각각의 역할과 트랜잭션 동작 방식의 차이를 정리합니다. 왜 DDL은 롤백이 안 되는지, TRUNCATE은 왜 DDL인지도 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "ddl", "dml", "dcl", "tcl", "트랜잭션", "분류"]
featured: false
draft: false
---

## SQL 명령어를 네 가지로 나누는 이유

이전 글들에서 SQL의 탄생 배경과 표준화 과정을 살펴봤다. 이제부터는 실제 SQL 문법을 배울 차례다. 그 전에 SQL 명령어가 어떻게 분류되는지 먼저 잡아두자.

SQL 명령어는 목적에 따라 네 범주로 나뉜다. 이 구분은 단순한 분류 이상이다. **트랜잭션 동작 방식**이 범주마다 다르고, 잘못 쓰면 데이터를 복구 불가능하게 날릴 수 있다.

---

## 네 가지 범주 개요

![SQL 언어 분류](/assets/posts/sql-language-categories-overview.svg)

---

## DDL — 데이터 정의 언어

**Data Definition Language**. 데이터베이스 **구조(스키마)**를 정의하고 변경한다. 마치 건물 도면을 그리는 것과 같다.

```sql
-- 테이블 생성
CREATE TABLE employees (
  id     INTEGER PRIMARY KEY,
  name   VARCHAR(100) NOT NULL,
  email  VARCHAR(200) UNIQUE
);

-- 컬럼 추가
ALTER TABLE employees
  ADD COLUMN salary DECIMAL(10, 2);

-- 테이블 삭제
DROP TABLE employees;

-- 모든 행 즉시 삭제 (구조 유지)
TRUNCATE TABLE employees;
```

### DDL과 암묵적 COMMIT

DDL의 핵심 특성은 **자동 커밋(implicit COMMIT)**이다. Oracle, MySQL 등 대부분의 DBMS에서 DDL 명령을 실행하면 즉시 커밋된다. 이는 진행 중인 트랜잭션도 함께 커밋한다는 뜻이다.

```sql
BEGIN;
  INSERT INTO orders (amount) VALUES (1000);
  -- 실수로 DDL 실행!
  ALTER TABLE products ADD COLUMN category VARCHAR(50);
  -- 이 시점에 암묵적 COMMIT 발생
  -- INSERT한 행도 함께 커밋됨
ROLLBACK;  -- 너무 늦음. INSERT는 이미 커밋됨
```

단, **PostgreSQL은 DDL도 트랜잭션 내에서 롤백 가능**하다. Oracle, MySQL은 DDL 실행 시 암묵적 커밋이 발생한다.

### TRUNCATE는 왜 DDL인가?

직관적으로는 데이터를 지우니까 DML처럼 보인다. 하지만 TRUNCATE는 행을 하나씩 삭제하는 게 아니라 **데이터 파일의 할당 해제**에 가까운 동작을 한다. 따라서:
- `DELETE`보다 훨씬 빠르다 (로그를 적게 남김)
- 대부분의 DBMS에서 롤백 불가(PostgreSQL 제외)
- `WHERE` 조건을 쓸 수 없다

---

## DML — 데이터 조작 언어

**Data Manipulation Language**. 테이블의 **데이터**를 다룬다. 가장 자주 쓰는 명령어들이 여기 있다.

```sql
-- 행 삽입
INSERT INTO employees (id, name, email)
VALUES (1, 'Alice', 'alice@corp.com');

-- 행 수정
UPDATE employees
SET    salary = 75000
WHERE  id = 1;

-- 행 삭제
DELETE FROM employees
WHERE  id = 1;

-- 데이터 조회 (읽기 전용)
SELECT id, name, salary
FROM   employees
WHERE  salary > 50000
ORDER  BY salary DESC;
```

DML은 트랜잭션 안에서 동작한다. 커밋 전까지는 롤백할 수 있다.

> **SELECT가 DML인가?** 학자에 따라 SELECT를 별도 범주(DQL, Data Query Language)로 분리하는 경우도 있다. 실무에서는 크게 중요하지 않으며, 대부분의 시험과 교재는 SELECT를 DML에 포함시킨다.

---

## DCL — 데이터 제어 언어

**Data Control Language**. 데이터베이스 객체에 대한 **접근 권한**을 관리한다.

```sql
-- alice에게 employees 테이블 조회 권한 부여
GRANT SELECT ON employees TO alice;

-- bob에게 orders 테이블 INSERT, UPDATE 권한 부여
GRANT INSERT, UPDATE ON orders TO bob;

-- alice로부터 DELETE 권한 회수
REVOKE DELETE ON orders FROM alice;

-- PostgreSQL: 특정 행만 볼 수 있는 정책 (Row-Level Security)
CREATE POLICY emp_policy ON employees
  FOR SELECT
  USING (dept_id = current_setting('app.dept_id')::int);
```

DCL은 즉시 반영되며 트랜잭션 제어와 독립적으로 동작한다.

---

## TCL — 트랜잭션 제어 언어

**Transaction Control Language**. DML 작업의 **원자적 처리**를 제어한다. ACID의 A(Atomicity)와 C(Consistency)를 보장하는 핵심 명령어들이다.

![트랜잭션 흐름](/assets/posts/sql-language-categories-tcl-flow.svg)

```sql
-- 기본 트랜잭션 패턴
BEGIN;  -- PostgreSQL / MySQL

  -- DML 작업들
  INSERT INTO orders (customer_id, amount) VALUES (1, 50000);
  UPDATE inventory SET qty = qty - 1 WHERE product_id = 101;

COMMIT;   -- 두 작업 모두 영구 반영
-- 또는
ROLLBACK; -- 두 작업 모두 취소

-- SAVEPOINT로 중간 체크포인트
BEGIN;
  INSERT INTO log (msg) VALUES ('시작');
  SAVEPOINT sp1;

  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  -- 이 UPDATE만 취소하고 싶다면:
  ROLLBACK TO SAVEPOINT sp1;

  INSERT INTO log (msg) VALUES ('업데이트 취소됨');
COMMIT;
```

### AUTOCOMMIT 모드

MySQL의 기본값은 `AUTOCOMMIT = 1`이다. 즉, 명시적으로 `BEGIN`을 쓰지 않으면 각 DML이 자동으로 커밋된다.

```sql
-- MySQL: AUTOCOMMIT 확인
SELECT @@autocommit;

-- 비활성화 (세션 레벨)
SET autocommit = 0;
```

PostgreSQL, Oracle은 기본값이 수동 커밋 모드다. JDBC 드라이버도 기본적으로 `autocommit=true`로 시작하므로, Spring 같은 프레임워크가 `@Transactional`로 이를 제어한다.

---

## 범주별 트랜잭션 동작 비교

| 범주 | 롤백 가능 | 암묵적 COMMIT | 설명 |
|------|---------|------------|------|
| DDL | △ (PG 제외 불가) | Oracle/MySQL에서 발생 | 스키마 변경은 신중히 |
| DML | ✓ | 없음 | COMMIT 전까지 자유롭게 |
| DCL | ✗ (즉시 반영) | 없음 | 권한 변경은 바로 적용 |
| TCL | — (제어 명령 자체) | — | DML을 감싸는 제어 레이어 |

---

## 정리

- **DDL**: 스키마(구조) 정의 — CREATE, ALTER, DROP, TRUNCATE
- **DML**: 데이터 조작 — SELECT, INSERT, UPDATE, DELETE, MERGE  
- **DCL**: 권한 제어 — GRANT, REVOKE
- **TCL**: 트랜잭션 제어 — COMMIT, ROLLBACK, SAVEPOINT

DDL이 암묵적으로 커밋된다는 사실은 운영 DB에서 실수를 되돌릴 수 없게 만든다. DDL 실행 전에는 반드시 명시적 `COMMIT`으로 현재 트랜잭션을 정리하고, PostgreSQL이 아닌 DBMS에서는 DDL을 트랜잭션 안에 넣는 것이 위험하다는 점을 기억하자.

---

**다음 글:** [CREATE TABLE 기초 — 테이블을 제대로 정의하는 방법](/posts/sql-create-table-basics/)

<br>
읽어주셔서 감사합니다. 😊
