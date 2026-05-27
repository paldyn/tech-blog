---
title: "SQL 제약조건 — NOT NULL, DEFAULT, CHECK 완전 정복"
description: "NOT NULL로 데이터 품질을 지키는 법, DEFAULT로 보일러플레이트를 없애는 법, CHECK 제약의 한계(MySQL 버그, NULL 통과 문제), NULL의 3값 논리를 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["NOT NULL", "DEFAULT", "CHECK제약", "NULL", "3값논리", "데이터무결성", "제약조건", "MySQL CHECK버그"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-datetime/)에서 날짜/시간 타입을 다뤘다. 타입을 골랐다면 이제 **제약조건(Constraint)**을 설정할 차례다. 제약조건은 DBMS가 데이터 품질을 자동으로 지켜주는 안전망이다. 이번 글에서는 `NOT NULL`, `DEFAULT`, `CHECK` 세 가지를 집중 해부한다.

## 제약조건의 목적

제약조건은 **애플리케이션 레이어의 검증을 보완**한다. 애플리케이션이 아무리 잘 검증해도 직접 SQL을 실행하거나, 버그가 있거나, 새 서비스가 추가되면 데이터 품질이 깨진다. DB 수준 제약조건은 **마지막 방어선**이다.

## NOT NULL — "없음"을 금지한다

![NOT NULL · DEFAULT · CHECK 제약조건](/assets/posts/sql-constraints-three-types.svg)

```sql
-- NOT NULL 선언
CREATE TABLE users (
    user_id   INT         PRIMARY KEY,           -- PK는 암묵적 NOT NULL
    email     VARCHAR(254) NOT NULL,             -- 반드시 값 있어야 함
    nickname  VARCHAR(50),                       -- NULL 허용 (선택 필드)
    phone     VARCHAR(20)                        -- NULL 허용
);

-- NOT NULL 컬럼에 NULL 삽입 시 오류
INSERT INTO users (user_id, email) VALUES (1, NULL);
-- ORA-01400: cannot insert NULL into ("users"."email")
-- PG: null value in column "email" violates not-null constraint
```

### 언제 NOT NULL을 써야 하나?

- 비즈니스 로직상 **반드시 있어야 하는 데이터**: 주문 금액, 사용자 이메일, 생성 일시
- **참조 무결성이 필요한 FK** 컬럼 (NULL 허용 FK는 선택적 관계를 표현할 때만)
- **계산 결과에 포함될 컬럼** — NULL이 포함되면 집계함수가 무시하거나 결과가 NULL이 됨

실무 권장: **가능한 한 NOT NULL을 사용**하고, NULL이 필요한 경우에만 허용 컬럼으로 열어두는 것이 좋다.

## DEFAULT — 기본값으로 보일러플레이트를 없앤다

```sql
CREATE TABLE orders (
    order_id    INT            PRIMARY KEY,
    status      VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted  BOOLEAN        NOT NULL DEFAULT FALSE,
    quantity    INT            NOT NULL DEFAULT 1,
    discount    DECIMAL(5,2)   NOT NULL DEFAULT 0.00
);

-- DEFAULT가 있으면 INSERT에서 컬럼 생략 가능
INSERT INTO orders (order_id) VALUES (1001);
-- status='PENDING', created_at=NOW(), is_deleted=FALSE, ... 자동 입력
```

### 함수를 DEFAULT로 사용하기

```sql
-- PostgreSQL: 다양한 함수 DEFAULT 가능
id          UUID     DEFAULT gen_random_uuid(),
created_at  TIMESTAMPTZ DEFAULT NOW(),
updated_at  TIMESTAMPTZ DEFAULT NOW(),

-- MySQL: 표현식 DEFAULT (8.0.13+)
expire_date DATE DEFAULT (CURRENT_DATE + INTERVAL 30 DAY),

-- Oracle: 표현식 DEFAULT
hire_date   DATE DEFAULT SYSDATE,
emp_code    VARCHAR2(10) DEFAULT 'EMP-' || TO_CHAR(SYSDATE, 'YYYYMMDD')
```

### DEFAULT와 NOT NULL의 조합

```sql
-- NOT NULL + DEFAULT = 가장 안전한 패턴
status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'

-- NULL 허용 + DEFAULT NULL = 명시적이지만 중복
note   TEXT DEFAULT NULL  -- 그냥 note TEXT로도 동일

-- NOT NULL만 + DEFAULT 없음 = INSERT에서 반드시 값 제공
name   VARCHAR(100) NOT NULL  -- 삽입 시 name 생략 불가
```

