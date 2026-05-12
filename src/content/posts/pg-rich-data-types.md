---
title: "PostgreSQL 풍부한 데이터 타입 — 표준을 넘어서"
description: "PostgreSQL이 제공하는 uuid, inet, 배열, jsonb, range, numeric 등 고유 타입의 분류와 선택 기준을 정리합니다. 올바른 타입 선택이 인덱스 효율과 쿼리 단순화에 미치는 영향을 실무 관점에서 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["postgresql", "data-types", "uuid", "inet", "jsonb", "array", "numeric", "range", "type-system"]
featured: false
draft: false
---

[지난 글](/posts/pg-checkpointer-bgwriter/)에서 Checkpointer와 BGWriter가 더티 페이지를 관리하는 원리를 살펴봤다. 이번부터는 PostgreSQL의 기능 레이어로 시선을 옮겨, 가장 눈에 띄는 특징인 **풍부한 데이터 타입 시스템**을 탐구한다.

## 왜 타입이 중요한가

"모든 컬럼을 `varchar(255)`로 하면 안 되나?"라는 질문을 실무에서 자주 본다. 기술적으로 동작하지만 세 가지를 잃는다.

1. **DB 레벨 제약 내재화** — 잘못된 IP 주소, 잘못된 UUID 형식을 애플리케이션이 아닌 DB가 막는다.
2. **타입 전용 연산자** — `inet` 컬럼에는 `>>` (서브넷 포함) 연산자가 쓰인다. `varchar`에는 없다.
3. **인덱스 효율** — `jsonb`는 GIN 인덱스를, `inet`은 GIST 인덱스를 활용할 수 있다.

PostgreSQL의 타입 선택은 설계 결정이지 취향 문제가 아니다.

![PostgreSQL 풍부한 데이터 타입 분류](/assets/posts/pg-rich-data-types-overview.svg)

## 수치 타입

| 타입 | 크기 | 범위 | 용도 |
|------|------|------|------|
| `smallint` | 2 bytes | ±32,767 | 상태 코드, 소규모 카운터 |
| `integer` | 4 bytes | ±2.1억 | 일반 ID, 카운터 |
| `bigint` | 8 bytes | ±922경 | 대용량 ID, Unix 타임스탬프 ms |
| `numeric(p,s)` | 가변 | 임의 정밀도 | 금융, 정밀 계산 |
| `float8` | 8 bytes | IEEE 754 | 과학 계산 (근사값 주의) |

`serial` / `bigserial`은 시퀀스를 감싼 편의 타입으로, PostgreSQL 10 이후에는 `GENERATED ALWAYS AS IDENTITY`가 권장된다.

```sql
-- 금융 금액: float 쓰면 반올림 오류 발생
CREATE TABLE transaction (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount  numeric(18, 4) NOT NULL,  -- float8 금지
    fee     numeric(18, 4) NOT NULL DEFAULT 0
);
```

## 문자 타입 — text를 기본으로

PostgreSQL에서 `char(n)`, `varchar(n)`, `text`는 내부적으로 동일한 저장 구조를 공유한다. 성능 차이가 없으므로 `text`를 기본으로 사용하고, 길이 제한이 필요하면 CHECK 제약이나 도메인으로 표현하는 것이 관용적이다.

```sql
-- varchar(255) 대신 text + check
ALTER TABLE users
    ADD CONSTRAINT chk_username_len
    CHECK (char_length(username) BETWEEN 3 AND 50);
```

`bytea`는 바이너리 데이터를 저장하며, 이미지·파일 저장에는 `\x` hex 이스케이프 또는 `\\` 이스케이프 형식을 사용한다.

## 날짜·시간 타입

```sql
-- timestamptz = timestamp with time zone (UTC 내부 저장)
CREATE TABLE event_log (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred   timestamptz NOT NULL DEFAULT now(),
    duration   interval,               -- '2 hours 30 minutes'
    event_date date                    -- 시간 없는 날짜
);

-- interval 산술
SELECT now() + INTERVAL '30 days' AS deadline;
SELECT AGE(now(), '2000-01-01'::date);  -- 경과 시간
```

`timestamp`(타임존 없음)와 `timestamptz`(타임존 있음)는 별개다. 서버 이전·다중 리전 환경에서 `timestamp`는 시간대 혼란을 일으킨다. **항상 `timestamptz`를 기본값으로** 설정하는 팀 컨벤션을 권장한다.

## PostgreSQL 고유 타입

### UUID

```sql
-- gen_random_uuid(): pgcrypto 또는 pg 13+의 내장 함수
CREATE TABLE product (
    id   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL
);
```

