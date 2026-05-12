---
title: "PostgreSQL 범위 타입 — daterange, tstzrange와 겹침 방지"
description: "PostgreSQL 범위 타입(int4range, daterange, tstzrange 등)의 경계 기호, @>, <@, &&, *, + 연산자, EXCLUDE USING GIST로 예약 시스템 겹침 방지 제약을 구현하는 실무 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["postgresql", "range-types", "tstzrange", "daterange", "gist-index", "exclude-constraint", "reservation-system", "interval"]
featured: false
draft: false
---

[지난 글](/posts/pg-jsonb-indexing-gin/)에서 JSONB GIN 인덱스의 동작 원리를 살펴봤다. 이번에는 PostgreSQL의 또 다른 고유 타입인 **범위 타입(Range Type)**을 다룬다. 예약 시스템, 기간 할인, 유효 기간 조건 등 "시작~끝"을 표현하는 모든 시나리오에서 강력하다.

## 범위 타입 종류

| 타입 | 기반 타입 | 예시 |
|------|----------|------|
| `int4range` | integer | `[1,10)` |
| `int8range` | bigint | `[1000000,9999999]` |
| `numrange` | numeric | `[1.5,3.7]` |
| `daterange` | date | `[2026-01-01,2026-12-31]` |
| `tsrange` | timestamp | `[2026-01-01 00:00, 2026-01-02 00:00)` |
| `tstzrange` | timestamptz | `[2026-01-01 00:00+09, 2026-01-02 00:00+09)` |

PostgreSQL 14+에서는 `multirange` 타입도 도입됐다(`int4multirange`, `datemultirange` 등).

## 경계 기호

```sql
-- [ ] : 포함(닫힘), ( ) : 제외(열림)
'[3, 9)'::int4range  -- 3 이상 9 미만
'(3, 9]'::int4range  -- 3 초과 9 이하
'[3, 9]'::int4range  -- 3 이상 9 이하
'(,9]'::int4range    -- 음의 무한대 ~ 9 이하
'[3,)'::int4range    -- 3 이상 양의 무한대

-- 빈 범위
'empty'::int4range

-- 생성 함수
SELECT int4range(3, 9, '[)');  -- [3,9)
SELECT daterange('2026-01-01', '2026-12-31', '[]');
```

`daterange`는 이산(discrete) 범위이므로 `[2026-01-01,2026-12-31]`과 `[2026-01-01,2027-01-01)`은 동일하게 정규화된다.

![범위 타입 연산자 시각화](/assets/posts/pg-range-types-operators.svg)

## 범위 연산자

| 연산자 | 의미 |
|--------|------|
| `@>` | 왼쪽이 오른쪽(범위 또는 값)을 포함 |
| `<@` | 왼쪽이 오른쪽에 포함됨 |
| `&&` | 두 범위가 겹침 |
| `<<` | 왼쪽이 오른쪽 앞에 완전히 위치 |
| `>>` | 왼쪽이 오른쪽 뒤에 완전히 위치 |
| `-|-` | 두 범위가 인접 |
| `+` | 합집합 (겹치거나 인접해야 함) |
| `*` | 교집합 |
| `-` | 차집합 |

```sql
-- 현재 시점이 범위 안에 있는지
SELECT '[2026-01-01, 2026-12-31]'::daterange @> CURRENT_DATE;

-- 두 기간이 겹치는지
SELECT '[2026-06-01, 2026-06-10)'::daterange
    && '[2026-06-05, 2026-06-15)'::daterange;  -- true

-- 교집합
SELECT '[2026-06-01, 2026-06-10)'::daterange
    * '[2026-06-05, 2026-06-15)'::daterange;  -- [2026-06-05,2026-06-10)
```

## 범위 함수

```sql
SELECT lower('[3,9)'::int4range);         -- 3
SELECT upper('[3,9)'::int4range);         -- 9
SELECT lower_inc('[3,9)'::int4range);     -- true (하한 포함)
SELECT upper_inc('[3,9)'::int4range);     -- false (상한 제외)
SELECT lower_inf('(,9]'::int4range);     -- true (무한대)
SELECT isempty('empty'::int4range);      -- true
SELECT range_length('[3,9)'::int4range); -- 6
```

