---
title: "CREATE TABLE 기초 — 테이블 설계의 시작"
description: "CREATE TABLE 문법의 구성 요소(열 이름, 데이터 타입, 제약조건, 스키마 접두사)와 IF NOT EXISTS, CTAS 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQL", "CREATE TABLE", "DDL", "테이블 설계"]
featured: false
draft: false
---

[지난 글](/posts/sql-language-categories/)에서 SQL 명령을 DDL·DML·DCL·TCL로 분류하는 방법을 배웠습니다. 이제 DDL의 핵심 명령인 `CREATE TABLE`을 자세히 살펴볼 차례입니다. 데이터베이스 작업의 출발점이 되는 테이블을 어떻게 정의하는지, 그리고 자주 쓰이는 패턴들을 정리합니다.

## 기본 구조

`CREATE TABLE` 문은 **테이블 이름**과 괄호 안의 **열 목록**, 그리고 선택적 **테이블 제약조건**으로 구성됩니다.

```sql
CREATE TABLE schema_name.table_name (
    column_name  data_type  [column_constraints],
    ...
    [table_constraints]
);
```

![CREATE TABLE 문 해부](/assets/posts/sql-create-table-basics-anatomy.svg)

## 스키마(Schema)

테이블은 **스키마**라는 네임스페이스 안에 있습니다. 스키마를 명시하지 않으면 현재 기본 스키마(PostgreSQL: `public`, Oracle: 현재 사용자 스키마)에 생성됩니다.

```sql
-- 스키마 생성
CREATE SCHEMA hr;

-- 스키마 지정해 테이블 생성
CREATE TABLE hr.employees (
    employee_id  INT  PRIMARY KEY,
    name         VARCHAR(100) NOT NULL
);
```

## 열 정의: 이름 + 타입 + 제약조건

각 열은 **이름**, **데이터 타입**, 선택적 **열 제약조건** 순으로 정의합니다.

```sql
CREATE TABLE products (
    -- 자동 증가 ID (PostgreSQL: SERIAL, SQL:2003: GENERATED ALWAYS AS IDENTITY)
    product_id  INT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    price       NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock       INT            NOT NULL DEFAULT 0,
    -- 계산 열 (SQL:2003, PostgreSQL 12+)
    stock_value NUMERIC(14, 2) GENERATED ALWAYS AS (price * stock) STORED,
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 테이블 제약조건

여러 열에 걸친 제약이나 이름을 붙이고 싶을 때는 `CONSTRAINT` 절을 사용합니다.

```sql
CREATE TABLE order_items (
    order_id    INT NOT NULL,
    product_id  INT NOT NULL,
    quantity    INT NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(12, 2) NOT NULL,

    -- 복합 기본 키
    CONSTRAINT pk_order_items PRIMARY KEY (order_id, product_id),
    -- 외래 키 (이름 있음 → ALTER TABLE로 나중에 조작 가능)
    CONSTRAINT fk_order    FOREIGN KEY (order_id)   REFERENCES orders(order_id),
    CONSTRAINT fk_product  FOREIGN KEY (product_id) REFERENCES products(product_id)
);
```

제약조건에 이름을 붙이면 오류 메시지에서 어떤 제약이 위반됐는지 바로 알 수 있고, `ALTER TABLE ... DROP CONSTRAINT 이름`으로 개별 제거가 가능합니다.

## IF NOT EXISTS

스크립트를 반복 실행할 때 테이블이 이미 있으면 에러가 발생합니다. `IF NOT EXISTS`로 방지할 수 있습니다.

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id      BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  VARCHAR(100) NOT NULL,
    operation   CHAR(1)      NOT NULL CHECK (operation IN ('I','U','D')),
    changed_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## CTAS — 쿼리 결과로 테이블 생성

`CREATE TABLE ... AS SELECT` (CTAS)는 쿼리 결과를 새 테이블로 만듭니다. 제약조건은 복사되지 않으므로 스냅샷이나 임시 분석 테이블에 적합합니다.

```sql
-- 고가 상품 스냅샷 테이블 생성
CREATE TABLE premium_products AS
SELECT product_id, name, price
FROM   products
WHERE  price > 500000;

-- 행 구조는 복사하되 데이터는 없는 빈 복사본 (PostgreSQL)
CREATE TABLE products_backup AS
SELECT * FROM products WHERE false;
```

![CREATE TABLE 변형 패턴](/assets/posts/sql-create-table-basics-variants.svg)

## 임시 테이블

세션 동안만 유지되고 세션 종료 시 자동 삭제되는 테이블입니다. 중간 계산 결과 저장에 자주 사용됩니다.

```sql
-- 표준 SQL 임시 테이블
CREATE TEMPORARY TABLE session_cart (
    product_id  INT,
    quantity    INT
);

-- PostgreSQL: 트랜잭션 종료 시 자동 삭제
CREATE TEMP TABLE tx_temp (id INT) ON COMMIT DROP;
```

## 열 이름 규칙

- **snake_case** 권장: `employee_id`, `hire_date`, `unit_price`
- SQL 예약어와 겹치면 큰따옴표(`"`)로 감싸야 합니다: `"order"`, `"group"`
- 가능하면 예약어 이름을 피하는 것이 좋습니다

```sql
-- 예약어 충돌 시 (권장하지 않지만 필요할 경우)
CREATE TABLE reservations (
    "order"  INT,        -- 큰따옴표 필요
    status   VARCHAR(20)
);
```

## 정리

- `CREATE TABLE`은 열 이름 + 데이터 타입 + 제약조건의 조합으로 정의합니다.
- 제약조건에 이름을 붙이면 관리가 쉽고 오류 메시지가 명확합니다.
- `IF NOT EXISTS`로 스크립트 재실행 안전성을 확보합니다.
- CTAS는 스냅샷·임시 분석에 유용하지만 제약조건은 복사되지 않습니다.

다음 글에서는 숫자·문자열·불리언 등 **SQL 데이터 타입**을 깊이 있게 살펴봅니다.

---

**지난 글:** [SQL 언어 분류 — DDL·DML·DCL·TCL](/posts/sql-language-categories/)

**다음 글:** [SQL 데이터 타입 — 숫자·문자열·불리언](/posts/sql-data-types-numeric-string-bool/)

<br>
읽어주셔서 감사합니다. 😊
