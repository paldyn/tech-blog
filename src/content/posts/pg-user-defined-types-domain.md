---
title: "사용자 정의 타입과 도메인 — CREATE TYPE, CREATE DOMAIN"
description: "PostgreSQL CREATE DOMAIN으로 제약을 내재화한 재사용 타입을 만들고, CREATE TYPE으로 ENUM·복합 타입·범위 타입을 정의하는 방법, 실전 이메일·상태 코드·주소 타입 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["postgresql", "domain", "enum", "composite-type", "create-type", "create-domain", "type-system", "check-constraint"]
featured: false
draft: false
---

[지난 글](/posts/pg-range-types/)에서 범위 타입으로 겹침 방지 제약을 구현하는 방법을 살펴봤다. 이번에는 PostgreSQL의 **사용자 정의 타입 시스템** 전반을 다룬다. 제약을 타입 레이어에 내재화하면 테이블마다 반복되던 CHECK 조건이 사라지고 코드가 단순해진다.

## 왜 사용자 정의 타입인가

```sql
-- 반복되는 패턴
CREATE TABLE users (
    email varchar(255) CHECK (email ~ '^[^@]+@[^@]+\.[^@]+'),
    ...
);
CREATE TABLE subscriptions (
    contact_email varchar(255) CHECK (contact_email ~ '^[^@]+@[^@]+\.[^@]+'),
    ...
);
```

같은 CHECK 조건이 여러 테이블에 복사된다. 정규식이 바뀌면 모든 테이블을 수정해야 한다. `DOMAIN`은 이 문제를 해결한다.

![사용자 정의 타입 분류](/assets/posts/pg-user-defined-types-domain-overview.svg)

## CREATE DOMAIN

`DOMAIN`은 기존 타입에 이름·제약·기본값을 추가한 **재사용 가능한 타입 별칭**이다.

```sql
-- 이메일 도메인
CREATE DOMAIN email_addr AS text
    NOT NULL
    CHECK (VALUE ~ '^[^@]+@[^@]+\.[^@]+');

-- 양수 금액
CREATE DOMAIN positive_amount AS numeric(18,4)
    CHECK (VALUE > 0);

-- 국가 코드 (ISO 2자리)
CREATE DOMAIN country_code AS char(2)
    DEFAULT 'KR'
    CHECK (VALUE ~ '^[A-Z]{2}$');

-- 전화번호 (한국)
CREATE DOMAIN kr_phone AS varchar(20)
    CHECK (VALUE ~ '^\+82\d{9,10}$' OR VALUE ~ '^0\d{9,10}$');
```

```sql
-- 테이블에서 바로 사용
CREATE TABLE users (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email   email_addr,           -- NOT NULL + 정규식 검증
    country country_code,         -- DEFAULT 'KR' 포함
    balance positive_amount DEFAULT 0
);
```

### DOMAIN 제약 수정

```sql
-- 제약 추가
ALTER DOMAIN positive_amount
    ADD CONSTRAINT chk_max CHECK (VALUE <= 1000000000);

-- 제약 제거
ALTER DOMAIN positive_amount
    DROP CONSTRAINT chk_max;

-- 기본값 변경
ALTER DOMAIN country_code SET DEFAULT 'US';

-- NOT NULL 추가/제거
ALTER DOMAIN kr_phone SET NOT NULL;
ALTER DOMAIN kr_phone DROP NOT NULL;
```

## CREATE TYPE — ENUM

열거형은 허용된 레이블 집합을 정의한다. 내부적으로는 OID 정수로 저장되며, 정렬 순서는 정의 순서를 따른다.

```sql
CREATE TYPE order_status AS ENUM (
    'pending', 'paid', 'shipped', 'delivered', 'cancelled'
);

CREATE TABLE orders (
    id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status order_status NOT NULL DEFAULT 'pending'
);
```

```sql
-- 비교 연산 (정의 순서 기준)
SELECT * FROM orders WHERE status > 'paid';  -- shipped, delivered, cancelled

-- 유효 값만 허용
UPDATE orders SET status = 'unknown' WHERE id = 1;
-- ERROR: invalid input value for enum order_status: "unknown"
```

