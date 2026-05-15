---
title: "ANALYZE와 통계 — 옵티마이저가 신뢰하는 데이터"
description: "PostgreSQL ANALYZE가 수집하는 MCV, 히스토그램, 상관관계 통계의 구조, pg_stats 뷰로 통계를 직접 조회하는 방법, statistics_target 튜닝, n_distinct 왜곡 문제, autovacuum과 통계 갱신 시점 관리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["postgresql", "analyze", "statistics", "pg-stats", "n-distinct", "histogram", "mcv", "statistics-target", "autovacuum", "query-planner"]
featured: false
draft: false
---

[지난 글](/posts/pg-explain-analyze/)에서 EXPLAIN ANALYZE 출력을 해석하는 방법을 살펴봤다. 추정 rows와 실제 rows가 크게 다르면 통계 문제라고 했는데, 이번에는 그 **통계**가 어떻게 만들어지고 관리되는지 파고든다.

## 왜 통계가 중요한가

옵티마이저는 실행 계획을 선택할 때 실제로 쿼리를 실행해보지 않는다. 대신 `pg_statistic` 카탈로그에 저장된 통계를 바탕으로 각 실행 계획의 예상 비용을 계산하고, 가장 낮은 비용의 계획을 선택한다. 통계가 오래되었거나 부정확하면 비용 추정이 틀려 느린 실행 계획을 선택하게 된다.

```sql
-- 통계 마지막 갱신 시점 확인
SELECT relname,
       n_live_tup,
       n_dead_tup,
       last_analyze,
       last_autoanalyze
FROM   pg_stat_user_tables
WHERE  relname = 'orders';
```

## ANALYZE가 수집하는 데이터

ANALYZE는 테이블에서 무작위 샘플(기본 300 × statistics_target 행)을 추출해 컬럼별 통계를 계산한다.

![pg_statistic 구조 — 옵티마이저 통계의 원천](/assets/posts/pg-analyze-statistics-pg-stats.svg)

주요 통계 항목:

- **null_frac**: NULL 비율 (0.0~1.0)
- **n_distinct**: 유일 값 수. 양수면 절대 개수, 음수면 비율 (`-0.3`이면 전체 행의 30%)
- **most_common_vals / most_common_freqs**: 상위 N개 값과 각 빈도
- **histogram_bounds**: 균등 빈도 히스토그램 경계값 (MCV 제외 후)
- **correlation**: 물리 저장 순서와 논리 정렬 순서의 상관계수

## pg_stats 뷰로 직접 조회

```sql
-- 특정 테이블의 모든 컬럼 통계 개요
SELECT attname,
       null_frac,
       n_distinct,
       correlation,
       array_length(most_common_vals::text::text[], 1) AS mcv_count
FROM   pg_stats
WHERE  tablename = 'orders'
ORDER  BY attname;

-- MCV 상세 (status 컬럼 예시)
SELECT unnest(most_common_vals::text::text[]) AS val,
       unnest(most_common_freqs)               AS freq
FROM   pg_stats
WHERE  tablename = 'orders'
  AND  attname   = 'status'
ORDER  BY freq DESC;
```

`most_common_vals`의 타입은 `anyarray`라서 캐스트가 필요하다. 자주 쓰는 패턴은 `::text[]`로 변환하는 것이다.

## n_distinct 음수 값의 의미

`n_distinct = -0.3`은 "전체 행의 30%가 유일 값"이 아니다. 유일 값 수가 전체 행 수의 30%라는 의미다. 즉, 100만 행 테이블에서 `n_distinct = -0.3`이면 유일 값이 약 30만 개다.

음수로 표현하는 이유는 테이블이 커지면 절대 유일 값 수도 늘어나는 경우를 자동으로 스케일링하기 위해서다. `n_distinct = 1000`처럼 양수면 테이블 크기와 무관하게 항상 1000개로 고정 추정한다.

```sql
-- n_distinct 확인
SELECT attname, n_distinct
FROM   pg_stats
WHERE  tablename = 'orders';

-- 왜곡된 n_distinct 수동 설정 (함수 기반 인덱스 컬럼 등 특수 경우)
ALTER TABLE orders ALTER COLUMN status SET (n_distinct = 5);
ANALYZE orders;
```

## statistics_target 튜닝

`statistics_target`은 수집하는 통계의 정밀도를 조절한다. 기본값은 100이며 전역(`default_statistics_target`) 또는 컬럼 단위로 설정할 수 있다.

![statistics_target 튜닝 — 정밀도 vs 비용](/assets/posts/pg-analyze-statistics-target.svg)

```sql
-- 고카디널리티 컬럼: target 높이기
ALTER TABLE orders ALTER COLUMN customer_id SET STATISTICS 500;

-- 저카디널리티 컬럼: target 낮추기 (boolean, enum 등)
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 10;

-- ANALYZE로 통계 갱신
ANALYZE orders;

-- 전역 기본값 변경 (postgresql.conf 또는 SET)
SET default_statistics_target = 200;
ANALYZE; -- 전체 테이블
```

## 통계 오류로 인한 잘못된 계획 진단

EXPLAIN ANALYZE에서 추정 rows와 actual rows 비율이 10배 이상 차이 난다면 통계 문제를 의심한다.

```sql
-- 통계 오류 진단 쿼리
SELECT
    tablename,
    attname,
    n_distinct,
    null_frac,
    array_length(histogram_bounds::text::text[], 1) AS histogram_buckets,
    last_analyzed
FROM   pg_stats
WHERE  tablename = 'orders'
  AND  last_analyzed < now() - INTERVAL '1 day';

-- 빠른 통계 갱신 (대형 테이블도 샘플링으로 빠름)
ANALYZE orders (customer_id, status, created_at);
```

## autovacuum과 자동 ANALYZE

autovacuum 데몬은 VACUUM뿐 아니라 ANALYZE도 자동 실행한다. 트리거 조건은 `autovacuum_analyze_threshold + autovacuum_analyze_scale_factor × reltuples`개 이상의 행이 변경되면 실행된다.

```sql
-- autovacuum_analyze 임계값 확인
SHOW autovacuum_analyze_scale_factor;  -- 기본 0.2 (20%)
SHOW autovacuum_analyze_threshold;     -- 기본 50

-- 대형 테이블 (1억 행) — 20% = 2000만 행 변경 후에야 auto-analyze
-- 임계값을 낮춰서 더 자주 실행
ALTER TABLE orders SET (
    autovacuum_analyze_scale_factor = 0.01,
    autovacuum_analyze_threshold    = 1000
);
```

---

**지난 글:** [EXPLAIN ANALYZE 읽기 — 실행 계획 해석 완전 가이드](/posts/pg-explain-analyze/)

**다음 글:** [조인 순서와 GEQO — 옵티마이저가 최적 조인 순서를 찾는 방법](/posts/pg-join-order-geqo/)

<br>
읽어주셔서 감사합니다. 😊
