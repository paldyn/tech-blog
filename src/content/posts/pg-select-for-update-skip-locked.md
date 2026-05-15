---
title: "SELECT FOR UPDATE와 SKIP LOCKED — 행 수준 잠금 패턴"
description: "PostgreSQL의 SELECT FOR UPDATE / FOR SHARE / SKIP LOCKED / NOWAIT 동작 원리, 행 락 강도 비교, SKIP LOCKED로 구현하는 분산 작업 큐 패턴, 그리고 비관적 잠금이 SSI나 낙관적 락과 어떻게 다른지를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["postgresql", "select-for-update", "skip-locked", "nowait", "row-lock", "job-queue", "pessimistic-lock", "concurrency", "pgbouncer"]
featured: false
draft: false
---

[지난 글](/posts/pg-lock-types-pg-locks/)에서 PostgreSQL 락 유형의 전체 계층을 살펴봤다. 이번에는 그 중 가장 실무에서 자주 쓰이는 **행 수준 잠금** — `SELECT FOR UPDATE`와 그 변형들 — 을 집중적으로 다룬다.

## FOR UPDATE의 필요성

`REPEATABLE READ`와 `SERIALIZABLE`은 스냅샷으로 이상 현상을 방지하지만, "읽은 후 수정"이라는 전형적인 패턴에서는 명시적 행 잠금이 더 단순하고 예측 가능하다. 잔액 차감처럼 "읽은 값이 최신임을 보장해야 하는" 경우가 그렇다.

```sql
-- 잔액 차감 — FOR UPDATE 없이 하면 Lost Update 가능
BEGIN;
SELECT balance FROM accounts WHERE id = 42 FOR UPDATE;
-- 이 시점에 다른 트랜잭션은 같은 행의 FOR UPDATE/UPDATE에서 대기
UPDATE accounts SET balance = balance - 100 WHERE id = 42;
COMMIT;
```

`FOR UPDATE`는 해당 행에 `RowShareLock`(테이블), `For Update`(행) 락을 건다. 다른 트랜잭션이 같은 행을 `FOR UPDATE`하거나 `UPDATE`/`DELETE`하려 하면 대기한다.

![FOR UPDATE 변형 모드 비교](/assets/posts/pg-select-for-update-skip-locked-modes.svg)

## SKIP LOCKED로 분산 작업 큐 구현

`SKIP LOCKED`는 PostgreSQL 9.5에서 도입됐다. 행 수준 잠금을 획득할 수 없는(이미 잠긴) 행을 결과 집합에서 **건너뛰어** 반환한다. 여러 워커가 동시에 같은 쿼리를 실행해도 서로 다른 행을 가져가므로 중복 처리가 없다.

```sql
-- 작업 큐 테이블
CREATE TABLE jobs (
  id      BIGSERIAL PRIMARY KEY,
  status  TEXT DEFAULT 'pending',
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 워커의 작업 취득 쿼리 (LIMIT 1로 한 번에 하나씩)
BEGIN;
SELECT id, payload
FROM   jobs
WHERE  status = 'pending'
ORDER  BY id
LIMIT  1
FOR UPDATE SKIP LOCKED;

-- 처리 후
UPDATE jobs SET status = 'done' WHERE id = :id;
COMMIT;
```

`ORDER BY id`를 추가하면 FIFO 순서를 보장한다. 워커가 여럿이라도 각자 서로 다른 `id`를 가져가므로 데이터베이스 수준에서 상호 배제가 해결된다.

![SKIP LOCKED 기반 분산 큐 패턴](/assets/posts/pg-select-for-update-skip-locked-queue.svg)

## NOWAIT — 즉시 실패

`NOWAIT`는 잠긴 행을 만나면 대기하는 대신 즉시 오류를 반환한다. 단일 리소스를 "선점"하는 시나리오에 적합하다.

```sql
-- 특정 레코드를 선점하거나 즉시 실패
BEGIN;
SELECT * FROM payments WHERE id = 99 FOR UPDATE NOWAIT;
-- 이미 잠겨 있으면:
-- ERROR: could not obtain lock on row in relation "payments"
```

애플리케이션은 이 오류를 잡아 재시도하거나 사용자에게 "다른 세션이 처리 중"이라고 알릴 수 있다.

## OF table_name — 다중 조인에서 특정 테이블만 잠금

```sql
-- orders와 JOIN하되 items 행만 잠금
SELECT o.id, i.qty
FROM   orders o
JOIN   order_items i ON i.order_id = o.id
WHERE  o.id = 100
FOR UPDATE OF i;
-- o 테이블은 잠금 없음, i 테이블만 행 락
```

## 비관적 락 vs 낙관적 락

| 전략 | 구현 | 장점 | 단점 |
|------|------|------|------|
| 비관적 락 (`FOR UPDATE`) | DB 행 락 | 충돌 시 대기, 확실 | 대기 발생, 데드락 위험 |
| 낙관적 락 (version 컬럼) | `WHERE version = :v` | 락 없음 | 충돌 시 재시도 필요 |
| SSI | 자동 탐지 | 선언적 | 오버헤드, 재시도 필요 |

작업 큐나 소유권 이전처럼 "선점"이 핵심인 패턴은 `FOR UPDATE SKIP LOCKED`가, 낮은 충돌 빈도의 일반 비즈니스 로직은 낙관적 락이 적합하다.

---

**지난 글:** [PostgreSQL 락 유형과 pg_locks — 잠금 계층 이해](/posts/pg-lock-types-pg-locks/)

**다음 글:** [PostgreSQL B-Tree 인덱스 내부 구조](/posts/pg-btree-internals/)

<br>
읽어주셔서 감사합니다. 😊
