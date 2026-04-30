---
title: "GROUPING SETS · ROLLUP · CUBE"
description: "한 번의 쿼리로 여러 그룹핑 조합의 소계·합계를 구하는 GROUPING SETS, ROLLUP, CUBE의 동작 원리, GROUPING() 함수로 소계 행을 식별하는 방법, 그리고 실무 집계 보고서 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["sql", "grouping-sets", "rollup", "cube", "grouping", "소계", "합계", "보고서", "olap"]
featured: false
draft: false
---

[지난 글](/posts/sql-having-vs-where/)에서 WHERE와 HAVING의 차이와 조건 배치 전략을 살펴봤다. 이번에는 한 번의 쿼리로 다양한 차원의 소계와 합계를 동시에 구하는 **GROUPING SETS, ROLLUP, CUBE**를 다룬다. 보고서 쿼리에서 반복적인 UNION ALL을 제거하고 가독성을 높이는 SQL 표준 기능이다.

---

## 문제 — UNION ALL 반복

여러 차원의 집계가 필요할 때 흔히 쓰는 방법이 여러 GROUP BY를 UNION ALL로 합치는 것이다.

```sql
-- ✗ UNION ALL로 3가지 집계 합치기 — 테이블 3번 스캔
SELECT country, category, SUM(amount)
FROM orders GROUP BY country, category
UNION ALL
SELECT country, NULL, SUM(amount)
FROM orders GROUP BY country
UNION ALL
SELECT NULL, NULL, SUM(amount)
FROM orders;
```

쿼리가 길고 테이블을 여러 번 스캔한다. GROUPING SETS, ROLLUP, CUBE를 사용하면 한 번의 테이블 스캔으로 같은 결과를 얻는다.

---

## GROUPING SETS

원하는 그룹핑 조합을 명시적으로 지정한다. 각 조합이 독립적으로 집계되어 하나의 결과로 합쳐진다.

```sql
-- country별, category별, 전체 합계를 한 번에
SELECT country, category, SUM(amount) AS total
FROM orders
GROUP BY GROUPING SETS (
    (country, category),  -- 조합 1
    (country),            -- 조합 2
    (category),           -- 조합 3
    ()                    -- 전체 합계
);
```

`()`는 빈 그룹핑 집합으로 전체 합계를 나타낸다. 소계 행에서 해당 차원이 NULL로 표시된다.

![GROUPING SETS · ROLLUP · CUBE 비교](/assets/posts/sql-grouping-sets-rollup-cube-overview.svg)

---

## ROLLUP

계층형 소계를 자동으로 생성한다. 컬럼을 **오른쪽부터** 하나씩 제거하며 집계한다. n개 컬럼이면 n+1개의 그룹핑 조합을 만든다.

```sql
-- ROLLUP(year, quarter, month)
-- 생성하는 조합:
--   (year, quarter, month) — 가장 상세
--   (year, quarter)         — 분기 소계
--   (year)                  — 연도 소계
--   ()                      — 전체 합계

SELECT
    year,
    quarter,
    month,
    SUM(amount) AS total
FROM sales
GROUP BY ROLLUP(year, quarter, month)
ORDER BY year, quarter, month;
```

연도-분기-월처럼 계층적 시간 집계 보고서에 적합하다. 순서가 중요하다. `ROLLUP(month, year)`는 `ROLLUP(year, month)`와 다른 결과를 낸다.

---

## CUBE

지정한 컬럼의 **모든 가능한 조합**을 생성한다. n개 컬럼이면 2ⁿ개의 조합을 만든다.

```sql
-- CUBE(country, category) → 2² = 4가지 조합
-- (country, category), (country), (category), ()

SELECT country, category, SUM(amount) AS total
FROM orders
GROUP BY CUBE(country, category)
ORDER BY country, category;
```

다차원 분석(cross-tabulation)이나 피벗 보고서에서 유용하다. 컬럼이 많아지면 조합 수가 기하급수적으로 늘어나므로 3~4개 이상은 주의한다.

---

## GROUPING() 함수 — 소계 행 식별

ROLLUP이나 CUBE 결과에서 소계 행의 NULL과 실제 데이터가 NULL인 경우를 구분해야 한다. `GROUPING()` 함수가 이를 해결한다.

```sql
-- GROUPING(col): 소계로 인한 NULL이면 1, 실제 데이터이면 0 반환
SELECT
    CASE WHEN GROUPING(country) = 1 THEN '합계' ELSE country END AS country_label,
    CASE WHEN GROUPING(category) = 1 THEN '소계' ELSE category END AS category_label,
    SUM(amount) AS total
FROM orders
GROUP BY ROLLUP(country, category)
ORDER BY GROUPING(country), country, GROUPING(category), category;
```

![ROLLUP 결과와 GROUPING() 함수](/assets/posts/sql-grouping-sets-rollup-cube-result.svg)

---

## GROUPING_ID() — 다중 컬럼 소계 구분

여러 컬럼을 한 번에 확인하려면 `GROUPING_ID()`를 사용한다. 각 컬럼의 GROUPING 값을 비트로 결합한 정수를 반환한다.

```sql
-- GROUPING_ID(country, category):
-- 00 (0): 실제 데이터
-- 01 (1): country 소계 (category가 소계 NULL)
-- 10 (2): category 소계 (country가 소계 NULL)
-- 11 (3): 전체 합계

SELECT
    country, category,
    SUM(amount) AS total,
    GROUPING_ID(country, category) AS gid
FROM orders
GROUP BY CUBE(country, category)
HAVING GROUPING_ID(country, category) <= 1  -- 소계 행만 추출
ORDER BY gid, country, category;
```

---

## 실무 — 보고서 쿼리 패턴

```sql
-- 월별·카테고리별 매출 보고서 (소계 포함)
SELECT
    CASE WHEN GROUPING(category) = 1 THEN '전체' ELSE category END AS 카테고리,
    CASE WHEN GROUPING(month)    = 1 THEN '합계' ELSE TO_CHAR(month, 'MM월') END AS 월,
    SUM(amount)    AS 매출액,
    COUNT(*)       AS 주문건수,
    ROUND(AVG(amount)) AS 평균주문금액
FROM (
    SELECT
        category,
        DATE_TRUNC('month', created_at) AS month,
        amount
    FROM orders
    WHERE created_at >= '2024-01-01'
      AND status = 'paid'
) sub
GROUP BY ROLLUP(category, month)
ORDER BY
    GROUPING(category),
    category,
    GROUPING(month),
    month;
```

ROLLUP/CUBE는 표준 SQL이지만 MySQL 5.x 이하는 지원하지 않는다. MySQL 8.0+에서는 지원한다. Oracle은 `GROUP BY ROLLUP(col1, col2)` 문법을 사용한다.

---

**지난 글:** [HAVING vs WHERE — 필터 위치가 중요한 이유](/posts/sql-having-vs-where/)

**다음 글:** [조건부 집계](/posts/sql-conditional-aggregation/)

<br>
읽어주셔서 감사합니다. 😊
