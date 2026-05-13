---
title: "Index-Only Scan 완전 이해 — 언제 힙을 건너뛰는가"
description: "PostgreSQL Index-Only Scan이 힙 접근을 생략하는 정확한 조건, Visibility Map all-visible 비트의 역할, VACUUM과의 관계, pg_stat_user_indexes로 IOS 효과를 측정하는 방법을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["postgresql", "index-only-scan", "visibility-map", "vacuum", "covering-index", "btree", "heap-fetch", "mvcc"]
featured: false
draft: false
---

[지난 글](/posts/pg-expression-index/)에서 표현식 인덱스로 함수 결과를 키에 저장하는 방법을 다뤘다. 이번에는 커버링 인덱스의 핵심 효과인 **Index-Only Scan(IOS)**의 동작 원리를 더 깊게 파헤친다. "인덱스만 읽고 힙을 건너뛴다"는 설명이 어떤 조건에서 성립하는지, 그리고 그렇지 않을 때 무슨 일이 일어나는지 살펴본다.

## Index Scan vs Index-Only Scan

일반 Index Scan은 두 단계로 진행된다. B-Tree에서 조건에 맞는 TID(Tuple ID, 힙 블록 번호 + 오프셋)를 찾고, 그 TID로 힙 페이지에 직접 접근해 실제 튜플을 가져온다. 이 힙 Fetch 단계가 랜덤 I/O를 만든다.

Index-Only Scan은 이 두 번째 단계를 가능한 한 생략한다. 인덱스 리프 노드에 이미 필요한 데이터(키 + INCLUDE 컬럼)가 다 있기 때문이다.

```sql
-- 두 스캔 타입을 직접 비교
CREATE TABLE orders (
    id         bigserial PRIMARY KEY,
    customer_id bigint,
    status     text,
    amount     numeric,
    created_at timestamptz DEFAULT now()
);

-- INCLUDE 없는 인덱스 → Index Scan
CREATE INDEX idx_orders_plain ON orders (customer_id);

-- INCLUDE 있는 인덱스 → Index-Only Scan 가능
CREATE INDEX idx_orders_cov ON orders (customer_id) INCLUDE (status, amount);

-- 두 실행 계획 비교
EXPLAIN (ANALYZE, BUFFERS)
SELECT status, amount FROM orders WHERE customer_id = 42;
```

![Index-Only Scan vs Index Scan 실행 흐름](/assets/posts/pg-index-only-scan-flow.svg)

## Visibility Map의 역할

PostgreSQL은 MVCC를 구현하기 위해 각 튜플에 `xmin`(삽입 트랜잭션 ID)과 `xmax`(삭제 트랜잭션 ID)를 저장한다. Index-Only Scan 시 문제가 생긴다 — 인덱스 리프 노드에는 이 MVCC 정보가 없다. 그래서 힙에 가지 않으면 가시성을 확인할 수 없다.

이를 해결하는 게 **Visibility Map**이다. Visibility Map은 힙 파일마다 `_vm` 파일이 생기며, 각 힙 페이지에 대해 두 비트를 관리한다:

- **all-visible**: 해당 페이지의 모든 튜플이 현재 활성 트랜잭션 모두에게 보임 (과거 및 현재)
- **all-frozen**: 트랜잭션 ID 래핑 방지를 위해 영구 고정됨

all-visible 비트가 설정된 페이지는 IOS 시 힙에 가지 않아도 된다. VACUUM이 죽은 튜플을 정리하고 이 비트를 설정한다.

```sql
-- Visibility Map 상태 조회
SELECT blkno,
       all_visible,
       all_frozen
FROM   pg_visibility('orders')
ORDER  BY blkno
LIMIT  20;

-- 전체 all_visible 비율
SELECT
    all_visible,
    count(*) AS pages,
    round(count(*) * 100.0 / sum(count(*)) OVER (), 1) AS pct
FROM   pg_visibility('orders')
GROUP  BY all_visible;
```

## IOS가 성립하는 5가지 조건

![Index-Only Scan 성립 조건 체크리스트](/assets/posts/pg-index-only-scan-conditions.svg)

실제 실행 계획에서 "Index Only Scan"이 표시되더라도, `Heap Fetches: N`이 0이 아니라면 일부 힙 접근이 발생한 것이다.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT status, amount
FROM   orders
WHERE  customer_id = 42;

-- 출력 예시
-- Index Only Scan using idx_orders_cov on orders
--   (cost=0.43..4.45 rows=5 width=20)
--   (actual time=0.052..0.061 rows=5 loops=1)
--   Heap Fetches: 0     ← 완전한 IOS
--   Buffers: shared hit=4
```

Heap Fetches가 높으면 VACUUM을 실행해 Visibility Map을 갱신해야 한다.

```sql
-- 수동 VACUUM (운영 중 안전하게 실행 가능)
VACUUM (VERBOSE) orders;

-- Visibility Map이 갱신된 후 다시 확인
SELECT count(*) FROM pg_visibility('orders') WHERE all_visible;
```

## IOS 효과 측정 및 모니터링

```sql
-- 인덱스별 IOS 효과 측정
SELECT
    s.relname                                  AS table,
    s.indexrelname                             AS index,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    s.idx_tup_read - s.idx_tup_fetch          AS heap_fetches_avoided,
    round((s.idx_tup_read - s.idx_tup_fetch)
        * 100.0 / nullif(s.idx_tup_read, 0), 1) AS ios_pct
FROM   pg_stat_user_indexes s
WHERE  s.idx_scan > 0
ORDER  BY heap_fetches_avoided DESC
LIMIT  10;
```

`idx_tup_read`는 인덱스에서 읽은 튜플 수, `idx_tup_fetch`는 그 중 힙에서 추가로 가져온 튜플 수다. 차이가 크면 IOS가 효과적으로 동작 중이다.

## autovacuum 설정과 IOS 유지

IOS 효과를 꾸준히 유지하려면 autovacuum이 테이블을 제때 처리해야 한다. 쓰기가 많은 테이블은 autovacuum 임계값을 낮추는 것이 좋다.

```sql
-- 특정 테이블 autovacuum 임계값 조정
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- 기본 0.2
    autovacuum_analyze_scale_factor = 0.02  -- 기본 0.1
);

-- autovacuum 실행 현황 확인
SELECT relname,
       n_dead_tup,
       last_autovacuum,
       last_autoanalyze,
       autovacuum_count
FROM   pg_stat_user_tables
WHERE  relname = 'orders';
```

IOS가 기대만큼 동작하지 않을 때는 `pg_visibility`로 all-visible 비율을 확인하고, 낮으면 VACUUM을 실행하거나 autovacuum 빈도를 늘리는 것이 첫 번째 대응이다.

---

**지난 글:** [표현식 인덱스 — 함수와 연산 결과에 인덱스 걸기](/posts/pg-expression-index/)

**다음 글:** [EXPLAIN ANALYZE 읽기 — 실행 계획 해석 완전 가이드](/posts/pg-explain-analyze/)

<br>
읽어주셔서 감사합니다. 😊
