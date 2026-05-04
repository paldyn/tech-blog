---
title: "2PL과 MVCC 이론"
description: "잠금 기반 동시성 제어 2PL(2-Phase Locking)과 스냅샷 기반 MVCC(Multi-Version Concurrency Control)의 원리, 특성 비교, PostgreSQL xmin/xmax 가시성 규칙, 실무 함의를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "2pl", "mvcc", "concurrency-control", "locking", "snapshot", "xmin", "xmax", "transaction", "serializable"]
featured: false
draft: false
---

[지난 글](/posts/sql-concurrency-anomalies/)에서 동시성 이상 현상을 살펴봤다. 이제 DB가 이상 현상을 어떻게 방지하는지—**2PL(2-Phase Locking)**과 **MVCC(Multi-Version Concurrency Control)**—의 내부 원리를 이해할 차례다.

---

## 동시성 제어의 두 갈래

트랜잭션들이 동시에 실행될 때 데이터 일관성을 지키는 방법은 크게 두 가지다.

1. **잠금 기반(Lock-based)**: 읽기·쓰기 전에 잠금을 획득하고, 완료 후 해제한다.
2. **버전 기반(Version-based)**: 데이터의 여러 버전을 유지하고, 각 트랜잭션은 자신의 스냅샷을 본다.

![2PL vs MVCC 비교](/assets/posts/sql-2pl-mvcc-theory-2pl.svg)

---

## 2PL: 2-Phase Locking

**2PL**은 트랜잭션을 두 단계로 나눈다.

- **Growing Phase(확장 단계)**: 필요한 잠금을 획득만 한다. 해제 불가.
- **Shrinking Phase(수축 단계)**: 잠금을 해제만 한다. 새로운 획득 불가.

```sql
-- 2PL 동작 예시 (SQL Server 기본 동작)
BEGIN;
-- Growing Phase: S-Lock 획득
SELECT balance FROM accounts WHERE id = 1;

-- X-Lock 업그레이드 (S → X)
UPDATE accounts SET balance = balance - 100 WHERE id = 1;

-- Lock Point: 최대 잠금 상태
-- Shrinking Phase는 COMMIT 시 시작 (Strict 2PL)
COMMIT;  -- 모든 잠금 해제
```

**Strict 2PL**: 모든 잠금을 커밋 시점까지 유지하다 한번에 해제한다. 대부분의 RDBMS가 이 방식을 사용한다.

### 2PL의 특성

- 직렬성(Serializability) 보장
- 읽기가 쓰기를 차단하거나 반대 (동시성 제한)
- **교착상태(Deadlock)** 가능성 존재 → DB가 감지 후 피해자 트랜잭션 강제 롤백

---

## MVCC: Multi-Version Concurrency Control

**MVCC**는 각 행의 여러 버전(Version)을 유지하고, 트랜잭션 시작 시점의 스냅샷에 해당하는 버전을 반환한다.

![MVCC 스냅샷 가시성](/assets/posts/sql-2pl-mvcc-theory-mvcc.svg)

```sql
-- PostgreSQL에서 MVCC 동작 확인
-- 트랜잭션 ID 확인
SELECT pg_current_xact_id();

-- 행의 숨겨진 시스템 컬럼 확인
SELECT xmin, xmax, ctid, * FROM accounts LIMIT 5;
-- xmin: 이 버전을 삽입한 트랜잭션 ID
-- xmax: 이 버전을 무효화한 트랜잭션 ID (0 = 현재 최신)
-- ctid: 물리적 위치 (블록, 오프셋)
```

### MVCC 가시성 규칙 (PostgreSQL)

행이 트랜잭션 스냅샷에서 보이려면:

```
xmin <= snapshot_xid  AND  (xmax = 0  OR  xmax > snapshot_xid)
```

즉, 나보다 **이전 트랜잭션이 삽입**했고 **삭제되지 않았거나 나보다 미래에 삭제**된 행만 보인다.

### MVCC의 특성

- **읽기가 쓰기를 차단하지 않음** → 높은 동시성
- 각 SELECT는 스냅샷 시점의 일관된 뷰를 봄
- 구버전 행이 쌓이면 공간 낭비 → **PostgreSQL: VACUUM, MySQL InnoDB: Purge Thread**로 정리
- 쓰기-쓰기 충돌은 여전히 잠금으로 해결

---

## MVCC 구현 방식 DB별 비교

| DB | 버전 저장 위치 | 정리 메커니즘 | 특이사항 |
|----|------------|------------|---------|
| PostgreSQL | 힙(heap) 내 다중 버전 | VACUUM / autovacuum | 행 외부 toasted 지원 |
| MySQL InnoDB | Undo Log 체인 | Purge Thread | DB_TRX_ID + DB_ROLL_PTR |
| Oracle | Undo Tablespace 체인 | 자동 정리 | SCN 기반 일관성 |
| SQL Server | tempdb 버전 저장소 | 자동 정리 | RCSI(행 버전 RC) 옵션 |

---

## 2PL vs MVCC: 언제 무엇을?

| 기준 | 2PL | MVCC |
|------|-----|------|
| 읽기 동시성 | 낮음 (쓰기에 블록) | 높음 (비차단 읽기) |
| 쓰기 충돌 | 잠금으로 직접 방지 | 잠금 + 버전 충돌 감지 |
| 교착상태 | 발생 가능 | 쓰기-쓰기에서 발생 |
| 저장 공간 | 추가 공간 불필요 | 구버전 공간 필요 |
| 직렬성 | 보장 가능 | SSI(PostgreSQL)로 보장 |

현대 RDBMS는 **MVCC + 쓰기 잠금**을 혼합해 사용한다. 읽기는 MVCC로 비차단, 쓰기는 행 수준 잠금으로 제어한다.

---

## SSI: Serializable Snapshot Isolation

PostgreSQL 9.1+는 SSI를 통해 MVCC로도 SERIALIZABLE을 구현한다. 직렬성 위반이 감지되면 트랜잭션을 롤백하고 재시도를 요구한다.

```sql
-- PostgreSQL SSI
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;
-- ... 읽기/쓰기
COMMIT;
-- 직렬성 위반 시: ERROR: could not serialize access due to read/write dependencies
-- → 애플리케이션에서 재시도 로직 필요
```

---

**지난 글:** [동시성 이상 현상](/posts/sql-concurrency-anomalies/)

**다음 글:** [데드락의 본질과 해결](/posts/sql-deadlock-essence/)

<br>
읽어주셔서 감사합니다. 😊
