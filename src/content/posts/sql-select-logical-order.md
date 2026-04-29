---
title: "SELECT의 논리적 실행 순서"
description: "SQL SELECT 문이 실제로 어떤 순서로 처리되는지, 왜 WHERE에서 SELECT 별칭을 쓸 수 없는지, FROM부터 LIMIT까지 각 절의 역할과 가시 범위를 명확하게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "select", "logical-order", "from", "where", "group-by", "having", "order-by", "limit"]
featured: false
draft: false
---

[지난 글](/posts/sql-returning-output/)에서 DML 결과를 즉시 돌려받는 RETURNING을 살펴봤다. 이번에는 쿼리를 올바르게 작성하기 위해 반드시 알아야 할 SELECT의 논리적 실행 순서를 다룬다.

---

## 작성 순서 ≠ 실행 순서

SQL 쿼리는 작성하는 순서와 실제로 처리되는 순서가 다르다. 이 차이를 이해하지 못하면 "왜 에러가 나지?" 하는 상황이 계속 생긴다.

**작성 순서:**
```sql
SELECT dept, COUNT(*) cnt
FROM employees
WHERE hire_year >= 2020
GROUP BY dept
HAVING COUNT(*) >= 3
ORDER BY cnt DESC
LIMIT 5;
```

**논리적 실행 순서:**

| 순서 | 절 | 역할 |
|---|---|---|
| ① | FROM / JOIN | 원본 행 집합 구성 |
| ② | WHERE | 행 수준 필터링 |
| ③ | GROUP BY | 그룹화 |
| ④ | HAVING | 그룹 수준 필터링 |
| ⑤ | SELECT | 컬럼 선택, 표현식 평가, 별칭 정의 |
| ⑥ | DISTINCT | 중복 제거 |
| ⑦ | ORDER BY | 정렬 |
| ⑧ | LIMIT / OFFSET | 행 수 제한 |

![SELECT 논리적 실행 파이프라인](/assets/posts/sql-select-logical-order-pipeline.svg)

---

## 각 절 상세

### ① FROM / JOIN

가장 먼저 실행된다. 테이블을 읽고 JOIN을 수행해 이후 모든 처리의 기반이 될 행 집합을 만든다. 서브쿼리나 CTE가 FROM에 있으면 이 단계에서 먼저 평가된다.

```sql
-- FROM의 서브쿼리(인라인 뷰)도 이 단계에서 평가
SELECT *
FROM (SELECT id, name FROM users WHERE active = true) AS active_users
WHERE name LIKE 'K%';
```

### ② WHERE

FROM에서 만들어진 행 집합에서 조건에 맞지 않는 행을 제거한다. **이 시점에서 SELECT는 아직 실행되지 않았으므로, SELECT에서 정의한 별칭을 WHERE에서 쓸 수 없다.**

```sql
-- ✗ 에러
SELECT amount * 1.1 AS total
FROM orders
WHERE total > 10000;  -- 'total' column does not exist

-- ✓ 정상
SELECT amount * 1.1 AS total
FROM orders
WHERE amount * 1.1 > 10000;  -- 표현식을 그대로 반복
```

집계 함수도 WHERE에서 사용할 수 없다. 집계는 GROUP BY 이후에 계산되기 때문이다.

### ③ GROUP BY

WHERE를 통과한 행들을 지정된 컬럼 기준으로 묶는다. GROUP BY 이후에는 그룹 전체가 하나의 단위가 된다. GROUP BY에 포함되지 않은 컬럼은 SELECT에서 집계 함수 없이 단독으로 쓸 수 없다.

```sql
-- ✗ GROUP BY 없이 집계와 일반 컬럼 혼합
SELECT dept, name, COUNT(*)  -- name이 어느 직원 값인가?
FROM employees
GROUP BY dept;
```

### ④ HAVING

GROUP BY로 만들어진 그룹에 조건을 적용한다. 집계 함수를 사용할 수 있다는 점이 WHERE와 결정적 차이다.

```sql
-- WHERE는 행 필터, HAVING은 그룹 필터
SELECT dept, AVG(salary) avg_sal
FROM employees
WHERE hire_year >= 2020     -- ② WHERE: 행 단위 필터
GROUP BY dept               -- ③ GROUP BY
HAVING AVG(salary) > 50000; -- ④ HAVING: 집계 후 그룹 필터
```

`WHERE`로 처리할 수 있는 조건은 `HAVING`에 쓰지 않는다. `WHERE`가 먼저 실행되어 그룹화할 행 수를 줄이므로 성능이 더 좋다.

### ⑤ SELECT

이 시점에서야 컬럼 목록이 평가된다. 표현식을 계산하고 별칭을 정의한다. `*`은 모든 컬럼을 의미한다.

### ⑥ DISTINCT

SELECT 결과에서 중복 행을 제거한다. 내부적으로 정렬이나 해시를 사용하므로 비용이 있다.

### ⑦ ORDER BY

SELECT의 별칭을 포함해 결과를 정렬할 수 있다. SELECT 이후에 실행되기 때문이다.

```sql
-- ORDER BY에서 SELECT 별칭 사용 가능
SELECT dept, COUNT(*) AS cnt
FROM employees
GROUP BY dept
ORDER BY cnt DESC;  -- 'cnt' 별칭 정상 동작
```

### ⑧ LIMIT / OFFSET

마지막으로 반환할 행 수를 제한한다. 정렬된 결과에서 앞 N개를 가져오려면 ORDER BY와 함께 사용해야 의미가 있다.

---

## 가시 범위 정리

![각 절의 가시 범위와 흔한 실수](/assets/posts/sql-select-logical-order-scope.svg)

---

## 왜 이 순서를 알아야 하는가

1. **에러 원인 진단** — "column does not exist"나 "aggregates not allowed in WHERE" 메시지가 왜 나오는지 즉시 이해된다.
2. **성능 최적화** — WHERE를 최대한 좁혀서 GROUP BY와 ORDER BY가 처리할 행 수를 줄인다.
3. **올바른 쿼리 작성** — 각 절에서 무엇을 참조할 수 있는지 알면 불필요한 시행착오가 없다.

논리적 실행 순서는 표준 SQL의 명세이며, DBMS가 실제로 이 순서 그대로 처리하는지와는 별개다. 옵티마이저는 결과가 동일하다면 순서를 바꿔 실행할 수 있다. 하지만 **결과의 정확성을 논증하는 기준**은 항상 논리적 순서다.

---

**지난 글:** [RETURNING / OUTPUT — DML 결과를 즉시 돌려받기](/posts/sql-returning-output/)

**다음 글:** [WHERE 절과 비교 연산자](/posts/sql-where-comparison/)

<br>
읽어주셔서 감사합니다. 😊
