---
title: "PostgreSQL 함수 작성 — SQL과 PL/pgSQL 기초"
description: "PostgreSQL에서 SQL 함수와 PL/pgSQL 함수를 만드는 방법, 두 언어의 차이점과 선택 기준, 휘발성(VOLATILE/STABLE/IMMUTABLE), 반환 타입(스칼라/SETOF/RETURNS TABLE), 달러 인용($$), STRICT 키워드를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["postgresql", "create-function", "plpgsql", "sql-function", "returns-table", "setof", "immutable", "strict", "dollar-quoting"]
featured: false
draft: false
---

[지난 글](/posts/pg-extended-statistics/)에서 확장 통계로 옵티마이저의 추정 정확도를 높이는 방법을 살펴봤다. 이제 PostgreSQL의 서버 사이드 프로그래밍 첫 주제인 **사용자 정의 함수(User-Defined Function)**를 다룬다.

## 왜 함수를 쓰는가

복잡한 비즈니스 로직을 애플리케이션 레이어에만 두면 여러 서비스에서 중복이 생기고, 네트워크 왕복 비용이 발생한다. PostgreSQL 함수는 데이터베이스 내에서 로직을 실행하고, 여러 언어(SQL, PL/pgSQL, Python, C 등)를 지원한다.

## SQL 함수

가장 단순한 형태다. 단일 SQL 쿼리 또는 표현식으로 구성된다.

```sql
-- 기본 SQL 함수
CREATE OR REPLACE FUNCTION add_tax(
    price numeric,
    rate  numeric DEFAULT 0.1
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE STRICT
AS $$
    SELECT price * (1 + rate);
$$;

-- 호출
SELECT add_tax(10000);         -- 11000
SELECT add_tax(10000, 0.05);   -- 10500

-- 컬럼 계산에서 사용
SELECT name, add_tax(price) AS price_with_tax FROM products;
```

SQL 함수의 특징은 **인라인 가능(inlineable)**하다는 점이다. 옵티마이저가 함수 호출을 풀어서 함수 본문을 쿼리에 직접 삽입할 수 있다. 이 덕분에 추가 함수 호출 오버헤드 없이 옵티마이저가 최적화할 수 있다.

## PL/pgSQL 함수

복잡한 로직이 필요할 때 사용한다. DECLARE 블록에서 변수를 선언하고, BEGIN~END 블록에서 로직을 작성한다.

```sql
-- PL/pgSQL 기본 구조
CREATE OR REPLACE FUNCTION get_user_tier(user_id bigint)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    total_amount numeric;
    tier         text;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO   total_amount
    FROM   orders
    WHERE  customer_id = user_id
      AND  created_at >= now() - INTERVAL '1 year';

    IF total_amount >= 1000000 THEN
        tier := 'GOLD';
    ELSIF total_amount >= 500000 THEN
        tier := 'SILVER';
    ELSE
        tier := 'BRONZE';
    END IF;

    RETURN tier;
END;
$$;

-- 호출
SELECT id, name, get_user_tier(id) AS tier FROM users LIMIT 10;
```

![PostgreSQL 함수 — SQL vs PL/pgSQL 비교](/assets/posts/pg-create-function-sql-plpgsql-structure.svg)

## 달러 인용(Dollar Quoting)

함수 본문 안에 작은따옴표가 있을 때 이스케이프 문제가 생긴다. `$$`로 감싸면 내부에 작은따옴표를 그대로 쓸 수 있다. `$tag$...$tag$` 형태로 태그를 붙여 중첩도 가능하다.

```sql
-- 달러 인용 내부에 작은따옴표 자유롭게 사용
CREATE OR REPLACE FUNCTION greet(name text)
RETURNS text
LANGUAGE sql
AS $$
    SELECT 'Hello, ' || name || '! Welcome to PostgreSQL''s world.';
    -- 위에서 '' 이스케이프보다 $$ 안에서 ' 그대로 써도 됨
$$;

-- 중첩 달러 인용 (본문 내에 $$ 필요 시)
CREATE OR REPLACE FUNCTION demo()
RETURNS void
LANGUAGE plpgsql
AS $outer$
BEGIN
    EXECUTE $inner$SELECT 'test'$inner$;
END;
$outer$;
```

## 휘발성(Volatility) 선언

함수에는 반드시 적절한 휘발성 카테고리를 선언해야 한다. 표현식 인덱스 사용 가능 여부와 옵티마이저 최적화 수준에 영향을 준다.

```sql
-- IMMUTABLE: 동일 입력 → 항상 동일 결과 (표현식 인덱스 가능)
CREATE FUNCTION upper_trim(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT upper(trim(t)) $$;

-- STABLE: 트랜잭션 내 동일 결과 (세션/트랜잭션 의존 가능)
CREATE FUNCTION get_setting(key text) RETURNS text
LANGUAGE sql STABLE AS $$ SELECT current_setting(key) $$;

-- VOLATILE (기본): 호출마다 다른 결과 가능
CREATE FUNCTION log_access(msg text) RETURNS void
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
    INSERT INTO access_log VALUES (now(), msg);
END;
$$;
```

## STRICT 키워드

`STRICT`(또는 `CALLED ON NULL INPUT`의 반대)를 선언하면 인수 중 하나라도 NULL이면 함수를 실행하지 않고 NULL을 반환한다.

```sql
CREATE OR REPLACE FUNCTION safe_divide(a numeric, b numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE STRICT  -- b=NULL이면 바로 NULL 반환
AS $$
    SELECT a / b;
$$;

SELECT safe_divide(10, 0);     -- division by zero ERROR
SELECT safe_divide(10, NULL);  -- NULL (STRICT 덕분에 안전)
```

## 여러 행 반환 — SETOF와 RETURNS TABLE

![반환 타입 — SETOF, TABLE, RETURNS TABLE](/assets/posts/pg-create-function-sql-plpgsql-setof.svg)

```sql
-- RETURNS TABLE로 여러 행 반환
CREATE OR REPLACE FUNCTION get_top_customers(
    from_date date,
    lmt       int DEFAULT 10
)
RETURNS TABLE (
    customer_id bigint,
    customer_name text,
    total_amount  numeric
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.name, SUM(o.amount)
    FROM   orders o
    JOIN   users  u ON u.id = o.customer_id
    WHERE  o.created_at >= from_date
    GROUP  BY u.id, u.name
    ORDER  BY SUM(o.amount) DESC
    LIMIT  lmt;
END;
$$;

-- 함수 호출 (테이블 소스처럼 사용)
SELECT * FROM get_top_customers('2025-01-01', 5);

-- WHERE 절로 추가 필터
SELECT customer_name, total_amount
FROM   get_top_customers('2025-01-01')
WHERE  total_amount > 500000;
```

---

**지난 글:** [확장 통계 — 다중 컬럼 상관관계를 옵티마이저에게 알리는 방법](/posts/pg-extended-statistics/)

**다음 글:** [PL/pgSQL 제어 흐름 — IF, LOOP, EXCEPTION 완전 가이드](/posts/pg-plpgsql-control-flow/)

<br>
읽어주셔서 감사합니다. 😊
