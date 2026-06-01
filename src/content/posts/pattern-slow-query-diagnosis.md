---
title: "슬로우 쿼리 진단 — EXPLAIN으로 시작하는 성능 분석"
description: "느린 쿼리를 발견하고 원인을 분석해 개선하는 체계적인 접근법을 설명합니다. slow_query_log·pg_stat_statements로 식별하고, EXPLAIN ANALYZE로 실행 계획을 읽어 인덱스·통계·쿼리 로직을 개선하는 전 과정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["슬로우 쿼리", "EXPLAIN", "ANALYZE", "인덱스", "쿼리 최적화", "성능 튜닝"]
featured: false
draft: false
---

[지난 글](/posts/pattern-sql-injection-defense/)에서 SQL 인젝션 방어를 다뤘습니다. 이번 글은 실무에서 가장 빈번하게 만나는 과제인 **슬로우 쿼리 진단과 개선**입니다. "왜 이 페이지가 느릴까?"라는 질문을 받았을 때 어디서 시작해야 하는지 체계적인 흐름을 잡겠습니다.

## 슬로우 쿼리 식별

문제를 해결하기 전에 **어떤 쿼리가 느린지** 먼저 파악해야 합니다.

![슬로우 쿼리 진단 흐름](/assets/posts/pattern-slow-query-diagnosis-flow.svg)

### MySQL — slow_query_log

```sql
-- my.cnf 설정 (또는 동적 설정)
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;        -- 1초 이상
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SET GLOBAL log_queries_not_using_indexes = ON;

-- Performance Schema로 상위 슬로우 쿼리 확인
SELECT digest_text,
       count_star,
       avg_timer_wait / 1e12 AS avg_sec,
       sum_rows_examined
FROM   performance_schema.events_statements_summary_by_digest
ORDER BY avg_timer_wait DESC
LIMIT  10;
```

### PostgreSQL — pg_stat_statements

```sql
-- postgresql.conf
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.track = all

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 평균 실행 시간 상위 쿼리
SELECT query,
       calls,
       round((mean_exec_time)::NUMERIC, 2) AS avg_ms,
       round((total_exec_time / 1000)::NUMERIC, 2) AS total_sec,
       rows
FROM   pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT  10;
```

## EXPLAIN ANALYZE 읽기

느린 쿼리를 찾았으면 실행 계획을 확인합니다.

![EXPLAIN ANALYZE 예시](/assets/posts/pattern-slow-query-diagnosis-explain.svg)

```sql
-- PostgreSQL
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 42;

-- MySQL
EXPLAIN FORMAT=JSON
SELECT * FROM orders WHERE user_id = 42;

EXPLAIN ANALYZE  -- MySQL 8.0.18+
SELECT * FROM orders WHERE user_id = 42;
```

### 핵심 키워드

| 키워드 | 의미 | 조치 |
|--------|------|------|
| `Seq Scan` | 전체 테이블 스캔 | 인덱스 추가 검토 |
| `Index Scan` | 인덱스 + 힙 읽기 | 정상 (커버링 인덱스로 최적화 가능) |
| `Index Only Scan` | 힙 접근 없음 | 최적 상태 |
| `Hash Join` | 해시 조인 | rows 추정이 맞는지 확인 |
| `Nested Loop` | 중첩 루프 조인 | 작은 rows에 적합, 큰 테이블엔 비효율 |
| `rows=N` vs `actual rows=M` | 추정 vs 실제 행수 | 차이가 크면 `ANALYZE` 실행 |

```sql
-- 행수 추정 오차 확인 (PostgreSQL)
-- cost 옆의 rows와 actual rows의 차이가 10배 이상이면 통계 오래됨
EXPLAIN (ANALYZE, FORMAT JSON)
SELECT * FROM orders WHERE status = 'PAID' AND created_at > NOW() - INTERVAL '7 days';

-- 통계 갱신
ANALYZE orders;

-- MySQL
ANALYZE TABLE orders;
```

## 흔한 슬로우 쿼리 패턴과 개선

### 1. 인덱스 컬럼에 함수 적용

```sql
-- 인덱스를 무력화 (Seq Scan 발생)
SELECT * FROM orders WHERE DATE(created_at) = '2026-06-01';
SELECT * FROM users  WHERE LOWER(email) = 'user@example.com';

-- 범위 조건으로 변경 (Index Scan 가능)
SELECT * FROM orders
WHERE  created_at >= '2026-06-01' AND created_at < '2026-06-02';

-- 함수 기반 인덱스 (PostgreSQL)
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';
```

### 2. 암묵적 타입 캐스팅

```sql
-- phone_number가 VARCHAR인데 숫자로 비교 → 풀스캔
SELECT * FROM users WHERE phone_number = 01012345678;

-- 타입 일치
SELECT * FROM users WHERE phone_number = '01012345678';
```

### 3. SELECT * — 불필요한 컬럼 읽기

```sql
-- 대용량 BLOB/TEXT 포함 테이블에서 치명적
SELECT * FROM articles WHERE category_id = 5;

-- 필요한 컬럼만
SELECT id, title, published_at FROM articles WHERE category_id = 5;
```

### 4. N+1 쿼리

```sql
-- 문제: 게시글 목록 N개를 가져온 뒤 각각 작성자 조회 (N+1번 쿼리)
SELECT * FROM posts LIMIT 20;  -- 1번
SELECT * FROM users WHERE id = 1;  -- 20번...
SELECT * FROM users WHERE id = 2;

-- 해결: JOIN으로 한 번에
SELECT p.id, p.title, u.name AS author
FROM   posts p
JOIN   users u ON u.id = p.user_id
LIMIT  20;

-- 또는 IN 절로 묶기
SELECT * FROM users WHERE id IN (1, 2, 3, ...);
```

## 인덱스 추가 후 확인 사항

```sql
-- PostgreSQL: 인덱스 크기와 사용 현황
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS idx_size,
       idx_scan, idx_tup_read, idx_tup_fetch
FROM   pg_stat_user_indexes
WHERE  tablename = 'orders'
ORDER BY idx_scan DESC;

-- 사용되지 않는 인덱스 탐지 (idx_scan = 0)
SELECT schemaname, tablename, indexname
FROM   pg_stat_user_indexes
WHERE  idx_scan = 0 AND schemaname = 'public';
```

인덱스는 쓰기 오버헤드와 저장 공간을 소비합니다. 사용되지 않는 인덱스는 정리하세요.

## 실무 체크리스트

```
슬로우 쿼리 발생 시 확인 순서:
□ EXPLAIN ANALYZE 출력에서 Seq Scan·row 추정 오차 확인
□ WHERE 조건 컬럼에 인덱스 있는지, 함수·캐스팅으로 무력화되지 않는지
□ JOIN 순서·알고리즘이 적절한지 (rows 추정이 맞는지)
□ 통계가 오래됐으면 ANALYZE 실행
□ SELECT * 제거, 불필요 서브쿼리 → CTE·JOIN으로 변경
□ N+1 패턴 여부 (ORM 디버그 로그 확인)
□ 커버링 인덱스로 Index Only Scan 달성 가능한지
```

---

**지난 글:** [SQL 인젝션 방어 — 파라미터 바인딩과 안전한 쿼리 작성](/posts/pattern-sql-injection-defense/)

<br>
읽어주셔서 감사합니다. 😊
