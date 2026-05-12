---
title: "PostgreSQL 격리 수준 구현 — 스냅샷과 가시성 체크"
description: "PostgreSQL이 MVCC 스냅샷(xmin, xmax, xip[])으로 격리 수준을 구현하는 원리, READ COMMITTED와 REPEATABLE READ에서 스냅샷 획득 시점의 차이, 그리고 실제 Non-Repeatable Read와 Phantom Read 발생 여부를 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["postgresql", "isolation", "mvcc", "snapshot", "read-committed", "repeatable-read", "serializable", "xid", "visibility", "concurrency"]
featured: false
draft: false
---

[지난 글](/posts/pg-autovacuum-tuning/)에서 Dead 튜플을 회수하는 autovacuum을 다뤘다. 이번에는 MVCC가 어떻게 동시 트랜잭션 간의 격리를 실현하는지 — 즉 PostgreSQL이 스냅샷을 통해 각 격리 수준을 구현하는 내부 메커니즘을 살펴본다.

## 스냅샷의 구조

트랜잭션이 시작되어 첫 번째 쿼리를 실행하는 순간 PostgreSQL은 `GetSnapshotData()`를 호출해 현재 공유 메모리에서 활성 XID 목록을 수집한다. 스냅샷은 세 값으로 요약된다.

```
xmin  : 가장 오래된 활성 트랜잭션의 XID
xmax  : 아직 할당되지 않은 다음 XID (스냅샷 생성 직후의 nextXid)
xip[] : xmin ≤ XID < xmax 범위에서 아직 커밋되지 않은 XID 목록
```

이 스냅샷을 기준으로 튜플의 xmin과 xmax를 비교해 가시성을 판단한다.

```sql
-- 현재 트랜잭션 스냅샷 확인 (txid 기반)
BEGIN;
SELECT txid_current_snapshot();
-- 예: 1500:1503:1501  →  xmin=1500, xmax=1503, xip={1501}
SELECT txid_current();
-- 현재 트랜잭션의 XID
COMMIT;
```

![스냅샷 구조와 가시성 판단 로직](/assets/posts/pg-isolation-implementation-snapshot.svg)

## READ COMMITTED — 쿼리마다 새 스냅샷

`READ COMMITTED`(PostgreSQL 기본값)에서는 **각 SQL 문이 실행될 때마다** 새로운 스냅샷을 획득한다. 따라서 같은 트랜잭션 내에서 같은 행을 두 번 조회해도, 그 사이에 다른 트랜잭션이 커밋했다면 두 번째 조회에서는 새 값을 본다.

```sql
-- 세션 A: READ COMMITTED (기본값)
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000 반환

-- (세션 B가 balance를 1500으로 UPDATE·COMMIT)

SELECT balance FROM accounts WHERE id = 1;  -- 1500 반환 ← 변경 보임
-- Non-Repeatable Read 발생
COMMIT;
```

`WHERE` 조건을 만족하는 행이 다른 트랜잭션의 UPDATE 이후 조건에서 빠질 수도 있다. `UPDATE t SET ...`도 실행 시점에 새 스냅샷으로 대상 행을 재탐색하므로, 트랜잭션 시작 후 다른 트랜잭션이 커밋한 변경을 대상으로 삼을 수 있다.

## REPEATABLE READ — 트랜잭션 첫 쿼리에 스냅샷 고정

`REPEATABLE READ`에서는 트랜잭션의 **첫 번째 쿼리**가 실행되는 시점에 스냅샷이 고정되고 이후 모든 쿼리에서 동일 스냅샷을 사용한다. 같은 조회를 반복해도 항상 동일 결과를 반환한다.

```sql
-- 세션 A: REPEATABLE READ
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE id = 1;  -- 1000 반환 (스냅샷 고정)

-- (세션 B가 balance를 1500으로 UPDATE·COMMIT)

SELECT balance FROM accounts WHERE id = 1;  -- 여전히 1000 ← 스냅샷 고정
COMMIT;
```

흥미로운 점은 PostgreSQL의 `REPEATABLE READ`가 SQL 표준에서는 허용하는 **Phantom Read도 방지**한다는 것이다. 스냅샷을 고정하기 때문에 `INSERT`로 추가된 행도 기존 스냅샷 밖의 XID를 갖게 되어 보이지 않는다.

![RC vs RR 스냅샷 동작 차이](/assets/posts/pg-isolation-implementation-rc-vs-rr.svg)

## UPDATE 충돌과 스냅샷 재평가

`REPEATABLE READ`에서 두 트랜잭션이 같은 행을 수정하려 할 때 PostgreSQL은 나중에 도착한 트랜잭션을 **대기**시킨다. 먼저 커밋한 트랜잭션이 성공하면, 기다리던 트랜잭션은 이제 더 이상 유효하지 않은 스냅샷 기준으로 판단할 수 없으므로 오류로 중단된다.

```sql
-- 세션 A와 B 모두 REPEATABLE READ로 같은 행 UPDATE
-- A가 먼저 COMMIT → B는 아래 오류 수신:
-- ERROR: could not serialize access due to concurrent update

-- RC에서는 B가 대기 후 A의 변경을 덮어씀 (경합 조건 발생 가능)
```

이 동작이 `REPEATABLE READ`와 `SERIALIZABLE`을 구분하는 기준과 맞닿아 있다. 다음 글에서 다룰 SSI(Serializable Snapshot Isolation)는 이보다 더 넓은 범위의 직렬화 이상을 탐지한다.

## 격리 수준 설정

```sql
-- 세션 단위 설정
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- 개별 트랜잭션 단위 설정 (BEGIN과 함께)
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- 기본값 변경 (postgresql.conf)
-- default_transaction_isolation = 'read committed'

-- 현재 격리 수준 확인
SHOW transaction_isolation;
```

격리 수준은 성능과 정확성의 트레이드오프다. `READ COMMITTED`는 락 경합을 최소화하지만 동시 수정 간 이상 현상을 허용한다. `REPEATABLE READ`는 대부분의 이상을 방지하면서도 SSI 오버헤드 없이 운영할 수 있어 많은 OLTP 시스템의 실질적 선택지다.

---

**지난 글:** [PostgreSQL Autovacuum 튜닝 — 자동 공간 회수의 최적화](/posts/pg-autovacuum-tuning/)

**다음 글:** [SSI — 직렬화 스냅샷 격리의 충돌 감지](/posts/pg-ssi-serializable-snapshot/)

<br>
읽어주셔서 감사합니다. 😊
