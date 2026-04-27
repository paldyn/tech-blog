---
title: "CREATE TABLE 기초 — 테이블을 제대로 정의하는 방법"
description: "CREATE TABLE 문법의 세 구성 요소(테이블명, 컬럼 정의, 테이블 제약)를 해부하고, 좋은 이름 규칙과 흔한 실수를 정리합니다. 열 수준 제약과 테이블 수준 제약의 차이도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "create-table", "ddl", "제약조건", "스키마", "기초"]
featured: false
draft: false
---

지난 [SQL 언어 분류 — DDL · DML · DCL · TCL](/posts/sql-language-categories/) 글에서 이어집니다.

## 테이블 생성은 데이터 모델링의 출발점

앞 글에서 DDL이 스키마를 정의한다고 배웠다. DDL 중 가장 기본이 되는 명령어가 `CREATE TABLE`이다. 잘 설계된 테이블은 이후 모든 쿼리를 간결하게 만들고, 잘못 설계된 테이블은 평생 기술 부채가 된다.

이 글에서는 `CREATE TABLE`의 문법 구조와 자주 하는 실수를 살펴본다.

---

## CREATE TABLE의 세 구성 요소

![CREATE TABLE 해부](/assets/posts/sql-create-table-basics-anatomy.svg)

```sql
CREATE TABLE employees (
  -- ① 컬럼 정의 (이름 + 타입 + 열 수준 제약)
  id         INTEGER       NOT NULL  PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  email      VARCHAR(200)  UNIQUE,
  salary     DECIMAL(12,2) DEFAULT 0  CHECK (salary >= 0),
  dept_id    INTEGER,
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

  -- ② 테이블 수준 제약 (여러 컬럼 참조 가능)
  CONSTRAINT fk_dept
    FOREIGN KEY (dept_id) REFERENCES departments(id)
);
```

### ① 테이블 이름

몇 가지 규칙을 따르면 나중에 후회가 없다.

- **소문자 + snake_case**: `order_items`는 안전, `OrderItems`는 일부 DBMS에서 대소문자 구분이 달라진다.
- **복수형 명사**: `employees`, `orders`. 릴레이션은 집합이므로 복수형이 자연스럽다.
- **SQL 예약어 피하기**: `order`, `user`, `select`는 예약어다. 사용하면 오류가 나거나 따옴표로 감싸야 한다.
- **숫자/특수문자 시작 금지**: `1orders`, `order-items`는 문법 오류.

### ② 컬럼 정의

각 컬럼은 `컬럼명 데이터타입 [제약조건...]` 형식이다.

```sql
-- 기본 구조
컬럼명    데이터타입    [NOT NULL]  [DEFAULT 값]  [CHECK(조건)]  [PRIMARY KEY]  [UNIQUE]
```

컬럼 순서는 CREATE 시점에 고정된다. 나중에 추가는 싸지만, 중간 삽입이나 재정렬은 비용이 크다.

### ③ 테이블 수준 제약

단일 컬럼으로 표현할 수 없는 제약은 테이블 수준으로 내린다.

```sql
-- 복합 PRIMARY KEY
CREATE TABLE order_items (
  order_id   INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  PRIMARY KEY (order_id, product_id)  -- 복합 PK
);

-- 복합 UNIQUE
CREATE TABLE course_enrollment (
  student_id INTEGER NOT NULL,
  course_id  INTEGER NOT NULL,
  UNIQUE (student_id, course_id)  -- 수강 중복 방지
);
```

---

## 열 수준 제약 vs 테이블 수준 제약

| 구분 | 위치 | 적용 대상 | 예시 |
|------|------|---------|------|
| 열 수준 (Column) | 컬럼 정의 뒤 | 해당 컬럼만 | `NOT NULL`, `DEFAULT`, `CHECK` |
| 테이블 수준 (Table) | 컬럼 목록 끝 | 여러 컬럼 조합 | 복합 `PRIMARY KEY`, `FOREIGN KEY` |

```sql
-- 열 수준 체크 (단순 조건)
salary DECIMAL CHECK (salary >= 0)

-- 테이블 수준 체크 (여러 컬럼 참조)
CHECK (start_date < end_date)
CHECK (discount_pct >= 0 AND discount_pct <= 1)
```

---

## 네이밍 규칙: 좋은 예 vs 나쁜 예

![테이블 이름 좋은 예 vs 나쁜 예](/assets/posts/sql-create-table-basics-naming.svg)

---

