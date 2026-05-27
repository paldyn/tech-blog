---
title: "SQL 데이터 타입 완전 정복 — 숫자, 문자, 논리형"
description: "INT vs BIGINT vs DECIMAL, CHAR vs VARCHAR vs TEXT, BOOLEAN의 DBMS별 차이, 금액에 FLOAT를 쓰면 안 되는 이유를 코드 예제와 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQL데이터타입", "INT", "DECIMAL", "VARCHAR", "BOOLEAN", "부동소수점", "금액타입", "CHAR"]
featured: false
draft: false
---

[지난 글](/posts/sql-create-table-basics/)에서 `CREATE TABLE` 구문을 살펴봤다. 컬럼을 정의할 때 가장 먼저 결정해야 하는 것이 **데이터 타입**이다. 잘못된 타입 선택은 데이터 손실, 계산 오류, 불필요한 저장 공간 낭비로 이어진다.

## 숫자 타입 — 정수 vs 실수, 정확 vs 근사

![숫자 데이터 타입 비교](/assets/posts/sql-data-types-numeric-comparison.svg)

### 정수 타입

```sql
-- 범위 선택 기준
TINYINT    -- 0~255 (MySQL), -128~127: 상태 코드, 플래그
SMALLINT   -- -32,768~32,767: 연도, 소규모 코드
INT        -- -21억~21억: 일반 PK, 카운터 (가장 많이 사용)
BIGINT     -- -922경~922경: UUID 대안, Snowflake ID, 대용량 PK

-- 부호 없는 정수 (MySQL 전용)
INT UNSIGNED  -- 0~42억 (양수만)
```

### 소수 타입 — 정확 vs 근사

소수 타입을 잘못 선택하면 치명적 버그로 이어진다.

```sql
-- FLOAT/DOUBLE: 근사값 저장 (IEEE 754)
-- 절대로 금액에 사용하지 마라!
SELECT 0.1 + 0.2;
-- MySQL FLOAT 결과: 0.30000001192092896 (오차!)

-- DECIMAL(정수부+소수부 총자리, 소수자리): 정확한 10진수
-- 금융, 결제, 세금, 환율에 반드시 사용
SELECT CAST(0.1 AS DECIMAL(10,2)) + CAST(0.2 AS DECIMAL(10,2));
-- 결과: 0.30 (정확!)

-- 실무 금액 설계 예시
CREATE TABLE transactions (
    amount    DECIMAL(15, 2),   -- 최대 999조원, 소수 2자리
    tax_rate  DECIMAL(5, 4),    -- 10.3000% 같은 세율
    fx_rate   DECIMAL(20, 10)   -- 환율 (소수점 많이 필요)
);
```

**DECIMAL(p, s)**에서 `p`는 총 자릿수(정밀도), `s`는 소수점 이하 자릿수다. Oracle에서는 `NUMBER(p, s)`가 동일한 역할을 한다.

## 문자 타입 — CHAR vs VARCHAR vs TEXT

![문자형·논리형 데이터 타입](/assets/posts/sql-data-types-string-bool.svg)

### CHAR(n): 고정 길이

```sql
-- CHAR는 항상 n바이트 사용, 부족하면 오른쪽에 공백 패딩
CREATE TABLE countries (
    code   CHAR(2)  NOT NULL,   -- 'KR', 'US' — 항상 2자
    name   VARCHAR(100) NOT NULL
);

-- CHAR 비교 시 trailing space 주의
-- WHERE code = 'KR ' (공백 포함) 도 일치할 수 있음
-- DBMS에 따라 다르므로 RTRIM() 활용 또는 VARCHAR 사용 권장
```

CHAR는 **항상 고정 길이인 값**에 최적화되어 있다. 성별 코드(`'M'/'F'`), ISO 국가 코드(`'KR'`), 통화 코드(`'USD'`) 같은 경우다. 일반 텍스트에 CHAR를 쓰면 불필요한 공백이 생겨 혼란을 준다.

### VARCHAR(n): 가변 길이

```sql
-- 가장 일반적인 문자 타입
name       VARCHAR(100),    -- 인물 이름
email      VARCHAR(254),    -- RFC 5321: 이메일 최대 254자
phone      VARCHAR(20),     -- 국제 전화번호 ('+82-10-...')
url        VARCHAR(2048),   -- URL (길이 여유 있게)
ip_address VARCHAR(45),     -- IPv6 최대 45자
```

