---
title: "날짜·시간 함수와 INTERVAL 연산"
description: "CURRENT_DATE, NOW(), EXTRACT, DATE_TRUNC, INTERVAL 산술, DATEDIFF, 월별 집계, D-day, 나이 계산 등 날짜·시간 함수 실무 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["sql", "datetime", "interval", "extract", "date-trunc", "datediff", "current-date", "timestamp", "date-arithmetic"]
featured: false
draft: false
---

[지난 글](/posts/sql-regex-similar-to/)에서 패턴 매칭 방법을 살펴봤다. 이번에는 날짜·시간 데이터를 다루는 함수들—현재 시각 조회, 날짜 산술, 부분 추출, 절삭(trunc), INTERVAL 연산—을 정리한다. 날짜 처리는 DB마다 문법이 상이한 영역이므로 표준과 각 DB의 차이를 함께 파악하는 것이 중요하다.

---

## 현재 날짜·시각

```sql
-- SQL 표준
SELECT CURRENT_DATE;       -- 날짜만 (예: 2026-05-03)
SELECT CURRENT_TIME;       -- 시각만 (예: 14:30:00+09)
SELECT CURRENT_TIMESTAMP;  -- 날짜 + 시각

-- PostgreSQL 추가 함수
SELECT NOW();              -- CURRENT_TIMESTAMP와 동일
SELECT LOCALTIMESTAMP;     -- 타임존 없는 로컬 시각
SELECT CLOCK_TIMESTAMP();  -- 함수 호출 순간의 실시간 (트랜잭션 시작 시각 아님)
```

`NOW()`는 트랜잭션 시작 시점의 시각을 반환한다. 같은 트랜잭션 안에서 여러 번 호출해도 같은 값이 나온다. 정확한 현재 시각이 필요하면 `CLOCK_TIMESTAMP()`를 쓴다.

---

## INTERVAL — 날짜 산술

`INTERVAL`은 기간 값을 표현하는 타입이다. 날짜/시각에 더하거나 빼서 날짜를 이동한다.

![날짜 산술 타임라인](/assets/posts/sql-datetime-functions-interval-visual.svg)

```sql
-- 오늘로부터 30일 후
SELECT CURRENT_DATE + INTERVAL '30 days';

-- 3개월 전
SELECT CURRENT_DATE - INTERVAL '3 months';

-- 복합 INTERVAL
SELECT CURRENT_TIMESTAMP + INTERVAL '1 year 2 months 3 days';
```

DB별 INTERVAL 구문 차이:

```sql
-- PostgreSQL
date + INTERVAL '1 day'
date + INTERVAL '1 month'

-- MySQL
DATE_ADD(date, INTERVAL 1 DAY)
DATE_SUB(date, INTERVAL 1 MONTH)

-- Oracle
date + 1           -- 1일 추가 (DATE 타입에서 정수 = 일 수)
date + INTERVAL '1' MONTH

-- SQL Server
DATEADD(day, 1, date)
DATEADD(month, 1, date)
```

---

## 날짜 차이 — DATEDIFF

두 날짜 사이의 간격을 구할 때 사용한다.

```sql
-- PostgreSQL: date - date = 정수(일 수)
SELECT '2026-12-31'::date - '2026-01-01'::date;  -- 364

-- 남은 일수 (D-day)
SELECT deadline - CURRENT_DATE AS days_left FROM projects;

-- MySQL: DATEDIFF(end, start)
SELECT DATEDIFF('2026-12-31', '2026-01-01');  -- 364

-- Oracle: date1 - date2 (일 수)
SELECT TO_DATE('2026-12-31','YYYY-MM-DD')
     - TO_DATE('2026-01-01','YYYY-MM-DD') AS diff FROM DUAL;

-- SQL Server: DATEDIFF(part, start, end)
SELECT DATEDIFF(day, '2026-01-01', '2026-12-31');  -- 364
SELECT DATEDIFF(month, '2026-01-01', '2026-12-31');  -- 11
```

---

