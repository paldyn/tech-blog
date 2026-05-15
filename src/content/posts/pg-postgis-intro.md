---
title: "PostGIS 입문 — 지리 데이터 타입과 공간 쿼리"
description: "PostgreSQL 공간 데이터 확장 PostGIS의 geometry·geography 타입 차이, OGC 지오메트리 타입 계층(POINT·LINESTRING·POLYGON·MULTI*), SRID와 좌표계 개념, ST_DWithin·ST_Contains·ST_Intersects 등 핵심 공간 함수, GiST 인덱스 적용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["postgresql", "postgis", "spatial", "geometry", "geography", "gist-index", "st-dwithin", "st-contains", "wkt", "geojson", "srid"]
featured: false
draft: false
---

[지난 글](/posts/pg-stat-statements/)에서 쿼리 통계 수집 도구를 살펴봤다. 이번에는 PostgreSQL의 가장 강력한 확장 중 하나인 **PostGIS**를 소개한다. PostGIS는 PostgreSQL에 지리 공간(Geospatial) 데이터 타입과 공간 함수를 추가해 지도·위치 기반 서비스 데이터를 SQL로 처리할 수 있게 한다.

## PostGIS란

PostGIS는 OGC(Open Geospatial Consortium)의 Simple Features 표준을 구현한 확장이다. 좌표 데이터를 저장하고, "1km 내 매장 검색", "폴리곤 안에 있는 POI 찾기", "두 도로가 교차하는지 확인" 같은 공간 질의를 SQL로 처리한다.

```sql
-- 설치 (서버에 postgis 패키지 필요)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 버전 확인
SELECT PostGIS_Version();
```

## 지오메트리 타입 계층

![PostGIS 지오메트리 타입 계층](/assets/posts/pg-postgis-intro-types.svg)

모든 타입은 `geometry`라는 최상위 타입의 서브타입이다.

| 타입 | 설명 | 예시 |
|------|------|------|
| `POINT` | 단일 좌표 | 매장 위치, GPS 로그 |
| `LINESTRING` | 순서 있는 점의 연결 | 도로, 경로 |
| `POLYGON` | 닫힌 링(면) | 행정구역, 건물 외곽 |
| `MULTIPOINT` | 점 집합 | 분산된 POI 그룹 |
| `MULTILINESTRING` | 선 집합 | 끊긴 도로망 |
| `MULTIPOLYGON` | 면 집합 | 도서(섬) 행정구역 |
| `GEOMETRYCOLLECTION` | 혼합 집합 | 복합 지형 |

## geometry vs geography

```sql
-- geometry: 평면(유클리드) 좌표계
-- 좌표 단위는 SRID가 결정 (도, 미터 등)
location geometry(Point, 4326)  -- WGS84 경위도

-- geography: 구면 좌표계 (WGS84 기준)
-- 거리 단위는 항상 미터
location geography(Point, 4326)
```

`geography` 타입은 지구 곡률을 고려해 거리를 계산한다. 서울-부산 거리는 `geography`로 계산해야 정확하다. 하지만 연산 비용이 `geometry`보다 높고, 지원하는 함수 수가 적다.

같은 도시 내 단거리 계산이라면 `geometry`에 투영 좌표계(EPSG:5181 한국 TM 등)를 쓰는 것이 빠르다.

## SRID — 좌표 참조 시스템

SRID(Spatial Reference Identifier)는 좌표계를 식별하는 번호다.

| SRID | 설명 |
|------|------|
| 4326 | WGS84 경위도 (GPS) |
| 3857 | Web Mercator (구글 지도, OpenStreetMap) |
| 5174 | 한국 중부원점 TM (레거시) |
| 5181 | 한국 중부원점 TM (GRS80) |

```sql
-- SRID 확인
SELECT srid, auth_name, srtext FROM spatial_ref_sys WHERE srid = 4326;

-- 좌표계 변환: 4326 → 5181
SELECT ST_Transform(geom, 5181) FROM pois;
```

서로 다른 SRID의 지오메트리를 직접 비교하면 오류가 발생한다. 반드시 같은 SRID로 변환한 후 연산해야 한다.

## 테이블 생성과 데이터 입력

