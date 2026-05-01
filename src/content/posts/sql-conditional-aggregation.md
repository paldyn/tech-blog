---
title: "조건부 집계 — CASE WHEN + 집계함수, FILTER 절"
description: "CASE WHEN을 집계함수 안에 중첩하는 조건부 집계 패턴, FILTER 절과의 비교, ELSE NULL vs ELSE 0의 미묘한 차이, 그리고 크로스탭 보고서 생성 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "conditional-aggregation", "case-when", "filter", "crosstab", "pivot", "집계"]
featured: false
draft: false
---

[지난 글](/posts/sql-grouping-sets-rollup-cube/)에서 GROUPING SETS, ROLLUP, CUBE로 다차원 소계를 한 번의 쿼리로 뽑는 방법을 다뤘다. 이번에는 집계함수 안에 CASE WHEN을 중첩해 **특정 조건을 만족하는 행만 골라 집계**하는 조건부 집계(conditional aggregation) 패턴을 살펴본다. 피벗·크로스탭 보고서, A/B 비교, 다중 지표 한 줄 출력 등 실무에서 매우 자주 쓰인다.

---

## 왜 필요한가

부서별로 "남성 직원의 총 급여"와 "전체 직원 수"를 한 줄에 함께 보고 싶다고 하자. 일반 GROUP BY로는 성별 조건이 다른 두 지표를 한 행에 담기 어렵다.

```sql
-- ✗ 이렇게 하면 남성 행만 남아 전체 COUNT가 잘못됨
SELECT dept, COUNT(*), SUM(salary)
FROM employees
WHERE gender = 'M'
GROUP BY dept;
```

해결책은 집계함수 **안**에서 조건을 평가하는 것이다.

---

## 기본 패턴 — CASE WHEN inside 집계함수

```sql
SELECT
    dept,
    COUNT(*)                                               AS total,
    SUM(CASE WHEN gender = 'M' THEN salary ELSE 0 END)   AS male_salary,
    COUNT(CASE WHEN gender = 'F' THEN 1 END)              AS female_count,
    AVG(CASE WHEN grade = 'A' THEN score END)             AS a_grade_avg
FROM employees
GROUP BY dept;
```

CASE WHEN이 집계함수 안에서 행별로 평가된다. 조건을 만족하지 않는 행은 ELSE 값(NULL 또는 0)을 반환하고, 집계함수가 그것을 처리한다.

![조건부 집계 개요](/assets/posts/sql-conditional-aggregation-overview.svg)

---

## ELSE NULL vs ELSE 0 — 핵심 차이

가장 흔한 실수가 AVG에 `ELSE 0`을 쓰는 것이다.

```sql
-- AVG + ELSE NULL: 조건 행(A등급)만 분모에 포함 → 올바른 A등급 평균
AVG(CASE WHEN grade = 'A' THEN score END)

-- AVG + ELSE 0: 전체 행이 분모 → A등급이 아닌 행의 0이 평균을 끌어내림
AVG(CASE WHEN grade = 'A' THEN score ELSE 0 END)
```

**SUM에는 ELSE 0이나 ELSE NULL 둘 다 결과가 같다.** NULL은 SUM에서 무시되고, 0은 더해도 값이 변하지 않기 때문이다. 그러나 **COUNT와 AVG에서는 반드시 ELSE를 생략하거나 ELSE NULL을 명시**해야 의도한 결과를 얻는다.

```sql
-- COUNT에서: ELSE NULL → 조건 만족 행만 셈
COUNT(CASE WHEN status = 'active' THEN 1 END)

-- COUNT에서: ELSE 0 → 0도 NULL이 아니므로 전체 행을 셈 ← 버그
COUNT(CASE WHEN status = 'active' THEN 1 ELSE 0 END)
```

![조건부 집계 실행 흐름](/assets/posts/sql-conditional-aggregation-crosstab.svg)

---

## FILTER 절 (SQL:2003)

PostgreSQL, DuckDB, SQLite 3.30+ 는 더 읽기 쉬운 `FILTER (WHERE …)` 절을 지원한다.

```sql
SELECT
    dept,
    COUNT(*)                                    AS total,
    SUM(salary)  FILTER (WHERE gender = 'M')   AS male_salary,
    COUNT(*)     FILTER (WHERE gender = 'F')   AS female_count,
    AVG(score)   FILTER (WHERE grade = 'A')    AS a_grade_avg
FROM employees
GROUP BY dept;
```

FILTER는 집계함수 바로 뒤에 붙으며, WHERE 절처럼 행을 필터링한 뒤 집계한다. CASE WHEN에서 ELSE NULL 누락으로 생기는 실수를 구조적으로 방지한다. Oracle, MySQL, SQL Server는 아직 지원하지 않으므로 이식성이 필요하면 CASE WHEN을 사용한다.

---

## 크로스탭(피벗) 패턴

연도·카테고리 같은 값 도메인을 열로 펼칠 때 조건부 집계가 특히 유용하다.

```sql
-- 부서별 연도별 매출을 열로 펼치기
SELECT
    dept,
    SUM(CASE WHEN yr = 2023 THEN sales END) AS y2023,
    SUM(CASE WHEN yr = 2024 THEN sales END) AS y2024,
    SUM(CASE WHEN yr = 2025 THEN sales END) AS y2025
FROM sales_data
GROUP BY dept;
```

도메인이 미리 알려져 있을 때만 가능하다. 도메인이 동적이면 애플리케이션 레이어나 데이터베이스별 PIVOT 구문(Oracle `PIVOT`, SQL Server `PIVOT`)을 고려한다.

---

## 다중 조건 집계 — 실전 예시

```sql
-- 주문 테이블에서 상태별 건수와 금액을 한 번에
SELECT
    customer_id,
    COUNT(*)                                         AS total_orders,
    COUNT(*) FILTER (WHERE status = 'completed')    AS completed,
    COUNT(*) FILTER (WHERE status = 'cancelled')    AS cancelled,
    SUM(amount) FILTER (WHERE status = 'completed') AS completed_revenue,
    MAX(order_date) FILTER (WHERE status = 'completed') AS last_completed
FROM orders
GROUP BY customer_id;
```

CASE WHEN 방식으로도 동일하게 작성할 수 있으며, 어느 쪽이든 **테이블을 한 번만 스캔**한다는 점이 UNION ALL 방식 대비 가장 큰 장점이다.

---

## 실무 팁

| 상황 | 권장 |
|---|---|
| 이식성 최우선 | `CASE WHEN … THEN v END` (ELSE 생략) |
| PG/DuckDB 환경 | `agg() FILTER (WHERE …)` |
| SUM 조건부 합산 | ELSE 0 또는 ELSE NULL 모두 가능 |
| AVG/COUNT 조건부 집계 | 반드시 ELSE 생략 또는 ELSE NULL |
| 열 수가 동적 | 애플리케이션 PIVOT 또는 DB 전용 PIVOT |

---

**다음 글:** [DISTINCT 집계 — COUNT DISTINCT의 비용과 대안](/posts/sql-distinct-aggregation/)

<br>
읽어주셔서 감사합니다. 😊
