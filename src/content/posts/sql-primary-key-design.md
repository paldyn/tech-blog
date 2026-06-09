---
title: "기본 키 설계: 자연 키 vs 대리 키"
description: "기본 키의 역할과 조건, 자연 키·대리 키의 트레이드오프, BIGINT IDENTITY·UUID·ULID의 차이, 복합 기본 키의 올바른 사용법을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["기본키", "PRIMARY KEY", "자연키", "대리키", "UUID", "ULID", "Snowflake", "기본키설계"]
featured: false
draft: false
---

[지난 글](/posts/sql-constraints-not-null-default-check/)에서 NOT NULL·DEFAULT·CHECK 제약 조건을 살펴봤다. 제약 조건 중 가장 중요한 것이 기본 키(Primary Key)다. 기본 키 설계 결정은 나중에 바꾸기 매우 어려우므로 처음부터 신중하게 선택해야 한다.

## 기본 키의 역할

기본 키는 테이블에서 각 행을 유일하게 식별하는 열(또는 열의 조합)이다. RDBMS가 기본 키에 자동으로 적용하는 조건은 두 가지다.

- **유일성(Uniqueness)**: 같은 값이 두 번 나타날 수 없다
- **NOT NULL**: NULL이 허용되지 않는다

```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,  -- 자동으로 NOT NULL + UNIQUE
    ...
);
-- 동일: id BIGINT NOT NULL UNIQUE
```

또한 기본 키 컬럼에는 자동으로 인덱스가 생성된다. PostgreSQL·Oracle은 B-Tree 인덱스, MySQL InnoDB는 클러스터드 인덱스(clustered index)로 기본 키를 기준으로 물리적 데이터를 정렬한다.

## 자연 키 vs 대리 키

![기본 키 유형 비교](/assets/posts/sql-primary-key-design-types.svg)

### 자연 키 (Natural Key)

비즈니스 세계에서 이미 의미를 가지는 속성을 기본 키로 사용하는 방법이다.

```sql
-- 주민등록번호, 사업자번호, ISBN 등
CREATE TABLE books (
    isbn   CHAR(13) PRIMARY KEY,   -- ISBN-13
    title  VARCHAR(500) NOT NULL,
    author VARCHAR(200)
);
```

**장점**: 추가 컬럼 없이 식별 가능, 비즈니스 의미가 명확하다.

**단점**: 자연 키는 바뀔 수 있다. ISBN 형식이 바뀌거나, 사업자번호가 정정되거나, 이메일 주소가 변경되면 해당 컬럼을 참조하는 모든 FK도 업데이트해야 한다. 또한 외부 기관이 관리하는 식별 체계에 종속된다.

### 대리 키 (Surrogate Key)

비즈니스 의미 없이 오직 식별 목적으로 생성하는 값이다. 가장 흔한 형태는 자동 증가 정수다.

```sql
-- 대리 키: 의미 없는 자동 증가 정수
CREATE TABLE books (
    id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    isbn   CHAR(13) UNIQUE,   -- ISBN은 UNIQUE로 강제, PK는 아님
    title  VARCHAR(500) NOT NULL
);
```

실무에서는 대리 키를 쓰는 것이 일반적이다. ISBN이 바뀌어도 `id`는 변하지 않으므로 FK 연쇄 업데이트가 없다.

## 대리 키의 세 가지 방식

![기본 키 설계 트레이드오프](/assets/posts/sql-primary-key-design-tradeoffs.svg)

### BIGINT IDENTITY (순차 정수)

가장 단순하고 빠르다. 단일 DB 환경에서 성능이 최우선일 때 선택한다.

```sql
-- PostgreSQL
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- MySQL
id BIGINT AUTO_INCREMENT PRIMARY KEY

-- SQL Server
id BIGINT IDENTITY(1,1) PRIMARY KEY
```

**보안 주의**: URL에 `GET /orders/42`처럼 순차 ID를 노출하면 공격자가 다른 주문을 열거(enumeration)할 수 있다. 외부에 노출되는 API에서는 UUID를 쓰거나 별도 퍼블릭 ID 컬럼을 두는 것이 안전하다.

### UUID v4 (랜덤 128비트)

분산 환경에서 DB 없이 ID를 생성할 수 있다. 전역적으로 고유하며 예측이 불가하다.

```sql
-- PostgreSQL
id UUID DEFAULT gen_random_uuid() PRIMARY KEY

-- MySQL 8
id CHAR(36) DEFAULT (UUID()) PRIMARY KEY
```

**단점**: 완전 랜덤이라 B-Tree 인덱스에서 **페이지 분열(page split)**이 자주 발생한다. 삽입이 많은 테이블에서 성능이 BIGINT보다 크게 떨어질 수 있다. MySQL InnoDB에서는 특히 심각하다.

### ULID / UUID v7 (시간 정렬 가능)

UUID의 랜덤성과 BIGINT의 정렬 가능성을 조합한 형태다. 앞 부분에 타임스탬프가 들어가서 삽입 순서대로 정렬된다.

```sql
-- PostgreSQL: UUID v7 (pg_uuidv7 확장)
CREATE EXTENSION IF NOT EXISTS pg_uuidv7;
id UUID DEFAULT uuid_generate_v7() PRIMARY KEY
```

분산 시스템에서 순서가 의미 있는 이벤트 로그, 메시지 시스템에 적합하다.

## 복합 기본 키 (Composite Primary Key)

두 개 이상의 열이 합쳐져서 행을 유일하게 식별하는 경우다.

```sql
-- 다대다 관계 중간 테이블: 두 외래 키가 복합 PK
CREATE TABLE order_items (
    order_id   BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    qty        INTEGER NOT NULL DEFAULT 1,
    price      NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (order_id, product_id),   -- 복합 기본 키
    FOREIGN KEY (order_id)   REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

복합 기본 키는 자연스러운 경우(다대다 중간 테이블 등)에만 사용한다. 남용하면 FK 참조가 복잡해진다.

## 기본 키 설계 원칙 요약

| 상황 | 권장 |
|------|------|
| 단일 DB, 성능 최우선 | `BIGINT IDENTITY` |
| 분산 환경, 외부 노출 ID | `UUID v4` |
| 분산 환경, 시간순 정렬 필요 | `ULID` 또는 `UUID v7` |
| 다대다 중간 테이블 | 복합 기본 키 |
| 비즈니스 코드가 변하지 않는 경우 | 자연 키 고려 가능 |

한 가지 원칙: **기본 키는 절대 비즈니스 로직에 의해 변경되어서는 안 된다**. 변경 가능성이 있는 속성은 기본 키가 아니라 UNIQUE 제약이 있는 일반 열로 두어라.

---

**지난 글:** [제약 조건 기초: NOT NULL·DEFAULT·CHECK](/posts/sql-constraints-not-null-default-check/)

**다음 글:** [외래 키와 참조 무결성](/posts/sql-foreign-key-referential-integrity/)

<br>
읽어주셔서 감사합니다. 😊
