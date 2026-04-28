---
title: "테이블 변경 — ALTER TABLE로 스키마 진화시키기"
description: "ALTER TABLE의 주요 연산(컬럼·제약·인덱스 추가·수정·삭제)과 각 연산의 락 수준, 운영 중인 대형 테이블에서 안전하게 스키마를 변경하는 3단계 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "alter-table", "ddl", "schema-migration", "lock", "column", "constraint", "스키마변경"]
featured: false
draft: false
---

[지난 글](/posts/sql-unique-constraint/)에서 UNIQUE 제약의 동작을 살펴봤다. 이번에는 이미 배포된 테이블의 구조를 안전하게 변경하는 `ALTER TABLE`을 다룬다.

---

## ALTER TABLE 개요

`ALTER TABLE`은 기존 테이블의 구조를 수정하는 DDL 문이다. 컬럼 추가·삭제·수정, 제약 추가·삭제, 이름 변경 등 거의 모든 스키마 변경을 처리한다.

```sql
ALTER TABLE 테이블명 액션;
```

![ALTER TABLE 주요 연산](/assets/posts/sql-alter-table-operations.svg)

---

## 컬럼 추가

```sql
-- NULL 허용 컬럼 추가 (빠름)
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP;

-- DEFAULT 있는 컬럼 추가
ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- 여러 컬럼 동시 추가 (PostgreSQL, MySQL)
ALTER TABLE products
    ADD COLUMN weight_kg NUMERIC(6,2),
    ADD COLUMN dimensions VARCHAR(50);
```

NULL을 허용하는 컬럼 추가는 테이블 메타데이터만 변경하므로 매우 빠르다. NOT NULL이고 DEFAULT도 없는 컬럼 추가는 테이블 전체를 다시 쓰기 때문에 대형 테이블에서는 주의가 필요하다.

---

## 컬럼 수정

### 타입 변경

```sql
-- PostgreSQL
ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(14,2);

-- MySQL
ALTER TABLE products MODIFY COLUMN price DECIMAL(14,2) NOT NULL;
```

타입 변경은 데이터 형변환이 가능한지에 따라 성공 여부가 결정된다. `VARCHAR(50)` → `VARCHAR(100)`은 항상 가능하지만, `VARCHAR` → `INTEGER`는 모든 값이 숫자로 변환 가능해야 한다.

### NOT NULL 추가/제거

```sql
-- NOT NULL 추가
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- NOT NULL 제거
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
```

### DEFAULT 변경

```sql
-- DEFAULT 설정
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'DRAFT';

-- DEFAULT 제거
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
```

---

## 컬럼 삭제

```sql
ALTER TABLE orders DROP COLUMN notes;

-- 해당 컬럼을 참조하는 제약도 함께 삭제 (PostgreSQL)
ALTER TABLE orders DROP COLUMN customer_ref CASCADE;
```

삭제된 컬럼에 인덱스나 제약이 걸려 있으면 에러가 발생한다. `CASCADE`를 사용하면 의존 객체도 함께 삭제된다.

---

## 제약 추가·삭제

```sql
-- PK 추가
ALTER TABLE users ADD CONSTRAINT pk_users PRIMARY KEY (user_id);

-- FK 추가
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id);

-- UNIQUE 추가
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);

-- CHECK 추가
ALTER TABLE products ADD CONSTRAINT chk_price CHECK (price >= 0);

-- 제약 삭제
ALTER TABLE users DROP CONSTRAINT uq_users_email;
```

---

## 이름 변경

```sql
-- 테이블 이름 변경
ALTER TABLE orders RENAME TO purchase_orders;

-- 컬럼 이름 변경
ALTER TABLE users RENAME COLUMN phone TO phone_number;

-- 제약 이름 변경 (PostgreSQL)
ALTER TABLE users RENAME CONSTRAINT uq_email TO uq_users_email;
```

---

## 운영 중 대형 테이블 변경 — 락 위험

`ALTER TABLE`은 테이블에 **AccessExclusiveLock**을 걸어 다른 모든 DML을 차단한다. 수백만 행 테이블에서 테이블을 다시 쓰는 변경은 수 분~수십 분의 서비스 중단을 유발할 수 있다.

![ALTER TABLE 락 위험과 안전 패턴](/assets/posts/sql-alter-table-lock.svg)

### 안전한 NOT NULL 컬럼 추가 — 3단계 패턴

```sql
-- 1단계: NULL 허용으로 빠르게 추가 (메타데이터만 변경)
ALTER TABLE orders ADD COLUMN region VARCHAR(20);

-- 2단계: 배치로 기존 행 업데이트 (대형 테이블은 청크 단위로)
UPDATE orders SET region = 'KR' WHERE region IS NULL;

-- 3단계: NOT NULL 제약만 추가 (유효성 검사이므로 빠름)
ALTER TABLE orders ALTER COLUMN region SET NOT NULL;
```

PostgreSQL 12부터는 이미 값이 채워진 컬럼에 NOT NULL 추가 시 **테이블 스캔 없이 제약 메타데이터만 추가**하는 최적화가 있어 이 패턴이 더욱 효과적이다.

### pg_repack / pt-online-schema-change

수억 행 테이블에서 컬럼 타입 변경처럼 테이블 리라이트가 불가피한 경우, PostgreSQL의 `pg_repack`이나 MySQL의 `pt-online-schema-change`, `gh-ost` 같은 온라인 스키마 변경 도구를 사용하면 서비스 중단 없이 변경할 수 있다.

---

## DBMS별 문법 차이

| 연산 | PostgreSQL | MySQL | Oracle |
|---|---|---|---|
| 컬럼 타입 변경 | `ALTER COLUMN col TYPE ...` | `MODIFY COLUMN col ...` | `MODIFY col ...` |
| 컬럼 이름 변경 | `RENAME COLUMN` | `CHANGE COLUMN` | `RENAME COLUMN` |
| NOT NULL 추가 | `ALTER COLUMN SET NOT NULL` | `MODIFY` 전체 재선언 | `MODIFY col NOT NULL` |

운영 환경에서 ALTER TABLE을 실행하기 전에는 반드시 테스트 환경에서 실행 시간과 락 동작을 확인하는 것이 좋다.

다음 글에서는 테이블 자체를 없애는 DROP과 데이터만 비우는 TRUNCATE의 차이를 다룬다.

---

**지난 글:** [유니크 제약 — UNIQUE 인덱스와 NULL 허용 동작](/posts/sql-unique-constraint/)

**다음 글:** [DROP vs TRUNCATE — 삭제의 두 얼굴](/posts/sql-drop-vs-truncate/)

<br>
읽어주셔서 감사합니다. 😊
