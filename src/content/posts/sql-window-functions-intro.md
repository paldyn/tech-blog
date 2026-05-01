---
title: "윈도우 함수 입문 — OVER 절과 파티션"
description: "윈도우 함수의 기본 개념, OVER 절 구조(PARTITION BY·ORDER BY·프레임), GROUP BY와의 차이, 순위·집계·오프셋 함수 세 범주를 소개합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["sql", "window-function", "over-clause", "partition-by", "order-by", "rank", "aggregate", "lag", "lead"]
featured: false
draft: false
---

[지난 글](/posts/sql-recursive-cte/)에서 재귀 CTE로 계층 구조를 탐색하는 방법을 다뤘다. 이번에는 현대 SQL에서 가장 강력한 기능 중 하나인 **윈도우 함수(window function)** 를 소개한다. 행을 집계로 축소하지 않으면서도 집계·순위·이동값을 각 행에 추가할 수 있어, 분석 쿼리의 핵심 도구다.

---

## 윈도우 함수란

윈도우 함수는 현재 행과 관련된 행들의 집합(윈도우)에 대해 계산을 수행하고, **결과를 현재 행에 덧붙인다.** GROUP BY처럼 행을 합치지 않는다.

```sql
SELECT
    name,
    dept,
    salary,
    AVG(salary) OVER (PARTITION BY dept) AS dept_avg
FROM employees;
```

결과: employees의 모든 행이 그대로 나오고, 각 행에 소속 부서의 평균 급여가 추가된다. GROUP BY였다면 부서별 1행으로 줄어들었겠지만 윈도우 함수는 개별 행을 유지한다.

![윈도우 함수 OVER 절 구조](/assets/posts/sql-window-functions-intro-overview.svg)

---

## OVER 절 구조

윈도우 함수의 핵심은 `OVER ()` 절이다.

```sql
function_name(expr) OVER (
    [PARTITION BY partition_cols]    -- 파티션(그룹) 정의
    [ORDER BY order_cols [ASC|DESC]] -- 파티션 내 정렬
    [ROWS|RANGE BETWEEN ... AND ...]  -- 프레임 범위
)
```

**PARTITION BY**: 계산 범위를 나누는 그룹. `PARTITION BY dept`라면 dept별로 독립적인 윈도우를 만든다. 생략하면 전체 결과셋이 하나의 윈도우다.

**ORDER BY**: 파티션 내 행 순서를 정한다. 순위 함수와 프레임에 영향을 준다. 집계 함수도 ORDER BY가 있으면 누적 집계가 된다.

**ROWS/RANGE BETWEEN … AND …**: 현재 행을 기준으로 포함할 행 범위(프레임)를 정한다. `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`는 첫 행부터 현재 행까지가 프레임이 된다.

---

## GROUP BY와의 차이

```sql
-- GROUP BY: 행이 줄어듦
SELECT dept, AVG(salary) FROM employees GROUP BY dept;
-- 결과: (IT, 6200000), (HR, 4800000), ...  ← 3행 (부서 수)

-- 윈도우: 행 유지
SELECT name, dept, salary,
       AVG(salary) OVER (PARTITION BY dept) AS dept_avg
FROM employees;
-- 결과: (Alice, IT, 7000000, 6200000), (Bob, HR, 5000000, 4800000), ... ← 원본 행 수 유지
```

윈도우 함수는 SELECT 절에만 위치하며, WHERE·GROUP BY·HAVING 절에서 직접 참조할 수 없다. 윈도우 함수 결과로 필터링하려면 인라인 뷰 또는 CTE로 감싸야 한다.

```sql
-- 부서 평균보다 높은 급여자 필터링
SELECT * FROM (
    SELECT name, salary,
           AVG(salary) OVER (PARTITION BY dept) AS dept_avg
    FROM employees
) t
WHERE salary > dept_avg;
```

---

## 윈도우 함수 세 가지 범주

![윈도우 함수 3가지 범주](/assets/posts/sql-window-functions-intro-categories.svg)

**① 순위 함수**: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `NTILE(n)`, `PERCENT_RANK()`. ORDER BY 없이는 의미 없다. 프레임이 적용되지 않는다.

```sql
SELECT name, dept, salary,
       RANK()       OVER (PARTITION BY dept ORDER BY salary DESC) AS rnk,
       DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS dense_rnk,
       ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn
FROM employees;
```

**② 집계 함수 (윈도우 모드)**: `SUM()`, `AVG()`, `COUNT()`, `MIN()`, `MAX()`. `OVER()`를 붙이면 윈도우 함수로 동작한다. 프레임을 지정하면 이동 평균, 누적 합계를 계산할 수 있다.

```sql
-- 날짜순 누적 매출
SELECT order_date, amount,
       SUM(amount) OVER (ORDER BY order_date
                          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM daily_sales;
```

**③ 오프셋 함수**: `LAG()`, `LEAD()`, `FIRST_VALUE()`, `LAST_VALUE()`, `NTH_VALUE()`. ORDER BY가 필수다. 이전·다음 행의 값이나 프레임 내 특정 위치의 값을 가져온다.

```sql
-- 전날 대비 변화량
SELECT order_date, amount,
       LAG(amount, 1, 0) OVER (ORDER BY order_date) AS prev_amount,
       amount - LAG(amount, 1, 0) OVER (ORDER BY order_date) AS delta
FROM daily_sales;
```

---

## 실행 순서에서의 위치

윈도우 함수는 SQL 논리적 실행 순서에서 **SELECT 절 평가 단계**에서 실행된다.

```
FROM → WHERE → GROUP BY → HAVING → SELECT(윈도우 함수 포함) → ORDER BY → LIMIT
```

즉, WHERE와 HAVING 이후 남은 행들을 대상으로 윈도우 함수가 계산된다. ORDER BY와 LIMIT는 윈도우 함수 계산 후에 적용된다.

---

## 기억할 포인트

| 포인트 | 내용 |
|---|---|
| 행 유지 | GROUP BY와 달리 원본 행 수 유지 |
| OVER () 필수 | 괄호가 비어있어도 반드시 작성 |
| WHERE 불가 | 결과 필터링은 인라인 뷰/CTE 사용 |
| 순위 함수 프레임 | 순위 함수에는 프레임 무관 |
| LAST_VALUE 주의 | 기본 프레임이 CURRENT ROW까지 → 전체 범위로 재정의 필요 |

다음 편에서는 순위 함수 `ROW_NUMBER`, `RANK`, `DENSE_RANK`의 차이와 실무 패턴을 더 깊이 살펴본다.

---

**지난 글:** [재귀 CTE — 계층 구조와 그래프 순회](/posts/sql-recursive-cte/)

<br>
읽어주셔서 감사합니다. 😊
