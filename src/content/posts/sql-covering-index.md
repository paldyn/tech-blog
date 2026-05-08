---
title: "커버링 인덱스"
description: "SELECT 컬럼이 모두 인덱스에 포함되어 힙 접근을 없애는 커버링 인덱스(Covering Index)의 원리, INCLUDE 절로 리프에만 컬럼 추가하는 방법, 실전 설계 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["sql", "covering-index", "index-only-scan", "include", "performance", "btree", "explain", "optimizer"]
featured: false
draft: false
---

[지난 글](/posts/sql-composite-index-column-order/)에서 복합 인덱스 컬럼 순서를 정리했다. 이번에는 인덱스 성능 최적화의 끝판왕인 **커버링 인덱스(Covering Index)**를 다룬다.

---

## 커버링 인덱스란

쿼리가 필요로 하는 **모든 컬럼**이 인덱스 안에 있어서 힙(테이블 블록)에 전혀 접근하지 않아도 되는 인덱스다. B-Tree 리프 노드에서 데이터를 바로 반환하므로 랜덤 I/O가 사라진다.

---

## 힙 접근이 없어지면 왜 빠른가

![커버링 인덱스 I/O 흐름](/assets/posts/sql-covering-index-flow.svg)

일반 Index Scan은 인덱스 리프에서 힙 포인터를 꺼내 **매 행마다** 테이블 블록을 읽는다. 테이블이 크고 조회 행이 많을수록 랜덤 I/O가 쌓여 느려진다.

커버링 인덱스가 있으면 B-Tree 리프에서 모든 컬럼 값을 읽고 끝난다. `SELECT name FROM orders WHERE status = 'pending'` 쿼리에서 `INDEX(status, name)`이 있으면:

```
인덱스 리프:  status='pending' → name='김길동'   ← 여기서 끝
             (테이블 블록 접근 없음)
```

---

## 기본 구현

```sql
-- 쿼리
SELECT id, name, email FROM users WHERE status = 'active';

-- 커버링 인덱스: WHERE 컬럼 + SELECT 컬럼 모두 포함
CREATE INDEX idx_users_covering ON users (status, id, name, email);

-- EXPLAIN 결과 (PostgreSQL)
-- Index Only Scan using idx_users_covering on users
--   Index Cond: (status = 'active')
-- Heap Fetches: 0  ← 힙 접근 0회
```

`Heap Fetches: 0`이 커버링 인덱스 효과를 보여준다.

---

## INCLUDE 절 활용 (권장)

![INCLUDE vs 키 컬럼 방식 비교](/assets/posts/sql-covering-index-include.svg)

`name`과 `email`을 인덱스 **키**로 추가하면 불필요하게 모든 레벨에서 정렬이 일어난다. `INCLUDE` 절을 사용하면 **리프 노드에만** 추가해서 힙 접근을 없애면서도 인덱스 크기와 DML 오버헤드를 최소화한다.

```sql
-- PostgreSQL 11+ / SQL Server: INCLUDE 절
CREATE INDEX idx_users_status ON users (status)
    INCLUDE (id, name, email);
-- status = 키 컬럼: 정렬·필터에 사용
-- id, name, email = INCLUDE 컬럼: 리프에만, 힙 접근 제거용

-- MySQL: 모든 컬럼이 키 컬럼 (INCLUDE 없음)
CREATE INDEX idx_users_status ON users (status, id, name, email);
-- name이 긴 VARCHAR면 인덱스 크기 주의
```

### 언제 INCLUDE를 쓰나

- WHERE/ORDER BY에 없지만 SELECT에 있는 컬럼
- 자주 변경되는 컬럼 (INCLUDE이면 재정렬 없음)
- VARCHAR가 길어 키에 넣으면 인덱스가 커지는 컬럼

---

## 실전 패턴

### 패턴 1: 목록 조회 최적화

```sql
-- 주문 목록 API: 페이지당 20건
SELECT id, status, total_amount, created_at
  FROM orders
 WHERE customer_id = ?
 ORDER BY created_at DESC
 LIMIT 20;

-- 커버링 인덱스
CREATE INDEX idx_orders_customer_list ON orders
    (customer_id, created_at DESC)
    INCLUDE (id, status, total_amount);
-- customer_id + created_at = 필터+정렬 키
-- id, status, total_amount = SELECT용 INCLUDE
```

### 패턴 2: 집계 쿼리 최적화

```sql
-- 일별 주문 수 집계
SELECT DATE(created_at) AS dt, COUNT(*), SUM(total_amount)
  FROM orders
 WHERE customer_id = ? AND created_at >= '2026-01-01'
 GROUP BY DATE(created_at);

-- 모든 컬럼이 인덱스에 있으면 힙 미접근
CREATE INDEX idx_orders_agg ON orders
    (customer_id, created_at)
    INCLUDE (total_amount);
```

### 패턴 3: JOIN 최적화

```sql
-- order_items JOIN products: products 쪽 커버링
SELECT oi.qty, p.name, p.price
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
 WHERE oi.order_id = ?;

-- products.id로 JOIN, name·price만 필요
CREATE INDEX idx_products_covering ON products (id)
    INCLUDE (name, price);
-- PK가 이미 id이면 INCLUDE만 추가
-- ALTER INDEX ... 불가 → 재생성 또는 INCLUDE 포함 별도 인덱스
```

---

## 주의사항

```sql
-- 1. SELECT *는 커버링 불가
SELECT * FROM orders WHERE status = 'pending';
-- 모든 컬럼을 인덱스에 넣으면 테이블 복제 수준 → 의미 없음

-- 2. PostgreSQL: Visibility Map 체크
-- VACUUM 이후 충분히 정리돼야 진정한 Index Only Scan
-- Heap Fetches > 0이면 VM이 오래됐다는 신호
VACUUM orders;  -- 이후 재실행

-- 3. MySQL: InnoDB Clustered Index와 PK
-- 세컨더리 인덱스에 PK 컬럼이 묵시적으로 포함됨
-- INDEX(status) → 내부적으로 INDEX(status, id)처럼 동작
-- id가 SELECT에 있으면 추가 없이 커버링 가능

-- 4. 인덱스 크기 확인
SELECT pg_size_pretty(pg_relation_size('idx_orders_covering'));
-- 인덱스가 테이블보다 커지지 않도록 관리
```

---

## EXPLAIN으로 커버링 확인

```sql
-- PostgreSQL
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status FROM orders WHERE customer_id = 42;

-- 커버링 인덱스 있을 때:
-- Index Only Scan using idx_orders_customer_list on orders
--   Heap Fetches: 0  ← 핵심!
--   Buffers: shared hit=3  (인덱스 블록만)

-- MySQL
EXPLAIN SELECT id, status FROM orders WHERE customer_id = 42;
-- Extra: Using index  ← 커버링 인덱스 사용 표시
```

---

**지난 글:** [복합 인덱스 컬럼 순서](/posts/sql-composite-index-column-order/)

<br>
읽어주셔서 감사합니다. 😊
