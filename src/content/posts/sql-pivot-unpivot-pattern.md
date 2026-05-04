---
title: "PIVOT · UNPIVOT 패턴"
description: "행을 열로 바꾸는 PIVOT, 열을 행으로 바꾸는 UNPIVOT의 원리, 조건부 집계(CASE WHEN) 범용 구현, SQL Server·Oracle 전용 구문, 동적 PIVOT 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "pivot", "unpivot", "crosstab", "conditional-aggregation", "case-when", "reporting"]
featured: false
draft: false
---

[지난 글](/posts/sql-union-intersect-except/)에서 집합 연산(UNION · INTERSECT · EXCEPT)을 다뤘다. 이번에는 행(row)과 열(column)의 방향을 뒤집는 **PIVOT · UNPIVOT** 패턴을 살펴본다. 리포트·분석 쿼리에서 자주 등장하지만 표준 SQL에는 전용 구문이 없어 조건부 집계로 우회하는 경우가 많다.

---

## PIVOT이란

**정규형 테이블**(한 행에 하나의 측정값)을 **크로스탭**(행의 고유값이 열 이름이 되는 형식)으로 변환하는 작업이다.

```
-- 입력 (정규형)          -- 출력 (크로스탭)
year | product | sales     year | A   | B
2024 |    A    |  120      2024 | 120 | 85
2024 |    B    |  85       2025 | 160 | 110
2025 |    A    |  160
2025 |    B    |  110
```

![PIVOT · UNPIVOT 변환 다이어그램](/assets/posts/sql-pivot-unpivot-pattern-transform.svg)

---

## 조건부 집계: 범용 PIVOT

모든 DB에서 동작하는 방법은 `CASE WHEN` + 집계 함수를 조합하는 것이다.

```sql
SELECT
    year,
    SUM(CASE WHEN product = 'A' THEN sales END) AS "A",
    SUM(CASE WHEN product = 'B' THEN sales END) AS "B",
    SUM(CASE WHEN product = 'C' THEN sales END) AS "C"
FROM sales_data
GROUP BY year
ORDER BY year;
```

`CASE WHEN`이 매칭되지 않으면 `NULL`을 반환하고, `SUM`은 `NULL`을 무시하므로 의도한 대로 집계된다. `COALESCE(..., 0)`으로 감싸면 `NULL` 대신 0을 표시할 수 있다.

---

## SQL Server · Oracle 전용 PIVOT 구문

![PIVOT 코드 비교](/assets/posts/sql-pivot-unpivot-pattern-code.svg)

```sql
-- SQL Server
SELECT year, [A], [B], [C]
FROM sales_data
PIVOT (SUM(sales)
       FOR product IN ([A], [B], [C])) AS pvt
ORDER BY year;

-- Oracle (대괄호 대신 따옴표)
SELECT year, "A", "B", "C"
FROM sales_data
PIVOT (SUM(sales)
       FOR product IN ('A' AS "A", 'B' AS "B", 'C' AS "C"))
ORDER BY year;
```

전용 구문은 코드가 간결하지만, **IN 목록을 컴파일 타임에 고정**해야 하는 단점이 있다. 컬럼 목록이 데이터에 따라 달라지는 "동적 PIVOT"은 동적 SQL로 구현해야 한다.

---

## UNPIVOT: 열 → 행 변환

크로스탭을 다시 정규형으로 되돌리는 작업이다.

```sql
-- 범용: CROSS JOIN VALUES 패턴 (PostgreSQL, MySQL 등)
SELECT
    year,
    v.product,
    CASE v.product
        WHEN 'A' THEN a_sales
        WHEN 'B' THEN b_sales
    END AS sales
FROM crosstab_data
CROSS JOIN (VALUES ('A'), ('B')) AS v(product)
WHERE CASE v.product
          WHEN 'A' THEN a_sales
          WHEN 'B' THEN b_sales
      END IS NOT NULL
ORDER BY year, v.product;
```

```sql
-- SQL Server 전용 UNPIVOT
SELECT year, product, sales
FROM crosstab_data
UNPIVOT (sales FOR product IN (A, B, C)) AS upvt;
```

---

## 동적 PIVOT

IN 목록을 쿼리 결과에서 동적으로 생성해야 할 때는 동적 SQL을 사용한다.

```sql
-- SQL Server 동적 PIVOT 예시
DECLARE @cols NVARCHAR(MAX);
DECLARE @sql  NVARCHAR(MAX);

SELECT @cols = STRING_AGG(QUOTENAME(product), ',')
FROM (SELECT DISTINCT product FROM sales_data) t;

SET @sql = N'
SELECT year, ' + @cols + N'
FROM sales_data
PIVOT (SUM(sales) FOR product IN (' + @cols + N')) pvt
ORDER BY year;';

EXEC sp_executesql @sql;
```

동적 PIVOT은 유연하지만 SQL 인젝션 위험이 있으므로 입력값 검증이 필수다.

---

## PostgreSQL: crosstab() 함수

PostgreSQL은 `tablefunc` 확장의 `crosstab()` 함수로 PIVOT을 구현할 수 있다.

```sql
-- 확장 설치 (최초 1회)
CREATE EXTENSION IF NOT EXISTS tablefunc;

-- crosstab 사용
SELECT *
FROM crosstab(
    'SELECT year, product, SUM(sales)::int
     FROM sales_data GROUP BY year, product ORDER BY 1, 2',
    'VALUES (''A''), (''B''), (''C'')'
) AS t(year int, "A" int, "B" int, "C" int);
```

---

## 실무 선택 기준

| 상황 | 추천 방법 |
|------|---------|
| DB 이식성 필요 | `CASE WHEN` 조건부 집계 |
| SQL Server / Oracle 전용 | `PIVOT` / `UNPIVOT` 구문 |
| PostgreSQL | `tablefunc.crosstab()` |
| 컬럼이 데이터에 따라 동적 | 동적 SQL (+ 입력 검증) |
| 성능 민감 | 조건부 집계 (옵티마이저 친화적) |

---

**지난 글:** [UNION · INTERSECT · EXCEPT 집합 연산](/posts/sql-union-intersect-except/)

**다음 글:** [ACID 속성 완전 이해](/posts/sql-acid-properties/)

<br>
읽어주셔서 감사합니다. 😊
