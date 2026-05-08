---
title: "관계 매핑: ERD를 테이블로 변환하기"
description: "1:1·1:N·N:M 관계를 SQL 테이블로 매핑하는 규칙, 교차 테이블(Junction Table) 설계, 약한 엔티티 처리, 다치 속성 분리 방법을 실전 DDL 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "relationship-mapping", "junction-table", "foreign-key", "1-to-n", "n-to-m", "database-design", "erd", "schema"]
featured: false
draft: false
---

[지난 글](/posts/sql-er-diagram/)에서 ERD 표기법과 기수성 개념을 살펴봤다. 이번에는 그 ERD를 실제 SQL 테이블로 변환하는 **관계 매핑(Relationship Mapping)** 규칙을 정리한다.

---

## 기본 원칙: 엔티티 → 테이블

각 강한 엔티티(Strong Entity)는 독립적인 테이블이 된다. 엔티티의 단순 속성은 컬럼이 되고, 식별자(기본키)는 PK가 된다.

```sql
-- EMPLOYEE 엔티티 → employees 테이블
CREATE TABLE employees (
    id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    emp_code   VARCHAR(20)  NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    hire_date  DATE         NOT NULL,
    dept_id    INT          REFERENCES departments(id)
);
```

---

## 관계 유형별 매핑 규칙

![관계 매핑 규칙](/assets/posts/sql-relationship-mapping-rules.svg)

### 1:1 관계

두 엔티티 중 **선택적(Optional)** 참여 쪽에 FK를 두고 `UNIQUE` 제약을 추가한다. 양쪽 모두 항상 존재한다면 하나의 테이블로 합치는 것이 더 자연스럽다.

```sql
-- 직원과 사내 전용 주차 번호 (1:1)
CREATE TABLE employees (
    id         INT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL
);

CREATE TABLE parking_spots (
    id          INT PRIMARY KEY,
    spot_no     VARCHAR(10) NOT NULL UNIQUE,
    employee_id INT         UNIQUE REFERENCES employees(id) ON DELETE SET NULL
    -- employee_id UNIQUE → 1:1 보장
);
```

### 1:N 관계

**N 쪽** 테이블에 FK를 추가한다. 가장 흔한 관계 패턴이다.

```sql
-- 부서(1) : 직원(N)
CREATE TABLE departments (
    id   INT  PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE employees (
    id      INT PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    dept_id INT REFERENCES departments(id) ON DELETE SET NULL
    -- dept_id → FK, N 쪽에 위치
);
```

### N:M 관계

N:M은 FK만으로 직접 표현할 수 없다. **교차 테이블(Junction Table)**을 새로 만들어 두 개의 1:N 관계로 분해한다.

![교차 테이블 설계](/assets/posts/sql-relationship-mapping-junction.svg)

```sql
-- 학생(N) ↔ 강의(M)
CREATE TABLE students (
    id    INT PRIMARY KEY,
    name  VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
    id       INT PRIMARY KEY,
    title    VARCHAR(200) NOT NULL,
    credits  INT NOT NULL DEFAULT 3
);

-- 교차 테이블
CREATE TABLE enrollments (
    student_id   INT  NOT NULL REFERENCES students(id),
    course_id    INT  NOT NULL REFERENCES courses(id),
    enrolled_at  DATE NOT NULL DEFAULT CURRENT_DATE,
    grade_letter CHAR(2),          -- 관계 속성: 여기 저장
    status       VARCHAR(20) NOT NULL DEFAULT 'active',
    PRIMARY KEY (student_id, course_id)
);
```

교차 테이블에는 두 FK의 **복합 PK**가 들어간다. 관계 자체가 가진 속성(성적, 등록일 등)도 이 테이블에 저장한다.

---

## 약한 엔티티 매핑

약한 엔티티(Weak Entity)는 강한 엔티티의 PK를 포함한 **복합 PK**를 갖는다.

```sql
-- BANK_ACCOUNT(강한) → TRANSACTION(약한)
CREATE TABLE bank_accounts (
    id      INT PRIMARY KEY,
    balance NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
    account_id  INT  NOT NULL REFERENCES bank_accounts(id),
    seq         INT  NOT NULL,  -- account 내에서의 순번
    amount      NUMERIC(12,2) NOT NULL,
    txn_type    VARCHAR(10)   NOT NULL,
    occurred_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, seq)  -- 복합 PK: 약한 엔티티 식별
);
```

---

## 다치 속성(Multivalued Attribute) 분리

한 속성이 여러 값을 가질 수 있는 경우(전화번호, 이메일 복수 등)는 별도 테이블로 분리한다.

```sql
-- employees.phone_numbers (다치) → 별도 테이블
CREATE TABLE employee_phones (
    employee_id INT         NOT NULL REFERENCES employees(id),
    phone_no    VARCHAR(20) NOT NULL,
    phone_type  VARCHAR(10) NOT NULL DEFAULT 'mobile',  -- mobile/home/work
    PRIMARY KEY (employee_id, phone_no)
);
```

---

## 자기참조(Self-Referencing) 관계

같은 테이블의 행끼리 관계를 맺는 경우다. 조직도, 카테고리 계층, 친구 관계 등이 해당한다.

```sql
-- 직원 조직도: 상사 → 부하 (1:N)
CREATE TABLE employees (
    id         INT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    manager_id INT REFERENCES employees(id) ON DELETE SET NULL
    -- 최상위 직원은 manager_id = NULL
);

-- N:M 자기참조: 소셜 네트워크 친구 관계
CREATE TABLE friendships (
    user_id_a INT NOT NULL REFERENCES users(id),
    user_id_b INT NOT NULL REFERENCES users(id),
    since     DATE,
    PRIMARY KEY (user_id_a, user_id_b),
    CHECK (user_id_a < user_id_b)  -- 중복 방지
);
```

---

## 복합 속성 처리

`address = {city, street, zipcode}` 같은 복합 속성은 각각 컬럼으로 펼치거나, 재사용이 잦으면 별도 테이블로 분리한다.

```sql
-- 방법 A: 컬럼으로 펼치기 (주소가 단순할 때)
CREATE TABLE customers (
    id          INT PRIMARY KEY,
    name        VARCHAR(100),
    addr_city   VARCHAR(100),
    addr_street VARCHAR(255),
    addr_zip    VARCHAR(10)
);

-- 방법 B: 주소 테이블로 분리 (주소가 여러 곳에 쓰일 때)
CREATE TABLE addresses (
    id      INT PRIMARY KEY,
    city    VARCHAR(100) NOT NULL,
    street  VARCHAR(255) NOT NULL,
    zipcode VARCHAR(10)
);

CREATE TABLE customers (
    id         INT PRIMARY KEY,
    name       VARCHAR(100),
    address_id INT REFERENCES addresses(id)
);
```

---

## 매핑 체크리스트

```
✓ 각 강한 엔티티는 테이블로
✓ 단순 속성은 컬럼으로, 복합 속성은 펼치거나 분리
✓ 다치 속성은 별도 테이블로
✓ 1:1 → FK + UNIQUE (선택적 참여 쪽에)
✓ 1:N → N 쪽에 FK
✓ N:M → 교차 테이블 + 복합 PK
✓ 약한 엔티티 → 강한 엔티티 PK 포함 복합 PK
✓ 자기참조 → FK 같은 테이블 참조
```

---

**지난 글:** [ER 다이어그램 읽기와 그리기](/posts/sql-er-diagram/)

**다음 글:** [식별 관계 vs 비식별 관계](/posts/sql-identifying-vs-non-identifying/)

<br>
읽어주셔서 감사합니다. 😊
