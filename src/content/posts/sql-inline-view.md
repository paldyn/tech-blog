---
title: "인라인 뷰 — FROM 절 서브쿼리 활용"
description: "FROM 절에 서브쿼리를 놓는 인라인 뷰의 개념, 집계 결과에 WHERE를 적용하는 패턴, 다단계 집계 분해, 인라인 뷰와 CTE의 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "inline-view", "from-subquery", "derived-table", "cte", "집계", "가독성"]
featured: false
draft: false
---

[지난 글](/posts/sql-scalar-subquery/)에서 단일 값을 반환하는 스칼라 서브쿼리를 다뤘다. 이번에는 서브쿼리를 **FROM 절**에 놓아 가상 테이블처럼 사용하는 **인라인 뷰(inline view)** 를 살펴본다. 복잡한 집계 로직을 단계적으로 분리할 때 가장 자주 쓰이는 패턴이다.

---

## 인라인 뷰란

인라인 뷰는 FROM 절에 괄호로 감싼 서브쿼리를 놓고, 외부 쿼리에서 일반 테이블처럼 참조하는 구조다. SQL Server, MySQL은 이를 **파생 테이블(derived table)** 이라고도 부른다.

```sql
SELECT dept, avg_sal
FROM (
    SELECT dept, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY dept
) dept_avg                  -- 별칭 필수
WHERE avg_sal > 5000000;    -- 집계 결과에 직접 WHERE 사용
```

일반 GROUP BY에서는 집계 결과에 WHERE를 쓸 수 없고 HAVING을 사용해야 한다. 인라인 뷰를 쓰면 집계한 결과를 하나의 가상 테이블로 보고 거기에 자유롭게 WHERE, JOIN, ORDER BY를 적용할 수 있다.

![인라인 뷰 구조](/assets/posts/sql-inline-view-overview.svg)

---

## 다단계 집계 분해

인라인 뷰의 가장 큰 활용 사례는 집계를 여러 단계로 나누는 것이다.

```sql
-- 1단계: 부서별 평균 급여 집계
-- 2단계: 그 중 상위 3 부서만 추출
SELECT dept, avg_sal, rnk
FROM (
    SELECT
        dept,
        AVG(salary)                                          AS avg_sal,
        RANK() OVER (ORDER BY AVG(salary) DESC)             AS rnk
    FROM employees
    GROUP BY dept
) dept_ranked
WHERE rnk <= 3;
```

`WHERE rnk <= 3`은 윈도우 함수 결과에 필터링을 적용한다. 윈도우 함수는 WHERE나 HAVING에서 직접 참조할 수 없기 때문에 인라인 뷰(또는 CTE)로 한 번 감싸는 패턴이 필수다.

---

## 인라인 뷰 JOIN

여러 집계를 따로 계산하고 합치는 패턴에도 인라인 뷰가 쓰인다.

```sql
SELECT a.dept, a.avg_sal, b.max_sal, c.headcount
FROM (
    SELECT dept, AVG(salary) AS avg_sal
    FROM employees GROUP BY dept
) a
JOIN (
    SELECT dept, MAX(salary) AS max_sal
    FROM employees GROUP BY dept
) b USING (dept)
JOIN (
    SELECT dept, COUNT(*) AS headcount
    FROM employees GROUP BY dept
) c USING (dept);
```

같은 테이블을 3번 스캔하는 비효율이 있다. 이 경우 조건부 집계로 한 번에 처리하거나, CTE로 묶는 것이 낫다.

```sql
-- 조건부 집계로 한 번에
SELECT
    dept,
    AVG(salary)  AS avg_sal,
    MAX(salary)  AS max_sal,
    COUNT(*)     AS headcount
FROM employees
GROUP BY dept;
```

---

## 인라인 뷰 vs CTE

인라인 뷰와 CTE(WITH 절)는 같은 목적에 쓰이지만 가독성과 재사용성에서 차이가 있다.

![인라인 뷰 vs CTE](/assets/posts/sql-inline-view-vs-cte.svg)

| 기준 | 인라인 뷰 | CTE |
|---|---|---|
| 이름 | 별칭만 | 의미 있는 이름 |
| 재사용 | 불가 (매번 반복) | 같은 쿼리 내 재참조 가능 |
| 중첩 가독성 | 깊어질수록 읽기 어려움 | 선형으로 읽기 쉬움 |
| 재귀 | 불가 | `RECURSIVE` 지원 |
| 지원 범위 | 모든 DBMS | SQL:1999 이후 표준, 거의 모든 DBMS |

인라인 뷰가 한 두 단계일 때는 충분하다. 세 단계 이상 중첩되거나 같은 서브쿼리를 여러 번 참조한다면 CTE로 교체하는 것이 좋다.

---

## 옵티마이저의 뷰 병합(View Merging)

옵티마이저는 인라인 뷰를 경우에 따라 외부 쿼리와 합쳐 하나의 쿼리 블록으로 최적화한다. 이를 **뷰 병합(view merging)** 또는 **서브쿼리 평탄화(subquery flattening)** 라고 한다.

```sql
-- 옵티마이저가 이 쿼리를
SELECT name FROM (SELECT name FROM employees WHERE dept = 'IT') v;

-- 아래와 동일하게 처리할 수 있음
SELECT name FROM employees WHERE dept = 'IT';
```

집계(`GROUP BY`, `DISTINCT`), `ROWNUM`(Oracle), `LIMIT`, 윈도우 함수 등이 포함된 인라인 뷰는 병합이 불가능하다. 이 경우 옵티마이저는 인라인 뷰를 임시 결과로 먼저 구체화(materialize)한 뒤 외부 쿼리가 이를 참조하는 방식으로 처리한다.

---

## 실무 패턴 정리

```sql
-- 패턴 1: 윈도우 함수 결과에 필터링
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn
    FROM employees
) ranked
WHERE rn = 1;   -- 부서별 최고 급여자

-- 패턴 2: 집계 결과를 다시 집계 (집계의 집계)
SELECT AVG(dept_avg) AS company_avg_of_dept_avgs
FROM (
    SELECT dept, AVG(salary) AS dept_avg
    FROM employees
    GROUP BY dept
) dept_summary;
```

인라인 뷰는 서브쿼리의 결과에 추가 조건이나 가공이 필요할 때마다 자연스럽게 사용된다. 쿼리가 복잡해지는 시점에서 CTE로 전환을 고려한다.

---

**지난 글:** [스칼라 서브쿼리 — 단일 값 반환과 성능](/posts/sql-scalar-subquery/)

**다음 글:** [상관 서브쿼리 — 외부 쿼리를 참조하는 서브쿼리](/posts/sql-correlated-subquery/)

<br>
읽어주셔서 감사합니다. 😊
