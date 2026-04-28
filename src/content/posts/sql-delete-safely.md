---
title: "안전한 삭제 — DELETE 문 사용법"
description: "DELETE의 기본 문법, JOIN을 활용한 다중 테이블 삭제(MySQL DELETE JOIN, PostgreSQL DELETE USING), 배치 삭제로 락 방지, 그리고 하드 삭제 vs 소프트 삭제 선택 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["sql", "delete", "soft-delete", "hard-delete", "delete-join", "dml", "batch-delete", "데이터삭제"]
featured: false
draft: false
---

[지난 글](/posts/sql-update-and-update-join/)에서 UPDATE와 UPDATE JOIN을 살펴봤다. 이번에는 데이터를 삭제하는 DELETE를 안전하게 사용하는 방법을 다룬다.

---

## DELETE 기본 문법

```sql
DELETE FROM 테이블명
WHERE 조건;
```

UPDATE와 마찬가지로 **WHERE를 반드시 명시**해야 한다. WHERE 없는 `DELETE FROM orders;`는 테이블의 모든 행을 삭제한다. TRUNCATE와 달리 DELETE는 트랜잭션이 커밋되기 전까지 ROLLBACK이 가능하다.

```sql
-- 만료된 세션 삭제
DELETE FROM sessions
WHERE expires_at < CURRENT_TIMESTAMP;

-- 특정 ID 삭제
DELETE FROM comments
WHERE comment_id = 5042;
```

![DELETE 패턴과 안전한 삭제](/assets/posts/sql-delete-safely-patterns.svg)

---

## DELETE JOIN — 다른 테이블 조건으로 삭제

### MySQL: DELETE JOIN

```sql
-- 비활성화된 고객의 주문 삭제
DELETE o
FROM orders o
INNER JOIN customers c ON o.customer_id = c.customer_id
WHERE c.status = 'DEACTIVATED';
```

DELETE 뒤에 삭제할 테이블 별칭을 명시한다. 여러 테이블에서 동시에 삭제할 수도 있다.

```sql
-- orders와 order_items를 동시에 삭제
DELETE o, oi
FROM orders o
INNER JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN customers c ON o.customer_id = c.customer_id
WHERE c.status = 'DEACTIVATED';
```

### PostgreSQL: DELETE USING

PostgreSQL은 `USING` 절로 다른 테이블을 참조한다.

```sql
DELETE FROM orders o
USING customers c
WHERE o.customer_id = c.customer_id
  AND c.status = 'DEACTIVATED';
```

서브쿼리 방식도 표준적으로 사용된다.

```sql
DELETE FROM orders
WHERE customer_id IN (
    SELECT customer_id FROM customers WHERE status = 'DEACTIVATED'
);
```

---

## RETURNING — 삭제된 행 반환 (PostgreSQL)

```sql
DELETE FROM sessions
WHERE expires_at < CURRENT_TIMESTAMP
RETURNING session_id, user_id, expires_at;
```

삭제된 행의 정보를 애플리케이션에서 바로 사용하거나 감사 테이블에 INSERT할 때 유용하다.

---

## 하드 삭제 vs 소프트 삭제

![하드 삭제 vs 소프트 삭제](/assets/posts/sql-delete-safely-soft-delete.svg)

### 하드 삭제

`DELETE` 문으로 물리적으로 행을 제거한다. 스토리지가 절약되고 쿼리가 단순하다. 복구하려면 백업이 필요하다.

### 소프트 삭제 (논리 삭제)

`deleted_at` 컬럼에 타임스탬프를 기록하고, 쿼리에서 `WHERE deleted_at IS NULL`로 활성 데이터만 조회한다.

```sql
-- 소프트 삭제
UPDATE users
SET deleted_at = CURRENT_TIMESTAMP
WHERE user_id = 101;

-- 소프트 삭제된 데이터 조회
SELECT * FROM users WHERE deleted_at IS NULL;

-- 복구
UPDATE users SET deleted_at = NULL WHERE user_id = 101;
```

소프트 삭제는 감사 추적, 복구 가능성, 관계 데이터 보존에 유리하다. 단, 모든 쿼리에 `deleted_at IS NULL` 조건을 잊지 않도록 ORM의 기본 스코프나 뷰로 관리하는 것이 좋다.

---

## 배치 삭제 — 대형 테이블

수백만 행을 한 번에 삭제하면 다음 문제가 생긴다.

- 테이블 락 장시간 점유
- 언두 로그 / 트랜잭션 로그 폭발
- 서비스 응답 지연

청크 단위로 나눠 삭제한다.

```sql
-- MySQL: LIMIT으로 배치 삭제 (영향받은 행이 0이 될 때까지 반복)
DELETE FROM event_log
WHERE created_at < '2024-01-01'
LIMIT 10000;

-- PostgreSQL: CTE로 배치 삭제
WITH deleted AS (
    DELETE FROM event_log
    WHERE id IN (
        SELECT id FROM event_log
        WHERE created_at < '2024-01-01'
        LIMIT 10000
    )
    RETURNING id
)
SELECT COUNT(*) FROM deleted;
```

배치 삭제는 각 배치 사이에 잠깐의 sleep을 두거나, off-peak 시간에 실행하면 서비스 영향을 최소화할 수 있다.

---

## 안전한 DELETE 체크리스트

```sql
-- 실행 전: 삭제 대상 먼저 SELECT로 확인
SELECT COUNT(*), MIN(created_at), MAX(created_at)
FROM event_log
WHERE created_at < '2024-01-01';

-- 트랜잭션 안에서 실행
BEGIN;
DELETE FROM event_log WHERE created_at < '2024-01-01' LIMIT 10000;
-- 결과 확인 후
COMMIT; -- 또는 ROLLBACK;
```

다음 글에서는 INSERT와 UPDATE를 하나로 합친 MERGE/UPSERT를 다룬다.

---

**지난 글:** [데이터 수정 — UPDATE와 UPDATE JOIN](/posts/sql-update-and-update-join/)

**다음 글:** [MERGE / UPSERT — 있으면 수정, 없으면 삽입](/posts/sql-merge-upsert/)

<br>
읽어주셔서 감사합니다. 😊
