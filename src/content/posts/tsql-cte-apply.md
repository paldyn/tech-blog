---
title: "T-SQL CTE와 APPLY 연산자 — 재사용 가능한 쿼리 작성법"
description: "T-SQL WITH CTE 문법, 다중 CTE, 재귀 CTE(조직도·경로 탐색), CROSS APPLY와 OUTER APPLY 차이, 테이블 함수 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "TSQL", "CTE", "APPLY", "재귀CTE", "CROSSAPPLY", "OUTERAPPLY"]
featured: false
draft: false
---

[지난 글](/posts/tsql-variables-control-trycatch/)에서 T-SQL 변수와 제어흐름을 살펴봤다. 이번 글에서는 복잡한 쿼리를 구조화하는 **CTE(Common Table Expression)**와 행별로 함수를 적용하는 **APPLY 연산자**를 다룬다. 두 기능 모두 서브쿼리를 대체하는 강력한 도구다.

## CTE — 쿼리 이름 붙이기

CTE(`WITH` 절)는 한 쿼리 안에서만 유효한 **이름 붙은 임시 결과 집합**이다. 서브쿼리를 여러 번 재사용하거나 가독성을 높이는 데 효과적이다.

```sql
-- 기본 CTE 구조
WITH CTE_이름 AS (
    SELECT ...
)
SELECT * FROM CTE_이름
WHERE ...;
```

주의: CTE는 하나의 쿼리에서만 유효하다. `WITH` 절 바로 다음 하나의 SELECT/INSERT/UPDATE/DELETE만 참조할 수 있다.

```sql
-- 다중 CTE (콤마로 구분)
WITH
    ActiveCustomers AS (
        SELECT id, name FROM customers WHERE active = 1
    ),
    RecentOrders AS (
        SELECT customer_id, SUM(amount) total_amount
        FROM orders
        WHERE order_date >= DATEADD(MONTH, -3, GETDATE())
        GROUP BY customer_id
    )
SELECT c.name, r.total_amount
FROM ActiveCustomers c
LEFT JOIN RecentOrders r ON c.id = r.customer_id
ORDER BY r.total_amount DESC;
```

![CTE 구조와 재귀 CTE](/assets/posts/tsql-cte-apply-cte.svg)

## 재귀 CTE

재귀 CTE는 **앵커 멤버 + UNION ALL + 재귀 멤버** 구조로 이루어진다. 계층 구조(조직도, 카테고리 트리, 경로 탐색)에 사용된다.

```sql
-- 조직 계층 탐색 (부서장 → 팀원)
WITH OrgTree AS (
    -- 앵커: 최상위 관리자 (manager가 없는 사람)
    SELECT
        id, name, manager_id, 0 AS level,
        CAST(name AS NVARCHAR(MAX)) AS path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- 재귀: 각 관리자의 직속 부하
    SELECT
        e.id, e.name, e.manager_id,
        t.level + 1,
        CAST(t.path + N' > ' + e.name AS NVARCHAR(MAX))
    FROM employees e
    JOIN OrgTree t ON e.manager_id = t.id
)
SELECT
    REPLICATE(N'  ', level) + name AS indent_name,
    level,
    path
FROM OrgTree
ORDER BY path
OPTION (MAXRECURSION 50);   -- 기본 100, 0은 무제한 (무한루프 위험)
```

```sql
-- 숫자 시퀀스 생성 (1~100)
WITH Numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM Numbers WHERE n < 100
)
SELECT n FROM Numbers
OPTION (MAXRECURSION 100);

-- 날짜 시리즈 생성 (이번 달 1일~말일)
WITH Dates AS (
    SELECT CAST(DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) AS DATE) AS d
    UNION ALL
    SELECT DATEADD(DAY, 1, d) FROM Dates
    WHERE d < EOMONTH(GETDATE())
)
SELECT d FROM Dates;
```

## APPLY 연산자

