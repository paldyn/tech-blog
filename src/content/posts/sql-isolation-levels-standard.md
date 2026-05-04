---
title: "트랜잭션 격리 수준 표준"
description: "READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE 4단계 격리 수준의 의미, 허용 이상 현상, DB별 기본값, 설정 구문을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "isolation-level", "transaction", "read-committed", "repeatable-read", "serializable", "mvcc", "dirty-read", "phantom-read"]
featured: false
draft: false
---

[지난 글](/posts/sql-acid-properties/)에서 ACID 속성 중 격리성(Isolation)이 잠금 또는 MVCC로 구현된다고 짚었다. 이번에는 SQL 표준이 정의한 **격리 수준 4단계**—READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE—를 하나씩 살펴본다.

---

## 왜 격리 수준이 필요한가

완벽한 격리(SERIALIZABLE)는 직렬 실행과 동일하므로 동시 처리량이 급감한다. 실무에서는 성능을 위해 격리를 일부 완화하고, 허용 가능한 이상 현상(anomaly)을 선택한다.

![격리 수준 4단계 표](/assets/posts/sql-isolation-levels-standard-table.svg)

---

## 4단계 격리 수준

### READ UNCOMMITTED

다른 트랜잭션이 아직 커밋하지 않은 변경도 읽을 수 있다.

```sql
-- Tx1이 아직 커밋 전임에도 Tx2에서 변경된 값이 보임 → Dirty Read
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
BEGIN;
SELECT balance FROM accounts WHERE id = 1;
-- Tx1이 rollback하면 읽었던 값은 무효
COMMIT;
```

Dirty Read를 허용하므로 실무에서는 거의 사용하지 않는다. 극단적인 리포트 성능이 필요한 상황에서 드물게 사용한다.

### READ COMMITTED

커밋된 데이터만 읽는다. Dirty Read는 방지하지만 **Non-Repeatable Read**가 발생한다.

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000 반환
-- 이 사이에 Tx2가 잔액을 900으로 변경하고 COMMIT
SELECT balance FROM accounts WHERE id = 1;  -- 900 반환
-- 같은 쿼리인데 다른 결과 → Non-Repeatable Read
COMMIT;
```

**PostgreSQL, Oracle의 기본값**. 대부분의 웹 애플리케이션에 적합하다.

### REPEATABLE READ

한 트랜잭션 내에서 같은 행을 여러 번 읽어도 동일한 결과를 보장한다. Non-Repeatable Read를 방지하지만 **Phantom Read**가 발생할 수 있다.

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN;
SELECT COUNT(*) FROM orders WHERE amount > 100;  -- 5건
-- 이 사이에 Tx2가 새 주문(amount=150)을 INSERT+COMMIT
SELECT COUNT(*) FROM orders WHERE amount > 100;  -- 6건
-- 새 행이 나타남 → Phantom Read (이론상)
COMMIT;
```

**MySQL InnoDB의 기본값**. InnoDB는 MVCC로 Phantom Read를 대부분 방지하지만 `SELECT ... FOR UPDATE` 등 잠금 읽기에서는 예외가 있다.

### SERIALIZABLE

모든 트랜잭션이 순서대로 실행된 것과 동일한 결과를 보장한다. 이상 현상이 없지만 동시성이 가장 낮다.

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;
SELECT COUNT(*) FROM orders WHERE amount > 100;
-- Tx2가 새 INSERT를 시도하면 Tx1이 완료될 때까지 대기하거나 오류
COMMIT;
```

금융·회계·재고 등 정확성이 최우선인 업무에 사용한다.

---

## DB별 기본값과 특이사항

![격리 수준 설정 코드](/assets/posts/sql-isolation-levels-standard-code.svg)

| DB | 기본 격리 수준 | 특이사항 |
|----|-------------|---------|
| PostgreSQL | READ COMMITTED | SSI(Serializable Snapshot Isolation) 지원 |
| MySQL InnoDB | REPEATABLE READ | MVCC로 팬텀 대부분 방지 |
| Oracle | READ COMMITTED | READ UNCOMMITTED 미지원 |
| SQL Server | READ COMMITTED | RCSI(행 버전 기반 RC) 설정 가능 |
| SQLite | SERIALIZABLE (WAL 이전) | WAL 모드에서 동시 읽기 가능 |

---

## 격리 수준 선택 기준

| 상황 | 권장 격리 수준 |
|------|-------------|
| 일반 웹 서비스 CRUD | READ COMMITTED |
| 재무 계산, 잔액 확인 | REPEATABLE READ |
| 순서 보장·재고 차감 | SERIALIZABLE |
| 리포트 전용 읽기 | READ COMMITTED (또는 스냅샷) |

---

## 실무 팁

격리 수준을 높이면 이상 현상이 줄어들지만 **교착상태(Deadlock) 가능성이 증가**하고 대기 시간이 늘어난다. 대부분의 OLTP 애플리케이션에서는 READ COMMITTED가 합리적인 선택이며, 특정 트랜잭션에서만 격리 수준을 올리는 방식을 사용한다.

```sql
-- 특정 트랜잭션만 높은 격리 수준 사용
BEGIN;
SET LOCAL TRANSACTION ISOLATION LEVEL SERIALIZABLE;  -- PostgreSQL
SELECT SUM(balance) FROM accounts;  -- 정확한 합계 필요
COMMIT;
```

---

**지난 글:** [ACID 속성 완전 이해](/posts/sql-acid-properties/)

**다음 글:** [동시성 이상 현상](/posts/sql-concurrency-anomalies/)

<br>
읽어주셔서 감사합니다. 😊
