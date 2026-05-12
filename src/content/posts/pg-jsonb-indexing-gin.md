---
title: "JSONB GIN 인덱스 — 문서 검색 최적화"
description: "PostgreSQL JSONB 컬럼에 GIN 인덱스를 적용해 @>, ?, ?| 등 포함 검색을 최적화하는 방법, jsonb_ops vs jsonb_path_ops 비교, 표현식 인덱스 패턴, fastupdate 옵션을 실무 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["postgresql", "jsonb", "gin-index", "jsonb-ops", "jsonb-path-ops", "expression-index", "full-text", "inverted-index"]
featured: false
draft: false
---

[지난 글](/posts/pg-json-vs-jsonb/)에서 JSON과 JSONB의 저장 구조 차이를 살펴봤다. JSONB가 강력한 이유 중 하나는 **GIN(Generalized Inverted Index)**와 결합해 문서 내 임의 경로를 고속으로 검색할 수 있다는 점이다.

## GIN 인덱스란

GIN은 **역인덱스(Inverted Index)**다. 전통적인 B-tree 인덱스가 "행 → 값"을 저장한다면, GIN은 "값 → 행 ID 목록"을 저장한다. 전문 검색(Full-Text Search)이나 배열, JSONB처럼 **하나의 행이 여러 검색 키를 가지는 경우**에 적합하다.

JSONB의 각 키-값 쌍이 GIN 엔트리가 된다. `{"plan":"pro","tier":2}` 문서는 `"plan"="pro"`, `"tier"=2` 두 개의 엔트리를 GIN에 등록한다.

![GIN 인덱스 구조 — JSONB 문서 검색](/assets/posts/pg-jsonb-indexing-gin-structure.svg)

## GIN 인덱스 생성

```sql
-- 기본 GIN (jsonb_ops): ?, ?|, ?&, @> 모두 지원
CREATE INDEX idx_payload ON user_profile USING GIN (payload);

-- jsonb_path_ops: @> 전용, 인덱스 크기 20~40% 작음
CREATE INDEX idx_payload_path ON user_profile
    USING GIN (payload jsonb_path_ops);

-- 동시 생성 (테이블 잠금 없음, 시간 더 걸림)
CREATE INDEX CONCURRENTLY idx_payload_concurrent
    ON user_profile USING GIN (payload);
```

`jsonb_path_ops`는 내부적으로 경로와 값을 해시해 저장하므로 엔트리 크기가 작다. `@>` 검색만 사용한다면 이쪽이 유리하다.

## GIN이 활용되는 연산자

```sql
-- @> : jsonb 포함 (가장 자주 쓰임)
SELECT id FROM user_profile
WHERE payload @> '{"plan":"pro"}';

-- ? : 최상위 키 존재
SELECT id FROM user_profile
WHERE payload ? 'premium_feature';

-- ?| : 키 중 하나라도 존재 (OR)
SELECT id FROM user_profile
WHERE payload ?| ARRAY['trial', 'pro'];

-- ?& : 키 모두 존재 (AND)
SELECT id FROM user_profile
WHERE payload ?& ARRAY['name', 'email'];
```

`EXPLAIN (ANALYZE, BUFFERS)`로 **Bitmap Index Scan** 또는 **Index Scan**이 나타나면 GIN이 작동하는 것이다.

![GIN 인덱스 생성과 활용 쿼리](/assets/posts/pg-jsonb-indexing-gin-code.svg)

## 표현식 인덱스 — 특정 키만 인덱싱

전체 JSONB 문서가 아니라 특정 키의 값만 인덱싱할 때는 **표현식 인덱스(Expression Index)**를 사용한다. B-tree 인덱스를 활용할 수 있으므로 `=`, `<`, `>`, `BETWEEN` 등 범위 검색에도 유리하다.

