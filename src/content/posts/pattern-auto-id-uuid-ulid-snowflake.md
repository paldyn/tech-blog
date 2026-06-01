---
title: "기본키 ID 전략 — AUTO_INCREMENT, UUID, ULID, Snowflake"
description: "데이터베이스 기본키를 설계할 때 선택할 수 있는 AUTO_INCREMENT, UUID v4/v7, ULID, Snowflake ID의 구조와 장단점을 비교하고, 상황별 최선의 선택 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["기본키", "UUID", "ULID", "Snowflake ID", "AUTO_INCREMENT", "분산 ID", "데이터 모델링"]
featured: false
draft: false
---

[지난 글](/posts/pattern-queue-for-update-skip-locked/)에서 DB를 작업 큐로 활용하는 패턴을 살펴봤습니다. 이번에는 모든 테이블 설계의 출발점인 **기본키 ID 전략**을 다룹니다. 단순해 보이지만, 잘못된 선택은 인덱스 단편화, 분산 환경의 충돌, 보안 취약점으로 이어질 수 있습니다.

## 왜 ID 전략이 중요한가

기본키는 단순한 식별자가 아닙니다. B+Tree 인덱스 구조 위에서 **삽입 순서가 곧 물리적 저장 순서**가 됩니다. 랜덤한 값을 기본키로 쓰면 페이지 분할이 빈번히 일어나 쓰기 성능이 저하됩니다. 반대로 순차적인 숫자를 쓰면 예측 가능성이 생겨 보안 문제가 생깁니다.

![ID 전략 비교표](/assets/posts/pattern-auto-id-uuid-ulid-snowflake-compare.svg)

## AUTO_INCREMENT / SERIAL / IDENTITY

가장 단순한 방법입니다. DB가 1, 2, 3 순서로 값을 발급합니다.

```sql
-- MySQL
CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT NOW()
);

-- PostgreSQL
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SQL Server
CREATE TABLE orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
```

**장점**: 작은 크기(4~8바이트), 완벽한 정렬, 인덱스 단편화 없음.

**단점**: 단일 DB에서만 안전합니다. 레코드 수를 외부에 노출(`GET /orders/1001`이면 1000개 이상임을 유추 가능)하고, 테이블 병합 시 충돌이 발생합니다.

## UUID v4 — 랜덤 128비트

```sql
-- PostgreSQL (pgcrypto 확장 또는 내장 gen_random_uuid())
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL
);

-- MySQL 8.0+
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL
);
```

RFC 4122 표준으로 122비트 랜덤값을 사용합니다. 충돌 확률은 사실상 0에 가깝지만, **랜덤 삽입 순서** 때문에 InnoDB 클러스터드 인덱스에서 페이지 분할이 빈번히 발생합니다. 초당 수천 건 이상의 쓰기가 있는 테이블에서는 눈에 띄는 성능 저하가 생길 수 있습니다. 저장 크기도 16바이트(CHAR(36)이면 36바이트)로 큽니다.

## UUID v7 — 타임스탬프 기반 (권장)

2023년 RFC 9562로 표준화된 UUID v7은 앞 48비트에 밀리초 타임스탬프를 담습니다.

```sql
-- PostgreSQL 17+ 내장 지원
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  payload JSONB
);

-- 직접 생성 함수 예시 (PostgreSQL)
CREATE OR REPLACE FUNCTION uuidv7() RETURNS UUID AS $$
DECLARE
  v_unix_ms BIGINT;
  v_bytes   BYTEA;
BEGIN
  v_unix_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  v_bytes   := set_byte(gen_random_bytes(16), 0, (v_unix_ms >> 40) & 255);
  -- 상위 48비트에 타임스탬프 설정 (생략 단순화)
  RETURN encode(v_bytes, 'hex')::UUID;
END;
$$ LANGUAGE plpgsql;
```

UUID v4의 충돌 안전성을 유지하면서 단조 증가 특성을 더했습니다. **새로 설계하는 시스템에서 UUID가 필요하다면 v7을 기본 선택으로 삼으세요.**

## ULID — Universally Unique Lexicographically Sortable Identifier

![ULID · Snowflake 비트 구조](/assets/posts/pattern-auto-id-uuid-ulid-snowflake-structure.svg)

