---
title: "PostgreSQL 전문 검색 — tsvector와 tsquery"
description: "PostgreSQL 내장 전문 검색의 tsvector 색인 벡터 구조, 토크나이징·불용어·어간 추출 파이프라인, tsquery 연산자(&·|·!·<->), to_tsvector·plainto_tsquery·websearch_to_tsquery, @@ 연산자, GIN 인덱스, ts_rank 랭킹, ts_headline 하이라이트, 한국어 simple 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["postgresql", "full-text-search", "tsvector", "tsquery", "gin-index", "ts-rank", "ts-headline", "websearch-to-tsquery", "korean-search", "simple-config"]
featured: false
draft: false
---

[지난 글](/posts/pg-postgis-intro/)에서 PostGIS로 공간 쿼리를 다뤘다. 이번에는 PostgreSQL 내장 **전문 검색(Full-Text Search)**을 살펴본다. 외부 검색 엔진 없이 `LIKE '%키워드%'`보다 훨씬 정확하고 빠른 텍스트 검색을 구현할 수 있다.

## LIKE 검색의 한계

```sql
-- LIKE는 인덱스를 못 쓰고, 형태소 분석도 없다
SELECT * FROM articles WHERE body LIKE '%데이터베이스%';
-- "데이터베이스의", "데이터베이스들"은 놓침
```

`LIKE`는 패턴 매칭이지 언어 이해가 아니다. 어간 변형, 불용어 처리, 관련성 랭킹이 없다.

## tsvector — 문서 색인

`tsvector`는 텍스트를 검색 가능한 형태로 변환한 자료 구조다. 각 단어(렉심, lexeme)와 그 위치를 저장한다.

```sql
-- to_tsvector: 언어 설정 + 텍스트 → tsvector
SELECT to_tsvector('english', 'PostgreSQL is running fast and efficiently');
-- 결과: 'effici':6 'fast':5 'postgresql':1 'run':3
-- "is", "and" 불용어 제거, "running"→"run" 어간 추출
```

각 렉심 뒤의 숫자는 원문에서의 위치다. `A:1 B:2` 형식에서 A, B는 가중치(A=가장 높음, D=가장 낮음)다.

## 전문 검색 파이프라인

![PostgreSQL 전문 검색 파이프라인](/assets/posts/pg-fulltext-tsvector-tsquery-pipeline.svg)

텍스트 → tsvector 변환 과정:
1. **토크나이징**: 텍스트를 단어 단위로 분리
2. **불용어 제거**: "is", "the", "a" 같은 빈출 단어 제거
3. **어간 추출(Stemming)**: "running" → "run", "databases" → "databas"
4. **렉심 + 위치**: 최종 검색 가능한 단어와 위치 번호 저장

## tsquery — 검색 조건

`tsquery`는 검색 조건을 나타내는 자료 구조다.

```sql
-- 다양한 tsquery 생성 방법
SELECT to_tsquery('english', 'postgres & fast');       -- AND: 둘 다 포함
SELECT to_tsquery('english', 'postgres | mysql');      -- OR: 하나라도 포함
SELECT to_tsquery('english', 'fast & !slow');          -- NOT: slow 제외
SELECT to_tsquery('english', 'very <-> fast');         -- 인접 (very 바로 다음에 fast)
SELECT to_tsquery('english', 'data <2> base');         -- 2단어 내 거리

-- plainto_tsquery: 공백을 AND로 자동 처리 (사용자 입력에 편리)
SELECT plainto_tsquery('english', 'postgresql fast database');
-- 결과: 'postgresql' & 'fast' & 'databas'

-- websearch_to_tsquery (PG11+): 웹 검색 스타일
SELECT websearch_to_tsquery('english', '"fast database" OR mysql -slow');
-- "fast database" 구문 검색, OR, - 빼기 지원
```

## @@ 연산자로 매칭

```sql
SELECT 'PostgreSQL is fast'::tsvector @@ 'fast'::tsquery;   -- true
SELECT to_tsvector('english', 'PostgreSQL is fast')
    @@ to_tsquery('english', 'slow');                         -- false
```

## 완성 예제: 생성 컬럼 + GIN 인덱스 + 랭킹

![GIN 인덱스와 랭킹 쿼리](/assets/posts/pg-fulltext-tsvector-tsquery-gin.svg)

