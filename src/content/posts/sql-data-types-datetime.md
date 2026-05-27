---
title: "SQL 날짜/시간 데이터 타입 — DATE, TIMESTAMP, 시간대 처리"
description: "DATE, TIME, TIMESTAMP, TIMESTAMPTZ, DATETIME, INTERVAL의 차이, MySQL 2038년 문제, 시간대 저장 전략, 날짜 연산 함수 패턴을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["DATE", "TIMESTAMP", "TIMESTAMPTZ", "시간대", "2038년문제", "날짜타입", "INTERVAL", "UTC"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-numeric-string-bool/)에서 숫자·문자·논리 타입을 다뤘다. 이번 글에서는 날짜와 시간 타입을 집중적으로 살펴본다. 날짜/시간은 타입 선택을 잘못하면 **시간대 버그, 2038년 오버플로우, 써머타임 오류** 같은 숨겨진 문제가 생기는 영역이다.

## 날짜/시간 타입 전체 비교

![날짜/시간 타입 비교](/assets/posts/sql-data-types-datetime-comparison.svg)

각 타입을 언제 써야 하는지 직관적으로 정리하면:

- **DATE**: 날짜만 필요할 때 (생년월일, 계약일, 공휴일)
- **TIME**: 시간만 필요할 때 (영업 시작 시간, 알람)
- **TIMESTAMP**: 이벤트 발생 시각 (created_at, updated_at) — UTC 저장
- **TIMESTAMPTZ** (PostgreSQL): 시간대 정보 포함 — 다국가 서비스에서 권장
- **DATETIME** (MySQL): 시간대 없는 로컬 날짜+시간
- **INTERVAL**: 기간 표현 (30일 후, 3개월)

## Oracle의 DATE 타입 함정

Oracle의 `DATE` 타입은 SQL 표준과 다르다. Oracle `DATE`는 **년월일 + 시분초**를 포함한다. 날짜만 저장하려면 시분초가 `00:00:00`인 DATE를 사용하거나, 비교 시 `TRUNC()` 함수로 시간 부분을 잘라야 한다.

```sql
-- Oracle: DATE에 시간 포함
SELECT SYSDATE FROM DUAL;  -- 2026-05-28 14:30:22

-- 날짜만 비교할 때
WHERE TRUNC(created_date) = DATE '2026-05-28'

-- Oracle에서 날짜+시간은 TIMESTAMP 사용 권장
created_at TIMESTAMP(6) DEFAULT SYSTIMESTAMP
```

## MySQL TIMESTAMP vs DATETIME

MySQL에서 가장 많이 혼동하는 부분이다.

```sql
-- TIMESTAMP: UTC 저장, 조회 시 세션 time_zone으로 변환
-- 2038-01-19 이후 오버플로우 (32비트 한계)
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
           ON UPDATE CURRENT_TIMESTAMP,

-- DATETIME: 로컬 시간 그대로 저장, time_zone 영향 없음
-- 범위: 1000-01-01 ~ 9999-12-31
scheduled_at DATETIME
```

```sql
-- MySQL time_zone 확인 및 설정
SELECT @@time_zone, @@global.time_zone;
SET time_zone = 'Asia/Seoul';

-- TIMESTAMP는 time_zone에 따라 조회 결과가 달라진다!
-- 같은 데이터여도 서울 세션 vs UTC 세션이 다른 값을 반환
```

**결론**: MySQL에서는 장기 데이터는 `DATETIME`, 이벤트 기록은 `TIMESTAMP`를 사용하되 2038년 이후 데이터가 있을 수 있다면 `DATETIME`을 선택한다.

## 시간대 처리의 황금률: UTC로 저장

글로벌 서비스나 다국가 서비스를 개발할 때의 원칙:

```text
1. DB 서버 시간대를 UTC로 설정
2. 모든 시각 데이터를 UTC로 저장
3. 표시 시 클라이언트의 시간대로 변환
```