![DOMAIN과 ENUM 실전 코드](/assets/posts/pg-user-defined-types-domain-code.svg)

### ENUM 레이블 추가

`ALTER TYPE ... ADD VALUE`는 트랜잭션 블록 밖에서 실행해야 한다(pg 12 이전). pg 13+에서는 이 제한이 완화됐다.

```sql
-- 새 레이블 삽입 위치 지정
ALTER TYPE order_status ADD VALUE 'refunded' AFTER 'cancelled';
ALTER TYPE order_status ADD VALUE 'processing' BEFORE 'shipped';

-- 이미 있는지 확인 후 추가
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned';
```

**주의**: ENUM 레이블은 추가만 가능하고, **삭제나 이름 변경은 불가**하다. 레이블을 없애야 한다면 새 타입을 만들고 컬럼을 마이그레이션해야 한다.

### ENUM vs 조회 테이블

| 기준 | ENUM | 조회 테이블 |
|------|------|------------|
| 값 추가 | DDL 필요 | INSERT로 가능 |
| 값 삭제/변경 | 불가 | 가능 |
| FK 참조 | 불필요 | FK로 보장 |
| 저장 공간 | 작음 | 조인 오버헤드 |
| 적합 상황 | 안정적 고정 집합 | 런타임 변경 필요 |

## CREATE TYPE — 복합 타입 (Composite)

여러 필드를 하나의 타입으로 묶는다. 함수 반환 타입이나 테이블 컬럼으로 사용한다.

```sql
-- 주소 복합 타입
CREATE TYPE address AS (
    street  text,
    city    text,
    zip     varchar(10),
    country country_code
);

-- 연락처 복합 타입
CREATE TYPE contact_info AS (
    phone   kr_phone,
    email   email_addr
);

-- 테이블에서 사용
CREATE TABLE company (
    id          bigint PRIMARY KEY,
    name        text NOT NULL,
    hq_address  address,
    contact     contact_info
);
```

```sql
-- 복합 타입 필드 접근 (괄호 필요)
SELECT (hq_address).city, (contact).email
FROM company
WHERE id = 1;

-- 삽입
INSERT INTO company VALUES (
    1, 'ACME Corp',
    ROW('강남대로 1', '서울', '06236', 'KR'),
    ROW('+82101234567', 'acme@example.com')
);
```

## CREATE TYPE — 사용자 정의 범위

```sql
-- float8range 정의 (내장되지 않은 타입)
CREATE TYPE float8range AS RANGE (
    subtype = float8,
    subtype_diff = float8mi
);

-- 사용
SELECT '[1.5, 3.7]'::float8range @> 2.5;  -- true
SELECT float8range(0.0, 1.0, '[)') && float8range(0.5, 1.5, '[)');  -- true
```

## 타입 조회

```sql
-- 현재 DB의 사용자 정의 타입 목록
SELECT typname, typtype, typbasetype::regtype AS base_type
FROM pg_type
WHERE typnamespace = 'public'::regnamespace
  AND typtype IN ('d', 'e', 'c', 'r')  -- domain, enum, composite, range
ORDER BY typtype, typname;

-- ENUM 레이블 조회
SELECT enumlabel, enumsortorder
FROM pg_enum
WHERE enumtypid = 'order_status'::regtype
ORDER BY enumsortorder;
```

## 정리

`CREATE DOMAIN`은 "여러 테이블에서 공유하는 제약"을 타입으로 올리는 도구다. 이메일, 전화번호, 양수 금액처럼 반복되는 검증 패턴에 적합하다. `CREATE TYPE ENUM`은 상태 코드처럼 고정된 집합을 명시적으로 관리한다. 복합 타입은 주소·연락처처럼 묶음이 자연스러운 데이터에 유용하다. 세 도구를 조합하면 스키마 자체가 비즈니스 규칙을 문서화하는 효과가 생긴다.

---

**지난 글:** [PostgreSQL 범위 타입 — daterange, tstzrange와 겹침 방지](/posts/pg-range-types/)

**다음 글:** [IDENTITY vs SEQUENCE — 자동 증가 키 생성 전략](/posts/pg-identity-vs-sequence/)

<br>
읽어주셔서 감사합니다. 😊
