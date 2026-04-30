---
title: "집계 함수 완전 정리"
description: "COUNT·SUM·AVG·MIN·MAX의 동작 방식, NULL 처리 규칙, COUNT(*)와 COUNT(컬럼)의 차이, 집계 함수 중첩 금지 규칙, 조건부 집계(FILTER/CASE), 그리고 STRING_AGG 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["sql", "aggregate", "count", "sum", "avg", "min", "max", "null", "집계함수", "group-by"]
featured: false
draft: false
---

[지난 글](/posts/sql-group-by-essence/)에서 GROUP BY가 데이터를 묶는 원리와 SELECT 컬럼 규칙을 살펴봤다. 이번에는 GROUP BY와 짝을 이루는 **집계 함수**를 깊이 다룬다. COUNT, SUM, AVG, MIN, MAX는 SQL에서 가장 자주 쓰이는 함수지만, NULL 처리 방식과 동작의 세부 차이를 모르면 의도치 않은 결과를 얻을 수 있다.

---

## 5대 집계 함수

```sql
SELECT
    COUNT(*)            AS total_rows,      -- 전체 행 수 (NULL 포함)
    COUNT(amount)       AS non_null_amount, -- NULL 제외 행 수
    SUM(amount)         AS total,           -- 합계 (NULL 무시)
    AVG(amount)         AS average,         -- 평균 (NULL 무시)
    MIN(amount)         AS minimum,         -- 최솟값 (NULL 무시)
    MAX(amount)         AS maximum          -- 최댓값 (NULL 무시)
FROM orders;
```

![5대 집계 함수 동작과 NULL 처리](/assets/posts/sql-aggregate-functions-overview.svg)

---

## NULL 처리 규칙

**COUNT(\*)를 제외한 모든 집계 함수는 NULL을 무시하고 계산한다.** 이 규칙이 직관과 어긋나는 상황을 만든다.

```sql
-- amount: 1000, 2000, NULL, 3000, 4000, NULL, 5000 (7행)

COUNT(*)            = 7      -- NULL 포함 전체 행 수
COUNT(amount)       = 5      -- NULL 제외
SUM(amount)         = 15000  -- NULL 무시: 1000+2000+3000+4000+5000
AVG(amount)         = 3000   -- 15000 / 5 (분모도 NULL 제외)
                             -- 15000 / 7 이 아님!
MIN(amount)         = 1000
MAX(amount)         = 5000
```

AVG의 분모가 NULL 제외 행 수라는 점이 중요하다. NULL을 0으로 취급하는 평균을 구하려면 `COALESCE`로 변환한다.

```sql
-- NULL을 0으로 취급한 평균
SELECT AVG(COALESCE(amount, 0)) FROM orders;
-- 15000 / 7 = 2142.86 (NULL을 0으로 처리)
```

---

## COUNT(\*) vs COUNT(컬럼)

```sql
-- COUNT(*): 행 자체를 센다 — NULL 포함, 가장 빠름
SELECT COUNT(*) FROM orders;

-- COUNT(col): 해당 컬럼이 NULL이 아닌 행만 센다
SELECT COUNT(amount) FROM orders;

-- COUNT(DISTINCT col): 중복 제거 후 카운트
SELECT COUNT(DISTINCT user_id) FROM orders;
-- 주문한 고유 사용자 수

-- 여러 조건 조합
SELECT
    COUNT(*)                    AS total_orders,
    COUNT(DISTINCT user_id)     AS unique_customers,
    COUNT(amount)               AS with_amount,       -- amount 있는 행
    COUNT(*) - COUNT(amount)    AS missing_amount     -- amount NULL인 행
FROM orders;
```

COUNT(\*)가 COUNT(컬럼)보다 빠른 경우가 많다. 특히 InnoDB(MySQL)에서 COUNT(\*)는 별도 최적화가 적용된다.

---

## 집계 함수 중첩 금지

집계 함수 안에 또 다른 집계 함수를 직접 중첩하는 것은 표준 SQL에서 허용하지 않는다.

