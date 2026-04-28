---
title: "데이터 수정 — UPDATE와 UPDATE JOIN"
description: "UPDATE의 기본 문법, 여러 컬럼 동시 수정, 다른 테이블을 참조하는 UPDATE JOIN(MySQL)과 UPDATE FROM(PostgreSQL), 그리고 실수를 방지하는 안전한 UPDATE 습관을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["sql", "update", "update-join", "update-from", "dml", "데이터수정", "join"]
featured: false
draft: false
---

[지난 글](/posts/sql-insert-basics/)에서 INSERT의 다양한 패턴을 살펴봤다. 이번에는 기존 데이터를 수정하는 UPDATE를 다룬다.

---

## UPDATE 기본 문법

```sql
UPDATE 테이블명
SET 컬럼1 = 값1, 컬럼2 = 값2, ...
WHERE 조건;
```

**WHERE를 반드시 명시**해야 한다. WHERE 없는 UPDATE는 테이블의 모든 행을 수정한다.

```sql
-- 특정 상품 가격 10% 인상
UPDATE products
SET price      = price * 1.1,
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'electronics';
```

![UPDATE 기본과 UPDATE JOIN](/assets/posts/sql-update-and-update-join-syntax.svg)

---

## 여러 컬럼 동시 수정

`SET` 절에 쉼표로 구분하여 여러 컬럼을 한 번에 수정할 수 있다.

```sql
UPDATE users
SET
    status     = 'ACTIVE',
    verified   = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = 101;
```

---

## 서브쿼리로 다른 테이블 값 참조

```sql
-- VIP 고객의 주문에 할인율 적용 (서브쿼리 방식)
UPDATE orders
SET discount_rate = (
    SELECT vip_discount
    FROM customers
    WHERE customers.customer_id = orders.customer_id
)
WHERE customer_id IN (
    SELECT customer_id FROM customers WHERE grade = 'VIP'
);
```

서브쿼리 방식은 표준 SQL이라 모든 DBMS에서 동작하지만, 행마다 서브쿼리를 실행하므로 느릴 수 있다.

---

## UPDATE JOIN (MySQL)

MySQL은 UPDATE에 JOIN을 직접 쓸 수 있어 서브쿼리보다 효율적이다.

```sql
UPDATE orders o
INNER JOIN customers c ON o.customer_id = c.customer_id
SET o.discount_rate = c.vip_discount,
    o.updated_at    = CURRENT_TIMESTAMP
WHERE c.grade = 'VIP';
```

여러 테이블을 조인하면서 원하는 테이블의 컬럼만 SET에 명시한다. 조인 조건으로 인해 매칭되지 않는 주문은 수정되지 않는다.

---

## UPDATE FROM (PostgreSQL)

PostgreSQL은 JOIN 문법 대신 `FROM` 절을 사용한다.

```sql
UPDATE orders o
SET    discount_rate = c.vip_discount,
       updated_at    = CURRENT_TIMESTAMP
FROM   customers c
WHERE  o.customer_id = c.customer_id
  AND  c.grade = 'VIP';
```

`FROM`에 여러 테이블을 나열하거나 서브쿼리를 넣을 수도 있다.

```sql
-- FROM에 서브쿼리 사용
UPDATE products p
SET    stock = p.stock - oi.qty
FROM (
    SELECT product_id, SUM(quantity) AS qty
    FROM order_items
    WHERE order_id = 1042
    GROUP BY product_id
) oi
WHERE p.product_id = oi.product_id;
```

---

## RETURNING (PostgreSQL)

UPDATE 후 변경된 행의 값을 즉시 돌려받을 수 있다.

```sql
UPDATE orders
SET status     = 'SHIPPED',
    shipped_at = CURRENT_TIMESTAMP
WHERE order_id = 1042
RETURNING order_id, status, shipped_at;
```

이를 활용하면 UPDATE 후 별도의 SELECT 없이 변경된 값을 확인하거나 다음 로직에서 바로 사용할 수 있다.

---

## 안전한 UPDATE 습관

![UPDATE 주의사항](/assets/posts/sql-update-and-update-join-pitfalls.svg)

WHERE 없는 UPDATE는 전체 테이블을 수정한다. 운영 DB에서 실수하면 롤백하기 전까지 데이터가 모두 덮인다.

```sql
-- 안전 패턴: 트랜잭션 안에서 SELECT로 대상 먼저 확인
BEGIN;

-- 1단계: 대상 행 확인
SELECT user_id, email, status
FROM users
WHERE status = 'TRIAL' AND created_at < '2025-01-01';

-- 결과가 의도한 범위인지 확인 후

-- 2단계: 동일 WHERE로 UPDATE
UPDATE users
SET status = 'EXPIRED'
WHERE status = 'TRIAL' AND created_at < '2025-01-01';

-- 3단계: 결과 확인 후 COMMIT 또는 ROLLBACK
COMMIT;
```

SELECT와 UPDATE의 WHERE 조건을 동일하게 복사해 사용하면 실수를 줄일 수 있다.

---

## 대량 UPDATE 배치 처리

한 번에 수백만 행을 UPDATE하면 락 경합과 언두 로그 폭발이 발생할 수 있다. 배치로 나눠 처리한다.

```sql
-- 10,000행씩 나눠 UPDATE (MySQL)
UPDATE products
SET is_legacy = TRUE
WHERE created_at < '2020-01-01'
LIMIT 10000;
-- 행 수가 0이 될 때까지 반복

-- PostgreSQL: RETURNING으로 처리된 수 확인
WITH updated AS (
    UPDATE products
    SET is_legacy = TRUE
    WHERE id IN (
        SELECT id FROM products
        WHERE created_at < '2020-01-01' AND is_legacy IS FALSE
        LIMIT 10000
    )
    RETURNING id
)
SELECT COUNT(*) FROM updated;
```

다음 글에서는 DELETE를 안전하게 사용하는 방법을 다룬다.

---

**지난 글:** [데이터 삽입 — INSERT 문의 기본과 응용](/posts/sql-insert-basics/)

**다음 글:** [안전한 삭제 — DELETE 문 사용법](/posts/sql-delete-safely/)

<br>
읽어주셔서 감사합니다. 😊