## CHECK — 조건식으로 값 범위를 제한한다

```sql
CREATE TABLE employees (
    emp_id    INT     PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    age       SMALLINT NOT NULL,
    salary    DECIMAL(12,2) NOT NULL,
    gender    CHAR(1) NOT NULL,
    email     VARCHAR(254) NOT NULL,

    -- 컬럼 수준 CHECK
    CONSTRAINT chk_age    CHECK (age BETWEEN 15 AND 80),
    CONSTRAINT chk_salary CHECK (salary >= 0),
    CONSTRAINT chk_gender CHECK (gender IN ('M', 'F', 'N')),
    CONSTRAINT chk_email  CHECK (email LIKE '%@%')
);
```

### MySQL CHECK 버그 주의

```sql
-- MySQL 8.0.16 이전: CHECK 선언은 되지만 실제 검사 안 함!
-- MySQL 8.0.16+: CHECK 제대로 동작

-- 버전 확인
SELECT VERSION();

-- MySQL 5.7, 8.0.15 이하에서는 TRIGGER로 대체해야 함
DELIMITER //
CREATE TRIGGER before_emp_insert
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
    IF NEW.age < 15 OR NEW.age > 80 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '나이는 15~80 사이여야 합니다';
    END IF;
END//
DELIMITER ;
```

## NULL의 3값 논리 (Three-Valued Logic)

![NULL 3값 논리와 제약조건 패턴](/assets/posts/sql-constraints-null-logic.svg)

NULL은 "값이 없음/알 수 없음"을 뜻하는 특수 표식이다. SQL에서 NULL은 TRUE도 FALSE도 아닌 **UNKNOWN**이다.

```sql
-- NULL 비교의 함정
SELECT * FROM users WHERE phone = NULL;     -- 항상 0행! (UNKNOWN)
SELECT * FROM users WHERE phone IS NULL;    -- 올바른 NULL 검사
SELECT * FROM users WHERE phone IS NOT NULL; -- NULL 제외

-- NULL 전파
SELECT 1 + NULL;          -- NULL
SELECT 'hello' || NULL;   -- NULL (일부 DB)
SELECT COALESCE(NULL, 0); -- 0 (NULL 대체)

-- CHECK와 NULL
-- CHECK (age >= 0)이 있어도, age가 NULL이면 CHECK 통과!
-- NULL에 대한 비교는 UNKNOWN → 제약 위반으로 처리 안 됨
-- 해결: NOT NULL + CHECK 함께 사용
```

### 집계 함수와 NULL

```sql
-- COUNT(*): NULL 포함 전체 행 수
-- COUNT(col): NULL 제외 행 수
SELECT
    COUNT(*)        AS total_rows,    -- NULL 있어도 카운트
    COUNT(phone)    AS has_phone,     -- phone IS NOT NULL인 행만
    AVG(salary)     AS avg_salary,    -- NULL 제외 평균
    SUM(bonus)      AS total_bonus    -- NULL은 0으로 취급 (SUM)
FROM employees;
```

## 제약조건에 이름 붙이기

```sql
-- 이름 없는 제약 → 오류 메시지가 불명확
CHECK (salary >= 0)

-- 이름 있는 제약 → 오류에서 무엇이 위반됐는지 즉시 파악
CONSTRAINT chk_salary_positive CHECK (salary >= 0)

-- 이름 있는 제약은 나중에 삭제도 가능
ALTER TABLE employees DROP CONSTRAINT chk_salary_positive;
```

## 정리

- **NOT NULL**: 비즈니스상 필수 값에 적용, 가능한 한 기본 사용 권장
- **DEFAULT**: 생략 가능한 컬럼에 초기값 설정, 함수/표현식 사용 가능
- **CHECK**: 값 범위·패턴 제한 — MySQL 8.0.16 이전 버전은 실제 동작 안 함
- **NULL = 3값 논리**: `=`로 NULL 비교 불가, 반드시 `IS NULL` / `IS NOT NULL` 사용
- **CHECK + NOT NULL 조합**: CHECK만으로는 NULL을 막지 못하므로 함께 사용

---

**지난 글:** [SQL 날짜/시간 데이터 타입 — DATE, TIMESTAMP, 시간대 처리](/posts/sql-data-types-datetime/)

**다음 글:** [기본 키(Primary Key) 설계 — 자연 키 vs 대리 키, 복합 키](/posts/sql-primary-key-design/)

<br>
읽어주셔서 감사합니다. 😊
