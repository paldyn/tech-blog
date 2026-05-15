---
title: "postgresql.conf 핵심 파라미터 튜닝 가이드"
description: "shared_buffers·work_mem·effective_cache_size 메모리 3총사, WAL 튜닝, 체크포인트 설정, autovacuum 공격적 조정까지 운영 환경 postgresql.conf에서 반드시 손봐야 할 파라미터를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["postgresql", "postgresql-conf", "튜닝", "shared-buffers", "work-mem", "autovacuum"]
featured: false
draft: false
---

[지난 글](/posts/pg-pgbouncer/)에서 PgBouncer로 커넥션 수를 줄이는 방법을 살펴봤습니다. 커넥션 풀링과 함께 PostgreSQL 성능에 가장 직접적으로 영향을 미치는 것이 `postgresql.conf` 파라미터입니다. 기본값 그대로 운영하면 서버 자원의 상당 부분을 낭비합니다.

## 메모리 파라미터 3총사

![PostgreSQL 메모리 파라미터](/assets/posts/pg-postgresql-conf-memory.svg)

### shared_buffers

PostgreSQL이 직접 관리하는 **공유 버퍼 캐시**입니다. 자주 접근하는 데이터 페이지가 여기에 캐시됩니다. 총 RAM의 **25%** 를 권장 시작점으로 삼습니다.

```sql
-- 현재 버퍼 캐시 히트율 확인
SELECT
  round(blks_hit * 100.0 / (blks_hit + blks_read), 2) AS cache_hit_rate
FROM pg_stat_database
WHERE datname = current_database();
-- 99% 이상이면 shared_buffers가 충분
```

### work_mem

정렬(ORDER BY), 해시 조인, 해시 집계 등에 사용하는 작업 메모리입니다. 중요한 점은 **연결 수 × 노드 수**만큼 동시에 사용될 수 있다는 것입니다. 50개 연결에서 각 쿼리가 해시 조인 4개를 사용한다면, `work_mem × 200`만큼 메모리가 필요합니다.

```sql
-- 특정 세션에서만 높게 설정 (DBA 분석용)
SET work_mem = '1GB';
EXPLAIN ANALYZE SELECT ...;
RESET work_mem;
```

### effective_cache_size

플래너가 인덱스 스캔 비용을 계산할 때 참고하는 **힌트값**입니다. 실제로 메모리를 할당하지 않습니다. `shared_buffers` + OS 페이지 캐시(총 RAM의 50~75%)로 설정합니다.

```ini
# 32GB 서버 기준
shared_buffers          = 8GB
work_mem                = 32MB
effective_cache_size    = 24GB
```

## WAL과 체크포인트 튜닝

![WAL·체크포인트·자동 진공 튜닝](/assets/posts/pg-postgresql-conf-wal.svg)

### 체크포인트 분산

기본적으로 체크포인트가 짧은 시간 동안 많은 Dirty Page를 디스크에 기록해 I/O 스파이크가 발생합니다.

```ini
checkpoint_completion_target = 0.9   # 기본 0.5
max_wal_size                 = 4GB   # 대용량 쓰기 서버는 더 크게
```

`checkpoint_completion_target = 0.9`는 체크포인트 간격의 90% 시간에 걸쳐 I/O를 분산하라는 의미입니다.

## Autovacuum 공격적 조정

테이블이 커질수록 기본 autovacuum 설정은 너무 느립니다.

```sql
-- 특정 대용량 테이블에 개별 설정
ALTER TABLE large_orders SET (
  autovacuum_vacuum_scale_factor = 0.01,   -- 1% 변경 시 진공 (기본 20%)
  autovacuum_vacuum_cost_delay   = 2,      -- ms, 기본 20ms
  autovacuum_analyze_scale_factor= 0.005
);
```

## 연결 수 설정

```ini
max_connections     = 100   # PgBouncer 사용 시 낮게 유지
superuser_reserved_connections = 3  # DBA 긴급 접속 예약
```

PgBouncer와 함께 운영할 때 `max_connections`를 낮게 유지하는 것이 핵심입니다. `default_pool_size`(PgBouncer) ≤ `max_connections`(PostgreSQL) 관계를 지킵니다.

## 설정 변경 방법

```sql
-- 현재 설정 확인
SHOW shared_buffers;
SELECT name, setting, unit, context FROM pg_settings WHERE name LIKE '%buffer%';

-- 재시작 없이 변경 가능한 파라미터 (context = 'user' or 'sighup')
ALTER SYSTEM SET work_mem = '64MB';
SELECT pg_reload_conf();

-- 재시작 필요 파라미터 (context = 'postmaster')
-- shared_buffers, max_connections 등
```

pgtune(https://pgtune.leopard.in.ua)에서 서버 사양을 입력하면 권장 초기값을 자동으로 계산해 줍니다. 초기 설정의 기준점으로 활용하고, `pg_stat_bgwriter`, `pg_stat_database`, `pg_stat_user_tables` 뷰를 보며 점진적으로 조정합니다.

---

**지난 글:** [PgBouncer — PostgreSQL 커넥션 풀링](/posts/pg-pgbouncer/)

**다음 글:** [PostgreSQL 슬로우 쿼리 진단 — pg_stat_statements와 EXPLAIN](/posts/pg-slow-query-diagnosis/)

<br>
읽어주셔서 감사합니다. 😊
