---
title: "데이터 타입 완전 정복: 숫자·문자열·불리언"
description: "SQL의 숫자 타입(INTEGER·BIGINT·NUMERIC·FLOAT), 문자열 타입(CHAR·VARCHAR·TEXT), 불리언과 NULL의 3값 논리를 실전 코드와 함께 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["데이터타입", "INTEGER", "NUMERIC", "VARCHAR", "BOOLEAN", "NULL", "3값논리"]
featured: false
draft: false
---

[지난 글](/posts/sql-create-table-basics/)에서 `CREATE TABLE` 문법을 살펴봤다. 테이블 정의에서 가장 중요한 결정 중 하나가 각 열에 어떤 데이터 타입을 쓸지다. 잘못된 타입 선택은 오류, 성능 저하, 데이터 오염으로 이어진다. 이번 글에서는 숫자·문자열·불리언 타입을 깊이 파고든다.

## 숫자 타입

![숫자 데이터 타입 완전 정리](/assets/posts/sql-data-types-numeric-string-bool-numeric.svg)

### 정수형

```sql
-- 용도별 정수 타입 선택
age      SMALLINT,      -- 0~150, 2 bytes
user_id  INTEGER,       -- 최대 21억, 4 bytes
event_id BIGINT,        -- 천문학적 수치, 8 bytes
```

`SERIAL`(PostgreSQL) / `AUTO_INCREMENT`(MySQL) / `IDENTITY`(SQL Server, Oracle) 는 정수형에 자동 증가 기능을 더한 것이다. 기술적으로는 시퀀스(sequence)를 기반으로 동작한다.

### 고정소수점: NUMERIC(p, s)

금액·비율처럼 **정확한 소수 표현**이 필요할 때 사용한다.

- `p` (precision): 전체 자릿수
- `s` (scale): 소수점 이하 자릿수

```sql
price    NUMERIC(12, 2),  -- 99999999.99 까지
tax_rate NUMERIC(5, 4),   -- 0.0000 ~ 9.9999 (세율)
```

`DECIMAL`은 `NUMERIC`과 동의어다. SQL 표준이기도 하고, 대부분의 DB에서 완전히 동일하게 동작한다.

### 부동소수점: REAL / DOUBLE PRECISION

**과학 계산, 통계, 측정값**에 사용한다. IEEE 754 표준 부동소수점 연산을 사용하므로 이진수 표현 한계로 인한 오차가 발생한다.

```sql
-- 절대로 금액에 FLOAT를 쓰지 말 것
SELECT 0.1 + 0.2;
-- 결과: 0.30000000000000004  ← 오차 발생!

-- NUMERIC으로 계산하면
SELECT CAST(0.1 AS NUMERIC) + CAST(0.2 AS NUMERIC);
-- 결과: 0.3  ← 정확
```

`FLOAT(n)` 문법도 존재하는데, n이 1~24면 `REAL`, 25~53이면 `DOUBLE PRECISION`에 매핑된다.

## 문자열 타입

![문자열 & 불리언 타입](/assets/posts/sql-data-types-numeric-string-bool-string.svg)

### CHAR(n) — 고정 길이

선언한 길이보다 짧은 값이 들어오면 **공백으로 패딩(padding)**된다.

```sql
CREATE TABLE countries (
    code CHAR(2) NOT NULL  -- 'KR', 'US', 'JP' 등 항상 2자
);
```

`CHAR`의 공백 패딩 동작은 비교 시 혼란을 일으킨다. `CHAR(10)` 컬럼에 `'abc'`를 저장하면 `'abc       '`로 저장되는데, 많은 DB가 비교 시 trailing space를 무시하므로 `'abc' = 'abc  '`가 TRUE가 된다. 코드 값처럼 항상 길이가 동일한 데이터에만 사용하라.

### VARCHAR(n) — 가변 길이 (주력)

