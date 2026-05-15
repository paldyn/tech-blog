---
title: "Shared Buffers와 work_mem — PostgreSQL 메모리 심화"
description: "PostgreSQL의 Shared Buffers Clock-Sweep 교체 알고리즘, OS Kernel Page Cache와의 이중 버퍼링 문제, work_mem의 노드 단위 할당 방식, effective_cache_size의 역할, 그리고 pg_buffercache 확장으로 버퍼 활용도를 분석하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["postgresql", "shared-buffers", "work-mem", "effective-cache-size", "clock-sweep", "pg-buffercache", "double-buffering", "temp-buffers", "maintenance-work-mem", "memory-tuning"]
featured: false
draft: false
---

[지난 글](/posts/pg-process-model/)에서 PostgreSQL 프로세스 모델과 로컬 메모리의 종류를 살펴봤다. 이번에는 메모리 각 영역의 동작 방식과 실무 튜닝 방법을 더 깊이 파고든다.

## Shared Buffers — PostgreSQL의 페이지 캐시

PostgreSQL은 테이블과 인덱스를 8KB 단위 **페이지**로 읽고 쓴다. Shared Buffers는 이 페이지를 메모리에 캐싱하는 공간이다. 캐시에 있으면 디스크 I/O 없이 처리되고(Buffer Hit), 없으면 디스크에서 읽어 캐시에 올린다(Buffer Miss).

권장 크기는 **전체 RAM의 25%**다. 예를 들어 32GB 서버라면 `shared_buffers = 8GB`. 일반적으로 이 이상 늘리면 OS Kernel Page Cache 공간이 줄어들어 오히려 역효과가 나는 경우가 많다.

```ini
# postgresql.conf
shared_buffers = 8GB                # RAM 25%
effective_cache_size = 24GB         # RAM 75% (플래너 힌트용)
work_mem = 8MB                      # 정렬/해시 노드당
maintenance_work_mem = 512MB        # VACUUM·INDEX 전용
```

## Clock-Sweep 교체 알고리즘

Shared Buffers가 가득 찼을 때 교체 대상 페이지를 선택하는 알고리즘이다. PostgreSQL은 LRU의 근사 알고리즘인 **Clock-Sweep**을 사용한다.

각 버퍼 슬롯은 `usage_count(0~5)` 카운터를 갖는다. 페이지에 접근할 때마다 카운터가 증가하고, Clock이 한 바퀴 돌며 카운터가 0인 페이지를 교체한다.

![PostgreSQL 메모리 레이아웃](/assets/posts/pg-memory-buffers-layout.svg)

자주 접근하는 **핫 페이지**는 usage_count가 높아 교체되지 않는다. 반면 Sequential Scan으로 한 번만 읽고 버리는 대형 테이블은 `Ring Buffer`라는 별도의 작은 캐시를 사용해 핫 페이지를 밀어내지 않도록 보호한다.

## OS Kernel Page Cache와의 이중 버퍼링

PostgreSQL은 Shared Buffers 외에도 OS Kernel Page Cache에 또 한 번 캐싱될 수 있다. 이를 **이중 버퍼링(double buffering)**이라 한다. 메모리가 낭비되는 구조지만, `O_DIRECT`를 쓰지 않는 일반 설정에서는 피할 수 없다.

이 때문에 `effective_cache_size`라는 힌트 파라미터가 존재한다. 플래너는 이 값을 "얼마나 많은 메모리가 OS 캐시로 사용 가능한가"의 추정치로 사용해 Index Scan vs Sequential Scan을 결정한다. 실제 메모리를 할당하지 않는다.

```sql
-- OS 페이지 캐시 사용량 확인 (Linux)
-- free -h 또는 /proc/meminfo의 Cached 항목 참조

-- effective_cache_size 설정 (실제 OS 캐시 크기 기준)
-- RAM 32GB, shared_buffers 8GB인 경우
SHOW effective_cache_size;  -- 현재 설정 확인
```

## work_mem — 연산 노드당 메모리

