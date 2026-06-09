---
title: "제약 조건 기초: NOT NULL·DEFAULT·CHECK"
description: "데이터 무결성의 첫 번째 방어선인 NOT NULL·DEFAULT·CHECK 제약 조건의 동작 원리, CHECK와 NULL의 3값 논리, ALTER TABLE로 제약을 추가·제거하는 방법을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["제약조건", "NOT NULL", "DEFAULT", "CHECK", "데이터무결성", "ALTER TABLE"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-datetime/)에서 날짜·시간 타입을 살펴봤다. 올바른 타입 선택으로도 잡을 수 없는 데이터 품질 문제가 있다 — 예를 들어 가격이 음수이거나, 이름이 NULL이거나. 제약 조건(constraint)은 이 두 번째 방어선이다.

## 왜 제약 조건인가

애플리케이션 코드에서 유효성 검사를 하면 충분하지 않을까? 충분하지 않다. 이유는 세 가지다.

1. **여러 진입점**: 애플리케이션 외에도 관리 도구, 데이터 마이그레이션 스크립트, 직접 SQL 접속 등 다양한 경로로 데이터가 삽입된다.
2. **코드 버그**: 애플리케이션 검증 로직에 버그가 있을 수 있다.
3. **DB가 보장**: 제약 조건은 RDBMS 레벨에서 강제되므로 어떤 경로로 삽입해도 일관성이 유지된다.

## NOT NULL

열에 NULL 값이 저장되는 것을 금지한다.

![NOT NULL · DEFAULT · CHECK 제약 조건](/assets/posts/sql-constraints-not-null-default-check-overview.svg)

```sql
-- NOT NULL: 항상 값이 있어야 하는 열
CREATE TABLE users (
    id    BIGINT PRIMARY KEY,
    email VARCHAR(200) NOT NULL,   -- 이메일은 필수
    phone VARCHAR(20)              -- 전화번호는 선택 (NULL 허용)
);
```

**어디에 써야 할까?** 비즈니스 로직상 "반드시 있어야 하는" 모든 열에 붙인다. 기본 키는 자동으로 NOT NULL이다.

`NOT NULL`을 빠뜨리면 해당 열은 NULL을 허용하고, 이후 쿼리에서 `IS NULL` 확인을 빠뜨린 코드가 예상치 못한 결과를 낼 수 있다.

## DEFAULT

값을 제공하지 않았을 때 자동으로 채울 값이나 표현식을 지정한다.

```sql
CREATE TABLE orders (
    id         BIGINT PRIMARY KEY,
    status     VARCHAR(20) DEFAULT 'pending',    -- 상수
    created_at TIMESTAMPTZ DEFAULT now(),        -- 함수
    is_active  BOOLEAN     DEFAULT TRUE,          -- 불리언
    version    INTEGER     DEFAULT 0             -- 숫자
);

-- DEFAULT를 사용하는 INSERT
INSERT INTO orders (id) VALUES (1);
-- status='pending', created_at=현재시각, is_active=TRUE, version=0 자동 입력
```

DEFAULT 값은 저장 시점에 딱 한 번 평가된다. `now()`처럼 함수를 쓰면 INSERT 시점의 값이 저장된다.

**주의**: `DEFAULT`는 열이 INSERT 문에서 생략되었을 때만 작동한다. `NULL`을 명시적으로 넣으면(`INSERT INTO t (col) VALUES (NULL)`) DEFAULT가 적용되지 않는다.

## CHECK

열의 값이 지정한 조건식을 만족하는지 검사한다.

```sql
CREATE TABLE products (
    id    BIGINT PRIMARY KEY,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    stock INTEGER       DEFAULT 0 CHECK (stock >= 0),
    -- 여러 열에 걸친 테이블 제약
    CONSTRAINT chk_discount CHECK (discounted_price < price)
);
```

### CHECK와 NULL의 3값 논리

![제약 조건 위반 처리 흐름](/assets/posts/sql-constraints-not-null-default-check-behavior.svg)

CHECK 제약의 중요한 특성: **조건식 결과가 FALSE일 때만 에러**를 낸다. NULL(UNKNOWN)은 에러가 아니다.

```sql
-- age NULLABLE 열에 CHECK (age >= 0) 설정된 경우
INSERT INTO t (age) VALUES (NULL);   -- 통과! NULL >= 0 = NULL (UNKNOWN)
INSERT INTO t (age) VALUES (-5);     -- 에러! -5 >= 0 = FALSE
INSERT INTO t (age) VALUES (25);     -- 통과! 25 >= 0 = TRUE
```

이 동작이 의도와 다르면 `NOT NULL`과 `CHECK`를 함께 써야 한다.

## 제약에 이름 붙이기

이름 있는 제약은 나중에 제거하거나 에러 메시지에서 어떤 제약이 위반됐는지 파악하기 쉽다.

```sql
CREATE TABLE payments (
    id     BIGINT PRIMARY KEY,
    amount NUMERIC(12,2)
        CONSTRAINT chk_amount_positive CHECK (amount > 0)
);
```

에러 발생 시 메시지에 `chk_amount_positive`가 표시되어 디버깅이 수월하다.

## ALTER TABLE로 제약 추가·제거

기존 테이블에도 제약 조건을 추가하거나 제거할 수 있다.

```sql
-- NOT NULL 추가 (기존 데이터에 NULL이 없어야 성공)
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- DEFAULT 추가
ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0;

-- CHECK 제약 추가
ALTER TABLE products
ADD CONSTRAINT chk_price CHECK (price > 0);

-- 제약 제거 (이름이 필요)
ALTER TABLE products DROP CONSTRAINT chk_price;

-- DEFAULT 제거
ALTER TABLE products ALTER COLUMN stock DROP DEFAULT;

-- NOT NULL 제거 (NULL 허용으로 변경)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
```

## 기존 데이터와 제약 추가

NOT NULL이나 CHECK를 기존 테이블에 추가할 때는 기존 데이터가 제약을 위반하면 실패한다. 대규모 테이블에서는 전체 스캔이 발생하므로 운영 중 부하가 생길 수 있다.

```sql
-- PostgreSQL: NOT VALID 옵션으로 기존 데이터 검증 건너뜀
-- 새로 삽입·수정되는 데이터에만 제약 적용
ALTER TABLE products
ADD CONSTRAINT chk_price CHECK (price > 0) NOT VALID;

-- 나중에 유휴 시간에 기존 데이터 검증
ALTER TABLE products VALIDATE CONSTRAINT chk_price;
```

---

**지난 글:** [데이터 타입 완전 정복: 날짜·시간 타입](/posts/sql-data-types-datetime/)

**다음 글:** [기본 키 설계: 자연 키 vs 대리 키](/posts/sql-primary-key-design/)

<br>
읽어주셔서 감사합니다. 😊