```sql
-- PostgreSQL: TIMESTAMPTZ 사용 (UTC 저장 + TZ 인식)
CREATE TABLE orders (
    order_id   INT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 서울 시간으로 조회
SELECT created_at AT TIME ZONE 'Asia/Seoul' AS seoul_time
FROM orders;

-- MySQL: UTC_TIMESTAMP()로 명시적 UTC 저장
INSERT INTO orders (created_at) VALUES (UTC_TIMESTAMP());

-- 조회 시 변환
SELECT CONVERT_TZ(created_at, '+00:00', '+09:00') AS kst
FROM orders;
```

## 날짜 연산 패턴

![날짜/시간 연산 패턴](/assets/posts/sql-data-types-datetime-ops.svg)

```sql
-- 표준 날짜 함수
SELECT
    CURRENT_DATE,           -- 오늘 날짜
    CURRENT_TIME,           -- 현재 시간
    CURRENT_TIMESTAMP,      -- 현재 날짜+시간
    EXTRACT(YEAR FROM CURRENT_DATE),   -- 연도 추출
    EXTRACT(MONTH FROM CURRENT_DATE);  -- 월 추출

-- 날짜 포맷팅 (DBMS별 차이)
-- PostgreSQL
SELECT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS');
-- MySQL
SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s');
-- Oracle
SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') FROM DUAL;
-- SQL Server
SELECT FORMAT(GETDATE(), 'yyyy-MM-dd HH:mm:ss');
```

### 날짜 차이 계산

```sql
-- 두 날짜의 차이 (일수)
-- PostgreSQL
SELECT '2026-12-31'::DATE - '2026-01-01'::DATE AS days;  -- 364

-- MySQL
SELECT DATEDIFF('2026-12-31', '2026-01-01') AS days;

-- Oracle
SELECT DATE '2026-12-31' - DATE '2026-01-01' AS days FROM DUAL;

-- 만료일 계산 (30일 후)
-- PostgreSQL
SELECT CURRENT_DATE + INTERVAL '30 days';
-- MySQL
SELECT DATE_ADD(CURDATE(), INTERVAL 30 DAY);
-- Oracle
SELECT SYSDATE + 30 FROM DUAL;  -- 숫자를 더하면 일(day)
```

### 범위 쿼리 — 인덱스 활용을 위한 패턴

```sql
-- 올바른 범위 쿼리 (인덱스 사용)
SELECT * FROM orders
WHERE  created_at >= '2026-01-01'
  AND  created_at  < '2026-02-01';

-- 피해야 할 패턴 (함수 사용 시 인덱스 비효율)
-- WHERE YEAR(created_at) = 2026 AND MONTH(created_at) = 1
-- 위는 전체 스캔 발생 (MySQL에서 함수 기반 인덱스 없을 때)
```

## CREATE TABLE에서 날짜 컬럼 설계

```sql
CREATE TABLE audit_log (
    log_id      BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  VARCHAR(60) NOT NULL,
    action      CHAR(1)     NOT NULL CHECK (action IN ('I','U','D')),
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- TIMESTAMPTZ
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MySQL 버전
CREATE TABLE audit_log (
    log_id      BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    table_name  VARCHAR(60)  NOT NULL,
    action      CHAR(1)      NOT NULL,
    occurred_at DATETIME     DEFAULT UTC_TIMESTAMP(),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 정리

- **DATE**: 날짜만 / **TIME**: 시간만 / **TIMESTAMP**: 날짜+시간 (UTC 저장)
- **MySQL TIMESTAMP**: 2038년 오버플로우 주의 → 장기 데이터는 `DATETIME`
- **Oracle DATE**: 시분초 포함 — SQL 표준과 다름, 비교 시 `TRUNC()` 필요
- **시간대 황금률**: UTC 저장 → 표시 시 변환 (TIMESTAMPTZ 권장)
- **범위 쿼리**: 날짜 컬럼에 함수 적용 금지 → `>=` `<` 패턴 사용

---

**지난 글:** [SQL 데이터 타입 완전 정복 — 숫자, 문자, 논리형](/posts/sql-data-types-numeric-string-bool/)

**다음 글:** [SQL 제약조건 — NOT NULL, DEFAULT, CHECK 완전 정복](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