### TEXT: 길이 제한 없음

```sql
-- 긴 텍스트 전용
content    TEXT,    -- 게시글 본문, 설명
log_body   TEXT,    -- 로그 메시지
json_data  TEXT,    -- JSON 저장 (전용 타입 없을 때)
```

**주의**: `TEXT` 컬럼에는 일반적으로 **인덱스를 전체 길이로 걸 수 없다**. MySQL에서는 `TEXT` 컬럼 인덱스 시 길이를 명시(`INDEX (content(100))`)해야 하고, PostgreSQL에서는 표현식 인덱스나 FTS를 사용한다.

### 문자셋과 Collation

```sql
-- MySQL/MariaDB: utf8mb4가 정답 (이모지 포함 완전한 UTF-8)
CREATE TABLE posts (
    title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
);

-- utf8 (MySQL의 3바이트 UTF-8)은 이모지 저장 불가!
-- 반드시 utf8mb4 사용

-- PostgreSQL: 데이터베이스 수준에서 UTF-8 설정
CREATE DATABASE mydb ENCODING 'UTF8' LC_COLLATE 'ko_KR.UTF-8';
```

## BOOLEAN — DBMS마다 다르다

```sql
-- PostgreSQL: 네이티브 BOOLEAN
active  BOOLEAN DEFAULT TRUE,
-- 허용값: TRUE/FALSE, 't'/'f', '1'/'0', 'yes'/'no'

-- MySQL: TINYINT(1)로 구현 (실제 BOOLEAN 타입은 별칭)
active  TINYINT(1) DEFAULT 1,  -- 0=false, 1=true

-- Oracle 21c 이전: 관례적으로 NUMBER(1) 또는 CHAR(1)
active  NUMBER(1) DEFAULT 1 CHECK (active IN (0, 1)),

-- SQL Server: BIT
active  BIT DEFAULT 1
```

## 기타 주요 타입

```sql
-- UUID (PostgreSQL 네이티브)
id  UUID DEFAULT gen_random_uuid() PRIMARY KEY

-- MySQL에서 UUID
id  CHAR(36) DEFAULT (UUID()),
-- 또는 BINARY(16)에 UUID_TO_BIN(UUID()) 저장 (성능 우수)

-- ENUM (MySQL/PostgreSQL)
status  ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED')  -- MySQL
status  VARCHAR(20) CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))  -- 표준
-- 또는 별도 lookup 테이블로 관리 (확장성 좋음)
```

## 타입 선택 체크리스트

```text
숫자 타입:
[ ] 금액/세율 → DECIMAL (FLOAT/DOUBLE 절대 사용 금지)
[ ] ID/카운터 → INT 또는 BIGINT (21억 초과 가능성이면 BIGINT)
[ ] 소수 근사값(ML/과학) → FLOAT/DOUBLE

문자 타입:
[ ] 고정 길이 코드 → CHAR(n)
[ ] 일반 텍스트 → VARCHAR(n) (길이 여유 있게)
[ ] 긴 본문 → TEXT
[ ] MySQL → CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci

논리형:
[ ] PostgreSQL → BOOLEAN
[ ] MySQL → TINYINT(1) 또는 BOOLEAN 별칭
[ ] Oracle 20c 이하 → NUMBER(1) CHECK IN (0,1)
```

## 정리

- **금액에는 DECIMAL/NUMERIC** — FLOAT/DOUBLE은 부동소수점 오차가 있어 절대 사용 금지
- **CHAR**: 고정 길이 코드값 / **VARCHAR**: 일반 가변 텍스트 / **TEXT**: 길이 제한 없는 본문
- **BOOLEAN** 지원 여부는 DBMS마다 다르다 (MySQL=TINYINT, MSSQL=BIT)
- MySQL은 반드시 **utf8mb4** 사용 (utf8은 이모지 불가)

---

**지난 글:** [CREATE TABLE 기초 — 테이블을 올바르게 만드는 법](/posts/sql-create-table-basics/)

**다음 글:** [SQL 날짜/시간 데이터 타입 — DATE, TIME, TIMESTAMP, 시간대 처리](/posts/sql-data-types-datetime/)

<br>
읽어주셔서 감사합니다. 😊
