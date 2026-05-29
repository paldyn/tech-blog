---
title: "기본 키 설계 원칙 — 자연 키 vs 대리 키, BIGINT vs UUID"
description: "기본 키의 역할과 설계 원칙을 정리하고, 자연 키 vs 대리 키 논쟁, BIGINT vs UUID vs UUIDv7, 복합 기본 키의 트레이드오프를 실무 기준으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["SQL", "기본 키", "PK 설계", "UUID", "BIGINT", "대리 키", "자연 키"]
featured: false
draft: false
---

[지난 글](/posts/sql-constraints-not-null-default-check/)에서 NOT NULL, DEFAULT, CHECK 제약을 살펴봤습니다. 이번에는 테이블 설계의 가장 기본적이면서도 중요한 결정인 **기본 키(Primary Key) 설계**를 다룹니다. PK는 한번 정하면 바꾸기 어렵기 때문에 처음부터 신중하게 선택해야 합니다.

## 기본 키가 해야 하는 일

기본 키는 다음 세 가지를 보장해야 합니다.

1. **유일성(Uniqueness)**: 테이블 안에서 같은 값이 없어야 합니다.
2. **불변성(Immutability)**: 한번 부여된 PK 값은 변경되지 않아야 합니다. FK로 참조된 후 PK가 변경되면 연쇄 업데이트가 발생합니다.
3. **비NULL성(Non-null)**: NULL이 되어선 안 됩니다.

이 세 가지를 충족하는 설계가 **좋은 기본 키**입니다.

## 자연 키 vs 대리 키

![기본 키 전략 비교](/assets/posts/sql-primary-key-design-types.svg)

### 자연 키(Natural Key)

비즈니스 의미를 가진 실제 속성을 PK로 사용합니다.

```sql
-- 이메일을 PK로 사용하는 예 (위험)
CREATE TABLE users (
    email  VARCHAR(200) PRIMARY KEY,
    name   VARCHAR(100) NOT NULL
);
```

이 방식의 문제점은 다음과 같습니다.

- **변경 가능성**: 이메일은 변경될 수 있습니다. PK가 변경되면 모든 FK 참조도 연쇄 업데이트됩니다.
- **개인정보**: 주민등록번호, 이메일 같은 개인정보를 PK로 쓰면 로그, 파티션 키 등에 개인정보가 노출됩니다.
- **길이**: 문자열 PK는 인덱스 크기가 커지고 JOIN 성능이 떨어집니다.

### 대리 키(Surrogate Key)

비즈니스와 무관한 기술적 식별자를 사용합니다.

```sql
-- BIGINT 자동 증가 (단일 서버)
CREATE TABLE users (
    id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email  VARCHAR(200) NOT NULL UNIQUE,
    name   VARCHAR(100) NOT NULL
);
```

대리 키는 불변이고 짧으며 비즈니스 로직과 독립적입니다. **실무에서는 대리 키를 기본으로 선택**하고, 자연 키는 `UNIQUE` 제약으로 별도 관리합니다.

## BIGINT vs UUID 선택 기준

### BIGINT IDENTITY / AUTO_INCREMENT

```sql
-- PostgreSQL (SQL 표준)
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- MySQL
id BIGINT AUTO_INCREMENT PRIMARY KEY

-- Oracle
id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

장점: 8바이트, 정렬 가능, 순차 삽입 → 클러스터드 인덱스 단편화 최소화.

단점: 단일 시퀀스이므로 분산 환경에서 충돌 또는 병목 가능.

### UUID v4

```sql
-- PostgreSQL (pgcrypto 또는 built-in)
id UUID DEFAULT gen_random_uuid() PRIMARY KEY
```

장점: 전역 유일성, 외부에 ID 노출해도 예측 불가능.

단점: 16바이트(문자열로 36바이트), **완전 랜덤이라 B-Tree 인덱스 페이지 단편화 심각** → 삽입 성능 저하.

### UUID v7 / ULID (권장 절충안)

```sql
-- UUID v7: 시간 접두사 + 랜덤 (PostgreSQL 17+ 지원)
id UUID DEFAULT gen_random_uuid() PRIMARY KEY  -- 버전 확인 필요

-- ULID: 26자리 Base32 문자열 (애플리케이션에서 생성)
-- 예: 01ARZ3NDEKTSV4RRFFQ69G5FAV
```

UUID v7과 ULID는 **시간 순서로 정렬 가능**합니다. 분산 환경에서도 충돌이 없고, 순차 삽입에 가까운 패턴이므로 인덱스 단편화 문제가 크게 줄어듭니다.

## 복합 기본 키

관계 테이블(N:M 중간 테이블)에서는 복합 PK가 자연스럽습니다.

![복합 기본 키 vs 대리 키 + UNIQUE](/assets/posts/sql-primary-key-design-composite.svg)

```sql
-- 복합 PK: order_items
CREATE TABLE order_items (
    order_id   BIGINT NOT NULL REFERENCES orders(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity   INT    NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, product_id)
);

-- 이 테이블을 다른 테이블이 참조할 때:
FOREIGN KEY (order_id, product_id) REFERENCES order_items(order_id, product_id)
-- → FK에 두 열을 모두 포함해야 하는 번거로움
```

ORM을 사용하거나 이 테이블을 다른 곳에서 FK로 참조할 가능성이 있다면, 대리 키를 추가하고 복합 열은 UNIQUE로 관리하는 것이 더 유연합니다.

## PK 설계 체크리스트

```sql
-- 좋은 PK 설계 예시
CREATE TABLE products (
    -- 1. 대리 키 + NOT NULL (자동)
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- 2. 자연 식별자는 UNIQUE로 별도 관리
    sku          VARCHAR(50) NOT NULL UNIQUE,

    -- 3. 비즈니스 속성은 별도 열로
    name         VARCHAR(200) NOT NULL,
    price        NUMERIC(12,2) NOT NULL CHECK (price >= 0),

    -- 4. 감사 열 (audit columns)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| 항목 | 권장 |
|---|---|
| 타입 | 단일 서버: `BIGINT IDENTITY`, 분산: `UUIDv7` |
| 크기 | 가능한 작게 (INT보다 BIGINT 권장) |
| 변경 가능성 | 절대 변경되지 않는 값만 |
| 비즈니스 의미 | 자연 키를 쓰더라도 불변·유일성 보장 확인 필수 |
| 복합 PK | ORM 사용 시 대리 키 + UNIQUE 선호 |

## 정리

기본 키는 테이블의 "DNA"입니다. 나중에 변경하면 FK 연쇄, 인덱스 재구성, 데이터 마이그레이션의 비용이 크므로 초기 설계가 중요합니다. 단일 서버라면 `BIGINT GENERATED ALWAYS AS IDENTITY`, 분산·마이크로서비스 환경이라면 `UUIDv7`이나 `ULID`를 기본으로 선택하고, 비즈니스 식별자는 별도 `UNIQUE` 제약으로 관리하는 패턴을 권장합니다.

---

**지난 글:** [NOT NULL, DEFAULT, CHECK 제약 — 데이터 품질을 DB에서 보장하는 방법](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