## EXCLUDE 제약 — 겹침 방지의 핵심

```sql
CREATE TABLE reservation (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id integer NOT NULL,
    user_id bigint  NOT NULL,
    period  tstzrange NOT NULL,
    EXCLUDE USING GIST (
        room_id WITH =,   -- 같은 방이면서
        period  WITH &&   -- 기간이 겹치면 → 오류
    )
);
```

`EXCLUDE USING GIST`는 PostgreSQL 고유 기능이다. "조건을 만족하는 두 행이 동시에 존재할 수 없다"는 제약을 GIST 인덱스 기반으로 검사한다. 이 한 줄로 애플리케이션 레벨의 중복 예약 체크를 대체한다.

![범위 타입 실전 패턴](/assets/posts/pg-range-types-code.svg)

```sql
-- 예약 삽입 (겹치면 오류 발생)
INSERT INTO reservation (room_id, user_id, period)
VALUES (101, 42, '[2026-06-10 14:00+09, 2026-06-12 12:00+09)');

-- 이미 위 예약이 있으면 아래는 실패
INSERT INTO reservation (room_id, user_id, period)
VALUES (101, 99, '[2026-06-11 00:00+09, 2026-06-13 00:00+09)');
-- ERROR: conflicting key value violates exclusion constraint
```

## 현재 시점 포함 예약 조회

```sql
-- GIST 인덱스 활용 (period @> 조건)
SELECT r.id, r.room_id, r.period
FROM reservation r
WHERE r.period @> now()
  AND r.room_id = 101;

-- 오늘 체크인/체크아웃 대상
SELECT *
FROM reservation
WHERE lower(period)::date = CURRENT_DATE
   OR upper(period)::date = CURRENT_DATE;
```

## 날짜 범위 겹침 (daterange 활용)

```sql
CREATE TABLE promotion (
    id       serial PRIMARY KEY,
    name     text,
    valid    daterange NOT NULL,
    discount numeric(5,2)
);

CREATE INDEX idx_promo_valid ON promotion USING GIST (valid);

-- 오늘 유효한 프로모션
SELECT * FROM promotion
WHERE valid @> CURRENT_DATE;

-- 특정 기간 동안 유효한 프로모션
SELECT * FROM promotion
WHERE valid && '[2026-06-01, 2026-06-30]'::daterange;
```

## 히스토리 테이블 패턴

범위 타입을 활용하면 **테이블 레이어의 시간 이력 관리**도 간단해진다.

```sql
CREATE TABLE price_history (
    product_id  integer,
    price       numeric(10,2),
    valid_during daterange NOT NULL,
    EXCLUDE USING GIST (product_id WITH =, valid_during WITH &&)
);

-- 특정 날짜 시점의 가격 조회
SELECT price
FROM price_history
WHERE product_id = 100
  AND valid_during @> '2026-03-15'::date;

-- 현재 가격
SELECT price
FROM price_history
WHERE product_id = 100
  AND valid_during @> CURRENT_DATE;
```

## 사용자 정의 범위 타입

기본 범위 타입이 부족하면 직접 정의할 수 있다.

```sql
-- float8range가 없으므로 직접 생성
CREATE TYPE float8range AS RANGE (
    subtype = float8,
    subtype_diff = float8mi
);

SELECT '[1.5, 3.7]'::float8range @> 2.5::float8;  -- true
```

## 정리

PostgreSQL 범위 타입은 "기간 데이터"를 두 컬럼(시작, 종료)으로 분리하는 전통적 방식의 강력한 대안이다. `&&` 겹침 연산자와 `EXCLUDE USING GIST`의 조합은 예약 시스템의 중복 방지 로직을 애플리케이션이 아닌 DB 제약으로 내재화한다. `@>` 포함 검색은 GIST 인덱스를 활용해 "특정 시점에 활성인 행 찾기"를 효율적으로 처리한다.

---

**지난 글:** [JSONB GIN 인덱스 — 문서 검색 최적화](/posts/pg-jsonb-indexing-gin/)

**다음 글:** [사용자 정의 타입과 도메인 — CREATE TYPE, CREATE DOMAIN](/posts/pg-user-defined-types-domain/)

<br>
읽어주셔서 감사합니다. 😊
