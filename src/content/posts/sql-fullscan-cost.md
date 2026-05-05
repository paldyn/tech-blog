---
title: "풀스캔 비용 이해"
description: "풀스캔(Sequential Scan)이 어떤 I/O 경로로 동작하는지, 비용 공식과 선택도 임계값, 옵티마이저가 풀스캔을 선택하는 조건, EXPLAIN으로 확인하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "full-scan", "sequential-scan", "explain", "optimizer", "cost", "selectivity", "performance", "index"]
featured: false
draft: false
---

[지난 글](/posts/sql-polymorphic-relationships/)에서 다형성 관계 설계 패턴을 살펴봤다. 이번부터는 **인덱스와 쿼리 성능** 챕터를 시작한다. 첫 주제는 모든 성능 분석의 기준점이 되는 **풀스캔(Full Scan / Sequential Scan)**의 동작 원리와 비용이다.

---

## 풀스캔이란

풀스캔은 테이블의 모든 블록(페이지)을 처음부터 끝까지 순서대로 읽는 방식이다. 인덱스를 전혀 사용하지 않는다.

```
SELECT * FROM orders WHERE status = 'shipped';
```

위 쿼리에서 `status` 컬럼에 인덱스가 없다면, DBMS는 `orders`의 모든 블록을 읽어 각 행의 `status`를 확인한다.

---

## I/O 모델과 비용 공식

![풀스캔 I/O 모델](/assets/posts/sql-fullscan-cost-io-model.svg)

풀스캔은 **순차 I/O(Sequential Read)**다. 디스크 헤드가 순서대로 이동하기 때문에 랜덤 I/O보다 처리량(throughput)이 훨씬 높다.

PostgreSQL의 비용 단위로 표현하면:

```
Seq Scan Cost = 블록 수 × seq_page_cost(기본값 1.0)
                + 행 수 × cpu_tuple_cost(기본값 0.01)
```

반면 인덱스 스캔은:

```
Index Scan Cost = 인덱스 블록 수 × random_page_cost(기본값 4.0)
                + 힙 접근 수 × random_page_cost
```

`random_page_cost(4.0) > seq_page_cost(1.0)` 이기 때문에, **많은 행을 반환해야 한다면** 풀스캔이 오히려 싸다.

---

## 선택도와 임계값

**선택도(Selectivity)**는 전체 행 중 쿼리 조건을 만족하는 행의 비율이다.

```sql
-- 선택도 = 조건 만족 행 수 / 전체 행 수
-- orders 테이블 100만 행, status='pending'인 행 5만 개
-- 선택도 = 5% → 인덱스 vs 풀스캔 경계

-- 선택도 0.1% → 인덱스가 압도적으로 유리
SELECT * FROM orders WHERE id = 42;  -- 1/100만 = 0.0001%

-- 선택도 50% → 풀스캔이 더 유리
SELECT * FROM orders WHERE created_at > '2020-01-01';
```

일반적인 임계값:

| 선택도 | 권장 방식 |
|--------|---------|
| < 1% | 인덱스 스캔 |
| 1~5% | 경계 (인덱스가 유리한 경우 많음) |
| 5~20% | 둘 다 검토, 테이블 크기에 따라 다름 |
| > 20% | 풀스캔이 유리한 경우 많음 |

이 임계값은 PostgreSQL의 경우 `random_page_cost / seq_page_cost = 4` 비율에서 나온다. SSD 환경이라면 `random_page_cost`를 1.1~2.0으로 낮춰 인덱스가 더 넓은 범위에서 선택되게 할 수 있다.

```sql
-- SSD 환경 조정 (PostgreSQL)
SET random_page_cost = 1.1;
-- 또는 postgresql.conf에서:
-- random_page_cost = 1.1
```

---

## EXPLAIN으로 풀스캔 확인

![EXPLAIN 출력 읽는 법](/assets/posts/sql-fullscan-cost-explain.svg)

```sql
-- 풀스캔 vs 인덱스 스캔 비교
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE status = 'shipped';

-- 풀스캔 결과:
-- Seq Scan on orders  (cost=0.00..2543.00 rows=50000 width=120)
--   Filter: (status = 'shipped')
--   Rows Removed by Filter: 50000

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE id = 12345;

-- 인덱스 스캔 결과:
-- Index Scan using orders_pkey on orders
--   (cost=0.42..8.44 rows=1 width=120)
--   Index Cond: (id = 12345)
```

---

## 풀스캔이 정상인 상황

인덱스가 있어도 옵티마이저가 풀스캔을 선택하는 것은 올바른 결정일 수 있다.

```sql
-- 1. 테이블이 매우 작을 때 (버퍼 캐시에 항상 존재)
--    orders 10개짜리 테스트 테이블이라면 풀스캔이 당연

-- 2. 거의 모든 행을 반환하는 경우
SELECT COUNT(*) FROM orders;  -- 모든 행 집계

-- 3. 대량 DELETE/UPDATE
DELETE FROM orders WHERE created_at < '2020-01-01';
-- 선택도 30%라면 풀스캔이 낫다

-- 4. 통계가 오래된 경우 → 통계 갱신 후 재확인
ANALYZE orders;  -- PostgreSQL
-- DBCC UPDATESTATISTICS orders;  -- SQL Server
```

---

## 풀스캔을 피해야 하는 상황

```sql
-- 대용량 테이블에서 소수 행 조회 → 인덱스 필수
SELECT * FROM orders WHERE order_no = 'ORD-2026-001234';
-- orders에 1,000만 행이 있다면 풀스캔 = 수초~수십초

-- 조인 조건 컬럼에 인덱스 없음 → NL Join이 풀스캔으로 변질
SELECT o.*, c.name
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
 WHERE o.status = 'pending';
-- customer_id에 인덱스 없으면 각 order마다 customers 풀스캔

-- 인덱스가 있는데 함수 적용으로 무력화
SELECT * FROM orders WHERE DATE(created_at) = CURRENT_DATE;
-- DATE() 함수 때문에 인덱스 사용 불가 → 풀스캔
-- 수정: WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + 1
```

---

## MySQL / Oracle 용어

DBMS마다 풀스캔 용어가 다르다.

```sql
-- MySQL EXPLAIN
SELECT * FROM orders WHERE status = 'shipped'\G
-- type: ALL  ← 풀스캔을 "ALL"로 표시
-- rows: 100000  ← 읽어야 할 예상 행 수

-- Oracle EXPLAIN PLAN
SELECT * FROM orders WHERE status = 'shipped';
-- Operation: TABLE ACCESS FULL  ← 오라클의 풀스캔

-- SQL Server
SELECT * FROM orders WHERE status = 'shipped';
-- Scan 아이콘 → Table Scan 또는 Clustered Index Scan
```

---

**지난 글:** [다형성 관계](/posts/sql-polymorphic-relationships/)

**다음 글:** [B-Tree 인덱스 구조](/posts/sql-btree-structure/)

<br>
읽어주셔서 감사합니다. 😊
