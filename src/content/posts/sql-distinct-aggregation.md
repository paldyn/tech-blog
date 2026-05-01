---
title: "DISTINCT 집계 — COUNT DISTINCT의 비용과 대안"
description: "COUNT(DISTINCT col)의 처리 원리와 비용, 다중 DISTINCT 집계 시 문제, 서브쿼리 사전 중복 제거, HyperLogLog 근사 함수, Materialized View 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "distinct", "count-distinct", "aggregation", "hyperloglog", "materialized-view", "성능"]
featured: false
draft: false
---

[지난 글](/posts/sql-conditional-aggregation/)에서 CASE WHEN을 집계함수 안에 넣는 조건부 집계를 다뤘다. 이번에는 `COUNT(DISTINCT col)`의 내부 동작과 비용, 그리고 대규모 데이터에서 쓸 수 있는 대안 전략을 살펴본다.

---

## COUNT(DISTINCT)는 왜 느린가

일반 `COUNT(*)`는 행 수를 세기만 한다. 반면 `COUNT(DISTINCT col)`는 중복을 제거한 뒤 세야 하므로 추가 작업이 필요하다.

```sql
-- 일반 COUNT: O(N) 스캔
SELECT COUNT(*) FROM orders;

-- DISTINCT COUNT: 중복 제거 후 카운트
SELECT COUNT(DISTINCT customer_id) FROM orders;
```

내부 처리 흐름은 다음과 같다:

1. **전체 행 읽기** — 테이블 또는 인덱스 스캔
2. **중복 제거** — Sort(O(N log N)) 또는 Hash(O(N), 메모리 의존)
3. **고유값 계산** — 정렬된 값이나 해시 버킷에서 카운트

![COUNT DISTINCT 처리 과정과 대안](/assets/posts/sql-distinct-aggregation-cost.svg)

---

## 다중 DISTINCT 집계의 함정

한 SELECT에서 여러 컬럼에 DISTINCT를 적용하면 각각 독립적인 정렬 또는 해시 연산이 발생한다.

```sql
-- 두 번의 독립적인 중복 제거 발생
SELECT
    dept,
    COUNT(DISTINCT customer_id) AS uniq_customers,
    COUNT(DISTINCT product_id)  AS uniq_products
FROM orders
GROUP BY dept;
```

컬럼이 늘어날수록 비용이 선형으로 증가한다. 데이터가 많은 경우 서브쿼리로 분리하거나 CTE를 활용해 각각 독립적으로 집계한 뒤 JOIN하는 방법이 낫다.

```sql
-- 분리하여 각각 집계한 후 JOIN
WITH cust AS (
    SELECT dept, COUNT(DISTINCT customer_id) AS uniq_cust
    FROM orders GROUP BY dept
),
prod AS (
    SELECT dept, COUNT(DISTINCT product_id) AS uniq_prod
    FROM orders GROUP BY dept
)
SELECT c.dept, c.uniq_cust, p.uniq_prod
FROM cust c JOIN prod p USING (dept);
```

---

## SELECT DISTINCT vs COUNT(DISTINCT)

두 구문은 목적이 다르다.

![DISTINCT vs GROUP BY 비교](/assets/posts/sql-distinct-aggregation-patterns.svg)

`SELECT DISTINCT`는 중복 행을 제거한 목록을 반환하고, `COUNT(DISTINCT col)`는 그룹 내 고유값의 **개수**를 집계한다. 내부적으로 대부분의 DBMS에서 `SELECT DISTINCT`는 `GROUP BY` 전체 컬럼과 동일한 실행 계획으로 처리된다.

---

## 대안 ① — 서브쿼리로 사전 중복 제거

먼저 중복을 제거한 집합을 만들고, 그 위에서 집계하는 방법이다.

```sql
-- 그룹별 고유 (dept, customer_id) 쌍을 먼저 만들고 COUNT
SELECT dept, COUNT(*) AS uniq_customers
FROM (
    SELECT DISTINCT dept, customer_id
    FROM orders
) deduped
GROUP BY dept;
```

