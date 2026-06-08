---
title: "CREATE TABLE 기초 — 테이블 생성과 구조 설계"
description: "CREATE TABLE 구문의 전체 구조, 열 정의 방식, 제약조건 이름 붙이기, CREATE TABLE AS SELECT 활용, 그리고 실무에서 자주 발생하는 설계 실수를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQL", "CREATE TABLE", "DDL", "테이블설계", "제약조건", "스키마"]
featured: false
draft: false
---

[지난 글](/posts/sql-language-categories/)에서 SQL을 DDL, DML, DCL, TCL로 분류했다. DDL의 핵심은 `CREATE TABLE`이다. 이번 글에서는 테이블 생성 구문을 완전히 해부하고, 열 이름 규칙부터 제약조건 명명, 자동 증가 키, 그리고 실무에서 반복되는 설계 실수까지 정리한다.

## CREATE TABLE 기본 구조

`CREATE TABLE` 문은 테이블 이름, 열 정의 목록, 테이블 제약조건으로 구성된다.

![CREATE TABLE 구문 분해](/assets/posts/sql-create-table-basics-syntax.svg)

## 열 정의 규칙

### 이름 규칙

소문자 `snake_case`를 기본으로 한다. `order_id`, `user_name`, `created_at` 같은 형식이다. SQL 예약어(`order`, `group`, `select`)는 열 이름으로 사용하면 쿼터로 감싸야 해서 피하는 것이 좋다.

### NOT NULL과 DEFAULT

대부분의 열은 `NOT NULL`이어야 한다. NULL은 "모른다"를 의미하므로, 비즈니스적으로 반드시 존재해야 하는 값에 NULL을 허용하면 나중에 쿼리에서 `IS NULL` 처리를 빠뜨리는 실수로 이어진다. `DEFAULT`를 함께 설정하면 INSERT 시 생략해도 안전하다.

```sql
-- 잘못된 설계: 모든 열에 NULL 허용
CREATE TABLE bad_users (
    id   INT,
    name VARCHAR(100),
    email VARCHAR(255)
);

-- 올바른 설계
CREATE TABLE users (
    id         BIGINT       NOT NULL,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 자동 증가 기본 키

각 DBMS마다 자동 증가 열 문법이 다르다.

```sql
-- PostgreSQL (IDENTITY, SQL:2003 표준)
CREATE TABLE products (
    id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- MySQL / MariaDB
CREATE TABLE products (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Oracle (12c 이상)
CREATE TABLE products (
    id   NUMBER GENERATED ALWAYS AS IDENTITY,
    name VARCHAR2(100) NOT NULL,
    CONSTRAINT pk_products PRIMARY KEY (id)
);

-- SQL Server
CREATE TABLE products (
    id   INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL
);
```

## 제약조건 명명 방법

제약조건에 이름을 붙이면 오류 메시지가 명확해지고, `ALTER TABLE`로 제약조건을 수정·삭제할 때 이름으로 참조할 수 있다.

```sql
CREATE TABLE order_items (
    item_id    BIGINT        NOT NULL,
    order_id   BIGINT        NOT NULL,
    product_id INT           NOT NULL,
    quantity   INT           NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,

    CONSTRAINT pk_order_items    PRIMARY KEY (item_id),
    CONSTRAINT fk_oi_order       FOREIGN KEY (order_id)   REFERENCES orders(order_id),
    CONSTRAINT fk_oi_product     FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_oi_quantity   CHECK (quantity > 0),
    CONSTRAINT chk_oi_unit_price CHECK (unit_price >= 0)
);
```

FK 위반 시 오류 메시지에 `fk_oi_order`가 포함되어 어떤 관계가 깨졌는지 즉시 알 수 있다.

## CREATE TABLE AS SELECT

기존 테이블이나 쿼리 결과로 새 테이블을 만들 수 있다.

```sql
-- 구조 + 데이터 복사
CREATE TABLE orders_backup AS
SELECT * FROM orders WHERE created_at < '2024-01-01';

-- 구조만 복사 (데이터 없음)
CREATE TABLE orders_empty AS
SELECT * FROM orders WHERE 1 = 0;
```

주의할 점은 **제약조건이 복사되지 않는다**는 것이다. PRIMARY KEY, FOREIGN KEY, NOT NULL, DEFAULT가 모두 사라진다. 백업 테이블을 실제 운영에 사용할 계획이라면 제약조건을 별도로 추가해야 한다.

## IF NOT EXISTS

스크립트를 반복 실행해도 오류가 나지 않게 하려면 `IF NOT EXISTS`를 사용한다.

```sql
CREATE TABLE IF NOT EXISTS config (
    key   VARCHAR(100) NOT NULL PRIMARY KEY,
    value TEXT         NOT NULL
);
```

## 테이블 설계 체크리스트

![테이블 설계 체크리스트](/assets/posts/sql-create-table-basics-design.svg)

### 흔한 실수

**VARCHAR(255) 남용**: VARCHAR(255)가 "안전한 길이"라는 잘못된 믿음이 있다. 하지만 인덱스에 포함된 VARCHAR(255) 열은 인덱스 키 크기를 증가시키고, 일부 DBMS에서 행 크기 제한에 걸릴 수 있다. 실제 최대 길이를 추정해서 지정하라.

**FLOAT로 금액 저장**: `FLOAT`과 `DOUBLE`은 부동소수점이라 이진수로 정확히 표현할 수 없는 소수가 있다. `0.1 + 0.2 ≠ 0.3`이 될 수 있다. 금액은 반드시 `DECIMAL(x, y)` 또는 `NUMERIC(x, y)`를 사용하라.

```sql
-- 잘못됨
amount FLOAT NOT NULL

-- 올바름
amount DECIMAL(15, 2) NOT NULL  -- 총 15자리, 소수점 이하 2자리
```

**updated_at 자동 갱신 누락**: 감사(Audit)나 캐시 무효화를 위해 `updated_at`이 필요한 테이블에서 이를 빠뜨리면 나중에 ALTER TABLE 비용이 크다. 설계 초기에 추가하는 것이 좋다.

다음 글에서는 테이블에서 가장 중요한 선택 중 하나인 숫자, 문자열, 불리언 데이터 타입을 상세히 다룬다.

---

**지난 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL](/posts/sql-language-categories/)

**다음 글:** [데이터 타입 완전 정복 — 숫자, 문자열, 불리언](/posts/sql-data-types-numeric-string-bool/)

<br>
읽어주셔서 감사합니다. 😊