```sql
-- plan 키의 값을 B-tree 인덱스로
CREATE INDEX idx_plan ON user_profile ((payload ->> 'plan'));

-- 이 쿼리는 idx_plan 인덱스 활용
SELECT * FROM user_profile
WHERE payload ->> 'plan' = 'pro';

-- 숫자 비교 (캐스팅 필요)
CREATE INDEX idx_tier ON user_profile (((payload ->> 'tier')::integer));

SELECT * FROM user_profile
WHERE (payload ->> 'tier')::integer >= 2;
```

GIN vs 표현식 인덱스 선택 기준:
- 포함 검색(`@>`, `?`) → **GIN**
- 특정 키 등치·범위 검색 → **표현식 B-tree**

## fastupdate — 쓰기 성능 최적화

GIN 인덱스는 쓰기 시 역인덱스 업데이트 비용이 높다. `fastupdate` 옵션(기본 `on`)은 변경을 즉시 GIN에 반영하지 않고 **pending list**에 모았다가 배치로 처리한다.

```sql
-- fastupdate 비활성화 (쓰기 지연 없이 항상 최신 상태)
CREATE INDEX idx_payload ON user_profile
    USING GIN (payload) WITH (fastupdate = off);

-- pending list 수동 플러시
SELECT gin_clean_pending_list('idx_payload'::regclass);
```

`fastupdate=on`이면 대량 INSERT 성능이 높지만, pending list가 크면 쿼리 시 추가 비용이 발생할 수 있다. OLTP 환경에서 쓰기 빈도가 높으면 `fastupdate=off`도 고려한다.

## GIN 인덱스 크기 모니터링

```sql
-- 인덱스 크기 확인
SELECT indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS idx_size
FROM pg_stat_user_indexes
WHERE tablename = 'user_profile';

-- GIN pending list 크기
SELECT relname,
       n_dead_tup,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE relname = 'user_profile';
```

## 부분 GIN 인덱스

조건에 맞는 행만 인덱싱해 크기를 줄인다.

```sql
-- active 사용자만 인덱싱
CREATE INDEX idx_active_payload ON user_profile
    USING GIN (payload)
WHERE (payload ->> 'active')::boolean = true;

-- 이 인덱스는 다음 쿼리에만 활용됨
SELECT * FROM user_profile
WHERE (payload ->> 'active')::boolean = true
  AND payload @> '{"plan":"pro"}';
```

## 실전 패턴: 유연한 필터 API

JSONB + GIN의 가장 강력한 활용은 **동적 필터 API**다. 프론트엔드에서 임의 JSON 조건을 보내면 DB에서 포함 검색으로 처리한다.

```sql
-- API 서버에서 전달받은 필터 조건
-- {"plan":"pro","region":"KR"}
SELECT id, email
FROM user_profile
WHERE payload @> $1::jsonb  -- 파라미터 바인딩
ORDER BY id;
```

`@>` 하나로 임의 조건을 처리하며 GIN 인덱스가 최적화한다. EAV 패턴 대비 쿼리가 단순하고 성능이 뛰어나다.

## 주의사항

- 중첩 깊이가 깊은 JSONB 문서는 GIN 엔트리 수가 급증
- JSONB 컬럼 크기가 크면 TOAST로 넘어가 인덱스 비효율
- 빈번한 `jsonb_set` 업데이트는 HOT(Heap Only Tuple) 최적화를 방해
- 전체 문서를 자주 바꾸는 패턴보다 특정 키만 갱신하는 패턴 권장

## 정리

JSONB GIN 인덱스는 "유연한 스키마 + 고속 검색"을 동시에 달성하는 PostgreSQL의 핵심 기능이다. `@>` 포함 검색에는 `jsonb_path_ops`, 키 존재 검색에는 `jsonb_ops`, 특정 키 범위 검색에는 표현식 B-tree를 조합하면 대부분의 문서 검색 요구를 커버할 수 있다.

---

**지난 글:** [JSON vs JSONB — 저장 구조와 선택 기준](/posts/pg-json-vs-jsonb/)

**다음 글:** [PostgreSQL 범위 타입 — daterange, tstzrange, 겹침 방지 제약](/posts/pg-range-types/)

<br>
읽어주셔서 감사합니다. 😊
