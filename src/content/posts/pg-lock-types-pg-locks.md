---
title: "PostgreSQL 락 유형과 pg_locks — 잠금 계층 이해"
description: "PostgreSQL의 테이블 수준 락 8가지, 행 수준 락 4가지, Advisory 락의 특성과 충돌 행렬, pg_locks 뷰와 pg_stat_activity를 조합해 락 대기 체인을 진단하는 방법, lock_timeout과 statement_timeout 설정으로 장기 대기를 방지하는 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["postgresql", "locks", "pg-locks", "deadlock", "table-lock", "row-lock", "advisory-lock", "lock-timeout", "concurrency", "pg-stat-activity"]
featured: false
draft: false
---

[지난 글](/posts/pg-ssi-serializable-snapshot/)에서 SSI가 직렬화 이상을 탐지하는 원리를 살펴봤다. 이번에는 PostgreSQL의 잠금 체계 전반을 다룬다. MVCC 덕분에 읽기와 쓰기는 대부분 충돌하지 않지만, DDL 변경이나 명시적 잠금이 필요한 시나리오에서는 락 충돌이 운영의 뇌관이 된다.

## 락 유형 개요

PostgreSQL의 잠금은 크게 세 계층으로 나뉜다.

1. **테이블 수준 락** — LWLock(Lightweight Lock)을 사용하며 SQL 문마다 자동 획득
2. **행 수준 락** — 힙 튜플 헤더에 기록, MVCC와 연동
3. **Advisory 락** — 애플리케이션이 임의 키로 잠금 설정

```sql
-- 현재 세션이 보유한 테이블 락 확인
SELECT l.relation::regclass AS table_name,
       l.mode,
       l.granted,
       a.pid,
       a.query
FROM   pg_locks        l
JOIN   pg_stat_activity a ON a.pid = l.pid
WHERE  l.locktype = 'relation'
  AND  a.pid <> pg_backend_pid();
```

![테이블·행·Advisory 락 계층 구조](/assets/posts/pg-lock-types-pg-locks-hierarchy.svg)

## 테이블 수준 락 충돌 행렬

`AccessExclusiveLock`은 모든 락과 충돌한다. `DROP TABLE`, `TRUNCATE`, `VACUUM FULL`, `LOCK TABLE` 명령이 이 모드를 획득한다. 운영 중인 테이블에 `ALTER TABLE`을 실행하면 대기 중인 SELECT 하나만 있어도 뒤따라 들어오는 모든 쿼리가 줄을 서게 된다.

```sql
-- ALTER TABLE 전 준비
SET lock_timeout = '3s';          -- 3초 내 획득 못 하면 오류
SET statement_timeout = '30s';    -- 문장 전체 30초 제한

-- 락 대기열 확인 후 작업
SELECT count(*) FROM pg_stat_activity
WHERE  wait_event_type = 'Lock';

-- 필요 시 블로커 강제 종료
SELECT pg_terminate_backend(pid)
FROM   pg_stat_activity
WHERE  state = 'idle in transaction'
  AND  now() - xact_start > interval '10 minutes';
```

## 행 수준 락과 FOR UPDATE

행 수준 락은 `SELECT FOR UPDATE` 등으로 명시 획득하거나 `UPDATE`·`DELETE`가 자동으로 걸어준다. 힙 튜플 헤더의 infomask 필드에 기록되며, 잠긴 행을 다른 트랜잭션이 수정하려 하면 대기하거나 충돌 오류를 반환한다.

```sql
-- 행 수준 락 모드 (강도 오름차순)
-- FOR KEY SHARE     : FK 참조 무결성 체크용
-- FOR SHARE         : 공유 읽기 락
-- FOR NO KEY UPDATE : KEY 컬럼 제외 업데이트
-- FOR UPDATE        : 가장 배타적, DELETE와 동일

-- 행 락 확인
SELECT pid, locktype, mode, granted, relation::regclass
FROM   pg_locks
WHERE  locktype = 'tuple';
```

## Advisory 락

Advisory 락은 데이터베이스 행이나 페이지와 무관하게 64비트 정수 키로 잠금을 설정한다. 분산 환경에서 외부 lock manager 없이 상호 배제가 필요할 때 유용하다.

```sql
-- 세션 단위 Advisory 락 (세션 종료 시 자동 해제)
SELECT pg_advisory_lock(42);
-- 비차단 버전 (즉시 반환: 획득 성공 여부 bool)
SELECT pg_try_advisory_lock(42);

-- 트랜잭션 단위 Advisory 락 (COMMIT/ROLLBACK 시 해제)
SELECT pg_advisory_xact_lock(42);

-- 해제
SELECT pg_advisory_unlock(42);
```

## 락 대기 체인 진단

![pg_locks 기반 대기 체인 진단 쿼리](/assets/posts/pg-lock-types-pg-locks-query.svg)

```sql
-- 데드락 로그 확인 (postgresql.conf)
-- deadlock_timeout = 1s  (기본값: 1초 후 탐지 시작)
-- log_lock_waits = on

-- 락 대기 그래프 (blocker/blocked PID 쌍)
SELECT blocking_pids, pid, query
FROM   pg_stat_activity
WHERE  cardinality(pg_blocking_pids(pid)) > 0;
```

`pg_blocking_pids(pid)` 함수는 특정 PID를 차단 중인 PID 배열을 반환한다 (PostgreSQL 9.6+). 빠르게 blocker를 찾는 가장 간단한 방법이다.

## 운영 팁

| 문제 | 진단 | 해결 |
|------|------|------|
| ALTER TABLE 대기 | `pg_locks` + lock_timeout | 트래픽 최소 시간대 실행 |
| 장기 idle-in-transaction | `pg_stat_activity` | `idle_in_transaction_session_timeout` 설정 |
| 데드락 빈발 | `pg_log` deadlock 항목 | 락 획득 순서 통일 |

---

**지난 글:** [SSI — 직렬화 스냅샷 격리의 충돌 감지](/posts/pg-ssi-serializable-snapshot/)

**다음 글:** [SELECT FOR UPDATE와 SKIP LOCKED — 행 수준 잠금 패턴](/posts/pg-select-for-update-skip-locked/)

<br>
읽어주셔서 감사합니다. 😊
