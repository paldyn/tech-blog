---
title: "CREATE TABLE 기초: 테이블 생성의 모든 것"
description: "CREATE TABLE의 전체 문법, IF NOT EXISTS·CTAS 옵션, 열 제약과 테이블 제약의 차이, 주요 RDBMS별 방언 차이를 코드와 함께 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["CREATE TABLE", "DDL", "테이블생성", "스키마정의", "제약조건", "CTAS"]
featured: false
draft: false
---

[지난 글](/posts/sql-language-categories/)에서 DDL이 데이터베이스 구조를 정의하는 언어임을 확인했다. DDL의 핵심은 `CREATE TABLE`이다. 테이블 생성에 필요한 모든 문법과 실전 패턴을 이번 글에서 깊이 파고든다.

## 기본 문법

![CREATE TABLE 문법 구조](/assets/posts/sql-create-table-basics-syntax.svg)

```sql
CREATE TABLE table_name (
    column1 data_type [column_constraint ...],
    column2 data_type [column_constraint ...],
    ...
    [table_constraint ...]
);
```

**열 제약(column constraint)**은 특정 열에만 적용되는 규칙이다. `NOT NULL`, `DEFAULT`, `CHECK`, `PRIMARY KEY`, `UNIQUE`, `REFERENCES`가 여기 해당한다.

**테이블 제약(table constraint)**은 여러 열에 걸쳐 적용되거나 이름을 붙이고 싶을 때 사용한다. 예를 들어 복합 기본 키는 테이블 제약으로만 표현할 수 있다.

```sql
CREATE TABLE order_items (
    order_id  BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    qty        INTEGER NOT NULL DEFAULT 1,
    -- 복합 기본 키: 두 열을 묶어 테이블 제약으로 선언
    CONSTRAINT pk_order_items PRIMARY KEY (order_id, product_id),
    CONSTRAINT chk_qty CHECK (qty > 0)
);
```

`CONSTRAINT name` 구문으로 제약에 이름을 붙이면, 나중에 `ALTER TABLE ... DROP CONSTRAINT name`으로 제거할 수 있어 유지보수가 편하다.

## IF NOT EXISTS

테이블이 이미 존재하면 에러 대신 조용히 건너뛴다. 마이그레이션 스크립트나 초기화 스크립트에서 유용하다.

```sql
CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGINT       PRIMARY KEY,
    action     VARCHAR(50)  NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT now()
);
```

주의: `IF NOT EXISTS`는 기존 테이블의 구조가 다르더라도 에러를 내지 않는다. 구조 동기화가 필요하면 `ALTER TABLE`이나 마이그레이션 도구를 써야 한다.

## CTAS: 쿼리 결과로 테이블 생성

`CREATE TABLE ... AS SELECT ...` 구문으로 쿼리 결과를 바탕으로 새 테이블을 만들 수 있다.

```sql
-- 2024년 주문만 복사해 아카이브 테이블 생성
CREATE TABLE orders_2024
AS SELECT *
   FROM   orders
   WHERE  EXTRACT(YEAR FROM created_at) = 2024;
```

**중요한 제한**: CTAS는 데이터와 컬럼 타입만 복사한다. `NOT NULL`, `CHECK` 같은 제약 조건과 인덱스는 복사되지 않는다. 필요하다면 CTAS 후 별도로 추가해야 한다.

## 실전 예시: 주문 시스템

![CREATE TABLE 실전 예시](/assets/posts/sql-create-table-basics-example.svg)

```sql
-- PostgreSQL 기준
CREATE TABLE users (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      VARCHAR(200) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE orders (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT       NOT NULL,
    total      NUMERIC(12,2) CHECK (total >= 0),
    status     VARCHAR(20)  DEFAULT 'pending',
    created_at TIMESTAMPTZ  DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
```

`ON DELETE RESTRICT`는 참조되는 `users` 행을 삭제하려고 하면 에러를 낸다. `ON DELETE CASCADE`로 바꾸면 부모 행 삭제 시 자식 행도 함께 삭제된다.

## 데이터 타입 선택 원칙

| 상황 | 권장 타입 |
|------|---------|
| 정수 ID (소규모) | `INTEGER` |
| 정수 ID (대규모) | `BIGINT` |
| 고정 소수점 금액 | `NUMERIC(p,s)` |
| 부동소수점 측정값 | `REAL` / `DOUBLE PRECISION` |
| 가변 길이 문자열 | `VARCHAR(n)` |
| 무제한 텍스트 | `TEXT` (PG) / `LONGTEXT` (MySQL) |
| 날짜만 | `DATE` |
| 날짜+시간 | `TIMESTAMP` / `TIMESTAMPTZ` |
| 참/거짓 | `BOOLEAN` |

## DB별 주요 차이

자동 증가 ID 문법은 DB마다 크게 다르다.

```sql
-- PostgreSQL: SQL 표준 준수
id BIGINT GENERATED ALWAYS AS IDENTITY

-- MySQL: 독자 문법
id BIGINT AUTO_INCREMENT

-- Oracle: 시퀀스 + DEFAULT (12c+)
id NUMBER GENERATED ALWAYS AS IDENTITY

-- SQL Server: IDENTITY
id BIGINT IDENTITY(1,1)
```

문자열 타입도 다르다. PostgreSQL의 `TEXT`는 길이 제한 없이 효율적이다. Oracle은 `VARCHAR2`를 권장한다(`VARCHAR`는 나중에 의미가 바뀔 수 있다고 문서에서 경고한다). SQL Server는 유니코드 문자열에 `NVARCHAR`를 사용한다.

## 테이블 생성 후 확인

```sql
-- PostgreSQL: 테이블 구조 확인
\d orders           -- psql 클라이언트
SELECT * FROM information_schema.columns
WHERE  table_name = 'orders';

-- MySQL
SHOW CREATE TABLE orders;
DESCRIBE orders;

-- Oracle
DESC orders;
```

---

**지난 글:** [SQL 언어 분류: DDL·DML·DCL·TCL·DQL 완전 정리](/posts/sql-language-categories/)

**다음 글:** [데이터 타입 완전 정복: 숫자·문자열·불리언](/posts/sql-data-types-numeric-string-bool/)

<br>
읽어주셔서 감사합니다. 😊
