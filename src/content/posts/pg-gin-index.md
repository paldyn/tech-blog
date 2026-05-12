---
title: "GIN 인덱스 — 전문 검색과 배열, JSONB 역인덱스"
description: "PostgreSQL GIN(Generalized Inverted Index)이 tsvector 전문 검색, 배열 포함 연산, JSONB 키 검색에서 동작하는 역인덱스 원리, Pending List와 fastupdate 옵션, jsonb_ops vs jsonb_path_ops 오퍼레이터 클래스 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["postgresql", "gin", "inverted-index", "full-text-search", "tsvector", "jsonb", "array", "fastupdate", "pending-list", "operator-class"]
featured: false
draft: false
---

[지난 글](/posts/pg-hash-index/)에서 등호 조회에 특화된 Hash 인덱스를 살펴봤다. 이번에는 **GIN(Generalized Inverted Index)** — PostgreSQL에서 전문 검색, 배열, JSONB를 빠르게 처리하는 역인덱스 구조를 다룬다.

## 역인덱스란

일반 B-Tree는 행 → 키 방향으로 검색한다. GIN은 반대로 **키(토큰) → 행(Heap TID 목록)** 방향으로 매핑을 저장한다. 하나의 행이 여러 토큰을 가질 수 있는 경우(배열, 텍스트 단어, JSONB 키)에 최적화된 구조다.

```sql
-- tsvector 컬럼 사전 구성 + GIN 인덱스
ALTER TABLE articles ADD COLUMN fts_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))
  ) STORED;

CREATE INDEX idx_articles_fts ON articles USING gin(fts_vector);

-- 전문 검색
SELECT title, ts_rank(fts_vector, query) AS rank
FROM   articles, to_tsquery('english', 'postgresql & index') query
WHERE  fts_vector @@ query
ORDER  BY rank DESC
LIMIT  10;
```

![GIN 역인덱스 내부 구조](/assets/posts/pg-gin-index-structure.svg)

## Posting List와 Entry B-Tree

GIN은 내부적으로 Entry B-Tree와 Posting List 두 계층으로 구성된다.

- **Entry B-Tree**: 모든 고유 토큰이 정렬된 B-Tree
- **Posting List**: 각 토큰을 포함하는 행의 Heap TID 목록 (정렬, 압축)

Posting List가 짧으면 Entry B-Tree 리프 페이지에 인라인으로 저장되고, 길어지면 별도 Posting Tree 페이지를 사용한다.

## fastupdate와 Pending List

GIN은 INSERT 성능을 높이기 위해 **fastupdate** 모드를 제공한다. 새로운 항목은 즉시 Entry B-Tree를 갱신하지 않고 **Pending List**(힙 페이지)에 모은다. 이후 `gin_pending_list_limit`(기본 4MB) 초과 또는 VACUUM 시 일괄 병합된다.

```sql
-- fastupdate 비활성화 (배치 로드 후 권장)
CREATE INDEX idx_tags ON articles(tags) USING gin
  WITH (fastupdate = off);

-- 이미 생성된 인덱스 옵션 변경
ALTER INDEX idx_tags SET (fastupdate = on);

-- Pending List 강제 플러시
SELECT gin_clean_pending_list('idx_tags');

-- Pending List 크기 확인
SELECT indexrelid::regclass, pg_size_pretty(pendingPages * 8192::bigint)
FROM   pg_index
JOIN   (SELECT indexrelid, pendingPages
        FROM   pgstatginindex(oid)
        FROM   pg_index WHERE indisvalid) AS s
ON     pg_index.indexrelid = s.indexrelid;
```

## 배열과 JSONB GIN 인덱스

![GIN 인덱스 주요 활용 패턴 (FTS/배열/JSONB)](/assets/posts/pg-gin-index-usage.svg)

JSONB GIN 인덱스는 두 가지 오퍼레이터 클래스를 지원한다.

```sql
-- jsonb_ops (기본): 모든 키와 값 인덱싱
-- @>, ?, ?|, ?& 연산자 지원
CREATE INDEX idx_meta_default ON events USING gin(metadata);

-- jsonb_path_ops: @> 경로 표현식만 인덱싱
-- 크기 작음, @> 성능 우수, ? 연산자 미지원
CREATE INDEX idx_meta_path ON events
  USING gin(metadata jsonb_path_ops);

-- jsonb_path_ops가 유리한 쿼리
SELECT * FROM events
WHERE metadata @> '{"user_id": 42, "type": "login"}';
```

## GIN 인덱스 크기와 성능 특성

```sql
-- GIN 인덱스 통계 (pgstattuple)
CREATE EXTENSION pgstattuple;
SELECT * FROM pgstatginindex('idx_articles_fts');
-- version | pending_pages | pending_tuples

-- 인덱스 사용 여부 확인
SELECT * FROM pg_stat_user_indexes
WHERE  indexrelname = 'idx_articles_fts';

-- GIN은 B-Tree보다 크기가 클 수 있음 (역인덱스 특성)
-- 단어 수가 많은 텍스트 컬럼은 5~10x 크기 증가 가능
SELECT pg_size_pretty(pg_relation_size('idx_articles_fts'));
```

GIN은 B-Tree에 비해 삽입이 느리고(Entry Tree 갱신 비용), 인덱스 크기가 클 수 있다. 그러나 `@@`, `@>`, `&&`, `?` 같은 다중 토큰 연산에서는 순차 스캔 대비 수백 배의 성능 향상을 제공한다.

---

**지난 글:** [PostgreSQL Hash 인덱스 — 등호 조회 전용 구조](/posts/pg-hash-index/)

**다음 글:** [GiST 인덱스 — 범위, 기하, 전문화된 검색 구조](/posts/pg-gist-index/)

<br>
읽어주셔서 감사합니다. 😊
