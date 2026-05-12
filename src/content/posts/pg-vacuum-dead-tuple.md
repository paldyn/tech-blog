---
title: "VACUUM과 Dead 튜플 — 더티 공간 회수의 원리"
description: "PostgreSQL MVCC의 부산물인 Dead 튜플이 쌓이는 원인, VACUUM이 힙 페이지를 스캔하며 공간을 회수하는 과정, autovacuum 트리거 임계값 설정, VACUUM FULL의 위험성과 대안 pg_repack을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["postgresql", "vacuum", "dead-tuple", "autovacuum", "bloat", "xid-wraparound", "pg-repack", "heap-page", "visibility-map"]
featured: false
draft: false
---

[지난 글](/posts/pg-mvcc-xmin-xmax-ctid/)에서 MVCC의 xmin, xmax, ctid를 통해 튜플 버전 체인이 만들어지는 원리를 살펴봤다. UPDATE와 DELETE는 기존 튜플을 즉시 지우지 않고 Dead 상태로 남긴다 — 이 Dead 튜플을 회수하는 역할이 **VACUUM**이다.

## Dead 튜플이 쌓이는 이유

모든 UPDATE는 새 버전 튜플을 삽입하고 기존 튜플을 Dead로 표시한다. DELETE도 마찬가지다. 이 Dead 튜플은 더 이상 어떤 트랜잭션도 볼 수 없게 될 때까지는 삭제할 수 없다 — 아직 구형 스냅샷을 보고 있는 트랜잭션이 있을 수 있기 때문이다.

```sql
-- Dead 튜플 생성 확인
CREATE TABLE counter (id int PRIMARY KEY, val int);
INSERT INTO counter VALUES (1, 0);

-- 10번 UPDATE
DO $$ BEGIN
    FOR i IN 1..10 LOOP
        UPDATE counter SET val = i WHERE id = 1;
    END LOOP;
END $$;

-- Dead 튜플 수 확인
SELECT n_live_tup, n_dead_tup FROM pg_stat_user_tables
WHERE relname = 'counter';
-- n_live_tup=1, n_dead_tup=10
```

![VACUUM 전후 힙 페이지 구조](/assets/posts/pg-vacuum-dead-tuple-page.svg)

## VACUUM의 동작 과정

VACUUM은 다음 단계로 동작한다.

1. **힙 스캔**: 모든 페이지를 읽으며 Dead 튜플 위치 목록 수집
2. **인덱스 정리**: 수집된 Dead 튜플을 가리키는 인덱스 엔트리 제거
3. **힙 정리**: Dead 튜플을 Free Space로 표시 (페이지 내 재배치)
4. **Visibility Map 업데이트**: 모든 튜플이 Live인 페이지를 표시
5. **FSM(Free Space Map) 업데이트**: 재사용 가능 공간 기록

```sql
-- VACUUM 직접 실행
VACUUM counter;

-- 상세 출력
VACUUM VERBOSE counter;
-- INFO: table "counter": found 10 removable, 1 nonremovable row versions
-- INFO: table "counter": 0 removed, 1 remain

-- ANALYZE와 함께 (통계 갱신 포함)
VACUUM ANALYZE counter;
```

## VACUUM vs VACUUM FULL

| 항목 | VACUUM | VACUUM FULL |
|------|--------|-------------|
| 잠금 | 없음 (ShareUpdateExclusive) | 배타 잠금 (AccessExclusive) |
| 동작 중 DML | 가능 | 불가 |
| 공간 반환 | 테이블 내 재사용만 | OS에 반환 |
| 테이블 재작성 | 없음 | 있음 (크기 줄어듦) |
| 운영 중 사용 | 가능 | 위험 (다운타임 필요) |

`VACUUM FULL`은 테이블을 완전히 재작성해 OS에 공간을 반환한다. 단, **배타 잠금**으로 인해 작업 시간 동안 테이블 접근이 차단된다. 대용량 테이블에서는 `pg_repack` 또는 `pg_squeeze` 확장을 활용하면 잠금 없이 재작성할 수 있다.

```sql
-- pg_repack 예시 (확장 설치 후)
-- pg_repack -t big_table -d mydb
```

## Autovacuum — 자동 VACUUM

`autovacuum`은 백그라운드에서 주기적으로 VACUUM을 실행한다. 트리거 조건은 다음과 같다.

```
autovacuum 실행 기준:
  n_dead_tup > autovacuum_vacuum_threshold
              + autovacuum_vacuum_scale_factor * n_live_tup
```

기본값:
- `autovacuum_vacuum_threshold` = 50
- `autovacuum_vacuum_scale_factor` = 0.2 (20%)

