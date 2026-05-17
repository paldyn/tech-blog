---
title: "MySQL autocommit과 트랜잭션 제어 — START TRANSACTION, SAVEPOINT"
description: "MySQL의 autocommit 기본 동작, START TRANSACTION으로 트랜잭션 경계를 명시하는 방법, DDL의 암묵적 COMMIT, SAVEPOINT를 이용한 부분 롤백 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 23
type: "knowledge"
category: "SQL"
tags: ["mysql", "autocommit", "transaction", "savepoint", "ddl", "commit", "rollback"]
featured: false
draft: false
---

[지난 글](/posts/mysql-deadlock-show-engine/)에서 데드락 감지와 분석 방법을 살펴봤습니다. 이번 글에서는 MySQL 트랜잭션의 기본 동작인 autocommit, 그리고 명시적 트랜잭션 제어와 SAVEPOINT를 다룹니다.

## autocommit 기본 동작

MySQL InnoDB는 기본적으로 `autocommit = ON` 상태로 세션을 시작합니다. 이 상태에서는 모든 단일 DML 문이 자동으로 트랜잭션을 시작하고 즉시 커밋합니다.

```sql
SHOW VARIABLES LIKE 'autocommit';
-- Value: ON

-- autocommit=ON 상태: 각 문장이 독립 트랜잭션
INSERT INTO orders (product, qty) VALUES ('A', 1);  -- 즉시 COMMIT
UPDATE products SET stock = stock - 1 WHERE id = 1; -- 즉시 COMMIT
-- 두 문장이 원자적으로 처리되지 않음!
```

이 동작은 단순 조회·삽입에는 편리하지만, 여러 테이블을 함께 변경해야 하는 비즈니스 로직에는 위험합니다. 원자성이 보장되지 않기 때문입니다.

![autocommit ON vs OFF 비교](/assets/posts/mysql-autocommit-transaction-flow.svg)

## 명시적 트랜잭션 시작

`START TRANSACTION` 또는 `BEGIN` 으로 명시적 트랜잭션을 시작하면, autocommit 설정과 무관하게 해당 세션에서 명시적인 `COMMIT` 또는 `ROLLBACK`이 있을 때까지 트랜잭션이 유지됩니다.

```sql
START TRANSACTION;
-- 또는: BEGIN;

INSERT INTO orders (product, qty) VALUES ('A', 1);
UPDATE products SET stock = stock - 1 WHERE id = 1;

-- 두 변경을 원자적으로 반영
COMMIT;

-- 또는 문제 발생 시 전체 취소
ROLLBACK;
```

`autocommit`을 세션 전체에서 끄는 방법도 있습니다.

```sql
SET SESSION autocommit = 0;
-- 이후 모든 DML이 자동으로 트랜잭션에 포함됨
-- 반드시 명시적 COMMIT/ROLLBACK 필요
```

## DDL의 암묵적 COMMIT

MySQL에서 DDL(`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `TRUNCATE TABLE` 등)은 실행 직전과 직후에 암묵적 COMMIT을 수행합니다. 트랜잭션 도중 DDL을 실행하면 그 이전의 미확정 DML이 자동으로 COMMIT되고, DDL 자체도 즉시 COMMIT됩니다.

```sql
START TRANSACTION;
INSERT INTO t1 VALUES (1);  -- 아직 COMMIT 안 됨

ALTER TABLE t2 ADD COLUMN v INT;
-- → 위 INSERT가 암묵적으로 COMMIT됨!
-- → ROLLBACK으로 INSERT를 되돌릴 수 없음

ROLLBACK;  -- 이미 늦음 — INSERT는 영구 반영됨
```

PostgreSQL은 트랜잭션 내 DDL을 지원하므로 ROLLBACK으로 되돌릴 수 있습니다. MySQL에서 마이그레이션 스크립트를 작성할 때 이 차이점에 주의해야 합니다.

## SAVEPOINT — 부분 롤백

`SAVEPOINT`는 트랜잭션 내에 체크포인트를 설정해 특정 시점까지만 롤백할 수 있게 합니다.

```sql
START TRANSACTION;

INSERT INTO batch_log VALUES ('step1', NOW());
SAVEPOINT sp1;

INSERT INTO batch_log VALUES ('step2', NOW());
-- 에러 발생!

ROLLBACK TO SAVEPOINT sp1;
-- step2의 INSERT만 취소, step1은 유지

-- 이후 처리 계속
INSERT INTO batch_log VALUES ('step2_retry', NOW());
COMMIT;
```

`RELEASE SAVEPOINT sp1`은 세이브포인트를 해제하지만 롤백은 하지 않습니다. 세이브포인트 이름은 중복 가능하며, 중복 시 가장 최근 세이브포인트가 사용됩니다.

![SAVEPOINT 부분 롤백](/assets/posts/mysql-autocommit-transaction-savepoint.svg)

## XA 트랜잭션 (분산 트랜잭션)

MySQL은 XA 프로토콜을 지원합니다. 여러 데이터베이스 서버나 리소스 매니저에 걸친 분산 트랜잭션을 2PC(Two-Phase Commit)로 처리합니다. 단, XA 트랜잭션은 일반 트랜잭션보다 비용이 높으므로 꼭 필요한 경우에만 사용합니다.

```sql
XA START 'trx-id-1';
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
XA END 'trx-id-1';
XA PREPARE 'trx-id-1';  -- Phase 1: 커밋 가능 확인
XA COMMIT 'trx-id-1';   -- Phase 2: 영구 반영
-- 문제 시: XA ROLLBACK 'trx-id-1';
```

## 트랜잭션 제어 요약

| 명령 | 동작 |
|---|---|
| `START TRANSACTION` / `BEGIN` | 명시적 트랜잭션 시작 |
| `COMMIT` | 변경 영구 반영 |
| `ROLLBACK` | 전체 취소 |
| `SAVEPOINT name` | 체크포인트 설정 |
| `ROLLBACK TO SAVEPOINT name` | 해당 시점까지 부분 롤백 |
| `RELEASE SAVEPOINT name` | 세이브포인트 해제 (롤백 없음) |
| `SET autocommit = 0/1` | 세션 autocommit 설정 |

autocommit은 편의 기능이지만, 비즈니스 로직을 작성할 때는 명시적으로 트랜잭션 경계를 설정하는 것이 안전합니다. DDL의 암묵적 COMMIT 동작을 기억해 두면 마이그레이션 스크립트 작성 시 예상치 못한 데이터 손실을 피할 수 있습니다.

---

**지난 글:** [MySQL 데드락 분석 — SHOW ENGINE INNODB STATUS 읽는 법](/posts/mysql-deadlock-show-engine/)

**다음 글:** [MySQL 클러스터드 인덱스와 세컨더리 인덱스](/posts/mysql-clustered-secondary-index/)

<br>
읽어주셔서 감사합니다. 😊