옵티마이저에 따라 `COUNT(DISTINCT)` 직접 사용보다 좋은 플랜이 나오기도 하고 동일하기도 하다. 실행 계획(EXPLAIN)으로 비교해보는 것이 좋다.

---

## 대안 ② — 근사 함수 (HyperLogLog)

수십억 행에서 정확한 DISTINCT 카운트는 매우 느리다. 오차 1% 내외를 허용한다면 HyperLogLog 기반 근사 함수를 사용한다.

```sql
-- PostgreSQL (extension 필요)
SELECT dept, approx_count_distinct(customer_id) AS approx_uniq
FROM orders GROUP BY dept;

-- BigQuery
SELECT dept, APPROX_COUNT_DISTINCT(customer_id) AS approx_uniq
FROM orders GROUP BY dept;

-- DuckDB (내장)
SELECT dept, approx_count_distinct(customer_id) AS approx_uniq
FROM orders GROUP BY dept;
```

HyperLogLog는 행당 O(1) 공간으로 카디널리티를 추정하며, 수십억 행에서도 밀리초 내에 결과를 반환한다. DAU(일 활성 사용자), UV(순방문자) 같은 지표에 자주 사용한다.

---

## 대안 ③ — Materialized View 사전 집계

정기적으로 조회하는 집계라면 Materialized View(구체화 뷰)나 집계 테이블을 미리 만들어두는 것이 가장 효과적이다.

```sql
-- 일별·부서별 고유 사용자 수 사전 집계
CREATE MATERIALIZED VIEW daily_uniq_users AS
SELECT
    DATE(created_at) AS day,
    dept,
    COUNT(DISTINCT customer_id) AS uniq_customers
FROM orders
GROUP BY 1, 2;

-- 조회 시 MV에서 바로 읽음
SELECT dept, SUM(uniq_customers) AS total_uniq
FROM daily_uniq_users
WHERE day BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY dept;
```

주의: 날짜를 넘나드는 DISTINCT는 단순 SUM으로 합산할 수 없다(같은 사용자가 여러 날에 걸쳐 카운트되므로). 날짜를 묶어 다시 DISTINCT 집계하거나, 비트맵 집합(Roaring Bitmap 등)을 활용한다.

---

## SUM(DISTINCT), AVG(DISTINCT)

COUNT 외에도 SUM과 AVG에 DISTINCT를 쓸 수 있지만, 의미를 명확히 파악하고 사용해야 한다.

```sql
-- 중복 제거한 금액의 합 — 실무에서 드문 경우
SELECT SUM(DISTINCT amount) FROM payments;

-- 중복 제거한 점수의 평균
SELECT AVG(DISTINCT score) FROM exam_results;
```

대부분 `SUM(DISTINCT)`는 의도가 불명확해 실수로 이어지기 쉽다. 정말 필요한 경우가 아니면 사전 GROUP BY로 중복을 없앤 뒤 집계하는 것이 의도를 명확히 드러낸다.

---

## 정리

| 상황 | 권장 |
|---|---|
| 소규모 데이터 | `COUNT(DISTINCT col)` 직접 사용 |
| 다중 컬럼 DISTINCT | CTE 분리 후 JOIN |
| 대규모 · 오차 허용 | `APPROX_COUNT_DISTINCT` (HLL) |
| 반복 조회 대시보드 | Materialized View 사전 집계 |
| 날짜 범위 롤업 | Roaring Bitmap 또는 재집계 |

---

**지난 글:** [조건부 집계 — CASE WHEN + 집계함수, FILTER 절](/posts/sql-conditional-aggregation/)

**다음 글:** [스칼라 서브쿼리 — 단일 값 반환과 성능](/posts/sql-scalar-subquery/)

<br>
읽어주셔서 감사합니다. 😊
