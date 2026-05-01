---
title: "ANY · ALL · SOME — 집합 비교 연산자"
description: "서브쿼리 결과 집합과 스칼라 값을 비교하는 ANY, ALL, SOME의 동작 원리, IN/MAX/MIN과의 동치 관계, NULL 처리 주의 사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "any", "all", "some", "subquery", "집합비교", "null"]
featured: false
draft: false
---

[지난 글](/posts/sql-exists-not-exists/)에서 EXISTS와 NOT EXISTS의 단락 평가와 NULL 함정을 다뤘다. 이번에는 서브쿼리 결과 집합과 단일 값을 비교하는 **ANY, ALL, SOME** 연산자를 살펴본다. 실무에서는 드물게 쓰이지만 IN, MAX, MIN과의 관계를 이해하면 쿼리를 더 명확하게 읽고 쓸 수 있다.

---

## ANY / SOME — 집합 중 하나라도 만족

`value op ANY (subquery)` 형태로 쓰며, 서브쿼리 결과 집합 중 **하나라도** 조건을 만족하면 TRUE를 반환한다. SOME은 ANY의 완전한 동의어다.

```sql
-- 어느 한 부서의 평균보다 급여가 높은 직원
SELECT name, salary
FROM employees
WHERE salary > ANY (
    SELECT AVG(salary) FROM employees GROUP BY dept
);
```

이 쿼리는 "적어도 하나의 부서 평균보다 급여가 높은 직원"을 찾는다. 모든 부서 평균 중 최솟값보다 크면 조건을 만족한다.

![ANY / ALL / SOME 개요](/assets/posts/sql-any-all-some-overview.svg)

---

## ALL — 집합의 모두 만족

`value op ALL (subquery)` 형태로 쓰며, 서브쿼리 결과 집합의 **모든 값**에 대해 조건을 만족할 때만 TRUE를 반환한다.

```sql
-- 모든 부서 평균보다 급여가 높은 직원
SELECT name, salary
FROM employees
WHERE salary > ALL (
    SELECT AVG(salary) FROM employees GROUP BY dept
);
```

모든 부서 평균 중 최댓값보다 높아야 조건을 만족한다. 결과적으로 "회사 전체에서 가장 급여가 높은 부서의 평균보다도 높은 직원"을 찾는다.

---

## IN, MAX, MIN과의 동치 관계

ANY와 ALL은 집계함수로 동치 변환이 가능하고, 대개 집계함수를 쓰는 쪽이 더 직관적이다.

```sql
-- = ANY는 IN과 동치
WHERE id = ANY (SELECT id FROM vip_customers)
-- 동일:
WHERE id IN (SELECT id FROM vip_customers)

-- > ALL은 MAX()보다 큰 것과 동치
WHERE salary > ALL (SELECT AVG(salary) FROM employees GROUP BY dept)
-- 동일:
WHERE salary > (SELECT MAX(AVG(salary)) FROM employees GROUP BY dept)

-- < ANY는 MIN()보다 작은 것과 동치
WHERE price < ANY (SELECT list_price FROM products WHERE category = 'A')
-- 동일:
WHERE price < (SELECT MIN(list_price) FROM products WHERE category = 'A')
```

가독성 측면에서는 `> ALL` 대신 `> (SELECT MAX(…))`를, `= ANY` 대신 `IN`을 쓰는 것이 팀원과의 소통에 더 유리하다.

---

## NULL 처리 주의

ANY와 ALL 모두 서브쿼리 결과에 NULL이 포함되면 예상치 못한 동작이 발생한다.

![ANY / ALL NULL 동작](/assets/posts/sql-any-all-some-null.svg)

**`= ANY` (IN과 동치)**: 비교값이 집합에 없고 집합에 NULL이 있으면 UNKNOWN → 행 제외. IN과 동일한 동작이다.

**`> ALL` (> MAX 동치)**: 집합에 NULL이 하나라도 있으면 `value > NULL`이 UNKNOWN → AND 전체가 UNKNOWN → 공집합.

```sql
-- ✗ dept_avg에 NULL이 섞이면 공집합 반환 위험
WHERE salary > ALL (
    SELECT AVG(salary) FROM employees GROUP BY dept
)

-- ✓ NULL 제거 후 비교
WHERE salary > ALL (
    SELECT AVG(salary) FROM employees GROUP BY dept HAVING AVG(salary) IS NOT NULL
)

-- ✓ MAX()로 대체 (MAX는 NULL 자동 무시)
WHERE salary > (
    SELECT MAX(AVG(salary)) FROM employees GROUP BY dept
)
```

---

## 실무 활용 가이드

ANY/ALL/SOME은 표준 SQL에 명시된 연산자지만 실무 코드에서 자주 보이지 않는 이유가 있다. 동치 표현이 더 읽기 쉽고, NULL 처리 실수가 줄어들기 때문이다.

```sql
-- 권장: 명확한 의도
WHERE salary > (SELECT MAX(dept_avg) FROM (...) t)  -- > ALL 대신
WHERE id IN (SELECT id FROM vip_customers)          -- = ANY 대신

-- 사용 가능한 경우: 범위 비교 명시
WHERE score BETWEEN ANY (...) -- 비표준, 대부분 DBMS 미지원
WHERE score >= ANY (SELECT threshold FROM rules)     -- 최소 기준 중 하나 이상 충족
```

| 연산자 | 의미 | 권장 대체 |
|---|---|---|
| `= ANY (subq)` | IN과 동일 | `IN (subq)` |
| `<> ALL (subq)` | NOT IN과 동일 | `NOT EXISTS` (NULL 안전) |
| `> ALL (subq)` | > MAX | `> (SELECT MAX …)` |
| `< ANY (subq)` | < MIN | `< (SELECT MIN …)` |

---

**지난 글:** [EXISTS와 NOT EXISTS — 반존재 조건 처리](/posts/sql-exists-not-exists/)

**다음 글:** [CTE — WITH 절로 쿼리를 구조화하기](/posts/sql-cte-with-clause/)

<br>
읽어주셔서 감사합니다. 😊
