---
title: "MERGE / UPSERT — 있으면 수정, 없으면 삽입"
description: "SQL 표준 MERGE 문의 구조, PostgreSQL의 ON CONFLICT, MySQL의 ON DUPLICATE KEY UPDATE, REPLACE INTO의 함정, 그리고 경쟁 조건(Race Condition)까지 UPSERT의 모든 것을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["sql", "merge", "upsert", "on-conflict", "on-duplicate-key", "dml", "경쟁조건", "데이터동기화"]
featured: false
draft: false
---

[지난 글](/posts/sql-delete-safely/)에서 DELETE를 안전하게 사용하는 방법을 살펴봤다. 이번에는 INSERT와 UPDATE를 하나로 합친 MERGE/UPSERT를 다룬다.

---

## UPSERT가 필요한 이유

데이터 동기화나 집계 갱신 시나리오에서는 "이미 있으면 수정, 없으면 삽입"이 자주 필요하다. 애플리케이션 레이어에서 SELECT → 있으면 UPDATE / 없으면 INSERT로 구현할 수 있지만, 두 번의 왕복과 **경쟁 조건(Race Condition)** 문제가 생긴다. UPSERT는 이를 원자적으로 처리한다.

![MERGE / UPSERT 흐름](/assets/posts/sql-merge-upsert-flow.svg)

---

## 표준 SQL: MERGE

SQL:2003 표준에서 도입되었다. Oracle, SQL Server, DB2, PostgreSQL 15+가 지원한다.

```sql
MERGE INTO inventory tgt
USING incoming_stock src
ON (tgt.product_id = src.product_id)
WHEN MATCHED THEN
    UPDATE SET tgt.stock     = tgt.stock + src.qty,
               tgt.updated_at = CURRENT_TIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (product_id, stock, updated_at)
    VALUES (src.product_id, src.qty, CURRENT_TIMESTAMP);
```

- `USING`: 소스 테이블이나 서브쿼리
- `ON`: 매칭 조건
- `WHEN MATCHED`: 일치하는 행이 있을 때 실행
- `WHEN NOT MATCHED`: 일치하는 행이 없을 때 실행

MERGE는 DELETE도 지원한다.

```sql
-- 소스에 없는 행을 대상에서 삭제 (SQL Server, Oracle)
WHEN NOT MATCHED BY SOURCE THEN DELETE;
```

![DBMS별 MERGE/UPSERT 문법](/assets/posts/sql-merge-upsert-syntax.svg)

---

## PostgreSQL: ON CONFLICT

PostgreSQL은 `INSERT ... ON CONFLICT`로 UPSERT를 구현한다. 표준 MERGE보다 간결하고 실용적이다.

```sql
-- 충돌 시 UPDATE
INSERT INTO inventory (product_id, stock)
VALUES (101, 50)
ON CONFLICT (product_id) DO UPDATE
    SET stock      = inventory.stock + EXCLUDED.stock,
        updated_at = CURRENT_TIMESTAMP;
```

`EXCLUDED`는 충돌된 INSERT 시도값이 담긴 가상 테이블이다. `EXCLUDED.stock`은 방금 삽입하려 했던 값을 의미한다.

```sql
-- 충돌 시 아무것도 하지 않기 (중복 무시)
INSERT INTO tags (name) VALUES ('sql')
ON CONFLICT (name) DO NOTHING;

-- ON CONFLICT ON CONSTRAINT (제약 이름으로 지정)
INSERT INTO inventory (product_id, stock)
VALUES (101, 50)
ON CONFLICT ON CONSTRAINT uq_inventory_product DO UPDATE
    SET stock = inventory.stock + EXCLUDED.stock;
```

---

## MySQL: ON DUPLICATE KEY UPDATE

MySQL/MariaDB는 `INSERT ... ON DUPLICATE KEY UPDATE`를 사용한다.

```sql
INSERT INTO inventory (product_id, stock)
VALUES (101, 50)
ON DUPLICATE KEY UPDATE
    stock      = stock + VALUES(stock),
    updated_at = CURRENT_TIMESTAMP;
```

`VALUES(컬럼명)`은 INSERT 시도값을 참조한다. MySQL 8.0.20+에서는 `VALUES()` 대신 별칭(`AS new`)을 사용하도록 문법이 변경되었다.

```sql
-- MySQL 8.0.20+ 권장 문법
INSERT INTO inventory (product_id, stock)
VALUES (101, 50) AS new
ON DUPLICATE KEY UPDATE
    stock = stock + new.stock;
```

---

## REPLACE INTO — 함정 주의

MySQL의 `REPLACE INTO`는 PK/UNIQUE 충돌 시 기존 행을 **삭제하고 새로 삽입**한다. 트리거와 FK CASCADE가 DELETE로 발동하며, AUTO_INCREMENT 값도 새로 생성된다.

```sql
-- REPLACE INTO는 DELETE + INSERT
-- FK CASCADE가 발동하거나 AUTO_INCREMENT가 바뀔 수 있음
REPLACE INTO inventory (product_id, stock) VALUES (101, 50);
```

대부분의 경우 `ON DUPLICATE KEY UPDATE`가 더 안전하다.

---

## 경쟁 조건 (Race Condition)

애플리케이션에서 SELECT 후 INSERT/UPDATE를 분리해 구현하면 두 스레드가 동시에 SELECT에서 "없음"을 확인하고 INSERT를 시도하다가 하나가 실패하는 상황이 생긴다.

```sql
-- 애플리케이션 레벨 UPSERT (경쟁 조건 위험)
-- Thread 1: SELECT → 없음 → INSERT 시도
-- Thread 2: SELECT → 없음 → INSERT 시도 → 하나가 에러

-- DB 레벨 UPSERT (원자적 처리, 경쟁 조건 없음)
INSERT INTO inventory ...
ON CONFLICT (product_id) DO UPDATE ...
```

`ON CONFLICT`나 `MERGE`는 단일 SQL 문으로 원자적으로 실행되어 경쟁 조건을 방지한다.

---

## DBMS별 UPSERT 지원 정리

| DBMS | 문법 |
|---|---|
| Oracle | `MERGE INTO` |
| SQL Server | `MERGE INTO` |
| PostgreSQL 9.5+ | `ON CONFLICT DO UPDATE` |
| PostgreSQL 15+ | `MERGE INTO` |
| MySQL / MariaDB | `ON DUPLICATE KEY UPDATE` |
| SQLite | `INSERT OR REPLACE`, `ON CONFLICT` |

이번 시리즈 배치에서는 DDL의 제약 조건부터 DML의 핵심 명령까지 10편을 살펴봤다. 다음 배치에서는 SELECT의 논리적 실행 순서부터 시작해 쿼리 작성의 기초를 다룬다.

---

**지난 글:** [안전한 삭제 — DELETE 문 사용법](/posts/sql-delete-safely/)

<br>
읽어주셔서 감사합니다. 😊
