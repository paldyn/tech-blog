---
title: "NOT NULL·DEFAULT·CHECK 제약조건 완전 정복"
description: "SQL 제약조건 NOT NULL·DEFAULT·CHECK의 의미와 동작 방식, NULL의 3값 논리, 그리고 CHECK 조건에서 NULL 처리 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQL", "제약조건", "NOT NULL", "DEFAULT", "CHECK", "NULL"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-datetime/)에서 날짜·시간 타입을 살펴봤습니다. 이번에는 열에 저장되는 값의 유효성을 보장하는 세 가지 제약조건 — `NOT NULL`, `DEFAULT`, `CHECK` — 을 깊이 있게 살펴봅니다. 그리고 SQL에서 가장 많은 혼란을 일으키는 개념 중 하나인 **NULL의 3값 논리**도 함께 다룹니다.

## NOT NULL — NULL 저장 금지

`NOT NULL`은 해당 열에 `NULL` 값이 들어오는 것을 막습니다. `INSERT` 또는 `UPDATE` 시 값을 명시하지 않거나 `NULL`을 직접 넣으려 하면 에러가 발생합니다.

```sql
CREATE TABLE users (
    user_id    INT         NOT NULL,
    email      VARCHAR(320) NOT NULL,  -- 이메일은 반드시 있어야 함
    nickname   VARCHAR(50)             -- NULL 허용: 미설정 가능
);

-- ✗ NOT NULL 위반
INSERT INTO users (user_id, email) VALUES (1, NULL);
-- ERROR: null value in column "email"

-- ✓ 정상
INSERT INTO users (user_id, email) VALUES (1, 'user@example.com');
```

**NOT NULL이 성능에도 영향을 준다**: DBMS 옵티마이저는 NOT NULL 열에서 NULL 체크를 생략할 수 있어 인덱스 활용과 조인 계획이 개선됩니다.

![NOT NULL·DEFAULT·CHECK 제약조건](/assets/posts/sql-constraints-not-null-default-check-types.svg)

## DEFAULT — 기본값 설정

`DEFAULT`는 `INSERT` 시 해당 열 값을 생략하면 자동으로 채워지는 값을 지정합니다. `NULL`을 명시적으로 삽입하면 DEFAULT가 아닌 `NULL`이 들어갑니다.

```sql
CREATE TABLE orders (
    order_id    INT          NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending',   -- 문자열 기본값
    quantity    INT          NOT NULL DEFAULT 1,            -- 숫자 기본값
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),        -- 함수 기본값
    is_gift     BOOLEAN      NOT NULL DEFAULT FALSE
);

-- status, quantity, created_at, is_gift 생략 시 DEFAULT 값 자동 사용
INSERT INTO orders (order_id) VALUES (1001);

-- DEFAULT를 명시적으로 사용
INSERT INTO orders (order_id, status) VALUES (1002, DEFAULT);
```

```sql
-- ALTER TABLE로 기존 테이블에 DEFAULT 추가
ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0;

-- DEFAULT 제거
ALTER TABLE products ALTER COLUMN stock DROP DEFAULT;
```

## CHECK — 조건 기반 유효성

`CHECK`는 삽입·수정 시 지정한 조건이 `TRUE`인 경우에만 허용합니다.

```sql
CREATE TABLE products (
    product_id  INT           NOT NULL,
    name        VARCHAR(200)  NOT NULL,
    price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    discount    NUMERIC(5,2)           CHECK (discount BETWEEN 0 AND 100),
    status      CHAR(1)       NOT NULL CHECK (status IN ('A','I','D')),
    start_date  DATE          NOT NULL,
    end_date    DATE,
    -- 여러 열을 참조하는 CHECK는 테이블 제약조건으로
    CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
```

```sql
-- ✗ CHECK 위반
UPDATE products SET price = -100 WHERE product_id = 1;
-- ERROR: new row violates check constraint "products_price_check"

-- 제약조건 이름을 붙이면 에러 메시지가 명확
```

## NULL의 의미와 3값 논리

SQL에서 NULL은 **"알 수 없음(Unknown)"** 을 의미합니다. 0이나 빈 문자열과는 다릅니다.

