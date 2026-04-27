---
title: "데이터 타입 표준 (날짜·시간) — DATE·TIME·TIMESTAMP와 타임존 함정"
description: "DATE·TIME·TIMESTAMP·TIMESTAMPTZ 네 타입을 비교하고, 타임존 naive vs aware의 차이와 INTERVAL 산술을 정리합니다. MySQL 2038 문제와 Oracle DATE 함정도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "data-types", "date", "timestamp", "timezone", "interval", "ddl", "datetime"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-numeric-string-bool/)에서 이어집니다.

## 날짜·시간 타입이 특별한 이유

숫자나 문자열과 달리 날짜·시간은 **타임존(time zone)** 이라는 복잡한 변수가 따라온다. 서울 오후 3시와 뉴욕 오전 2시는 같은 UTC 순간인데, 이 사실을 DB가 알고 있는지 모르는지에 따라 전혀 다른 결과가 나온다. 글로벌 서비스에서 날짜·시간을 잘못 설계하면 예약 시스템 오작동, 만료일 계산 오류 같은 심각한 버그로 이어진다.

---

## 기본 타입 4종

![날짜·시간 타입 개요](/assets/posts/sql-data-types-datetime-overview.svg)

### DATE

날짜만 저장한다. 시간 정보가 없다.

```sql
birth_date    DATE  -- '1990-03-15'
contract_date DATE  -- '2026-04-26'
```

생년월일, 계약일, 배송 예정일처럼 "어느 날"만 중요하고 몇 시인지는 무관한 컬럼에 사용한다.

### TIME

시간만 저장한다. 날짜 정보가 없다. 마이크로초까지 지원한다.

```sql
open_time  TIME  -- '09:00:00'
close_time TIME  -- '22:30:00'
```

영업 시작·종료 시간, 정기 배치 실행 시간처럼 날짜와 무관한 시간 값에 사용한다.

### TIMESTAMP

날짜 + 시간을 저장한다. 타임존 정보는 포함되지 않는다.

```sql
created_at  TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
updated_at  TIMESTAMP
```

**타임존을 고려하지 않는(naive) 타입**이다. 저장된 `2026-04-26 14:30:00`이 어느 나라 시간인지 DB 수준에서는 알 수 없다. 애플리케이션이 항상 같은 타임존(보통 서버 시간 또는 UTC)으로 넣고 꺼낼 것이라 가정할 때만 안전하다.

### TIMESTAMP WITH TIME ZONE (TIMESTAMPTZ)

날짜 + 시간 + UTC 오프셋을 저장한다. **타임존을 인식하는(aware) 타입**이다.

```sql
ordered_at  TIMESTAMP WITH TIME ZONE  DEFAULT CURRENT_TIMESTAMP
-- 또는 PostgreSQL 축약형
ordered_at  TIMESTAMPTZ
```

```sql
-- 삽입 시 오프셋 포함
INSERT INTO orders (ordered_at) VALUES ('2026-04-26 14:30:00+09:00');
-- 내부적으로 UTC(05:30:00+00:00)로 변환하여 저장
-- 조회 시 세션 타임존에 맞춰 자동 변환
```

글로벌 서비스라면 `TIMESTAMP WITH TIME ZONE`을 기본으로 사용하고 UTC로 저장하는 것이 권장된다.

---

## 타임존 함정

![타임존과 INTERVAL 산술](/assets/posts/sql-data-types-datetime-timezone.svg)

### Naive vs Aware

같은 `TIMESTAMP`라도 DB가 타임존을 알고 있는지 여부에 따라 동작이 달라진다.

```sql
-- Naive (TIMESTAMP): 타임존 정보 없음
-- 2026-04-26 14:30:00  ← 어느 나라 시간인지 모름

-- Aware (TIMESTAMPTZ): UTC로 정규화하여 저장
INSERT INTO events (ts) VALUES ('2026-04-26 14:30:00+09:00');
-- 저장: 2026-04-26 05:30:00+00:00 (UTC)
-- 조회: 세션 타임존에 따라 자동 변환
```

### 타임존 변환

```sql
-- PostgreSQL
SELECT ordered_at AT TIME ZONE 'Asia/Seoul' FROM orders;

-- MySQL
SELECT CONVERT_TZ(ordered_at, 'UTC', 'Asia/Seoul') FROM orders;

-- Oracle
SELECT ordered_at AT TIME ZONE 'Asia/Seoul' FROM orders;
```

### 권장 패턴

1. **서버·DB 시간을 UTC로 통일한다.**
2. **컬럼은 `TIMESTAMP WITH TIME ZONE` 사용한다.**
3. **표시(display) 변환은 애플리케이션 레이어 또는 쿼리에서만 한다.**
4. `NOW()`, `CURRENT_TIMESTAMP`는 세션 타임존 기준임을 인식한다.