`work_mem`은 정렬(Sort), 해시 조인(Hash Join), Bitmap Index Scan에서 메모리를 허용하는 크기다. 이 크기를 초과하면 디스크 임시 파일을 사용한다.

주의할 점은 **하나의 쿼리가 여러 노드를 가질 수 있다**는 것이다.

```sql
-- 정렬 노드 2개 + 해시 조인 1개인 쿼리: 최대 3 × work_mem 소비
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.*, b.name
FROM   orders a
JOIN   customers b ON a.customer_id = b.id
ORDER  BY a.amount DESC, a.created_at;
```

병렬 쿼리가 활성화되면 각 작업자가 독립적으로 `work_mem`을 사용하므로 실제 소비는 배가된다.

```sql
-- 무거운 분석 쿼리 실행 전 세션에서만 늘리기
SET work_mem = '256MB';
SELECT /* 복잡한 집계 쿼리 */ ...;
RESET work_mem;
```

![Shared Buffers 활용도 모니터링 SQL](/assets/posts/pg-memory-buffers-sql.svg)

## maintenance_work_mem과 temp_buffers

`maintenance_work_mem`은 유지보수 작업 전용 메모리다. VACUUM이 Dead Tuple을 수집하거나 CREATE INDEX가 정렬 단계를 처리할 때 사용한다. `work_mem`과 달리 동시에 실행되는 유지보수 작업 수가 많지 않으므로 크게 설정해도 안전하다.

`temp_buffers`는 임시 테이블(CREATE TEMP TABLE)의 페이지 캐시다. 세션 시작 후 첫 임시 테이블 접근 전에만 `SET temp_buffers`가 적용된다.

```sql
-- VACUUM FULL 전 maintenance_work_mem 확보
SET maintenance_work_mem = '1GB';
VACUUM FULL orders;

-- 병렬 CREATE INDEX (PostgreSQL 11+)
SET max_parallel_maintenance_workers = 4;
CREATE INDEX CONCURRENTLY idx_orders_amount ON orders(amount);
```

## 버퍼 캐시 히트율 모니터링

캐시 히트율이 99% 미만이면 `shared_buffers` 증설을 고려한다.

```sql
-- 전체 캐시 히트율
SELECT
  ROUND(blks_hit::numeric / NULLIF(blks_hit + blks_read, 0) * 100, 2) AS hit_pct
FROM pg_stat_database
WHERE datname = current_database();

-- 테이블별 히트율 (낮은 테이블이 병목)
SELECT relname,
       heap_blks_read  AS disk_reads,
       heap_blks_hit   AS cache_hits,
       ROUND(heap_blks_hit::numeric
             / NULLIF(heap_blks_hit + heap_blks_read, 0) * 100, 1) AS hit_pct
FROM   pg_statio_user_tables
WHERE  heap_blks_read > 0
ORDER  BY disk_reads DESC
LIMIT  20;
```

## 권장 메모리 튜닝 체크리스트

| 설정 | 권장값 | 비고 |
|---|---|---|
| `shared_buffers` | RAM × 25% | 최대 8GB까지 증가 효과 확실 |
| `effective_cache_size` | RAM × 75% | 플래너 힌트, 실제 할당 아님 |
| `work_mem` | 4-16MB | 병렬 쿼리 시 곱셈 주의 |
| `maintenance_work_mem` | 256MB-1GB | VACUUM·INDEX 성능 향상 |
| `temp_buffers` | 8-32MB | 임시 테이블 많이 쓰면 증설 |

## 정리

PostgreSQL 메모리 튜닝의 핵심은 `shared_buffers`를 적절히 크게 잡고, `work_mem`은 작게 유지하며, 필요한 쿼리에서만 세션 단위로 올리는 것이다. `effective_cache_size`는 실제 메모리를 사용하지 않으므로 넉넉히 설정해도 무방하다.

---

**지난 글:** [PostgreSQL 프로세스 모델](/posts/pg-process-model/)

**다음 글:** [PostgreSQL 스토리지 — Heap과 TOAST](/posts/pg-storage-heap-toast/)

<br>
읽어주셔서 감사합니다. 😊
