---
title: "PostgreSQL Autovacuum 튜닝 — 자동 공간 회수의 최적화"
description: "Autovacuum worker가 언제 가동되는지 결정하는 임계값 계산 공식, scale_factor와 threshold 파라미터 조정 전략, XID Wraparound를 막는 Freeze 메커니즘, 그리고 대형 테이블에서 autovacuum이 너무 늦거나 빈번하지 않도록 튜닝하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["postgresql", "autovacuum", "vacuum", "freeze", "xid-wraparound", "bloat", "scale-factor", "pg-stat-user-tables", "storage-parameter"]
featured: false
draft: false
---

[지난 글](/posts/pg-vacuum-dead-tuple/)에서 VACUUM이 Dead 튜플을 회수하는 원리를 살펴봤다. 수동으로 `VACUUM`을 실행할 수도 있지만, 실제 운영 환경에서는 PostgreSQL이 자동으로 VACUUM을 트리거하는 **autovacuum** 데몬에 의존한다. 문제는 기본값이 소규모 테이블 기준으로 설정되어 있어, 수천만 행 이상의 대형 테이블에서는 VACUUM이 지나치게 늦게 실행된다는 점이다.

## Autovacuum 트리거 조건

Autovacuum은 두 가지 조건 중 하나가 만족되면 특정 테이블에 대해 worker를 가동한다.

```sql
-- VACUUM 조건
n_dead_tup > autovacuum_vacuum_threshold
          + autovacuum_vacuum_scale_factor * reltuples

-- ANALYZE 조건 (통계 갱신)
n_mod_since_analyze > autovacuum_analyze_threshold
                    + autovacuum_analyze_scale_factor * reltuples
```

기본값은 `vacuum_threshold = 50`, `vacuum_scale_factor = 0.20`이다. 1억 행 테이블이라면 Dead 튜플이 **2,000만 개**를 넘어야 VACUUM이 시작된다. 그 사이에 인덱스 비대화(bloat)가 진행되고, 조회 성능이 서서히 저하된다.

![Autovacuum 임계값 계산 구조](/assets/posts/pg-autovacuum-tuning-threshold.svg)

## 테이블별 스토리지 파라미터 설정

`postgresql.conf`를 변경하면 모든 테이블에 영향을 준다. 대형 테이블에는 개별 설정이 더 정밀하다.

```sql
-- 대형 테이블: scale_factor를 1% 수준으로 낮춤
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor    = 0.01,
  autovacuum_analyze_scale_factor   = 0.005,
  autovacuum_vacuum_threshold       = 1000,
  autovacuum_vacuum_cost_delay      = 10,   -- ms
  autovacuum_vacuum_cost_limit      = 400
);

-- 설정 확인
SELECT relname,
       reloptions
FROM   pg_class
WHERE  relname = 'orders';
```

`autovacuum_vacuum_cost_delay`와 `autovacuum_vacuum_cost_limit`는 VACUUM이 I/O를 얼마나 천천히 소비할지 결정하는 **스로틀링** 파라미터다. 기본 `cost_delay = 2ms`는 OLTP 트래픽을 보호하지만, VACUUM 속도가 느려져 Dead 튜플 누적을 따라가지 못할 수 있다.

## XID Wraparound와 Freeze

32비트 XID(트랜잭션 ID)는 약 21억 개가 최대다. XID가 순환하면 과거 튜플이 미래로 뒤집혀 보이지 않게 되는 **Wraparound** 재앙이 발생한다. 이를 막기 위해 VACUUM은 오래된 튜플의 xmin을 **FrozenXID**로 교체한다.

```sql
-- 데이터베이스 단위 Freeze 위험도 확인
SELECT datname,
       age(datfrozenxid)                          AS db_xid_age,
       2147483647 - age(datfrozenxid)              AS xids_left
FROM   pg_database
ORDER  BY db_xid_age DESC;

-- 위험 테이블 탐지 (age > 15000만이면 경고)
SELECT relname,
       age(relfrozenxid)                           AS xid_age
FROM   pg_class
WHERE  relkind = 'r'
ORDER  BY xid_age DESC
LIMIT  20;
```

`autovacuum_freeze_max_age`(기본 2억)를 초과하면 autovacuum은 강제로 해당 테이블의 VACUUM Freeze를 실행한다. 장기 실행 트랜잭션이 오래된 스냅샷을 붙잡고 있으면 Freeze가 진행되지 않으므로, `pg_stat_activity`로 유휴 트랜잭션을 주기적으로 점검해야 한다.

![XID Wraparound 방지 Freeze 메커니즘](/assets/posts/pg-autovacuum-tuning-xid-wraparound.svg)

## Autovacuum 활동 모니터링

```sql
-- 현재 실행 중인 autovacuum worker 확인
SELECT pid, query, state, now() - xact_start AS duration
FROM   pg_stat_activity
WHERE  query LIKE 'autovacuum:%';

-- 테이블별 VACUUM 이력
SELECT relname,
       last_autovacuum,
       last_autoanalyze,
       n_dead_tup,
       n_live_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup,0) * 100, 2) AS dead_ratio
FROM   pg_stat_user_tables
ORDER  BY n_dead_tup DESC
LIMIT  20;

-- Autovacuum 로그 상세 출력 (postgresql.conf)
-- log_autovacuum_min_duration = 250ms
```

`log_autovacuum_min_duration`을 250ms 정도로 설정하면 느린 autovacuum 실행 내역이 로그에 기록된다. 이를 통해 어떤 테이블이 VACUUM 시간을 독점하는지 파악할 수 있다.

## 핵심 정리

| 상황 | 조치 |
|------|------|
| 대형 테이블 VACUUM 지연 | `scale_factor`를 0.01~0.02로 낮춤 |
| VACUUM I/O로 서비스 영향 | `cost_delay` 늘리거나 `cost_limit` 낮춤 |
| XID age 위험 수준 | `VACUUM FREEZE` 수동 실행 |
| Bloat 심각 | `pg_repack`으로 잠금 없이 재구성 |
| 장기 유휴 트랜잭션 | `idle_in_transaction_session_timeout` 설정 |

---

**지난 글:** [VACUUM과 Dead 튜플 — 더티 공간 회수의 원리](/posts/pg-vacuum-dead-tuple/)

**다음 글:** [PostgreSQL 격리 수준 구현 — 스냅샷과 가시성 체크](/posts/pg-isolation-implementation/)

<br>
읽어주셔서 감사합니다. 😊