---

## INTERVAL 타입

날짜·시간에 기간을 더하거나 빼는 데 사용한다.

```sql
-- 현재 시각에서 7일 뒤
SELECT NOW() + INTERVAL '7 days';

-- 1달 전
SELECT NOW() - INTERVAL '1 month';

-- 구독 만료 30분 전 알림
SELECT * FROM subscriptions
WHERE expires_at - NOW() < INTERVAL '30 minutes';

-- 주문 후 7일 지난 미처리 건
SELECT * FROM orders
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '7 days';
```

날짜 간 차이를 구하면 `INTERVAL` 값이 반환된다.

```sql
-- 두 날짜 사이 일수
SELECT '2026-12-31'::date - '2026-01-01'::date;  -- 364 (일수, PostgreSQL)
SELECT DATEDIFF('2026-12-31', '2026-01-01');       -- MySQL
```

### EXTRACT / DATE_PART

날짜·시간의 특정 부분만 추출할 때 사용한다.

```sql
-- 표준 EXTRACT
SELECT EXTRACT(YEAR  FROM created_at) AS yr,
       EXTRACT(MONTH FROM created_at) AS mo,
       EXTRACT(DOW   FROM created_at) AS day_of_week  -- 0=일, 6=토
FROM orders;

-- PostgreSQL date_part (EXTRACT와 동일 기능)
SELECT DATE_PART('hour', ordered_at) AS order_hour FROM orders;

-- MySQL
SELECT YEAR(created_at), MONTH(created_at), DAYOFWEEK(created_at) FROM orders;
```

월별 집계, 요일별 분석, 시간대별 통계 등에 자주 쓰인다.

---

## DBMS별 주요 차이

| 기능 | PostgreSQL | MySQL | Oracle |
|------|-----------|-------|--------|
| 날짜+시간 타임존 없음 | `TIMESTAMP` | `DATETIME` | `DATE` (시간 포함!) |
| 날짜+시간 타임존 있음 | `TIMESTAMPTZ` | `TIMESTAMP` | `TIMESTAMP WITH TIME ZONE` |
| 현재 시각 | `NOW()`, `CURRENT_TIMESTAMP` | 동일 | `SYSDATE`, `SYSTIMESTAMP` |
| 날짜 차이 | `date1 - date2` | `DATEDIFF()` | `date1 - date2` |
| 부분 추출 | `EXTRACT()`, `DATE_PART()` | `YEAR()`, `MONTH()` 등 | `EXTRACT()` |

### MySQL 주의사항

```sql
-- DATETIME: 타임존 저장 안 함 (naive)
-- TIMESTAMP: UTC로 저장, 조회 시 세션 타임존 변환
--            범위: 1970-01-01 00:00:01 ~ 2038-01-19 03:14:07 (2038 문제!)

-- 새 시스템이라면 DATETIME 대신 DATETIME(6) or 애플리케이션에서 UTC 관리 권장
created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)  -- 마이크로초 포함
```

### Oracle 주의사항

```sql
-- Oracle의 DATE는 날짜+시간을 모두 저장!
-- 날짜만 저장하려면 TRUNC(date_col) 또는 제약 필요
birthdate DATE  -- 2026-04-26 00:00:00 형태로 저장됨

-- 시간 없는 순수 날짜 비교 시 주의
WHERE birthdate = DATE '2026-04-26'  -- TO_DATE 리터럴
```

---

## 정리

- `DATE`: 날짜만. `TIME`: 시간만. `TIMESTAMP`: 날짜+시간(타임존 없음).
- `TIMESTAMP WITH TIME ZONE`: 날짜+시간+UTC 오프셋. **글로벌 서비스 기본값.**
- 저장은 UTC, 표시는 클라이언트 타임존이 권장 패턴이다.
- MySQL `TIMESTAMP`는 2038년이 만료 시한이다. 새 시스템에는 `DATETIME`+UTC 관리 또는 다른 DBMS를 고려하자.
- Oracle `DATE`는 시간도 포함한다. 날짜만 비교할 때는 `TRUNC`를 사용하자.
- `INTERVAL`로 기간 연산, `EXTRACT`로 부분 추출.

---

**지난 글:** [데이터 타입 표준 (숫자·문자열·불리언) — 언제 어떤 타입을 써야 하는가](/posts/sql-data-types-numeric-string-bool/)

**다음 글:** [데이터베이스란 무엇인가 — 파일 시스템과의 차이](/posts/sql-what-is-rdb/)

<br>
읽어주셔서 감사합니다. 😊
