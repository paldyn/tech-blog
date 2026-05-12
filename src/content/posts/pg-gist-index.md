---
title: "GiST 인덱스 — 범위, 기하, 전문화된 검색 구조"
description: "PostgreSQL GiST(Generalized Search Tree)가 R-Tree 기반으로 Bounding Box를 계층적으로 저장하는 원리, Consistent/Union/Penalty/PickSplit 콜백으로 오퍼레이터 클래스를 확장하는 방식, 범위 타입(tsrange), PostGIS 공간 검색, pg_trgm 유사도 검색에서의 활용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["postgresql", "gist", "r-tree", "spatial-index", "range-type", "postgis", "pg-trgm", "trigram", "operator-class", "index"]
featured: false
draft: false
---

[지난 글](/posts/pg-gin-index/)에서 역인덱스 구조인 GIN을 살펴봤다. 이번에는 **GiST(Generalized Search Tree)** — PostgreSQL의 또 다른 범용 인덱스 프레임워크를 다룬다. GiST는 B-Tree나 R-Tree 같은 특정 알고리즘이 아니라, 임의의 트리 구조를 PostgreSQL 인덱스 API 위에 올릴 수 있는 추상화 계층이다.

## GiST의 핵심 아이디어

GiST Internal Node의 키는 자식 노드의 키를 **보수적으로 포함(Union)** 하는 Bounding Box다. 검색 시 Internal Node의 키가 쿼리 조건과 **교차(Consistent)** 하지 않으면 해당 서브트리 전체를 건너뛸 수 있다. 교차할 수 있으면 리프까지 내려가 실제 데이터를 확인(Recheck)한다.

```sql
-- GiST 인덱스는 오퍼레이터 클래스를 명시하거나 기본값 사용
-- 범위 타입 기본 오퍼레이터 클래스: range_ops
CREATE INDEX idx_reservations_dur
  ON reservations(duration)
  USING gist;

-- 검색 연산자 (GiST가 지원하는 범위 연산자)
-- && : 겹침    @> : 포함    <@ : 포함됨
-- <<  : 왼쪽  >> : 오른쪽  -|- : 인접

SELECT * FROM reservations
WHERE  duration && '[2026-06-01, 2026-06-07)'::tsrange;
```

![GiST R-Tree 기반 계층 구조](/assets/posts/pg-gist-index-structure.svg)

## 오퍼레이터 클래스 콜백

GiST 오퍼레이터 클래스는 다음 7가지 콜백 함수로 동작을 정의한다.

| 콜백 | 역할 |
|------|------|
| `consistent` | 쿼리와 키가 교차할 수 있는지 판정 |
| `union` | 키 집합의 합집합 계산 |
| `compress` / `decompress` | 저장 형식 변환 |
| `penalty` | 삽입 시 페이지 선택 비용 계산 |
| `picksplit` | 페이지 분할 시 두 그룹으로 분배 |
| `same` | 두 키의 동등성 판단 |
| `distance` | KNN 검색용 거리 계산 (선택) |

```sql
-- 기존 오퍼레이터 클래스 목록 확인
SELECT opcname, opcintype::regtype, opcdefault
FROM   pg_opclass
WHERE  opcmethod = (SELECT oid FROM pg_am WHERE amname = 'gist')
ORDER  BY opcname;
```

## 주요 활용 패턴

**1. 범위 타입 — 예약 시스템**

```sql
-- EXCLUDE 제약과 GiST로 겹치는 예약 방지
CREATE TABLE bookings (
  id      BIGSERIAL PRIMARY KEY,
  room_id INT,
  dur     tsrange,
  EXCLUDE USING gist (room_id WITH =, dur WITH &&)
);
-- 같은 방(room_id)의 겹치는 기간(dur) 삽입 자동 차단
```

**2. PostGIS 공간 검색**

PostGIS는 geometry 타입에 GiST를 사용한다. `&&` 연산자로 MBR(Minimum Bounding Rectangle)을 비교하고, 그 결과에서 `ST_DWithin`이나 `ST_Intersects`로 정밀 재확인한다.

**3. pg_trgm — 오타 허용 유사도 검색**

`pg_trgm`은 문자열을 3-gram으로 분해해 GiST나 GIN 인덱스로 저장한다. `%` 유사도 연산자, `LIKE`, `ILIKE` 패턴이 인덱스를 사용할 수 있게 된다.

![GiST 활용 — 범위·공간·트라이그램](/assets/posts/pg-gist-index-usecases.svg)

## GiST vs GIN 선택

```sql
-- pg_trgm: GiST vs GIN 비교
-- GiST: 업데이트 빠름, 검색 약간 느림
CREATE INDEX idx_name_gist ON products
  USING gist (name gist_trgm_ops);

-- GIN: 검색 빠름, 업데이트 느림 (fastupdate로 완화)
CREATE INDEX idx_name_gin ON products
  USING gin  (name gin_trgm_ops);
```

| 기준 | GiST | GIN |
|------|------|-----|
| 삽입/업데이트 | 빠름 | 느림 (fastupdate로 완화) |
| 검색 | 보통 | 빠름 |
| 크기 | 작음 | 큼 |
| 복합 인덱스 | 가능 | 가능 |
| 거짓 양성 | 있음 (Recheck) | 없음 |

공간 데이터와 범위 타입은 GiST가 유일한 선택이다. 트라이그램은 업데이트가 드문 경우 GIN이 더 빠르다.

## KNN 검색 — ORDER BY distance

GiST의 `distance` 콜백을 구현한 오퍼레이터 클래스는 KNN(K-Nearest Neighbor) 검색을 지원한다. 가장 가까운 N개의 행을 힙을 거치지 않고 인덱스 순회만으로 효율적으로 반환한다.

```sql
-- PostGIS KNN: 서울 시청에서 가장 가까운 매장 5개
SELECT name, ST_Distance(loc, ref) AS dist
FROM   stores,
       ST_MakePoint(126.977, 37.566)::geometry AS ref
ORDER  BY loc <-> ref   -- <-> 연산자: GiST distance 활용
LIMIT  5;
-- EXPLAIN에서 Index Scan with ORDER BY 확인 가능
```

---

**지난 글:** [GIN 인덱스 — 전문 검색과 배열, JSONB 역인덱스](/posts/pg-gin-index/)

**다음 글:** [SP-GiST와 BRIN 인덱스 — 특수 목적 인덱스 구조](/posts/pg-spgist-brin-index/)

<br>
읽어주셔서 감사합니다. 😊