`APPLY`는 외부 테이블의 각 행에 테이블 함수나 서브쿼리를 **행별로 적용**하는 연산자다. 표준 SQL에는 없는 T-SQL 전용 기능이다.

- **CROSS APPLY**: 함수 결과가 없는 행은 제외 (INNER JOIN 유사)
- **OUTER APPLY**: 함수 결과가 없는 행도 NULL로 포함 (LEFT JOIN 유사)

![CROSS APPLY vs OUTER APPLY](/assets/posts/tsql-cte-apply-apply.svg)

```sql
-- CROSS APPLY: 각 고객의 최신 3개 주문 조회
SELECT c.id, c.name, top_orders.order_id, top_orders.amount
FROM customers c
CROSS APPLY (
    SELECT TOP 3 order_id, amount
    FROM orders o
    WHERE o.customer_id = c.id     -- 외부 테이블 컬럼 참조 가능!
    ORDER BY order_date DESC
) top_orders
ORDER BY c.id, top_orders.amount DESC;

-- OUTER APPLY: 주문 없는 고객도 포함
SELECT c.id, c.name, top_orders.order_id
FROM customers c
OUTER APPLY (
    SELECT TOP 1 order_id, amount
    FROM orders o
    WHERE o.customer_id = c.id
    ORDER BY order_date DESC
) top_orders;
```

## 테이블 함수와 APPLY

`APPLY`는 테이블 함수(TVF)와 함께 쓸 때 특히 강력하다.

```sql
-- 인라인 테이블 함수 정의
CREATE OR ALTER FUNCTION dbo.GetTopNOrders
    (@customer_id INT, @n INT)
RETURNS TABLE
AS RETURN (
    SELECT TOP (@n) order_id, amount, order_date
    FROM orders
    WHERE customer_id = @customer_id
    ORDER BY order_date DESC
);
GO

-- APPLY로 함수 적용
SELECT c.name, o.order_id, o.amount
FROM customers c
CROSS APPLY dbo.GetTopNOrders(c.id, 5) o
ORDER BY c.name, o.order_date DESC;
```

## 문자열 파싱 — STRING_SPLIT과 APPLY

```sql
-- CSV 문자열을 행으로 분리 (STRING_SPLIT: SQL Server 2016+)
SELECT
    cs.CustomerID,
    cs.Tags,
    tag.value AS single_tag
FROM CustomerSegments cs
CROSS APPLY STRING_SPLIT(cs.Tags, ',') tag
WHERE tag.value LIKE '%premium%';

-- OPENJSON으로 JSON 배열 펼치기
DECLARE @json NVARCHAR(MAX) = N'[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]';

SELECT j.id, j.name
FROM OPENJSON(@json)
WITH (
    id   INT          '$.id',
    name NVARCHAR(50) '$.name'
) j;
```

## CTE와 DML

CTE는 SELECT뿐 아니라 INSERT/UPDATE/DELETE에도 사용할 수 있다.

```sql
-- CTE를 이용한 조건부 DELETE (중복 제거)
WITH Duplicates AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at) AS rn
    FROM customers
)
DELETE FROM Duplicates WHERE rn > 1;

-- CTE를 이용한 집계 UPDATE
WITH OrderSummary AS (
    SELECT customer_id, SUM(amount) AS total
    FROM orders
    GROUP BY customer_id
)
UPDATE c
SET c.lifetime_value = os.total
FROM customers c
JOIN OrderSummary os ON c.id = os.customer_id;
```

CTE와 APPLY는 복잡한 서브쿼리를 읽기 쉽고 유지보수하기 좋은 형태로 바꿔준다. 다음 글에서는 T-SQL의 MERGE 문을 살펴본다.

---

**지난 글:** [T-SQL 변수·제어흐름·TRY...CATCH](/posts/tsql-variables-control-trycatch/)

**다음 글:** [T-SQL MERGE 문 — Upsert 완전 가이드](/posts/tsql-merge/)

<br>
읽어주셔서 감사합니다. 😊
