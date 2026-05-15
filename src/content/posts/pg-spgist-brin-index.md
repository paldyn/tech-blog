---
title: "SP-GiST와 BRIN 인덱스 — 특수 목적 인덱스 구조"
description: "PostgreSQL SP-GiST(Space-Partitioned GiST)의 쿼드트리·kd-트리·트라이 구조와 공간·IP 범위 검색 활용, BRIN(Block Range Index)이 블록 단위 min/max 요약으로 시계열 데이터에서 B-Tree 대비 99% 이상 인덱스 크기를 줄이는 원리, pages_per_range 튜닝 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["postgresql", "spgist", "brin", "block-range-index", "quadtree", "kd-tree", "timeseries", "inet", "pages-per-range", "index-size"]
featured: false
draft: false
---

[지난 글](/posts/pg-gist-index/)에서 GiST의 R-Tree 기반 공간 분할을 살펴봤다. 이번에는 PostgreSQL의 마지막 두 가지 인덱스 유형 — **SP-GiST**와 **BRIN** — 을 함께 다룬다. 둘 다 B-Tree나 GiST와는 다른 특수한 데이터 분포에 특화되어 있다.

## SP-GiST — 불균등 공간 분할 트리

SP-GiST(Space-Partitioned GiST)는 공간을 겹치지 않는 파티션으로 재귀 분할하는 구조다. GiST의 Bounding Box와 달리, 각 파티션이 서로 겹치지 않는다는 특성이 있다. 이로 인해 특정 데이터 분포에서 GiST보다 탐색 경로가 짧다.

내장 오퍼레이터 클래스:
- `kd_point_ops` — 2차원 점 kd-트리
- `quad_point_ops` — 2차원 점 쿼드트리  
- `range_ops` — 범위 타입 (SP-GiST 버전)
- `text_ops` — 텍스트 접두어 트라이

```sql
-- 위치 데이터 SP-GiST 인덱스 (쿼드트리)
CREATE INDEX idx_places_loc ON places USING spgist (location);

-- KNN 검색도 지원
SELECT name
FROM   places
ORDER  BY location <-> '(37.5, 127.0)'::point
LIMIT  5;

-- 텍스트 접두어 트라이 (LIKE 'prefix%' 최적화)
CREATE INDEX idx_url_prefix ON pages USING spgist (url);
SELECT * FROM pages WHERE url LIKE 'https://paldyn.com/%';
```

![SP-GiST 구조 vs BRIN 구조](/assets/posts/pg-spgist-brin-index-spgist.svg)

## INET 타입과 SP-GiST

`inet` 타입(IPv4/IPv6)은 SP-GiST와 잘 맞는다. 계층적 서브넷 구조가 SP-GiST의 접두어 트리와 자연스럽게 매핑된다.

```sql
-- IP 주소 서브넷 검색
CREATE TABLE ip_blocks (
  network inet,
  country text
);

CREATE INDEX idx_ip_spgist ON ip_blocks USING spgist (network inet_ops);

-- 서브넷 포함 검색
SELECT country FROM ip_blocks
WHERE  network >> '203.0.113.45'::inet;
-- >> : 오른쪽이 왼쪽 서브넷에 포함되는지 여부
```

## BRIN — 블록 범위 인덱스

BRIN은 인덱스 크기와 검색 효율을 극단적으로 절충한 구조다. 힙 페이지를 `pages_per_range`(기본 128) 단위 블록 그룹으로 나누고, 각 그룹의 컬럼 값 **min과 max**만 인덱스에 저장한다.

검색 시 쿼리 범위가 블록 그룹의 min~max와 겹치지 않으면 해당 그룹 전체를 건너뛴다. 그러므로 **물리적 삽입 순서와 논리적 정렬 순서가 일치할수록** BRIN이 효과적이다. 시계열 데이터가 가장 대표적인 사례다.

```sql
-- 시계열 로그 테이블 BRIN 인덱스
CREATE INDEX idx_logs_brin ON logs(created_at)
  USING brin
  WITH (pages_per_range = 128);

-- 인덱스 통계
SELECT * FROM brin_page_items(get_raw_page('idx_logs_brin', 2), 'idx_logs_brin');
-- itemoffset | blknum | attnum | allnulls | hasnulls | placeholder | value

-- BRIN 요약 강제 업데이트
SELECT brin_summarize_new_values('idx_logs_brin');

-- 자동 요약 활성화 확인
SHOW autosummarize;  -- BRIN은 autovacuum 시 자동 요약 갱신
```

![BRIN 블록 범위 필터링 원리](/assets/posts/pg-spgist-brin-index-brin-concept.svg)

## pages_per_range 튜닝

`pages_per_range`가 작을수록 인덱스가 더 세밀하지만 크기가 커진다. 크면 인덱스는 작지만 필터링 정밀도가 낮아진다.

```sql
-- 파티셔닝 테이블에서 월 파티션당 pages_per_range 계산 예시
-- 파티션당 평균 100만 행, 행당 200B → 200MB ÷ 8KB = 약 25,000 페이지
-- pages_per_range = 256이면 BRIN 범위 약 100개 → 충분히 세밀

-- 범위 최적값 확인 쿼리
SELECT pages_per_range,
       regexp_match(range_min, '.*')  AS min_val,
       regexp_match(range_max, '.*')  AS max_val
FROM   brin_metapage_info(get_raw_page('idx_logs_brin', 0));
```

## 인덱스 선택 요약

| 인덱스 | 최적 데이터 | 지원 연산 | 크기 |
|--------|-------------|-----------|------|
| B-Tree | 스칼라 범용 | =, <, >, BETWEEN, LIKE 접두어 | 보통 |
| Hash | 등호 전용 | = | 작음 |
| GIN | 다중 값 (배열, tsvector, JSONB) | @@, @>, &&, ? | 큼 |
| GiST | 기하, 범위, 유사도 | &&, @>, KNN | 보통 |
| SP-GiST | 계층적 공간, 텍스트 접두어 | <@, @>, LIKE 'x%' | 보통 |
| BRIN | 물리 순서=논리 순서 시계열 | =, <, >, BETWEEN | 매우 작음 |

---

**지난 글:** [GiST 인덱스 — 범위, 기하, 전문화된 검색 구조](/posts/pg-gist-index/)

<br>
읽어주셔서 감사합니다. 😊
