---
title: "숫자·문자·불리언 데이터 타입 완전 정복"
description: "INT vs BIGINT, NUMERIC vs FLOAT, CHAR vs VARCHAR, BOOLEAN의 차이를 실무 기준으로 명확하게 정리합니다. 잘못된 타입 선택이 낳는 오버플로우·부동소수 오차·인덱스 문제까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQL", "데이터 타입", "숫자 타입", "문자열 타입", "NUMERIC", "VARCHAR"]
featured: false
draft: false
---

[지난 글](/posts/sql-create-table-basics/)에서 `CREATE TABLE`의 전체 구조를 살펴봤습니다. 이번 글에서는 열 정의의 핵심인 **데이터 타입**을 집중적으로 다룹니다. 타입 선택은 단순히 "어떤 값을 저장하느냐"를 넘어 저장 공간, 인덱스 효율, 연산 정확도에 직접 영향을 줍니다.

## 숫자 타입

### 정수형 선택 기준

![숫자 데이터 타입 비교](/assets/posts/sql-data-types-numeric-string-bool-numeric.svg)

실무에서 가장 흔한 실수는 `INT`를 PK로 사용하다 오버플로우가 발생하는 것입니다. 약 21억(2^31 - 1)을 넘는 순간 에러가 납니다. 하루 수만 건 이상 삽입하는 서비스라면 처음부터 `BIGINT`를 사용합니다.

```sql
-- 위험한 설계: 대규모 서비스에서 21억 초과 시 오버플로우
id INT PRIMARY KEY

-- 안전한 설계
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

### NUMERIC vs FLOAT

**금액, 재고, 세금 등 정확도가 필요한 값에는 반드시 `NUMERIC`(또는 `DECIMAL`)을 사용합니다.**

`FLOAT`과 `DOUBLE`은 IEEE 754 이진 부동소수점이라 십진수 0.1을 정확히 표현하지 못합니다.

```sql
-- 부동소수점 오차 실험 (PostgreSQL)
SELECT 0.1 + 0.2 = 0.3;        -- false (이진 부동소수)
SELECT 0.1::NUMERIC + 0.2::NUMERIC = 0.3::NUMERIC;  -- true

-- 실무 금액 타입
price NUMERIC(12, 2)   -- 최대 999,999,999.99원
tax   NUMERIC(8, 4)    -- 세율 0.1234
```

`NUMERIC(p, s)`에서 p는 **전체 유효 자릿수**, s는 **소수점 이하 자릿수**입니다. `NUMERIC(5, 2)`에 `1000.00`을 넣으면 전체 7자리가 필요하므로 오류가 납니다.

## 문자열 타입

![문자열 · 불리언 타입](/assets/posts/sql-data-types-numeric-string-bool-string.svg)

### CHAR vs VARCHAR

`CHAR(n)`은 고정 길이입니다. `CHAR(10)`에 `'abc'`를 저장하면 내부적으로 `'abc       '`(공백 7개 패딩)로 저장됩니다. 비교 시 공백이 무시되는 경우가 많지만 DBMS마다 동작이 다릅니다.

`VARCHAR(n)`은 가변 길이입니다. 실제 길이만큼만 저장합니다. **일반적으로 VARCHAR를 기본으로 선택하고, 정말 고정 길이인 값(ISO 국가코드 `CHAR(2)` 등)에만 CHAR를 씁니다.**

| 비교 항목 | CHAR(n) | VARCHAR(n) |
|---|---|---|
| 저장 공간 | 항상 n 바이트 | 실제 길이 + 오버헤드 |
| 조회 속도 | 약간 빠를 수 있음 | 동등 또는 비슷 |
| 사용 예 | 국가 코드, 고정 코드 | 이름, 이메일, URL |

### TEXT와 길이 제한

PostgreSQL의 `TEXT` 타입은 `VARCHAR(n)`과 성능 차이가 없고 길이 제한이 없습니다. 애플리케이션 레이어에서 길이 제한을 하거나, DB에서도 제한이 필요하면 `CHECK (LENGTH(column) <= 200)`을 추가합니다.

```sql
-- PostgreSQL에서 TEXT + CHECK는 VARCHAR(200)과 동일 효과
content TEXT CHECK (LENGTH(content) <= 2000)
```

### 문자 집합(charset)과 콜레이션

한국어 데이터를 저장할 때는 반드시 UTF-8을 확인합니다.

```sql
-- MySQL: 테이블 또는 열 단위로 지정 가능
CREATE TABLE posts (
    title VARCHAR(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
);

-- PostgreSQL: 데이터베이스 생성 시 지정
CREATE DATABASE mydb ENCODING 'UTF8' LC_COLLATE 'ko_KR.UTF-8';
```

MySQL에서 `utf8` 대신 `utf8mb4`를 사용해야 이모지(4바이트 문자)가 깨지지 않습니다.

## 불리언 타입

```sql
-- ANSI 표준 BOOLEAN (PostgreSQL, SQLite)
is_active    BOOLEAN NOT NULL DEFAULT TRUE,
is_deleted   BOOLEAN NOT NULL DEFAULT FALSE

-- MySQL: BOOLEAN = TINYINT(1)  (0=FALSE, 1=TRUE, NULL 가능)
-- Oracle: BOOLEAN 타입 없음 → NUMBER(1) CHECK(col IN (0,1)) 또는 CHAR(1) IN ('Y','N')
```

주의해야 할 점은 `BOOLEAN`도 NULL을 가질 수 있어 세 가지 값(TRUE/FALSE/NULL)이 존재한다는 것입니다. "아직 알 수 없는 상태"와 "거짓"을 구별할 필요가 있으면 NULL을 허용하고, 그렇지 않으면 `NOT NULL DEFAULT FALSE`를 씁니다.

## 타입 변환(CAST)

```sql
-- 명시적 변환
SELECT CAST('2026-05-30' AS DATE);
SELECT CAST(3.14 AS NUMERIC(5,2));

-- PostgreSQL 단축 문법
SELECT '2026-05-30'::DATE;
SELECT '3.14'::NUMERIC(5,2);
```

암묵적 변환은 DBMS가 자동으로 타입을 바꾸는 것으로, 인덱스를 무력화할 수 있습니다.

```sql
-- 위험: VARCHAR 컬럼에 INT 비교 → 암묵적 변환으로 인덱스 미사용 가능
WHERE phone_number = 1012345678   -- phone_number가 VARCHAR라면

-- 안전: 타입 일치
WHERE phone_number = '01012345678'
```

## 정리

| 상황 | 권장 타입 |
|---|---|
| 대규모 서비스 ID | `BIGINT` |
| 금액, 세율 | `NUMERIC(p, s)` |
| 과학 계산 피처 | `FLOAT` / `DOUBLE` |
| 일반 텍스트 | `VARCHAR(n)` |
| 무제한 텍스트 (PG) | `TEXT` |
| 불리언 플래그 | `BOOLEAN NOT NULL DEFAULT FALSE` |

다음 글에서는 날짜와 시간 타입을 다룹니다. 타임존 처리와 함께 실무에서 가장 많이 틀리는 부분 중 하나입니다.

---

**지난 글:** [CREATE TABLE 기초 — 테이블을 만드는 방법](/posts/sql-create-table-basics/)

**다음 글:** [날짜와 시간 데이터 타입](/posts/sql-data-types-datetime/)

<br>
읽어주셔서 감사합니다. 😊