## 흔한 실수 세 가지

### 1. PRIMARY KEY 없이 생성

```sql
-- 나쁨: PRIMARY KEY 없음
CREATE TABLE log_events (
  message TEXT,
  ts      TIMESTAMP
);
-- 완전히 동일한 행 중복 삽입 가능
-- UPDATE/DELETE 시 모든 중복 행이 영향받음
```

로그 테이블도 `id BIGSERIAL PRIMARY KEY`나 `GENERATED ALWAYS AS IDENTITY`를 붙이자. 식별자가 있으면 특정 행을 정확히 타겟팅할 수 있다.

### 2. VARCHAR 길이를 너무 짧게

```sql
-- 나쁨: 이메일 100자 제한
email VARCHAR(100)

-- 나중에 ALTER TABLE로 늘려야 함 (운영 DB에서 비용 큼)
-- 이메일 RFC 5321 기준 최대 254자
email VARCHAR(254)
```

문자열 컬럼은 처음부터 넉넉히 잡는 것이 낫다. VARCHAR는 실제 데이터 크기만큼만 저장하므로 낭비가 없다.

### 3. NULL 허용 기본값을 믿기

```sql
-- SQL의 기본값: NULL 허용
-- 즉, 아래 두 줄은 동일
name VARCHAR(100)
name VARCHAR(100) NULL    -- 명시적 NULL 허용

-- NULL을 허용하고 싶지 않으면 반드시 NOT NULL을 써야 함
name VARCHAR(100) NOT NULL
```

NULL 허용이 기본값이라는 점을 모르면 예상치 못한 `NULL` 값이 데이터에 섞인다.

---

## 기타 유용한 구문

### IF NOT EXISTS

```sql
-- 이미 테이블이 있어도 오류 없이 넘어감
CREATE TABLE IF NOT EXISTS employees (
  id   INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);
```

### TEMPORARY TABLE

```sql
-- 세션 종료 시 자동 삭제되는 임시 테이블
CREATE TEMPORARY TABLE temp_result AS
  SELECT id, name FROM employees WHERE dept_id = 10;
```

### CREATE TABLE AS SELECT (CTAS)

```sql
-- 다른 쿼리 결과로 테이블 생성 (제약 조건 미포함)
CREATE TABLE emp_backup AS
  SELECT * FROM employees WHERE active = TRUE;
```

CTAS는 제약 조건(PK, FK, NOT NULL 등)이 복사되지 않는다. 단순 데이터 복사 목적으로만 쓰자.

---

## DBMS별 차이

| 기능 | 표준 | PostgreSQL | MySQL | Oracle |
|------|------|-----------|-------|--------|
| 자동 증가 PK | `GENERATED ALWAYS AS IDENTITY` | `SERIAL` / `IDENTITY` | `AUTO_INCREMENT` | `GENERATED ALWAYS AS IDENTITY` |
| 현재 시각 기본값 | `CURRENT_TIMESTAMP` | 동일 | 동일 | `SYSDATE` |
| IF NOT EXISTS | 비표준 | 지원 | 지원 | 지원 (12c+) |

```sql
-- PostgreSQL: 자동 증가 PK 두 가지 방식
id SERIAL PRIMARY KEY            -- 구식, 내부적으로 SEQUENCE 생성
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY  -- SQL:2003 표준

-- MySQL
id INT AUTO_INCREMENT PRIMARY KEY

-- Oracle 12c+
id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

---

## 정리

- `CREATE TABLE`은 **테이블명 + 컬럼 정의 + 테이블 수준 제약** 세 부분으로 구성된다.
- 컬럼은 소문자 snake_case, 테이블은 복수형 명사로 짓는 것이 관례다.
- **SQL 예약어**는 테이블/컬럼 이름으로 피해야 한다.
- `NOT NULL`을 명시하지 않으면 기본값은 `NULL 허용`이다.
- 복합 PK/FK 등 여러 컬럼에 걸친 제약은 테이블 수준 제약으로 정의한다.
- VARCHAR 길이는 넉넉히 잡고, PRIMARY KEY는 항상 지정하는 습관을 들이자.

---

**지난 글:** [SQL 언어 분류 — DDL · DML · DCL · TCL](/posts/sql-language-categories/)

**다음 글:** [데이터 타입 표준 (숫자·문자열·불리언) — 언제 어떤 타입을 써야 하는가](/posts/sql-data-types-numeric-string-bool/)

<br>
읽어주셔서 감사합니다. 😊
