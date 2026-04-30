---
title: "HAVING vs WHERE — 필터 위치가 중요한 이유"
description: "SELECT 논리적 실행 순서에서 WHERE와 HAVING의 위치 차이, 집계 후 필터링이 필요한 경우 HAVING을 써야 하는 이유, 집계 불필요한 조건을 WHERE에 두는 성능 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["sql", "having", "where", "group-by", "filter", "집계", "성능", "실행순서"]
featured: false
draft: false
---

[지난 글](/posts/sql-aggregate-functions/)에서 COUNT, SUM, AVG, MIN, MAX의 동작과 NULL 처리 규칙을 살펴봤다. 이번에는 집계 쿼리에서 가장 많이 혼란을 주는 주제인 **WHERE와 HAVING의 차이**를 다룬다. 어떤 조건을 어디에 두느냐가 결과와 성능 모두에 영향을 미친다.

---

## 핵심 차이 — 집계 전 vs 집계 후

SELECT 논리적 실행 순서는 `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY`다. 이 순서가 WHERE와 HAVING의 역할을 결정한다.

- **WHERE**: GROUP BY 이전에 실행. **행 단위 필터**. 집계 함수 사용 불가.
- **HAVING**: GROUP BY 이후에 실행. **그룹 단위 필터**. 집계 함수 사용 가능.

```sql
-- WHERE: 집계 전, 행 조건 (집계 함수 사용 불가)
-- HAVING: 집계 후, 그룹 조건 (집계 함수 사용 가능)

SELECT country, SUM(amount) AS total
FROM orders
WHERE status = 'paid'         -- ① 집계 전: paid 행만 남김
GROUP BY country
HAVING SUM(amount) >= 10000;  -- ② 집계 후: 합계 1만 이상 그룹만
```

![WHERE vs HAVING 논리적 실행 순서](/assets/posts/sql-having-vs-where-pipeline.svg)

---

## HAVING을 반드시 써야 하는 경우

집계 함수를 조건으로 사용해야 할 때는 HAVING이 유일한 선택이다.

```sql
-- 주문 건수가 10건 이상인 사용자
SELECT user_id, COUNT(*) AS order_count
FROM orders
GROUP BY user_id
HAVING COUNT(*) >= 10;

-- 평균 주문 금액이 5만 원 이상인 국가
SELECT country, AVG(amount) AS avg_amount
FROM orders
GROUP BY country
HAVING AVG(amount) >= 50000;

-- 최대 주문 금액과 최소 주문 금액 차이가 큰 그룹
SELECT user_id, MAX(amount) - MIN(amount) AS spread
FROM orders
GROUP BY user_id
HAVING MAX(amount) - MIN(amount) > 100000
ORDER BY spread DESC;
```

`WHERE COUNT(*) >= 10`처럼 WHERE에 집계 함수를 쓰면 문법 오류다. COUNT는 GROUP BY 이후에 계산되는데 WHERE는 그 전에 실행되기 때문이다.

---

## WHERE에 넣을 수 있으면 WHERE에 — 성능

집계 함수가 필요 없는 조건은 HAVING 대신 WHERE에 두는 것이 성능에 유리하다.

![조건 배치 전략](/assets/posts/sql-having-vs-where-strategy.svg)

```sql
-- ✗ 안티패턴: 집계 불필요한 조건을 HAVING에
SELECT country, SUM(amount)
FROM orders
GROUP BY country
HAVING country = 'KR';       -- 집계와 무관한 조건

-- ✓ 권장: WHERE로 먼저 필터
SELECT country, SUM(amount)
FROM orders
WHERE country = 'KR'         -- 집계 전 인덱스 활용
GROUP BY country;
```

HAVING에 `country = 'KR'`을 두면 모든 국가를 GROUP BY로 묶은 뒤 KR이 아닌 그룹을 버린다. WHERE에 두면 집계 전에 KR 행만 남기므로 GROUP BY의 입력 데이터 자체가 줄어든다. country 컬럼에 인덱스가 있으면 WHERE 방식은 인덱스를 탈 수 있지만 HAVING은 그렇지 않다.

---

## WHERE와 HAVING 동시 사용

두 절을 함께 쓰면 각각의 역할이 명확해진다.

```sql
-- 2024년 paid 주문 중, 국가별 합계가 100만 이상인 국가
SELECT
    country,
    COUNT(*)        AS order_count,
    SUM(amount)     AS total
FROM orders
WHERE status = 'paid'              -- 행 필터: paid만
  AND created_at >= '2024-01-01'   -- 행 필터: 2024년만
GROUP BY country
HAVING SUM(amount) >= 1000000      -- 그룹 필터: 합계 조건
ORDER BY total DESC;
```

이 쿼리는 먼저 WHERE로 2024년 paid 주문만 걸러낸 다음 국가별로 묶고, 그 중 합계가 100만 이상인 그룹만 반환한다. 논리와 성능이 모두 최적이다.

---

## HAVING에서 별칭 사용 가능 여부

SELECT에서 정의한 별칭을 HAVING에서 사용할 수 있는지는 DB마다 다르다.

```sql
SELECT country, SUM(amount) AS total
FROM orders
GROUP BY country
HAVING total >= 10000;  -- 별칭 total 사용

-- PostgreSQL, Oracle: 오류 (SELECT보다 HAVING이 먼저 평가됨)
-- MySQL, SQLite: 허용 (확장 동작)
-- 이식성을 위해 HAVING에서도 집계 함수를 반복하는 것이 안전
```

이식성을 중시한다면 `HAVING SUM(amount) >= 10000`처럼 집계 표현식을 반복하는 것이 안전하다.

---

## GROUP BY 없는 HAVING

GROUP BY 없이 HAVING만 쓰는 것도 가능하다. 이 경우 전체가 하나의 그룹으로 취급된다.

```sql
-- 총 주문 금액이 1억 이상일 때만 결과 반환
SELECT COUNT(*) AS total_orders, SUM(amount) AS grand_total
FROM orders
HAVING SUM(amount) >= 100000000;

-- 조건 불충족 시 행 없음, 충족 시 1행 반환
-- 데이터 유효성 검사나 임계값 확인에 활용
```

---

## 결정 기준 요약

| 조건 | 어디에 쓸까 |
|------|-------------|
| 집계 함수 포함 (COUNT, SUM, AVG…) | **HAVING** |
| 집계와 무관한 행 조건 | **WHERE** |
| 인덱스 활용이 필요한 필터 | **WHERE** |
| 조인 후 특정 컬럼 조건 | **WHERE** (OUTER JOIN 주의) |

---

**지난 글:** [집계 함수 완전 정리](/posts/sql-aggregate-functions/)

**다음 글:** [GROUPING SETS · ROLLUP · CUBE](/posts/sql-grouping-sets-rollup-cube/)

<br>
읽어주셔서 감사합니다. 😊
