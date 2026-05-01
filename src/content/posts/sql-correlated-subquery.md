---
title: "상관 서브쿼리 — 외부 쿼리를 참조하는 서브쿼리"
description: "외부 쿼리의 컬럼을 참조하는 상관 서브쿼리의 실행 원리, 성능 문제, JOIN/CTE로의 재작성 전략, EXISTS·UPDATE·DELETE 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "correlated-subquery", "exists", "subquery", "성능", "join", "최적화"]
featured: false
draft: false
---

[지난 글](/posts/sql-inline-view/)에서 FROM 절 서브쿼리인 인라인 뷰를 다뤘다. 이번에는 외부 쿼리의 컬럼을 직접 참조하는 **상관 서브쿼리(correlated subquery)** 를 살펴본다. 강력하지만 대용량 데이터에서 심각한 성능 문제를 일으킬 수 있어 원리를 정확히 이해해야 한다.

---

## 상관 서브쿼리란

상관 서브쿼리는 외부 쿼리(outer query)의 컬럼을 서브쿼리 안에서 참조한다. 외부 쿼리와 **독립적으로 실행될 수 없고**, 외부 쿼리의 각 행에 대해 반복 실행된다.

```sql
-- e.dept가 외부 쿼리 employees의 컬럼 → 상관 서브쿼리
SELECT e.name, e.salary
FROM employees e
WHERE e.salary > (
    SELECT AVG(salary)
    FROM employees
    WHERE dept = e.dept    -- 외부 쿼리 컬럼 참조
);
```

이 쿼리는 "자기 부서 평균 급여보다 많이 받는 직원"을 찾는다. 외부 쿼리의 각 행이 처리될 때마다 서브쿼리가 해당 `e.dept` 값으로 재실행된다.

![상관 서브쿼리 실행 흐름](/assets/posts/sql-correlated-subquery-execution.svg)

---

## 실행 비용 — 행마다 서브쿼리 재실행

employees가 N행이면 서브쿼리도 최대 N번 실행된다. 인덱스가 있어도 함수 호출과 I/O가 누적된다.

```
행 1: Alice, dept='IT' → SELECT AVG(salary) FROM employees WHERE dept='IT' → 실행
행 2: Bob,   dept='HR' → SELECT AVG(salary) FROM employees WHERE dept='HR' → 실행
행 3: Carol, dept='IT' → SELECT AVG(salary) FROM employees WHERE dept='IT' → 재실행
...
```

**Oracle**은 스칼라 서브쿼리 캐싱(결과 해시 캐시)으로 동일 입력값 재실행을 피하지만, 카디널리티가 높으면 캐시 히트율이 낮다. **PostgreSQL**은 상관 서브쿼리를 `SubPlan`으로 처리하며, 일부는 해시 조인으로 자동 변환한다.

---

## JOIN으로 재작성

상관 서브쿼리 대부분은 JOIN으로 재작성해 성능을 개선할 수 있다.

```sql
-- ✗ 상관 서브쿼리: N번 실행
SELECT e.name, e.salary
FROM employees e
WHERE e.salary > (
    SELECT AVG(salary) FROM employees WHERE dept = e.dept
);

-- ✓ 인라인 뷰 + JOIN: 집계 1회
SELECT e.name, e.salary
FROM employees e
JOIN (
    SELECT dept, AVG(salary) AS dept_avg
    FROM employees
    GROUP BY dept
) da ON da.dept = e.dept
WHERE e.salary > da.dept_avg;
```

집계를 한 번 수행하고 해시 조인으로 결합하므로 O(N) 처리다.

---

## 상관 서브쿼리가 유용한 경우

모든 상관 서브쿼리가 나쁜 것은 아니다. 아래 상황에서는 상관 서브쿼리가 간결하고 효율적이다.

**EXISTS / NOT EXISTS** — 존재 여부만 확인하면 첫 행 발견 즉시 중단한다.

```sql
-- 주문이 있는 고객만 조회
SELECT c.name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

**소규모 데이터** — 외부 쿼리 행 수가 적다면 성능 부담이 없다.

**UPDATE/DELETE** — DML에서 다른 테이블 값을 참조할 때 자주 쓰인다.

![상관 서브쿼리 활용 패턴](/assets/posts/sql-correlated-subquery-patterns.svg)

---

## 상관 서브쿼리 위치별 동작

```sql
-- WHERE 절: 행 필터링에 사용
SELECT * FROM orders o
WHERE o.amount > (SELECT AVG(amount) FROM orders WHERE customer_id = o.customer_id);

-- SELECT 절: 스칼라 서브쿼리로 컬럼 추가
SELECT e.name,
       (SELECT COUNT(*) FROM orders WHERE customer_id = e.id) AS order_cnt
FROM employees e;

-- HAVING 절: 집계 결과 필터링
SELECT dept, COUNT(*) AS cnt
FROM employees
GROUP BY dept
HAVING COUNT(*) > (SELECT AVG(dept_cnt) FROM (
    SELECT dept, COUNT(*) AS dept_cnt FROM employees GROUP BY dept
) t);
```

---

## 최적화 결정 기준

| 상황 | 권장 |
|---|---|
| 단순 존재 확인 | `EXISTS` (상관 서브쿼리 OK) |
| 집계 결과 비교, 대규모 | JOIN으로 재작성 |
| SELECT 절 참조값 추가 | LEFT JOIN으로 재작성 |
| UPDATE/DELETE 소량 | 상관 서브쿼리 OK |
| UPDATE/DELETE 대량 | JOIN-UPDATE/DELETE 사용 |

실행 계획(`EXPLAIN`)에서 `SubPlan`, `Nested Loop`, `Filter` 등을 확인해 의도치 않은 반복 실행이 없는지 검증한다.

---

**지난 글:** [인라인 뷰 — FROM 절 서브쿼리 활용](/posts/sql-inline-view/)

**다음 글:** [EXISTS와 NOT EXISTS — 반존재 조건 처리](/posts/sql-exists-not-exists/)

<br>
읽어주셔서 감사합니다. 😊
