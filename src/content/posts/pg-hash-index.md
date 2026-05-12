---
title: "PostgreSQL Hash 인덱스 — 등호 조회 전용 구조"
description: "PostgreSQL Hash 인덱스의 Linear Hashing 확장 메커니즘, Bucket·Overflow 페이지 구조, B-Tree와의 성능 비교, WAL 지원 이력, 그리고 UUID·세션 토큰처럼 긴 문자열 등호 조회에서 Hash 인덱스를 선택하는 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["postgresql", "hash-index", "btree", "index", "linear-hashing", "uuid", "cardinality", "wal", "pageinspect", "performance"]
featured: false
draft: false
---

[지난 글](/posts/pg-btree-internals/)에서 B-Tree 인덱스의 내부 페이지 구조를 상세히 살펴봤다. 이번에는 PostgreSQL이 제공하는 두 번째 인덱스 유형인 **Hash 인덱스**를 다룬다. 단순해 보이지만 적합한 상황에서는 B-Tree보다 작고 빠른 인덱스를 제공한다.

## Hash 인덱스의 원리

Hash 인덱스는 키 값을 해시 함수(`hashtext()`, `hashint4()` 등)로 변환해 버킷 번호를 계산한다. 같은 버킷에 여러 키가 충돌하면 **Overflow 페이지** 체인으로 연결한다.

```sql
-- Hash 인덱스 생성
CREATE INDEX idx_users_email ON users(email) USING hash;

-- EXPLAIN으로 Hash Scan 확인
EXPLAIN SELECT * FROM users WHERE email = 'alice@example.com';
-- Index Scan using idx_users_email on users
-- Index Cond: (email = 'alice@example.com')
-- -> Hash Scan 사용 확인

-- 조건: = 연산자만 지원
-- 아래는 Hash 인덱스 사용 불가 (B-Tree 필요)
-- WHERE email LIKE 'alice%'
-- WHERE email > 'alice@example.com'
```

![Hash 인덱스 내부 버킷 구조](/assets/posts/pg-hash-index-structure.svg)

## Linear Hashing — 동적 버킷 확장

PostgreSQL Hash 인덱스는 **Linear Hashing**을 사용한다. 데이터가 증가해 버킷이 가득 차면 버킷을 하나씩 분할해 점진적으로 확장한다. 한 번에 전체를 재해시(rehash)하지 않으므로 확장 비용이 분산된다.

```sql
-- 인덱스 내부 상태 확인 (pageinspect)
CREATE EXTENSION pageinspect;

-- Hash 인덱스 메타 페이지
SELECT * FROM hash_metapage_info(get_raw_page('idx_users_email', 0));
-- max_bucket, num_tuples, ffactor(fill factor per bucket)

-- 특정 버킷 페이지 정보
SELECT * FROM hash_page_stats(get_raw_page('idx_users_email', 1));
-- type(b=bucket/o=overflow/m=meta) | live_items | dead_items

-- 버킷 내 아이템 확인
SELECT * FROM hash_page_items(get_raw_page('idx_users_email', 2));
-- itemoffset | ctid | data (해시 값)
```

## Hash vs B-Tree 선택 기준

B-Tree는 범용 인덱스로 대부분의 상황에서 적합하다. Hash 인덱스가 경쟁력을 갖는 경우는 다음과 같다.

**Hash가 유리한 경우:**
- 매우 긴 문자열(UUID, 세션 토큰, URL) — Hash 인덱스는 키 값 자체를 저장하지 않고 해시값(4바이트)만 저장해 인덱스 크기가 작다
- 등호 조회만 수행하는 높은 카디널리티 컬럼
- `LIKE` 없이 정확한 일치 조회

```sql
-- UUID 컬럼 Hash 인덱스: 크기 비교
CREATE TABLE tokens (
  id    UUID PRIMARY KEY,
  token TEXT NOT NULL,
  data  TEXT
);

-- B-Tree (token이 길면 인덱스도 큼)
CREATE INDEX idx_token_bt ON tokens(token);

-- Hash (해시값 4B만 저장 → 대폭 소형화)
CREATE INDEX idx_token_hash ON tokens(token) USING hash;

SELECT pg_size_pretty(pg_relation_size('idx_token_bt'))   AS btree_size,
       pg_size_pretty(pg_relation_size('idx_token_hash')) AS hash_size;
```

![Hash 인덱스 적용 시나리오](/assets/posts/pg-hash-index-usecase.svg)

## WAL 지원과 안전성

PostgreSQL 9.x까지 Hash 인덱스는 WAL 로그를 완전히 기록하지 않아 크래시 복구 후 `REINDEX`가 필요했다. **PostgreSQL 10부터 WAL이 완전히 지원**되어 일반 인덱스와 동일한 내구성을 보장한다.

```sql
-- 운영 중 Hash 인덱스 재구성 (잠금 없이)
REINDEX INDEX CONCURRENTLY idx_token_hash;

-- Hash 인덱스가 있는 테이블의 VACUUM 동작
-- Hash 인덱스도 B-Tree와 동일하게 Dead 항목 정리
VACUUM ANALYZE tokens;
```

## 복합 인덱스 제약

Hash 인덱스는 **단일 컬럼만** 지원한다. `(email, user_id)` 같은 복합 인덱스는 생성할 수 없다. 복합 조건의 등호 필터가 필요하면 B-Tree를 사용하거나, 여러 단일 Hash 인덱스를 조합하는 Bitmap Index Scan을 활용한다.

---

**지난 글:** [PostgreSQL B-Tree 인덱스 내부 구조](/posts/pg-btree-internals/)

**다음 글:** [GIN 인덱스 — 전문 검색과 배열, JSONB 역인덱스](/posts/pg-gin-index/)

<br>
읽어주셔서 감사합니다. 😊
