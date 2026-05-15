---
title: "Covering Index와 INCLUDE — 힙 접근 없는 인덱스 스캔"
description: "PostgreSQL INCLUDE 절로 커버링 인덱스를 만드는 방법, Index-Only Scan이 Visibility Map을 이용해 힙 접근을 최소화하는 원리, VACUUM 주기와의 관계, 그리고 INCLUDE 컬럼 설계 시 고려해야 할 트레이드오프를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["postgresql", "covering-index", "include", "index-only-scan", "visibility-map", "vacuum", "btree", "performance"]
featured: false
draft: false
---

[지난 글](/posts/pg-spgist-brin-index/)에서 SP-GiST와 BRIN 같은 특수 목적 인덱스를 살펴봤다. 이번에는 B-Tree 인덱스를 한 단계 더 최적화하는 기법인 **커버링 인덱스(Covering Index)**와 PostgreSQL의 `INCLUDE` 절을 깊이 파고든다.

## 커버링 인덱스란

쿼리가 필요로 하는 모든 컬럼이 인덱스 자체에 포함되어 있을 때, 옵티마이저는 힙 페이지에 접근하지 않고 인덱스 리프 노드만 읽어서 결과를 반환할 수 있다. 이것이 **Index-Only Scan**이다. 힙 접근은 랜덤 I/O를 동반하므로, 인덱스 스캔이 세 번이든 천 번이든 모두 힙에 접근한다면 이득이 절반으로 줄어든다.

PostgreSQL 11 이전에는 키 컬럼에 추가 컬럼을 넣어 억지로 커버링 효과를 냈다. 문제는 그 컬럼이 인덱스 정렬에 영향을 주어 불필요한 중복 인덱스 엔트리가 발생한다는 점이었다. PostgreSQL 11부터 도입된 `INCLUDE` 절은 이 문제를 해결한다.

## INCLUDE 절 사용법

```sql
-- 기본 커버링 인덱스
CREATE INDEX idx_users_email_cov
    ON users (email)
    INCLUDE (name, created_at);

-- 복합 키 + INCLUDE
CREATE INDEX idx_orders_cov
    ON orders (customer_id, status)
    INCLUDE (total_amount, created_at);

-- 유니크 인덱스에도 사용 가능
CREATE UNIQUE INDEX idx_users_email_unique_cov
    ON users (email)
    INCLUDE (name);

-- 위 인덱스를 활용하는 쿼리 (Index-Only Scan 유도)
EXPLAIN (ANALYZE, BUFFERS)
SELECT name, created_at
FROM   users
WHERE  email = 'alice@example.com';
```

`INCLUDE` 컬럼은 인덱스 리프 페이지에만 저장되고 내부(브랜치) 노드에는 저장되지 않는다. 따라서 정렬 키에 영향을 주지 않으며, 유니크 제약도 키 컬럼에만 적용된다.

![Covering Index — INCLUDE 컬럼 구조](/assets/posts/pg-covering-index-include-concept.svg)

## Index-Only Scan과 Visibility Map

Index-Only Scan이 항상 힙을 건너뛰는 건 아니다. PostgreSQL의 MVCC 특성상, 인덱스 리프 노드에 있는 데이터가 현재 트랜잭션에서 보여야 하는지(가시성)를 확인해야 한다. 이를 위해 **Visibility Map**을 참조한다.

Visibility Map은 힙 파일과 별도의 파일(`_vm` 접미사)로, 각 힙 페이지에 대해 2비트를 저장한다:
- **all-visible 비트**: 해당 페이지의 모든 튜플이 모든 트랜잭션에 보임
- **all-frozen 비트**: 모든 튜플이 영구적으로 고정됨

all-visible 비트가 설정된 페이지는 힙 접근 없이 인덱스 데이터를 신뢰할 수 있다. VACUUM이 이 비트를 설정한다.

```sql
-- Visibility Map 상태 확인
SELECT blkno, all_visible, all_frozen
FROM   pg_visibility('users')
LIMIT  10;

-- Index-Only Scan 성공 여부 확인
SELECT relname,
       idx_scan,
       idx_tup_read,      -- 인덱스에서 읽은 튜플
       idx_tup_fetch      -- 힙에서 추가로 읽은 튜플 (0에 가까울수록 IOS 효과)
FROM   pg_stat_user_indexes
WHERE  indexrelname = 'idx_users_email_cov';
```

![Visibility Map과 Index-Only Scan](/assets/posts/pg-covering-index-include-visibility.svg)

## VACUUM과 Index-Only Scan의 관계

테이블에 UPDATE/DELETE가 많으면 죽은 튜플(dead tuple)이 쌓이고, all-visible 비트가 해제된다. 이 상태에서는 Index-Only Scan이 힙에 접근해야 한다. autovacuum이 제때 실행되지 않으면 IOS의 효과가 반감된다.

```sql
-- VACUUM 후 Visibility Map 갱신 확인
VACUUM ANALYZE users;

SELECT all_visible, count(*) AS pages
FROM   pg_visibility('users')
GROUP  BY all_visible;
-- all_visible = true가 대부분이어야 IOS가 효과적

-- autovacuum 통계 확인
SELECT relname,
       n_dead_tup,
       last_autovacuum,
       last_autoanalyze
FROM   pg_stat_user_tables
WHERE  relname = 'users';
```

## 언제 INCLUDE를 써야 하는가

몇 가지 판단 기준이 있다.

**적합한 경우**: 조회 전용(혹은 대부분 읽기) 패턴이고, WHERE 조건 컬럼 외에 SELECT 컬럼 수가 적을 때. 예를 들어 `WHERE email = ? SELECT name, created_at` 패턴이 빈번하면 `INCLUDE (name, created_at)`이 효과적이다.

**주의할 경우**: INCLUDE 컬럼의 행 크기가 크면 인덱스 리프 페이지가 커져 인덱스 스캔 자체의 I/O가 늘어난다. `text` 컬럼을 INCLUDE에 넣을 때는 실제 평균 길이를 확인해야 한다.

```sql
-- 인덱스 크기 vs 테이블 크기 비교
SELECT
    indexrelname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_size_pretty(pg_relation_size(indrelid))   AS table_size
FROM   pg_stat_user_indexes
WHERE  relname = 'users';
```

인덱스 크기가 테이블 크기의 30%를 넘기 시작하면 INCLUDE 컬럼이 너무 많거나 큰 것은 아닌지 점검할 필요가 있다.

## 실전 패턴: API 응답 쿼리 최적화

REST API에서 목록 조회는 보통 이런 형태다.

```sql
-- 자주 실행되는 API 쿼리
SELECT id, username, email, avatar_url
FROM   users
WHERE  is_active = true
  AND  created_at >= NOW() - INTERVAL '30 days'
ORDER  BY created_at DESC
LIMIT  20;

-- 위 쿼리를 위한 커버링 인덱스
CREATE INDEX idx_users_active_created_cov
    ON users (is_active, created_at DESC)
    INCLUDE (id, username, email, avatar_url);
```

이 인덱스가 있으면 WHERE + ORDER BY + SELECT 컬럼 전체가 인덱스 내에 있어 힙 접근이 사라진다. 다만 `avatar_url`이 대용량 URL이라면 리프 페이지 크기를 반드시 측정해야 한다.

---

**다음 글:** [표현식 인덱스 — 함수와 연산 결과에 인덱스 걸기](/posts/pg-expression-index/)

<br>
읽어주셔서 감사합니다. 😊
