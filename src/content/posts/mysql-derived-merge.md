---
title: "MySQL Derived Table Merge — 파생 테이블 병합 최적화"
description: "MySQL 옵티마이저가 FROM 서브쿼리(파생 테이블)를 임시 테이블 없이 외부 쿼리와 병합하는 Derived Merge 최적화의 조건, EXPLAIN 확인법, 병합이 불가한 경우를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 35
type: "knowledge"
category: "SQL"
tags: ["mysql", "derived-merge", "subquery", "optimizer", "materialization", "explain", "쿼리최적화"]
featured: false
draft: false
---

[지난 글](/posts/mysql-join-algorithms-bnl-hash/)에서 MySQL의 조인 알고리즘 세 가지를 살펴봤습니다. 이번 글에서는 `FROM` 절 서브쿼리(파생 테이블)를 임시 테이블 없이 처리하는 **Derived Merge** 최적화를 다룹니다.

## 파생 테이블과 임시 테이블 비용

`FROM` 절 서브쿼리는 **파생 테이블(Derived Table)**이라고 부릅니다. 옵티마이저가 이를 단순히 실행하면 서브쿼리 결과를 임시 테이블에 저장하고, 외부 쿼리가 그 임시 테이블을 스캔합니다.

```sql
-- 파생 테이블 예시
SELECT sub.name, sub.amount
FROM (
  SELECT name, amount FROM orders WHERE status = 'paid'
) sub
WHERE sub.amount > 10000;
```

임시 테이블 방식의 문제는 두 가지입니다. 첫째, 서브쿼리의 결과를 전부 먼저 구체화(Materialize)합니다. `WHERE sub.amount > 10000` 같은 외부 조건을 임시 테이블 생성 단계에서 적용할 수 없어 불필요한 행까지 저장합니다. 둘째, 임시 테이블에는 인덱스가 없습니다.

## Derived Merge 최적화

MySQL 5.7.6부터 기본 활성화된 **Derived Merge**는 파생 테이블을 외부 쿼리와 논리적으로 병합해 단일 쿼리처럼 실행합니다.

![Derived Merge 개념](/assets/posts/mysql-derived-merge-concept.svg)

병합이 성공하면 두 가지 이점이 생깁니다. 외부 조건이 내부 서브쿼리로 **Condition Pushdown**되어 원본 테이블의 인덱스를 활용할 수 있습니다. 그리고 임시 테이블을 생성하지 않아 메모리와 I/O 비용이 줄어듭니다.

## EXPLAIN으로 병합 여부 확인

```sql
EXPLAIN
SELECT sub.name, sub.amount
FROM (
  SELECT name, amount FROM orders WHERE status = 'paid'
) sub
WHERE sub.amount > 10000;
```

`select_type` 컬럼으로 판단합니다.

| select_type | 의미 |
|---|---|
| `SIMPLE` | 병합 성공 — 단일 쿼리로 처리 |
| `PRIMARY` + `DERIVED` | Materialization — 임시 테이블 생성 |

`DERIVED`가 보이면 임시 테이블이 만들어진 것이므로 병합 조건을 확인해야 합니다.

## 병합 가능 vs 불가 조건

![Derived Merge 코드 예시](/assets/posts/mysql-derived-merge-code.svg)

단순 `SELECT`와 `WHERE`만 포함한 파생 테이블은 대부분 병합됩니다. 다음 경우에는 병합이 불가능해 항상 Materialization이 발생합니다.

```sql
-- 병합 불가 1: GROUP BY / 집계 함수
FROM (SELECT status, COUNT(*) cnt FROM orders GROUP BY status) sub

-- 병합 불가 2: UNION / UNION ALL
FROM (SELECT * FROM orders_2023 UNION ALL SELECT * FROM orders_2024) sub

-- 병합 불가 3: DISTINCT
FROM (SELECT DISTINCT customer_id FROM orders) sub

-- 병합 불가 4: 윈도우 함수
FROM (SELECT *, ROW_NUMBER() OVER (...) rn FROM orders) sub

-- 병합 불가 5: LIMIT (외부 조건 pushdown 시 의미 변경 위험)
FROM (SELECT * FROM orders LIMIT 1000) sub
```

## Condition Pushdown (8.0.22+)

MySQL 8.0.22는 병합 불가 파생 테이블에도 일부 조건을 내부로 밀어 넣는 **Condition Pushdown** 최적화를 추가했습니다.

```sql
-- 외부 WHERE 조건이 Materialization 내부로 pushdown
SELECT sub.status, sub.cnt
FROM (
  SELECT status, COUNT(*) cnt
  FROM orders GROUP BY status
) sub
WHERE sub.status = 'paid';    -- pushdown 가능 (GROUP BY 키)

-- EXPLAIN으로 확인
-- Extra: Using where; Materialize with deferred conditions
```

`GROUP BY` 키에 대한 `WHERE` 조건은 집계 전 필터로 이동할 수 있어 임시 테이블 크기가 줄어듭니다. `COUNT(*)` 같은 집계 결과에 대한 필터는 pushdown이 불가능합니다.

## 힌트로 수동 제어

```sql
-- 병합 강제 (가능한 경우에만 효과)
SELECT /*+ MERGE(sub) */ sub.name, sub.amount
FROM (SELECT name, amount FROM orders WHERE status = 'paid') sub
WHERE sub.amount > 10000;

-- 병합 금지 → 항상 Materialization
SELECT /*+ NO_MERGE(sub) */ sub.name, sub.amount
FROM (SELECT name, amount FROM orders WHERE status = 'paid') sub
WHERE sub.amount > 10000;
```

`NO_MERGE`를 쓰는 경우: 파생 테이블 결과가 매우 작고, 외부 쿼리가 이 작은 집합을 여러 번 참조할 때 Materialization이 오히려 빠를 수 있습니다.

## 실전 패턴 — 집계 결과 조인

병합 불가 파생 테이블과 조인하는 패턴은 MySQL에서 매우 자주 사용됩니다.

```sql
-- 고객별 최대 주문 금액 조회
SELECT c.name, stats.max_amount
FROM customers c
JOIN (
  SELECT customer_id, MAX(amount) max_amount
  FROM orders
  GROUP BY customer_id
) stats ON stats.customer_id = c.id
WHERE stats.max_amount > 100000;
-- EXPLAIN: stats는 DERIVED (Materialization)
-- stats 임시 테이블에 customer_id 인덱스 자동 생성 (8.0.16+)
```

MySQL 8.0.16부터 Materialization된 파생 테이블에 조인 키가 있으면 **자동으로 인덱스**를 생성합니다. 이 덕분에 파생 테이블과의 조인도 인덱스 룩업으로 처리됩니다.

## optimizer_switch 설정

```sql
-- 현재 상태 확인
SELECT @@optimizer_switch\G
-- derived_merge=on (기본값)

-- 전역 비활성화 (테스트/디버깅용)
SET optimizer_switch = 'derived_merge=off';
-- 이후 EXPLAIN에서 select_type=DERIVED 강제 확인 가능
```

파생 테이블 최적화를 이해하면 복잡한 서브쿼리를 CTE(`WITH`) 또는 조인으로 재작성할지, 아니면 그대로 두어도 옵티마이저가 처리할지 판단하는 기준이 생깁니다.

---

**지난 글:** [MySQL 조인 알고리즘 — BNL · NLJ · Hash Join 완전 정리](/posts/mysql-join-algorithms-bnl-hash/)

**다음 글:** [MySQL 스토어드 프로시저와 함수 — 서버 사이드 로직 구현](/posts/mysql-stored-procedure-function/)

<br>
읽어주셔서 감사합니다. 😊
