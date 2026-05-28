---
title: "SQL 데이터 타입 — 숫자·문자열·불리언"
description: "SQL의 숫자(INT, NUMERIC, FLOAT), 문자열(CHAR, VARCHAR, TEXT), 불리언 타입을 비교하고 적합한 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQL", "데이터 타입", "NUMERIC", "VARCHAR", "BOOLEAN"]
featured: false
draft: false
---

[지난 글](/posts/sql-create-table-basics/)에서 `CREATE TABLE`의 기본 문법을 배웠습니다. 테이블을 올바르게 설계하려면 각 열에 맞는 데이터 타입을 선택해야 합니다. 잘못된 타입 선택은 데이터 손실, 계산 오류, 성능 저하로 이어집니다. 이번 글에서는 숫자·문자열·불리언 타입을 깊이 있게 살펴봅니다.

## 숫자 타입

### 정수 타입

| 타입 | 크기 | 범위 | 사용 예 |
|------|------|------|---------|
| `SMALLINT` | 2 bytes | -32,768 ~ 32,767 | 작은 코드 값 |
| `INTEGER` / `INT` | 4 bytes | ±2,147,483,647 | 일반 ID, 수량 |
| `BIGINT` | 8 bytes | ±9.2 × 10¹⁸ | 대용량 PK, 타임스탬프 |

```sql
-- 자동 증가 ID (DBMS별 차이)
-- SQL:2003 표준
CREATE TABLE orders (
    order_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

-- PostgreSQL 단축형
CREATE TABLE orders (order_id BIGSERIAL PRIMARY KEY);

-- MySQL
CREATE TABLE orders (order_id BIGINT AUTO_INCREMENT PRIMARY KEY);

-- Oracle
CREATE SEQUENCE orders_seq START WITH 1 INCREMENT BY 1;
```

### 정밀 소수: NUMERIC(p, s)

금융·회계 데이터에는 반드시 `NUMERIC` 또는 `DECIMAL`을 사용해야 합니다. `FLOAT`·`DOUBLE`은 IEEE 754 부동소수점이라 이진 표현에서 오차가 생깁니다.

```sql
-- 금액 컬럼
salary       NUMERIC(14, 2),  -- 최대 999,999,999,999.99
tax_rate     NUMERIC(5, 4),   -- 0.0000 ~ 9.9999
unit_price   DECIMAL(10, 2)   -- DECIMAL = NUMERIC (동의어)
```

**p(precision)**: 전체 유효 자릿수. **s(scale)**: 소수점 이하 자릿수.  
`NUMERIC(8, 2)` → 최대 `999999.99`.

### 근사 소수: FLOAT / DOUBLE

과학 계산, 좌표, 통계 값처럼 **약간의 오차가 허용되는 경우**에만 사용합니다.

```sql
-- ✓ 사용 가능한 경우
latitude   DOUBLE PRECISION,  -- GPS 위도
score      REAL               -- 머신러닝 점수

-- ✗ 절대 사용 금지
price      FLOAT  -- 0.1 + 0.2 = 0.30000000000000004 오류 발생!
```

![숫자/문자열/불리언 타입 정리](/assets/posts/sql-data-types-numeric-string-bool-chart.svg)

## 문자열 타입

### CHAR(n) vs VARCHAR(n)

`CHAR(n)`은 **고정 길이**: 저장 값이 n보다 짧으면 공백으로 패딩합니다.  
`VARCHAR(n)`은 **가변 길이**: 실제 문자 수만큼만 저장합니다.

```sql
-- 코드 값처럼 항상 고정 길이인 경우
country_code CHAR(2)    NOT NULL,  -- 'KR', 'US'
gender       CHAR(1)    NOT NULL,  -- 'M', 'F'

-- 가변 길이 문자열 (대부분의 경우)
name         VARCHAR(100) NOT NULL,
email        VARCHAR(320) NOT NULL,  -- 이메일 최대 320자
description  VARCHAR(2000)
```

