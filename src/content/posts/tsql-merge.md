---
title: "T-SQL MERGE 문 — Upsert 완전 가이드"
description: "T-SQL MERGE 문의 SOURCE/TARGET/ON 구조, WHEN MATCHED/NOT MATCHED BY TARGET/NOT MATCHED BY SOURCE 절, OUTPUT 활용, 중복 SOURCE 행 함정과 안전한 사용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "TSQL", "MERGE", "Upsert", "OUTPUT", "동기화", "데이터통합"]
featured: false
draft: false
---

[지난 글](/posts/tsql-cte-apply/)에서 CTE와 APPLY 연산자를 살펴봤다. 이번 글에서는 T-SQL의 강력한 DML 구문인 **MERGE 문**을 다룬다. MERGE는 하나의 문으로 INSERT·UPDATE·DELETE를 동시에 처리할 수 있어 데이터 동기화와 Upsert 작업에 자주 사용된다.

## MERGE 기본 구조

MERGE 문은 **SOURCE**와 **TARGET**을 비교해 일치 여부에 따라 다른 DML 작업을 수행한다.

```sql
MERGE INTO target_table AS tgt
USING source_table AS src        -- 또는 서브쿼리·CTE
ON (tgt.key_col = src.key_col)   -- 일치 조건

WHEN MATCHED THEN
    UPDATE SET tgt.col1 = src.col1, tgt.col2 = src.col2

WHEN NOT MATCHED BY TARGET THEN
    INSERT (key_col, col1, col2)
    VALUES (src.key_col, src.col1, src.col2)

WHEN NOT MATCHED BY SOURCE THEN
    DELETE;   -- 세미콜론 필수!
```

![MERGE 처리 흐름](/assets/posts/tsql-merge-flowchart.svg)

## 각 절의 역할

| 절 | 조건 | 일반 동작 |
|---|---|---|
| `WHEN MATCHED` | SOURCE·TARGET 키 일치 | UPDATE 또는 DELETE |
| `WHEN NOT MATCHED [BY TARGET]` | SOURCE에만 있음 (TARGET 없음) | INSERT |
| `WHEN NOT MATCHED BY SOURCE` | TARGET에만 있음 (SOURCE 없음) | DELETE |

`WHEN MATCHED` 절은 추가 조건을 붙일 수 있다. 같은 절을 최대 2번 정의할 수 있다.

```sql
-- WHEN MATCHED를 2개: 조건에 따라 다른 동작
MERGE INTO products AS tgt
USING staging AS src ON tgt.id = src.id
WHEN MATCHED AND src.discontinued = 1 THEN
    DELETE
WHEN MATCHED AND src.price != tgt.price THEN
    UPDATE SET tgt.price = src.price,
               tgt.updated_at = SYSDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (id, name, price) VALUES (src.id, src.name, src.price);
```

## Upsert 패턴

단순 INSERT 아니면 UPDATE(Upsert)가 필요할 때 MERGE가 가장 깔끔한 해법이다.

```sql
-- 재고 Upsert
MERGE INTO inventory AS tgt
USING (VALUES (101, 50), (102, 30), (103, 0))
      AS src(product_id, qty)
ON tgt.product_id = src.product_id
WHEN MATCHED THEN
    UPDATE SET tgt.qty = src.qty,
               tgt.last_updated = SYSDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (product_id, qty, last_updated)
    VALUES (src.product_id, src.qty, SYSDATETIME());

-- 변수에서 단일 행 Upsert
DECLARE @pid INT = 101, @qty INT = 55;
MERGE INTO inventory AS tgt
USING (SELECT @pid AS product_id, @qty AS qty) AS src
ON tgt.product_id = src.product_id
WHEN MATCHED THEN
    UPDATE SET tgt.qty = src.qty
WHEN NOT MATCHED BY TARGET THEN
    INSERT (product_id, qty) VALUES (src.product_id, src.qty);
```

## OUTPUT 절 — 변경 추적

MERGE의 `OUTPUT` 절은 수행된 작업 유형과 변경 전후 값을 반환한다.

![OUTPUT 절과 주의사항](/assets/posts/tsql-merge-output.svg)

