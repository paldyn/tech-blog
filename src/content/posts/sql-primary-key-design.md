---
title: "기본 키 설계 전략 — 자연키 vs 대리키, UUID vs BIGINT"
description: "자연 키와 대리 키의 차이, BIGINT AUTO INCREMENT와 UUID의 장단점, 그리고 복합 기본 키 설계 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["SQL", "기본 키", "PK 설계", "UUID", "BIGINT", "자연키"]
featured: false
draft: false
---

[지난 글](/posts/sql-constraints-not-null-default-check/)에서 NOT NULL·DEFAULT·CHECK 제약조건과 NULL의 3값 논리를 살펴봤습니다. 이번에는 테이블 설계에서 가장 중요한 결정 중 하나인 **기본 키(Primary Key) 설계 전략**을 다룹니다. 잘못된 PK 선택은 나중에 마이그레이션 비용이 매우 크므로 처음부터 신중하게 결정해야 합니다.

## 기본 키의 조건

기본 키는 두 가지 성질을 반드시 만족해야 합니다.

1. **유일성(Uniqueness)**: 테이블 내 모든 행에서 값이 달라야 합니다.
2. **NOT NULL**: 기본 키 컬럼은 NULL을 가질 수 없습니다.

```sql
-- 기본 키 선언의 효과
-- 1. UNIQUE 인덱스 자동 생성
-- 2. NOT NULL 강제
-- 3. 외래 키의 참조 대상으로 사용 가능
CREATE TABLE products (
    product_id INT PRIMARY KEY,  -- UNIQUE + NOT NULL 자동 적용
    name       VARCHAR(200) NOT NULL
);
```

## 자연 키 vs 대리 키

![기본 키 설계 전략 비교](/assets/posts/sql-primary-key-design-comparison.svg)

### 자연 키(Natural Key)

업무적으로 의미가 있는 값을 PK로 사용합니다.

```sql
-- 자연 키 예시: 국가 코드 (변경 가능성 낮음)
CREATE TABLE countries (
    country_code CHAR(2)     PRIMARY KEY,  -- 'KR', 'US', 'JP'
    name         VARCHAR(100) NOT NULL
);

-- 자연 키 예시: 이메일 (변경 가능 → 나중에 문제)
-- ✗ 권장하지 않음
CREATE TABLE users (
    email    VARCHAR(320) PRIMARY KEY,
    username VARCHAR(50)  NOT NULL
);
```

자연 키는 값이 변경될 때 그 키를 참조하는 모든 외래 키도 함께 변경해야 하는 부담이 있습니다. 이메일이나 전화번호 같은 변경 가능한 값은 자연 키로 피하는 것이 좋습니다.

### 대리 키(Surrogate Key) — BIGINT

DB가 자동으로 생성하는 순차 숫자 ID입니다. 가장 일반적인 선택입니다.

```sql
-- SQL:2003 표준 (PostgreSQL 10+, Oracle 12c+)
CREATE TABLE orders (
    order_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id INT   NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MySQL / MariaDB
CREATE TABLE orders (
    order_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT   NOT NULL
);

-- PostgreSQL 전통 방식 (내부적으로 SEQUENCE + DEFAULT)
CREATE TABLE orders (
    order_id   BIGSERIAL PRIMARY KEY,
    customer_id INT NOT NULL
);
```

순차 BIGINT는 B-Tree 인덱스에 최적화되어 있고(항상 오른쪽 끝에 삽입), 크기가 작아(8 bytes) JOIN에서 빠릅니다. 단, 노출된 URL에서 `?id=1234` 같은 순번 예측이 가능하다는 보안 취약점이 있습니다.

### 대리 키 — UUID

전 세계적으로 유일한 128비트 랜덤 ID입니다.

```sql
-- PostgreSQL: UUID v4 (랜덤)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE sessions (
    session_id UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PostgreSQL 17+ / pgcrypto: UUID v7 (시간순, 인덱스 친화적)
-- SELECT gen_random_uuid() -- v4
-- uuidv7() 함수 (확장 필요)
```