UUID v4는 충돌 없는 분산 ID 생성에 적합하다. 단, 무작위성으로 인한 B-tree 페이지 분할을 피하려면 UUIDv7(시간 정렬) 또는 ULID를 검토한다.

### inet / cidr / macaddr

```sql
-- inet: IP 주소 + 서브넷 마스크 저장 및 연산
SELECT '192.168.1.100'::inet << '192.168.1.0/24'::inet;  -- true: 서브넷 포함 여부
SELECT host('192.168.1.100/24'::inet);  -- '192.168.1.100'
SELECT network('192.168.1.100/24'::inet);  -- '192.168.1.0/24'
```

IP 주소를 문자열로 저장하면 범위 검색에 LIKE나 정규식이 필요하지만, `inet` 타입은 `<<`(서브넷 포함), `>>`(서브넷 피포함), `&&`(주소 겹침) 연산자를 제공한다.

### 배열 (Array)

```sql
CREATE TABLE article (
    id   bigint PRIMARY KEY,
    tags text[]  DEFAULT '{}'::text[]
);

INSERT INTO article VALUES (1, '{"postgresql","index","performance"}');

-- 배열 포함 검색
SELECT * FROM article WHERE tags @> ARRAY['postgresql'];

-- 배열 원소 개수
SELECT id, array_length(tags, 1) AS tag_count FROM article;
```

배열은 GIN 인덱스와 함께 사용할 때 강력하다. 다음 글에서 `UNNEST`와 함께 상세히 다룬다.

### JSONB

```sql
-- jsonb: 바이너리 저장, 중복 키 제거, 키 정렬
CREATE TABLE config (
    id    integer PRIMARY KEY,
    props jsonb NOT NULL DEFAULT '{}'
);

-- JSONB 경로 조회
SELECT props->>'theme' AS theme FROM config WHERE id = 1;
SELECT props #>> '{notification,email}' AS email_noti FROM config;
```

`json`은 입력 텍스트를 그대로 보존하고, `jsonb`는 파싱된 바이너리로 저장한다. 검색·인덱스를 쓰려면 항상 `jsonb`를 선택한다.

![고급 타입 활용 예시](/assets/posts/pg-rich-data-types-code.svg)

## 범위 타입 (Range)

```sql
-- tstzrange: 타임스탬프 범위
CREATE TABLE reservation (
    id       bigint PRIMARY KEY,
    room_id  integer,
    period   tstzrange NOT NULL,
    EXCLUDE USING GIST (room_id WITH =, period WITH &&)  -- 겹침 방지
);

-- 범위 연산자
SELECT * FROM reservation
WHERE period @> now()::timestamptz;  -- 현재 시점 포함 예약
```

범위 타입의 백미는 `EXCLUDE USING GIST`와 결합한 **겹침 방지 제약**이다. 예약 시스템에서 "같은 방·같은 시간 중복 예약"을 DB 레벨에서 막을 수 있다.

## 타입 선택 가이드

| 상황 | 피할 것 | 사용할 것 |
|------|---------|----------|
| IP 주소 저장 | `varchar` | `inet` |
| 분산 PK | `integer` | `uuid` / `bigint` identity |
| 가변 속성 저장 | EAV 패턴 | `jsonb` |
| 다중 태그 | 정규화 조인 | `text[]` + GIN |
| 기간 조건 | 시작/종료 두 컬럼 | `tstzrange` |
| 금액 | `float8` | `numeric(p,s)` |

## 사용자 정의 타입

PostgreSQL은 `CREATE TYPE`으로 복합 타입(composite), 열거형(enum), 범위 타입을 직접 정의할 수 있다. 이는 시리즈 뒤쪽의 `pg-user-defined-types-domain`에서 다룬다.

```sql
-- 열거형 타입
CREATE TYPE order_status AS ENUM ('pending','paid','shipped','cancelled');

-- 복합 타입
CREATE TYPE address AS (
    street  text,
    city    text,
    country char(2)
);
```

## 정리

PostgreSQL의 타입 시스템은 "어떤 값을 저장하느냐"가 아니라 "어떤 연산을 수행하느냐"를 기준으로 설계됐다. `uuid`는 충돌 없는 식별, `inet`은 네트워크 연산, `jsonb`는 유연한 스키마, `range`는 겹침 제약을 각각 DB 레이어에서 내재화한다. 애플리케이션 코드로 해결할 수도 있지만, 올바른 타입 선택은 그 로직을 더 안전하고 빠르게 DB로 위임한다.

---

**다음 글:** [PostgreSQL 배열 타입과 UNNEST — 다차원 데이터 처리](/posts/pg-array-types-unnest/)

<br>
읽어주셔서 감사합니다. 😊
