---
title: "PostgreSQL 슬로우 쿼리 진단 — pg_stat_statements와 EXPLAIN"
description: "PostgreSQL에서 느린 쿼리를 찾고 고치는 실전 워크플로우를 정리합니다. pg_stat_statements로 문제 쿼리를 특정하고, EXPLAIN ANALYZE BUFFERS로 실행 계획을 해석해 인덱스나 쿼리를 개선하는 과정을 단계별로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["postgresql", "slow-query", "explain-analyze", "pg-stat-statements", "성능진단", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/pg-postgresql-conf/)에서 postgresql.conf 파라미터로 서버 수준 성능을 개선했습니다. 이번에는 특정 쿼리가 느릴 때 원인을 찾고 고치는 **슬로우 쿼리 진단 워크플로우**를 살펴봅니다.

## 진단 3단계

![슬로우 쿼리 진단 워크플로우](/assets/posts/pg-slow-query-diagnosis-flow.svg)

슬로우 쿼리 진단은 세 단계로 이루어집니다.
1. **어떤 쿼리가 느린지** 찾기 (`pg_stat_statements`, 슬로우 쿼리 로그)
2. **왜 느린지** 실행 계획으로 분석 (`EXPLAIN ANALYZE BUFFERS`)
3. **어떻게 개선할지** 실행 (인덱스 추가, 쿼리 재작성, 통계 갱신)

## pg_stat_statements로 문제 쿼리 특정

### 익스텐션 활성화

```sql
-- postgresql.conf에 추가 (재시작 필요)
-- shared_preload_libraries = 'pg_stat_statements'

-- 익스텐션 생성
CREATE EXTENSION pg_stat_statements;
```

### 상위 슬로우 쿼리 추출

![pg_stat_statements — 상위 슬로우 쿼리 추출](/assets/posts/pg-slow-query-diagnosis-stats.svg)

```sql
-- 평균 응답 시간 기준 추출 (빈번하지만 느린 쿼리)
SELECT LEFT(query, 80)       AS snippet,
       calls,
       round(mean_exec_time) AS avg_ms,
       round(stddev_exec_time) AS stddev_ms
FROM   pg_stat_statements
ORDER  BY mean_exec_time DESC
LIMIT  10;
```

`total_exec_time`이 높은 쿼리는 **총 시간 누적이 크므로** 서버 부하에 가장 큰 영향을 미칩니다. `mean_exec_time`이 높은 쿼리는 **단건이 느린** 경우입니다. 두 기준 모두 확인합니다.

## EXPLAIN ANALYZE 해석

```sql
-- 실제 실행 후 통계 포함 (쓰기 쿼리는 BEGIN/ROLLBACK으로 감싸기)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.name, SUM(o.amount)
FROM   customers c
JOIN   orders o ON c.id = o.cust_id
WHERE  o.created_at >= '2026-01-01'
GROUP  BY c.name;
```

| 출력 항목 | 의미 | 이상 신호 |
|----------|------|-----------|
| `Seq Scan` | 테이블 전체 스캔 | 대용량 테이블에서 출현 시 |
| `actual time` | 실제 소요 ms | cost 대비 크게 다를 때 |
| `Buffers: read` | 디스크에서 읽은 블록 수 | hit 대비 read가 많을 때 |
| `rows=1000 (actual 1)` | 추정 행수 오차 | 오차가 크면 ANALYZE 실행 |

### 핵심 개선 패턴

```sql
-- 1. Seq Scan 개선: 조건 컬럼에 인덱스 추가
CREATE INDEX CONCURRENTLY idx_orders_created_at
ON orders (created_at);

-- 2. 통계 오차 개선: 통계 수집
ANALYZE orders;

-- 3. 부분 인덱스로 필터 최적화
CREATE INDEX CONCURRENTLY idx_orders_active
ON orders (cust_id)
WHERE status = 'active';
```

## 슬로우 쿼리 로그 설정

```ini
# postgresql.conf
log_min_duration_statement = 1000   # 1초 이상 쿼리 로깅
log_line_prefix = '%m [%p] %d %u'
```

`log_min_duration_statement = 0`으로 모든 쿼리를 기록하면 pgBadger로 로그를 분석해 시각적 보고서를 생성할 수 있습니다.

## 현재 실행 중인 쿼리 확인

```sql
-- 5초 이상 실행 중인 쿼리
SELECT pid, now() - query_start AS duration, state, query
FROM   pg_stat_activity
WHERE  state != 'idle'
AND    query_start < now() - INTERVAL '5 seconds'
ORDER  BY duration DESC;

-- 락 대기 쿼리 (락 경합 의심)
SELECT pid, wait_event_type, wait_event, query
FROM   pg_stat_activity
WHERE  wait_event IS NOT NULL;
```

락 대기가 원인이라면 `pg_locks`와 `pg_stat_activity`를 조인해 누가 락을 잡고 있는지 확인하고 `pg_terminate_backend(pid)`로 블로킹 프로세스를 종료합니다.

---

**지난 글:** [postgresql.conf 핵심 파라미터 튜닝 가이드](/posts/pg-postgresql-conf/)

**다음 글:** [MySQL 아키텍처 개요 — 서버 레이어와 스토리지 엔진](/posts/mysql-architecture-overview/)

<br>
읽어주셔서 감사합니다. 😊