```sql
-- 1. tsvector 생성 컬럼 추가 (자동 갱신)
ALTER TABLE articles
ADD COLUMN tsv tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple',
    coalesce(title, '') || ' ' || coalesce(body, ''))
) STORED;

-- 2. GIN 인덱스 생성
CREATE INDEX idx_articles_tsv ON articles USING GIN (tsv);

-- 3. 검색 + 랭킹 + 하이라이트
SELECT
  title,
  ts_rank(tsv, q)                                    AS rank,
  ts_headline('simple', body, q, 'MaxWords=20')      AS snippet
FROM articles,
  websearch_to_tsquery('simple', '데이터베이스 성능') AS q(q)
WHERE tsv @@ q
ORDER BY rank DESC
LIMIT 20;
```

`GENERATED ALWAYS AS ... STORED`를 사용하면 INSERT/UPDATE 시 tsvector가 자동으로 업데이트된다. 별도 트리거 없이도 인덱스가 항상 최신 상태를 유지한다.

## ts_rank와 ts_rank_cd

- `ts_rank(tsvector, tsquery)` — 렉심 빈도 기반 랭킹
- `ts_rank_cd(tsvector, tsquery)` — 커버 밀도(Cover Density) 기반 랭킹. 검색어가 가까이 모여 있을수록 점수가 높다.

```sql
-- normalization: 문서 길이 보정 (0=없음, 1=길이 나누기, 2=로그)
SELECT ts_rank(tsv, q, 1) AS rank  -- 문서 길이로 정규화
FROM articles, websearch_to_tsquery('simple', '검색어') AS q(q)
WHERE tsv @@ q;
```

## ts_headline — 검색어 하이라이트

```sql
SELECT ts_headline(
  'english',
  'PostgreSQL full text search is fast and scalable',
  to_tsquery('english', 'search & fast'),
  'StartSel=<b>, StopSel=</b>, MaxWords=15, MinWords=5'
);
-- 결과: "full text <b>search</b> is <b>fast</b> and scalable"
```

옵션:
- `StartSel`, `StopSel`: 하이라이트 태그
- `MaxWords`, `MinWords`: 스니펫 길이
- `MaxFragments`: 반환할 스니펫 조각 수
- `HighlightAll`: 전체 텍스트에서 모두 하이라이트

## 한국어 전문 검색

PostgreSQL 내장 텍스트 설정은 영어·유럽어 어간 분석이 기본이다. 한국어는 형태소 분석기가 없으므로 `simple` 설정을 사용한다. `simple`은 불용어 제거·소문자화만 하고 어간 추출은 하지 않는다.

```sql
SELECT to_tsvector('simple', '데이터베이스 성능 최적화');
-- '데이터베이스':1 '성능':2 '최적화':3

-- zhparser(중국어), pg_jieba 같은 서드파티 토크나이저를 사용하거나
-- 한국어는 n-gram 방식의 pg_trgm과 조합하는 방법도 있다
CREATE INDEX idx_trgm ON articles USING GIN (body gin_trgm_ops);
SELECT * FROM articles WHERE body LIKE '%데이터베이스%';  -- 인덱스 활용
```

완전한 한국어 형태소 분석이 필요하다면 `mecab`, `kiwi` 등 외부 형태소 분석기를 PL/Python 함수로 감싸서 사용하는 방법이 현실적이다.

## 인덱스 선택: GIN vs GiST

| | GIN | GiST |
|---|---|---|
| 인덱스 크기 | 크다 | 작다 |
| 빌드 시간 | 느리다 | 빠르다 |
| 검색 속도 | 빠르다 | 보통 |
| 업데이트 비용 | 높다 | 낮다 |

쓰기가 잦은 OLTP 환경에서는 GiST, 읽기 위주나 배치 업데이트 환경에서는 GIN이 적합하다. `fastupdate` 옵션으로 GIN 쓰기 비용을 낮출 수 있다.

```sql
CREATE INDEX idx_tsv ON articles USING GIN (tsv) WITH (fastupdate = on);
```

---

**지난 글:** [PostGIS 입문 — 지리 데이터 타입과 공간 쿼리](/posts/pg-postgis-intro/)

**다음 글:** [PostgreSQL FDW — Foreign Data Wrapper로 외부 데이터 연결](/posts/pg-foreign-data-wrapper/)

<br>
읽어주셔서 감사합니다. 😊