![NULL의 의미와 3값 논리](/assets/posts/sql-constraints-not-null-default-check-null.svg)

SQL의 비교 연산은 `TRUE` / `FALSE` 두 값이 아니라 **TRUE / FALSE / UNKNOWN** 세 값으로 동작합니다.

```sql
-- NULL 관련 비교의 결과
SELECT
    NULL = NULL,      -- NULL (UNKNOWN)
    NULL != NULL,     -- NULL (UNKNOWN)
    NULL > 0,         -- NULL (UNKNOWN)
    NULL IS NULL,     -- TRUE  ← 올바른 NULL 체크
    NULL IS NOT NULL; -- FALSE

-- WHERE에서 UNKNOWN은 행을 제외시킴
SELECT * FROM employees WHERE phone = NULL;   -- 항상 0건!
SELECT * FROM employees WHERE phone IS NULL;  -- 전화번호 미등록 직원
```

| 조건 | 결과 | WHERE 영향 |
|------|------|-----------|
| `값 = NULL` | UNKNOWN | 행 제외 |
| `NULL = NULL` | UNKNOWN | 행 제외 |
| `값 IS NULL` | TRUE 또는 FALSE | 정상 동작 |

## CHECK와 NULL

**중요**: CHECK 조건 결과가 `UNKNOWN`(NULL 관련)이면 조건이 통과됩니다. `FALSE`일 때만 거부합니다.

```sql
-- discount 컬럼이 NULL이면 CHECK (discount BETWEEN 0 AND 100)은 UNKNOWN → 통과
-- discount에 NOT NULL이 없으면 NULL 값도 저장 가능

-- 명시적으로 NULL 제외하려면 NOT NULL을 함께 사용
discount  NUMERIC(5,2) NOT NULL CHECK (discount BETWEEN 0 AND 100)
```

## 제약조건 나중에 추가·삭제

```sql
-- NOT NULL 추가 (기존 데이터가 NULL이면 에러)
ALTER TABLE employees ALTER COLUMN phone SET NOT NULL;

-- DEFAULT 추가
ALTER TABLE employees ALTER COLUMN status SET DEFAULT 'active';

-- CHECK 추가
ALTER TABLE employees
ADD CONSTRAINT chk_salary CHECK (salary >= 0);

-- 제약조건 삭제
ALTER TABLE employees DROP CONSTRAINT chk_salary;

-- 제약조건 임시 비활성화 (PostgreSQL, 데이터 마이그레이션 시)
ALTER TABLE employees DISABLE TRIGGER ALL;
-- 또는
SET session_replication_role = 'replica';  -- FK 체크 비활성화
```

## 실무 권장 패턴

```sql
-- 모범 예: 완전한 사용자 테이블
CREATE TABLE users (
    user_id     BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       VARCHAR(320) NOT NULL,
    username    VARCHAR(50)  NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','active','suspended')),
    age         SMALLINT     CHECK (age IS NULL OR age BETWEEN 0 AND 150),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_email UNIQUE (email),
    CONSTRAINT uq_username UNIQUE (username)
);
```

## 정리

- `NOT NULL`은 필수 입력 필드를 보장하고 인덱스 효율도 높입니다.
- `DEFAULT`는 자주 쓰이는 초기값을 자동으로 채워 INSERT를 단순화합니다.
- `CHECK`로 도메인 무결성을 DB 레벨에서 강제합니다.
- NULL은 "알 수 없음"이며 `=` 연산이 아닌 `IS NULL`로 비교해야 합니다.
- CHECK 조건에서 NULL은 UNKNOWN → 통과되므로, NULL도 막으려면 NOT NULL을 함께 사용합니다.

다음 글에서는 **기본 키(Primary Key) 설계**의 실무적인 전략을 살펴봅니다.

---

**지난 글:** [SQL 데이터 타입 — 날짜와 시간](/posts/sql-data-types-datetime/)

**다음 글:** [기본 키 설계 전략 — 자연키 vs 대리키, UUID vs BIGINT](/posts/sql-primary-key-design/)

<br>
읽어주셔서 감사합니다. 😊
