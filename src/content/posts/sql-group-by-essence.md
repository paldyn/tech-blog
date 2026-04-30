---
title: "GROUP BY의 본질"
description: "GROUP BY가 데이터를 묶는 원리, SELECT 가능한 컬럼의 표준 규칙(표준 SQL vs MySQL), 집계 없이 GROUP BY를 DISTINCT 대용으로 쓰는 패턴, NULL 그룹 처리, 그리고 복합 GROUP BY를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "group-by", "집계", "grouping", "null", "any-value", "distinct", "복합그룹"]
featured: false
draft: false
---

[지난 글](/posts/sql-join-order-performance/)에서 JOIN 순서와 옵티마이저의 비용 계산 원리를 살펴봤다. 이번에는 집계 쿼리의 핵심인 GROUP BY를 다룬다. GROUP BY는 단순해 보이지만 SELECT 컬럼 규칙, NULL 처리, 복합 키 그룹핑에서 헷갈리는 부분이 있다.

---

## GROUP BY의 동작 원리

GROUP BY는 지정한 컬럼의 값이 같은 행들을 하나의 **그룹**으로 묶는다. 결과는 그룹 하나당 한 행이다. 원본이 100만 행이어도 GROUP BY country를 적용하면 국가 수만큼의 행이 반환된다.

```sql
-- 국가별 주문 합계
SELECT
    country,
    SUM(amount) AS total,
    COUNT(*)    AS order_count
FROM orders
GROUP BY country
ORDER BY total DESC;
```

논리적 실행 순서는 `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY`다. GROUP BY는 WHERE 필터 후에 적용된다.

![GROUP BY — 데이터를 묶는 원리](/assets/posts/sql-group-by-essence-grouping.svg)

---

## SELECT 가능한 컬럼 규칙

GROUP BY 쿼리에서 SELECT에 올 수 있는 컬럼은 두 가지다.

1. **GROUP BY에 포함된 컬럼** — 그룹을 식별하는 키
2. **집계 함수로 감싼 컬럼** — COUNT, SUM, AVG, MIN, MAX 등

이 두 가지 외의 컬럼은 SELECT에 올 수 없다. 그룹 안에 여러 행이 있는데 어느 행의 값을 반환해야 할지 결정할 수 없기 때문이다.

```sql
-- ✗ 오류 (표준 SQL): name이 GROUP BY에 없고 집계도 안 됨
SELECT country, name, SUM(amount)
FROM orders
GROUP BY country;

-- ✓ GROUP BY 컬럼 + 집계 함수
SELECT country, SUM(amount) AS total
FROM orders
GROUP BY country;

-- ✓ 여러 컬럼 GROUP BY
SELECT country, status, SUM(amount) AS total
FROM orders
GROUP BY country, status;
```

![GROUP BY SELECT 컬럼 규칙](/assets/posts/sql-group-by-essence-rules.svg)

---

## MySQL의 ANY_VALUE

MySQL은 기본 설정에서 GROUP BY에 없는 컬럼도 SELECT에 허용한다. 이 경우 그룹 내 **임의의 행** 값이 반환된다. 비결정적 동작으로 결과가 매번 달라질 수 있어 위험하다.

```sql
-- MySQL 기본: 비결정적 name 반환 (위험)
SELECT country, name, SUM(amount)
FROM orders GROUP BY country;

-- 의도를 명확히 하려면 ANY_VALUE 사용
SELECT country, ANY_VALUE(name) AS sample_name, SUM(amount)
FROM orders GROUP BY country;

-- ONLY_FULL_GROUP_BY 모드로 표준 동작 강제
SET sql_mode = 'ONLY_FULL_GROUP_BY,...';
```

실무에서는 `ONLY_FULL_GROUP_BY` 모드를 활성화해 표준 동작을 유지하는 것이 권장된다.

---

## NULL 그룹 처리

GROUP BY는 NULL을 하나의 그룹으로 취급한다. NULL이 여러 행 있어도 모두 같은 NULL 그룹에 속한다.

```sql
-- country가 NULL인 행들도 하나의 그룹으로 묶임
SELECT
    COALESCE(country, '(미분류)') AS country,
    COUNT(*) AS cnt
FROM orders
GROUP BY country;

-- NULL 그룹을 명시적으로 처리
SELECT
    country,
    COUNT(*) AS cnt
FROM orders
GROUP BY country
ORDER BY country NULLS LAST;  -- NULL 그룹을 마지막으로
```

---

## GROUP BY를 DISTINCT 대용으로

집계 없이 GROUP BY만 사용하면 DISTINCT와 같은 결과를 얻을 수 있다. 그러나 일반적으로 DISTINCT가 의도를 더 명확히 표현한다.

```sql
-- 아래 두 쿼리는 동일한 결과
SELECT DISTINCT country FROM orders;
SELECT country FROM orders GROUP BY country;

-- GROUP BY + 집계 없이 쓰는 경우: 정렬 포함 시
SELECT country FROM orders
GROUP BY country
ORDER BY country;

-- DISTINCT는 ORDER BY와 조합 가능하므로 이 용도로 굳이 GROUP BY를 쓸 필요 없음
SELECT DISTINCT country FROM orders ORDER BY country;
```

성능 차이는 DB와 버전마다 다르지만, 의도 전달은 DISTINCT가 훨씬 명확하다. GROUP BY는 집계와 함께 쓸 때 사용한다.

---

## 복합 GROUP BY

여러 컬럼을 GROUP BY에 나열하면 그 조합이 하나의 그룹 키가 된다.

```sql
-- 국가 + 연도별 주문 통계
SELECT
    country,
    EXTRACT(YEAR FROM created_at) AS year,
    COUNT(*)                       AS order_count,
    SUM(amount)                    AS total_amount,
    AVG(amount)                    AS avg_amount
FROM orders
GROUP BY country, EXTRACT(YEAR FROM created_at)
ORDER BY country, year;
```

GROUP BY에 표현식을 쓸 수 있다. 컬럼 자체가 아닌 `EXTRACT(YEAR FROM created_at)` 같은 변환 결과로 그룹핑할 수 있다. 단, 이때 SELECT에서 같은 표현식을 반복하거나 별칭으로 참조할 수 있는지는 DB마다 다르다.

```sql
-- PostgreSQL: SELECT의 별칭을 GROUP BY에서 참조 불가 (표준)
-- 아래는 오류
SELECT EXTRACT(YEAR FROM created_at) AS year
FROM orders GROUP BY year;  -- 오류 (PostgreSQL)

-- ✓ 표현식 반복
SELECT EXTRACT(YEAR FROM created_at) AS year, COUNT(*)
FROM orders GROUP BY EXTRACT(YEAR FROM created_at);

-- MySQL/SQLite: 별칭 허용
SELECT EXTRACT(YEAR FROM created_at) AS year, COUNT(*)
FROM orders GROUP BY year;  -- MySQL에서는 가능
```

---

**지난 글:** [JOIN 순서와 성능](/posts/sql-join-order-performance/)

**다음 글:** [집계 함수 완전 정리](/posts/sql-aggregate-functions/)

<br>
읽어주셔서 감사합니다. 😊
