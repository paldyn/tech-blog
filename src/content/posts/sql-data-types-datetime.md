---
title: "데이터 타입 완전 정복: 날짜·시간 타입"
description: "DATE·TIME·TIMESTAMP·TIMESTAMPTZ·INTERVAL의 차이, 타임존 처리의 함정, 날짜 연산과 EXTRACT, DB별 방언 차이까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["데이터타입", "DATE", "TIMESTAMP", "TIMESTAMPTZ", "타임존", "INTERVAL", "날짜함수"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-numeric-string-bool/)에서 숫자·문자열·불리언 타입을 살펴봤다. 날짜와 시간 타입은 타임존 처리가 얽혀 실수가 잦은 영역이다. 이번 글에서는 DATE부터 TIMESTAMPTZ까지 각 타입의 특성과 올바른 사용법을 짚어본다.

## 날짜·시간 타입 종류

![날짜·시간 타입 비교](/assets/posts/sql-data-types-datetime-types.svg)

### DATE — 날짜만

시간 정보 없이 날짜만 저장한다. 생일, 이벤트 날짜, 회계 기간처럼 시간이 의미 없는 경우에 적합하다.

```sql
SELECT CURRENT_DATE;          -- 2026-06-10
SELECT DATE '2026-06-10';     -- 리터럴
SELECT '2026-06-10'::DATE;    -- PostgreSQL 캐스팅
```

### TIME — 시간만

날짜 없이 시간만 저장한다. 사실 실무에서 자주 쓰이지는 않는다. 영업 시간이나 반복 스케줄처럼 날짜와 무관한 시간 데이터에 사용한다.

```sql
open_time  TIME DEFAULT '09:00:00',
close_time TIME DEFAULT '18:00:00'
```

### TIMESTAMP — 날짜+시간 (타임존 없음)

날짜와 시간을 함께 저장하지만 타임존 정보를 포함하지 않는다. **단일 시간대 환경이 확실할 때만** 사용을 권장한다.

### TIMESTAMPTZ — 날짜+시간+타임존 (권장)

PostgreSQL의 `TIMESTAMPTZ`(= `TIMESTAMP WITH TIME ZONE`)는 내부적으로 UTC로 저장하고, 세션의 타임존 설정에 따라 표시 시간을 변환한다.

```sql
-- 테이블 설계 권장 패턴
CREATE TABLE events (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_name VARCHAR(200) NOT NULL,
    -- 이벤트 발생 시각: 타임존 포함
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 만료 날짜: 날짜만 필요
    expires_on  DATE
);
```

### INTERVAL — 기간

두 시점의 차이나 오프셋을 표현한다.

```sql
SELECT now() + INTERVAL '7 days';        -- 7일 후
SELECT now() - INTERVAL '1 month';       -- 1개월 전
SELECT INTERVAL '2 hours 30 minutes';    -- 2시간 30분

-- 만료일 계산
SELECT id, created_at + INTERVAL '30 days' AS expires_at
FROM   subscriptions;
```

## 타임존 함정: TIMESTAMP vs TIMESTAMPTZ

![TIMESTAMP vs TIMESTAMPTZ: 타임존 처리](/assets/posts/sql-data-types-datetime-zones.svg)

**TIMESTAMP**는 타임존을 저장하지 않는다. 서버의 타임존이 바뀌거나 다른 지역의 서버로 데이터를 이전하면 같은 값이 다른 시각을 의미하게 된다.

**TIMESTAMPTZ**는 입력 시점의 타임존 오프셋을 반영해 UTC로 환산하여 저장한다. 조회 시에는 현재 세션의 타임존으로 자동 변환해 보여준다.

```sql
-- 세션 타임존 설정
SET timezone = 'Asia/Seoul';

-- Seoul 기준 오전 10시 30분 저장
INSERT INTO events(occurred_at) VALUES ('2026-06-10 10:30:00+09');

-- UTC로 저장됨: 2026-06-10 01:30:00+00

-- Seoul 세션에서 조회
SELECT occurred_at FROM events;
-- 결과: 2026-06-10 10:30:00+09

-- LA(UTC-7) 세션에서 조회
SET timezone = 'America/Los_Angeles';
SELECT occurred_at FROM events;
-- 결과: 2026-06-09 18:30:00-07
```

두 값은 같은 시점을 가리킨다. 이것이 TIMESTAMPTZ의 올바른 동작이다.

## 날짜 함수와 EXTRACT

```sql
-- 현재 날짜/시간
SELECT CURRENT_DATE;           -- SQL 표준
SELECT CURRENT_TIMESTAMP;      -- SQL 표준
SELECT now();                  -- PostgreSQL 약식

-- 날짜 요소 추출
SELECT EXTRACT(YEAR  FROM now()),  -- 2026
       EXTRACT(MONTH FROM now()),  -- 6
       EXTRACT(DOW   FROM now());  -- 요일 (0=일요일, PostgreSQL)

-- 날짜 자르기
SELECT DATE_TRUNC('month', now());  -- 월의 첫날 00:00:00
SELECT DATE_TRUNC('week',  now());  -- 주의 첫날

-- 두 날짜 사이 일수 차이
SELECT CURRENT_DATE - '2026-01-01'::DATE;  -- 일 수
SELECT AGE('2026-12-31', '2026-01-01');    -- 인터벌로 반환
```

## DB별 날짜 타입 차이

| 기능 | PostgreSQL | MySQL | Oracle | SQL Server |
|------|-----------|-------|--------|------------|
| 날짜 타입 | `DATE` | `DATE` | `DATE` (시분초 포함!) | `DATE` |
| 날짜+시간 | `TIMESTAMP` | `DATETIME` / `TIMESTAMP` | `TIMESTAMP` | `DATETIME2` |
| 타임존 포함 | `TIMESTAMPTZ` | `TIMESTAMP` (UTC 자동변환) | `TIMESTAMP WITH TIME ZONE` | `DATETIMEOFFSET` |
| 현재 시각 | `now()` | `NOW()` | `SYSDATE` | `GETDATE()` |

Oracle의 `DATE` 타입은 특히 주의가 필요하다. 표준 SQL의 `DATE`와 달리 Oracle `DATE`는 시·분·초까지 저장한다. `TRUNC(날짜)`로 시간 부분을 제거해야 하는 경우가 많다.

## 날짜 저장 시 권고사항

1. **모든 TIMESTAMP 컬럼은 TIMESTAMPTZ로**: 단일 시간대가 확실한 경우에만 예외
2. **애플리케이션에서 UTC로 변환 후 저장**: 서버 타임존 설정에 의존하지 말 것
3. **`created_at`, `updated_at` 컬럼 표준화**: `TIMESTAMPTZ DEFAULT now()` 패턴
4. **날짜 비교는 같은 타임존 기준으로**: 혼합 비교 시 명시적 타임존 변환

```sql
-- 좋은 예: 타임존 명시
WHERE occurred_at >= '2026-06-01 00:00:00+09'
  AND occurred_at <  '2026-07-01 00:00:00+09';

-- 나쁜 예: 타임존 불명확
WHERE occurred_at >= '2026-06-01';
```

---

**지난 글:** [데이터 타입 완전 정복: 숫자·문자열·불리언](/posts/sql-data-types-numeric-string-bool/)

**다음 글:** [제약 조건 기초: NOT NULL·DEFAULT·CHECK](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