```sql
-- OUTPUT으로 영향 받은 행 추적
DECLARE @changes TABLE (
    action_type  NVARCHAR(10),
    product_id   INT,
    old_qty      INT,
    new_qty      INT,
    changed_at   DATETIME2
);

MERGE INTO inventory AS tgt
USING daily_update AS src
ON tgt.product_id = src.product_id
WHEN MATCHED THEN
    UPDATE SET tgt.qty = src.qty
WHEN NOT MATCHED BY TARGET THEN
    INSERT (product_id, qty) VALUES (src.product_id, src.qty)
WHEN NOT MATCHED BY SOURCE THEN
    DELETE
OUTPUT
    $action,
    COALESCE(inserted.product_id, deleted.product_id),
    deleted.qty,
    inserted.qty,
    SYSDATETIME()
INTO @changes;

-- 결과 확인
SELECT action_type, COUNT(*) AS cnt
FROM @changes
GROUP BY action_type;
```

## 주의사항 — 흔한 함정

### 1. SOURCE에 중복 키가 있으면 안 된다

```sql
-- 위험: daily_update에 product_id=101이 2번 있으면 오류
-- "The MERGE statement attempted to UPDATE or DELETE the same row more than once."

-- 해결: SOURCE를 집계해서 중복 제거
MERGE INTO inventory AS tgt
USING (
    SELECT product_id, SUM(qty) AS qty   -- 집계로 중복 제거
    FROM daily_update
    GROUP BY product_id
) AS src
ON tgt.product_id = src.product_id
WHEN MATCHED THEN
    UPDATE SET tgt.qty = src.qty;
```

### 2. 세미콜론 필수

```sql
-- 잘못된 예 (세미콜론 없음)
MERGE INTO t1 ...
WHEN NOT MATCHED THEN INSERT ...   -- 세미콜론 없음!
SELECT * FROM t1;  -- 이 SELECT가 MERGE의 일부로 해석되어 오류 발생

-- 올바른 예
MERGE INTO t1 ...
WHEN NOT MATCHED THEN INSERT ...;  -- 세미콜론 필수
SELECT * FROM t1;
```

### 3. MERGE vs 개별 DML 성능

소량 데이터는 MERGE가 편리하지만, 대량 데이터(수백만 행)에서는 개별 INSERT/UPDATE/DELETE가 더 유리한 경우가 있다. MERGE는 내부적으로 전체 조인을 수행하기 때문이다.

```sql
-- 대안 패턴: 조건별 분리 처리 (대용량 동기화 시)
-- 1단계: UPDATE
UPDATE tgt
SET tgt.qty = src.qty
FROM inventory tgt
JOIN daily_update src ON tgt.product_id = src.product_id
WHERE tgt.qty != src.qty;

-- 2단계: INSERT (존재하지 않는 것만)
INSERT INTO inventory (product_id, qty)
SELECT src.product_id, src.qty
FROM daily_update src
WHERE NOT EXISTS (
    SELECT 1 FROM inventory tgt
    WHERE tgt.product_id = src.product_id
);
```

## CTE를 SOURCE로 사용

```sql
-- 복잡한 변환 후 MERGE
WITH TransformedData AS (
    SELECT
        product_id,
        SUM(qty) AS total_qty,
        MAX(updated_at) AS latest_update
    FROM staging_inventory
    WHERE import_date = CAST(GETDATE() AS DATE)
    GROUP BY product_id
    HAVING SUM(qty) > 0
)
MERGE INTO inventory AS tgt
USING TransformedData AS src
ON tgt.product_id = src.product_id
WHEN MATCHED THEN
    UPDATE SET tgt.qty = src.total_qty,
               tgt.last_updated = src.latest_update
WHEN NOT MATCHED BY TARGET THEN
    INSERT (product_id, qty, last_updated)
    VALUES (src.product_id, src.total_qty, src.latest_update);
```

MERGE 문은 데이터 동기화와 Upsert 시나리오에서 코드를 크게 단순화한다. 단, SOURCE 중복·세미콜론 누락·대용량 성능 이슈를 항상 고려해야 한다. 이번 배치로 MariaDB MaxScale부터 T-SQL MERGE까지 총 10편을 완성했다.

---

**지난 글:** [T-SQL CTE와 APPLY 연산자](/posts/tsql-cte-apply/)

<br>
읽어주셔서 감사합니다. 😊