```sql
-- ✗ 문법 오류: SUM 안에 MAX
SELECT MAX(SUM(amount))
FROM orders
GROUP BY country;

-- ✓ 서브쿼리로 우회
SELECT MAX(country_total)
FROM (
    SELECT SUM(amount) AS country_total
    FROM orders
    GROUP BY country
) sub;

-- ✓ CTE로 더 읽기 쉽게
WITH country_totals AS (
    SELECT country, SUM(amount) AS total
    FROM orders
    GROUP BY country
)
SELECT MAX(total) FROM country_totals;
```

Oracle은 분석 함수 문맥에서 제한적으로 허용하지만, 표준 SQL과 대부분의 DB에서는 위 우회 방식을 사용한다.

![집계 함수 실무 패턴](/assets/posts/sql-aggregate-functions-patterns.svg)

---

## 조건부 집계

GROUP BY 없이 한 SELECT에서 여러 조건의 집계를 동시에 구할 수 있다. `FILTER` 절(표준)이나 `CASE WHEN`(범용)을 활용한다.

```sql
-- FILTER 절 (PostgreSQL, SQLite 3.30+)
SELECT
    SUM(amount) FILTER (WHERE status = 'paid')      AS paid_total,
    COUNT(*) FILTER (WHERE status = 'refunded')     AS refund_count,
    AVG(amount) FILTER (WHERE country = 'KR')       AS kr_avg
FROM orders;

-- CASE WHEN (모든 DB 호환)
SELECT
    SUM(CASE WHEN status = 'paid' THEN amount END)     AS paid_total,
    COUNT(CASE WHEN status = 'refunded' THEN 1 END)    AS refund_count,
    AVG(CASE WHEN country = 'KR' THEN amount END)      AS kr_avg
FROM orders;
```

`CASE WHEN ... END`에서 조건이 거짓일 때 `ELSE NULL`이 생략된 것으로, 집계 함수가 NULL을 무시하는 규칙을 활용한 패턴이다.

---

## 문자열 집계 — STRING_AGG / GROUP_CONCAT

그룹 내 값을 하나의 문자열로 합칠 때 쓰는 집계 함수다.

```sql
-- PostgreSQL / SQL Server
SELECT
    product_id,
    STRING_AGG(tag, ', ' ORDER BY tag) AS tags
FROM product_tags
GROUP BY product_id;

-- MySQL
SELECT
    product_id,
    GROUP_CONCAT(tag ORDER BY tag SEPARATOR ', ') AS tags
FROM product_tags
GROUP BY product_id;

-- Oracle (11g+)
SELECT
    product_id,
    LISTAGG(tag, ', ') WITHIN GROUP (ORDER BY tag) AS tags
FROM product_tags
GROUP BY product_id;
```

결과 문자열의 최대 길이 제한에 주의한다. MySQL의 `GROUP_CONCAT`은 기본 1024바이트 제한이 있어 `group_concat_max_len` 변수로 늘려야 할 수 있다.

---

## 빈 그룹에 대한 집계

집계 대상 행이 없으면 COUNT는 0을, 나머지 함수는 NULL을 반환한다.

```sql
-- 데이터가 없을 때
SELECT COUNT(*) FROM orders WHERE 1=0;   -- 0
SELECT SUM(amount) FROM orders WHERE 1=0; -- NULL (not 0)
SELECT AVG(amount) FROM orders WHERE 1=0; -- NULL

-- NULL을 0으로 바꾸려면 COALESCE
SELECT COALESCE(SUM(amount), 0) AS total
FROM orders
WHERE user_id = 9999;  -- 존재하지 않는 사용자 → 0 반환
```

---

**지난 글:** [GROUP BY의 본질](/posts/sql-group-by-essence/)

**다음 글:** [HAVING vs WHERE — 필터 위치가 중요한 이유](/posts/sql-having-vs-where/)

<br>
읽어주셔서 감사합니다. 😊
