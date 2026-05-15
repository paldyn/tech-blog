---
title: "PostgreSQL 선언적 파티셔닝 — RANGE·LIST·HASH"
description: "PostgreSQL 10+의 선언적 파티셔닝 PARTITION BY RANGE·LIST·HASH 문법, 자식 파티션 생성, 파티션 프루닝 동작 원리, DETACH PARTITION CONCURRENTLY, 슬라이딩 윈도우 패턴으로 오래된 데이터 관리, 파티션 인덱스·PK 제약 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["postgresql", "partitioning", "range-partition", "list-partition", "hash-partition", "partition-pruning", "detach-partition", "sliding-window", "pg-partman"]
featured: false
draft: false
---

[지난 글](/posts/pg-foreign-data-wrapper/)에서 FDW로 외부 데이터 소스를 연결하는 방법을 살펴봤다. 이번에는 대용량 테이블의 성능과 관리성을 높이는 **선언적 파티셔닝(Declarative Partitioning)**을 다룬다. PostgreSQL 10에서 도입된 이 기능은 10~100억 건 이상의 시계열 데이터나 멀티테넌트 데이터를 효율적으로 관리할 수 있게 한다.

## 파티셔닝이 필요한 상황

- 단일 테이블이 수십~수백 GB를 초과해 VACUUM이 느려지는 경우
- 시간 기반으로 오래된 데이터를 빠르게 삭제해야 하는 경우
- 특정 파티션 키 기준으로 데이터를 자주 조회하는 경우
- 멀티테넌트 환경에서 테넌트별 데이터 격리가 필요한 경우

## 선언적 파티셔닝 3가지 타입

![파티셔닝 타입 비교](/assets/posts/pg-declarative-partitioning-types.svg)

### RANGE 파티션 — 날짜·숫자 범위

```sql
-- 부모 테이블 생성
CREATE TABLE logs (
  id         BIGSERIAL,
  ts         TIMESTAMP NOT NULL,
  level      TEXT,
  message    TEXT
) PARTITION BY RANGE (ts);

-- 자식 파티션 (월별)
CREATE TABLE logs_2026_04
  PARTITION OF logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE logs_2026_05
  PARTITION OF logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

`FROM`은 포함(inclusive), `TO`는 제외(exclusive)다.

### LIST 파티션 — 이산 값

```sql
CREATE TABLE orders (
  id      BIGSERIAL,
  country TEXT NOT NULL,
  amount  NUMERIC
) PARTITION BY LIST (country);

CREATE TABLE orders_kr PARTITION OF orders FOR VALUES IN ('KR');
CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('US', 'CA');
CREATE TABLE orders_default PARTITION OF orders DEFAULT;  -- 나머지 모두
```

`DEFAULT` 파티션은 어느 파티션에도 속하지 않는 행을 받는다. LIST/RANGE 모두 사용 가능하다.

### HASH 파티션 — 균등 분산

```sql
CREATE TABLE events (
  id      BIGSERIAL,
  user_id INT NOT NULL,
  event   TEXT
) PARTITION BY HASH (user_id);

CREATE TABLE events_0 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE events_1 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE events_2 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE events_3 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

## 파티션 프루닝

![파티션 프루닝과 슬라이딩 윈도우](/assets/posts/pg-declarative-partitioning-pruning.svg)

`WHERE` 절에 파티션 키 조건이 있으면 옵티마이저가 해당하지 않는 파티션을 쿼리 실행에서 제외한다. 이것이 파티셔닝의 가장 큰 성능 이점이다.

```sql
-- 파티션 프루닝 확인
EXPLAIN SELECT * FROM logs WHERE ts >= '2026-05-01' AND ts < '2026-06-01';
-- Append
--   -> Seq Scan on logs_2026_05  (해당 파티션만 스캔)
```

프루닝이 동작하려면 `WHERE` 조건이 파티션 키를 직접 포함해야 한다. `WHERE date_trunc('month', ts) = '2026-05-01'` 같은 함수 래핑은 프루닝이 안 된다.

