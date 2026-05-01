---
title: "CTE — WITH 절로 쿼리를 구조화하기"
description: "WITH 절(공통 테이블 표현식, CTE)의 문법과 실행 흐름, 다중 CTE 체인, 인라인 뷰와의 차이, 구체화 vs 인라인 전개, DML에서의 활용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["sql", "cte", "with-clause", "common-table-expression", "가독성", "구체화", "materialization"]
featured: false
draft: false
---

[지난 글](/posts/sql-any-all-some/)에서 ANY, ALL, SOME 집합 비교 연산자를 다뤘다. 이번에는 복잡한 쿼리를 이름 있는 단계로 분리해 가독성과 재사용성을 높이는 **CTE(Common Table Expression, 공통 테이블 표현식)** 를 살펴본다. WITH 절이라고도 부르며, SQL:1999 표준에 포함된 이후 거의 모든 현대 DBMS에서 지원한다.

---

## CTE 기본 문법

```sql
WITH cte_name AS (
    SELECT ...
    FROM ...
    WHERE ...
)
SELECT *
FROM cte_name;
```

CTE는 메인 SELECT 앞에 `WITH` 키워드로 시작한다. 이름을 붙인 서브쿼리라고 생각하면 된다. 단, 인라인 뷰와 달리 선언부가 쿼리 맨 앞에 모여 있어 읽기가 쉽다.

---

## 다중 CTE — 단계적 분해

여러 CTE를 콤마로 연결하면 앞서 정의한 CTE를 뒤 CTE에서 참조할 수 있다.

```sql
WITH
dept_avg AS (
    SELECT dept, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY dept
),
high_earners AS (
    SELECT e.name, e.dept, e.salary, da.avg_sal
    FROM employees e
    JOIN dept_avg da USING (dept)
    WHERE e.salary > da.avg_sal
)
SELECT name, dept, salary, avg_sal
FROM high_earners
ORDER BY salary DESC;
```

`high_earners`가 `dept_avg`를 참조한다. 논리적 단계가 위에서 아래로 선형적으로 흐르기 때문에 복잡한 집계도 쉽게 추적할 수 있다.

![CTE 구조와 실행 흐름](/assets/posts/sql-cte-with-clause-structure.svg)

---

## 인라인 뷰 vs CTE

동일한 논리를 인라인 뷰로 쓰면 중첩 깊이가 늘어난다.

```sql
-- 인라인 뷰: 중첩 구조
SELECT name, dept, salary, avg_sal
FROM (
    SELECT e.name, e.dept, e.salary, da.avg_sal
    FROM employees e
    JOIN (
        SELECT dept, AVG(salary) AS avg_sal
        FROM employees GROUP BY dept
    ) da USING (dept)
    WHERE e.salary > da.avg_sal
) t
ORDER BY salary DESC;

-- CTE: 선형 구조 → 읽기 쉬움
WITH dept_avg AS (...),
     high_earners AS (...)
SELECT ...;
```

CTE의 또 다른 장점은 **재사용**이다. 같은 서브쿼리를 여러 번 참조할 때 CTE는 한 번만 선언하면 된다.

---

## 구체화(Materialization) vs 인라인 전개

DBMS마다 CTE를 처리하는 방식이 다르다.

![CTE 구체화 vs 인라인 전개](/assets/posts/sql-cte-with-clause-materialization.svg)

**구체화**: CTE를 먼저 실행해 결과를 임시 저장소에 저장한 뒤 외부 쿼리가 사용한다. PostgreSQL의 기본 동작(12 이전)이었으며, CTE를 여러 번 참조할 때 1회 계산이 보장된다. 단점은 외부 WHERE 조건이 CTE 안으로 밀어넣어지지 않아(push down 불가) 불필요한 행을 모두 계산한다.

**인라인 전개**: CTE를 인라인 뷰처럼 외부 쿼리와 합쳐 옵티마이저가 전체 쿼리를 최적화한다. Oracle의 기본 동작이며, 외부 조건 push down이 가능해 더 효율적인 계획이 나올 수 있다.

```sql
-- PostgreSQL 12+: 구체화 강제
WITH t AS MATERIALIZED (SELECT ...)
SELECT * FROM t WHERE id = 1;

-- PostgreSQL 12+: 인라인 강제
WITH t AS NOT MATERIALIZED (SELECT ...)
SELECT * FROM t WHERE id = 1;
```

단순 필터/조인 CTE라면 `NOT MATERIALIZED`(인라인)가 유리하고, CTE를 여러 번 참조하거나 CTE 자체가 무거운 집계라면 `MATERIALIZED`가 유리하다.

---

## DML에서 CTE 활용

CTE는 SELECT 외에도 INSERT, UPDATE, DELETE, MERGE 앞에 붙일 수 있다.

```sql
-- UPDATE: 집계 결과로 갱신
WITH dept_avg AS (
    SELECT dept, AVG(salary) AS avg_sal
    FROM employees GROUP BY dept
)
UPDATE employees e
SET benchmark = da.avg_sal
FROM dept_avg da
WHERE e.dept = da.dept;

-- DELETE: 오래된 주문 삭제
WITH old_orders AS (
    SELECT id FROM orders WHERE created_at < CURRENT_DATE - INTERVAL '1 year'
)
DELETE FROM orders WHERE id IN (SELECT id FROM old_orders);
```

---

## CTE 활용 체크리스트

| 상황 | CTE 권장 이유 |
|---|---|
| 윈도우 함수 결과에 WHERE 필요 | 인라인 뷰보다 가독성 높음 |
| 같은 서브쿼리를 여러 번 참조 | 한 번 선언, 재사용 |
| 3단계 이상 집계 파이프라인 | 선형 읽기로 이해 쉬움 |
| 재귀 계층 구조 탐색 | RECURSIVE CTE만 가능 |
| 간단한 1회용 필터 | 인라인 뷰로도 충분 |

---

**지난 글:** [ANY · ALL · SOME — 집합 비교 연산자](/posts/sql-any-all-some/)

**다음 글:** [재귀 CTE — 계층 구조와 그래프 순회](/posts/sql-recursive-cte/)

<br>
읽어주셔서 감사합니다. 😊
