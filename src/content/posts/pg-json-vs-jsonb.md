---
title: "JSON vs JSONB — 저장 구조와 선택 기준"
description: "PostgreSQL json과 jsonb의 저장 구조 차이, 경로 탐색 연산자(->, ->>, #>>, ?, @>), jsonb_path_query, jsonb_set 등 JSONB 핵심 기능과 실무 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["postgresql", "json", "jsonb", "jsonpath", "jsonb-operators", "gin-index", "semi-structured"]
featured: false
draft: false
---

[지난 글](/posts/pg-array-types-unnest/)에서 배열 타입의 구조와 UNNEST 패턴을 살펴봤다. 이번에는 PostgreSQL의 또 다른 강력한 비정형 데이터 타입인 **JSON과 JSONB**의 차이와 활용법을 다룬다.

## 두 타입이 공존하는 이유

PostgreSQL 9.2에서 `json` 타입이 처음 도입됐고, 9.4에서 `jsonb`가 추가됐다. 이름만 보면 "b가 붙은 버전 업그레이드"처럼 보이지만, 내부 구조가 완전히 다르다.

- **json**: 입력 텍스트를 **그대로 보존**해 저장. 읽을 때마다 파싱.
- **jsonb**: 입력 시 **파싱 후 바이너리**로 저장. 중복 키 제거, 키 정렬.

![JSON vs JSONB 저장 구조 비교](/assets/posts/pg-json-vs-jsonb-storage.svg)

## 저장 시 동작 차이

```sql
-- json: 중복 키·순서 보존
SELECT '{"b":2,"a":1,"a":3}'::json;
-- {"b":2,"a":1,"a":3}  ← 원본 그대로

-- jsonb: 중복 제거(마지막 값), 키 정렬
SELECT '{"b":2,"a":1,"a":3}'::jsonb;
-- {"a": 3, "b": 2}  ← 파싱 결과
```

이 차이가 중요한 상황은 두 가지다.

1. **감사 로그**: 외부 시스템이 보낸 원본 JSON을 완전히 보존해야 하면 `json`.
2. **검색·집계**: GIN 인덱스와 경로 탐색이 필요하면 `jsonb`.

실무의 99%는 `jsonb`를 선택한다.

## 경로 탐색 연산자

| 연산자 | 반환 타입 | 의미 |
|--------|----------|------|
| `->` | jsonb | 키로 자식 추출 (jsonb 그대로) |
| `->>` | text | 키로 자식 추출 (텍스트 변환) |
| `#>` | jsonb | 배열 경로로 중첩 추출 |
| `#>>` | text | 배열 경로로 중첩 추출 (텍스트) |
| `?` | boolean | 최상위 키 존재 여부 |
| `?|` | boolean | 키 중 하나라도 존재 |
| `?&` | boolean | 키 모두 존재 |
| `@>` | boolean | 왼쪽이 오른쪽 JSON 포함 |
| `<@` | boolean | 왼쪽이 오른쪽에 포함 |
| `\|\|` | jsonb | 두 jsonb 병합 (오른쪽 우선) |
| `-` | jsonb | 키 제거 |

```sql
WITH doc AS (
    SELECT '{"name":"Alice","age":30,"addr":{"city":"Seoul","zip":"04524"}}'::jsonb AS d
)
SELECT
    d -> 'name'          AS name_jsonb,    -- "Alice"
    d ->> 'name'         AS name_text,     -- Alice
    d -> 'addr' ->> 'city' AS city,        -- Seoul
    d #>> '{addr,city}'  AS city2,         -- Seoul
    d ? 'age'            AS has_age,       -- true
    d @> '{"age":30}'    AS age_match      -- true
FROM doc;
```

![JSONB 경로 탐색 연산자와 함수](/assets/posts/pg-json-vs-jsonb-operators.svg)

## jsonb_set — 원소 수정

```sql
-- 특정 키 값 교체
UPDATE user_profile
SET meta = jsonb_set(meta, '{theme}', '"dark"')
WHERE id = 1;

-- 중첩 키 수정
UPDATE user_profile
SET meta = jsonb_set(meta, '{notification,email}', 'true')
WHERE id = 1;

-- 키 제거 (- 연산자)
UPDATE user_profile
SET meta = meta - 'legacy_field'
WHERE id = 1;

-- 여러 키 제거
UPDATE user_profile
SET meta = meta - ARRAY['tmp', 'debug']
WHERE id = 1;
```

