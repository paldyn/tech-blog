---
title: "타임존 처리와 AT TIME ZONE"
description: "TIMESTAMP WITH TIME ZONE, AT TIME ZONE 구문, 세션 타임존 설정, UTC 저장 원칙, 서머타임 함정, DB별 타임존 변환 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "timezone", "timestamp", "at-time-zone", "utc", "timestamptz", "dst", "postgresql", "oracle"]
featured: false
draft: false
---

[지난 글](/posts/sql-datetime-functions-interval/)에서 날짜·시간 함수와 INTERVAL 산술을 살펴봤다. 이번에는 타임존(Time Zone) 처리—UTC 저장 원칙, `TIMESTAMP WITH TIME ZONE`, `AT TIME ZONE` 변환 구문, 세션 TZ 설정, 서머타임(DST) 함정—를 정리한다.

---

## 왜 타임존이 까다로운가

날짜·시간 값은 **"어떤 기준으로 측정한 시각인가"**를 명시하지 않으면 무의미하다. 같은 `2026-05-05 12:00:00`이라도 서울·뉴욕·런던에서 각각 다른 절대 시각을 가리킨다. 글로벌 서비스라면:

- 여러 나라 사용자가 동일 데이터를 서로 다른 로컬 시각으로 조회한다.
- 서머타임(DST) 전환 시 1시간이 사라지거나 중복된다.
- DB 서버 위치와 앱 서버 위치, 클라이언트 위치가 각각 다를 수 있다.

**황금 원칙: DB에는 UTC로 저장하고, 표시(display) 시점에만 로컬 TZ로 변환한다.**

---

## TIMESTAMP 타입의 두 갈래

![타임존 처리 개요](/assets/posts/sql-timezone-handling-overview.svg)

| 타입 | TZ 정보 | 내부 저장 | 표준 명칭 |
|------|---------|----------|---------|
| `TIMESTAMP WITH TIME ZONE` | 있음 | UTC로 변환·저장 | SQL:1999 |
| `TIMESTAMP WITHOUT TIME ZONE` | 없음 | 있는 그대로 | SQL:1992 |

PostgreSQL은 `TIMESTAMPTZ`(= `TIMESTAMP WITH TIME ZONE`), Oracle은 `TIMESTAMP WITH TIME ZONE` / `TIMESTAMP WITH LOCAL TIME ZONE`을 제공한다. SQL Server는 2016부터 `AT TIME ZONE` 연산자를 지원하며, `datetimeoffset` 타입이 오프셋 정보를 포함한다.

---

## AT TIME ZONE 구문

![AT TIME ZONE 코드 패턴](/assets/posts/sql-timezone-handling-code.svg)

### PostgreSQL

```sql
-- TIMESTAMPTZ → 특정 TZ로 변환 (표시용)
SELECT now() AT TIME ZONE 'Asia/Seoul';

-- TIMESTAMP (TZ 없음) → TZ 있는 타입으로 해석 후 변환
SELECT '2026-05-05 12:00:00'::timestamp AT TIME ZONE 'UTC'
                                         AT TIME ZONE 'Asia/Seoul';

-- 세션 타임존 변경 (연결 단위)
SET timezone = 'Asia/Seoul';
SELECT now();  -- KST로 표시
```

`AT TIME ZONE`을 **두 번** 연속 사용하면: 첫 번째 적용은 `TIMESTAMP → TIMESTAMPTZ` 해석(지정 TZ를 기준으로), 두 번째 적용은 `TIMESTAMPTZ → TIMESTAMP` 변환(다른 TZ 기준으로 표시)이다.

### Oracle

```sql
-- SYSTIMESTAMP는 이미 TIMESTAMP WITH TIME ZONE
SELECT SYSTIMESTAMP AT TIME ZONE 'Asia/Seoul' FROM DUAL;

-- DATE/TIMESTAMP를 TZ-aware로 변환 후 전환
SELECT FROM_TZ(CAST(SYSDATE AS TIMESTAMP), 'UTC')
       AT TIME ZONE 'Asia/Seoul'
FROM DUAL;

-- 세션 TZ 변경
ALTER SESSION SET TIME_ZONE = 'Asia/Seoul';
```

### SQL Server (2016+)

```sql
-- GETUTCDATE()를 특정 TZ로 변환
SELECT GETUTCDATE() AT TIME ZONE 'UTC'
                   AT TIME ZONE 'Korea Standard Time';

-- datetimeoffset 타입 활용
SELECT SYSDATETIMEOFFSET() AT TIME ZONE 'Korea Standard Time';
```

---

## 서머타임(DST) 함정

DST가 적용되는 타임존(예: `America/New_York`)은 시간이 이중으로 존재하거나 사라지는 구간이 있다.

```sql
-- 뉴욕 DST 전환 직전·직후 (2026-03-08 02:00 → 03:00)
SELECT '2026-03-08 02:30:00 America/New_York'::timestamptz;
-- ERROR: 이 시각은 존재하지 않음 (시계가 03:30으로 건너뜀)

-- 안전한 방법: UTC로 저장 후 변환
INSERT INTO events(ts) VALUES ('2026-03-08 07:30:00+00');
SELECT ts AT TIME ZONE 'America/New_York' FROM events;
```

UTC 저장 시 DST 문제를 DB 레이어에서 완전히 피할 수 있다.

---

## 세션 TZ vs 컬럼 TZ

| 방법 | 범위 | 주의 |
|------|------|------|
| `SET timezone` (PostgreSQL) | 세션 전체 | ORM 커넥션 풀에서 누락 위험 |
| `ALTER SESSION SET TIME_ZONE` (Oracle) | 세션 전체 | 같음 |
| `AT TIME ZONE` 함수 | 쿼리 수준 | 명시적이고 안전 |
| 컬럼 기본값 CURRENT_TIMESTAMP | 삽입 시 | 세션 TZ 영향받음 |

커넥션 풀 환경에서는 세션 TZ 설정이 다른 세션에 영향을 주지 않도록 **커넥션 획득 시점에 TZ를 강제 설정**하거나, **AT TIME ZONE을 쿼리에 명시**하는 것이 안전하다.

---

## 실무 권장 패턴

```sql
-- 1. 테이블은 TIMESTAMPTZ로 정의
CREATE TABLE orders (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 삽입은 UTC 또는 오프셋 명시
INSERT INTO orders DEFAULT VALUES;

-- 3. 조회 시 AT TIME ZONE으로 변환
SELECT id,
       created_at AT TIME ZONE 'Asia/Seoul' AS created_kst
FROM orders;
```

---

## DB별 타임존 확인 쿼리

```sql
-- PostgreSQL
SHOW timezone;
SELECT current_setting('timezone');

-- Oracle
SELECT DBTIMEZONE, SESSIONTIMEZONE FROM DUAL;

-- MySQL / MariaDB
SELECT @@global.time_zone, @@session.time_zone;

-- SQL Server
SELECT GETDATE(), SYSDATETIMEOFFSET();
```

---

**지난 글:** [날짜·시간 함수와 INTERVAL 연산](/posts/sql-datetime-functions-interval/)

**다음 글:** [UNION · INTERSECT · EXCEPT 집합 연산](/posts/sql-union-intersect-except/)

<br>
읽어주셔서 감사합니다. 😊
