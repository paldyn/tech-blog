---
title: "NOT NULL, DEFAULT, CHECK 제약 — 데이터 품질을 DB에서 보장하는 방법"
description: "NOT NULL, DEFAULT, CHECK 제약의 정확한 동작 방식과 NULL의 세값 논리, 제약에 이름을 붙여야 하는 이유를 실무 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQL", "NOT NULL", "DEFAULT", "CHECK 제약", "NULL", "데이터 무결성"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-datetime/)에서 날짜/시간 타입을 살펴봤습니다. 이번에는 열 제약 중 가장 기본이자 가장 많이 오용되는 `NOT NULL`, `DEFAULT`, `CHECK`를 자세히 다룹니다. 이 세 가지 제약을 제대로 이해하면 "애플리케이션에서 검증하면 되지 않나요?"라는 질문에 답할 수 있게 됩니다.

## 왜 DB에서 제약을 걸어야 하나

애플리케이션 레이어에서도 데이터를 검증하지만, DB 제약이 별도로 필요한 이유가 있습니다.

1. **다중 진입점**: API, 배치 잡, 마이그레이션 스크립트, 관리 도구 등 데이터가 들어오는 경로는 하나가 아닙니다.
2. **버그 방어선**: 애플리케이션 버그로 검증이 누락되어도 DB가 마지막 방어선 역할을 합니다.
3. **자체 문서화**: 스키마를 보면 어떤 값이 허용되는지 바로 알 수 있습니다.

![열 제약의 역할과 검사 시점](/assets/posts/sql-constraints-not-null-default-check-overview.svg)

## NOT NULL

`NOT NULL`은 해당 열에 NULL 값이 들어오는 것을 차단합니다.

```sql
CREATE TABLE users (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      VARCHAR(200) NOT NULL,         -- 필수
    name       VARCHAR(100) NOT NULL,         -- 필수
    bio        TEXT,                          -- 선택 (NULL 허용)
    login_count INT         NOT NULL DEFAULT 0  -- 필수, 기본값 0
);
```

**"이 열이 항상 값을 가져야 하는가?"** — YES라면 `NOT NULL`. NO라면 NULL 허용(기본값).

NULL을 허용하는 열은 `IS NULL`, `IS NOT NULL`로 쿼리하고, `COALESCE`로 기본값을 제공합니다.

```sql
SELECT name, COALESCE(bio, '소개 없음') AS bio
FROM users;
```

## NULL의 세값 논리 (가장 중요한 함정)

SQL의 NULL은 "값 없음"이 아니라 "알 수 없음(UNKNOWN)"입니다. NULL과의 비교 결과는 항상 UNKNOWN이므로, 일반 비교 연산자(=, !=, <)로는 NULL을 찾을 수 없습니다.

![NULL의 세값 논리](/assets/posts/sql-constraints-not-null-default-check-null3val.svg)

```sql
-- 잘못된 쿼리: 항상 0행 반환
SELECT * FROM orders WHERE deleted_at = NULL;
SELECT * FROM orders WHERE deleted_at != NULL;

-- 올바른 쿼리
SELECT * FROM orders WHERE deleted_at IS NULL;
SELECT * FROM orders WHERE deleted_at IS NOT NULL;
```

`WHERE` 절에서 UNKNOWN은 행을 제외합니다. 이 때문에 NULL이 있는 열에 인덱스를 사용할 때도 주의가 필요합니다.

## DEFAULT

`DEFAULT`는 INSERT 시 해당 열의 값이 생략되면 자동으로 지정한 값을 사용합니다.

```sql
CREATE TABLE orders (
    status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retry_count INT        NOT NULL DEFAULT 0,
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE
);

-- created_at, status, is_active 생략 가능
INSERT INTO orders (customer_id, total) VALUES (1, 50000);
```

DEFAULT 값으로 다음을 사용할 수 있습니다.

| 유형 | 예시 |
|---|---|
| 리터럴 | `DEFAULT 0`, `DEFAULT 'pending'`, `DEFAULT TRUE` |
| 함수 | `DEFAULT now()`, `DEFAULT gen_random_uuid()` |
| 표현식 | `DEFAULT CURRENT_DATE + INTERVAL '30 days'` |

주의: DEFAULT는 열 값이 명시적으로 **생략**될 때만 적용됩니다. `INSERT INTO t (col) VALUES (NULL)`처럼 명시적으로 NULL을 넣으면 NOT NULL 제약을 위반합니다.

## CHECK

`CHECK`는 임의의 불리언 표현식으로 허용 값을 제한합니다. 표준 SQL에서 지원하며 대부분의 DBMS가 구현합니다.

```sql
CREATE TABLE products (
    id      BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    VARCHAR(200) NOT NULL,
    price   NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock   INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
    rating  NUMERIC(3,1)           CHECK (rating BETWEEN 0 AND 5),
    status  VARCHAR(20)   NOT NULL
            CHECK (status IN ('draft', 'published', 'archived'))
);
```

체크 제약에 이름을 붙이면 오류 추적이 쉬워집니다.

```sql
-- 이름 없는 제약: 오류 메시지 "check constraint violated"
-- 이름 있는 제약: 오류 메시지 "check_price_non_negative violated"
CONSTRAINT check_price_non_negative CHECK (price >= 0)
```

### 테이블 제약으로 여러 열 조합 검증

열 제약은 해당 열 하나만 참조할 수 있습니다. 여러 열을 조합해 검증해야 할 때는 테이블 제약을 사용합니다.

```sql
CREATE TABLE discount_rules (
    id         INT PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    discount   NUMERIC(5,2) NOT NULL,
    CONSTRAINT check_date_range   CHECK (end_date > start_date),
    CONSTRAINT check_discount_pct CHECK (discount > 0 AND discount <= 100)
);
```

## ALTER TABLE로 제약 추가/제거

기존 테이블에 제약을 추가하거나 제거할 수 있습니다.

```sql
-- 제약 추가
ALTER TABLE products
    ADD CONSTRAINT check_stock_non_negative CHECK (stock >= 0);

ALTER TABLE users
    ALTER COLUMN name SET NOT NULL;

ALTER TABLE orders
    ALTER COLUMN status SET DEFAULT 'pending';

-- 제약 제거
ALTER TABLE products
    DROP CONSTRAINT check_stock_non_negative;

ALTER TABLE users
    ALTER COLUMN bio DROP NOT NULL;
```

대규모 테이블에서 `NOT NULL` 추가는 기존 NULL 값을 먼저 업데이트해야 하므로 주의가 필요합니다.

## 정리

| 제약 | 목적 | 핵심 규칙 |
|---|---|---|
| `NOT NULL` | NULL 차단 | `IS NULL` / `IS NOT NULL`으로 비교 |
| `DEFAULT` | 기본값 자동 삽입 | 생략 시만 적용, 명시적 NULL에는 적용 안 됨 |
| `CHECK` | 값 범위·패턴 검증 | 이름 부여 권장, 다중 열은 테이블 제약 |

다음 글에서는 기본 키 설계의 원칙과 자연 키 vs 대리 키 논쟁을 다룹니다.

---

**지난 글:** [날짜와 시간 데이터 타입 — TIMESTAMP, DATE, INTERVAL 완전 정복](/posts/sql-data-types-datetime/)

**다음 글:** [기본 키 설계 원칙](/posts/sql-primary-key-design/)

<br>
읽어주셔서 감사합니다. 😊