## jsonb_path_query — JSON Path 표준

PostgreSQL 12에서 ISO SQL/JSON 표준의 JSON Path가 도입됐다. 복잡한 중첩 탐색과 조건 필터를 한 표현식으로 처리한다.

```sql
-- 기본 경로 탐색
SELECT jsonb_path_query(
    '{"scores":[85,92,78,95]}'::jsonb,
    '$.scores[*] ? (@ > 80)'
);
-- 85, 92, 95

-- 조건부 추출
SELECT jsonb_path_query_array(
    '{"items":[{"name":"A","qty":5},{"name":"B","qty":0}]}'::jsonb,
    '$.items[*] ? (@.qty > 0).name'
);
-- ["A"]

-- 테이블 컬럼에 적용
SELECT id, jsonb_path_query_first(meta, '$.plan.tier') AS tier
FROM user_profile
WHERE jsonb_path_exists(meta, '$.plan ? (@.tier == "pro")');
```

## jsonb_each와 jsonb_object_keys

```sql
-- 키-값 쌍을 행으로 분해
SELECT key, value
FROM jsonb_each('{"a":1,"b":"hello","c":true}'::jsonb);
-- a | 1
-- b | "hello"
-- c | true

-- 텍스트 값만 분해
SELECT key, value
FROM jsonb_each_text('{"a":1,"b":"hello"}'::jsonb);
-- a | 1
-- b | hello

-- 키 목록
SELECT jsonb_object_keys('{"x":1,"y":2}'::jsonb);
-- x
-- y
```

## json_agg와 jsonb_agg — 행을 JSON 배열로

```sql
-- 결과 행을 JSON 배열로
SELECT json_agg(row_to_json(u))
FROM (SELECT id, name FROM users LIMIT 5) u;

-- jsonb 버전
SELECT jsonb_agg(to_jsonb(u))
FROM (SELECT id, name FROM users LIMIT 5) u;

-- 객체로 집계
SELECT json_object_agg(name, score) AS leaderboard
FROM player_score
ORDER BY score DESC;
```

## API 응답 캐싱 패턴

`jsonb`를 활용하면 외부 API 응답을 그대로 캐싱하되 일부 필드로 인덱스를 걸 수 있다.

```sql
CREATE TABLE api_cache (
    endpoint  text,
    fetched   timestamptz DEFAULT now(),
    payload   jsonb NOT NULL
);

-- 특정 필드에만 GIN 인덱스
CREATE INDEX idx_api_payload ON api_cache USING GIN (payload);

-- 부분 일치 검색
SELECT payload ->> 'status' AS status
FROM api_cache
WHERE payload @> '{"type":"order"}'
  AND fetched > now() - INTERVAL '1 hour';
```

## 성능 특성 요약

| 항목 | json | jsonb |
|------|------|-------|
| 쓰기 속도 | 빠름 (텍스트 저장) | 소폭 느림 (파싱) |
| 읽기 속도 | 느림 (매번 파싱) | 빠름 |
| 경로 탐색 | 느림 | 빠름 |
| GIN 인덱스 | 불가 | 가능 |
| @> 연산 | 불가 | GIN 활용 |
| 원본 보존 | 완전 보존 | 정규화됨 |

## 정리

`json`과 `jsonb`의 차이는 "원본 보존 vs 검색 성능"이다. 특별한 이유 없이 항상 `jsonb`를 선택하라. 다음 글에서는 `jsonb`에 GIN 인덱스를 적용해 대용량 문서에서 고속 검색을 실현하는 방법을 다룬다.

---

**지난 글:** [PostgreSQL 배열 타입과 UNNEST — 다차원 데이터 처리](/posts/pg-array-types-unnest/)

**다음 글:** [JSONB GIN 인덱스 — 문서 검색 최적화](/posts/pg-jsonb-indexing-gin/)

<br>
읽어주셔서 감사합니다. 😊
