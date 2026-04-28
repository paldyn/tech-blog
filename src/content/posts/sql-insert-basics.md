---
title: "데이터 삽입 — INSERT 문의 기본과 응용"
description: "INSERT의 네 가지 패턴(단일·복수·SELECT·ON CONFLICT)과 컬럼 명시의 중요성, INSERT INTO ... SELECT로 데이터 이동, 배치 삽입과 COPY 성능 차이까지 실전 위주로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "insert", "dml", "batch-insert", "upsert", "on-conflict", "copy", "데이터삽입"]
featured: false
draft: false
---

[지난 글](/posts/sql-drop-vs-truncate/)에서 DROP·TRUNCATE·DELETE를 비교했다. 이번에는 DML의 첫 번째 명령인 INSERT를 깊이 있게 다룬다.

---

## INSERT 기본 문법

```sql
INSERT INTO 테이블명 (컬럼1, 컬럼2, ...)
VALUES (값1, 값2, ...);
```

컬럼 목록을 생략하면 테이블 정의 순서대로 값을 넣어야 한다. **컬럼 목록을 항상 명시**하는 것이 안전하다. 나중에 컬럼이 추가·변경되어도 기존 INSERT 문이 영향을 받지 않기 때문이다.

```sql
-- 컬럼 명시 (권장)
INSERT INTO users (email, name, created_at)
VALUES ('hong@example.com', '홍길동', CURRENT_TIMESTAMP);

-- 컬럼 생략 (테이블 구조 변경에 취약)
INSERT INTO users VALUES (DEFAULT, 'hong@example.com', '홍길동', CURRENT_TIMESTAMP);
```

![INSERT 패턴 총정리](/assets/posts/sql-insert-basics-patterns.svg)

---

## 복수 행 삽입

단일 INSERT에 여러 `VALUES` 튜플을 쉼표로 이어 붙이면 한 번의 왕복으로 여러 행을 삽입할 수 있다.

```sql
INSERT INTO categories (name, slug)
VALUES
    ('전자제품', 'electronics'),
    ('의류',     'clothing'),
    ('식품',     'food');
```

단건 INSERT를 반복하는 것보다 **네트워크 왕복과 트랜잭션 오버헤드를 줄여** 훨씬 빠르다. 애플리케이션에서 루프로 INSERT를 날리고 있다면 배치로 묶는 것만으로 큰 성능 개선을 얻을 수 있다.

---

## INSERT INTO ... SELECT

다른 테이블의 SELECT 결과를 직접 삽입한다. 데이터 이관, 아카이빙, 집계 테이블 채우기 등에 유용하다.

```sql
-- 오래된 주문을 아카이브 테이블로 이동
INSERT INTO archive_orders (order_id, customer_id, total, created_at)
SELECT order_id, customer_id, total, created_at
FROM orders
WHERE created_at < '2025-01-01';

-- 집계 결과를 요약 테이블에 삽입
INSERT INTO monthly_sales (year_month, total_revenue)
SELECT
    TO_CHAR(ordered_at, 'YYYY-MM') AS year_month,
    SUM(total)                      AS total_revenue
FROM orders
WHERE status = 'COMPLETED'
GROUP BY TO_CHAR(ordered_at, 'YYYY-MM');
```

`VALUES` 없이 `SELECT`로 바로 이어지는 것이 포인트다.

---

## ON CONFLICT — UPSERT

이미 행이 있으면 UPDATE, 없으면 INSERT하는 패턴을 UPSERT라 한다. PostgreSQL은 `ON CONFLICT`, MySQL은 `ON DUPLICATE KEY UPDATE` 문법을 제공한다.

```sql
-- PostgreSQL: ON CONFLICT
INSERT INTO user_stats (user_id, login_count, last_login)
VALUES (101, 1, CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO UPDATE
    SET login_count = user_stats.login_count + 1,
        last_login  = EXCLUDED.last_login;

-- MySQL: ON DUPLICATE KEY UPDATE
INSERT INTO user_stats (user_id, login_count)
VALUES (101, 1)
ON DUPLICATE KEY UPDATE
    login_count = login_count + 1;

-- 충돌 시 아무것도 하지 않기 (PostgreSQL)
INSERT INTO tags (name) VALUES ('sql')
ON CONFLICT (name) DO NOTHING;
```

`EXCLUDED`는 충돌된 INSERT 시도의 값을 담는 가상 테이블이다. `EXCLUDED.last_login`은 방금 삽입하려 했던 값을 의미한다.

---

## RETURNING — 삽입된 값 돌려받기

INSERT 후 생성된 ID나 DEFAULT 값을 즉시 확인할 수 있다. PostgreSQL, MariaDB에서 지원한다.

```sql
-- 삽입 후 생성된 ID 확인
INSERT INTO orders (customer_id, total)
VALUES (101, 59000)
RETURNING order_id, created_at;

-- 결과
-- order_id | created_at
-- ---------+-----------
--     1042 | 2026-04-29 ...
```

MySQL에서는 `LAST_INSERT_ID()`로 마지막 삽입 ID를 확인한다.

---

## 성능 — 배치 삽입과 COPY

![INSERT 성능 비교](/assets/posts/sql-insert-basics-performance.svg)

대량 데이터를 넣을 때는 DBMS의 대량 적재 기능이 가장 빠르다.

```sql
-- PostgreSQL: COPY (가장 빠른 대량 적재)
COPY products (name, price, stock)
FROM '/data/products.csv'
WITH (FORMAT CSV, HEADER TRUE);

-- MySQL: LOAD DATA INFILE
LOAD DATA INFILE '/data/products.csv'
INTO TABLE products
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 LINES (name, price, stock);
```

일반 INSERT와 비교해 COPY/LOAD는 트리거, 인덱스 갱신, 제약 검사를 최소화하거나 지연시키기 때문에 10배 이상 빠를 수 있다.

---

## 실전 팁

```sql
-- 컬럼 목록 없는 INSERT 금지 → 반드시 명시
-- 루프 INSERT → 배치 INSERT로 전환
-- 삽입 후 ID 필요 → RETURNING 또는 LAST_INSERT_ID()
-- 있으면 수정, 없으면 삽입 → ON CONFLICT / ON DUPLICATE KEY UPDATE
-- 대량 적재 → COPY / LOAD DATA INFILE
```

다음 글에서는 기존 데이터를 수정하는 UPDATE와 다른 테이블을 조인하면서 수정하는 UPDATE JOIN을 다룬다.

---

**지난 글:** [DROP vs TRUNCATE — 삭제의 두 얼굴](/posts/sql-drop-vs-truncate/)

**다음 글:** [데이터 수정 — UPDATE와 UPDATE JOIN](/posts/sql-update-and-update-join/)

<br>
읽어주셔서 감사합니다. 😊
