---
title: "조인 순서와 GEQO — 옵티마이저가 최적 조인 순서를 찾는 방법"
description: "PostgreSQL 옵티마이저가 동적 프로그래밍으로 최적 조인 순서를 탐색하는 원리, 테이블 수가 많을 때 GEQO(유전자 알고리즘)로 전환하는 이유와 동작 방식, join_collapse_limit·from_collapse_limit 파라미터 튜닝, pg_hint_plan으로 조인 순서를 수동 제어하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["postgresql", "join-order", "geqo", "dynamic-programming", "join-collapse-limit", "pg-hint-plan", "query-planner", "optimization"]
featured: false
draft: false
---

[지난 글](/posts/pg-analyze-statistics/)에서 옵티마이저가 통계를 어떻게 수집하고 활용하는지 살펴봤다. 이번에는 그 통계를 바탕으로 옵티마이저가 **어떤 순서로 테이블을 조인할지** 결정하는 과정을 다룬다.

## 조인 순서가 왜 중요한가

N개의 테이블을 조인할 때 가능한 순서는 N! / 2가지다. 5개 테이블이면 60가지, 8개면 20,160가지, 12개면 2억 3900만 가지다. 어떤 순서로 조인하느냐에 따라 중간 결과 집합의 크기가 달라지고, 이는 전체 실행 비용에 직결된다.

작은 테이블을 먼저 조인해 중간 결과를 줄이거나, 선택도 높은 필터가 있는 테이블을 먼저 처리하는 게 일반적으로 유리하다.

```sql
-- 간단한 3테이블 조인
SELECT o.id, u.name, p.title
FROM   orders     o
JOIN   users      u ON u.id = o.customer_id
JOIN   products   p ON p.id = o.product_id
WHERE  o.status = 'completed'
  AND  o.created_at >= '2025-01-01';

-- EXPLAIN으로 옵티마이저가 선택한 순서 확인
EXPLAIN (ANALYZE, FORMAT TEXT)
SELECT o.id, u.name, p.title
FROM   orders o
JOIN   users  u ON u.id = o.customer_id
JOIN   products p ON p.id = o.product_id
WHERE  o.status = 'completed';
```

## 동적 프로그래밍 탐색

테이블 수가 `join_collapse_limit`(기본 8) 이하이면 옵티마이저는 **동적 프로그래밍(DP)**으로 최적 조인 순서를 탐색한다. 2개짜리 조인의 최적 계획을 먼저 구하고, 그걸 조합해 3개짜리 최적 계획을 구하는 식으로 단계적으로 최적을 찾는다.

각 단계에서 가능한 조인 방법(Hash Join, Merge Join, Nested Loop)과 조인 순서를 모두 고려하므로, 단순 순열 나열보다 훨씬 효율적이지만 테이블 수가 늘수록 기하급수적으로 느려진다.

![조인 순서 탐색 — Dynamic Programming vs GEQO](/assets/posts/pg-join-order-geqo-search.svg)

## GEQO — 유전자 알고리즘으로의 전환

테이블 수가 `geqo_threshold`(기본 12) 이상이면 PostgreSQL은 **GEQO(Genetic Query Optimizer)**를 사용한다. 완전 탐색 대신 유전자 알고리즘으로 근사 최적을 찾는다.

GEQO 동작 순서:
1. 무작위 조인 순서(개체)를 `geqo_pool_size`개 생성
2. 각 개체의 예상 비용(적합도) 계산
3. 비용이 낮은 개체를 선택해 교차(crossover)와 돌연변이(mutation) 적용
4. `geqo_generations` 세대 반복 후 최적 개체 선택

GEQO는 최적을 보장하지 않는다. 같은 쿼리를 여러 번 실행해도 결과가 다를 수 있다(`geqo_seed`로 재현 가능).

```sql
-- GEQO 관련 파라미터 확인
SHOW geqo;                -- on/off
SHOW geqo_threshold;      -- 기본 12
SHOW geqo_pool_size;      -- 기본 0 (자동: 테이블 수 기반 계산)
SHOW geqo_generations;    -- 기본 0 (자동)
SHOW geqo_seed;           -- 재현성을 위한 시드

-- GEQO 강제 비활성화 (소규모 분석 쿼리 디버깅 시)
SET geqo = off;
SET join_collapse_limit = 20;
```

## join_collapse_limit과 from_collapse_limit

`join_collapse_limit`은 명시적 `JOIN` 절을 옵티마이저가 자유롭게 재배열할 수 있는 최대 테이블 수를 제어한다. 이 값을 1로 설정하면 SQL에 작성한 조인 순서 그대로 실행된다.

`from_collapse_limit`은 쉼표로 구분된 암시적 조인(`FROM A, B, C`)을 재배열할 수 있는 최대 수를 제어한다.

```sql
-- from_collapse_limit과 join_collapse_limit의 차이
-- FROM A, B, C → 쉼표 조인, from_collapse_limit 적용
-- FROM A JOIN B ... JOIN C → explicit JOIN, join_collapse_limit 적용

SET join_collapse_limit = 1;  -- explicit JOIN 순서 고정

-- 1로 설정 시, 아래 쿼리는 A⋈B 먼저, 그 다음 C를 조인
SELECT * FROM A
JOIN B ON B.a_id = A.id
JOIN C ON C.b_id = B.id;
```

![조인 순서 제어 — join_collapse_limit과 FROM 순서](/assets/posts/pg-join-order-geqo-hints.svg)

## 플래닝 시간 vs 실행 시간

테이블이 많은 복잡한 쿼리에서는 플래닝 시간이 실행 시간보다 길어질 수 있다. EXPLAIN ANALYZE의 `Planning Time`이 수백 ms라면 join_collapse_limit을 낮추거나 GEQO를 활성화해 플래닝 비용을 줄일 수 있다.

```sql
-- 플래닝 비용 확인
EXPLAIN (ANALYZE, FORMAT TEXT)
SELECT ...복잡한 쿼리...;
-- 출력 마지막 줄:
-- Planning Time: 234.5 ms
-- Execution Time: 12.3 ms

-- 이 경우 플래닝이 실행보다 19배 오래 걸린 것
-- join_collapse_limit을 낮추거나 geqo_threshold를 낮춰서 해결

SET join_collapse_limit = 4;
SET geqo_threshold = 8;
```

## pg_hint_plan 확장

공식적으로 PostgreSQL에는 Oracle의 힌트 같은 문법이 없다. `pg_hint_plan` 확장을 설치하면 주석 형태로 조인 순서, 조인 방법, 인덱스 사용을 제어할 수 있다.

```sql
-- pg_hint_plan 설치 후 사용
/*+ Leading(o u p) HashJoin(o u) */
SELECT o.id, u.name, p.title
FROM   orders   o
JOIN   users    u ON u.id = o.customer_id
JOIN   products p ON p.id = o.product_id
WHERE  o.status = 'completed';
-- Leading: 조인 순서를 o → u → p 순으로 강제
-- HashJoin: o와 u 사이는 Hash Join 사용
```

`pg_hint_plan`은 개발/디버깅 용도로 쓰고, 운영 환경에서 영구 힌트 의존은 통계 갱신 후 힌트가 오히려 해가 되는 경우가 있어 주의해야 한다.

---

**지난 글:** [ANALYZE와 통계 — 옵티마이저가 신뢰하는 데이터](/posts/pg-analyze-statistics/)

**다음 글:** [플래너 옵션 — 옵티마이저 동작을 제어하는 GUC 파라미터](/posts/pg-planner-options/)

<br>
읽어주셔서 감사합니다. 😊
