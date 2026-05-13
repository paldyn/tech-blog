---
title: "플래너 옵션 — 옵티마이저 동작을 제어하는 GUC 파라미터"
description: "PostgreSQL 플래너의 동작을 제어하는 enable_* 플래그와 비용 파라미터(random_page_cost, effective_cache_size, work_mem) 튜닝 방법, SSD 환경에서의 권장 설정, work_mem이 정렬과 해시에 미치는 영향을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["postgresql", "planner", "random-page-cost", "effective-cache-size", "work-mem", "enable-seqscan", "guc", "query-optimization"]
featured: false
draft: false
---

[지난 글](/posts/pg-join-order-geqo/)에서 옵티마이저가 조인 순서를 탐색하는 방법을 살펴봤다. 이번에는 그 옵티마이저의 **판단 기준 자체**를 바꾸는 GUC 파라미터들을 다룬다. 코스트 파라미터가 잘못 설정되면 통계와 인덱스가 완벽해도 옵티마이저가 나쁜 계획을 선택한다.

## 플래너 파라미터의 두 종류

PostgreSQL 플래너를 제어하는 GUC는 크게 두 종류다:

1. **enable_* 플래그**: 특정 실행 계획 타입의 사용 여부를 제어 (on/off)
2. **코스트 파라미터**: 각 연산의 상대적 비용을 수치로 표현

enable_* 플래그는 완전한 금지가 아니라 **높은 페널티를 부여**하는 방식이다. 대안이 없으면 off로 설정해도 해당 계획 타입이 선택될 수 있다.

## enable_* 플래그

![플래너 enable_* 플래그 — 실행 계획 타입 제어](/assets/posts/pg-planner-options-enable-flags.svg)

```sql
-- 인덱스를 강제로 사용하게 유도 (Seq Scan이 잘못 선택될 때)
SET enable_seqscan = off;
EXPLAIN (ANALYZE) SELECT * FROM orders WHERE status = 'pending';
SET enable_seqscan = on;  -- 반드시 원복

-- Nested Loop가 느릴 때 (대용량 조인에서 Hash Join 유도)
SET enable_nestloop = off;
EXPLAIN (ANALYZE)
SELECT o.*, u.name FROM orders o JOIN users u ON u.id = o.customer_id;
SET enable_nestloop = on;
```

enable_* 설정은 세션 레벨에서만 임시로 쓰고, `postgresql.conf`에 영구적으로 off를 넣는 건 권장하지 않는다. 통계가 갱신되거나 데이터 패턴이 바뀌면 해당 플래그가 오히려 최적 계획을 막을 수 있다.

## 코스트 파라미터

![코스트 파라미터 — 플래너의 판단 기준](/assets/posts/pg-planner-options-cost-params.svg)

모든 코스트 파라미터는 `seq_page_cost=1.0`을 기준으로 한 상대적 단위다.

### random_page_cost

가장 중요한 파라미터다. 기본값 4.0은 HDD 기준으로 설정되어 있어, SSD나 NVMe를 쓰는 현대 환경에서는 너무 높다. 이 값이 높으면 Index Scan 비용이 과대 추정되어 Seq Scan을 선호하게 된다.

```sql
-- 현재 설정 확인
SHOW random_page_cost;
SHOW seq_page_cost;

-- SSD 환경 권장값
ALTER SYSTEM SET random_page_cost = 1.1;
SELECT pg_reload_conf();

-- NVMe + shared_buffers 대부분 캐시 히트 시
ALTER SYSTEM SET random_page_cost = 1.0;

-- 테이블스페이스별 설정 (테이블마다 다른 스토리지 타입)
ALTER TABLESPACE ssd_ts SET (random_page_cost = 1.1);
ALTER TABLESPACE hdd_ts SET (random_page_cost = 4.0);
```

### effective_cache_size

실제로 메모리를 할당하는 파라미터가 아니다. 옵티마이저에게 OS 페이지 캐시 + shared_buffers의 총 예상 크기를 알려줘, 인덱스 페이지가 캐시에 있을 가능성을 추정하는 데 쓰인다. 값이 크면 Index Scan 비용을 낮게 추정한다.

```sql
-- 시스템 메모리의 50~75% 정도 설정
-- 메모리 16GB 서버: shared_buffers=4GB, effective_cache_size=12GB
ALTER SYSTEM SET effective_cache_size = '12GB';
SELECT pg_reload_conf();
```

### work_mem

정렬(`ORDER BY`, `DISTINCT`), 해시 조인, 해시 집계에 사용되는 메모리다. 이 값이 작으면 정렬이 디스크로 넘어가 느려진다.

```sql
-- 기본값 확인
SHOW work_mem;  -- 기본 4MB

-- 세션 레벨 임시 증가 (복잡한 분석 쿼리 실행 전)
SET work_mem = '256MB';

-- EXPLAIN ANALYZE에서 디스크 사용 확인
-- "Sort Method: external merge Disk: 1024kB" → work_mem 부족
-- "Sort Method: quicksort Memory: 256kB"    → 메모리 내 정렬

-- 글로벌 설정은 연결 수와 곱하면 최대 메모리 = work_mem × max_connections × 쿼리당 노드 수
-- 100연결 × 256MB × 5노드 = 128GB → 서버 메모리 초과 주의
ALTER SYSTEM SET work_mem = '32MB';  -- 안전한 글로벌 기본값
```

## parallel_setup_cost와 병렬 쿼리

PostgreSQL의 병렬 쿼리도 코스트 기반으로 선택된다.

```sql
-- 병렬 쿼리 관련 파라미터
SHOW max_parallel_workers_per_gather;  -- 기본 2
SHOW parallel_setup_cost;              -- 기본 1000 (병렬 워커 시작 비용)
SHOW parallel_tuple_cost;              -- 기본 0.1 (튜플 전달 비용)
SHOW min_parallel_table_scan_size;    -- 기본 8MB (이 이상 시 병렬 고려)

-- 병렬 쿼리 유도 (큰 집계 쿼리)
SET max_parallel_workers_per_gather = 4;
SET parallel_setup_cost = 100;  -- 낮출수록 병렬 선호
EXPLAIN SELECT count(*), sum(amount) FROM orders;
```

## 설정 적용 시 주의사항

```sql
-- 현재 플래너 관련 설정 전체 보기
SELECT name, setting, unit, short_desc
FROM   pg_settings
WHERE  name IN (
    'seq_page_cost', 'random_page_cost',
    'effective_cache_size', 'work_mem',
    'enable_seqscan', 'enable_indexscan',
    'enable_hashjoin', 'enable_nestloop',
    'max_parallel_workers_per_gather'
)
ORDER  BY name;

-- ALTER SYSTEM 후 재로드 (재시작 없음)
SELECT pg_reload_conf();
-- 재시작이 필요한 파라미터인지 확인
SELECT name, pending_restart FROM pg_settings WHERE pending_restart = true;
```

---

**지난 글:** [조인 순서와 GEQO — 옵티마이저가 최적 조인 순서를 찾는 방법](/posts/pg-join-order-geqo/)

**다음 글:** [확장 통계 — 다중 컬럼 상관관계를 옵티마이저에게 알리는 방법](/posts/pg-extended-statistics/)

<br>
읽어주셔서 감사합니다. 😊