```sql
-- 매장 테이블
CREATE TABLE stores (
  id      SERIAL PRIMARY KEY,
  name    TEXT,
  location geography(Point, 4326)
);

-- WKT(Well-Known Text)로 입력
INSERT INTO stores (name, location) VALUES
  ('강남점', ST_MakePoint(127.0276, 37.4979)),
  ('서초점', ST_GeogFromText('POINT(127.0325 37.4862)'));

-- WKB(Well-Known Binary) 또는 GeoJSON으로도 입력 가능
INSERT INTO stores (name, location)
VALUES ('판교점', ST_GeogFromWKB(E'\\x0101000020E6100000...'));
```

## 핵심 공간 함수

![PostGIS 핵심 공간 함수](/assets/posts/pg-postgis-intro-queries.svg)

### 거리 관련

```sql
-- 두 점 사이의 거리 (미터)
SELECT ST_Distance(
  'POINT(127.0276 37.4979)'::geography,
  'POINT(127.0325 37.4862)'::geography
);

-- 반경 내 검색 (가장 자주 쓰는 패턴)
SELECT name, ST_Distance(location, ref) AS dist_m
FROM stores,
  ST_MakePoint(127.0276, 37.4979)::geography AS ref(ref)
WHERE ST_DWithin(location, ref, 1000)  -- 1000m 이내
ORDER BY dist_m;
```

`ST_DWithin`은 인덱스를 활용하므로 `ST_Distance(...) < 1000` 형식보다 훨씬 빠르다.

### 위상 관계

```sql
-- 포함 여부
SELECT ST_Contains(polygon_geom, point_geom);   -- 완전 포함
SELECT ST_Within(point_geom, polygon_geom);      -- 역방향
SELECT ST_Intersects(geom_a, geom_b);            -- 겹침 여부
SELECT ST_Touches(geom_a, geom_b);               -- 경계 접촉
SELECT ST_Crosses(line1, line2);                  -- 교차

-- 경계 버퍼 (500m 반경 폴리곤 생성)
SELECT ST_Buffer(location::geometry, 500) FROM stores WHERE id = 1;
```

### 출력 형식

```sql
SELECT ST_AsText(geom);       -- WKT: POINT(127.02 37.49)
SELECT ST_AsGeoJSON(geom);    -- GeoJSON 문자열
SELECT ST_AsKML(geom);        -- KML (Google Earth)
SELECT ST_AsSVG(geom);        -- SVG 경로
SELECT ST_X(point), ST_Y(point);  -- 경도, 위도 추출
```

## GiST 인덱스

공간 쿼리 성능의 핵심은 **GiST(Generalized Search Tree) 인덱스**다. 공간 객체의 MBR(Minimum Bounding Rectangle)을 R-Tree 구조로 인덱싱한다.

```sql
-- 공간 인덱스 생성
CREATE INDEX idx_stores_location ON stores USING GIST (location);

-- 분석 후 최적화
ANALYZE stores;
```

`ST_DWithin`, `ST_Contains`, `ST_Intersects` 등 대부분의 공간 함수는 GiST 인덱스를 활용한다. 인덱스 없이 대용량 공간 쿼리를 실행하면 시퀀셜 스캔으로 매우 느려진다.

## 좌표 클러스터링

같은 지역의 데이터를 물리적으로 가깝게 배치하면 공간 쿼리 성능이 향상된다.

```sql
-- GiST 인덱스 순서로 테이블 재구성
CLUSTER stores USING idx_stores_location;
```

## 실용 예: 가장 가까운 N개 매장

```sql
-- KNN (K-Nearest Neighbor) 쿼리
SELECT name,
       location <-> 'POINT(127.0276 37.4979)'::geography AS dist
FROM stores
ORDER BY location <-> 'POINT(127.0276 37.4979)'::geography
LIMIT 5;
```

`<->`는 PostGIS의 거리 연산자로, GiST 인덱스를 이용한 KNN 검색을 수행한다. `ORDER BY dist LIMIT 5`보다 훨씬 효율적이다.

PostGIS는 복잡한 공간 데이터 처리를 전담 GIS 서버 없이 PostgreSQL 안에서 처리할 수 있게 해준다. 위치 기반 서비스, 물류 최적화, 도시 데이터 분석에 폭넓게 활용된다.

---

**지난 글:** [pg_stat_statements — 쿼리 통계로 슬로우 쿼리 잡기](/posts/pg-stat-statements/)

**다음 글:** [PostgreSQL 전문 검색 — tsvector와 tsquery](/posts/pg-fulltext-tsvector-tsquery/)

<br>
읽어주셔서 감사합니다. 😊
