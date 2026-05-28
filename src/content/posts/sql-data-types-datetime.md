---
title: "SQL 데이터 타입 — 날짜와 시간"
description: "SQL의 DATE·TIME·TIMESTAMP·INTERVAL 타입과 타임존 처리 방법, TIMESTAMPTZ vs TIMESTAMP의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQL", "데이터 타입", "TIMESTAMP", "DATE", "타임존"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-numeric-string-bool/)에서 숫자·문자열·불리언 타입을 살펴봤습니다. 이번에는 날짜와 시간 타입을 다룹니다. 시간 데이터는 타임존 처리를 잘못하면 글로벌 서비스에서 심각한 버그가 생기므로 특히 주의가 필요합니다.

## 기본 타입 네 가지

![SQL 날짜·시간 타입 비교](/assets/posts/sql-data-types-datetime-types.svg)

| 타입 | 저장 내용 | 크기 | 사용 예 |
|------|-----------|------|---------|
| `DATE` | 연-월-일 | 3~4 bytes | 생일, 입사일, 만료일 |
| `TIME` | 시-분-초(±마이크로초) | 3~8 bytes | 영업 시간, 알람 |
| `TIMESTAMP` | 날짜+시간 (타임존 없음) | 8 bytes | 로컬 기록 |
| `TIMESTAMPTZ` | 날짜+시간 (UTC 내부 저장) | 8 bytes | 이벤트 로그, 생성 시각 |

## DATE

날짜만 필요한 경우에 사용합니다. 시간 정보가 필요 없으므로 저장 공간이 작고 계산이 간단합니다.

```sql
-- DATE 사용 예
CREATE TABLE employees (
    employee_id  INT   PRIMARY KEY,
    birth_date   DATE  NOT NULL,
    hire_date    DATE  NOT NULL,
    resign_date  DATE             -- NULL 허용: 재직 중
);

-- DATE 연산 (PostgreSQL)
SELECT hire_date,
       hire_date + INTERVAL '1 year' AS one_year_later,
       CURRENT_DATE - hire_date      AS days_employed
FROM   employees;
```

## TIMESTAMP vs TIMESTAMPTZ

이 둘의 차이가 가장 중요합니다.

![TIMESTAMP vs TIMESTAMPTZ 타임존 함정](/assets/posts/sql-data-types-datetime-tz.svg)

```sql
-- ✗ TIMESTAMP: 타임존 없음, 해석이 서버 설정에 의존
created_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP

-- ✓ TIMESTAMPTZ: 항상 UTC 기준으로 저장, 조회 시 세션 타임존으로 변환
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

```sql
-- PostgreSQL: 세션 타임존 변경으로 출력 확인
SET TIME ZONE 'Asia/Seoul';
SELECT created_at FROM events;  -- KST(+9)로 출력

SET TIME ZONE 'UTC';
SELECT created_at FROM events;  -- UTC로 출력
-- 저장된 값은 동일, 표현만 다름
```

## DBMS별 타임스탬프 타입

| DBMS | 타임존 없음 | 타임존 있음 |
|------|-----------|------------|
| PostgreSQL | `TIMESTAMP` | `TIMESTAMPTZ` (`TIMESTAMP WITH TIME ZONE`) |
| Oracle | `DATE` (초 포함), `TIMESTAMP` | `TIMESTAMP WITH TIME ZONE` |
| MySQL | `DATETIME` | `TIMESTAMP` (내부 UTC 저장) |
| SQL Server | `DATETIME2` | `DATETIMEOFFSET` |

MySQL의 `TIMESTAMP` 컬럼은 실제로 UTC로 저장하므로 타임존 안전합니다. 반면 `DATETIME`은 그냥 텍스트처럼 입력된 값을 그대로 저장합니다.

## INTERVAL — 시간 간격

```sql
-- PostgreSQL INTERVAL 사용 예
SELECT
    CURRENT_DATE + INTERVAL '3 months'    AS three_months_later,
    CURRENT_TIMESTAMP - INTERVAL '7 days' AS one_week_ago,
    AGE(CURRENT_DATE, hire_date)          AS tenure  -- years/months/days 형태
FROM   employees;

-- 구독 만료일 계산
SELECT user_id,
       start_date,
       start_date + duration AS expire_date
FROM   subscriptions;
-- duration 컬럼이 INTERVAL '1 month', '1 year' 등을 저장
```

MySQL에는 `INTERVAL` 타입이 없으므로 `DATE_ADD(date, INTERVAL n unit)` 함수를 사용합니다.

## 날짜·시간 함수

```sql
-- 현재 날짜/시간
SELECT CURRENT_DATE,          -- 날짜만
       CURRENT_TIME,          -- 시간만
       CURRENT_TIMESTAMP,     -- 날짜+시간 (표준)
       now();                 -- PostgreSQL 단축형

-- 날짜 요소 추출
SELECT EXTRACT(YEAR  FROM hire_date) AS hire_year,
       EXTRACT(MONTH FROM hire_date) AS hire_month,
       EXTRACT(DOW   FROM hire_date) AS day_of_week  -- 0=일요일
FROM   employees;

-- 날짜 형식 변환 (PostgreSQL)
SELECT TO_CHAR(CURRENT_DATE, 'YYYY년 MM월 DD일') AS formatted;

-- 날짜 범위 조건
SELECT * FROM orders
WHERE  created_at >= '2026-01-01'::DATE
  AND  created_at <  '2026-02-01'::DATE;
```

## 자주 하는 실수

**실수 1**: 날짜를 `VARCHAR`로 저장
```sql
-- ✗ 잘못된 방법
date_str VARCHAR(10) DEFAULT '2026-05-29'  -- 정렬·계산 불가

-- ✓ 올바른 방법
event_date DATE NOT NULL
```

**실수 2**: `created_at`에 `TIMESTAMP` 대신 `TIMESTAMPTZ` 미사용
```sql
-- ✓ 감사 컬럼 모범 예
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

**실수 3**: 날짜 비교에 `BETWEEN` 사용 시 시간 부분 무시
```sql
-- ✗ 2026-01-31 23:59:59.999 제외될 수 있음
WHERE created_at BETWEEN '2026-01-01' AND '2026-01-31'

-- ✓ 반열린 구간 사용
WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01'
```

## 정리

- `DATE`는 날짜만, `TIMESTAMP`/`TIMESTAMPTZ`는 날짜+시간에 사용합니다.
- 글로벌 서비스에서는 `TIMESTAMPTZ`를 기본으로 사용하고, 내부적으로 UTC를 유지합니다.
- 날짜를 문자열로 저장하지 말고 항상 전용 날짜/시간 타입을 사용합니다.
- MySQL에서는 `TIMESTAMP`가 UTC 저장, `DATETIME`은 입력 그대로임에 주의합니다.

다음 글에서는 `NOT NULL`, `DEFAULT`, `CHECK` 같은 **열 제약조건**을 깊이 있게 살펴봅니다.

---

**지난 글:** [SQL 데이터 타입 — 숫자·문자열·불리언](/posts/sql-data-types-numeric-string-bool/)

**다음 글:** [NOT NULL·DEFAULT·CHECK 제약조건 완전 정복](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
