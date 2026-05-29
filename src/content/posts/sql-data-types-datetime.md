---
title: "날짜와 시간 데이터 타입 — TIMESTAMP, DATE, INTERVAL 완전 정복"
description: "DATE, TIME, TIMESTAMP, TIMESTAMPTZ의 차이와 타임존 처리, INTERVAL 연산, 실무에서 자주 발생하는 날짜 타입 실수를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQL", "날짜 타입", "TIMESTAMP", "타임존", "INTERVAL", "TIMESTAMPTZ"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-numeric-string-bool/)에서 숫자와 문자열 타입을 살펴봤습니다. 이번에는 날짜와 시간 타입을 다룹니다. "날짜는 그냥 저장하면 되지 않나?"라고 생각하기 쉽지만, 타임존 처리를 잘못하면 데이터가 조용히 틀려지는 심각한 버그가 발생합니다.

## 날짜/시간 타입 종류

![날짜·시간 타입 비교](/assets/posts/sql-data-types-datetime-types.svg)

```sql
-- DATE: 날짜만
birth_date  DATE    NOT NULL,           -- 1990-01-01

-- TIME: 시간만 (타임존 없음)
open_time   TIME    NOT NULL,           -- 09:00:00

-- TIMESTAMP: 날짜+시간 (타임존 없음)
local_time  TIMESTAMP NOT NULL,         -- 2026-05-30 14:30:00

-- TIMESTAMPTZ (WITH TIME ZONE): 날짜+시간+타임존 정보
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 2026-05-30 14:30:00+09

-- INTERVAL: 시간 간격
expire_in   INTERVAL    -- INTERVAL '7 days', INTERVAL '1 hour 30 minutes'
```

## TIMESTAMP vs TIMESTAMPTZ

**가장 중요한 구분입니다.**

`TIMESTAMP`(타임존 없음)는 입력된 값을 그대로 저장합니다. 서버의 타임존 설정에 따라 같은 값이 다른 의미를 가질 수 있습니다.

`TIMESTAMPTZ`(타임존 있음, PostgreSQL 약어)는 입력 값을 UTC로 변환해 저장하고, 조회 시 세션의 타임존으로 변환해 반환합니다.

```sql
-- 세션 타임존 Asia/Seoul (+09:00) 에서 삽입
INSERT INTO events (name, started_at)
VALUES ('컨퍼런스', '2026-05-30 14:00:00');

-- TIMESTAMP라면: '2026-05-30 14:00:00' 그대로 저장
-- TIMESTAMPTZ라면: '2026-05-30 05:00:00 UTC'로 저장
--   → 다른 TZ(UTC) 세션에서 조회하면 '2026-05-30 05:00:00' 반환
--   → Asia/Seoul 세션에서 조회하면 '2026-05-30 14:00:00' 반환
```

**글로벌 서비스나 팀원이 다른 타임존에 있다면 `TIMESTAMPTZ`를 기본으로 선택합니다.** 국내 단일 서비스라도 서버 이전이나 클라우드 리전 변경 시 TIMESTAMP는 위험합니다.

## 실무 권장 설계 패턴

```sql
CREATE TABLE orders (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 생성/수정 시각은 항상 타임존 포함
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 비즈니스 의미가 있는 날짜는 DATE
    due_date    DATE,
    -- 삭제 처리 시각
    deleted_at  TIMESTAMPTZ
);
```

## INTERVAL 연산

`INTERVAL`은 시간 간격을 표현합니다. 날짜 연산에 매우 유용합니다.

```sql
-- 7일 후 만료
SELECT now() + INTERVAL '7 days' AS expires_at;

-- 1개월 전 데이터 조회
SELECT * FROM logs
WHERE created_at >= now() - INTERVAL '1 month';

-- 만료일 계산
UPDATE subscriptions
SET expires_at = started_at + INTERVAL '1 year'
WHERE plan = 'annual';
```

## 날짜/시간 함수

![날짜/시간 함수 및 연산](/assets/posts/sql-data-types-datetime-functions.svg)

자주 쓰는 함수를 정리합니다.

| 기능 | PostgreSQL | MySQL | Oracle |
|---|---|---|---|
| 현재 날짜 | `CURRENT_DATE` | `CURDATE()` | `SYSDATE` |
| 현재 타임스탬프 | `now()` | `NOW()` | `SYSTIMESTAMP` |
| 연도 추출 | `EXTRACT(YEAR FROM d)` | `YEAR(d)` | `EXTRACT(YEAR FROM d)` |
| 날짜 포맷 | `TO_CHAR(d, 'YYYY-MM-DD')` | `DATE_FORMAT(d, '%Y-%m-%d')` | `TO_CHAR(d, 'YYYY-MM-DD')` |
| 날짜 차이 | `AGE(d1, d2)` | `DATEDIFF(d1, d2)` | `d1 - d2` |

## 타임존 변환

```sql
-- PostgreSQL: AT TIME ZONE
SELECT created_at AT TIME ZONE 'Asia/Seoul' AS kst_time
FROM orders;

-- MySQL: CONVERT_TZ
SELECT CONVERT_TZ(created_at, 'UTC', 'Asia/Seoul') AS kst_time
FROM orders;

-- Oracle: FROM_TZ + AT TIME ZONE
SELECT FROM_TZ(CAST(created_at AS TIMESTAMP), 'UTC')
       AT TIME ZONE 'Asia/Seoul' AS kst_time
FROM orders;
```

## 흔한 실수

1. **`TIMESTAMP`에 UTC 값을 저장했다고 가정하고 조회**: 실제로는 로컬 시간이 저장되어 9시간 오차 발생
2. **날짜 범위 쿼리에서 시간 미포함**: `WHERE date_col = '2026-05-30'`은 날짜 타입에서는 동작하지만, `TIMESTAMP` 컬럼에서는 자정 한 시점만 조회

```sql
-- 틀린 예: TIMESTAMP 컬럼 날짜 범위 조회
WHERE created_at = '2026-05-30'  -- 자정 정각만 매칭

-- 올바른 예
WHERE created_at >= '2026-05-30'
  AND created_at <  '2026-05-31'
```

## 정리

- 날짜만 필요하면 `DATE`, 시각이 필요하면 기본적으로 `TIMESTAMPTZ`를 선택합니다.
- 내부 저장은 항상 UTC, 표시는 서비스 타임존으로 변환하는 패턴이 일관성을 유지합니다.
- `INTERVAL`을 활용하면 날짜 연산이 간결해집니다.

다음 글에서는 `NOT NULL`, `DEFAULT`, `CHECK` 제약을 다룹니다.

---

**지난 글:** [숫자·문자·불리언 데이터 타입 완전 정복](/posts/sql-data-types-numeric-string-bool/)

**다음 글:** [NOT NULL, DEFAULT, CHECK 제약](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