![NUMERIC vs FLOAT 정밀도, CHAR vs VARCHAR 비교](/assets/posts/sql-data-types-numeric-string-bool-precision.svg)

### TEXT / CLOB

길이 제한 없는 텍스트가 필요할 때 사용합니다.

```sql
-- PostgreSQL
body         TEXT,

-- Oracle (4000바이트 초과 시)
content      CLOB,

-- MySQL
description  LONGTEXT
```

> **VARCHAR 길이 기준**: UTF-8에서 한글 한 글자는 3바이트이지만, `VARCHAR(100)`의 `100`은 **바이트가 아닌 문자 수**입니다 (표준 SQL 기준). 단, 일부 구버전 MySQL은 바이트 기준이었으니 주의하세요.

### 문자 집합(Charset)과 콜레이션(Collation)

```sql
-- MySQL: 테이블 생성 시 문자 집합 지정
CREATE TABLE posts (
    content TEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- utf8mb4: 이모지 포함 4바이트 유니코드 완전 지원
-- utf8(3바이트)은 이모지 저장 불가 — MySQL에서는 utf8mb4 사용 권장
```

## 불리언 타입

```sql
-- PostgreSQL: 표준 BOOLEAN
is_active    BOOLEAN NOT NULL DEFAULT TRUE,
is_deleted   BOOLEAN NOT NULL DEFAULT FALSE

-- Oracle: NUMBER(1) 관례 (1=TRUE, 0=FALSE)
is_active    NUMBER(1) DEFAULT 1 CHECK (is_active IN (0, 1))

-- MySQL: TINYINT(1) 사용 관례 (또는 BOOL/BOOLEAN = TINYINT(1))
is_active    TINYINT(1) NOT NULL DEFAULT 1
```

```sql
-- PostgreSQL: 불리언 값 표현 방법
SELECT * FROM users WHERE is_active = TRUE;
SELECT * FROM users WHERE is_active;          -- 단축형
SELECT * FROM users WHERE NOT is_deleted;
```

## 이진 타입

파일·이미지 등 바이너리 데이터 저장이 꼭 필요한 경우에 사용합니다. 일반적으로는 파일을 스토리지(S3 등)에 두고 DB에는 경로만 저장하는 편이 낫습니다.

```sql
-- PostgreSQL
thumbnail    BYTEA,

-- MySQL
thumbnail    MEDIUMBLOB,

-- Oracle
thumbnail    BLOB
```

## 데이터 타입 선택 요약

| 상황 | 권장 타입 |
|------|-----------|
| 자동 증가 PK | `INT` / `BIGINT` + IDENTITY/SERIAL |
| 금액·환율 | `NUMERIC(p, s)` |
| 과학적 수치 | `DOUBLE PRECISION` |
| 짧은 고정 코드 | `CHAR(n)` |
| 가변 문자열 | `VARCHAR(n)` |
| 긴 텍스트 | `TEXT` / `CLOB` |
| 참/거짓 플래그 | `BOOLEAN` (가능한 DBMS) |

## 정리

- 정수는 `SMALLINT` < `INT` < `BIGINT` 순으로 범위와 크기가 커집니다.
- 금액·정밀 계산에는 반드시 `NUMERIC(p, s)`, 근사치에는 `FLOAT`/`DOUBLE`을 사용합니다.
- `CHAR`는 고정 코드 값에, `VARCHAR`는 나머지 모든 문자열에 사용합니다.
- MySQL에서 한국어·이모지를 위해서는 `utf8mb4`를 사용해야 합니다.

다음 글에서는 **날짜와 시간 타입** — `DATE`, `TIME`, `TIMESTAMP`, `INTERVAL` — 을 살펴봅니다.

---

**지난 글:** [CREATE TABLE 기초 — 테이블 설계의 시작](/posts/sql-create-table-basics/)

**다음 글:** [SQL 데이터 타입 — 날짜와 시간](/posts/sql-data-types-datetime/)

<br>
읽어주셔서 감사합니다. 😊
