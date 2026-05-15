---
title: "PostgreSQL 스토리지 — Heap과 TOAST"
description: "PostgreSQL이 데이터를 저장하는 방식인 Heap 파일 구조, 8KB 페이지 레이아웃, MVCC의 Dead Tuple 발생 원리, 그리고 대용량 값을 자동 처리하는 TOAST 메커니즘(압축·외부화·전략 설정)을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["postgresql", "heap", "toast", "page-layout", "ctid", "dead-tuple", "vacuum", "storage", "compression", "pglz"]
featured: false
draft: false
---

[지난 글](/posts/pg-memory-shared-buffers-work-mem/)에서 PostgreSQL의 메모리 구조를 살펴봤다. 이번에는 디스크에 데이터가 실제로 어떻게 저장되는지 — **Heap 파일 구조**와 **TOAST 메커니즘** — 를 다룬다.

## Heap 파일이란

PostgreSQL의 테이블 데이터는 **Heap 파일**에 저장된다. Oracle의 세그먼트·익스텐트·블록 계층 구조와 달리, PostgreSQL은 단순히 **8KB 페이지**를 나열한 파일이다. 파일은 `$PGDATA/base/{db_oid}/{relfilenode}` 경로에 위치하며 1GB 초과 시 `_1`, `_2` 접미사로 분리된다.

```sql
-- 테이블의 실제 파일 경로 확인
SELECT pg_relation_filepath('orders');
-- 결과: base/16384/24601

-- 파일 크기 (테이블 + 인덱스 합계)
SELECT pg_size_pretty(pg_total_relation_size('orders'));
SELECT pg_size_pretty(pg_relation_size('orders'));        -- 테이블만
SELECT pg_size_pretty(pg_indexes_size('orders'));         -- 인덱스만
```

## 8KB 페이지 구조

각 페이지는 다음 영역으로 구성된다.

![PostgreSQL Heap 페이지 구조](/assets/posts/pg-storage-heap-layout.svg)

| 영역 | 크기 | 내용 |
|---|---|---|
| **Page Header** | 24 bytes | LSN, 체크섬, pd_lower(포인터 끝), pd_upper(튜플 시작) |
| **Item Pointers** | 4 bytes × N | 각 튜플의 오프셋·크기·플래그 |
| **Free Space** | 가변 | pd_lower ~ pd_upper 사이 |
| **Tuples (역방향)** | 가변 | 실제 행 데이터, 페이지 끝에서 위로 채워짐 |
| **Special Area** | 가변 | B-Tree 노드 링크 등 인덱스 전용 |

## ctid — 물리 위치 포인터

모든 튜플은 `ctid(page_no, item_offset)` 형식의 물리적 주소를 가진다. `ctid = (0, 1)`은 0번 페이지의 첫 번째 슬롯을 의미한다. UPDATE 시 새 버전 튜플이 다른 위치에 쓰이므로 `ctid`가 변경된다.

```sql
-- ctid로 물리 위치 확인
SELECT ctid, id, amount FROM orders LIMIT 5;
-- (0,1) → 첫 페이지 첫 슬롯

-- HOT Update 확인: ctid가 같은 페이지 내에서 변경되면 HOT
```

## MVCC와 Dead Tuple

PostgreSQL MVCC는 행을 업데이트할 때 **구버전을 삭제하지 않고 그대로 둔다**. 새 버전은 새 위치에 쓰이고, 구버전은 `xmax`(무효화 트랜잭션 ID)가 설정된 **Dead Tuple**이 된다. 오래된 트랜잭션이 모두 끝나면 VACUUM이 이 공간을 회수한다.

Dead Tuple이 쌓이면 페이지가 낭비되고, 시퀀셜 스캔 비용이 커진다.

```sql
-- Dead Tuple 현황 확인
SELECT relname, n_live_tup, n_dead_tup,
       ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
       last_autovacuum
FROM   pg_stat_user_tables
ORDER  BY n_dead_tup DESC
LIMIT  10;

-- 즉시 VACUUM 실행
VACUUM (ANALYZE, VERBOSE) orders;
```

![Heap · TOAST 분석 SQL](/assets/posts/pg-storage-heap-sql.svg)

## TOAST — 대용량 값 처리

PostgreSQL 행은 하나의 페이지(8KB)를 넘을 수 없다. `text`, `bytea`, `jsonb` 같은 가변 길이 타입이 크면 **TOAST(The Oversized-Attribute Storage Technique)**가 자동으로 개입한다.

처리 순서:
1. 값 크기가 **2KB 초과**이면 압축 시도 (기본 PGLZ, 14c부터 LZ4 선택 가능)
2. 압축 후에도 크면 별도 **TOAST 테이블**(`pg_toast.pg_toast_NNNN`)에 분리 저장
3. 원본 행에는 포인터(va_toastpointer)만 남음

### TOAST 전략 (컬럼별 설정)

| 전략 | 기호 | 동작 |
|---|---|---|
| EXTENDED | x | 기본값. 압축 후 외부 저장 |
| EXTERNAL | e | 압축 없이 외부 저장 (LIKE 패턴 매칭 빠름) |
| MAIN | m | 압축 우선, 외부화는 최후 수단 |
| PLAIN | p | 압축·외부화 없음 (int/float 등에 사용) |

```sql
-- 컬럼의 현재 TOAST 전략 확인
SELECT attname, attstorage
FROM   pg_attribute
WHERE  attrelid = 'articles'::regclass
  AND  attnum > 0;

-- EXTERNAL 전략으로 변경 (LIKE '%keyword%' 성능 개선)
ALTER TABLE articles
  ALTER COLUMN body SET STORAGE EXTERNAL;

-- 14c 이상: LZ4 압축 사용
ALTER TABLE articles
  ALTER COLUMN body SET COMPRESSION lz4;

-- TOAST 테이블 확인
SELECT relname FROM pg_class
WHERE  relkind = 't'  -- 't' = TOAST table
  AND  reltoastrelid != 0;
```

## Fillfactor — 업데이트 여유 공간

`fillfactor`는 INSERT 시 페이지를 몇 %까지만 채울지 설정한다. 기본값은 100(꽉 채움). UPDATE가 잦은 테이블은 80~90으로 낮춰 **HOT(Heap Only Tuple) Update**가 같은 페이지 안에서 이루어질 공간을 확보한다.

```sql
-- fillfactor 80으로 테이블 생성
CREATE TABLE orders (
  id     BIGSERIAL PRIMARY KEY,
  amount NUMERIC(12,2)
) WITH (fillfactor = 80);

-- 기존 테이블 변경 (REPACK 필요)
ALTER TABLE orders SET (fillfactor = 80);
VACUUM FULL orders;  -- 실제 적용을 위해 재구성
```

## 정리

PostgreSQL 스토리지의 핵심은 단순한 8KB 페이지 배열이다. MVCC 특성상 Dead Tuple이 누적되므로 VACUUM을 통한 공간 회수가 필수다. TOAST는 대용량 컬럼을 자동으로 처리하지만, LIKE 검색이 많은 컬럼은 EXTERNAL 전략으로 압축을 끄는 것이 유리하다.

---

**지난 글:** [Shared Buffers와 work_mem — PostgreSQL 메모리 심화](/posts/pg-memory-shared-buffers-work-mem/)

**다음 글:** [PostgreSQL WAL 메커니즘](/posts/pg-wal-mechanism/)

<br>
읽어주셔서 감사합니다. 😊
