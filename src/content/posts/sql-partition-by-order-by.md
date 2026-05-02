---
title: "PARTITION BY와 ORDER BY의 역할"
description: "윈도우 함수 OVER 절 안의 PARTITION BY와 ORDER BY가 각각 어떤 역할을 하는지, 생략했을 때 어떻게 동작하는지, 조합 방식을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "window-function", "partition-by", "order-by", "over-clause", "frame", "aggregate"]
featured: false
draft: false
---

[지난 글](/posts/sql-moving-average-cumulative/)에서 누적 합계와 이동 평균을 계산할 때 `ROWS BETWEEN` 프레임을 사용했다. 그 전에 반드시 명확히 이해해야 하는 두 절이 있다—`PARTITION BY`와 `ORDER BY`. 이 두 절은 윈도우 함수가 어느 행들을 대상으로 계산할지, 그 안에서 어떤 순서로 처리할지를 결정한다.

---

## PARTITION BY — 독립 윈도우 분할

`PARTITION BY col`은 결과셋을 col 값으로 나눠 각각 독립적인 윈도우로 만든다. 파티션 경계를 넘어서는 계산이 일어나지 않으므로, 그룹별로 순위·집계를 독립 적용할 때 사용한다.

![PARTITION BY 파티션별 독립 처리](/assets/posts/sql-partition-by-order-by-diagram.svg)

```sql
-- 부서별 평균 급여를 각 행에 추가
SELECT
    emp_name, dept, salary,
    AVG(salary) OVER (PARTITION BY dept) AS dept_avg,
    salary / AVG(salary) OVER (PARTITION BY dept) AS ratio
FROM employees;
-- 부서가 바뀌면 AVG 계산 범위가 새로 시작됨
```

`PARTITION BY`를 생략하면 전체 결과셋이 하나의 윈도우가 된다. `PARTITION BY dept, year`처럼 복수 컬럼을 쓰면 두 컬럼의 조합별로 나뉜다.

---

## ORDER BY — 프레임 순서와 순위 기준

`ORDER BY col`은 파티션 내에서 행을 정렬한다. 두 가지 역할이 있다.

1. **순위 함수**: `RANK()`, `ROW_NUMBER()` 등은 ORDER BY를 기준으로 번호를 매긴다. ORDER BY 없이는 의미 없다.
2. **프레임 경계**: `ROWS BETWEEN`·`RANGE BETWEEN` 프레임이 ORDER BY 순서를 기준으로 "앞/뒤 N행"을 계산한다.

```sql
SELECT
    sale_date, amount,
    -- ORDER BY가 없으면 프레임 기준이 없어 집계가 전체 합
    SUM(amount) OVER () AS total,
    -- ORDER BY 추가: 누적 합계
    SUM(amount) OVER (ORDER BY sale_date) AS running
FROM daily_sales;
```

`ORDER BY`만 있고 프레임이 없는 집계 윈도우는 암묵적으로 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`가 된다. **순위 함수는 프레임 절을 무시한다.**

---

## 생략 시 동작 정리

![OVER 절 구조](/assets/posts/sql-partition-by-order-by-code.svg)

| 상황 | 동작 |
|---|---|
| `OVER ()` | 전체 결과셋 하나의 윈도우, 프레임 = 전체 |
| `OVER (PARTITION BY dept)` | dept별 독립 윈도우, 순위·누적 불가(ORDER BY 없음) |
| `OVER (ORDER BY salary)` | 전체가 하나의 윈도우, salary 순 누적 |
| `OVER (PARTITION BY dept ORDER BY salary)` | dept별 독립, salary 순 누적/순위 |

---

## 부서별 비율 계산 패턴

실무에서 자주 쓰이는 패턴은 **전체 대비 비율**과 **그룹 대비 비율** 두 가지다.

```sql
SELECT
    emp_name, dept, salary,
    -- 전체 합계 대비 비율
    ROUND(salary * 100.0 /
        SUM(salary) OVER (), 2) AS pct_of_total,
    -- 부서 합계 대비 비율
    ROUND(salary * 100.0 /
        SUM(salary) OVER (PARTITION BY dept), 2) AS pct_of_dept
FROM employees;
```

두 `OVER` 절이 같은 쿼리에 공존할 수 있다. 옵티마이저가 각각을 독립적으로 처리한다.

---

## 이름 있는 윈도우 (WINDOW 절)

같은 `OVER` 정의를 여러 함수에서 반복할 때는 `WINDOW` 절로 이름을 붙일 수 있다. SQL:2003 표준이며 PostgreSQL, MySQL 8+, DuckDB 등이 지원한다.

```sql
SELECT
    emp_name, dept, salary,
    RANK()       OVER w AS rnk,
    DENSE_RANK() OVER w AS drk,
    AVG(salary)  OVER w AS avg_sal
FROM employees
WINDOW w AS (PARTITION BY dept ORDER BY salary DESC);
-- w를 한 곳에서만 정의하면 됨
```

`WINDOW` 절은 `HAVING` 다음, `ORDER BY` 앞에 위치한다. Oracle은 이 구문을 지원하지 않으며 인라인 `OVER(...)` 반복이 필요하다.

---

## 성능 고려

`PARTITION BY`에 사용하는 컬럼에 인덱스가 있으면 파티션을 분리하는 정렬 비용이 줄어들 수 있다. 실행 계획에서 `Sort` 노드 위에 `WindowAgg`가 붙는 형태를 확인할 수 있다. 같은 `PARTITION BY ORDER BY` 조합을 가진 윈도우 함수들은 단일 정렬로 처리되므로, 동일 OVER 절을 공유하면 성능상 유리하다.

```sql
-- 같은 파티션·정렬이면 한 번만 정렬됨
SELECT
    emp_name, dept, salary,
    ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC),
    RANK()       OVER (PARTITION BY dept ORDER BY salary DESC),
    DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC)
FROM employees;
```

---

**지난 글:** [이동 평균과 누적 합계](/posts/sql-moving-average-cumulative/)

**다음 글:** [윈도우 프레임 — ROWS BETWEEN과 RANGE BETWEEN](/posts/sql-window-frame-rows-range/)

<br>
읽어주셔서 감사합니다. 😊
