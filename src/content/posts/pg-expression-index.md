---
title: "표현식 인덱스 — 함수와 연산 결과에 인덱스 걸기"
description: "PostgreSQL 표현식 인덱스(Functional Index)가 함수 결과를 키로 저장하는 원리, IMMUTABLE 함수만 사용 가능한 이유, lower()·date_part()·JSON 추출 등 실전 패턴, 쓰기 오버헤드와 생성된 컬럼과의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["postgresql", "expression-index", "functional-index", "immutable", "lower", "date_part", "json-index", "index-performance"]
featured: false
draft: false
---

[지난 글](/posts/pg-covering-index-include/)에서 INCLUDE 절로 힙 접근을 줄이는 커버링 인덱스를 살펴봤다. 이번에는 컬럼 값 자체가 아닌 **함수나 표현식의 결과**를 인덱스 키로 저장하는 표현식 인덱스(Functional Index)를 다룬다.

## 문제: 함수를 씌우면 인덱스가 사라진다

가장 흔한 패턴은 이메일 대소문자 무시 검색이다.

```sql
-- email 컬럼에 일반 인덱스가 있어도
CREATE INDEX idx_email ON users (email);

-- 이 쿼리는 인덱스를 사용하지 못한다
SELECT * FROM users WHERE lower(email) = 'alice@example.com';
-- → Seq Scan (email 컬럼 값은 'Alice@Example.com'처럼 저장될 수 있음)
```

옵티마이저는 `lower(email)` 결과와 `email` 인덱스 키를 같은 것으로 보지 않는다. 인덱스가 저장한 건 원래 `email` 값이지, `lower(email)` 결과가 아니기 때문이다.

## 해법: 표현식 인덱스

```sql
-- 표현식 인덱스: lower(email) 결과를 키로 저장
CREATE INDEX idx_email_lower ON users (lower(email));

-- 이제 쿼리 조건이 표현식과 정확히 일치하면 인덱스 사용
SELECT * FROM users WHERE lower(email) = 'alice@example.com';
-- → Index Scan using idx_email_lower

-- 확인
EXPLAIN (ANALYZE) SELECT * FROM users WHERE lower(email) = 'alice@example.com';
```

쿼리의 WHERE 조건이 인덱스 표현식과 **구문적으로 동일**해야 한다. `LOWER(email)`, `lower (email)` 등은 모두 같지만 `lower(trim(email))`은 다른 표현식이다.

![표현식 인덱스 — 함수 결과에 인덱스 걸기](/assets/posts/pg-expression-index-concept.svg)

## IMMUTABLE 함수만 사용 가능한 이유

표현식 인덱스는 INSERT/UPDATE 시 해당 표현식을 평가해 결과를 인덱스에 저장한다. 이후 쿼리에서 그 값을 재사용한다. 그러므로 같은 입력에 항상 같은 결과를 반환하는 **IMMUTABLE** 함수만 허용된다.

- `VOLATILE`: `now()`, `random()` 등 — 호출마다 다른 결과 → 인덱스 불가
- `STABLE`: 트랜잭션 내 동일하지만 트랜잭션 간 다를 수 있음 → 인덱스 불가
- `IMMUTABLE`: 동일 입력 → 항상 동일 결과 → 인덱스 가능

```sql
-- VOLATILE 함수로는 인덱스 생성 불가 (오류 발생)
CREATE INDEX idx_bad ON logs (now());
-- ERROR: functions in index expression must be marked IMMUTABLE

-- 커스텀 함수를 IMMUTABLE로 선언
CREATE OR REPLACE FUNCTION normalize_phone(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(p, '[^0-9]', '', 'g')
$$;

CREATE INDEX idx_phone_normalized ON users (normalize_phone(phone));
```

![IMMUTABLE 함수와 표현식 인덱스 가능 조건](/assets/posts/pg-expression-index-immutable.svg)

## 실전 패턴

날짜에서 연도나 월만 추출해서 검색하는 경우가 많다.

```sql
-- 연도별 집계 쿼리 최적화
CREATE INDEX idx_orders_year
    ON orders (date_part('year', created_at));

SELECT count(*) FROM orders
WHERE  date_part('year', created_at) = 2025;

-- 월별 파티셔닝 없이 월 검색
CREATE INDEX idx_orders_month
    ON orders (EXTRACT(MONTH FROM created_at));
```

JSONB 컬럼에서 특정 키 값을 추출해 인덱스를 거는 것도 흔한 패턴이다.

```sql
-- JSONB에서 price 값으로 검색
CREATE INDEX idx_product_price
    ON products ((data->>'price')::numeric);

SELECT * FROM products
WHERE  (data->>'price')::numeric > 100000;

-- 중첩 JSONB 키
CREATE INDEX idx_user_city
    ON users ((profile->'address'->>'city'));

SELECT * FROM users
WHERE  profile->'address'->>'city' = 'Seoul';
```

## 표현식 인덱스 vs 생성된 컬럼

PostgreSQL 12부터 GENERATED ALWAYS AS 컬럼을 쓸 수 있다. 표현식 인덱스와 비슷해 보이지만 차이가 있다.

```sql
-- 생성된 컬럼 (Generated Column)
ALTER TABLE users
    ADD COLUMN email_lower text
    GENERATED ALWAYS AS (lower(email)) STORED;

-- 생성된 컬럼에 일반 인덱스
CREATE INDEX idx_users_email_lower ON users (email_lower);
```

| 항목 | 표현식 인덱스 | 생성된 컬럼 + 인덱스 |
|------|-------------|-------------------|
| 컬럼 추가 없음 | O | X (컬럼 추가됨) |
| SELECT에서 직접 참조 | X | O |
| 스토리지 | 인덱스만 | 테이블 + 인덱스 |
| 복잡한 표현식 | 자유롭게 | 동일 |

쿼리에서 표현식 결과를 자주 SELECT해야 한다면 생성된 컬럼이 편리하다. 검색 필터 목적으로만 쓴다면 표현식 인덱스가 스토리지 효율이 더 좋다.

## 쓰기 오버헤드 측정

표현식 인덱스는 DML 시 표현식 평가 비용이 추가된다.

```sql
-- 인덱스 크기 및 통계 확인
SELECT
    indexrelname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    idx_scan,
    idx_tup_read
FROM   pg_stat_user_indexes
WHERE  relname = 'users'
ORDER  BY idx_scan DESC;

-- 쓰기 부하 측정 (pg_stat_user_tables)
SELECT relname, n_tup_ins, n_tup_upd, n_tup_del
FROM   pg_stat_user_tables
WHERE  relname = 'users';
```

---

**지난 글:** [Covering Index와 INCLUDE — 힙 접근 없는 인덱스 스캔](/posts/pg-covering-index-include/)

**다음 글:** [Index-Only Scan 완전 이해 — 언제 힙을 건너뛰는가](/posts/pg-index-only-scan/)

<br>
읽어주셔서 감사합니다. 😊
