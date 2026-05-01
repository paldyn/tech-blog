---
title: "스칼라 서브쿼리 — 단일 값 반환과 성능"
description: "스칼라 서브쿼리의 개념과 허용 위치, 비상관 vs 상관 스칼라 서브쿼리의 실행 방식 차이, 성능 함정과 JOIN으로의 대체 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "scalar-subquery", "correlated-subquery", "subquery", "성능", "join"]
featured: false
draft: false
---

[지난 글](/posts/sql-distinct-aggregation/)에서 DISTINCT 집계의 비용과 대안을 살펴봤다. 이번에는 서브쿼리(subquery) 중 가장 기본적인 형태인 **스칼라 서브쿼리**를 다룬다. 정확히 한 행 한 열을 반환하며, SQL 표현식이 허용되는 곳 어디에나 쓸 수 있는 유연함이 장점이지만, 잘못 사용하면 심각한 성능 문제를 일으킨다.

---

## 스칼라 서브쿼리란

스칼라 서브쿼리는 **단일 값(scalar)** 을 반환하는 서브쿼리다. 숫자, 문자열, 날짜 등 단일 컬럼의 단일 행이어야 한다.

```sql
-- 전체 평균 급여를 하나의 값으로 반환
SELECT AVG(salary) FROM employees;  -- 결과: 5800000 (단일 값)
```

이 서브쿼리를 괄호로 감싸 표현식 자리에 삽입하면 스칼라 서브쿼리가 된다.

```sql
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) AS avg_salary
FROM employees;
```

반환 행이 0개이면 NULL, 2개 이상이면 런타임 에러가 발생한다.

![스칼라 서브쿼리 개요](/assets/posts/sql-scalar-subquery-overview.svg)

---

## 사용 가능한 위치

스칼라 서브쿼리는 단일 값이 허용되는 곳이라면 어디에나 쓸 수 있다.

```sql
-- SELECT 절: 각 행에 계산값 추가
SELECT name,
       (SELECT MAX(score) FROM exams WHERE student_id = s.id) AS best_score
FROM students s;

-- WHERE 절: 최대값과 같은 행 찾기
SELECT * FROM orders
WHERE amount = (SELECT MAX(amount) FROM orders);

-- HAVING 절: 그룹 집계와 전체 평균 비교
SELECT dept, AVG(salary)
FROM employees
GROUP BY dept
HAVING AVG(salary) > (SELECT AVG(salary) FROM employees);

-- UPDATE SET: 다른 테이블 값으로 갱신
UPDATE products p
SET price = (SELECT AVG(price) FROM market_prices WHERE product_id = p.id)
WHERE p.id = 42;
```

---

## 비상관 vs 상관 스칼라 서브쿼리

**비상관(non-correlated)** 스칼라 서브쿼리는 외부 쿼리를 참조하지 않는다. 외부 쿼리와 독립적으로 딱 한 번 실행되고 결과가 캐시된다.

```sql
-- 비상관: (SELECT AVG(salary) FROM employees)는 1회만 실행
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) AS avg_all
FROM employees;
```

**상관(correlated)** 스칼라 서브쿼리는 외부 쿼리의 컬럼을 참조한다. 외부 쿼리의 **행마다** 서브쿼리가 실행된다.

```sql
-- 상관: 행마다 dept_name 서브쿼리가 실행됨
SELECT e.name, e.dept_id,
       (SELECT d.name FROM departments d WHERE d.id = e.dept_id) AS dept_name
FROM employees e;
```

employees 행이 10,000개라면 departments 서브쿼리도 최대 10,000번 실행된다. 인덱스가 있어도 함수 호출 오버헤드가 누적된다.

![스칼라 서브쿼리 성능 비교](/assets/posts/sql-scalar-subquery-performance.svg)

---

## 상관 스칼라 서브쿼리 → JOIN으로 변환

SELECT 절의 상관 스칼라 서브쿼리는 대부분 LEFT JOIN으로 대체할 수 있고, 성능이 크게 향상된다.

```sql
-- ✗ 행마다 실행
SELECT o.order_id,
       (SELECT c.name FROM customers c WHERE c.id = o.customer_id) AS cname
FROM orders o;

-- ✓ 1회 해시 조인
SELECT o.order_id, c.name AS cname
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id;
```

단, 서브쿼리 안에 집계가 포함된 경우는 GROUP BY를 포함한 서브쿼리를 JOIN하거나 CTE로 분리한다.

```sql
-- ✗ 행마다 SUM 계산
SELECT c.name,
       (SELECT SUM(amount) FROM orders WHERE customer_id = c.id) AS total
FROM customers c;

-- ✓ 집계를 먼저 하고 JOIN
SELECT c.name, COALESCE(o.total, 0) AS total
FROM customers c
LEFT JOIN (
    SELECT customer_id, SUM(amount) AS total
    FROM orders
    GROUP BY customer_id
) o ON o.customer_id = c.id;
```

---

## 옵티마이저의 자동 변환

최신 DBMS는 일부 상관 스칼라 서브쿼리를 자동으로 JOIN 또는 세미조인으로 변환한다.

- **Oracle**: 스칼라 서브쿼리 캐싱 — 동일 입력값에 대해 재실행을 피함
- **PostgreSQL**: `InitPlan` / `SubPlan`으로 분리; 비상관은 InitPlan으로 1회 실행
- **SQL Server**: 적격한 상관 서브쿼리를 `Nested Loop` 또는 `Apply`로 최적화

실행 계획(EXPLAIN, EXPLAIN ANALYZE)을 통해 실제 처리 방식을 확인하는 것이 중요하다.

---

## 스칼라 서브쿼리가 유용한 경우

| 상황 | 이유 |
|---|---|
| WHERE 절 단일 집계 비교 | `WHERE x = (SELECT MAX(x) FROM t)` 간결 |
| HAVING 절 전체 집계 비교 | JOIN 없이 표현 가능 |
| 조건부 기본값 | `COALESCE((subq), default_val)` |
| DDL/DML 인라인 계산 | UPDATE SET col = (subq) |

SELECT 절에서 JOIN으로 대체 가능한 상관 서브쿼리는 JOIN으로 쓰는 것이 원칙이다. 비상관 스칼라 서브쿼리는 1회 실행이 보장되므로 자유롭게 활용할 수 있다.

---

**지난 글:** [DISTINCT 집계 — COUNT DISTINCT의 비용과 대안](/posts/sql-distinct-aggregation/)

**다음 글:** [인라인 뷰 — FROM 절 서브쿼리 활용](/posts/sql-inline-view/)

<br>
읽어주셔서 감사합니다. 😊
