---
title: "CREATE TABLE 기초 — 테이블을 만드는 방법"
description: "CREATE TABLE 문의 전체 구조를 해부하고, 열 정의·제약·외래 키·ON DELETE 옵션까지 실무 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQL", "CREATE TABLE", "DDL", "테이블 설계", "외래 키"]
featured: false
draft: false
---

[지난 글](/posts/sql-language-categories/)에서 DDL이 구조를 정의하고 자동으로 커밋된다는 특성을 배웠습니다. 이번 글에서는 DDL의 가장 중요한 문인 `CREATE TABLE`을 해부합니다. 단순히 문법을 외우는 것이 아니라, 각 구성 요소가 왜 존재하고 실무에서 어떻게 활용되는지를 중점으로 설명합니다.

## CREATE TABLE 전체 구조

```sql
CREATE TABLE [IF NOT EXISTS] [스키마명.]테이블명 (
    열이름1  데이터타입  [열 제약 ...],
    열이름2  데이터타입  [열 제약 ...],
    ...
    [테이블 제약 ...]
);
```

각 요소를 순서대로 살펴봅니다.

![CREATE TABLE 구문 해부](/assets/posts/sql-create-table-basics-anatomy.svg)

## 열 정의

열 하나의 기본 형식은 다음과 같습니다.

```
열이름  데이터타입  [NOT NULL | NULL]  [DEFAULT 값]  [기타 제약]
```

### 데이터 타입 선택

데이터 타입은 저장 공간과 허용 값 범위를 결정합니다. 잘못 선택하면 나중에 `ALTER TABLE`로 변환해야 하는데, 대규모 테이블에서는 비용이 큽니다.

| 상황 | 권장 타입 |
|---|---|
| 고유 식별자 (자동 증가) | `BIGINT GENERATED ALWAYS AS IDENTITY` (ANSI) |
| 금액, 정밀 수치 | `NUMERIC(정밀도, 소수점)` |
| 짧은 코드 값 | `VARCHAR(n)` 또는 `CHAR(n)` |
| 긴 텍스트 | `TEXT` (PostgreSQL) / `CLOB` (Oracle) |
| 날짜+시간+타임존 | `TIMESTAMPTZ` (PG) / `TIMESTAMP WITH TIME ZONE` |
| 불리언 | `BOOLEAN` |

## 열 제약 vs 테이블 제약

제약은 선언 위치에 따라 두 종류로 나뉩니다.

**열 제약(Column Constraint)**: 특정 열 정의 옆에 작성합니다.

```sql
name VARCHAR(100) NOT NULL,
code CHAR(10)     UNIQUE
```

**테이블 제약(Table Constraint)**: 열 정의가 끝난 후 별도로 작성합니다. 여러 열을 묶어서 지정할 때 필수입니다.

```sql
CREATE TABLE order_items (
    order_id    INT NOT NULL,
    product_id  INT NOT NULL,
    quantity    INT NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, product_id),  -- 복합 기본 키 → 테이블 제약
    FOREIGN KEY (order_id)   REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

`CONSTRAINT 이름` 키워드로 제약에 이름을 붙이면, 오류 메시지에서 어떤 제약을 위반했는지 바로 알 수 있고 나중에 `ALTER TABLE DROP CONSTRAINT`로 제거도 쉽습니다.

## IF NOT EXISTS

```sql
CREATE TABLE IF NOT EXISTS settings (
    key   VARCHAR(100) PRIMARY KEY,
    value TEXT
);
```

테이블이 이미 존재하면 오류 대신 무시하고 넘어갑니다. **마이그레이션 스크립트를 멱등(Idempotent)하게** 만들 때 유용합니다. 다만 기존 테이블의 구조가 다를 경우에도 변경하지 않으므로 주의가 필요합니다.

## ON DELETE / ON UPDATE 옵션

외래 키는 참조 무결성 외에도 부모 행이 삭제되거나 키가 변경될 때 자식 행을 어떻게 처리할지 제어합니다.

![ON DELETE / ON UPDATE 옵션](/assets/posts/sql-create-table-basics-fk-action.svg)

실무에서 가장 흔히 쓰는 패턴은 다음과 같습니다.

```sql
-- 사용자가 탈퇴하면 주문 이력도 삭제 (강한 종속 관계)
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- 담당자가 퇴사하면 담당 없음으로 처리 (약한 관계)
FOREIGN KEY (assignee_id) REFERENCES employees(id) ON DELETE SET NULL
```

`CASCADE`는 편리하지만 연쇄 삭제가 예상보다 넓게 퍼질 수 있으므로, 중요한 데이터에는 `RESTRICT`(기본값)를 유지하고 애플리케이션에서 명시적으로 처리하는 것을 권장합니다.

## 실습: 전자상거래 기본 스키마

```sql
-- 고객 테이블
CREATE TABLE customers (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      VARCHAR(200) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 상품 테이블
CREATE TABLE products (
    id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock       INT           NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

-- 주문 테이블
CREATE TABLE orders (
    id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT       NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
    total       NUMERIC(12,2) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT
);
```

## 정리

- `CREATE TABLE`은 열이름 + 타입 + 제약으로 구성됩니다.
- 복합 키·FK처럼 여러 열을 묶는 제약은 **테이블 제약**으로 정의합니다.
- `CONSTRAINT 이름`으로 제약 이름을 붙이면 운영과 디버깅이 쉬워집니다.
- `ON DELETE` 옵션은 신중하게 선택하고, CASCADE는 연쇄 범위를 확인한 후 사용합니다.

다음 글에서는 각 데이터 타입의 의미와 선택 기준을 더 깊이 살펴봅니다.

---

**지난 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL](/posts/sql-language-categories/)

**다음 글:** [숫자·문자·불리언 데이터 타입](/posts/sql-data-types-numeric-string-bool/)

<br>
읽어주셔서 감사합니다. 😊
