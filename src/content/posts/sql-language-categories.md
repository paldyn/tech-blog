---
title: "SQL 언어 분류: DDL·DML·DCL·TCL·DQL 완전 정리"
description: "SQL 명령어를 DDL·DML·DCL·TCL·DQL로 분류하고 각 범주의 역할, 대표 문법, 자동 커밋 동작의 차이까지 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["DDL", "DML", "DCL", "TCL", "DQL", "SQL분류", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/sql-client-server-protocol/)에서 SQL이 서버에서 처리되는 흐름을 살펴봤다. SQL 명령어들은 역할에 따라 몇 가지 범주로 나뉜다. 이 분류를 알면 각 명령어가 트랜잭션에 미치는 영향, 권한 관리 방식, 롤백 가능 여부를 한눈에 파악할 수 있다.

## 다섯 가지 분류

![SQL 언어 분류 체계](/assets/posts/sql-language-categories-map.svg)

### DDL — 데이터 정의 언어(Data Definition Language)

데이터베이스의 **구조(스키마)**를 정의하거나 변경하는 명령어다.

| 명령어 | 역할 |
|--------|------|
| `CREATE` | 테이블·인덱스·뷰·시퀀스 등 객체 생성 |
| `ALTER` | 기존 객체의 구조 변경 |
| `DROP` | 객체 삭제 |
| `TRUNCATE` | 테이블의 모든 행 제거 (구조는 유지) |
| `RENAME` | 객체 이름 변경 |

**DDL과 트랜잭션:** PostgreSQL은 DDL도 트랜잭션 내에서 실행 가능하며 롤백할 수 있다. Oracle·MySQL은 DDL 실행 시 묵시적 커밋(implicit commit)이 발생한다 — `ALTER TABLE` 전에 열린 트랜잭션이 자동 커밋되므로 주의해야 한다.

### DML — 데이터 조작 언어(Data Manipulation Language)

테이블의 **데이터(행)**를 삽입·수정·삭제하는 명령어다.

| 명령어 | 역할 |
|--------|------|
| `INSERT` | 새 행 추가 |
| `UPDATE` | 기존 행의 값 변경 |
| `DELETE` | 행 삭제 |
| `MERGE` | 조건부 INSERT/UPDATE/DELETE (upsert) |

DML은 트랜잭션의 일부다. `ROLLBACK`으로 취소할 수 있다.

### DQL — 데이터 조회 언어(Data Query Language)

오직 `SELECT` 하나다. 데이터를 읽는다. 일부 분류 체계에서는 DML의 일부로 보기도 하지만, 데이터를 변경하지 않는다는 점에서 별도로 구분하는 것이 더 명확하다.

```sql
SELECT id, name, total
FROM   orders
WHERE  status = 'paid'
ORDER  BY id DESC
LIMIT  10;
```

### DCL — 데이터 제어 언어(Data Control Language)

객체에 대한 **접근 권한**을 관리한다.

| 명령어 | 역할 |
|--------|------|
| `GRANT` | 사용자·역할에 권한 부여 |
| `REVOKE` | 부여된 권한 회수 |

```sql
-- app_user에게 orders 조회 권한만 부여
GRANT SELECT ON orders TO app_user;

-- 삭제 권한 회수
REVOKE DELETE ON orders FROM app_user;
```

### TCL — 트랜잭션 제어 언어(Transaction Control Language)

트랜잭션의 경계와 동작을 제어한다.

| 명령어 | 역할 |
|--------|------|
| `BEGIN` / `START TRANSACTION` | 트랜잭션 시작 |
| `COMMIT` | 변경 사항 영구 저장 |
| `ROLLBACK` | 변경 사항 취소 |
| `SAVEPOINT` | 부분 롤백 지점 설정 |
| `SET TRANSACTION` | 격리 수준 등 속성 설정 |

## 분류별 대표 문법 한눈에

![SQL 분류별 대표 문법](/assets/posts/sql-language-categories-examples.svg)

## AUTO COMMIT 함정

많은 개발자가 처음에 혼란을 겪는 지점이다. 대부분의 드라이버는 기본적으로 **AUTO COMMIT ON** 상태다.

```python
# psycopg2 기본: autocommit=False (명시적 commit 필요)
conn = psycopg2.connect(...)
conn.execute("UPDATE orders SET status='paid' WHERE id=1")
conn.commit()  # 이걸 빠뜨리면 연결이 닫힐 때 ROLLBACK됨

# MySQL Connector/Python: autocommit=False가 기본이지만
# 여러 라이브러리마다 기본값이 다름
```

규칙은 단순하다:
- DML을 여러 개 묶어서 원자적으로 처리해야 하면 → 명시적 `BEGIN` + `COMMIT/ROLLBACK`
- 단일 DML이고 즉시 반영이 필요하면 → AUTO COMMIT 허용

## DDL의 암묵적 커밋 (MySQL, Oracle)

MySQL과 Oracle에서는 DDL 실행 전에 진행 중인 DML 트랜잭션이 자동으로 커밋된다.

```sql
-- MySQL: 위험한 패턴
BEGIN;
UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
-- 여기서 ALTER TABLE을 실행하면 위의 UPDATE가 자동 커밋됨!
ALTER TABLE accounts ADD COLUMN note TEXT;
-- 이 시점에 UPDATE가 이미 커밋 → ROLLBACK해도 되돌릴 수 없음
ROLLBACK;  -- 효과 없음
```

PostgreSQL은 이 문제가 없다. DDL도 트랜잭션 안에서 실행되고 `ROLLBACK`으로 되돌릴 수 있다.

## 정리

| 분류 | 대표 명령 | 트랜잭션 영향 | 롤백 가능 |
|------|----------|-------------|---------|
| DDL | CREATE, ALTER, DROP | PG: 가능 / Oracle·MySQL: 묵시적 커밋 | PG만 가능 |
| DML | INSERT, UPDATE, DELETE | 트랜잭션 일부 | 가능 |
| DQL | SELECT | 없음 | 해당 없음 |
| DCL | GRANT, REVOKE | DB마다 다름 | 대부분 불가 |
| TCL | COMMIT, ROLLBACK | 트랜잭션 경계 | 해당 없음 |

---

**지난 글:** [SQL 클라이언트-서버 프로토콜과 쿼리 처리 흐름](/posts/sql-client-server-protocol/)

**다음 글:** [CREATE TABLE 기초: 테이블 생성의 모든 것](/posts/sql-create-table-basics/)

<br>
읽어주셔서 감사합니다. 😊