가장 많이 사용하는 문자열 타입이다. 실제 값의 길이만큼만 저장한다.

```sql
name  VARCHAR(100),
email VARCHAR(200),
url   VARCHAR(2048)
```

`n`은 **문자 수**다(일부 DB는 바이트 수). 한글처럼 멀티바이트 문자를 사용할 때 `n`을 너무 작게 잡지 않도록 주의한다.

### TEXT — 무제한 길이

PostgreSQL에서 `TEXT`는 `VARCHAR`와 내부 저장 방식이 동일하며 성능 차이도 없다. 길이 제한만 없다.

```sql
body        TEXT,        -- 블로그 본문
log_message TEXT,        -- 로그 내용
raw_json    TEXT         -- JSON 문자열 (jsonb 사용이 더 좋음)
```

MySQL의 경우 TEXT 계열(`TINYTEXT`, `TEXT`, `MEDIUMTEXT`, `LONGTEXT`)은 인덱스 길이 제한이 있어 직접 인덱싱이 제한된다. Oracle은 `CLOB`(Character Large OBject)를 사용한다.

## 불리언과 NULL의 3값 논리

SQL의 불리언은 단순한 true/false가 아니라 **TRUE / FALSE / NULL** 세 가지 값을 갖는다.

NULL은 "값 없음"이 아니라 **"알 수 없음(UNKNOWN)"**이다. 이 때문에 다음과 같은 결과가 나온다.

```sql
-- NULL 비교는 항상 NULL (TRUE/FALSE가 아님)
SELECT NULL = NULL;   -- NULL (알 수 없음)
SELECT NULL IS NULL;  -- TRUE ← NULL 확인은 IS NULL로

-- NULL과의 논리 연산
SELECT TRUE  AND NULL;   -- NULL
SELECT FALSE AND NULL;   -- FALSE (한쪽이 FALSE면 확실히 거짓)
SELECT TRUE  OR  NULL;   -- TRUE  (한쪽이 TRUE면 확실히 참)

-- WHERE 조건에서 NULL
SELECT * FROM users WHERE deleted_at != '2024-01-01';
-- deleted_at IS NULL인 행은 결과에 포함되지 않음!
-- NULL != '2024-01-01' = NULL (조건 불만족으로 처리)
```

이 NULL 동작을 모르면 조건절에서 NULL 행을 예상치 못하게 걸러내는 버그가 생긴다.

## DB별 불리언 처리

| DB | BOOLEAN 지원 | 실제 저장 |
|----|------------|---------|
| PostgreSQL | `BOOLEAN` 네이티브 | 1 byte |
| MySQL | `TINYINT(1)` | 0 또는 1 |
| Oracle | 없음 (PL/SQL에만 있음) | `NUMBER(1)` 또는 `CHAR(1)` 관례 |
| SQL Server | `BIT` | 0 또는 1 |

```sql
-- MySQL에서 BOOLEAN 컬럼 정의
is_active BOOLEAN,   -- 내부적으로 TINYINT(1)로 처리됨

-- Oracle에서 불리언 표현
is_active NUMBER(1) CHECK (is_active IN (0, 1))
```

## 타입 캐스팅

```sql
-- 표준 CAST 함수
SELECT CAST('42' AS INTEGER);
SELECT CAST(3.14 AS NUMERIC(5,2));

-- PostgreSQL 단축 문법
SELECT '42'::INTEGER;
SELECT NOW()::DATE;

-- 문자열 → 숫자 변환 실패 시 에러 (NULL 반환 필요시 try_cast)
-- SQL Server: TRY_CAST('abc' AS INT) → NULL
```

---

**지난 글:** [CREATE TABLE 기초: 테이블 생성의 모든 것](/posts/sql-create-table-basics/)

**다음 글:** [데이터 타입 완전 정복: 날짜·시간 타입](/posts/sql-data-types-datetime/)

<br>
읽어주셔서 감사합니다. 😊
