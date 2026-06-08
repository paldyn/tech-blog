---
title: "날짜/시간 데이터 타입 완전 정복"
description: "DATE, TIME, DATETIME, TIMESTAMP, TIMESTAMPTZ, INTERVAL 타입의 차이를 설명하고, MySQL의 DATETIME vs TIMESTAMP 타임존 함정, 날짜 연산 DBMS별 문법, 그리고 글로벌 서비스에서 UTC 저장이 중요한 이유를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQL", "날짜타입", "TIMESTAMP", "DATETIME", "INTERVAL", "타임존", "UTC", "DATE"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-numeric-string-bool/)에서 숫자, 문자열, 불리언 타입을 살펴봤다. 이번에는 날짜와 시간 타입을 다룬다. 이 영역은 특히 타임존 처리에서 실수가 많이 발생한다. 서비스가 단일 지역에서만 운영될 때는 눈에 띄지 않다가, 글로벌 확장 또는 서버 이전 시 데이터 불일치가 터져 나온다.

## 날짜/시간 타입 개요

![날짜/시간 타입 비교](/assets/posts/sql-data-types-datetime-types.svg)

## DATE — 날짜만

날짜(연/월/일)만 저장한다. 시간 정보가 필요 없는 데이터에 사용한다.

```sql
-- 생년월일: 시간 불필요
birth_date DATE NOT NULL

-- 비교
SELECT * FROM users WHERE birth_date = '1990-05-15';
SELECT * FROM orders WHERE ordered_date BETWEEN '2024-01-01' AND '2024-12-31';
```

## TIMESTAMP vs DATETIME (MySQL)

MySQL을 쓴다면 이 차이를 반드시 알아야 한다.

**`DATETIME`**: 입력한 값을 그대로 저장한다. 타임존 개념이 없다. 서버 설정이 'Asia/Seoul'이든 'UTC'든 저장된 값은 변하지 않는다. 서버 타임존이 변경되면 기존 데이터의 의미가 달라진다.

**`TIMESTAMP`**: 내부적으로 UTC로 변환해 저장하고, 조회할 때 세션의 `time_zone` 설정에 따라 변환해서 반환한다. 2038년 1월 19일 03:14:07 UTC까지만 표현 가능(32비트 제한)하다.

```sql
-- MySQL: 타임존 설정 확인
SHOW VARIABLES LIKE 'time_zone';
SET time_zone = '+09:00';  -- KST

-- TIMESTAMP 동작 확인
CREATE TABLE tz_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tz_test () VALUES ();

-- time_zone을 UTC로 바꾸면
SET time_zone = 'UTC';
SELECT ts, dt FROM tz_test;
-- ts: 9시간 뒤로 당겨진 값 (UTC 변환)
-- dt: 원래 저장된 값 그대로
```

## PostgreSQL: TIMESTAMP vs TIMESTAMPTZ

PostgreSQL에서는 `TIMESTAMP` (타임존 없음)와 `TIMESTAMPTZ` (타임존 있음, 내부는 UTC)로 나뉜다.

```sql
-- PostgreSQL: TIMESTAMPTZ 권장
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- 타임존 변환 조회
SELECT created_at AT TIME ZONE 'Asia/Seoul' FROM orders;

-- 현재 타임존 설정 확인
SHOW timezone;
SET timezone = 'Asia/Seoul';
```

`TIMESTAMPTZ`는 입력 시 UTC로 정규화해 저장한다. 조회 시 세션의 `timezone` 설정에 따라 변환된다. 글로벌 서비스에서 `TIMESTAMPTZ`를 쓰면 다른 지역 사용자가 자신의 타임존으로 조회할 수 있다.

## Oracle의 날짜 타입

Oracle에서 `DATE` 타입은 표준 SQL과 다르다. **날짜 + 시간(시/분/초)**을 저장한다. 1초 정밀도다. `TIMESTAMP`는 마이크로초(소수 6자리)까지 지원하고, `TIMESTAMP WITH TIME ZONE`은 타임존 정보도 포함한다.

```sql
-- Oracle DATE 조회 시 시간 포함 여부 주의
SELECT SYSDATE FROM dual;  -- 2024-03-15 14:30:25

-- Oracle TIMESTAMP
SELECT SYSTIMESTAMP FROM dual;  -- 2024-03-15 14:30:25.123456 +09:00

-- 날짜 추출
SELECT TRUNC(SYSDATE) FROM dual;  -- 오늘 자정 (시간 부분 제거)
SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD') FROM dual;
```

## INTERVAL — 기간 타입

표준 SQL의 `INTERVAL` 타입은 기간을 저장한다. PostgreSQL에서 잘 지원된다.

```sql
-- PostgreSQL INTERVAL
SELECT NOW() + INTERVAL '30 days';
SELECT NOW() - INTERVAL '1 year 3 months';
SELECT AGE('2024-12-31', '2000-01-01');  -- 24 years 11 mons 30 days

-- 만료 체크
SELECT * FROM subscriptions
WHERE expired_at < NOW() + INTERVAL '7 days';  -- 7일 이내 만료
```

## 날짜/시간 연산 함수 비교

![날짜/시간 연산 비교](/assets/posts/sql-data-types-datetime-operations.svg)

## 실무 권장 사항

**1. 항상 UTC로 저장**: 애플리케이션은 UTC로 변환해서 DB에 저장하고, 표시할 때 사용자 타임존으로 변환한다. MySQL `TIMESTAMP`, PostgreSQL `TIMESTAMPTZ`가 이를 지원한다.

**2. MySQL 2038년 문제 대비**: MySQL `TIMESTAMP`의 상한선은 2038년이다. 장기 데이터는 `DATETIME`으로 저장하고 애플리케이션 레벨에서 UTC를 관리하거나, 충분한 범위를 가진 `BIGINT`(Unix epoch ms)로 저장하는 방법도 있다.

**3. Oracle에서 날짜 비교 주의**: Oracle `DATE`에는 시간이 포함되어 있어 `WHERE order_date = '2024-03-15'`가 예상대로 작동하지 않는다. `TRUNC(order_date) = DATE '2024-03-15'`로 써야 한다.

```sql
-- Oracle 날짜 비교 주의
-- 잘못됨: 시간 포함이라 정확히 자정인 행만 매칭
WHERE order_date = DATE '2024-03-15'

-- 올바름: 날짜 부분만 비교
WHERE TRUNC(order_date) = DATE '2024-03-15'
-- 또는 범위로
WHERE order_date >= DATE '2024-03-15'
  AND order_date <  DATE '2024-03-16'
```

다음 글에서는 테이블 무결성을 보장하는 NOT NULL, DEFAULT, CHECK 제약조건을 상세히 다룬다.

---

**지난 글:** [데이터 타입 완전 정복 — 숫자, 문자열, 불리언](/posts/sql-data-types-numeric-string-bool/)

**다음 글:** [제약조건 완전 정복 — NOT NULL, DEFAULT, CHECK](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