UUID v4는 완전 랜덤이라 B-Tree 인덱스에서 **페이지 분열(page split)** 이 자주 발생해 삽입 성능이 나쁩니다. UUID v7이나 ULID는 앞부분에 타임스탬프가 들어가 시간순 정렬이 유지되어 이 문제를 해결합니다.

![기본 키 정의 패턴 — DBMS별](/assets/posts/sql-primary-key-design-code.svg)

## 복합 기본 키(Composite Primary Key)

두 개 이상의 열을 합쳐 PK를 구성합니다. 연결 테이블(교차 테이블)에서 자주 사용됩니다.

```sql
-- 많이 쓰이는 패턴: user_id와 product_id 조합이 유일
CREATE TABLE wishlist (
    user_id    INT NOT NULL REFERENCES users(user_id),
    product_id INT NOT NULL REFERENCES products(product_id),
    added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_wishlist PRIMARY KEY (user_id, product_id)
);

-- 조회 시 두 컬럼 모두 WHERE에 사용해야 인덱스 효율적
SELECT * FROM wishlist WHERE user_id = 123 AND product_id = 456;
SELECT * FROM wishlist WHERE user_id = 123;  -- user_id가 앞에 있어 OK
SELECT * FROM wishlist WHERE product_id = 456;  -- product_id만 쓰면 비효율적
```

복합 PK 대신 단순 대리 키 + UNIQUE 제약을 쓰는 방법도 있습니다.

```sql
-- 대안: 대리 키 + UNIQUE 제약
CREATE TABLE wishlist (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(user_id),
    product_id INT NOT NULL REFERENCES products(product_id),
    added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_wishlist UNIQUE (user_id, product_id)
);
```

## PK 선택 가이드

| 상황 | 권장 PK |
|------|---------|
| 단일 DB, 내부 시스템 | `BIGINT GENERATED ALWAYS AS IDENTITY` |
| 분산 DB, 마이크로서비스 | UUID v7 / ULID |
| 공개 API (ID 노출 불가) | UUID v4 또는 v7 |
| 작은 참조 테이블 (국가, 카테고리) | 자연 키(`CHAR(2)`, `VARCHAR(20)`) |
| 다대다 연결 테이블 | 복합 PK 또는 대리 키 + UNIQUE |

## 실수하기 쉬운 패턴

```sql
-- ✗ 이메일을 PK로 사용 — 변경 시 모든 FK 갱신 필요
CREATE TABLE users (email VARCHAR(320) PRIMARY KEY);

-- ✗ INT(4바이트)를 PK로 사용 — 20억건 초과 시 오버플로
CREATE TABLE events (id INT PRIMARY KEY);  -- 대규모 로그 테이블에 위험

-- ✓ 올바른 선택
CREATE TABLE events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);
```

## 정리

- PK는 유일성 + NOT NULL이 보장되어야 합니다.
- 대부분의 경우 **`BIGINT GENERATED ALWAYS AS IDENTITY`** 가 가장 적합합니다.
- 분산 환경이나 ID 노출을 피해야 한다면 **UUID v7** 또는 **ULID**를 사용합니다.
- 자연 키는 변경 가능성이 없는 외부 표준 코드(ISO 국가 코드 등)에만 사용합니다.
- 복합 PK에서는 열 순서가 인덱스 활용에 영향을 줍니다.

이것으로 SQL 완전 정복 시리즈의 기초 10편을 마칩니다. 다음 편에서는 외래 키와 참조 무결성을 본격적으로 살펴봅니다.

---

**지난 글:** [NOT NULL·DEFAULT·CHECK 제약조건 완전 정복](/posts/sql-constraints-not-null-default-check/)

**다음 글:** [외래 키와 참조 무결성 — ON DELETE·ON UPDATE 옵션](/posts/sql-foreign-key-referential-integrity/)

<br>
읽어주셔서 감사합니다. 😊
