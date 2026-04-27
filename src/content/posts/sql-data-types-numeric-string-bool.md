---
title: "데이터 타입 표준 (숫자·문자열·불리언) — 언제 어떤 타입을 써야 하는가"
description: "INTEGER·DECIMAL·FLOAT의 차이, CHAR·VARCHAR·TEXT의 선택 기준, 불리언 타입의 DBMS별 차이를 정리합니다. 부동소수점 오차 함정과 VARCHAR 길이 설계 가이드도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "data-types", "integer", "decimal", "float", "varchar", "boolean", "ddl", "스키마"]
featured: false
draft: false
---

## 타입 선택이 중요한 이유

`CREATE TABLE`에서 컬럼 타입을 잘못 잡으면 나중에 `ALTER TABLE`로 바꿔야 한다. 운영 DB에서 타입 변경은 테이블 잠금이나 풀 리빌드를 동반하는 경우가 많다. 처음 설계할 때 한 번만 제대로 하면 평생 편하다.

SQL 표준이 정의한 타입은 크게 세 범주다.

- **숫자**: 정수, 고정소수점, 부동소수점
- **문자열**: 고정 길이, 가변 길이, 대형 텍스트
- **불리언**: 참/거짓

---

## 숫자 타입

![숫자 데이터 타입](/assets/posts/sql-data-types-numeric-string-bool-numeric.svg)

### 정수 (Integer Family)

| 타입 | 크기 | 범위 |
|------|------|------|
| `SMALLINT` | 2바이트 | -32,768 ~ 32,767 |
| `INTEGER` | 4바이트 | ±2,147,483,647 (약 ±21억) |
| `BIGINT` | 8바이트 | ±9,223,372,036,854,775,807 |

대부분의 경우 `INTEGER`로 충분하다. 사용자 ID처럼 수십억 개를 넘을 수 있는 식별자는 `BIGINT`를 쓴다. `SMALLINT`는 상태 코드처럼 값 범위가 매우 좁은 컬럼에 사용하면 공간을 절약할 수 있지만, 실무에서는 그냥 `INTEGER`를 쓰는 경우도 많다.

### 고정소수점 (DECIMAL / NUMERIC)

```sql
-- p: 전체 유효 자릿수 (precision), s: 소수점 이하 자릿수 (scale)
amount   DECIMAL(12, 2)  -- 최대 9,999,999,999.99
tax_rate NUMERIC(5, 4)   -- 최대 9.9999 (0~1 사이 비율)
```

`DECIMAL`과 `NUMERIC`은 SQL 표준상 동의어이며, 실제 저장 방식도 동일하다. **금액, 세율, 환율, 할인율**처럼 오차 없는 정확한 계산이 필요한 모든 곳에 사용한다.

정밀도 규칙:
- `DECIMAL(10, 2)` → 정수부 8자리 + 소수부 2자리
- `DECIMAL(5, 5)` → 0.XXXXX 형태만 가능 (0 이상 1 미만)
- scale이 precision보다 클 수 없다

### 부동소수점 (REAL / DOUBLE PRECISION / FLOAT)

```sql
latitude   DOUBLE PRECISION  -- GPS 위도
longitude  DOUBLE PRECISION  -- GPS 경도
score      REAL              -- 분류 확률
```

IEEE 754 표준에 따라 2진수로 근사 저장하기 때문에 **정확한 값을 보장하지 않는다.**

```sql
-- 부동소수점 오차 예시 (대부분의 언어·DB에서 재현)
SELECT 0.1 + 0.2;
-- 결과: 0.30000000000000004 (또는 유사한 근사값)
```

이 오차는 DBMS 버그가 아니라 IEEE 754의 본질적 특성이다. 금융 계산에 부동소수점을 쓰면 합산 오차가 누적되어 결국 장부가 맞지 않는다. **금액·이자·환율에는 반드시 `DECIMAL`/`NUMERIC`을 사용한다.**

부동소수점이 적합한 경우:
- 과학 계산, 통계, 머신러닝 특성값
- GPS 좌표처럼 정밀도보다 범위가 중요한 값
- 성능이 중요하고 약간의 오차가 허용되는 집계

---

## 문자열 타입

![문자열과 불리언 타입](/assets/posts/sql-data-types-numeric-string-bool-string.svg)

### CHAR(n) — 고정 길이

```sql
country_code CHAR(2)   -- 'KR', 'US'
gender_code  CHAR(1)   -- 'M', 'F'
```

항상 n바이트를 사용한다. `'KR'`을 `CHAR(5)`에 저장하면 `'KR   '`처럼 뒤에 공백이 패딩된다. 비교 시 후행 공백을 무시하는 DBMS가 많지만 일관성을 위해 항상 정해진 길이의 값만 넣는 컬럼에 사용하는 것이 좋다.

### VARCHAR(n) — 가변 길이

```sql
name   VARCHAR(100)  NOT NULL
email  VARCHAR(254)  UNIQUE
url    VARCHAR(2048)
```

실제 데이터 길이만큼만 저장한다. n은 최대 허용 바이트/문자 수이며, 초과 시 오류가 발생한다. **가장 범용적인 문자열 타입**이다.

