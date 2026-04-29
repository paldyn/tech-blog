---
title: "ORDER BY와 NULL 정렬"
description: "SQL ORDER BY의 ASC/DESC 기본, 다중 컬럼 정렬, NULL의 DBMS별 기본 위치 차이, NULLS FIRST/LAST, CASE로 커스텀 정렬, filesort 성능 이슈를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "order-by", "null-sort", "nulls-first", "nulls-last", "filesort", "정렬", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/sql-in-between-isnull/)에서 IN, BETWEEN, IS NULL을 살펴봤다. 이번에는 결과의 순서를 제어하는 ORDER BY와 NULL 정렬의 DBMS별 차이를 다룬다.

---

## ORDER BY 기본

```sql
-- 단일 컬럼, 오름차순 (기본)
SELECT * FROM employees ORDER BY name ASC;
SELECT * FROM employees ORDER BY name;  -- ASC 생략 가능

-- 내림차순
SELECT * FROM employees ORDER BY salary DESC;

-- 다중 컬럼: 첫 번째 기준으로 정렬 후, 동점이면 두 번째 기준 적용
SELECT * FROM employees
ORDER BY dept ASC, salary DESC;
```

ORDER BY는 SELECT 이후에 실행되므로 SELECT 별칭을 사용할 수 있다.

```sql
SELECT price * 1.1 AS total_price
FROM products
ORDER BY total_price DESC;  -- 별칭 사용 정상
```

---

## NULL 정렬 위치 — DBMS별 차이

NULL의 기본 정렬 위치는 DBMS마다 다르다. 이 차이를 모르면 동일 쿼리가 환경에 따라 다른 결과를 낸다.

| DBMS | ASC 시 NULL 위치 | DESC 시 NULL 위치 |
|---|---|---|
| PostgreSQL | 마지막 | 처음 |
| Oracle | 마지막 | 처음 |
| MySQL / MariaDB | 처음 (가장 작음) | 마지막 |
| SQL Server | 처음 | 마지막 |

MySQL은 NULL을 "가장 작은 값"으로 취급한다. 그래서 ASC 정렬에서 NULL이 맨 앞에 온다.

![ORDER BY 기본과 NULL 정렬 DBMS별 차이](/assets/posts/sql-order-by-and-null-sort-basics.svg)

---

## NULLS FIRST / NULLS LAST

PostgreSQL과 Oracle은 NULL 위치를 명시적으로 제어할 수 있다.

```sql
-- NULL을 항상 마지막으로
SELECT * FROM employees
ORDER BY score ASC NULLS LAST;

-- NULL을 항상 처음으로
SELECT * FROM employees
ORDER BY score DESC NULLS FIRST;
```

MySQL에는 `NULLS FIRST/LAST` 문법이 없다. 대신 다음 방법을 사용한다.

```sql
-- MySQL에서 NULL을 ASC 마지막으로 (NULL → 1, 나머지 → 0)
ORDER BY (score IS NULL), score ASC;

-- 또는 COALESCE로 NULL을 매우 큰 값으로 대체
ORDER BY COALESCE(score, 999999) ASC;
```

---

## CASE로 커스텀 정렬 순서

열거형 상태를 우선순위 순서대로 정렬해야 할 때 CASE 표현식을 사용한다.

```sql
-- 'urgent' → 'normal' → 'low' 순으로 정렬
SELECT * FROM tickets
ORDER BY
    CASE status
        WHEN 'urgent' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low'    THEN 3
        ELSE 4
    END ASC,
    created_at ASC;
```

---

## ORDER BY 없이는 순서가 보장되지 않는다

SQL 표준에서 결과 행의 순서는 ORDER BY가 없으면 보장되지 않는다. 인덱스 스캔 순서나 이전 실행의 순서가 재현되는 것처럼 보여도 언제든 바뀔 수 있다.

```sql
-- ✗ 순서 보장 안 됨
SELECT * FROM users WHERE active = true;

-- ✓ 순서 보장
SELECT * FROM users WHERE active = true ORDER BY id;
```

페이지 처리나 보고서처럼 순서가 의미 있는 쿼리에는 반드시 ORDER BY를 명시한다.

---

## 성능: filesort와 인덱스 정렬

ORDER BY는 정렬 비용이 발생한다. 인덱스 컬럼 순서와 ORDER BY 컬럼·방향이 일치하면 정렬 없이 인덱스 순서를 그대로 사용할 수 있다.

```sql
-- 인덱스: (user_id ASC, created_at DESC)
-- 아래 ORDER BY는 인덱스 순서와 일치 → filesort 없음
SELECT * FROM orders
WHERE user_id = 42
ORDER BY user_id ASC, created_at DESC;
```

```sql
-- ✗ 함수 사용 → 인덱스 정렬 불가
ORDER BY LOWER(name)

-- ✗ 랜덤 정렬 → 항상 filesort + 전체 결과 필요
ORDER BY RAND()
```

대용량 테이블에서 `ORDER BY RAND()`는 매우 느리다. 랜덤 샘플링이 필요하다면 다른 방법(TABLESAMPLE, 서브쿼리 등)을 고려한다.

![ORDER BY 실전 패턴](/assets/posts/sql-order-by-and-null-sort-patterns.svg)

---

**지난 글:** [IN · BETWEEN · IS NULL](/posts/sql-in-between-isnull/)

**다음 글:** [LIMIT / OFFSET / FETCH FIRST — 페이지 처리](/posts/sql-limit-offset-fetch/)

<br>
읽어주셔서 감사합니다. 😊
