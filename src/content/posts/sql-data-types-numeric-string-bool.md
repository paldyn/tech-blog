---
title: "데이터 타입 완전 정복 — 숫자, 문자열, 불리언"
description: "INT, BIGINT, DECIMAL, FLOAT의 차이와 적합한 용도, CHAR vs VARCHAR 선택 기준, BOOLEAN 타입의 DBMS별 구현 차이를 정리합니다. 금액에 FLOAT를 쓰면 안 되는 이유도 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQL", "데이터타입", "INT", "DECIMAL", "VARCHAR", "BOOLEAN", "CHAR", "BIGINT"]
featured: false
draft: false
---

[지난 글](/posts/sql-create-table-basics/)에서 `CREATE TABLE`의 구문 구조를 살펴봤다. 테이블을 만들 때 가장 중요한 결정 중 하나가 각 열의 **데이터 타입**이다. 잘못된 타입 선택은 나중에 데이터 불일치, 성능 저하, 마이그레이션 비용으로 돌아온다. 이번에는 가장 많이 쓰이는 세 가지 타입 계열 — 숫자, 문자열, 불리언 — 을 깊이 다룬다.

## 정수 타입

![숫자 타입 선택 가이드](/assets/posts/sql-data-types-numeric-string-bool-types.svg)

정수 타입은 크기에 따라 범위가 다르다. 실무에서 PK에는 `INT` 또는 `BIGINT`를 쓴다.

**INT로 충분한 경우**: 하루 수만 건 이하의 트래픽, 사용자가 수백만 미만인 시스템. INT는 최대 21억 2천만 정도까지 표현 가능하다. 부호 없음(UNSIGNED)으로 설정하면 약 42억까지 가능하다.

**BIGINT를 써야 하는 경우**: 대용량 트래픽, 쇼핑몰 주문처럼 빠르게 쌓이는 이벤트성 데이터, 타임스탬프를 밀리초 단위로 저장하는 경우. INT의 오버플로우는 조용히 일어나 데이터 정합성 문제를 유발한다. 처음부터 BIGINT로 설계하는 것이 안전하다.

## 소수/정밀 숫자 타입

```sql
-- DECIMAL(p, s): p = 전체 자릿수, s = 소수점 이하 자릿수
-- 예: DECIMAL(10, 2) → 12345678.99까지 정확히 저장

-- 금액 (원화: 소수점 없음)
price    DECIMAL(15, 0) NOT NULL

-- 외화 환율 (소수점 6자리)
rate     DECIMAL(12, 6) NOT NULL

-- 잘못된 예: FLOAT으로 금액 저장
SELECT 0.1 + 0.2;  -- 0.30000000000000004 (부동소수점 오차)
```

`DECIMAL`(또는 `NUMERIC` — 표준 SQL 이름)은 10진수를 정확히 저장한다. `FLOAT`과 `DOUBLE`은 이진 부동소수점이라 근사값이다. 금액 계산에 FLOAT을 쓰면 1원 단위 오차가 누적된다. 정밀도가 필요한 모든 수치에는 `DECIMAL`을 사용하라.

## 문자열 타입

### CHAR vs VARCHAR

| | CHAR(n) | VARCHAR(n) |
|---|---|---|
| 저장 크기 | 항상 n바이트 | 실제 길이 + 1~2바이트 오버헤드 |
| 속도 | 고정 길이라 약간 빠름 | 가변 처리 |
| 적합한 데이터 | ISO 코드(KRW, US, M/F), 해시값, 주민번호 | 이름, 이메일, 주소 |

실무에서는 **거의 대부분 VARCHAR**을 쓴다. CHAR는 절대 길이가 고정인 코드 값에만 사용하면 된다.

```sql
-- CHAR 적합: ISO 화폐 코드는 항상 3글자
currency CHAR(3) NOT NULL  -- 'KRW', 'USD', 'EUR'

-- VARCHAR 적합: 이름 길이는 사람마다 다름
name VARCHAR(100) NOT NULL

-- TEXT: 길이 제한이 없거나 매우 긴 문자열
-- 인덱스 생성 시 접두사(prefix) 길이 지정 필요
description TEXT NULL
```

### DBMS별 차이

Oracle에서는 `VARCHAR` 대신 `VARCHAR2`를 권장한다(표준 VARCHAR가 미래에 변경될 수 있다는 Oracle의 결정). SQL Server의 `NVARCHAR(n)`은 UTF-16으로 유니코드 문자를 저장하며 바이트 크기가 2배다. 한글을 저장할 때 `VARCHAR`와 `NVARCHAR` 중 어느 것을 쓸지는 DB의 기본 Collation에 따라 다르다.

## BOOLEAN 타입

표준 SQL에서 BOOLEAN은 `TRUE`, `FALSE`, `UNKNOWN`(NULL) 세 값을 가진다.

```sql
-- PostgreSQL: 네이티브 BOOLEAN 타입
is_active BOOLEAN NOT NULL DEFAULT TRUE

-- MySQL: TINYINT(1)로 구현 (0=FALSE, 1=TRUE)
is_active TINYINT(1) NOT NULL DEFAULT 1

-- Oracle: 네이티브 BOOLEAN 없음 (PL/SQL에서는 있음)
-- 관행적으로 CHAR(1) CHECK IN ('Y','N') 또는 NUMBER(1) 사용
is_active CHAR(1) NOT NULL DEFAULT 'Y' CHECK (is_active IN ('Y','N'))

-- SQL Server: BIT 타입 (0 또는 1)
is_active BIT NOT NULL DEFAULT 1
```

MySQL에서 BOOLEAN 조건을 쓸 때 주의할 점이 있다. `WHERE is_active = TRUE`는 `WHERE is_active = 1`과 같다. 하지만 2나 -1도 `TRUE`와 다르다는 점에서, TINYINT에 0과 1 이외의 값이 들어갈 수 있는 상황을 CHECK 제약으로 막는 것이 안전하다.

## 실전 예시

![타입 선택 실전 예시](/assets/posts/sql-data-types-numeric-string-bool-examples.svg)

## 타입 변환

SQL은 암묵적 타입 변환을 허용하지만 이것이 예기치 못한 인덱스 미사용으로 이어질 수 있다.

```sql
-- 인덱스가 있는 VARCHAR 열에 숫자를 비교하면
-- 묵시적 변환으로 인해 인덱스를 못 쓸 수 있음
WHERE user_code = 12345     -- 나쁨: user_code가 VARCHAR일 때
WHERE user_code = '12345'   -- 좋음: 타입 일치

-- 명시적 변환
SELECT CAST('2024-01-15' AS DATE);
SELECT CAST(price AS INT);
SELECT CONVERT(amount, DECIMAL(10,2));  -- MySQL 방식
```

타입을 정확히 일치시키는 것은 인덱스 효율뿐만 아니라 집합 비교, JOIN 조건에서도 중요하다. 다음 글에서는 날짜와 시간 타입을 다룬다.

---

**지난 글:** [CREATE TABLE 기초 — 테이블 생성과 구조 설계](/posts/sql-create-table-basics/)

**다음 글:** [날짜/시간 데이터 타입 완전 정복](/posts/sql-data-types-datetime/)

<br>
읽어주셔서 감사합니다. 😊