## 슬라이딩 윈도우 패턴

시계열 로그의 전형적 운영 패턴이다. 새 파티션을 주기적으로 추가하고, 보존 기간이 지난 파티션을 즉시 DROP한다.

```sql
-- 다음 달 파티션 미리 생성 (크론 또는 pg_partman이 자동화)
CREATE TABLE logs_2026_06
  PARTITION OF logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- 오래된 파티션 DROP (DELETE보다 수백 배 빠름 — 파일 시스템 삭제)
DROP TABLE logs_2025_12;

-- 또는: DETACH 후 아카이브로 이동 (잠금 최소화)
ALTER TABLE logs DETACH PARTITION logs_2025_11 CONCURRENTLY;
-- 이제 logs_2025_11은 독립 테이블 → pg_dump, S3 등에 아카이브 가능
```

`DETACH PARTITION CONCURRENTLY`(PG14+)는 테이블 전체 잠금 없이 파티션을 분리한다. 운영 환경에서 권장된다.

## 파티션 인덱스

부모 테이블에 인덱스를 생성하면 모든 자식 파티션에 자동으로 적용된다.

```sql
-- 부모에 인덱스 생성 → 모든 파티션에 자동 적용
CREATE INDEX idx_logs_ts ON logs (ts);
CREATE INDEX idx_logs_level ON logs (level) WHERE level = 'ERROR';

-- 특정 파티션에만 인덱스를 다르게 적용하려면 직접 생성
CREATE INDEX idx_logs_2026_05_ts ON logs_2026_05 (ts, level);
```

## 기본 키와 유니크 제약

파티션 테이블의 PRIMARY KEY는 **파티션 키를 포함**해야 한다.

```sql
-- 오류: ts 없이 id만 PK 불가
-- CREATE TABLE logs (...) PARTITION BY RANGE (ts);
-- ALTER TABLE logs ADD PRIMARY KEY (id);  -- ERROR

-- 올바른 방법: 파티션 키 포함
ALTER TABLE logs ADD PRIMARY KEY (id, ts);
```

이 제약은 각 파티션이 독립된 물리 파일이므로 전체에 걸쳐 유니크를 보장할 수 없기 때문이다.

## 파티션 관리 자동화 — pg_partman

실제 운영에서는 파티션을 수동으로 관리하기 어렵다. `pg_partman` 확장을 사용하면 파티션 생성·삭제·유지를 자동화할 수 있다.

```sql
-- pg_partman 설치 후
SELECT partman.create_parent(
  p_parent_table => 'public.logs',
  p_control => 'ts',
  p_type => 'native',
  p_interval => '1 month',
  p_premake => 3  -- 3개월 미리 생성
);

-- 유지 관리 (크론에 등록)
SELECT partman.run_maintenance();
```

## 파티션 조회

```sql
-- 파티션 목록 조회
SELECT
  child.relname AS partition,
  pg_get_expr(child.relpartbound, child.oid) AS bounds
FROM pg_class parent
JOIN pg_inherits i ON i.inhparent = parent.oid
JOIN pg_class child ON child.oid = i.inhrelid
WHERE parent.relname = 'logs'
ORDER BY child.relname;

-- 각 파티션 크기
SELECT
  relname,
  pg_size_pretty(pg_relation_size(oid)) AS size
FROM pg_class
WHERE relname LIKE 'logs_%'
ORDER BY relname;
```

선언적 파티셔닝은 레거시 상속 기반 파티셔닝(PostgreSQL 9.x 이하)에 비해 문법이 간단하고 플래너 지원이 풍부하다. 대용량 테이블 운영의 필수 도구다.

---

**지난 글:** [PostgreSQL FDW — Foreign Data Wrapper로 외부 데이터 연결](/posts/pg-foreign-data-wrapper/)

<br>
읽어주셔서 감사합니다. 😊