VARCHAR 길이 설계 가이드:

| 용도 | 권장 길이 | 근거 |
|------|----------|------|
| 이메일 | 254 | RFC 5321 최대값 |
| URL | 2048 | 실용적 상한 |
| 사람 이름 | 100 | 충분한 여유 |
| 주소 한 줄 | 255 | 일반적 관례 |
| UUID 문자열 | 36 | 형식 고정 |

VARCHAR는 실제 저장 크기만큼만 공간을 쓰므로 길이를 넉넉하게 잡아도 낭비가 없다. 너무 짧게 잡으면 나중에 `ALTER TABLE`을 해야 한다.

### TEXT — 길이 제한 없음

```sql
body    TEXT  -- 게시글 본문
log_msg TEXT  -- 로그 메시지
```

SQL 표준에는 없고 DBMS 확장 타입이다. PostgreSQL에서는 길이 제한 없이 저장하고, MySQL에서는 65,535바이트까지 허용한다(더 긴 경우 `MEDIUMTEXT`, `LONGTEXT` 사용).

주의할 점은 `TEXT` 컬럼에는 인덱스를 일반 방식으로 생성할 수 없거나(또는 접두사 인덱스가 필요하다). 자주 검색 조건으로 쓰이는 컬럼이라면 `VARCHAR(n)`을 사용하는 것이 낫다.

---

## 불리언 타입

```sql
is_active  BOOLEAN  DEFAULT TRUE
is_deleted BOOLEAN  DEFAULT FALSE
has_paid   BOOLEAN
```

SQL의 불리언은 `TRUE`, `FALSE`, `NULL` 세 가지 값을 가진다. `NULL`은 "알 수 없음(UNKNOWN)"을 의미하며 참도 거짓도 아니다.

```sql
-- NULL 조건은 IS NULL / IS NOT NULL로 검사
SELECT * FROM accounts WHERE is_active;             -- TRUE인 행만
SELECT * FROM accounts WHERE is_active IS NULL;     -- 값이 없는 행
SELECT * FROM accounts WHERE NOT is_active;         -- FALSE인 행만

-- 주의: NULL = FALSE가 아님
SELECT * FROM accounts WHERE is_active = FALSE;     -- NULL 행은 포함되지 않음
```

### DBMS별 차이

| DBMS | BOOLEAN 지원 | 내부 구현 |
|------|-------------|----------|
| PostgreSQL | 네이티브 지원 | 1바이트 |
| MySQL 8+ | `BOOLEAN` 키워드 | `TINYINT(1)` 별칭 (0/1) |
| Oracle 21c 이전 | 미지원 | `NUMBER(1)` 관례 사용 |
| Oracle 23c+ | 네이티브 지원 | — |
| SQL Server | 미지원 | `BIT` (0/1) 사용 |

MySQL에서 `BOOLEAN`으로 정의한 컬럼은 실제로 `TINYINT(1)`로 저장된다. `TRUE`는 1, `FALSE`는 0이다. 따라서 `WHERE is_active = 1`도 작동하지만, 가독성을 위해 `WHERE is_active = TRUE`나 `WHERE is_active`를 쓰는 것이 좋다.

---

## DBMS별 타입 이름 비교

| 표준 | PostgreSQL | MySQL | Oracle |
|------|-----------|-------|--------|
| `INTEGER` | `INT4` / `INTEGER` | `INT` | `NUMBER(10)` |
| `BIGINT` | `INT8` / `BIGINT` | `BIGINT` | `NUMBER(19)` |
| `DECIMAL(p,s)` | 동일 | 동일 | `NUMBER(p,s)` |
| `DOUBLE PRECISION` | `FLOAT8` / 동일 | `DOUBLE` | `BINARY_DOUBLE` |
| `VARCHAR(n)` | 동일 | 동일 | `VARCHAR2(n)` |
| `BOOLEAN` | 동일 | `TINYINT(1)` | `NUMBER(1)` / 23c+ |

---

## 정리

- **금액, 세율, 환율**에는 `DECIMAL(p, s)` 또는 `NUMERIC(p, s)`.
- **부동소수점**(`FLOAT`, `REAL`, `DOUBLE`)은 오차가 있다. 과학·좌표 등에만 사용.
- **문자열**은 고정 길이면 `CHAR`, 가변이면 `VARCHAR`, 긴 본문이면 `TEXT`.
- `VARCHAR` 길이는 넉넉히 잡자 — 낭비 없이 크게 설계하는 것이 낫다.
- **불리언**은 SQL 3값 논리(`TRUE`, `FALSE`, `NULL`)임을 기억하자.
- DBMS마다 타입 이름이 다르지만 표준 타입을 쓰면 이식성이 높아진다.

---

**지난 글:** [CREATE TABLE 기초 — 테이블을 제대로 정의하는 방법](/posts/sql-create-table-basics/)

**다음 글:** [데이터 타입 표준 (날짜·시간) — DATE·TIME·TIMESTAMP와 타임존 함정](/posts/sql-data-types-datetime/)

<br>
읽어주셔서 감사합니다. 😊