ULID는 48비트 타임스탬프 + 80비트 랜덤값을 Crockford Base32로 인코딩한 26자 문자열입니다.

```
01ARZ3NDEKTSV4RRFFQ69G5FAV
└──────────┘└──────────────┘
  타임스탬프      랜덤
  (10자)         (16자)
```

```sql
-- PostgreSQL에서 ulid 확장 또는 커스텀 함수 사용
CREATE EXTENSION IF NOT EXISTS pgulid;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY DEFAULT gen_ulid(),
  user_id BIGINT NOT NULL,
  message TEXT NOT NULL
);

-- 생성된 ULID 예시
-- 01HXZ3V8F9K2MQPG7Y4NBJRW5E
```

정렬 가능하고, 대소문자를 구분하지 않으며, URL 안전 문자만 사용합니다. 단점은 표준 DB 함수가 없어 라이브러리 의존성이 생긴다는 점입니다.

## Snowflake ID — 64비트 분산 시퀀스

Twitter(현 X)가 2010년 공개한 방식으로, Discord·Instagram·Mastodon 등 대규모 서비스에서 채택했습니다.

```
비트 구조 (64bit):
[부호 1bit] [타임스탬프 41bit] [노드 ID 10bit] [시퀀스 12bit]

- 타임스탬프: 커스텀 에포크 기준 밀리초, 약 69년
- 노드 ID: 최대 1024대의 Generator
- 시퀀스: 같은 ms 내 최대 4096개
```

```sql
-- 애플리케이션 레이어에서 생성 (Java + Twitter Snowflake)
// id = ((currentMs - epoch) << 22) | (nodeId << 12) | sequence

-- DB에는 BIGINT로 저장
CREATE TABLE tweets (
  id BIGINT PRIMARY KEY,
  content TEXT NOT NULL,
  user_id BIGINT NOT NULL
);
```

정렬 가능하고 8바이트에 불과하지만, **Generator 서비스 또는 라이브러리가 반드시 필요**합니다. 에포크를 언제로 설정하느냐에 따라 최대 수명이 달라집니다.

## 전략 선택 기준

| 상황 | 추천 |
|------|------|
| 단일 DB, 내부 서비스 | AUTO_INCREMENT / BIGSERIAL |
| 분산 환경, UUID 표준 필요 | UUID v7 |
| URL 안전 문자열 ID | ULID |
| 초대형 분산 시스템 | Snowflake ID |
| 레거시 호환 (UUID 있음) | UUID v4 유지 (v7 마이그레이션 검토) |

## 복합 기본키와 자연키

자연키(이메일, 주민번호 등)를 기본키로 쓰면 변경 시 연쇄 업데이트가 발생합니다. **비즈니스 키는 UNIQUE 제약으로 보호하고, 기본키는 별도의 서로게이트 키로 분리**하는 것이 일반적입니다.

```sql
CREATE TABLE customers (
  id      BIGSERIAL PRIMARY KEY,
  email   TEXT NOT NULL UNIQUE,
  name    TEXT NOT NULL
);
```

## UUID를 BINARY(16)으로 저장하기 (MySQL)

MySQL에서 CHAR(36)으로 UUID를 저장하면 인덱스가 36바이트를 차지합니다. `BIN_TO_UUID()` / `UUID_TO_BIN()` 함수를 사용하면 16바이트로 줄이고, 두 번째 인자에 `1`을 전달하면 앞 48비트(타임스탬프)를 앞으로 재배치해 UUID v1의 정렬 문제를 완화합니다.

```sql
-- MySQL 8.0+
CREATE TABLE sessions (
  id     BINARY(16) PRIMARY KEY DEFAULT (UUID_TO_BIN(UUID(), 1)),
  token  TEXT NOT NULL
);

-- 조회
SELECT BIN_TO_UUID(id, 1) AS id FROM sessions;
```

---

**지난 글:** [SELECT FOR UPDATE SKIP LOCKED — DB 큐 패턴](/posts/pattern-queue-for-update-skip-locked/)

**다음 글:** [ENUM vs 룩업 테이블 — 코드성 데이터 설계](/posts/pattern-enum-vs-lookup-table/)

<br>
읽어주셔서 감사합니다. 😊
