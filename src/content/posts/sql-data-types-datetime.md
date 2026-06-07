---
title: "데이터 타입 완전 정리 — 날짜와 시간"
description: "SQL DATE, TIME, TIMESTAMP, TIMESTAMPTZ, INTERVAL의 차이와 연산 방법, DBMS별 구현 차이, 타임존 처리 주의사항을 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQL", "DATE", "TIMESTAMP", "INTERVAL", "타임존", "데이터타입"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-numeric-string-bool/)에서 숫자와 문자열 타입을 살펴봤다. 날짜·시간 타입은 타입 종류가 많고 DBMS마다 이름이 달라 혼란스럽다. 특히 타임존을 잘못 다루면 글로벌 서비스에서 데이터가 어긋나는 심각한 문제가 생긴다.

## 날짜·시간 타입 종류

SQL은 세 가지 기본 날짜·시간 타입을 정의한다.

```sql
-- 날짜만
생년월일   DATE         -- '1990-01-15'

-- 시간만
영업시작   TIME         -- '09:00:00'

-- 날짜 + 시간 (타임존 없음)
생성일시   TIMESTAMP    -- '2026-06-08 14:30:00.000000'

-- 날짜 + 시간 + 타임존
이벤트일시 TIMESTAMPTZ  -- '2026-06-08 14:30:00+09'
-- (내부는 UTC로 저장, 조회 시 세션 타임존으로 변환)

-- 기간
체험기간   INTERVAL     -- '30 days', '3 months', '1 year 6 months'
```

![날짜·시간 타입 비교](/assets/posts/sql-data-types-datetime-types.svg)

## DATE — 날짜만 필요할 때

생년월일, 계약 만료일, 공휴일 등 시간 정보가 의미 없는 경우에 사용한다.

```sql
CREATE TABLE 직원 (
    직원ID   INTEGER  PRIMARY KEY,
    입사일   DATE     NOT NULL,
    생년월일 DATE
);

-- 입사 후 경과 일수
SELECT 직원ID, CURRENT_DATE - 입사일 AS 재직일수
FROM   직원;

-- 30일 후 만료
SELECT 계약ID,
       만료일 - CURRENT_DATE AS 남은일수
FROM   계약
WHERE  만료일 BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
```

## TIMESTAMP vs TIMESTAMPTZ

이 둘의 차이를 모르면 글로벌 서비스에서 데이터가 어긋난다.

```sql
-- TIMESTAMP: 타임존 정보 없이 "있는 그대로" 저장
생성일시 TIMESTAMP    -- '2026-06-08 14:30:00'
-- KST로 저장했는데 서버 타임존이 바뀌면 다른 시각으로 해석됨

-- TIMESTAMPTZ: UTC로 변환해 저장, 조회 시 세션 타임존으로 변환
이벤트일시 TIMESTAMPTZ  -- 내부: UTC '2026-06-08 05:30:00+00'
-- SET timezone = 'Asia/Seoul'; → '2026-06-08 14:30:00+09'로 보임
-- SET timezone = 'America/New_York'; → '2026-06-08 01:30:00-04'로 보임
```

**글로벌 서비스 규칙**: 이벤트 발생 시각을 저장할 때는 항상 `TIMESTAMPTZ`(또는 UTC로 저장하는 `TIMESTAMP`)를 사용한다. 타임존 없는 `TIMESTAMP`는 로컬 시각이 명확히 고정된 시스템에서만 쓴다.

## MySQL의 2038 문제

MySQL의 `TIMESTAMP` 타입은 내부적으로 4바이트 Unix timestamp를 저장한다. 최대값이 2038년 1월 19일 03:14:07 UTC다.

```sql
-- MySQL: TIMESTAMP는 2038년 한계
주문일시 TIMESTAMP   -- 2038년 이후 데이터 저장 불가!

-- MySQL: DATETIME이 안전
주문일시 DATETIME    -- 0001 ~ 9999년 지원 (타임존 없음)
```

신규 시스템 설계 시 MySQL에서는 타임존이 필요 없으면 `DATETIME`, 타임존이 필요하면 UTC로 통일한 `DATETIME`에 저장하는 관례를 쓴다.

## INTERVAL — 기간 연산

```sql
-- 만료일 산출
SELECT 가입일 + INTERVAL '1 year' AS 만료일
FROM   구독;

-- 7일 이내 주문 조회
SELECT * FROM 주문
WHERE  주문일시 >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- 나이 계산 (PostgreSQL)
SELECT AGE(CURRENT_DATE, 생년월일) AS 나이
FROM   직원;
-- 결과: '30 years 5 mons 12 days'
```

![날짜·시간 연산 예시](/assets/posts/sql-data-types-datetime-operations.svg)

## 날짜 인덱스와 WHERE 절

날짜 컬럼에 함수를 적용하면 인덱스를 타지 못한다.

```sql
-- 인덱스 사용 불가 (함수 적용)
WHERE EXTRACT(YEAR FROM 주문일) = 2026

-- 인덱스 사용 가능 (범위 조건)
WHERE 주문일 >= '2026-01-01'
  AND 주문일 <  '2027-01-01'
```

연도나 월 기준으로 필터링할 때는 범위 조건을 사용한다. PostgreSQL과 MySQL은 `EXTRACT` 또는 `YEAR()` 함수 기반 Function-Based Index를 지원하지만, 일반적인 경우에는 범위 조건이 더 직관적이고 이식 가능하다.

## DBMS별 현재 시각 함수

| 표준 SQL | PostgreSQL | MySQL | Oracle |
|---|---|---|---|
| `CURRENT_DATE` | 동일 | 동일 | SYSDATE (날짜+시간) |
| `CURRENT_TIMESTAMP` | 동일 / `NOW()` | 동일 / `NOW()` | SYSTIMESTAMP |
| `CURRENT_TIME` | 동일 | 동일 | - |

Oracle의 `SYSDATE`는 날짜와 시간을 모두 포함하는 Oracle 전용 타입이다. 날짜만 필요하면 `TRUNC(SYSDATE)`를 사용한다.

---

**지난 글:** [데이터 타입 완전 정리 — 숫자, 문자열, 불리언](/posts/sql-data-types-numeric-string-bool/)

**다음 글:** [제약 조건 완전 정리 — NOT NULL, DEFAULT, CHECK](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
