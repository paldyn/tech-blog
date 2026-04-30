---
title: "JOIN 순서와 성능"
description: "옵티마이저가 JOIN 순서를 결정하는 원리(비용 기반), 드라이빙 테이블 선택 전략, 작은 결과 집합을 먼저 줄이는 방법, 그리고 힌트나 STRAIGHT_JOIN으로 순서를 강제해야 할 때를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "join", "performance", "optimizer", "driving-table", "hint", "실행계획", "비용기반"]
featured: false
draft: false
---

[지난 글](/posts/sql-multi-join-readability/)에서 다중 JOIN 쿼리를 읽기 쉽게 작성하는 방법을 살펴봤다. 이번에는 JOIN 성능의 핵심인 **조인 순서**와 **드라이빙 테이블 선택** 원리를 다룬다. 쿼리를 어떻게 작성하든 옵티마이저가 최적 순서를 찾지만, 그 원리를 이해하면 통계 문제를 진단하고 필요할 때 개입할 수 있다.

---

## 드라이빙 테이블이란

Nested Loop Join 기준으로 설명하면, 옵티마이저는 두 테이블 중 하나를 **드라이빙 테이블(Outer Loop)**로 선택한다. 드라이빙 테이블의 각 행에 대해 나머지 테이블(드리븐 테이블, Inner Loop)을 탐색한다.

```sql
-- 논리적 실행 모델 (Nested Loop)
-- 드라이빙: vip_users (100행)
-- 드리븐:   orders (1M행, user_id 인덱스 활용)

FOR EACH row IN vip_users:          -- 100회
    SEEK orders WHERE user_id = row.user_id  -- 인덱스 탐색
```

드리븐 테이블에 인덱스가 있으면 각 탐색이 O(log n)이다. 드라이빙 테이블이 작을수록 탐색 횟수가 줄어든다. **작은 집합이 드라이빙 테이블이 되면 유리하다.**

---

## 옵티마이저의 비용 계산

현대 RDBMS는 **비용 기반 옵티마이저(Cost-Based Optimizer, CBO)**를 사용한다. 테이블 통계(행 수, 컬럼 분포, 인덱스 카디널리티)를 기반으로 가능한 조인 순서 중 비용이 낮은 것을 선택한다.

```sql
-- 실행 계획으로 옵티마이저 결정 확인
EXPLAIN SELECT o.id, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN vip_users v ON v.user_id = u.id;

-- PostgreSQL: Hash Join, Nested Loop 선택 이유
-- MySQL: 'rows' 컬럼으로 각 단계 탐색 행 수 확인
-- MSSQL: Estimated Rows, Cost %
```

![JOIN 순서와 비용 기반 옵티마이저](/assets/posts/sql-join-order-performance-optimizer.svg)

---

## 작은 결과 집합 먼저 — WHERE 조건 위치

WHERE 조건이 특정 테이블의 행을 크게 줄인다면, 해당 테이블을 먼저 필터링하고 조인하는 것이 유리하다. 서브쿼리나 CTE로 먼저 필터한 뒤 조인하면 옵티마이저가 더 좋은 결정을 내리도록 유도할 수 있다.

```sql
-- 날짜 범위로 크게 줄어드는 경우
-- ✓ 먼저 필터링한 결과를 조인
WITH recent_orders AS (
    SELECT id, user_id, amount
    FROM orders
    WHERE created_at >= '2024-01-01'
      AND status = 'paid'
    -- 1M → 1K행으로 줄어든다고 가정
)
SELECT ro.id, u.name, ro.amount
FROM recent_orders ro
JOIN users u ON u.id = ro.user_id;
```

옵티마이저가 이미 이런 최적화를 적용할 수 있지만, 명시적으로 CTE나 서브쿼리로 표현하면 실행 계획이 의도대로 나오는지 더 쉽게 검증할 수 있다.

---

## 통계 갱신이 우선

JOIN 성능이 기대와 다를 때 가장 먼저 해야 할 일은 **통계 갱신**이다. 옵티마이저는 통계가 오래되면 잘못된 비용을 계산한다.

```sql
-- PostgreSQL: 통계 수집
ANALYZE orders;

-- MySQL: 통계 갱신
ANALYZE TABLE orders;

-- Oracle: 통계 수집
EXEC DBMS_STATS.GATHER_TABLE_STATS('schema_name', 'orders');

-- MSSQL
UPDATE STATISTICS orders;
```

통계 갱신 후 실행 계획을 다시 확인한다. 대부분의 문제는 통계 갱신과 인덱스 추가로 해결된다.

---

## 힌트로 조인 순서 강제

통계 갱신 후에도 옵티마이저가 잘못된 순서를 선택한다면 힌트로 강제할 수 있다.

![옵티마이저 vs 강제 힌트](/assets/posts/sql-join-order-performance-hints.svg)

```sql
-- MySQL: STRAIGHT_JOIN (FROM 절 순서 강제)
SELECT STRAIGHT_JOIN
    o.id, u.name
FROM vip_users v
JOIN users u     ON u.id = v.user_id
JOIN orders o    ON o.user_id = u.id;

-- Oracle: LEADING 힌트
SELECT /*+ LEADING(v u o) */
    o.id, u.name
FROM vip_users v
JOIN users u     ON u.id = v.user_id
JOIN orders o    ON o.user_id = u.id;

-- PostgreSQL: join_order_score 조정 (힌트 없음, pg_hint_plan 확장 사용)
SET join_collapse_limit = 1;  -- FROM 절 순서 강제

-- MSSQL: OPTION (FORCE ORDER)
SELECT o.id, u.name
FROM vip_users v
JOIN users u     ON u.id = v.user_id
JOIN orders o    ON o.user_id = u.id
OPTION (FORCE ORDER);
```

힌트는 DB 버전 업그레이드 시 옵티마이저 개선으로 오히려 역효과가 날 수 있으므로, 반드시 주석으로 이유를 기록하고 정기적으로 재검토한다.

---

## 조인 알고리즘 선택

옵티마이저는 데이터 특성에 따라 조인 알고리즘을 선택한다.

| 알고리즘 | 적합한 상황 |
|----------|-------------|
| Nested Loop Join | 드라이빙 테이블이 작고, 드리븐 테이블에 인덱스 있음 |
| Hash Join | 대용량 테이블, 인덱스 없음, 등호 조인 |
| Merge (Sort-Merge) Join | 양쪽 테이블이 정렬되어 있거나 정렬 비용이 낮을 때 |

```sql
-- PostgreSQL: 특정 조인 알고리즘 강제
SET enable_hashjoin = off;  -- Hash Join 비활성화
SET enable_nestloop = off;  -- Nested Loop 비활성화

-- Oracle 힌트
SELECT /*+ USE_HASH(u o) */ ...
SELECT /*+ USE_NL(u o) */ ...
```

알고리즘 선택을 강제하는 것도 힌트와 마찬가지로 최후 수단이다. 먼저 인덱스와 통계로 해결한다.

---

## 성능 진단 순서

1. `EXPLAIN ANALYZE`로 실행 계획과 실제 실행 시간 확인
2. 통계가 오래되었으면 갱신
3. 드리븐 테이블 조인 컬럼에 인덱스 추가 검토
4. WHERE 조건으로 결과 집합 조기 축소 검토
5. 힌트는 마지막 수단

---

**지난 글:** [다중 JOIN 쿼리 가독성](/posts/sql-multi-join-readability/)

**다음 글:** [GROUP BY의 본질](/posts/sql-group-by-essence/)

<br>
읽어주셔서 감사합니다. 😊