즉, 라이브 튜플의 20% + 50개가 Dead가 되면 autovacuum이 동작한다. 대용량 테이블(억 단위)에서는 이 비율이 너무 높아 Dead 튜플이 수천만 개 쌓인다. 테이블별로 낮은 scale_factor를 설정하는 것이 중요하다.

```sql
-- 특정 테이블의 autovacuum 설정 오버라이드
ALTER TABLE big_orders SET (
    autovacuum_vacuum_scale_factor = 0.01,   -- 1%
    autovacuum_vacuum_threshold = 100,
    autovacuum_analyze_scale_factor = 0.005  -- 0.5%
);
```

![VACUUM 모니터링 쿼리](/assets/posts/pg-vacuum-dead-tuple-monitoring.svg)

## VACUUM 모니터링

```sql
-- Dead 튜플 현황 (상위 테이블)
SELECT relname,
       n_live_tup,
       n_dead_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
       last_autovacuum,
       last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;

-- 진행 중인 VACUUM 상태
SELECT relid::regclass,
       phase,
       heap_blks_scanned,
       heap_blks_total,
       num_dead_item_ids
FROM pg_stat_progress_vacuum;

-- 테이블 bloat 추정 (pgstattuple 확장)
SELECT dead_tuple_count, dead_tuple_len, free_space
FROM pgstattuple('person');
```

## Visibility Map — VACUUM 최적화

VACUUM은 Visibility Map(VM)을 활용해 스캔을 최적화한다. VM은 비트맵으로 각 페이지의 상태를 추적한다.

- **All-Visible 비트**: 모든 튜플이 모든 트랜잭션에 보임 → VACUUM 스킵 가능
- **All-Frozen 비트**: 모든 튜플이 Frozen → XID Wraparound 위험 없음

```sql
-- 페이지별 VM 상태 (pg_visibility 확장)
CREATE EXTENSION pg_visibility;

SELECT blkno, all_visible, all_frozen
FROM pg_visibility_map('person')
WHERE NOT all_visible;
```

Index Only Scan은 VM의 All-Visible 비트를 확인해 힙 조회를 생략하므로, VACUUM이 자주 실행될수록 Index Only Scan 효율이 높아진다.

## XID Wraparound 예방

VACUUM FREEZE는 오래된 튜플의 xmin을 `FrozenXID`로 교체해 XID Wraparound를 예방한다.

```sql
-- XID 고갈 위험 모니터링
SELECT datname,
       age(datfrozenxid) AS xid_age,
       2000000000 - age(datfrozenxid) AS xids_remaining
FROM pg_database
ORDER BY age(datfrozenxid) DESC;
-- age가 2억 이상이면 autovacuum이 적극 freeze 시작
-- age가 20억에 가까우면 PostgreSQL이 read-only 모드로 전환

-- 강제 freeze
VACUUM FREEZE VERBOSE person;
```

`autovacuum_freeze_max_age` (기본 2억)에 도달하면 autovacuum이 강제 실행된다. 이 VACUUM은 테이블 전체를 스캔하므로 I/O 폭탄이 될 수 있다. `autovacuum_vacuum_cost_delay`와 `autovacuum_vacuum_cost_limit`으로 I/O 속도를 조절한다.

## Bloat와 repack

VACUUM이 Free Space를 표시해도, 그 공간이 OS로 반환되지는 않는다. 테이블 파일 크기는 줄어들지 않는다. 이를 **bloat(부풀림)**이라 한다.

```sql
-- pg_repack으로 잠금 없이 테이블 재작성 (확장 필요)
-- $ pg_repack -d mydb -t person
-- $ pg_repack -d mydb --jobs 4  -- 병렬

-- 대안: 새 테이블 생성 후 데이터 이동
CREATE TABLE person_new AS SELECT * FROM person;
-- 필요한 제약·인덱스·권한 재생성 후 테이블 교체
```

## 정리

PostgreSQL의 MVCC는 뛰어난 동시성을 제공하지만, 그 대가로 Dead 튜플이 쌓인다. VACUUM은 이를 정기적으로 회수해 공간을 재사용 가능하게 만들고, Visibility Map으로 이후 스캔을 최적화하며, FREEZE로 XID Wraparound를 예방한다. 대용량 테이블에서는 autovacuum 임계값을 낮추고, 극심한 bloat에는 pg_repack을 활용하는 것이 운영 실무의 핵심이다.

---

**지난 글:** [MVCC — xmin, xmax, ctid로 이해하는 다중 버전 동시성](/posts/pg-mvcc-xmin-xmax-ctid/)

<br>
읽어주셔서 감사합니다. 😊
