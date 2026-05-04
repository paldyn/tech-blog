---
title: "SAVEPOINT와 부분 롤백"
description: "트랜잭션 내 중간 복귀점을 설정하는 SAVEPOINT, ROLLBACK TO SAVEPOINT로 부분 취소, RELEASE SAVEPOINT로 해제, 배치 처리 오류 스킵 패턴, DB별 지원 현황을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["sql", "savepoint", "transaction", "partial-rollback", "nested-transaction", "batch-processing", "error-handling"]
featured: false
draft: false
---

[지난 글](/posts/sql-deadlock-essence/)에서 데드락의 발생과 해결 전략을 살펴봤다. 이번에는 트랜잭션 내에서 **특정 지점으로만 되돌아올 수 있는 SAVEPOINT**를 정리한다. 완전 롤백 없이 중간 오류를 처리해야 하는 배치 작업이나 복잡한 로직에서 유용하다.

---

## SAVEPOINT란

`BEGIN`과 `COMMIT` 사이에서 **중간 복귀점(Checkpoint)**을 만드는 기능이다. 이후에 오류가 발생하면 전체 트랜잭션을 롤백하지 않고 해당 복귀점으로만 돌아올 수 있다.

![SAVEPOINT 구조 다이어그램](/assets/posts/sql-savepoint-structure.svg)

---

## 기본 문법

```sql
-- 표준 SQL (PostgreSQL, MySQL, Oracle, SQL Server 모두 지원)
BEGIN;

INSERT INTO orders (product_id, qty) VALUES (1, 10);  -- ①

SAVEPOINT after_order;  -- ← 복귀점 설정

UPDATE inventory SET stock = stock - 10
WHERE product_id = 1;  -- ②

-- 오류 발생 가정
-- ROLLBACK TO SAVEPOINT로 ②만 취소, ①은 유지
ROLLBACK TO SAVEPOINT after_order;

-- SAVEPOINT 해제 (선택적 — 자원 반환)
RELEASE SAVEPOINT after_order;

-- ①의 결과를 포함해 커밋
COMMIT;
```

`ROLLBACK TO SAVEPOINT`는 지정한 savepoint 이후의 변경만 취소한다. 이전 변경(①)과 savepoint 자체는 그대로 남는다.

---

## 배치 처리에서 오류 행 스킵

대량의 행을 처리하다가 일부 행에서 오류가 발생해도 나머지는 처리하고 싶을 때 SAVEPOINT가 유용하다.

![SAVEPOINT 코드 예시](/assets/posts/sql-savepoint-code.svg)

```sql
-- PostgreSQL PL/pgSQL: 오류 행 스킵 패턴
BEGIN;
FOR r IN (SELECT * FROM import_data) LOOP
    SAVEPOINT row_sp;
    BEGIN
        INSERT INTO target_table VALUES (r.id, r.value);
    EXCEPTION WHEN OTHERS THEN
        ROLLBACK TO SAVEPOINT row_sp;
        -- 오류 로깅
        INSERT INTO error_log (row_id, err_msg)
        VALUES (r.id, SQLERRM);
    END;
    RELEASE SAVEPOINT row_sp;
END LOOP;
COMMIT;
```

Python에서 psycopg2를 사용하는 경우:

```python
with conn.cursor() as cur:
    cur.execute("BEGIN")
    for row in data:
        cur.execute("SAVEPOINT row_sp")
        try:
            cur.execute("INSERT INTO t VALUES (%s, %s)", (row.id, row.val))
            cur.execute("RELEASE SAVEPOINT row_sp")
        except psycopg2.Error:
            cur.execute("ROLLBACK TO SAVEPOINT row_sp")
            log_error(row.id)
    cur.execute("COMMIT")
```

---

## 중첩 SAVEPOINT

여러 SAVEPOINT를 중첩해서 설정할 수 있다. 안쪽 savepoint를 롤백해도 바깥쪽 savepoint와 그 이전 작업은 유지된다.

```sql
BEGIN;
INSERT INTO a ...;
SAVEPOINT sp1;
    INSERT INTO b ...;
    SAVEPOINT sp2;
        INSERT INTO c ...;
    ROLLBACK TO SAVEPOINT sp2;  -- c만 취소
    -- b는 유지됨
ROLLBACK TO SAVEPOINT sp1;  -- b도 취소, a는 유지
COMMIT;
```

같은 이름으로 SAVEPOINT를 재선언하면 이전 것을 덮어쓴다.

---

## DB별 특이사항

| DB | 구문 | 주의 |
|----|------|------|
| PostgreSQL | `SAVEPOINT sp` | `RELEASE` 후 같은 이름 재사용 가능 |
| MySQL | `SAVEPOINT sp` | InnoDB에서만 지원 |
| Oracle | `SAVEPOINT sp` | `RELEASE` 구문 없음 (COMMIT/ROLLBACK이 자동 정리) |
| SQL Server | `SAVE TRANSACTION sp` | `ROLLBACK TRANSACTION sp` |
| SQLite | `SAVEPOINT sp` | WAL 모드 권장 |

SQL Server는 `SAVE TRANSACTION`이라는 독자 구문을 사용하며, `ROLLBACK TRANSACTION sp`로 롤백한다.

---

## SAVEPOINT와 DDL

MySQL, Oracle, SQL Server 등 많은 DB에서 DDL(`CREATE TABLE`, `ALTER TABLE` 등)은 암묵적으로 COMMIT을 발생시킨다. DDL이 포함된 트랜잭션에서 SAVEPOINT를 사용하면 의도치 않은 커밋이 발생할 수 있다.

```sql
-- PostgreSQL: DDL도 트랜잭션 안에서 롤백 가능 (예외적)
BEGIN;
CREATE TABLE test_table (id int);
SAVEPOINT before_insert;
INSERT INTO test_table VALUES (1);
ROLLBACK TO SAVEPOINT before_insert;  -- INSERT만 취소, CREATE는 유지
COMMIT;

-- MySQL, Oracle: DDL이 자동 COMMIT → SAVEPOINT 무효화
-- DDL 전후로 트랜잭션 경계를 명확히 해야 함
```

---

**지난 글:** [데드락의 본질과 해결](/posts/sql-deadlock-essence/)

**다음 글:** [정규화: 1NF~BCNF](/posts/sql-normalization-1nf-2nf-3nf-bcnf/)

<br>
읽어주셔서 감사합니다. 😊
