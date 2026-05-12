---
title: "PostgreSQL B-Tree 인덱스 내부 구조"
description: "PostgreSQL B-Tree 인덱스의 Meta Page → Root → Branch → Leaf 계층 구조, 8KB 페이지 레이아웃(PageHeader, ItemId Array, BTPageOpaqueData), 페이지 분할과 fill_factor의 관계, VACUUM이 Dead 인덱스 튜플을 정리하는 방식을 심층 분석합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["postgresql", "btree", "index", "page-layout", "fill-factor", "page-split", "nbtree", "index-bloat", "vacuum", "pageinspect"]
featured: false
draft: false
---

[지난 글](/posts/pg-select-for-update-skip-locked/)에서 행 수준 잠금 패턴을 살펴봤다. 이제 PostgreSQL 인덱스의 핵심인 **B-Tree** 내부로 들어간다. 인덱스 최적화와 트러블슈팅을 제대로 하려면 데이터가 어떻게 페이지에 배치되고, VACUUM이 어떻게 공간을 회수하는지 알아야 한다.

## B-Tree 계층 구조

PostgreSQL B-Tree(`nbtree`)는 고전적인 B+ Tree 변형이다. 모든 데이터는 리프(Leaf) 페이지에만 저장되고, 내부(Internal) 노드는 라우팅 키만 갖는다. 리프 페이지는 서로 이중 연결 리스트로 연결되어 있어 범위 스캔이 효율적이다.

```sql
-- pageinspect 확장으로 B-Tree 내부 확인
CREATE EXTENSION pageinspect;

-- 인덱스 메타 페이지
SELECT * FROM bt_metap('accounts_pkey');
-- magic | version | root | level | fastroot | fastlevel

-- 특정 페이지의 Internal Node 항목
SELECT * FROM bt_page_stats('accounts_pkey', 1);
-- type(l=leaf/i=internal) | live_items | dead_items | free_size

-- 리프 페이지 아이템 목록
SELECT itemoffset, ctid, itemlen, nulls, vars, data
FROM   bt_page_items('accounts_pkey', 3)
LIMIT  10;
```

![PostgreSQL B-Tree 계층 구조](/assets/posts/pg-btree-internals-structure.svg)

## 페이지 레이아웃

모든 B-Tree 페이지는 PostgreSQL의 표준 8KB 페이지 형식을 따른다.

```
[PageHeader 24B][ItemId Array][Free Space][Items...][Special Space]
```

`Special Space`에는 `BTPageOpaqueData`가 위치한다. 여기에 좌우 형제 페이지 번호(`btpo_prev`, `btpo_next`), 트리 레벨, 플래그(리프/내부/삭제됨)가 기록된다. 이 연결 정보 덕분에 리프 수준에서 순방향/역방향 스캔이 가능하다.

```sql
-- 인덱스 크기와 블로트 추정
SELECT relname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
       idx_scan,
       idx_tup_read,
       idx_tup_fetch
FROM   pg_stat_user_indexes
WHERE  relname = 'accounts';

-- 인덱스 블로트 상세 (pgstattuple)
CREATE EXTENSION pgstattuple;
SELECT * FROM pgstatindex('accounts_pkey');
-- leaf_fragmentation: 리프 페이지 단편화 %
```

![B-Tree 페이지 레이아웃과 fill_factor](/assets/posts/pg-btree-internals-page-layout.svg)

## fill_factor와 페이지 분할

`fill_factor`(기본 90%)는 새 인덱스 행을 삽입할 때 페이지를 어느 수준까지 채울지 결정한다. 10%의 여유 공간을 남기면 향후 삽입 시 페이지 분할이 덜 발생한다.

```sql
-- 읽기 전용(시계열 데이터) → 100%로 공간 절약
CREATE INDEX idx_logs_ts ON logs(created_at)
  WITH (fill_factor = 100);

-- 자주 업데이트·삽입되는 컬럼 → 여유 확보
CREATE INDEX idx_orders_status ON orders(status)
  WITH (fill_factor = 70);

-- 기존 인덱스 설정 변경
ALTER INDEX idx_orders_status SET (fill_factor = 75);
REINDEX INDEX idx_orders_status;  -- 재구성 필요
```

페이지가 가득 찰 때 발생하는 **Page Split**은 두 페이지로 50:50 분할하고 부모 내부 노드에 새 키를 추가한다. Root 페이지까지 분할되면 트리 높이가 1 증가하고 새 Root 페이지가 생성된다.

## VACUUM과 Dead 인덱스 튜플

행을 UPDATE하면 기존 튜플은 Dead 상태가 되고, 해당 튜플을 가리키는 인덱스 엔트리도 Dead 상태로 남는다. VACUUM은 힙 Dead 튜플을 정리한 뒤 인덱스 Dead 항목도 제거한다.

```sql
-- Dead 인덱스 항목 확인
SELECT * FROM pgstatindex('accounts_pkey');
-- dead_leaf_items: 아직 정리되지 않은 Dead 항목 수

-- 수동 인덱스 재구성 (잠금 최소화)
REINDEX INDEX CONCURRENTLY accounts_pkey;
-- CONCURRENTLY: 다른 쿼리 차단 없이 재구성
-- 이전 인덱스 유지하며 새 인덱스 빌드 → 완료 후 교체
```

`VACUUM`(일반)은 Dead 항목을 재사용 가능 공간으로 표시하지만 페이지를 OS에 반환하지 않는다. 인덱스 크기를 실제로 줄이려면 `REINDEX CONCURRENTLY`나 `pg_repack`을 사용해야 한다.

## HOT (Heap-Only Tuple) 최적화

인덱스 컬럼을 변경하지 않는 UPDATE는 **HOT(Heap-Only Tuple)** 경로를 통해 인덱스 갱신 없이 힙만 수정할 수 있다. 기존 인덱스 엔트리가 힙 페이지 내 리다이렉트 체인을 따라 새 튜플을 찾는다. `fill_factor`를 낮게 설정하면 HOT 업데이트가 같은 페이지 내에서 발생할 확률이 높아져 인덱스 bloat을 줄일 수 있다.

---

**지난 글:** [SELECT FOR UPDATE와 SKIP LOCKED — 행 수준 잠금 패턴](/posts/pg-select-for-update-skip-locked/)

**다음 글:** [PostgreSQL Hash 인덱스 — 등호 조회 전용 구조](/posts/pg-hash-index/)

<br>
읽어주셔서 감사합니다. 😊