## EXTRACT — 날짜 부분 추출

```sql
-- SQL 표준 EXTRACT
SELECT
    EXTRACT(YEAR   FROM order_date) AS yr,
    EXTRACT(MONTH  FROM order_date) AS mo,
    EXTRACT(DAY    FROM order_date) AS dy,
    EXTRACT(HOUR   FROM created_at) AS hr,
    EXTRACT(DOW    FROM order_date) AS weekday,  -- 0=일 ~ 6=토 (PostgreSQL)
    EXTRACT(WEEK   FROM order_date) AS iso_week,
    EXTRACT(EPOCH  FROM created_at) AS unix_ts   -- PostgreSQL 전용
FROM orders;
```

MySQL은 `EXTRACT(unit FROM date)` 표준 구문과 `YEAR(date)`, `MONTH(date)`, `DAY(date)` 같은 전용 함수를 모두 지원한다. SQL Server는 `YEAR()`, `MONTH()`, `DAY()`, `DATEPART(unit, date)`를 사용한다.

---

## DATE_TRUNC — 날짜 절삭

`DATE_TRUNC('unit', date)`는 날짜를 지정 단위 이하로 잘라낸다. 월별·주별·분기별 집계에 매우 유용하다.

```sql
-- 월 단위로 절삭: 2026-05-03 → 2026-05-01
SELECT DATE_TRUNC('month', CURRENT_DATE);

-- 분기별 집계 (PostgreSQL)
SELECT
    DATE_TRUNC('quarter', order_date) AS quarter,
    SUM(amount) AS total
FROM orders
GROUP BY DATE_TRUNC('quarter', order_date)
ORDER BY 1;
```

MySQL은 `DATE_FORMAT(date, '%Y-%m-01')`로 월 절삭을 구현한다. Oracle은 `TRUNC(date, 'MM')`. SQL Server는 `DATETRUNC(month, date)` (SQL Server 2022+) 또는 `DATEFROMPARTS(YEAR(d), MONTH(d), 1)`.

---

## 실전 패턴

![날짜 함수 실전 패턴](/assets/posts/sql-datetime-functions-interval-code.svg)

```sql
-- 최근 30일 데이터 필터
WHERE created_at >= NOW() - INTERVAL '30 days'

-- 나이 계산 (PostgreSQL)
SELECT EXTRACT(YEAR FROM AGE(birth_date)) AS age FROM users;

-- 해당 달의 마지막 날 (PostgreSQL)
SELECT DATE_TRUNC('month', d) + INTERVAL '1 month' - 1 AS last_day;

-- 요일별 집계 (0=일요일)
SELECT
    EXTRACT(DOW FROM order_date) AS weekday,
    COUNT(*) AS cnt
FROM orders
GROUP BY 1
ORDER BY 1;

-- 기간 유효성 검사: 시작일 <= 종료일
WHERE start_date <= end_date
  AND start_date >= CURRENT_DATE
```

---

## DB별 함수 대조표

| 기능 | PostgreSQL | MySQL | Oracle | SQL Server |
|---|---|---|---|---|
| 현재 날짜 | `CURRENT_DATE` | `CURDATE()` | `SYSDATE` | `GETDATE()` |
| 현재 시각 | `NOW()` | `NOW()` | `SYSTIMESTAMP` | `GETDATE()` |
| 날짜 덧셈 | `+ INTERVAL` | `DATE_ADD` | `+ numdays` | `DATEADD` |
| 날짜 차이 | `date - date` | `DATEDIFF` | `date - date` | `DATEDIFF` |
| 부분 추출 | `EXTRACT` | `EXTRACT / YEAR()` | `EXTRACT / TO_CHAR` | `DATEPART` |
| 절삭 | `DATE_TRUNC` | `DATE_FORMAT` | `TRUNC` | `DATETRUNC` (2022+) |

---

**지난 글:** [LIKE, SIMILAR TO, 정규식 패턴 매칭](/posts/sql-regex-similar-to/)

<br>
읽어주셔서 감사합니다. 😊
